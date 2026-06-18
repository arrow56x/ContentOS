import { Router } from 'express';
import pg from 'pg';
import { FieldValue } from 'firebase-admin/firestore';
import { firestore } from '../firestore.js';

const { Pool } = pg;

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  : null;

export const videosRouter = Router();

const VIDEOS_COLUMNS = ['s no.', 'view video', 'date and time of upload', 'script name', 'current status', 'edited video'] as const;
type VideoColumn = (typeof VIDEOS_COLUMNS)[number];
type VideoRow = Record<VideoColumn, string | number | null>;

// ---------------------------------------------------------------------------
// GET /api/videos/status — check if the user's videos table exists
// ---------------------------------------------------------------------------
videosRouter.get('/status', async (req, res) => {
  const email = req.userEmail;
  if (!email) {
    return res.status(400).json({ error: 'Signed-in user has no email address.' });
  }

  if (!pool) {
    return res.status(500).json({
      error:
        'Supabase database URL is not configured. Set SUPABASE_DB_URL in server/.env.',
    });
  }

  const meta = await getVideosMeta(req.uid!, email);
  const tableName = meta.tableName;

  try {
    const exists = await videosTableExists(tableName);
    if (exists) {
      await migrateVideosTable(tableName);
      if (!meta.saved) {
        await saveVideosMeta(req.uid!, email, tableName);
      }
    }
    const rows = exists ? await listVideosRows(tableName) : [];
    res.json({ ok: true, exists, table: tableName, columns: VIDEOS_COLUMNS, rows });
  } catch (err) {
    console.error('[videos] status error:', err);
    res.status(500).json({ error: 'Failed to check videos table in Supabase.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/videos/load — create the table if it doesn't exist, return rows
// ---------------------------------------------------------------------------
videosRouter.post('/load', async (req, res) => {
  const email = req.userEmail;
  if (!email) {
    return res.status(400).json({ error: 'Signed-in user has no email address.' });
  }

  if (!pool) {
    return res.status(500).json({
      error:
        'Supabase database URL is not configured. Set SUPABASE_DB_URL in server/.env.',
    });
  }

  const tableName = `${email}_videos`;
  const tableIdent = quoteIdentifier(tableName);

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableIdent} (
        "s no." BIGSERIAL PRIMARY KEY,
        "view video" TEXT NOT NULL DEFAULT '',
        "date and time of upload" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "script name" TEXT NOT NULL DEFAULT '',
        "current status" TEXT NOT NULL DEFAULT 'submitted',
        "edited video" TEXT NOT NULL DEFAULT ''
      );
    `);

    await migrateVideosTable(tableName);

    await saveVideosMeta(req.uid!, email, tableName);
    const rows = await listVideosRows(tableName);
    res.json({ ok: true, table: tableName, columns: VIDEOS_COLUMNS, rows });
  } catch (err) {
    console.error('[videos] load error:', err);
    res.status(500).json({ error: 'Failed to create videos table in Supabase.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/videos/add — add a new video row (creates table if needed)
// ---------------------------------------------------------------------------
videosRouter.post('/add', async (req, res) => {
  const email = req.userEmail;
  if (!email) {
    return res.status(400).json({ error: 'Signed-in user has no email address.' });
  }

  if (!pool) {
    return res.status(500).json({
      error:
        'Supabase database URL is not configured. Set SUPABASE_DB_URL in server/.env.',
    });
  }

  const videoUrl = typeof req.body?.videoUrl === 'string' ? req.body.videoUrl.trim() : '';
  const scriptName = typeof req.body?.scriptName === 'string' ? req.body.scriptName.trim() : '';

  if (!videoUrl) {
    return res.status(400).json({ error: 'videoUrl is required.' });
  }

  const tableName = `${email}_videos`;
  const tableIdent = quoteIdentifier(tableName);

  try {
    // Ensure table exists (CREATE IF NOT EXISTS is safe to call every time)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableIdent} (
        "s no." BIGSERIAL PRIMARY KEY,
        "view video" TEXT NOT NULL DEFAULT '',
        "date and time of upload" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "script name" TEXT NOT NULL DEFAULT '',
        "current status" TEXT NOT NULL DEFAULT 'submitted',
        "edited video" TEXT NOT NULL DEFAULT ''
      );
    `);

    await migrateVideosTable(tableName);

    // Script name is the identifier for a video across the pipeline. If a row
    // for this script already exists, update it in place (don't create a
    // duplicate); otherwise insert a new row. Matching is case-insensitive on
    // a trimmed script name. Rows with an empty script name always insert.
    const returning = `
      RETURNING
        "s no.",
        "view video",
        "date and time of upload",
        "script name",
        "current status",
        "edited video"
    `;

    let row: VideoRow;
    const existing = scriptName
      ? await pool.query<VideoRow>(
          `SELECT "s no." FROM ${tableIdent} WHERE LOWER(TRIM("script name")) = LOWER($1) LIMIT 1`,
          [scriptName]
        )
      : { rowCount: 0, rows: [] as VideoRow[] };

    if (existing.rowCount && existing.rows[0]) {
      const updated = await pool.query<VideoRow>(
        `UPDATE ${tableIdent}
           SET "view video" = $1,
               "current status" = 'submitted',
               "date and time of upload" = NOW()
         WHERE "s no." = $2
         ${returning}`,
        [videoUrl, existing.rows[0]['s no.']]
      );
      row = updated.rows[0];
    } else {
      const inserted = await pool.query<VideoRow>(
        `INSERT INTO ${tableIdent} ("view video", "script name", "current status")
         VALUES ($1, $2, 'submitted')
         ${returning}`,
        [videoUrl, scriptName]
      );
      row = inserted.rows[0];
    }

    await saveVideosMeta(req.uid!, email, tableName);
    res.json({ ok: true, table: tableName, row });
  } catch (err) {
    console.error('[videos] add error:', err);
    res.status(500).json({ error: 'Failed to add video to Supabase.' });
  }
});

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

async function getVideosMeta(uid: string, email: string) {
  const snap = await userRef(uid).get();
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const tableName =
    typeof data.videosTable === 'string'
      ? data.videosTable
      : `${email}_videos`;
  return { tableName, saved: typeof data.videosTable === 'string' };
}

async function saveVideosMeta(uid: string, email: string, tableName: string) {
  const ref = userRef(uid);
  const snap = await ref.get();
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  await ref.set(
    {
      email,
      videosTable: tableName,
      videosTableUpdatedAt: FieldValue.serverTimestamp(),
      ...(typeof data.videosTableCreatedAt === 'undefined'
        ? { videosTableCreatedAt: FieldValue.serverTimestamp() }
        : {}),
    },
    { merge: true }
  );
}

function userRef(uid: string) {
  return firestore.collection('users').doc(uid);
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function videosTableExists(tableName: string): Promise<boolean> {
  if (!pool) return false;
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS "exists"`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function listVideosRows(tableName: string): Promise<VideoRow[]> {
  if (!pool) return [];
  const tableIdent = quoteIdentifier(tableName);
  const result = await pool.query<VideoRow>(`
    SELECT
      "s no.",
      "view video",
      "date and time of upload",
      "script name",
      "current status",
      "edited video"
    FROM ${tableIdent}
    ORDER BY "s no." ASC
  `);
  return result.rows;
}

/** Add the "edited video" column to existing tables that don't have it yet. */
async function migrateVideosTable(tableName: string): Promise<void> {
  if (!pool) return;
  const columns = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName]
  );
  const columnNames = new Set(columns.rows.map((row) => row.column_name));
  const tableIdent = quoteIdentifier(tableName);

  if (!columnNames.has('edited video')) {
    await pool.query(`ALTER TABLE ${tableIdent} ADD COLUMN "edited video" TEXT NOT NULL DEFAULT ''`);
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
