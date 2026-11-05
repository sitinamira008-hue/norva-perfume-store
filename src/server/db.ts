import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Pool, type PoolClient } from 'pg';

export type DbEngine = 'postgres' | 'node:sqlite' | 'sql.js';

export interface DatabaseAdapter {
  readonly engine: DbEngine;
  readonly isPersistent: boolean;
  readonly connectionInfo: string;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(
    sql: string,
    params?: unknown[],
  ): Promise<{ changes: number; lastInsertRowid?: number | bigint }>;
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function stripSurroundingQuotes(val: string | undefined): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Discovers a PostgreSQL connection string from standard Vercel, Supabase, Neon, or generic PG env vars.
 */
export function resolvePostgresConnectionString(): string | null {
  const candidateKeys = [
    'POSTGRES_URL',
    'DATABASE_URL',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING',
    'SUPABASE_DB_URL',
    'SUPABASE_DATABASE_URL',
    'NEON_DATABASE_URL',
    'PGURI',
  ];

  for (const key of candidateKeys) {
    const raw = stripSurroundingQuotes(process.env[key]);
    if (raw && (raw.startsWith('postgres://') || raw.startsWith('postgresql://'))) {
      return raw;
    }
  }

  // Also support discrete PG credentials if provided (PGHOST, PGDATABASE, PGUSER, PGPASSWORD)
  const pghost = stripSurroundingQuotes(process.env.PGHOST);
  const pgdatabase = stripSurroundingQuotes(process.env.PGDATABASE);
  const pguser = stripSurroundingQuotes(process.env.PGUSER);
  const pgpassword = stripSurroundingQuotes(process.env.PGPASSWORD);
  const pgport = stripSurroundingQuotes(process.env.PGPORT) || '5432';

  if (pghost && pgdatabase && pguser) {
    const auth = pgpassword ? `${encodeURIComponent(pguser)}:${encodeURIComponent(pgpassword)}` : encodeURIComponent(pguser);
    return `postgres://${auth}@${pghost}:${pgport}/${pgdatabase}`;
  }

  return null;
}

function maskConnectionString(connStr: string): string {
  try {
    const parsed = new URL(connStr);
    const maskedPass = parsed.password ? '****' : '';
    const auth = parsed.username ? `${parsed.username}${maskedPass ? `:${maskedPass}` : ''}@` : '';
    return `${parsed.protocol}//${auth}${parsed.host}${parsed.pathname}`;
  } catch {
    return 'postgres://[configured-connection]';
  }
}

/**
 * Translates SQLite syntax to PostgreSQL syntax:
 * - Replaces ? parameter placeholders with $1, $2, ...
 * - Translates INSERT OR IGNORE INTO to INSERT INTO ... ON CONFLICT DO NOTHING
 */
function translateSqlForPostgres(sql: string): string {
  let paramIndex = 1;
  let translated = sql.replace(/\?/g, () => `$${paramIndex++}`);

  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(translated)) {
    translated = translated.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(translated)) {
      translated = `${translated} ON CONFLICT DO NOTHING`;
    }
  }

  return translated;
}

// ============================================================================
// POSTGRESQL ADAPTER (SUPABASE, NEON, VERCEL POSTGRES, CLOUD SQL)
// ============================================================================
class PostgresAdapter implements DatabaseAdapter {
  readonly engine = 'postgres' as const;
  readonly isPersistent = true;
  readonly connectionInfo: string;
  private pool: Pool;

  constructor(connectionString: string) {
    this.connectionInfo = maskConnectionString(connectionString);
    const isLocalhost =
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1') ||
      connectionString.includes('::1');

    this.pool = new Pool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('[NORVA PostgreSQL Pool Error]', err.message);
    });
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const pgSql = translateSqlForPostgres(sql);
    const client = await this.pool.connect();
    try {
      const res = await client.query(pgSql, params);
      return res.rows as T[];
    } finally {
      client.release();
    }
  }

  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ changes: number; lastInsertRowid?: number | bigint }> {
    const pgSql = translateSqlForPostgres(sql);
    const client = await this.pool.connect();
    try {
      const res = await client.query(pgSql, params);
      return { changes: res.rowCount ?? 0 };
    } finally {
      client.release();
    }
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txAdapter: DatabaseAdapter = {
        engine: 'postgres',
        isPersistent: true,
        connectionInfo: this.connectionInfo,
        query: async <R = unknown>(sql: string, params: unknown[] = []): Promise<R[]> => {
          const pgSql = translateSqlForPostgres(sql);
          const res = await client.query(pgSql, params);
          return res.rows as R[];
        },
        queryOne: async <R = unknown>(sql: string, params: unknown[] = []): Promise<R | null> => {
          const pgSql = translateSqlForPostgres(sql);
          const res = await client.query(pgSql, params);
          return res.rows.length > 0 ? (res.rows[0] as R) : null;
        },
        execute: async (sql: string, params: unknown[] = []) => {
          const pgSql = translateSqlForPostgres(sql);
          const res = await client.query(pgSql, params);
          return { changes: res.rowCount ?? 0 };
        },
        transaction: () => {
          throw new Error('Nested transactions are not supported.');
        },
        close: async () => {},
      };

      const result = await fn(txAdapter);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// ============================================================================
// SQLITE ADAPTER (NODE:SQLITE / SQL.JS) FOR LOCAL DEV & IN-MEMORY FALLBACK
// ============================================================================
interface SqliteStatementLike {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number; lastInsertRowid?: number | bigint };
}

interface SqliteDatabaseLike {
  readonly engine: 'node:sqlite' | 'sql.js';
  exec(sql: string): void;
  prepare(sql: string): SqliteStatementLike;
  flushToDisk?(): void;
}

class SqliteAdapter implements DatabaseAdapter {
  readonly engine: DbEngine;
  readonly isPersistent: boolean;
  readonly connectionInfo: string;
  private db: SqliteDatabaseLike;

  constructor(db: SqliteDatabaseLike, filePath: string, isPersistent: boolean) {
    this.db = db;
    this.engine = db.engine;
    this.isPersistent = isPersistent;
    this.connectionInfo = `sqlite://${filePath}`;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const row = this.db.prepare(sql).get(...params);
    return (row as T) ?? null;
  }

  async execute(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ changes: number; lastInsertRowid?: number | bigint }> {
    const res = this.db.prepare(sql).run(...params);
    if (this.db.flushToDisk) {
      this.db.flushToDisk();
    }
    return {
      changes: res.changes,
      lastInsertRowid: res.lastInsertRowid,
    };
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN TRANSACTION');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      if (this.db.flushToDisk) {
        this.db.flushToDisk();
      }
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.db.flushToDisk) {
      this.db.flushToDisk();
    }
  }
}

// ============================================================================
// SQLITE OPEN & RESOLUTION HELPERS
// ============================================================================
function resolveWritableSqlitePath(): { filePath: string; isPersistent: boolean } {
  const isServerless = Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME,
  );

  const rawEnvPath = stripSurroundingQuotes(process.env.DATABASE_PATH || '');

  if (!isServerless && rawEnvPath) {
    try {
      const resolved = path.resolve(process.cwd(), rawEnvPath);
      const dir = path.dirname(resolved);
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return { filePath: resolved, isPersistent: true };
    } catch (err) {
      console.warn(`[NORVA DB] Cannot write to DATABASE_PATH (${rawEnvPath}):`, err);
    }
  }

  if (!isServerless) {
    try {
      const defaultPath = path.resolve(process.cwd(), 'data/norva_store.sqlite');
      const dir = path.dirname(defaultPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return { filePath: defaultPath, isPersistent: true };
    } catch {
      // Fall through to /tmp
    }
  }

  // Serverless or read-only container: use os.tmpdir() safely
  const tmpDir = path.join(os.tmpdir(), 'norva_data');
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
  } catch {
    // ignore if already exists
  }
  return {
    filePath: path.join(tmpDir, 'norva_store.sqlite'),
    isPersistent: false,
  };
}

async function openSqliteInstance(filePath: string): Promise<SqliteDatabaseLike> {
  // 1. Try native node:sqlite (Node 22.5+)
  try {
    const builtinModuleId = 'node:' + 'sqlite';
    const sqliteMod = (await import(builtinModuleId)) as {
      DatabaseSync: new (p: string) => {
        exec(sql: string): void;
        prepare(sql: string): SqliteStatementLike;
      };
    };
    const nativeDb = new sqliteMod.DatabaseSync(filePath);
    nativeDb.exec('PRAGMA foreign_keys = ON;');
    return {
      engine: 'node:sqlite',
      exec: (sql: string) => nativeDb.exec(sql),
      prepare: (sql: string) => nativeDb.prepare(sql),
    };
  } catch (nativeErr) {
    console.warn(
      '[NORVA DB] Native node:sqlite unavailable; initializing WebAssembly sql.js fallback.',
      nativeErr instanceof Error ? nativeErr.message : nativeErr,
    );
  }

  // 2. sql.js WebAssembly fallback
  const sqlJsMod = await import('sql.js');
  const initSqlJs = (sqlJsMod.default ?? sqlJsMod) as unknown as (config?: {
    wasmBinary?: Uint8Array;
  }) => Promise<{
    Database: new (data?: ArrayLike<number> | Buffer | null) => {
      run(sql: string, params?: unknown[]): void;
      exec(sql: string): unknown[];
      prepare(sql: string): {
        bind(values?: unknown[]): boolean;
        step(): boolean;
        getAsObject(): Record<string, unknown>;
        free(): boolean;
      };
      getRowsModified(): number;
      export(): Uint8Array;
    };
  }>;

  const wasmCandidates = [
    path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
    path.resolve('/var/task/node_modules/sql.js/dist/sql-wasm.wasm'),
  ];
  let wasmBinary: Uint8Array | undefined;
  for (const candidate of wasmCandidates) {
    if (fs.existsSync(candidate)) {
      wasmBinary = fs.readFileSync(candidate);
      break;
    }
  }

  const SQL = await initSqlJs(wasmBinary ? { wasmBinary } : undefined);
  const initialBytes = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  const wasmDb = new SQL.Database(initialBytes && initialBytes.length > 0 ? initialBytes : null);

  const persistToDisk = () => {
    try {
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });
      const exported = Buffer.from(wasmDb.export());
      const tmpPath = `${filePath}.tmp.${process.pid}`;
      fs.writeFileSync(tmpPath, exported);
      fs.renameSync(tmpPath, filePath);
    } catch {
      // safe no-op in read-only environment
    }
  };

  const normalizeParams = (params: unknown[]): unknown[] =>
    params.map((p) => (p === undefined ? null : typeof p === 'bigint' ? Number(p) : p));

  return {
    engine: 'sql.js',
    exec: (sql: string) => {
      wasmDb.run(sql);
    },
    prepare: (sql: string) => ({
      get: (...params: unknown[]) => {
        const stmt = wasmDb.prepare(sql);
        try {
          stmt.bind(normalizeParams(params));
          return stmt.step() ? stmt.getAsObject() : undefined;
        } finally {
          stmt.free();
        }
      },
      all: (...params: unknown[]) => {
        const stmt = wasmDb.prepare(sql);
        const rows: unknown[] = [];
        try {
          stmt.bind(normalizeParams(params));
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          return rows;
        } finally {
          stmt.free();
        }
      },
      run: (...params: unknown[]) => {
        wasmDb.run(sql, normalizeParams(params));
        const changes = wasmDb.getRowsModified();
        persistToDisk();
        return { changes };
      },
    }),
    flushToDisk: persistToDisk,
  };
}

// ============================================================================
// DATABASE FACTORY & SINGLETON INITIALIZER
// ============================================================================
let globalDbAdapter: DatabaseAdapter | null = null;
let dbInitPromise: Promise<DatabaseAdapter> | null = null;

export async function initDatabase(): Promise<DatabaseAdapter> {
  if (globalDbAdapter) {
    return globalDbAdapter;
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = (async () => {
    const pgConnStr = resolvePostgresConnectionString();

    if (pgConnStr) {
      try {
        console.log(`[NORVA DB] Connecting to PostgreSQL (${maskConnectionString(pgConnStr)})...`);
        const pgAdapter = new PostgresAdapter(pgConnStr);
        // Verify connectivity
        await pgAdapter.query('SELECT 1 AS alive');
        console.log('[NORVA DB] Successfully connected to persistent PostgreSQL database.');
        globalDbAdapter = pgAdapter;
        return pgAdapter;
      } catch (pgErr) {
        console.error(
          '[NORVA DB] Failed to connect to configured PostgreSQL database:',
          pgErr instanceof Error ? pgErr.message : pgErr,
        );
        console.warn('[NORVA DB] Falling back to local/ephemeral SQLite adapter.');
      }
    }

    // SQLite fallback for local development or when Postgres is unconfigured
    const { filePath, isPersistent } = resolveWritableSqlitePath();
    console.log(
      `[NORVA DB] Using SQLite adapter at ${filePath} (persistent: ${isPersistent}).`,
    );
    const sqliteInstance = await openSqliteInstance(filePath);
    const sqliteAdapter = new SqliteAdapter(sqliteInstance, filePath, isPersistent);
    globalDbAdapter = sqliteAdapter;
    return sqliteAdapter;
  })().catch((err) => {
    dbInitPromise = null;
    throw err;
  });

  return dbInitPromise;
}

export function getDatabase(): DatabaseAdapter {
  if (!globalDbAdapter) {
    throw new Error('Database not initialized. Call await ensureDatabaseReady() before querying.');
  }
  return globalDbAdapter;
}
