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

export const scriptsRouter = Router();

const SCRIPTS_COLUMNS = ['s no.', 'title', 'script', 'progress', 'approve', 'uploaded date'] as const;
type ScriptColumn = (typeof SCRIPTS_COLUMNS)[number];
type ScriptRow = Record<ScriptColumn, string | number | null>;
const SCRIPT_PROGRESS_VALUES = ['pending', 'in progress', 'under work', 'delivered'] as const;

scriptsRouter.get('/status', async (req, res) => {
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

  const meta = await getScriptsMeta(req.uid!, email);
  const tableName = meta.tableName;

  try {
    const exists = await scriptsTableExists(tableName);
    if (exists && !meta.saved) {
      await saveScriptsMeta(req.uid!, email, tableName);
    }
    if (exists) {
      await migrateScriptsTable(tableName);
      await saveScriptsMeta(req.uid!, email, tableName);
    }
    const rows = exists ? await listScriptsRows(tableName) : [];
    res.json({ ok: true, exists, table: tableName, columns: SCRIPTS_COLUMNS, rows });
  } catch (err) {
    console.error('[scripts] status error:', err);
    res.status(500).json({ error: 'Failed to check scripts table in Supabase.' });
  }
});

scriptsRouter.post('/load', async (req, res) => {
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

  const tableName = `${email}_scripts`;
  const tableIdent = quoteIdentifier(tableName);

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableIdent} (
        "s no." BIGSERIAL PRIMARY KEY,
        "title" TEXT NOT NULL DEFAULT '',
        "script" TEXT,
        "progress" TEXT NOT NULL DEFAULT 'pending',
        "approve" TEXT NOT NULL DEFAULT 'pending',
        "uploaded date" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await migrateScriptsTable(tableName);
    await saveScriptsMeta(req.uid!, email, tableName);
    const rows = await listScriptsRows(tableName);
    res.json({ ok: true, table: tableName, columns: SCRIPTS_COLUMNS, rows });
  } catch (err) {
    console.error('[scripts] load error:', err);
    res.status(500).json({ error: 'Failed to create scripts table in Supabase.' });
  }
});

scriptsRouter.patch('/:serial/approve', async (req, res) => {
  const email = req.userEmail;
  const serial = Number(req.params.serial);

  if (!email) {
    return res.status(400).json({ error: 'Signed-in user has no email address.' });
  }
  if (!Number.isInteger(serial) || serial < 1) {
    return res.status(400).json({ error: 'Invalid script row number.' });
  }
  if (!pool) {
    return res.status(500).json({
      error:
        'Supabase database URL is not configured. Set SUPABASE_DB_URL in server/.env.',
    });
  }

  try {
    const meta = await getScriptsMeta(req.uid!, email);
    const tableName = meta.tableName;
    const exists = await scriptsTableExists(tableName);
    if (!exists) return res.status(404).json({ error: 'Scripts table not found.' });

    await migrateScriptsTable(tableName);
    await saveScriptsMeta(req.uid!, email, tableName);

    const tableIdent = quoteIdentifier(tableName);
    const result = await pool.query<ScriptRow>(
      `
        UPDATE ${tableIdent}
        SET
          "approve" = 'approve',
          "progress" = 'under work'
        WHERE "s no." = $1
        RETURNING
          "s no.",
          "title",
          "script",
          "progress",
          "approve",
          "uploaded date"
      `,
      [serial]
    );

    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Script row not found.' });
    res.json({ ok: true, row });
  } catch (err) {
    console.error('[scripts] approve error:', err);
    res.status(500).json({ error: 'Failed to approve script.' });
  }
});

scriptsRouter.patch('/:serial/progress', async (req, res) => {
  const email = req.userEmail;
  const serial = Number(req.params.serial);
  const progress = typeof req.body?.progress === 'string' ? req.body.progress : '';

  if (!email) {
    return res.status(400).json({ error: 'Signed-in user has no email address.' });
  }
  if (!Number.isInteger(serial) || serial < 1) {
    return res.status(400).json({ error: 'Invalid script row number.' });
  }
  if (!SCRIPT_PROGRESS_VALUES.includes(progress as (typeof SCRIPT_PROGRESS_VALUES)[number])) {
    return res.status(400).json({ error: 'Invalid progress value.' });
  }
  if (!pool) {
    return res.status(500).json({
      error:
        'Supabase database URL is not configured. Set SUPABASE_DB_URL in server/.env.',
    });
  }

  try {
    const meta = await getScriptsMeta(req.uid!, email);
    const tableName = meta.tableName;
    const exists = await scriptsTableExists(tableName);
    if (!exists) return res.status(404).json({ error: 'Scripts table not found.' });

    await migrateScriptsTable(tableName);
    await saveScriptsMeta(req.uid!, email, tableName);

    const tableIdent = quoteIdentifier(tableName);
    const result = await pool.query<ScriptRow>(
      `
        UPDATE ${tableIdent}
        SET "progress" = $1
        WHERE "s no." = $2
        RETURNING
          "s no.",
          "title",
          "script",
          "progress",
          "approve",
          "uploaded date"
      `,
      [progress, serial]
    );

    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Script row not found.' });
    res.json({ ok: true, row });
  } catch (err) {
    console.error('[scripts] progress error:', err);
    res.status(500).json({ error: 'Failed to update script progress.' });
  }
});

async function getScriptsMeta(uid: string, email: string) {
  const snap = await userRef(uid).get();
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const legacySnap = await legacyScriptsMetaRef(uid).get();
  const legacyData = legacySnap.exists ? (legacySnap.data() as Record<string, unknown>) : {};
  const tableName =
    typeof data.scriptsTable === 'string'
      ? data.scriptsTable
      : typeof data.tableName === 'string'
        ? data.tableName
        : typeof legacyData.tableName === 'string'
          ? legacyData.tableName
          : `${email}_scripts`;
  const rawColumns = Array.isArray(data.scriptColumns)
    ? data.scriptColumns
    : Array.isArray(data.columns)
      ? data.columns
      : Array.isArray(legacyData.columns)
        ? legacyData.columns
        : null;
  const columns =
    rawColumns && rawColumns.every((column) => typeof column === 'string')
      ? normalizeScriptColumns(rawColumns)
      : [...SCRIPTS_COLUMNS];
  return { tableName, columns, saved: typeof data.scriptsTable === 'string' };
}

async function saveScriptsMeta(uid: string, email: string, tableName: string) {
  const ref = userRef(uid);
  const snap = await ref.get();
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  await ref.set(
    {
      email,
      scriptsTable: tableName,
      scriptColumns: SCRIPTS_COLUMNS,
      scriptsTableUpdatedAt: FieldValue.serverTimestamp(),
      ...(typeof data.scriptsTableCreatedAt === 'undefined'
        ? { scriptsTableCreatedAt: FieldValue.serverTimestamp() }
        : {}),
    },
    { merge: true }
  );
  await legacyScriptsMetaRef(uid).delete().catch(() => undefined);
}

function userRef(uid: string) {
  return firestore.collection('users').doc(uid);
}

function legacyScriptsMetaRef(uid: string) {
  return firestore.collection('clients').doc(uid).collection('scriptTables').doc('main');
}

async function scriptsTableExists(tableName: string): Promise<boolean> {
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

async function migrateScriptsTable(tableName: string): Promise<void> {
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

  if (columnNames.has('file') && !columnNames.has('script')) {
    await pool.query(`ALTER TABLE ${tableIdent} RENAME COLUMN "file" TO "script"`);
    columnNames.delete('file');
    columnNames.add('script');
  }

  if (!columnNames.has('script')) {
    await pool.query(`ALTER TABLE ${tableIdent} ADD COLUMN "script" TEXT`);
  }

  if (columnNames.has('file')) {
    await pool.query(`UPDATE ${tableIdent} SET "script" = COALESCE("script", "file")`);
  }

  if (!columnNames.has('progress')) {
    await pool.query(`ALTER TABLE ${tableIdent} ADD COLUMN "progress" TEXT NOT NULL DEFAULT 'pending'`);
  }

  if (!columnNames.has('approve')) {
    await pool.query(`ALTER TABLE ${tableIdent} ADD COLUMN "approve" TEXT NOT NULL DEFAULT 'pending'`);
  }
}

async function listScriptsRows(tableName: string): Promise<ScriptRow[]> {
  if (!pool) return [];
  const tableIdent = quoteIdentifier(tableName);
  const result = await pool.query<ScriptRow>(`
    SELECT
      "s no.",
      "title",
      "script",
      "progress",
      "approve",
      "uploaded date"
    FROM ${tableIdent}
    ORDER BY "s no." ASC
  `);
  return result.rows;
}

function normalizeScriptColumns(columns: string[]) {
  const mapped = columns.map((column) => (column === 'file' ? 'script' : column));
  return SCRIPTS_COLUMNS.filter((column) => mapped.includes(column));
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
