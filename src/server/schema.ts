import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type { DatabaseAdapter } from './db';

const BCRYPT_ROUNDS = 12;
export const DEFAULT_ADMIN_USERNAME = 'zn8xc';
// Salted bcrypt cost-12 hash of 'usman122'
export const DEFAULT_ADMIN_BCRYPT_HASH =
  '$2b$12$cKHO2DOza39ETn.nDLpHw.P7aqqxQexiDQlJrCLvktOGtvG8lGpXu';

export const CATALOG_DEFAULTS = [
  { id: 'frag-01', name: 'Khamrah Qawa', defaultPrice: 2500 },
  { id: 'frag-02', name: 'Cool Water', defaultPrice: 2500 },
  { id: 'frag-03', name: '9mM Rebel', defaultPrice: 2500 },
  { id: 'frag-04', name: 'Jadora', defaultPrice: 2500 },
  { id: 'frag-05', name: 'Gucci Flora', defaultPrice: 2500 },
];

export const DEFAULT_SHIPPING_RATES = [
  {
    cityKey: 'karachi',
    cityName: 'Karachi',
    standardFee: 200,
    expressFee: 400,
    freeShippingThreshold: 5000,
    estimatedDays: '1–2 Working Days',
  },
  {
    cityKey: 'lahore',
    cityName: 'Lahore',
    standardFee: 250,
    expressFee: 500,
    freeShippingThreshold: 5000,
    estimatedDays: '2–3 Working Days',
  },
  {
    cityKey: 'islamabad',
    cityName: 'Islamabad',
    standardFee: 250,
    expressFee: 500,
    freeShippingThreshold: 5000,
    estimatedDays: '2–3 Working Days',
  },
  {
    cityKey: 'rawalpindi',
    cityName: 'Rawalpindi',
    standardFee: 250,
    expressFee: 500,
    freeShippingThreshold: 5000,
    estimatedDays: '2–3 Working Days',
  },
  {
    cityKey: 'faisalabad',
    cityName: 'Faisalabad',
    standardFee: 280,
    expressFee: 550,
    freeShippingThreshold: 5000,
    estimatedDays: '2–4 Working Days',
  },
  {
    cityKey: 'multan',
    cityName: 'Multan',
    standardFee: 280,
    expressFee: 550,
    freeShippingThreshold: 5000,
    estimatedDays: '2–4 Working Days',
  },
  {
    cityKey: 'peshawar',
    cityName: 'Peshawar',
    standardFee: 300,
    expressFee: 600,
    freeShippingThreshold: 5000,
    estimatedDays: '3–4 Working Days',
  },
  {
    cityKey: 'quetta',
    cityName: 'Quetta',
    standardFee: 350,
    expressFee: 650,
    freeShippingThreshold: 6000,
    estimatedDays: '3–5 Working Days',
  },
  {
    cityKey: '__default__',
    cityName: 'Other Cities (Nationwide)',
    standardFee: 300,
    expressFee: 550,
    freeShippingThreshold: 5000,
    estimatedDays: '3–5 Working Days',
  },
];

export const DEFAULT_COUPONS = [
  {
    code: 'NORVA15',
    discountType: 'percentage',
    discountValue: 15,
    minOrderAmount: 0,
    maxUses: null,
    description: '15% NORVA Client Privilege',
  },
  {
    code: 'NORVA10',
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: 0,
    maxUses: null,
    description: '10% Welcome Privilege',
  },
  {
    code: 'ATELIER15',
    discountType: 'percentage',
    discountValue: 15,
    minOrderAmount: 5000,
    maxUses: null,
    description: '15% Atelier Privilege (Orders PKR 5,000+)',
  },
];

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

function normalizeBcryptHashFromEnv(raw: string | undefined): string {
  if (!raw) return '';
  const unquoted = stripSurroundingQuotes(raw).replace(/\\\$/g, '$');
  if (unquoted.startsWith('$2y$')) {
    return `$2b$${unquoted.slice(4)}`;
  }
  return unquoted;
}

export async function initializeDatabaseSchema(db: DatabaseAdapter): Promise<void> {
  const isPostgres = db.engine === 'postgres';

  const createOrdersTable = `
    CREATE TABLE IF NOT EXISTS orders (
      order_number TEXT PRIMARY KEY,
      lookup_token TEXT UNIQUE NOT NULL,
      idempotency_key TEXT UNIQUE,
      fingerprint_hash TEXT,
      stock_deducted INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'Pending',
      payment_method TEXT NOT NULL DEFAULT 'cod',
      payment_status TEXT NOT NULL DEFAULT 'Pending',
      shipping_speed TEXT NOT NULL DEFAULT 'standard',
      subtotal INTEGER NOT NULL,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      shipping_cost INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      coupon_code TEXT,
      gift_note TEXT,
      admin_notes TEXT,
      customer_full_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_phone_digits TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      customer_city TEXT NOT NULL,
      customer_postal_code TEXT NOT NULL DEFAULT '',
      customer_country TEXT NOT NULL DEFAULT 'Pakistan',
      is_seen_by_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      created_at_iso TEXT NOT NULL,
      created_at_ms ${isPostgres ? 'BIGINT' : 'INTEGER'} NOT NULL,
      updated_at_iso TEXT NOT NULL
    );
  `;
  await db.execute(createOrdersTable);

  const createOrderItemsTable = `
    CREATE TABLE IF NOT EXISTS order_items (
      id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
      order_number TEXT NOT NULL REFERENCES orders(order_number) ON DELETE CASCADE,
      item_key TEXT NOT NULL,
      product_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      concentration TEXT NOT NULL,
      image TEXT NOT NULL,
      size_label TEXT NOT NULL,
      size_sku TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL
    );
  `;
  await db.execute(createOrderItemsTable);

  const createAdminUsersTable = `
    CREATE TABLE IF NOT EXISTS admin_users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      is_active INTEGER NOT NULL DEFAULT 1,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until_ms ${isPostgres ? 'BIGINT' : 'INTEGER'} NOT NULL DEFAULT 0,
      created_at_iso TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL,
      last_login_at_iso TEXT
    );
  `;
  await db.execute(createAdminUsersTable);

  const createAdminSessionsTable = `
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      username TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      logged_in_at TEXT NOT NULL,
      created_at_ms ${isPostgres ? 'BIGINT' : 'INTEGER'} NOT NULL,
      expires_at_ms ${isPostgres ? 'BIGINT' : 'INTEGER'} NOT NULL
    );
  `;
  await db.execute(createAdminSessionsTable);

  const createProductOverridesTable = `
    CREATE TABLE IF NOT EXISTS product_overrides (
      product_id TEXT PRIMARY KEY,
      price INTEGER,
      stock_units INTEGER,
      low_stock_threshold INTEGER DEFAULT 10,
      in_stock INTEGER,
      is_best_seller INTEGER,
      is_new_arrival INTEGER,
      updated_at_ms ${isPostgres ? 'BIGINT' : 'INTEGER'} NOT NULL
    );
  `;
  await db.execute(createProductOverridesTable);

  const createShippingRatesTable = `
    CREATE TABLE IF NOT EXISTS shipping_rates (
      city_key TEXT PRIMARY KEY,
      city_name TEXT NOT NULL,
      standard_fee INTEGER NOT NULL,
      express_fee INTEGER NOT NULL,
      free_shipping_threshold INTEGER NOT NULL DEFAULT 5000,
      estimated_days TEXT NOT NULL DEFAULT '2–4 Working Days',
      active INTEGER NOT NULL DEFAULT 1,
      updated_at_ms ${isPostgres ? 'BIGINT' : 'INTEGER'} NOT NULL
    );
  `;
  await db.execute(createShippingRatesTable);

  const createCouponsTable = `
    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      discount_type TEXT NOT NULL DEFAULT 'percentage',
      discount_value INTEGER NOT NULL,
      min_order_amount INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      expires_at_iso TEXT,
      created_at_ms ${isPostgres ? 'BIGINT' : 'INTEGER'} NOT NULL
    );
  `;
  await db.execute(createCouponsTable);

  const createProductReviewsTable = `
    CREATE TABLE IF NOT EXISTS product_reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      author TEXT NOT NULL,
      location TEXT NOT NULL,
      rating INTEGER NOT NULL,
      title TEXT NOT NULL,
      comment TEXT NOT NULL,
      verified_purchase INTEGER NOT NULL DEFAULT 0,
      date_label TEXT NOT NULL,
      created_at_ms ${isPostgres ? 'BIGINT' : 'INTEGER'} NOT NULL
    );
  `;
  await db.execute(createProductReviewsTable);

  const createWishlistsTable = `
    CREATE TABLE IF NOT EXISTS wishlists (
      client_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      created_at_ms ${isPostgres ? 'BIGINT' : 'INTEGER'} NOT NULL,
      PRIMARY KEY (client_id, product_id)
    );
  `;
  await db.execute(createWishlistsTable);

  const createInquiriesTable = `
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      topic TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_at_ms ${isPostgres ? 'BIGINT' : 'INTEGER'} NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0
    );
  `;
  await db.execute(createInquiriesTable);

  const createSubscribersTable = `
    CREATE TABLE IF NOT EXISTS subscribers (
      email TEXT PRIMARY KEY,
      created_at_ms ${isPostgres ? 'BIGINT' : 'INTEGER'} NOT NULL
    );
  `;
  await db.execute(createSubscribersTable);

  // Indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_orders_created_ms ON orders(created_at_ms DESC);',
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);',
    'CREATE INDEX IF NOT EXISTS idx_orders_phone_digits ON orders(customer_phone_digits);',
    'CREATE INDEX IF NOT EXISTS idx_orders_unseen ON orders(is_seen_by_admin);',
    'CREATE INDEX IF NOT EXISTS idx_order_items_order_number ON order_items(order_number);',
    'CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id, created_at_ms DESC);',
    'CREATE INDEX IF NOT EXISTS idx_orders_fingerprint ON orders(fingerprint_hash, created_at_ms DESC);',
  ];

  for (const idx of indexes) {
    try {
      await db.execute(idx);
    } catch {
      // index might already exist
    }
  }

  // Conditional partial index for idempotency
  try {
    if (isPostgres) {
      await db.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;',
      );
    } else {
      await db.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;',
      );
    }
  } catch {
    // index may already exist
  }
}

/**
 * Seeds initial catalog stock, shipping rates, coupons, and owner admin account.
 * Updates password if ADMIN_PASSWORD or ADMIN_PASSWORD_HASH is changed in Vercel environment.
 */
export async function seedInitialStoreConfiguration(db: DatabaseAdapter): Promise<void> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // 1. Seed Product Overrides (if not already existing)
  for (const p of CATALOG_DEFAULTS) {
    await db.execute(
      `INSERT OR IGNORE INTO product_overrides (
        product_id, price, stock_units, low_stock_threshold, in_stock, is_best_seller, is_new_arrival, updated_at_ms
      ) VALUES (?, ?, 48, 10, 1, 1, 0, ?)`,
      [p.id, p.defaultPrice, now],
    );
  }

  // 2. Seed City Shipping Rates
  for (const r of DEFAULT_SHIPPING_RATES) {
    await db.execute(
      `INSERT OR IGNORE INTO shipping_rates (
        city_key, city_name, standard_fee, express_fee, free_shipping_threshold, estimated_days, active, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        r.cityKey,
        r.cityName,
        r.standardFee,
        r.expressFee,
        r.freeShippingThreshold,
        r.estimatedDays,
        now,
      ],
    );
  }

  // 3. Seed Coupons
  for (const c of DEFAULT_COUPONS) {
    await db.execute(
      `INSERT OR IGNORE INTO coupons (
        code, discount_type, discount_value, min_order_amount, max_uses, used_count, description, active, expires_at_iso, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, 0, ?, 1, NULL, ?)`,
      [c.code, c.discountType, c.discountValue, c.minOrderAmount, c.maxUses, c.description, now],
    );
  }

  // 4. Secure Admin Account Provisioning & Password Hash Sync
  const rawEnvUsername = stripSurroundingQuotes(process.env.ADMIN_USERNAME || '')
    .toLowerCase()
    .replace(/^@+/, '');
  const envPasswordHash = normalizeBcryptHashFromEnv(process.env.ADMIN_PASSWORD_HASH);
  const envPassword =
    stripSurroundingQuotes(process.env.ADMIN_PASSWORD || '') ||
    stripSurroundingQuotes(process.env.ADMIN_INITIAL_PASSWORD || '');

  const hasValidEnvHash = /^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(envPasswordHash);
  const hasValidEnvPwd = envPassword.length >= 6;

  // Primary username is either user configured ADMIN_USERNAME or the standard 'zn8xc'
  const effectiveUsername = rawEnvUsername || DEFAULT_ADMIN_USERNAME;

  // Password hash is either ADMIN_PASSWORD_HASH, bcrypt of ADMIN_PASSWORD, or the DEFAULT_ADMIN_BCRYPT_HASH (usman122)
  let targetPasswordHash = DEFAULT_ADMIN_BCRYPT_HASH;
  if (hasValidEnvHash) {
    targetPasswordHash = envPasswordHash;
  } else if (hasValidEnvPwd) {
    targetPasswordHash = bcrypt.hashSync(envPassword, BCRYPT_ROUNDS);
  }

  // Clean up legacy username ('usman122') if it differs from effective username
  if (effectiveUsername !== 'usman122') {
    await db.execute(`DELETE FROM admin_users WHERE username = 'usman122'`);
  }

  // Upsert owner account: always ensure active=1, lockout cleared, and correct password hash
  await db.execute(
    `INSERT INTO admin_users (
      username, password_hash, role, is_active, failed_attempts, locked_until_ms, created_at_iso, updated_at_iso
    ) VALUES (?, ?, 'owner', 1, 0, 0, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      is_active = 1,
      failed_attempts = 0,
      locked_until_ms = 0,
      updated_at_iso = EXCLUDED.updated_at_iso`,
    [effectiveUsername, targetPasswordHash, nowIso, nowIso],
  );

  // Clear expired sessions
  await db.execute('DELETE FROM admin_sessions WHERE expires_at_ms <= ?', [now]);
}

/**
 * When connecting to a newly configured PostgreSQL database (e.g. Supabase or Neon),
 * imports existing orders and data from any local SQLite database files (norva.db / data/norva_store.sqlite)
 * so existing orders and customers are preserved seamlessly!
 */
export async function migrateFromLegacySqliteIfEmpty(pgDb: DatabaseAdapter): Promise<void> {
  if (pgDb.engine !== 'postgres') return;

  try {
    const existingOrdersCount = await pgDb.queryOne<{ c: string | number }>(
      'SELECT COUNT(*) AS c FROM orders',
    );
    if (Number(existingOrdersCount?.c ?? 0) > 0) {
      // PostgreSQL already has orders, no migration needed
      return;
    }

    const candidateFiles = [
      path.resolve(process.cwd(), 'norva.db'),
      path.resolve(process.cwd(), 'data/norva_store.sqlite'),
    ];

    let sourceFile: string | null = null;
    for (const f of candidateFiles) {
      if (fs.existsSync(f) && fs.statSync(f).size > 4096) {
        sourceFile = f;
        break;
      }
    }

    if (!sourceFile) return;

    console.log(`[NORVA DB Migration] Discovered existing SQLite database at ${sourceFile}. Migrating orders to PostgreSQL...`);
    const { DatabaseSync } = await import('node:sqlite');
    const sqlite = new DatabaseSync(sourceFile);

    // 1. Migrate Orders
    const orders = sqlite.prepare('SELECT * FROM orders').all() as Record<string, unknown>[];
    for (const o of orders) {
      await pgDb.execute(
        `INSERT INTO orders (
          order_number, lookup_token, idempotency_key, fingerprint_hash, stock_deducted,
          status, payment_method, payment_status, shipping_speed, subtotal, discount_amount,
          shipping_cost, total, coupon_code, gift_note, admin_notes, customer_full_name,
          customer_email, customer_phone, customer_phone_digits, customer_address,
          customer_city, customer_postal_code, customer_country, is_seen_by_admin,
          created_at, created_at_iso, created_at_ms, updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(order_number) DO NOTHING`,
        [
          o.order_number,
          o.lookup_token,
          o.idempotency_key ?? null,
          o.fingerprint_hash ?? null,
          o.stock_deducted ?? 1,
          o.status ?? 'Pending',
          o.payment_method ?? 'cod',
          o.payment_status ?? 'Pending',
          o.shipping_speed ?? 'standard',
          o.subtotal,
          o.discount_amount ?? 0,
          o.shipping_cost ?? 0,
          o.total,
          o.coupon_code ?? null,
          o.gift_note ?? null,
          o.admin_notes ?? null,
          o.customer_full_name,
          o.customer_email ?? '',
          o.customer_phone,
          o.customer_phone_digits,
          o.customer_address,
          o.customer_city,
          o.customer_postal_code ?? '',
          o.customer_country ?? 'Pakistan',
          o.is_seen_by_admin ?? 0,
          o.created_at,
          o.created_at_iso,
          o.created_at_ms,
          o.updated_at_iso,
        ],
      );
    }

    // 2. Migrate Order Items
    const items = sqlite.prepare('SELECT * FROM order_items').all() as Record<string, unknown>[];
    for (const it of items) {
      await pgDb.execute(
        `INSERT INTO order_items (
          order_number, item_key, product_id, slug, name, concentration, image, size_label, size_sku, unit_price, quantity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          it.order_number,
          it.item_key,
          it.product_id,
          it.slug,
          it.name,
          it.concentration,
          it.image ?? '',
          it.size_label,
          it.size_sku,
          it.unit_price,
          it.quantity,
        ],
      );
    }

    console.log(
      `[NORVA DB Migration] Successfully migrated ${orders.length} orders and ${items.length} items from SQLite to PostgreSQL.`,
    );
  } catch (migErr) {
    console.warn('[NORVA DB Migration] Notice: SQLite migration skipped or encountered non-fatal notice:', migErr);
  }
}
