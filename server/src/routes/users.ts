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

export const usersRouter = Router();

/**
 * POST /api/users/init
 * Called immediately after a new user signs up.
 * Creates all three per-user Supabase tables in one shot:
 *   {email}_progress, {email}_scripts, {email}_videos
 * Uses CREATE TABLE IF NOT EXISTS so it is always safe to call again.
 */
usersRouter.post('/init', async (req, res) => {
  const email = req.userEmail;
  const uid = req.uid!;

  if (!email) {
    return res.status(400).json({ error: 'Signed-in user has no email address.' });
  }

  if (!pool) {
    // Supabase not configured — succeed silently so signup still works
    return res.json({ ok: true, skipped: true, reason: 'Supabase not configured.' });
  }

  const progressTable = `${email}_progress`;
  const scriptsTable  = `${email}_scripts`;
  const videosTable   = `${email}_videos`;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(progressTable)} (
        "serial number"        BIGSERIAL  PRIMARY KEY,
        "script name"          TEXT       NOT NULL DEFAULT '',
        "raw video uploaded"   TEXT       NOT NULL DEFAULT 'pending',
        "video edited"         TEXT       NOT NULL DEFAULT 'pending',
        "video captioned"      TEXT       NOT NULL DEFAULT 'pending',
        "video posting"        TEXT       NOT NULL DEFAULT 'pending'
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(scriptsTable)} (
        "s no."          BIGSERIAL    PRIMARY KEY,
        "title"          TEXT         NOT NULL DEFAULT '',
        "script"         TEXT,
        "progress"       TEXT         NOT NULL DEFAULT 'pending',
        "approve"        TEXT         NOT NULL DEFAULT 'pending',
        "uploaded date"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(videosTable)} (
        "s no."                    BIGSERIAL    PRIMARY KEY,
        "view video"               TEXT         NOT NULL DEFAULT '',
        "date and time of upload"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "script name"              TEXT         NOT NULL DEFAULT '',
        "current status"           TEXT         NOT NULL DEFAULT 'submitted',
        "edited video"             TEXT         NOT NULL DEFAULT ''
      );
    `);

    // Persist table names + column names in Firestore
    await saveProgressMeta(uid, email, progressTable);

    console.log(`[users/init] tables created for ${email}`);
    res.json({ ok: true, tables: [progressTable, scriptsTable, videosTable] });
  } catch (err) {
    console.error('[users/init] error:', err);
    res.status(500).json({ error: 'Failed to initialise user tables in Supabase.' });
  }
});

/**
 * POST /api/users/progress/load
 * Creates {email}_progress if it doesn't exist, saves column names to Firestore,
 * and returns all rows. Safe to call for existing accounts.
 */
usersRouter.post('/progress/load', async (req, res) => {
  const email = req.userEmail;
  const uid = req.uid!;

  if (!email) {
    return res.status(400).json({ error: 'Signed-in user has no email address.' });
  }

  if (!pool) {
    return res.status(500).json({ error: 'Supabase database URL is not configured.' });
  }

  const progressTable = `${email}_progress`;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(progressTable)} (
        "serial number"        BIGSERIAL  PRIMARY KEY,
        "script name"          TEXT       NOT NULL DEFAULT '',
        "raw video uploaded"   TEXT       NOT NULL DEFAULT 'pending',
        "video edited"         TEXT       NOT NULL DEFAULT 'pending',
        "video captioned"      TEXT       NOT NULL DEFAULT 'pending',
        "video posting"        TEXT       NOT NULL DEFAULT 'pending'
      );
    `);

    await saveProgressMeta(uid, email, progressTable);

    const rows = await listProgressRows(progressTable);
    res.json({ ok: true, table: progressTable, columns: PROGRESS_COLUMNS, rows });
  } catch (err) {
    console.error('[progress/load] error:', err);
    res.status(500).json({ error: 'Failed to create progress table in Supabase.' });
  }
});

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------

const PROGRESS_COLUMNS = [
  'serial number',
  'script name',
  'raw video uploaded',
  'video edited',
  'video captioned',
  'video posting',
] as const;

async function saveProgressMeta(uid: string, email: string, tableName: string) {
  await firestore.collection('users').doc(uid).set(
    {
      email,
      progressTable: tableName,
      progressColumns: PROGRESS_COLUMNS,
      progressTableUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * PATCH /api/users/progress/raw-video
 * Finds the row in {email}_progress whose "script name" matches the given
 * scriptName (case-insensitive) and sets "raw video uploaded" = 'submitted'.
 * If no matching row exists, inserts a new one.
 */
usersRouter.patch('/progress/raw-video', async (req, res) => {
  const email = req.userEmail;
  const uid   = req.uid!;

  if (!email) {
    return res.status(400).json({ error: 'Signed-in user has no email address.' });
  }
  if (!pool) {
    return res.status(500).json({ error: 'Supabase database URL is not configured.' });
  }

  const scriptName = typeof req.body?.scriptName === 'string' ? req.body.scriptName.trim() : '';
  if (!scriptName) {
    return res.status(400).json({ error: 'scriptName is required.' });
  }

  const progressTable = `${email}_progress`;
  const tableIdent    = quoteIdentifier(progressTable);

  try {
    // Ensure table exists (safe for accounts created before this feature)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableIdent} (
        "serial number"        BIGSERIAL  PRIMARY KEY,
        "script name"          TEXT       NOT NULL DEFAULT '',
        "raw video uploaded"   TEXT       NOT NULL DEFAULT 'pending',
        "video edited"         TEXT       NOT NULL DEFAULT 'pending',
        "video captioned"      TEXT       NOT NULL DEFAULT 'pending',
        "video posting"        TEXT       NOT NULL DEFAULT 'pending'
      );
    `);

    await saveProgressMeta(uid, email, progressTable);

    // Try to update the existing row matching this script name. Script name is
    // the pipeline identifier — match case-insensitively on a trimmed value so
    // it stays consistent with the other pipeline tables.
    const updateResult = await pool.query(
      `UPDATE ${tableIdent}
       SET "raw video uploaded" = 'submitted'
       WHERE LOWER(TRIM("script name")) = LOWER($1)
       RETURNING *`,
      [scriptName]
    );

    let row;
    if (updateResult.rowCount && updateResult.rowCount > 0) {
      row = updateResult.rows[0];
    } else {
      // No existing row — insert one so progress is always tracked
      const insertResult = await pool.query(
        `INSERT INTO ${tableIdent}
           ("script name", "raw video uploaded", "video edited", "video captioned", "video posting")
         VALUES ($1, 'submitted', 'pending', 'pending', 'pending')
         RETURNING *`,
        [scriptName]
      );
      row = insertResult.rows[0];
    }

    console.log(`[progress/raw-video] updated "${scriptName}" for ${email}`);
    res.json({ ok: true, row });
  } catch (err) {
    console.error('[progress/raw-video] error:', err);
    res.status(500).json({ error: 'Failed to update progress table.' });
  }
});

async function listProgressRows(tableName: string) {
  if (!pool) return [];
  const result = await pool.query(`
    SELECT
      "serial number",
      "script name",
      "raw video uploaded",
      "video edited",
      "video captioned",
      "video posting"
    FROM ${quoteIdentifier(tableName)}
    ORDER BY "serial number" ASC
  `);
  return result.rows;
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
