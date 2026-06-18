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

export const captionsRouter = Router();

const CAPTIONS_COLUMNS = ['s no.', 'script name', 'edited video', 'posted', 'caption'] as const;
type CaptionColumn = (typeof CAPTIONS_COLUMNS)[number];
type CaptionRow = Record<CaptionColumn, string | number | null>;

/** Per-user table name, e.g. "user@example.com_captions_schedule". */
function tableNameFor(email: string): string {
  return `${email}_captions_schedule`;
}

// ---------------------------------------------------------------------------
// GET /api/captions/status — does the user's captions&schedule table exist?
// ---------------------------------------------------------------------------
captionsRouter.get('/status', async (req, res) => {
  const email = req.userEmail;
  if (!email) {
    return res.status(400).json({ error: 'Signed-in user has no email address.' });
  }
  if (!pool) {
    return res.status(500).json({
      error: 'Supabase database URL is not configured. Set SUPABASE_DB_URL in server/.env.',
    });
  }

  const tableName = tableNameFor(email);

  try {
    const exists = await tableExists(tableName);
    const rows = exists ? await listRows(tableName) : [];
    res.json({ ok: true, exists, table: tableName, columns: CAPTIONS_COLUMNS, rows });
  } catch (err) {
    console.error('[captions] status error:', err);
    res.status(500).json({ error: 'Failed to check captions table in Supabase.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/captions/load — create the table if missing, save meta, return rows
// ---------------------------------------------------------------------------
captionsRouter.post('/load', async (req, res) => {
  const email = req.userEmail;
  if (!email) {
    return res.status(400).json({ error: 'Signed-in user has no email address.' });
  }
  if (!pool) {
    return res.status(500).json({
      error: 'Supabase database URL is not configured. Set SUPABASE_DB_URL in server/.env.',
    });
  }

  const tableName = tableNameFor(email);
  const tableIdent = quoteIdentifier(tableName);

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableIdent} (
        "s no."        BIGSERIAL PRIMARY KEY,
        "script name"  TEXT NOT NULL DEFAULT '',
        "edited video" TEXT NOT NULL DEFAULT '',
        "posted"       TEXT NOT NULL DEFAULT 'no',
        "caption"      TEXT NOT NULL DEFAULT ''
      );
    `);

    await saveCaptionsMeta(req.uid!, email, tableName);
    const rows = await listRows(tableName);
    res.json({ ok: true, table: tableName, columns: CAPTIONS_COLUMNS, rows });
  } catch (err) {
    console.error('[captions] load error:', err);
    res.status(500).json({ error: 'Failed to create captions table in Supabase.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/captions/schedule — schedule a video for posting
//   1. Creates {email}_scheduled_post (idempotent) and inserts the row.
//   2. Sets "video posting" = 'scheduled' in {email}_progress for that script.
// ---------------------------------------------------------------------------
const SCHEDULED_COLUMNS = ['s no.', 'video', 'scriptname', 'scheduled date', 'platform', 'posted'] as const;

captionsRouter.post('/schedule', async (req, res) => {
  const email = req.userEmail;
  const uid = req.uid!;
  if (!email) {
    return res.status(400).json({ error: 'Signed-in user has no email address.' });
  }
  if (!pool) {
    return res.status(500).json({
      error: 'Supabase database URL is not configured. Set SUPABASE_DB_URL in server/.env.',
    });
  }

  const scriptName = typeof req.body?.scriptName === 'string' ? req.body.scriptName.trim() : '';
  const video = typeof req.body?.video === 'string' ? req.body.video.trim() : '';
  const scheduledDate = typeof req.body?.scheduledDate === 'string' ? req.body.scheduledDate.trim() : '';
  const platform = typeof req.body?.platform === 'string' ? req.body.platform.trim() : '';

  if (!scriptName) return res.status(400).json({ error: 'scriptName is required.' });
  if (!scheduledDate) return res.status(400).json({ error: 'scheduledDate is required.' });
  if (!platform) return res.status(400).json({ error: 'platform is required.' });

  const scheduledTable = `${email}_scheduled_post`;
  const scheduledIdent = quoteIdentifier(scheduledTable);
  const progressTable = `${email}_progress`;
  const progressIdent = quoteIdentifier(progressTable);

  try {
    // 1. Create the scheduled-post table if needed and insert the new row.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${scheduledIdent} (
        "s no."          BIGSERIAL    PRIMARY KEY,
        "video"          TEXT         NOT NULL DEFAULT '',
        "scriptname"     TEXT         NOT NULL DEFAULT '',
        "scheduled date" TIMESTAMPTZ,
        "platform"       TEXT         NOT NULL DEFAULT '',
        "posted"         TEXT         NOT NULL DEFAULT 'scheduled'
      );
    `);

    // Script name is the identifier for the video across the pipeline. If this
    // script is already scheduled, update its row in place (case-insensitive,
    // trimmed) instead of creating a duplicate; otherwise insert a new row.
    const scheduledReturning = `RETURNING "s no.", "video", "scriptname", "scheduled date", "platform", "posted"`;
    const existingScheduled = await pool.query<{ 's no.': number }>(
      `SELECT "s no." FROM ${scheduledIdent} WHERE LOWER(TRIM("scriptname")) = LOWER($1) LIMIT 1`,
      [scriptName]
    );

    let insertResult;
    if (existingScheduled.rowCount && existingScheduled.rows[0]) {
      insertResult = await pool.query(
        `UPDATE ${scheduledIdent}
           SET "video" = $1, "scheduled date" = $2, "platform" = $3, "posted" = 'scheduled'
         WHERE "s no." = $4
         ${scheduledReturning}`,
        [video, scheduledDate, platform, existingScheduled.rows[0]['s no.']]
      );
    } else {
      insertResult = await pool.query(
        `INSERT INTO ${scheduledIdent} ("video", "scriptname", "scheduled date", "platform", "posted")
         VALUES ($1, $2, $3, $4, 'scheduled')
         ${scheduledReturning}`,
        [video, scriptName, scheduledDate, platform]
      );
    }

    // 2. Mark "video posting" = 'scheduled' in the progress table for this script.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${progressIdent} (
        "serial number"        BIGSERIAL  PRIMARY KEY,
        "script name"          TEXT       NOT NULL DEFAULT '',
        "raw video uploaded"   TEXT       NOT NULL DEFAULT 'pending',
        "video edited"         TEXT       NOT NULL DEFAULT 'pending',
        "video captioned"      TEXT       NOT NULL DEFAULT 'pending',
        "video posting"        TEXT       NOT NULL DEFAULT 'pending'
      );
    `);

    const updateProgress = await pool.query(
      `UPDATE ${progressIdent}
       SET "video posting" = 'scheduled'
       WHERE LOWER(TRIM("script name")) = LOWER($1)
       RETURNING *`,
      [scriptName]
    );

    // If no progress row exists for this script, create one so it's tracked.
    if (!updateProgress.rowCount) {
      await pool.query(
        `INSERT INTO ${progressIdent}
           ("script name", "raw video uploaded", "video edited", "video captioned", "video posting")
         VALUES ($1, 'pending', 'pending', 'pending', 'scheduled')`,
        [scriptName]
      );
    }

    await saveScheduledMeta(uid, email, scheduledTable);

    console.log(`[captions/schedule] scheduled "${scriptName}" on ${platform} for ${email}`);
    res.json({ ok: true, table: scheduledTable, row: insertResult.rows[0] });
  } catch (err) {
    console.error('[captions] schedule error:', err);
    res.status(500).json({ error: 'Failed to schedule the video.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/captions/scheduled/load — return rows of {email}_scheduled_post.
//   Creates the table if missing, saves table+columns to Firestore for quick
//   reference, and returns all scheduled rows.
// ---------------------------------------------------------------------------
captionsRouter.post('/scheduled/load', async (req, res) => {
  const email = req.userEmail;
  const uid = req.uid!;
  if (!email) {
    return res.status(400).json({ error: 'Signed-in user has no email address.' });
  }
  if (!pool) {
    return res.status(500).json({
      error: 'Supabase database URL is not configured. Set SUPABASE_DB_URL in server/.env.',
    });
  }

  const scheduledTable = `${email}_scheduled_post`;
  const scheduledIdent = quoteIdentifier(scheduledTable);

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${scheduledIdent} (
        "s no."          BIGSERIAL    PRIMARY KEY,
        "video"          TEXT         NOT NULL DEFAULT '',
        "scriptname"     TEXT         NOT NULL DEFAULT '',
        "scheduled date" TIMESTAMPTZ,
        "platform"       TEXT         NOT NULL DEFAULT '',
        "posted"         TEXT         NOT NULL DEFAULT 'scheduled'
      );
    `);

    await saveScheduledMeta(uid, email, scheduledTable);

    const result = await pool.query(`
      SELECT "s no.", "video", "scriptname", "scheduled date", "platform", "posted"
      FROM ${scheduledIdent}
      ORDER BY "scheduled date" ASC NULLS LAST, "s no." ASC
    `);

    res.json({ ok: true, table: scheduledTable, columns: SCHEDULED_COLUMNS, rows: result.rows });
  } catch (err) {
    console.error('[captions] scheduled/load error:', err);
    res.status(500).json({ error: 'Failed to load scheduled posts.' });
  }
});

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function tableExists(tableName: string): Promise<boolean> {
  if (!pool) return false;
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS "exists"`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function listRows(tableName: string): Promise<CaptionRow[]> {
  if (!pool) return [];
  const tableIdent = quoteIdentifier(tableName);
  const result = await pool.query<CaptionRow>(`
    SELECT
      "s no.",
      "script name",
      "edited video",
      "posted",
      "caption"
    FROM ${tableIdent}
    ORDER BY "s no." ASC
  `);
  return result.rows;
}

// ---------------------------------------------------------------------------
// Firestore helpers — store the table name + columns for the user
// ---------------------------------------------------------------------------

function userRef(uid: string) {
  return firestore.collection('users').doc(uid);
}

async function saveCaptionsMeta(uid: string, email: string, tableName: string) {
  const ref = userRef(uid);
  const snap = await ref.get();
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  await ref.set(
    {
      email,
      captionsTable: tableName,
      captionsColumns: [...CAPTIONS_COLUMNS],
      captionsTableUpdatedAt: FieldValue.serverTimestamp(),
      ...(typeof data.captionsTableCreatedAt === 'undefined'
        ? { captionsTableCreatedAt: FieldValue.serverTimestamp() }
        : {}),
    },
    { merge: true }
  );
}

async function saveScheduledMeta(uid: string, email: string, tableName: string) {
  const ref = userRef(uid);
  const snap = await ref.get();
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  await ref.set(
    {
      email,
      scheduledTable: tableName,
      scheduledColumns: [...SCHEDULED_COLUMNS],
      scheduledTableUpdatedAt: FieldValue.serverTimestamp(),
      ...(typeof data.scheduledTableCreatedAt === 'undefined'
        ? { scheduledTableCreatedAt: FieldValue.serverTimestamp() }
        : {}),
    },
    { merge: true }
  );
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
