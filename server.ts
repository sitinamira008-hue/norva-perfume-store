import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'usman122';
const ADMIN_COOKIE_NAME = 'norva_admin_token';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DUPLICATE_ORDER_WINDOW_MS = 60 * 1000; // 60-second anti-duplicate window
const MAX_BACKUPS_RETAINED = 10;

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export type PaymentStatus = 'Pending' | 'Paid' | 'Refunded';
export type DiscountType = 'percentage' | 'fixed';

const VALID_ORDER_STATUSES = new Set<OrderStatus>([
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
]);

const VALID_PAYMENT_STATUSES = new Set<PaymentStatus>(['Pending', 'Paid', 'Refunded']);

const CATALOG_DEFAULTS: { id: string; name: string; defaultPrice: number }[] = [
  { id: 'frag-01', name: 'Khamrah Qawa', defaultPrice: 2500 },
  { id: 'frag-02', name: 'Cool Water', defaultPrice: 2500 },
  { id: 'frag-03', name: '9mM Rebel', defaultPrice: 2500 },
  { id: 'frag-04', name: 'Jadora', defaultPrice: 2500 },
  { id: 'frag-05', name: 'Gucci Flora', defaultPrice: 2500 },
];

const DEFAULT_SHIPPING_RATES: {
  cityKey: string;
  cityName: string;
  standardFee: number;
  expressFee: number;
  freeShippingThreshold: number;
  estimatedDays: string;
}[] = [
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

const DEFAULT_COUPONS: {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxUses: number | null;
  description: string;
}[] = [
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

interface OrderItemRecord {
  key: string;
  productId: string;
  slug: string;
  name: string;
  concentration: string;
  image: string;
  sizeLabel: string;
  sizeSku: string;
  unitPrice: number;
  quantity: number;
}

interface CustomerRecord {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

interface OrderDto {
  orderNumber: string;
  createdAt: string;
  createdAtIso: string;
  createdAtMs: number;
  updatedAtIso: string;
  status: OrderStatus;
  paymentMethod: 'cod' | 'invoice';
  paymentStatus: PaymentStatus;
  shippingSpeed: 'standard' | 'express';
  subtotal: number;
  discountAmount: number;
  shippingCost: number;
  total: number;
  couponCode?: string;
  giftNote?: string;
  adminNotes?: string;
  isNew?: boolean;
  items: OrderItemRecord[];
  customer: CustomerRecord;
}

interface ProductOverrideDto {
  price?: number;
  stockUnits?: number;
  lowStockThreshold?: number;
  inStock?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
}

interface ShippingRateDto {
  cityKey: string;
  cityName: string;
  standardFee: number;
  expressFee: number;
  freeShippingThreshold: number;
  estimatedDays: string;
  active: boolean;
}

interface CouponDto {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxUses: number | null;
  usedCount: number;
  description: string;
  active: boolean;
  expiresAtIso: string | null;
}

interface ReviewDto {
  id: string;
  productId: string;
  author: string;
  location: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verifiedPurchase?: boolean;
}

interface InquiryDto {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  createdAt: string;
  resolved: boolean;
}

interface BackupDto {
  filename: string;
  sizeBytes: number;
  createdAtIso: string;
}

interface AuthenticatedAdmin {
  tokenHash: string;
  email: string;
  loggedInAt: string;
}

// ============================================================================
// PERSISTENT SQLITE DATABASE & MIGRATIONS
// ============================================================================
const dbFilePath = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH || 'data/norva_store.sqlite',
);
const backupsDir = path.resolve(path.dirname(dbFilePath), 'backups');
fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
fs.mkdirSync(backupsDir, { recursive: true });

const db = new DatabaseSync(dbFilePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = FULL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

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
    created_at_ms INTEGER NOT NULL,
    updated_at_iso TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_orders_created_ms ON orders(created_at_ms DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_phone_digits ON orders(customer_phone_digits);
  CREATE INDEX IF NOT EXISTS idx_orders_unseen ON orders(is_seen_by_admin);

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  CREATE INDEX IF NOT EXISTS idx_order_items_order_number ON order_items(order_number);

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    logged_in_at TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    expires_at_ms INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_overrides (
    product_id TEXT PRIMARY KEY,
    price INTEGER,
    stock_units INTEGER,
    low_stock_threshold INTEGER DEFAULT 10,
    in_stock INTEGER,
    is_best_seller INTEGER,
    is_new_arrival INTEGER,
    updated_at_ms INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shipping_rates (
    city_key TEXT PRIMARY KEY,
    city_name TEXT NOT NULL,
    standard_fee INTEGER NOT NULL,
    express_fee INTEGER NOT NULL,
    free_shipping_threshold INTEGER NOT NULL DEFAULT 5000,
    estimated_days TEXT NOT NULL DEFAULT '2–4 Working Days',
    active INTEGER NOT NULL DEFAULT 1,
    updated_at_ms INTEGER NOT NULL
  );

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
    created_at_ms INTEGER NOT NULL
  );

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
    created_at_ms INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id, created_at_ms DESC);

  CREATE TABLE IF NOT EXISTS wishlists (
    client_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    PRIMARY KEY (client_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    topic TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    email TEXT PRIMARY KEY,
    created_at_ms INTEGER NOT NULL
  );
`);

// Safe idempotent column migrations for existing databases
function ensureColumnExists(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumnExists('orders', 'idempotency_key', 'TEXT');
ensureColumnExists('orders', 'fingerprint_hash', 'TEXT');
ensureColumnExists('orders', 'stock_deducted', 'INTEGER NOT NULL DEFAULT 1');
ensureColumnExists('product_overrides', 'low_stock_threshold', 'INTEGER DEFAULT 10');

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_orders_fingerprint ON orders(fingerprint_hash, created_at_ms DESC);
`);

function checkpointDatabase(): void {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    try {
      db.exec('PRAGMA wal_checkpoint(PASSIVE);');
    } catch {
      // Safe no-op if checkpoint is temporarily busy
    }
  }
}

// Seed default inventory, city shipping rates, and coupons without overwriting admin edits
function seedInitialStoreConfiguration(): void {
  const now = Date.now();

  const seedProdStmt = db.prepare(`
    INSERT OR IGNORE INTO product_overrides (
      product_id, price, stock_units, low_stock_threshold, in_stock, updated_at_ms
    ) VALUES (?, ?, 48, 10, 1, ?)
  `);
  for (const item of CATALOG_DEFAULTS) {
    seedProdStmt.run(item.id, item.defaultPrice, now);
  }

  const seedRateStmt = db.prepare(`
    INSERT OR IGNORE INTO shipping_rates (
      city_key, city_name, standard_fee, express_fee, free_shipping_threshold, estimated_days, active, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);
  for (const r of DEFAULT_SHIPPING_RATES) {
    seedRateStmt.run(
      r.cityKey,
      r.cityName,
      r.standardFee,
      r.expressFee,
      r.freeShippingThreshold,
      r.estimatedDays,
      now,
    );
  }

  const seedCouponStmt = db.prepare(`
    INSERT OR IGNORE INTO coupons (
      code, discount_type, discount_value, min_order_amount, max_uses, used_count, description, active, expires_at_iso, created_at_ms
    ) VALUES (?, ?, ?, ?, ?, 0, ?, 1, NULL, ?)
  `);
  for (const c of DEFAULT_COUPONS) {
    seedCouponStmt.run(
      c.code,
      c.discountType,
      c.discountValue,
      c.minOrderAmount,
      c.maxUses,
      c.description,
      now,
    );
  }

  checkpointDatabase();
}

seedInitialStoreConfiguration();

// ============================================================================
// CRYPTO, PHONE VERIFICATION & AUTH HELPERS
// ============================================================================
function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeComparePassword(candidate: string, expected: string): boolean {
  const a = Buffer.from(sha256Hex(candidate), 'hex');
  const b = Buffer.from(sha256Hex(expected), 'hex');
  return crypto.timingSafeEqual(a, b);
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D+/g, '');
}

/**
 * Canonical phone comparison supporting local (0300-1234567) and international (+92 300 1234567) formats.
 */
function phonesMatchForVerification(storedDigitsRaw: string, inputPhone: string): boolean {
  const a = normalizePhoneDigits(storedDigitsRaw);
  const b = normalizePhoneDigits(inputPhone);
  if (!a || !b || b.length < 7) return false;
  if (a === b) return true;

  const canonical = (d: string): string => {
    if (d.startsWith('0092') && d.length >= 14) return d.slice(4);
    if (d.startsWith('92') && d.length >= 12) return d.slice(2);
    if (d.startsWith('0') && d.length >= 11) return d.slice(1);
    return d;
  };
  return canonical(a) === canonical(b);
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) {
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

function extractRawAdminToken(req: Request | IncomingMessage, queryToken?: string): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  if (queryToken && queryToken.trim()) {
    return queryToken.trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[ADMIN_COOKIE_NAME]) {
    return cookies[ADMIN_COOKIE_NAME];
  }
  return null;
}

function verifyAdminToken(rawToken: string | null): AuthenticatedAdmin | null {
  if (!rawToken || rawToken.length < 16) return null;
  const tokenHash = sha256Hex(rawToken);
  const now = Date.now();

  const row = db
    .prepare(
      `SELECT token_hash, email, logged_in_at, expires_at_ms
       FROM admin_sessions
       WHERE token_hash = ?`,
    )
    .get(tokenHash) as
    | {
        token_hash: string;
        email: string;
        logged_in_at: string;
        expires_at_ms: number;
      }
    | undefined;

  if (!row) return null;
  if (row.expires_at_ms <= now) {
    db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  return {
    tokenHash: row.token_hash,
    email: row.email,
    loggedInAt: row.logged_in_at,
  };
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const rawToken = extractRawAdminToken(req, queryToken);
  const session = verifyAdminToken(rawToken);
  if (!session) {
    res.status(401).json({
      ok: false,
      error: 'Administrator authentication required.',
    });
    return;
  }
  (req as Request & { adminSession?: AuthenticatedAdmin }).adminSession = session;
  next();
}

// ============================================================================
// DATA ACCESS & BUSINESS LOGIC HELPERS
// ============================================================================
function normalizeOrderStatus(raw: string): OrderStatus {
  if (raw === 'Dispatched') return 'Shipped';
  if (VALID_ORDER_STATUSES.has(raw as OrderStatus)) return raw as OrderStatus;
  return 'Pending';
}

function normalizePaymentStatus(raw: string): PaymentStatus {
  if (VALID_PAYMENT_STATUSES.has(raw as PaymentStatus)) return raw as PaymentStatus;
  return 'Pending';
}

interface RawOrderRow {
  order_number: string;
  lookup_token: string;
  idempotency_key: string | null;
  fingerprint_hash: string | null;
  stock_deducted: number;
  status: string;
  payment_method: string;
  payment_status: string;
  shipping_speed: string;
  subtotal: number;
  discount_amount: number;
  shipping_cost: number;
  total: number;
  coupon_code: string | null;
  gift_note: string | null;
  admin_notes: string | null;
  customer_full_name: string;
  customer_email: string;
  customer_phone: string;
  customer_phone_digits: string;
  customer_address: string;
  customer_city: string;
  customer_postal_code: string;
  customer_country: string;
  is_seen_by_admin: number;
  created_at: string;
  created_at_iso: string;
  created_at_ms: number;
  updated_at_iso: string;
}

interface RawOrderItemRow {
  order_number: string;
  item_key: string;
  product_id: string;
  slug: string;
  name: string;
  concentration: string;
  image: string;
  size_label: string;
  size_sku: string;
  unit_price: number;
  quantity: number;
}

function hydrateOrders(rows: RawOrderRow[], includeAdminFields: boolean): OrderDto[] {
  if (rows.length === 0) return [];

  const orderNumbers = rows.map((r) => r.order_number);
  const placeholders = orderNumbers.map(() => '?').join(', ');
  const itemRows = db
    .prepare(
      `SELECT order_number, item_key, product_id, slug, name, concentration, image, size_label, size_sku, unit_price, quantity
       FROM order_items
       WHERE order_number IN (${placeholders})
       ORDER BY id ASC`,
    )
    .all(...orderNumbers) as unknown as RawOrderItemRow[];

  const itemsByOrder = new Map<string, OrderItemRecord[]>();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.order_number) ?? [];
    list.push({
      key: item.item_key,
      productId: item.product_id,
      slug: item.slug,
      name: item.name,
      concentration: item.concentration,
      image: item.image,
      sizeLabel: item.size_label,
      sizeSku: item.size_sku,
      unitPrice: item.unit_price,
      quantity: item.quantity,
    });
    itemsByOrder.set(item.order_number, list);
  }

  return rows.map((row) => {
    const dto: OrderDto = {
      orderNumber: row.order_number,
      createdAt: row.created_at,
      createdAtIso: row.created_at_iso,
      createdAtMs: row.created_at_ms,
      updatedAtIso: row.updated_at_iso,
      status: normalizeOrderStatus(row.status),
      paymentMethod: row.payment_method === 'invoice' ? 'invoice' : 'cod',
      paymentStatus: normalizePaymentStatus(row.payment_status),
      shippingSpeed: row.shipping_speed === 'express' ? 'express' : 'standard',
      subtotal: row.subtotal,
      discountAmount: row.discount_amount,
      shippingCost: row.shipping_cost,
      total: row.total,
      couponCode: row.coupon_code ?? undefined,
      giftNote: row.gift_note ?? undefined,
      items: itemsByOrder.get(row.order_number) ?? [],
      customer: {
        fullName: row.customer_full_name,
        email: row.customer_email,
        phone: row.customer_phone,
        address: row.customer_address,
        city: row.customer_city,
        postalCode: row.customer_postal_code,
        country: row.customer_country,
      },
    };

    if (includeAdminFields) {
      dto.isNew = row.is_seen_by_admin === 0;
      dto.adminNotes = row.admin_notes ?? '';
    }
    return dto;
  });
}

function getOrderByNumber(orderNumber: string, includeAdminFields: boolean): OrderDto | null {
  const row = db
    .prepare('SELECT * FROM orders WHERE UPPER(order_number) = UPPER(?)')
    .get(orderNumber.trim()) as unknown as RawOrderRow | undefined;
  if (!row) return null;
  return hydrateOrders([row], includeAdminFields)[0] ?? null;
}

function getUnseenOrderCount(): number {
  const row = db
    .prepare('SELECT COUNT(*) AS cnt FROM orders WHERE is_seen_by_admin = 0')
    .get() as { cnt: number } | undefined;
  return Number(row?.cnt ?? 0);
}

function getAllAdminOrders(filters?: {
  q?: string;
  orderId?: string;
  phone?: string;
  status?: string;
  paymentStatus?: string;
  onlyNew?: boolean;
}): OrderDto[] {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filters?.status && filters.status !== 'All') {
    clauses.push('status = ?');
    params.push(filters.status);
  }

  if (filters?.paymentStatus && filters.paymentStatus !== 'All') {
    clauses.push('payment_status = ?');
    params.push(filters.paymentStatus);
  }

  if (filters?.onlyNew) {
    clauses.push('is_seen_by_admin = 0');
  }

  if (filters?.orderId && filters.orderId.trim()) {
    clauses.push('LOWER(order_number) LIKE ?');
    params.push(`%${filters.orderId.trim().toLowerCase()}%`);
  }

  if (filters?.phone && filters.phone.trim()) {
    const digits = normalizePhoneDigits(filters.phone);
    if (digits) {
      clauses.push('(customer_phone_digits LIKE ? OR LOWER(customer_phone) LIKE ?)');
      params.push(`%${digits}%`, `%${filters.phone.trim().toLowerCase()}%`);
    } else {
      clauses.push('LOWER(customer_phone) LIKE ?');
      params.push(`%${filters.phone.trim().toLowerCase()}%`);
    }
  }

  if (filters?.q && filters.q.trim()) {
    const qLower = `%${filters.q.trim().toLowerCase()}%`;
    const qDigits = normalizePhoneDigits(filters.q);
    if (qDigits) {
      clauses.push(
        '(LOWER(order_number) LIKE ? OR LOWER(customer_full_name) LIKE ? OR LOWER(customer_email) LIKE ? OR LOWER(customer_phone) LIKE ? OR customer_phone_digits LIKE ? OR LOWER(customer_city) LIKE ? OR LOWER(customer_address) LIKE ?)',
      );
      params.push(qLower, qLower, qLower, qLower, `%${qDigits}%`, qLower, qLower);
    } else {
      clauses.push(
        '(LOWER(order_number) LIKE ? OR LOWER(customer_full_name) LIKE ? OR LOWER(customer_email) LIKE ? OR LOWER(customer_phone) LIKE ? OR LOWER(customer_city) LIKE ? OR LOWER(customer_address) LIKE ?)',
      );
      params.push(qLower, qLower, qLower, qLower, qLower, qLower);
    }
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM orders ${whereSql} ORDER BY created_at_ms DESC`)
    .all(...params) as unknown as RawOrderRow[];

  return hydrateOrders(rows, true);
}

function getProductOverridesMap(): Record<string, ProductOverrideDto> {
  const rows = db.prepare('SELECT * FROM product_overrides').all() as unknown as {
    product_id: string;
    price: number | null;
    stock_units: number | null;
    low_stock_threshold: number | null;
    in_stock: number | null;
    is_best_seller: number | null;
    is_new_arrival: number | null;
  }[];

  const out: Record<string, ProductOverrideDto> = {};
  for (const r of rows) {
    const ov: ProductOverrideDto = {};
    if (r.price !== null) ov.price = r.price;
    if (r.stock_units !== null) ov.stockUnits = r.stock_units;
    if (r.low_stock_threshold !== null) ov.lowStockThreshold = r.low_stock_threshold;
    if (r.in_stock !== null) ov.inStock = r.in_stock === 1;
    if (r.is_best_seller !== null) ov.isBestSeller = r.is_best_seller === 1;
    if (r.is_new_arrival !== null) ov.isNewArrival = r.is_new_arrival === 1;
    out[r.product_id] = ov;
  }
  return out;
}

function getShippingRates(onlyActive = false): ShippingRateDto[] {
  const sql = onlyActive
    ? 'SELECT * FROM shipping_rates WHERE active = 1 ORDER BY CASE WHEN city_key = \'__default__\' THEN 1 ELSE 0 END, city_name ASC'
    : 'SELECT * FROM shipping_rates ORDER BY CASE WHEN city_key = \'__default__\' THEN 1 ELSE 0 END, city_name ASC';
  const rows = db.prepare(sql).all() as unknown as {
    city_key: string;
    city_name: string;
    standard_fee: number;
    express_fee: number;
    free_shipping_threshold: number;
    estimated_days: string;
    active: number;
  }[];

  return rows.map((r) => ({
    cityKey: r.city_key,
    cityName: r.city_name,
    standardFee: r.standard_fee,
    expressFee: r.express_fee,
    freeShippingThreshold: r.free_shipping_threshold,
    estimatedDays: r.estimated_days,
    active: r.active === 1,
  }));
}

function calculateShippingForCity(
  cityInput: string,
  shippingSpeed: 'standard' | 'express',
  subtotal: number,
): { cost: number; matchedRate: ShippingRateDto } {
  const normalizedCity = cityInput.trim().toLowerCase();
  const activeRates = getShippingRates(true);

  const exact = activeRates.find(
    (r) => r.cityKey !== '__default__' && r.cityKey === normalizedCity,
  );
  const fallback =
    activeRates.find((r) => r.cityKey === '__default__') ?? {
      cityKey: '__default__',
      cityName: 'Nationwide',
      standardFee: 300,
      expressFee: 550,
      freeShippingThreshold: 5000,
      estimatedDays: '3–5 Working Days',
      active: true,
    };

  const rate = exact ?? fallback;
  if (shippingSpeed === 'express') {
    return { cost: rate.expressFee, matchedRate: rate };
  }
  if (rate.freeShippingThreshold > 0 && subtotal >= rate.freeShippingThreshold) {
    return { cost: 0, matchedRate: rate };
  }
  return { cost: rate.standardFee, matchedRate: rate };
}

function getAllCoupons(): CouponDto[] {
  const rows = db
    .prepare('SELECT * FROM coupons ORDER BY created_at_ms DESC')
    .all() as unknown as {
    code: string;
    discount_type: string;
    discount_value: number;
    min_order_amount: number;
    max_uses: number | null;
    used_count: number;
    description: string;
    active: number;
    expires_at_iso: string | null;
  }[];

  return rows.map((r) => ({
    code: r.code,
    discountType: r.discount_type === 'fixed' ? 'fixed' : 'percentage',
    discountValue: r.discount_value,
    minOrderAmount: r.min_order_amount,
    maxUses: r.max_uses,
    usedCount: r.used_count,
    description: r.description,
    active: r.active === 1,
    expiresAtIso: r.expires_at_iso,
  }));
}

function evaluateCoupon(
  rawCode: string,
  subtotal: number,
): { ok: true; coupon: CouponDto; discountAmount: number } | { ok: false; error: string } {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { ok: false, error: 'Please enter a coupon code.' };
  }

  const row = db
    .prepare('SELECT * FROM coupons WHERE UPPER(code) = ?')
    .get(code) as
    | {
        code: string;
        discount_type: string;
        discount_value: number;
        min_order_amount: number;
        max_uses: number | null;
        used_count: number;
        description: string;
        active: number;
        expires_at_iso: string | null;
      }
    | undefined;

  if (!row) {
    return { ok: false, error: `Coupon code "${code}" was not recognized.` };
  }

  if (row.active !== 1) {
    return { ok: false, error: `Coupon code "${code}" is currently inactive.` };
  }

  if (row.expires_at_iso) {
    const expMs = Date.parse(row.expires_at_iso);
    if (!Number.isNaN(expMs) && expMs < Date.now()) {
      return { ok: false, error: `Coupon code "${code}" has expired.` };
    }
  }

  if (row.max_uses !== null && row.used_count >= row.max_uses) {
    return { ok: false, error: `Coupon code "${code}" has reached its redemption limit.` };
  }

  if (subtotal < row.min_order_amount) {
    return {
      ok: false,
      error: `Code "${code}" requires a minimum order subtotal of PKR ${row.min_order_amount.toLocaleString('en-PK')}.`,
    };
  }

  const discountType: DiscountType = row.discount_type === 'fixed' ? 'fixed' : 'percentage';
  const rawDiscount =
    discountType === 'percentage'
      ? Math.round((subtotal * row.discount_value) / 100)
      : row.discount_value;
  const discountAmount = Math.max(0, Math.min(subtotal, rawDiscount));

  return {
    ok: true,
    coupon: {
      code: row.code,
      discountType,
      discountValue: row.discount_value,
      minOrderAmount: row.min_order_amount,
      maxUses: row.max_uses,
      usedCount: row.used_count,
      description: row.description,
      active: true,
      expiresAtIso: row.expires_at_iso,
    },
    discountAmount,
  };
}

function getReviewsGroupedByProduct(): Record<string, ReviewDto[]> {
  const rows = db
    .prepare('SELECT * FROM product_reviews ORDER BY created_at_ms DESC')
    .all() as unknown as {
    id: string;
    product_id: string;
    author: string;
    location: string;
    rating: number;
    title: string;
    comment: string;
    verified_purchase: number;
    date_label: string;
  }[];

  const grouped: Record<string, ReviewDto[]> = {};
  for (const r of rows) {
    if (!grouped[r.product_id]) grouped[r.product_id] = [];
    grouped[r.product_id].push({
      id: r.id,
      productId: r.product_id,
      author: r.author,
      location: r.location,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      date: r.date_label,
      verifiedPurchase: r.verified_purchase === 1,
    });
  }
  return grouped;
}

function getAllInquiries(): InquiryDto[] {
  const rows = db
    .prepare('SELECT * FROM inquiries ORDER BY created_at_ms DESC')
    .all() as unknown as {
    id: string;
    name: string;
    email: string;
    topic: string;
    message: string;
    created_at: string;
    resolved: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    topic: r.topic,
    message: r.message,
    createdAt: r.created_at,
    resolved: r.resolved === 1,
  }));
}

function getAllSubscribers(): string[] {
  const rows = db
    .prepare('SELECT email FROM subscribers ORDER BY created_at_ms DESC')
    .all() as unknown as { email: string }[];
  return rows.map((r) => r.email);
}

function computeSalesAnalytics() {
  const allOrders = getAllAdminOrders();
  const validOrders = allOrders.filter((o) => o.status !== 'Cancelled');
  const cancelledOrders = allOrders.filter((o) => o.status === 'Cancelled');

  const grossRevenue = validOrders.reduce((s, o) => s + o.total, 0);
  const collectedRevenue = validOrders
    .filter((o) => o.paymentStatus === 'Paid' || o.status === 'Delivered')
    .reduce((s, o) => s + o.total, 0);
  const pendingCollectionRevenue = Math.max(0, grossRevenue - collectedRevenue);
  const totalUnitsSold = validOrders.reduce(
    (s, o) => s + o.items.reduce((acc, i) => acc + i.quantity, 0),
    0,
  );
  const totalDiscountsGiven = validOrders.reduce((s, o) => s + o.discountAmount, 0);
  const averageOrderValue =
    validOrders.length > 0 ? Math.round(grossRevenue / validOrders.length) : 0;

  // Daily Revenue Report (Last 14 Days + any active dates)
  const dailyMap = new Map<
    string,
    { date: string; ordersCount: number; unitsSold: number; revenue: number }
  >();

  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { date: key, ordersCount: 0, unitsSold: 0, revenue: 0 });
  }

  // Monthly Revenue Report (Last 6 Months + any active months)
  const monthlyMap = new Map<
    string,
    { month: string; ordersCount: number; unitsSold: number; revenue: number; avgOrderValue: number }
  >();

  const nowDate = new Date();
  for (let i = 5; i >= 0; i--) {
    const mDate = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - i, 1));
    const mKey = mDate.toISOString().slice(0, 7);
    monthlyMap.set(mKey, {
      month: mKey,
      ordersCount: 0,
      unitsSold: 0,
      revenue: 0,
      avgOrderValue: 0,
    });
  }

  const productSalesMap = new Map<
    string,
    { productId: string; name: string; unitsSold: number; revenue: number }
  >();
  for (const c of CATALOG_DEFAULTS) {
    productSalesMap.set(c.id, {
      productId: c.id,
      name: c.name,
      unitsSold: 0,
      revenue: 0,
    });
  }

  const citySalesMap = new Map<string, { city: string; ordersCount: number; revenue: number }>();

  for (const ord of validOrders) {
    const iso = ord.createdAtIso || new Date(ord.createdAtMs || Date.now()).toISOString();
    const dayKey = iso.slice(0, 10);
    const monthKey = iso.slice(0, 7);
    const ordUnits = ord.items.reduce((acc, it) => acc + it.quantity, 0);

    const dayRec = dailyMap.get(dayKey) ?? {
      date: dayKey,
      ordersCount: 0,
      unitsSold: 0,
      revenue: 0,
    };
    dayRec.ordersCount += 1;
    dayRec.unitsSold += ordUnits;
    dayRec.revenue += ord.total;
    dailyMap.set(dayKey, dayRec);

    const monthRec = monthlyMap.get(monthKey) ?? {
      month: monthKey,
      ordersCount: 0,
      unitsSold: 0,
      revenue: 0,
      avgOrderValue: 0,
    };
    monthRec.ordersCount += 1;
    monthRec.unitsSold += ordUnits;
    monthRec.revenue += ord.total;
    monthRec.avgOrderValue = Math.round(monthRec.revenue / monthRec.ordersCount);
    monthlyMap.set(monthKey, monthRec);

    for (const item of ord.items) {
      const prodRec = productSalesMap.get(item.productId) ?? {
        productId: item.productId,
        name: item.name,
        unitsSold: 0,
        revenue: 0,
      };
      prodRec.unitsSold += item.quantity;
      prodRec.revenue += item.unitPrice * item.quantity;
      productSalesMap.set(item.productId, prodRec);
    }

    const cityClean = ord.customer.city.trim() || 'Unknown';
    const cityKey = cityClean.toLowerCase();
    const cityRec = citySalesMap.get(cityKey) ?? {
      city: cityClean,
      ordersCount: 0,
      revenue: 0,
    };
    cityRec.ordersCount += 1;
    cityRec.revenue += ord.total;
    citySalesMap.set(cityKey, cityRec);
  }

  const dailyReport = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const monthlyReport = Array.from(monthlyMap.values()).sort((a, b) =>
    b.month.localeCompare(a.month),
  );
  const topProducts = Array.from(productSalesMap.values()).sort(
    (a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold,
  );
  const topCities = Array.from(citySalesMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  return {
    summary: {
      totalOrders: allOrders.length,
      validOrdersCount: validOrders.length,
      cancelledOrdersCount: cancelledOrders.length,
      grossRevenue,
      collectedRevenue,
      pendingCollectionRevenue,
      averageOrderValue,
      totalUnitsSold,
      totalDiscountsGiven,
    },
    dailyReport,
    monthlyReport,
    topProducts,
    topCities,
  };
}

// ============================================================================
// SECURE SQLITE BACKUP MANAGEMENT (ATOMIC VACUUM INTO)
// ============================================================================
function listBackups(): BackupDto[] {
  try {
    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => /^norva_backup_[0-9_A-Za-z-]+\.sqlite$/.test(f));

    const list: BackupDto[] = [];
    for (const filename of files) {
      const full = path.join(backupsDir, filename);
      const stat = fs.statSync(full);
      list.push({
        filename,
        sizeBytes: stat.size,
        createdAtIso: stat.mtime.toISOString(),
      });
    }
    return list.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  } catch {
    return [];
  }
}

function createDatabaseBackup(tag = 'manual'): BackupDto {
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
  const safeTag = tag.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'snap';
  const filename = `norva_backup_${stamp}_${safeTag}.sqlite`;
  const targetPath = path.join(backupsDir, filename);

  // Escape single quotes in file path for SQLite VACUUM INTO
  const escapedTarget = targetPath.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escapedTarget}'`);

  // Prune older snapshots beyond MAX_BACKUPS_RETAINED
  const all = listBackups();
  for (const old of all.slice(MAX_BACKUPS_RETAINED)) {
    try {
      fs.unlinkSync(path.join(backupsDir, old.filename));
    } catch {
      // Ignore cleanup race
    }
  }

  const stat = fs.statSync(targetPath);
  return {
    filename,
    sizeBytes: stat.size,
    createdAtIso: stat.mtime.toISOString(),
  };
}

function generateUniqueOrderNumber(): string {
  const checkStmt = db.prepare('SELECT 1 FROM orders WHERE order_number = ?');
  for (let attempt = 0; attempt < 25; attempt++) {
    const num = Math.floor(10000 + Math.random() * 90000);
    const candidate = `NV-${num}`;
    if (!checkStmt.get(candidate)) {
      return candidate;
    }
  }
  return `NV-${Date.now().toString().slice(-6)}`;
}

// ============================================================================
// REAL-TIME ADMIN NOTIFICATION HUB (WEBSOCKET + SSE)
// ============================================================================
const adminWsClients = new Set<WebSocket>();
const adminSseClients = new Set<Response>();

function broadcastToAdmins(eventPayload: Record<string, unknown>): void {
  const serialized = JSON.stringify(eventPayload);

  for (const client of adminWsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(serialized);
      } catch {
        adminWsClients.delete(client);
      }
    } else if (
      client.readyState === WebSocket.CLOSED ||
      client.readyState === WebSocket.CLOSING
    ) {
      adminWsClients.delete(client);
    }
  }

  for (const res of adminSseClients) {
    try {
      res.write(`data: ${serialized}\n\n`);
    } catch {
      adminSseClients.delete(res);
    }
  }
}

// ============================================================================
// EXPRESS APPLICATION & ROUTES
// ============================================================================
async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Malformed JSON error handler
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        ok: false,
        error: 'Malformed JSON request payload.',
      });
      return;
    }
    next(err);
  });

  // --------------------------------------------------------------------------
  // PUBLIC STOREFRONT ENDPOINTS (ZERO CUSTOMER PII EXPOSED)
  // --------------------------------------------------------------------------
  app.get('/api/storefront/bootstrap', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      productOverrides: getProductOverridesMap(),
      shippingRates: getShippingRates(true),
      reviewsByProduct: getReviewsGroupedByProduct(),
    });
  });

  app.get('/api/shipping-rates', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      shippingRates: getShippingRates(true),
    });
  });

  // Validate Discount / Coupon Code in Checkout
  app.post('/api/coupons/validate', (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '');
    const subtotal = Math.max(0, Math.round(Number(req.body?.subtotal) || 0));
    const evaluation = evaluateCoupon(code, subtotal);
    if (!evaluation.ok) {
      res.status(400).json({
        ok: false,
        error: evaluation.error,
      });
      return;
    }
    res.json({
      ok: true,
      coupon: evaluation.coupon,
      discountAmount: evaluation.discountAmount,
    });
  });

  // Persistent Wishlist Sync (Keyed by anonymous browser client UUID)
  app.get('/api/wishlist/:clientId', (req: Request, res: Response) => {
    const clientId = String(req.params.clientId ?? '').trim();
    if (!clientId || clientId.length < 8) {
      res.json({ ok: true, wishlist: [] });
      return;
    }
    const rows = db
      .prepare('SELECT product_id FROM wishlists WHERE client_id = ? ORDER BY created_at_ms DESC')
      .all(clientId) as unknown as { product_id: string }[];
    res.json({
      ok: true,
      wishlist: rows.map((r) => r.product_id),
    });
  });

  app.post('/api/wishlist/:clientId/toggle', (req: Request, res: Response) => {
    const clientId = String(req.params.clientId ?? '').trim();
    const productId = String(req.body?.productId ?? '').trim();
    if (!clientId || clientId.length < 8 || !productId) {
      res.status(400).json({ ok: false, error: 'Valid clientId and productId required.' });
      return;
    }

    const existing = db
      .prepare('SELECT 1 FROM wishlists WHERE client_id = ? AND product_id = ?')
      .get(clientId, productId);

    if (existing) {
      db.prepare('DELETE FROM wishlists WHERE client_id = ? AND product_id = ?').run(
        clientId,
        productId,
      );
    } else {
      db.prepare(
        'INSERT INTO wishlists (client_id, product_id, created_at_ms) VALUES (?, ?, ?)',
      ).run(clientId, productId, Date.now());
    }
    checkpointDatabase();

    const rows = db
      .prepare('SELECT product_id FROM wishlists WHERE client_id = ? ORDER BY created_at_ms DESC')
      .all(clientId) as unknown as { product_id: string }[];

    res.json({
      ok: true,
      saved: !existing,
      wishlist: rows.map((r) => r.product_id),
    });
  });

  // Persistent Product Reviews
  app.get('/api/reviews', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      reviewsByProduct: getReviewsGroupedByProduct(),
    });
  });

  app.post('/api/products/:productId/reviews', (req: Request, res: Response) => {
    const productId = String(req.params.productId ?? '').trim();
    const author = String(req.body?.author ?? '').trim().slice(0, 80);
    const location = String(req.body?.location ?? '').trim().slice(0, 80) || 'Verified Client';
    const title = String(req.body?.title ?? '').trim().slice(0, 120);
    const comment = String(req.body?.comment ?? '').trim().slice(0, 1200);
    const orderNumber = String(req.body?.orderNumber ?? '').trim().toUpperCase();
    const rating = Math.max(1, Math.min(5, Math.round(Number(req.body?.rating) || 5)));

    if (!productId || !author || !title || !comment) {
      res.status(400).json({
        ok: false,
        error: 'Please enter your name, review headline, and review comment.',
      });
      return;
    }

    let verifiedPurchase = 0;
    if (orderNumber) {
      const ordMatch = db
        .prepare('SELECT 1 FROM orders WHERE UPPER(order_number) = ? AND status != \'Cancelled\'')
        .get(orderNumber);
      if (ordMatch) verifiedPurchase = 1;
    }

    const id = `rev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const dateLabel = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    db.prepare(
      `INSERT INTO product_reviews (
        id, product_id, author, location, rating, title, comment, verified_purchase, date_label, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      productId,
      author,
      location,
      rating,
      title,
      comment,
      verifiedPurchase,
      dateLabel,
      Date.now(),
    );

    checkpointDatabase();

    const review: ReviewDto = {
      id,
      productId,
      author,
      location,
      rating,
      title,
      comment,
      date: dateLabel,
      verifiedPurchase: verifiedPurchase === 1,
    };

    broadcastToAdmins({ type: 'review:created', review });
    res.status(201).json({ ok: true, review });
  });

  // Customer Order Tracking using Unique Order Number + Phone Verification
  app.post('/api/orders/track', (req: Request, res: Response) => {
    const rawOrderNumber = String(req.body?.orderNumber ?? '').trim();
    const rawPhone = String(req.body?.phone ?? '').trim();

    if (!rawOrderNumber || !rawPhone) {
      res.status(400).json({
        ok: false,
        error: 'Please enter both your NORVA Order Number (e.g. NV-12345) and your Phone Number.',
      });
      return;
    }

    const row = db
      .prepare('SELECT * FROM orders WHERE UPPER(order_number) = UPPER(?)')
      .get(rawOrderNumber) as unknown as RawOrderRow | undefined;

    if (!row || !phonesMatchForVerification(row.customer_phone_digits || row.customer_phone, rawPhone)) {
      res.status(404).json({
        ok: false,
        error:
          'No matching order was found for that Order Number and Phone Number. Please double-check both fields.',
      });
      return;
    }

    const orderDto = hydrateOrders([row], false)[0];
    res.json({
      ok: true,
      order: orderDto,
    });
  });

  // Create & Persist New Customer Order (with Idempotency, Duplicate Guard, City Shipping, Coupon & Stock Deduction)
  app.post('/api/orders', (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const customerInput = body.customer ?? {};
      const rawItems = Array.isArray(body.items) ? body.items : [];
      const idempotencyKey =
        typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length >= 8
          ? body.idempotencyKey.trim().slice(0, 120)
          : null;

      // 1. Check Idempotency Key first (prevents duplicate submissions on double-click or retry)
      if (idempotencyKey) {
        const existingByKey = db
          .prepare('SELECT * FROM orders WHERE idempotency_key = ?')
          .get(idempotencyKey) as unknown as RawOrderRow | undefined;
        if (existingByKey) {
          const existingDto = hydrateOrders([existingByKey], false)[0];
          res.status(200).json({
            ok: true,
            duplicatePrevented: true,
            order: existingDto,
            lookupToken: existingByKey.lookup_token,
          });
          return;
        }
      }

      const fullName = String(customerInput.fullName ?? '').trim();
      const email = String(customerInput.email ?? '').trim();
      const phone = String(customerInput.phone ?? '').trim();
      const address = String(customerInput.address ?? '').trim();
      const city = String(customerInput.city ?? '').trim();
      const postalCode = String(customerInput.postalCode ?? '').trim();
      const country = String(customerInput.country ?? 'Pakistan').trim() || 'Pakistan';
      const phoneDigits = normalizePhoneDigits(phone);

      if (!fullName || !email || !email.includes('@') || !phone || !address || !city) {
        res.status(400).json({
          ok: false,
          error:
            'Please provide a valid full name, email address, phone number, street address, and city.',
        });
        return;
      }

      if (phoneDigits.length < 7) {
        res.status(400).json({
          ok: false,
          error: 'Please enter a valid 10 or 11-digit mobile/WhatsApp phone number.',
        });
        return;
      }

      if (rawItems.length === 0) {
        res.status(400).json({
          ok: false,
          error: 'Your shopping bag is empty. Please add at least one fragrance before ordering.',
        });
        return;
      }

      const overrides = getProductOverridesMap();
      const sanitizedItems: OrderItemRecord[] = [];
      const qtyByProductId = new Map<string, { qty: number; name: string }>();

      for (const raw of rawItems) {
        const productId = String(raw.productId ?? '').trim();
        const name = String(raw.name ?? '').trim();
        const quantity = Math.max(1, Math.min(99, Math.floor(Number(raw.quantity) || 1)));
        const fallbackUnitPrice = Math.max(100, Math.round(Number(raw.unitPrice) || 2500));
        const unitPrice = overrides[productId]?.price ?? fallbackUnitPrice;

        if (!productId || !name) continue;

        const prevQty = qtyByProductId.get(productId)?.qty ?? 0;
        qtyByProductId.set(productId, { qty: prevQty + quantity, name });

        sanitizedItems.push({
          key: String(raw.key ?? `${productId}__default`),
          productId,
          slug: String(raw.slug ?? productId),
          name,
          concentration: String(raw.concentration ?? 'Extrait de Parfum'),
          image: String(raw.image ?? ''),
          sizeLabel: String(raw.sizeLabel ?? '50ml'),
          sizeSku: String(raw.sizeSku ?? `${productId.toUpperCase()}-50`),
          unitPrice,
          quantity,
        });
      }

      if (sanitizedItems.length === 0) {
        res.status(400).json({
          ok: false,
          error: 'No valid products were included in the order.',
        });
        return;
      }

      const subtotal = sanitizedItems.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );

      // Validate Coupon if provided
      const rawCoupon =
        typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase() : '';
      let couponCode: string | null = null;
      let discountAmount = 0;

      if (rawCoupon) {
        const couponEval = evaluateCoupon(rawCoupon, subtotal);
        if (!couponEval.ok) {
          res.status(400).json({
            ok: false,
            error: couponEval.error,
          });
          return;
        }
        couponCode = couponEval.coupon.code;
        discountAmount = couponEval.discountAmount;
      }

      // Calculate City-Based Shipping Cost
      const shippingSpeed: 'standard' | 'express' =
        body.shippingSpeed === 'express' ? 'express' : 'standard';
      const shippingCalc = calculateShippingForCity(city, shippingSpeed, subtotal);
      const shippingCost = shippingCalc.cost;

      const total = Math.max(0, subtotal - discountAmount + shippingCost);
      const paymentMethod: 'cod' | 'invoice' =
        body.paymentMethod === 'invoice' ? 'invoice' : 'cod';
      const giftNote =
        typeof body.giftNote === 'string' && body.giftNote.trim()
          ? body.giftNote.trim().slice(0, 500)
          : null;

      // 2. Content Fingerprint Anti-Duplicate Guard (60s window)
      const itemsSig = sanitizedItems
        .map((i) => `${i.productId}:${i.sizeSku}:${i.quantity}`)
        .sort()
        .join('|');
      const fingerprintHash = sha256Hex(
        `${phoneDigits}|${email.toLowerCase()}|${city.toLowerCase()}|${total}|${itemsSig}`,
      );

      const now = new Date();
      const createdAtMs = now.getTime();

      const recentDuplicate = db
        .prepare(
          `SELECT * FROM orders
           WHERE fingerprint_hash = ? AND created_at_ms >= ? AND status != 'Cancelled'
           ORDER BY created_at_ms DESC LIMIT 1`,
        )
        .get(fingerprintHash, createdAtMs - DUPLICATE_ORDER_WINDOW_MS) as unknown as
        | RawOrderRow
        | undefined;

      if (recentDuplicate) {
        const existingDto = hydrateOrders([recentDuplicate], false)[0];
        res.status(200).json({
          ok: true,
          duplicatePrevented: true,
          order: existingDto,
          lookupToken: recentDuplicate.lookup_token,
        });
        return;
      }

      const orderNumber = generateUniqueOrderNumber();
      const lookupToken = crypto.randomBytes(32).toString('hex');
      const createdAtIso = now.toISOString();
      const createdAt = now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      db.exec('BEGIN IMMEDIATE TRANSACTION');
      try {
        // Atomic Stock Verification & Deduction inside transaction
        for (const [prodId, reqInfo] of qtyByProductId.entries()) {
          const stockRow = db
            .prepare('SELECT stock_units, in_stock FROM product_overrides WHERE product_id = ?')
            .get(prodId) as { stock_units: number | null; in_stock: number | null } | undefined;

          const availableUnits = stockRow?.stock_units ?? 48;
          const isAvailable = stockRow?.in_stock === null || stockRow?.in_stock === undefined ? true : stockRow.in_stock === 1;

          if (!isAvailable || availableUnits <= 0) {
            db.exec('ROLLBACK');
            res.status(409).json({
              ok: false,
              error: `${reqInfo.name} is currently out of stock.`,
            });
            return;
          }

          if (availableUnits < reqInfo.qty) {
            db.exec('ROLLBACK');
            res.status(409).json({
              ok: false,
              error: `Only ${availableUnits} flacon(s) of ${reqInfo.name} remain in stock. Please adjust your bag quantity.`,
            });
            return;
          }

          const nextUnits = availableUnits - reqInfo.qty;
          const nextInStock = nextUnits > 0 ? 1 : 0;

          db.prepare(
            `INSERT INTO product_overrides (product_id, stock_units, in_stock, updated_at_ms)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(product_id) DO UPDATE SET
               stock_units = excluded.stock_units,
               in_stock = excluded.in_stock,
               updated_at_ms = excluded.updated_at_ms`,
          ).run(prodId, nextUnits, nextInStock, createdAtMs);
        }

        // Atomic Coupon Usage Increment
        if (couponCode) {
          db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(
            couponCode,
          );
        }

        db.prepare(
          `INSERT INTO orders (
            order_number, lookup_token, idempotency_key, fingerprint_hash, stock_deducted,
            status, payment_method, payment_status,
            shipping_speed, subtotal, discount_amount, shipping_cost, total,
            coupon_code, gift_note, admin_notes,
            customer_full_name, customer_email, customer_phone, customer_phone_digits,
            customer_address, customer_city, customer_postal_code, customer_country,
            is_seen_by_admin, created_at, created_at_iso, created_at_ms, updated_at_iso
          ) VALUES (?, ?, ?, ?, 1, 'Pending', ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        ).run(
          orderNumber,
          lookupToken,
          idempotencyKey,
          fingerprintHash,
          paymentMethod,
          shippingSpeed,
          subtotal,
          discountAmount,
          shippingCost,
          total,
          couponCode,
          giftNote,
          fullName,
          email,
          phone,
          phoneDigits,
          address,
          city,
          postalCode,
          country,
          createdAt,
          createdAtIso,
          createdAtMs,
          createdAtIso,
        );

        const insertItemStmt = db.prepare(
          `INSERT INTO order_items (
            order_number, item_key, product_id, slug, name, concentration,
            image, size_label, size_sku, unit_price, quantity
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );

        for (const item of sanitizedItems) {
          insertItemStmt.run(
            orderNumber,
            item.key,
            item.productId,
            item.slug,
            item.name,
            item.concentration,
            item.image,
            item.sizeLabel,
            item.sizeSku,
            item.unitPrice,
            item.quantity,
          );
        }

        db.exec('COMMIT');
      } catch (txErr) {
        try {
          db.exec('ROLLBACK');
        } catch {}
        throw txErr;
      }

      checkpointDatabase();

      const adminOrder = getOrderByNumber(orderNumber, true);
      const buyerOrder = getOrderByNumber(orderNumber, false);
      const unseenCount = getUnseenOrderCount();
      const updatedOverrides = getProductOverridesMap();

      if (adminOrder) {
        broadcastToAdmins({
          type: 'order:created',
          order: adminOrder,
          unseenCount,
          productOverrides: updatedOverrides,
          coupons: getAllCoupons(),
        });
      }

      res.status(201).json({
        ok: true,
        order: buyerOrder,
        lookupToken,
        productOverrides: updatedOverrides,
      });
    } catch (err) {
      console.error('Failed to save customer order:', err);
      res.status(500).json({
        ok: false,
        error: 'Unable to save your order right now. Please try again in a moment.',
      });
    }
  });

  // Buyer-only order receipt lookup using unguessable per-order lookup tokens
  app.post('/api/orders/lookup', (req: Request, res: Response) => {
    const rawTokens = Array.isArray(req.body?.tokens) ? req.body.tokens : [];
    const tokens = rawTokens
      .filter((t: unknown): t is string => typeof t === 'string' && t.length >= 32)
      .slice(0, 50);

    if (tokens.length === 0) {
      res.json({ ok: true, orders: [] });
      return;
    }

    const placeholders = tokens.map(() => '?').join(', ');
    const rows = db
      .prepare(
        `SELECT * FROM orders
         WHERE lookup_token IN (${placeholders})
         ORDER BY created_at_ms DESC`,
      )
      .all(...tokens) as unknown as RawOrderRow[];

    res.json({
      ok: true,
      orders: hydrateOrders(rows, false),
    });
  });

  // Public Concierge Inquiry submission
  app.post('/api/inquiries', (req: Request, res: Response) => {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim();
    const topic = String(req.body?.topic ?? 'General Inquiry').trim();
    const message = String(req.body?.message ?? '').trim();

    if (!name || !email || !message) {
      res.status(400).json({ ok: false, error: 'Name, email, and message are required.' });
      return;
    }

    const id = `inq-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date();
    const createdAt = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    db.prepare(
      `INSERT INTO inquiries (id, name, email, topic, message, created_at, created_at_ms, resolved)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    ).run(id, name, email, topic, message, createdAt, now.getTime());

    checkpointDatabase();

    const inquiry: InquiryDto = {
      id,
      name,
      email,
      topic,
      message,
      createdAt,
      resolved: false,
    };

    broadcastToAdmins({ type: 'inquiry:created', inquiry });
    res.status(201).json({ ok: true, inquiry });
  });

  // Public Newsletter subscription
  app.post('/api/subscribers', (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@')) {
      res.status(400).json({ ok: false, error: 'Valid email is required.' });
      return;
    }

    db.prepare(`INSERT OR IGNORE INTO subscribers (email, created_at_ms) VALUES (?, ?)`).run(
      email,
      Date.now(),
    );
    checkpointDatabase();

    broadcastToAdmins({ type: 'subscriber:created', email });
    res.status(201).json({ ok: true });
  });

  // --------------------------------------------------------------------------
  // ADMIN AUTHENTICATION ENDPOINTS
  // --------------------------------------------------------------------------
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!email || !email.includes('@')) {
      res.status(400).json({
        ok: false,
        error: 'Please enter a valid Gmail or administrator email address.',
      });
      return;
    }

    if (!safeComparePassword(password, ADMIN_PASSWORD)) {
      res.status(401).json({
        ok: false,
        error: 'Incorrect administrator password.',
      });
      return;
    }

    const now = Date.now();
    db.prepare('DELETE FROM admin_sessions WHERE expires_at_ms <= ?').run(now);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256Hex(rawToken);
    const loggedInAt = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    db.prepare(
      `INSERT INTO admin_sessions (token_hash, email, logged_in_at, created_at_ms, expires_at_ms)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(tokenHash, email, loggedInAt, now, now + SESSION_TTL_MS);

    checkpointDatabase();

    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    );

    res.json({
      ok: true,
      token: rawToken,
      session: {
        email,
        loggedInAt,
      },
    });
  });

  app.get('/api/admin/session', requireAdminAuth, (req: Request, res: Response) => {
    const session = (req as Request & { adminSession: AuthenticatedAdmin }).adminSession;
    res.json({
      ok: true,
      session: {
        email: session.email,
        loggedInAt: session.loggedInAt,
      },
      unseenCount: getUnseenOrderCount(),
    });
  });

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    const rawToken = extractRawAdminToken(req);
    if (rawToken) {
      db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sha256Hex(rawToken));
      checkpointDatabase();
    }
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );
    res.json({ ok: true });
  });

  // --------------------------------------------------------------------------
  // PROTECTED ADMIN ORDERS, ANALYTICS, SHIPPING, COUPONS & BACKUPS
  // --------------------------------------------------------------------------
  app.get('/api/admin/dashboard-data', requireAdminAuth, (_req: Request, res: Response) => {
    const orders = getAllAdminOrders();
    const unseenCount = getUnseenOrderCount();
    res.json({
      ok: true,
      orders,
      unseenCount,
      inquiries: getAllInquiries(),
      subscribers: getAllSubscribers(),
      productOverrides: getProductOverridesMap(),
      shippingRates: getShippingRates(false),
      coupons: getAllCoupons(),
      reviewsByProduct: getReviewsGroupedByProduct(),
      analytics: computeSalesAnalytics(),
      backups: listBackups(),
    });
  });

  app.get('/api/admin/analytics', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({
      ok: true,
      analytics: computeSalesAnalytics(),
    });
  });

  app.get('/api/admin/orders', requireAdminAuth, (req: Request, res: Response) => {
    const orders = getAllAdminOrders({
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      orderId: typeof req.query.orderId === 'string' ? req.query.orderId : undefined,
      phone: typeof req.query.phone === 'string' ? req.query.phone : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      paymentStatus:
        typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus : undefined,
      onlyNew: req.query.onlyNew === 'true' || req.query.onlyNew === '1',
    });

    res.json({
      ok: true,
      orders,
      unseenCount: getUnseenOrderCount(),
    });
  });

  app.get('/api/admin/orders/:orderNumber', requireAdminAuth, (req: Request, res: Response) => {
    const orderNumber = String(req.params.orderNumber ?? '').trim();
    const order = getOrderByNumber(orderNumber, true);
    if (!order) {
      res.status(404).json({ ok: false, error: 'Order not found.' });
      return;
    }
    res.json({ ok: true, order });
  });

  app.post('/api/admin/orders/mark-all-seen', requireAdminAuth, (_req: Request, res: Response) => {
    const nowIso = new Date().toISOString();
    db.prepare(
      'UPDATE orders SET is_seen_by_admin = 1, updated_at_iso = ? WHERE is_seen_by_admin = 0',
    ).run(nowIso);
    checkpointDatabase();

    broadcastToAdmins({
      type: 'orders:marked-seen',
      unseenCount: 0,
    });

    res.json({
      ok: true,
      unseenCount: 0,
    });
  });

  app.patch('/api/admin/orders/:orderNumber', requireAdminAuth, (req: Request, res: Response) => {
    const orderNumber = String(req.params.orderNumber ?? '').trim();
    const existing = db
      .prepare('SELECT * FROM orders WHERE order_number = ?')
      .get(orderNumber) as unknown as RawOrderRow | undefined;

    if (!existing) {
      res.status(404).json({ ok: false, error: 'Order not found.' });
      return;
    }

    const body = req.body ?? {};
    const prevStatus = normalizeOrderStatus(existing.status);
    let nextStatus = prevStatus;
    let nextPaymentStatus = normalizePaymentStatus(existing.payment_status);
    let nextAdminNotes = existing.admin_notes ?? '';
    let nextSeen = existing.is_seen_by_admin;
    let nextStockDeducted = existing.stock_deducted ?? 1;

    if (typeof body.status === 'string') {
      const candidate = body.status === 'Dispatched' ? 'Shipped' : body.status;
      if (!VALID_ORDER_STATUSES.has(candidate as OrderStatus)) {
        res.status(400).json({ ok: false, error: `Invalid order status: ${body.status}` });
        return;
      }
      nextStatus = candidate as OrderStatus;
      nextSeen = 1;
    }

    if (typeof body.paymentStatus === 'string') {
      if (!VALID_PAYMENT_STATUSES.has(body.paymentStatus as PaymentStatus)) {
        res
          .status(400)
          .json({ ok: false, error: `Invalid payment status: ${body.paymentStatus}` });
        return;
      }
      nextPaymentStatus = body.paymentStatus as PaymentStatus;
      nextSeen = 1;
    }

    if (typeof body.adminNotes === 'string') {
      nextAdminNotes = body.adminNotes.slice(0, 2000);
    }

    if (typeof body.isSeenByAdmin === 'boolean') {
      nextSeen = body.isSeenByAdmin ? 1 : 0;
    }

    const updatedAtIso = new Date().toISOString();
    const nowMs = Date.now();

    db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      // Automatically restock inventory if transitioning into Cancelled
      if (nextStatus === 'Cancelled' && prevStatus !== 'Cancelled' && nextStockDeducted === 1) {
        const items = db
          .prepare('SELECT product_id, quantity FROM order_items WHERE order_number = ?')
          .all(orderNumber) as unknown as { product_id: string; quantity: number }[];

        for (const it of items) {
          const cur = db
            .prepare('SELECT stock_units FROM product_overrides WHERE product_id = ?')
            .get(it.product_id) as { stock_units: number | null } | undefined;
          const nextUnits = (cur?.stock_units ?? 0) + it.quantity;
          db.prepare(
            `UPDATE product_overrides SET stock_units = ?, in_stock = 1, updated_at_ms = ? WHERE product_id = ?`,
          ).run(nextUnits, nowMs, it.product_id);
        }
        nextStockDeducted = 0;
      } else if (
        prevStatus === 'Cancelled' &&
        nextStatus !== 'Cancelled' &&
        nextStockDeducted === 0
      ) {
        const items = db
          .prepare('SELECT product_id, quantity FROM order_items WHERE order_number = ?')
          .all(orderNumber) as unknown as { product_id: string; quantity: number }[];

        for (const it of items) {
          const cur = db
            .prepare('SELECT stock_units FROM product_overrides WHERE product_id = ?')
            .get(it.product_id) as { stock_units: number | null } | undefined;
          const nextUnits = Math.max(0, (cur?.stock_units ?? 48) - it.quantity);
          db.prepare(
            `UPDATE product_overrides SET stock_units = ?, in_stock = ?, updated_at_ms = ? WHERE product_id = ?`,
          ).run(nextUnits, nextUnits > 0 ? 1 : 0, nowMs, it.product_id);
        }
        nextStockDeducted = 1;
      }

      db.prepare(
        `UPDATE orders
         SET status = ?, payment_status = ?, admin_notes = ?, is_seen_by_admin = ?, stock_deducted = ?, updated_at_iso = ?
         WHERE order_number = ?`,
      ).run(
        nextStatus,
        nextPaymentStatus,
        nextAdminNotes,
        nextSeen,
        nextStockDeducted,
        updatedAtIso,
        orderNumber,
      );

      db.exec('COMMIT');
    } catch (txErr) {
      try {
        db.exec('ROLLBACK');
      } catch {}
      throw txErr;
    }

    checkpointDatabase();

    const updatedOrder = getOrderByNumber(orderNumber, true);
    const unseenCount = getUnseenOrderCount();
    const productOverrides = getProductOverridesMap();

    if (updatedOrder) {
      broadcastToAdmins({
        type: 'order:updated',
        order: updatedOrder,
        unseenCount,
        productOverrides,
      });
    }

    res.json({
      ok: true,
      order: updatedOrder,
      unseenCount,
      productOverrides,
    });
  });

  app.delete('/api/admin/orders/:orderNumber', requireAdminAuth, (req: Request, res: Response) => {
    const orderNumber = String(req.params.orderNumber ?? '').trim();
    const info = db.prepare('DELETE FROM orders WHERE order_number = ?').run(orderNumber);
    if (info.changes === 0) {
      res.status(404).json({ ok: false, error: 'Order not found.' });
      return;
    }

    checkpointDatabase();
    const unseenCount = getUnseenOrderCount();

    broadcastToAdmins({
      type: 'order:deleted',
      orderNumber,
      unseenCount,
    });

    res.json({
      ok: true,
      orderNumber,
      unseenCount,
    });
  });

  // Admin SSE stream fallback for real-time order alerts
  app.get('/api/admin/orders/stream', requireAdminAuth, (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const initPayload = JSON.stringify({
      type: 'init',
      orders: getAllAdminOrders(),
      unseenCount: getUnseenOrderCount(),
    });
    res.write(`data: ${initPayload}\n\n`);

    adminSseClients.add(res);
    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
        adminSseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      adminSseClients.delete(res);
    });
  });

  // Admin Product Inventory & Low-Stock Threshold Management
  app.patch('/api/admin/products/:productId', requireAdminAuth, (req: Request, res: Response) => {
    const productId = String(req.params.productId ?? '').trim();
    if (!productId) {
      res.status(400).json({ ok: false, error: 'Product ID required.' });
      return;
    }

    const currentMap = getProductOverridesMap();
    const merged: ProductOverrideDto = {
      price: 2500,
      stockUnits: 48,
      lowStockThreshold: 10,
      inStock: true,
      ...(currentMap[productId] ?? {}),
    };

    if (typeof req.body?.price === 'number' && req.body.price > 0) {
      merged.price = Math.round(req.body.price);
    }
    if (typeof req.body?.stockUnits === 'number' && req.body.stockUnits >= 0) {
      merged.stockUnits = Math.floor(req.body.stockUnits);
    }
    if (typeof req.body?.lowStockThreshold === 'number' && req.body.lowStockThreshold >= 0) {
      merged.lowStockThreshold = Math.floor(req.body.lowStockThreshold);
    }
    if (typeof req.body?.inStock === 'boolean') {
      merged.inStock = req.body.inStock;
    }
    if (typeof req.body?.isBestSeller === 'boolean') {
      merged.isBestSeller = req.body.isBestSeller;
    }
    if (typeof req.body?.isNewArrival === 'boolean') {
      merged.isNewArrival = req.body.isNewArrival;
    }

    db.prepare(
      `INSERT INTO product_overrides (
        product_id, price, stock_units, low_stock_threshold, in_stock, is_best_seller, is_new_arrival, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(product_id) DO UPDATE SET
        price = excluded.price,
        stock_units = excluded.stock_units,
        low_stock_threshold = excluded.low_stock_threshold,
        in_stock = excluded.in_stock,
        is_best_seller = excluded.is_best_seller,
        is_new_arrival = excluded.is_new_arrival,
        updated_at_ms = excluded.updated_at_ms`,
    ).run(
      productId,
      merged.price ?? 2500,
      merged.stockUnits ?? 48,
      merged.lowStockThreshold ?? 10,
      merged.inStock === undefined ? 1 : merged.inStock ? 1 : 0,
      merged.isBestSeller === undefined ? null : merged.isBestSeller ? 1 : 0,
      merged.isNewArrival === undefined ? null : merged.isNewArrival ? 1 : 0,
      Date.now(),
    );

    checkpointDatabase();
    const productOverrides = getProductOverridesMap();
    broadcastToAdmins({ type: 'products:updated', productOverrides });

    res.json({ ok: true, productOverrides });
  });

  app.post('/api/admin/products/reset', requireAdminAuth, (_req: Request, res: Response) => {
    db.exec('DELETE FROM product_overrides');
    seedInitialStoreConfiguration();
    const productOverrides = getProductOverridesMap();
    broadcastToAdmins({ type: 'products:updated', productOverrides });
    res.json({ ok: true, productOverrides });
  });

  // Admin City Shipping Rates Management
  app.post('/api/admin/shipping-rates', requireAdminAuth, (req: Request, res: Response) => {
    const rawCityName = String(req.body?.cityName ?? '').trim();
    const isDefault = req.body?.cityKey === '__default__';
    const cityKey = isDefault
      ? '__default__'
      : rawCityName.toLowerCase().replace(/\s+/g, ' ').trim();

    if (!cityKey || (!isDefault && !rawCityName)) {
      res.status(400).json({ ok: false, error: 'City name is required.' });
      return;
    }

    const cityName = isDefault ? 'Other Cities (Nationwide)' : rawCityName;
    const standardFee = Math.max(0, Math.round(Number(req.body?.standardFee) || 0));
    const expressFee = Math.max(0, Math.round(Number(req.body?.expressFee) || 0));
    const freeShippingThreshold = Math.max(
      0,
      Math.round(
        req.body?.freeShippingThreshold !== undefined
          ? Number(req.body.freeShippingThreshold)
          : 5000,
      ),
    );
    const estimatedDays =
      String(req.body?.estimatedDays ?? '2–4 Working Days').trim() || '2–4 Working Days';
    const active = req.body?.active === false ? 0 : 1;

    db.prepare(
      `INSERT INTO shipping_rates (
        city_key, city_name, standard_fee, express_fee, free_shipping_threshold, estimated_days, active, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(city_key) DO UPDATE SET
        city_name = excluded.city_name,
        standard_fee = excluded.standard_fee,
        express_fee = excluded.express_fee,
        free_shipping_threshold = excluded.free_shipping_threshold,
        estimated_days = excluded.estimated_days,
        active = excluded.active,
        updated_at_ms = excluded.updated_at_ms`,
    ).run(
      cityKey,
      cityName,
      standardFee,
      expressFee,
      freeShippingThreshold,
      estimatedDays,
      active,
      Date.now(),
    );

    checkpointDatabase();
    const shippingRates = getShippingRates(false);
    broadcastToAdmins({ type: 'shipping:updated', shippingRates });
    res.json({ ok: true, shippingRates });
  });

  app.delete(
    '/api/admin/shipping-rates/:cityKey',
    requireAdminAuth,
    (req: Request, res: Response) => {
      const cityKey = String(req.params.cityKey ?? '')
        .trim()
        .toLowerCase();
      if (cityKey === '__default__') {
        res.status(400).json({
          ok: false,
          error: 'The Nationwide fallback shipping rate cannot be deleted (you may edit its fee).',
        });
        return;
      }
      db.prepare('DELETE FROM shipping_rates WHERE city_key = ?').run(cityKey);
      checkpointDatabase();
      const shippingRates = getShippingRates(false);
      broadcastToAdmins({ type: 'shipping:updated', shippingRates });
      res.json({ ok: true, shippingRates });
    },
  );

  // Admin Discount & Coupon Management
  app.post('/api/admin/coupons', requireAdminAuth, (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');

    if (!code || code.length < 3) {
      res.status(400).json({
        ok: false,
        error: 'Coupon code must be at least 3 alphanumeric characters (e.g. EID20).',
      });
      return;
    }

    const discountType: DiscountType =
      req.body?.discountType === 'fixed' ? 'fixed' : 'percentage';
    const rawVal = Math.round(Number(req.body?.discountValue) || 0);
    if (rawVal <= 0 || (discountType === 'percentage' && rawVal > 90)) {
      res.status(400).json({
        ok: false,
        error:
          discountType === 'percentage'
            ? 'Percentage discount must be between 1% and 90%.'
            : 'Fixed discount must be greater than PKR 0.',
      });
      return;
    }

    const minOrderAmount = Math.max(0, Math.round(Number(req.body?.minOrderAmount) || 0));
    const maxUses =
      req.body?.maxUses === null || req.body?.maxUses === '' || req.body?.maxUses === undefined
        ? null
        : Math.max(1, Math.round(Number(req.body.maxUses)));
    const description =
      String(req.body?.description ?? '').trim() ||
      (discountType === 'percentage'
        ? `${rawVal}% Privilege Discount`
        : `PKR ${rawVal.toLocaleString('en-PK')} Off`);
    const active = req.body?.active === false ? 0 : 1;
    const expiresAtIso =
      typeof req.body?.expiresAtIso === 'string' && req.body.expiresAtIso.trim()
        ? req.body.expiresAtIso.trim()
        : null;

    db.prepare(
      `INSERT INTO coupons (
        code, discount_type, discount_value, min_order_amount, max_uses, used_count, description, active, expires_at_iso, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET
        discount_type = excluded.discount_type,
        discount_value = excluded.discount_value,
        min_order_amount = excluded.min_order_amount,
        max_uses = excluded.max_uses,
        description = excluded.description,
        active = excluded.active,
        expires_at_iso = excluded.expires_at_iso`,
    ).run(
      code,
      discountType,
      rawVal,
      minOrderAmount,
      maxUses,
      description,
      active,
      expiresAtIso,
      Date.now(),
    );

    checkpointDatabase();
    const coupons = getAllCoupons();
    broadcastToAdmins({ type: 'coupons:updated', coupons });
    res.json({ ok: true, coupons });
  });

  app.patch('/api/admin/coupons/:code', requireAdminAuth, (req: Request, res: Response) => {
    const code = String(req.params.code ?? '')
      .trim()
      .toUpperCase();
    const existing = db.prepare('SELECT active FROM coupons WHERE code = ?').get(code) as
      | { active: number }
      | undefined;

    if (!existing) {
      res.status(404).json({ ok: false, error: 'Coupon not found.' });
      return;
    }

    const nextActive =
      typeof req.body?.active === 'boolean'
        ? req.body.active
          ? 1
          : 0
        : existing.active === 1
          ? 0
          : 1;

    db.prepare('UPDATE coupons SET active = ? WHERE code = ?').run(nextActive, code);
    checkpointDatabase();
    const coupons = getAllCoupons();
    broadcastToAdmins({ type: 'coupons:updated', coupons });
    res.json({ ok: true, coupons });
  });

  app.delete('/api/admin/coupons/:code', requireAdminAuth, (req: Request, res: Response) => {
    const code = String(req.params.code ?? '')
      .trim()
      .toUpperCase();
    db.prepare('DELETE FROM coupons WHERE code = ?').run(code);
    checkpointDatabase();
    const coupons = getAllCoupons();
    broadcastToAdmins({ type: 'coupons:updated', coupons });
    res.json({ ok: true, coupons });
  });

  // Admin Review Moderation
  app.delete('/api/admin/reviews/:reviewId', requireAdminAuth, (req: Request, res: Response) => {
    const reviewId = String(req.params.reviewId ?? '').trim();
    db.prepare('DELETE FROM product_reviews WHERE id = ?').run(reviewId);
    checkpointDatabase();
    const reviewsByProduct = getReviewsGroupedByProduct();
    broadcastToAdmins({ type: 'reviews:updated', reviewsByProduct });
    res.json({ ok: true, reviewsByProduct });
  });

  // Admin Inquiry Resolution
  app.patch('/api/admin/inquiries/:id', requireAdminAuth, (req: Request, res: Response) => {
    const id = String(req.params.id ?? '').trim();
    const existing = db
      .prepare('SELECT resolved FROM inquiries WHERE id = ?')
      .get(id) as { resolved: number } | undefined;

    if (!existing) {
      res.status(404).json({ ok: false, error: 'Inquiry not found.' });
      return;
    }

    const nextResolved =
      typeof req.body?.resolved === 'boolean'
        ? req.body.resolved
          ? 1
          : 0
        : existing.resolved === 1
          ? 0
          : 1;

    db.prepare('UPDATE inquiries SET resolved = ? WHERE id = ?').run(nextResolved, id);
    checkpointDatabase();

    res.json({ ok: true, id, resolved: nextResolved === 1 });
  });

  // Admin Secure Database Backups (SQLite VACUUM INTO + Authenticated Download)
  app.get('/api/admin/backups', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({
      ok: true,
      backups: listBackups(),
    });
  });

  app.post('/api/admin/backups', requireAdminAuth, (_req: Request, res: Response) => {
    try {
      const created = createDatabaseBackup('admin');
      res.status(201).json({
        ok: true,
        backup: created,
        backups: listBackups(),
      });
    } catch (err) {
      console.error('Database backup error:', err);
      res.status(500).json({
        ok: false,
        error: 'Failed to create database snapshot.',
      });
    }
  });

  app.get('/api/admin/backups/export-json', requireAdminAuth, (_req: Request, res: Response) => {
    const payload = {
      exportedAtIso: new Date().toISOString(),
      orders: getAllAdminOrders(),
      productOverrides: getProductOverridesMap(),
      shippingRates: getShippingRates(false),
      coupons: getAllCoupons(),
      reviewsByProduct: getReviewsGroupedByProduct(),
      inquiries: getAllInquiries(),
      subscribers: getAllSubscribers(),
    };
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="norva_Backup_${stamp}.json"`,
    );
    res.send(JSON.stringify(payload, null, 2));
  });

  app.get(
    '/api/admin/backups/:filename/download',
    requireAdminAuth,
    (req: Request, res: Response) => {
      const safeName = path.basename(String(req.params.filename ?? ''));
      if (!/^norva_backup_[0-9_A-Za-z-]+\.sqlite$/.test(safeName)) {
        res.status(400).json({ ok: false, error: 'Invalid backup filename.' });
        return;
      }
      const fullPath = path.join(backupsDir, safeName);
      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ ok: false, error: 'Backup snapshot not found.' });
        return;
      }
      res.download(fullPath, safeName);
    },
  );

  // Catch-all for unknown /api routes
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: 'API endpoint not found.' });
  });

  // Global Unhandled Error Middleware (prevents raw stack leakage)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    if (res.headersSent) return;
    res.status(500).json({
      ok: false,
      error: 'An unexpected server error occurred. Please try again.',
    });
  });

  // --------------------------------------------------------------------------
  // VITE DEV MIDDLEWARE / PRODUCTION STATIC ASSETS
  // --------------------------------------------------------------------------
  const httpServer = createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATED ADMIN WEBSOCKET UPGRADE (/api/admin/ws)
  // --------------------------------------------------------------------------
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const host = request.headers.host || `localhost:${PORT}`;
      const parsedUrl = new URL(request.url || '/', `http://${host}`);

      if (parsedUrl.pathname !== '/api/admin/ws') {
        return;
      }

      const queryToken = parsedUrl.searchParams.get('token') ?? undefined;
      const rawToken = extractRawAdminToken(request, queryToken);
      const admin = verifyAdminToken(rawToken);

      if (!admin) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        adminWsClients.add(ws);

        ws.send(
          JSON.stringify({
            type: 'init',
            orders: getAllAdminOrders(),
            unseenCount: getUnseenOrderCount(),
          }),
        );

        ws.on('close', () => {
          adminWsClients.delete(ws);
        });

        ws.on('error', () => {
          adminWsClients.delete(ws);
        });
      });
    } catch {
      socket.destroy();
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`NORVA server listening on http://0.0.0.0:${PORT} (SQLite: ${dbFilePath})`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
