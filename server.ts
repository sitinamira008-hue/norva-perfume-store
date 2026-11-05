import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import bcrypt from 'bcryptjs';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';

import { initDatabase, type DatabaseAdapter } from './src/server/db';
import {
  initializeDatabaseSchema,
  seedInitialStoreConfiguration,
  migrateFromLegacySqliteIfEmpty,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_BCRYPT_HASH,
  CATALOG_DEFAULTS,
  DEFAULT_SHIPPING_RATES,
  DEFAULT_COUPONS,
} from './src/server/schema';

const PORT = Number(process.env.PORT || 3000);
const BCRYPT_ROUNDS = 12;

// Dummy bcrypt hash used when username is not found to prevent timing enumeration
const DUMMY_BCRYPT_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const ADMIN_COOKIE_NAME = 'norva_admin_token';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_FAILED_LOGIN_ATTEMPTS = 15;
const ACCOUNT_LOCKOUT_MS = 2 * 60 * 1000; // 2 minutes
const IP_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_IP_FAILED_ATTEMPTS = 25;
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
  username: string;
  email: string;
  loggedInAt: string;
}

interface AdminUserRow {
  username: string;
  password_hash: string;
  role: string;
  is_active: number | string;
  failed_attempts: number | string;
  locked_until_ms: number | string;
  created_at_iso: string;
  updated_at_iso: string;
  last_login_at_iso: string | null;
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
  created_at_ms: number | string;
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

function stripSurroundingQuotes(val: string): string {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function resolveBackupsDir(): string {
  const isServerless = Boolean(
    process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
  if (isServerless) {
    const tmpBk = path.join(os.tmpdir(), 'norva_backups');
    try {
      fs.mkdirSync(tmpBk, { recursive: true });
    } catch {}
    return tmpBk;
  }
  const localBk = path.resolve(process.cwd(), 'data/backups');
  try {
    fs.mkdirSync(localBk, { recursive: true });
  } catch {}
  return localBk;
}

const backupsDir = resolveBackupsDir();

let db!: DatabaseAdapter;
let dbInitPromise: Promise<void> | null = null;

export async function ensureDatabaseReady(): Promise<void> {
  if (db) return;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      db = await initDatabase();
      await initializeDatabaseSchema(db);
      await seedInitialStoreConfiguration(db);
      if (db.engine === 'postgres') {
        await migrateFromLegacySqliteIfEmpty(db);
      }
    })().catch((err) => {
      dbInitPromise = null;
      console.error('[NORVA DB] ensureDatabaseReady error:', err);
      throw err;
    });
  }
  await dbInitPromise;
}

// ============================================================================
// CRYPTO, PHONE VERIFICATION & AUTH HELPERS
// ============================================================================
function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeCompareSecret(candidate: string, expected: string): boolean {
  if (!candidate || !expected) return false;
  const a = Buffer.from(sha256Hex(candidate), 'hex');
  const b = Buffer.from(sha256Hex(expected), 'hex');
  return crypto.timingSafeEqual(a, b);
}

const ipFailedLogins = new Map<string, { count: number; resetAtMs: number }>();

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return (
    req.socket?.remoteAddress ||
    req.ip ||
    (req as unknown as { socket?: { remoteAddress?: string } })?.socket?.remoteAddress ||
    'unknown'
  );
}

function isIpRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipFailedLogins.get(ip);
  if (!entry) return false;
  if (now >= entry.resetAtMs) {
    ipFailedLogins.delete(ip);
    return false;
  }
  return entry.count >= MAX_IP_FAILED_ATTEMPTS;
}

function recordIpFailedAttempt(ip: string): void {
  const now = Date.now();
  const existing = ipFailedLogins.get(ip);
  if (!existing || now >= existing.resetAtMs) {
    ipFailedLogins.set(ip, { count: 1, resetAtMs: now + IP_RATE_WINDOW_MS });
  } else {
    existing.count += 1;
  }
}

function clearIpFailedAttempts(ip: string): void {
  ipFailedLogins.delete(ip);
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
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

function extractRawAdminToken(
  req: Request | IncomingMessage,
  queryToken?: string,
): string | null {
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

async function verifyAdminToken(rawToken: string | null): Promise<AuthenticatedAdmin | null> {
  if (!rawToken || rawToken.length < 16) return null;
  const tokenHash = sha256Hex(rawToken);
  const now = Date.now();

  const row = await db.queryOne<{
    token_hash: string;
    username: string;
    email: string;
    logged_in_at: string;
    expires_at_ms: number | string;
    is_active: number | string | null;
  }>(
    `SELECT s.token_hash, s.username, s.email, s.logged_in_at, s.expires_at_ms, u.is_active
     FROM admin_sessions s
     LEFT JOIN admin_users u ON u.username = s.username
     WHERE s.token_hash = ?`,
    [tokenHash],
  );

  if (!row) return null;
  if (Number(row.expires_at_ms) <= now || Number(row.is_active ?? 0) !== 1) {
    await db.execute('DELETE FROM admin_sessions WHERE token_hash = ?', [tokenHash]);
    return null;
  }

  const resolvedUsername = row.username || row.email;
  return {
    tokenHash: row.token_hash,
    username: resolvedUsername,
    email: resolvedUsername,
    loggedInAt: row.logged_in_at,
  };
}

async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const rawToken = extractRawAdminToken(req, queryToken);
    const session = await verifyAdminToken(rawToken);
    if (!session) {
      if (req.headers.cookie && req.headers.cookie.includes(ADMIN_COOKIE_NAME)) {
        const isHttps =
          req.secure ||
          req.headers['x-forwarded-proto'] === 'https' ||
          process.env.NODE_ENV === 'production';
        const cookiePolicy = isHttps ? 'Secure; SameSite=None' : 'SameSite=Lax';
        res.setHeader(
          'Set-Cookie',
          `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; ${cookiePolicy}; Max-Age=0`,
        );
      }
      res.status(401).json({
        ok: false,
        error: 'Administrator authentication required.',
      });
      return;
    }

    (req as unknown as { adminUser?: AuthenticatedAdmin }).adminUser = session;
    next();
  } catch (err) {
    console.error('[NORVA requireAdminAuth error]', err);
    res.status(500).json({ ok: false, error: 'Authentication verification error.' });
  }
}

function normalizeOrderStatus(raw: string): OrderStatus {
  if (VALID_ORDER_STATUSES.has(raw as OrderStatus)) {
    return raw as OrderStatus;
  }
  return 'Pending';
}

function normalizePaymentStatus(raw: string): PaymentStatus {
  if (VALID_PAYMENT_STATUSES.has(raw as PaymentStatus)) {
    return raw as PaymentStatus;
  }
  return 'Pending';
}

async function hydrateOrders(
  rows: RawOrderRow[],
  includeAdminFields: boolean,
): Promise<OrderDto[]> {
  if (rows.length === 0) return [];

  const orderNumbers = rows.map((r) => r.order_number);
  const placeholders = orderNumbers.map(() => '?').join(', ');
  const itemRows = await db.query<RawOrderItemRow>(
    `SELECT order_number, item_key, product_id, slug, name, concentration, image, size_label, size_sku, unit_price, quantity
     FROM order_items
     WHERE order_number IN (${placeholders})
     ORDER BY id ASC`,
    orderNumbers,
  );

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
      unitPrice: Number(item.unit_price),
      quantity: Number(item.quantity),
    });
    itemsByOrder.set(item.order_number, list);
  }

  return rows.map((row) => {
    const dto: OrderDto = {
      orderNumber: row.order_number,
      createdAt: row.created_at,
      createdAtIso: row.created_at_iso,
      createdAtMs: Number(row.created_at_ms),
      updatedAtIso: row.updated_at_iso,
      status: normalizeOrderStatus(row.status),
      paymentMethod: row.payment_method === 'invoice' ? 'invoice' : 'cod',
      paymentStatus: normalizePaymentStatus(row.payment_status),
      shippingSpeed: row.shipping_speed === 'express' ? 'express' : 'standard',
      subtotal: Number(row.subtotal),
      discountAmount: Number(row.discount_amount),
      shippingCost: Number(row.shipping_cost),
      total: Number(row.total),
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
      dto.isNew = Number(row.is_seen_by_admin) === 0;
      dto.adminNotes = row.admin_notes ?? '';
    }
    return dto;
  });
}

async function getOrderByNumber(
  orderNumber: string,
  includeAdminFields: boolean,
): Promise<OrderDto | null> {
  const row = await db.queryOne<RawOrderRow>(
    'SELECT * FROM orders WHERE UPPER(order_number) = UPPER(?)',
    [orderNumber.trim()],
  );
  if (!row) return null;
  const hydrated = await hydrateOrders([row], includeAdminFields);
  return hydrated[0] ?? null;
}

async function getUnseenOrderCount(): Promise<number> {
  const row = await db.queryOne<{ cnt: string | number }>(
    'SELECT COUNT(*) AS cnt FROM orders WHERE is_seen_by_admin = 0',
  );
  return Number(row?.cnt ?? 0);
}

async function getAllAdminOrders(filters?: {
  q?: string;
  orderId?: string;
  phone?: string;
  status?: string;
  paymentStatus?: string;
  onlyNew?: boolean;
}): Promise<OrderDto[]> {
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
  const rows = await db.query<RawOrderRow>(
    `SELECT * FROM orders ${whereSql} ORDER BY created_at_ms DESC`,
    params,
  );

  return hydrateOrders(rows, true);
}

async function getProductOverridesMap(): Promise<Record<string, ProductOverrideDto>> {
  const rows = await db.query<{
    product_id: string;
    price: number | null;
    stock_units: number | null;
    low_stock_threshold: number | null;
    in_stock: number | null;
    is_best_seller: number | null;
    is_new_arrival: number | null;
  }>('SELECT * FROM product_overrides');

  const out: Record<string, ProductOverrideDto> = {};
  for (const r of rows) {
    const ov: ProductOverrideDto = {};
    if (r.price !== null) ov.price = Number(r.price);
    if (r.stock_units !== null) ov.stockUnits = Number(r.stock_units);
    if (r.low_stock_threshold !== null) ov.lowStockThreshold = Number(r.low_stock_threshold);
    if (r.in_stock !== null) ov.inStock = Number(r.in_stock) === 1;
    if (r.is_best_seller !== null) ov.isBestSeller = Number(r.is_best_seller) === 1;
    if (r.is_new_arrival !== null) ov.isNewArrival = Number(r.is_new_arrival) === 1;
    out[r.product_id] = ov;
  }
  return out;
}

async function getShippingRates(onlyActive = false): Promise<ShippingRateDto[]> {
  const sql = onlyActive
    ? "SELECT * FROM shipping_rates WHERE active = 1 ORDER BY CASE WHEN city_key = '__default__' THEN 1 ELSE 0 END, city_name ASC"
    : "SELECT * FROM shipping_rates ORDER BY CASE WHEN city_key = '__default__' THEN 1 ELSE 0 END, city_name ASC";
  const rows = await db.query<{
    city_key: string;
    city_name: string;
    standard_fee: number;
    express_fee: number;
    free_shipping_threshold: number;
    estimated_days: string;
    active: number;
  }>(sql);

  return rows.map((r) => ({
    cityKey: r.city_key,
    cityName: r.city_name,
    standardFee: Number(r.standard_fee),
    expressFee: Number(r.express_fee),
    freeShippingThreshold: Number(r.free_shipping_threshold),
    estimatedDays: r.estimated_days,
    active: Number(r.active) === 1,
  }));
}

async function calculateShippingForCity(
  cityInput: string,
  shippingSpeed: 'standard' | 'express',
  subtotal: number,
): Promise<{ cost: number; matchedRate: ShippingRateDto }> {
  const normalizedCity = cityInput.trim().toLowerCase();
  const activeRates = await getShippingRates(true);

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

async function getAllCoupons(): Promise<CouponDto[]> {
  const rows = await db.query<{
    code: string;
    discount_type: string;
    discount_value: number;
    min_order_amount: number;
    max_uses: number | null;
    used_count: number;
    description: string;
    active: number;
    expires_at_iso: string | null;
  }>('SELECT * FROM coupons ORDER BY created_at_ms DESC');

  return rows.map((r) => ({
    code: r.code,
    discountType: r.discount_type === 'fixed' ? 'fixed' : 'percentage',
    discountValue: Number(r.discount_value),
    minOrderAmount: Number(r.min_order_amount),
    maxUses: r.max_uses !== null ? Number(r.max_uses) : null,
    usedCount: Number(r.used_count),
    description: r.description,
    active: Number(r.active) === 1,
    expiresAtIso: r.expires_at_iso,
  }));
}

async function evaluateCoupon(
  rawCode: string,
  subtotal: number,
): Promise<{ ok: true; coupon: CouponDto; discountAmount: number } | { ok: false; error: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { ok: false, error: 'Please enter a coupon code.' };
  }

  const row = await db.queryOne<{
    code: string;
    discount_type: string;
    discount_value: number;
    min_order_amount: number;
    max_uses: number | null;
    used_count: number;
    description: string;
    active: number;
    expires_at_iso: string | null;
  }>('SELECT * FROM coupons WHERE UPPER(code) = ?', [code]);

  if (!row) {
    return { ok: false, error: `Coupon code "${code}" was not recognized.` };
  }

  if (Number(row.active) !== 1) {
    return { ok: false, error: `Coupon code "${code}" is currently inactive.` };
  }

  if (row.expires_at_iso) {
    const expMs = Date.parse(row.expires_at_iso);
    if (!Number.isNaN(expMs) && expMs < Date.now()) {
      return { ok: false, error: `Coupon code "${code}" has expired.` };
    }
  }

  const maxUses = row.max_uses !== null ? Number(row.max_uses) : null;
  const usedCount = Number(row.used_count);
  if (maxUses !== null && usedCount >= maxUses) {
    return { ok: false, error: `Coupon code "${code}" has reached its redemption limit.` };
  }

  const minOrderAmount = Number(row.min_order_amount);
  if (subtotal < minOrderAmount) {
    return {
      ok: false,
      error: `Code "${code}" requires a minimum order subtotal of PKR ${minOrderAmount.toLocaleString('en-PK')}.`,
    };
  }

  const discountType: DiscountType = row.discount_type === 'fixed' ? 'fixed' : 'percentage';
  const discountVal = Number(row.discount_value);
  const rawDiscount =
    discountType === 'percentage'
      ? Math.round((subtotal * discountVal) / 100)
      : discountVal;
  const discountAmount = Math.max(0, Math.min(subtotal, rawDiscount));

  return {
    ok: true,
    coupon: {
      code: row.code,
      discountType,
      discountValue: discountVal,
      minOrderAmount,
      maxUses,
      usedCount,
      description: row.description,
      active: true,
      expiresAtIso: row.expires_at_iso,
    },
    discountAmount,
  };
}

async function getReviewsGroupedByProduct(): Promise<Record<string, ReviewDto[]>> {
  const rows = await db.query<{
    id: string;
    product_id: string;
    author: string;
    location: string;
    rating: number;
    title: string;
    comment: string;
    verified_purchase: number;
    date_label: string;
  }>('SELECT * FROM product_reviews ORDER BY created_at_ms DESC');

  const grouped: Record<string, ReviewDto[]> = {};
  for (const r of rows) {
    if (!grouped[r.product_id]) grouped[r.product_id] = [];
    grouped[r.product_id].push({
      id: r.id,
      productId: r.product_id,
      author: r.author,
      location: r.location,
      rating: Number(r.rating),
      title: r.title,
      comment: r.comment,
      date: r.date_label,
      verifiedPurchase: Number(r.verified_purchase) === 1,
    });
  }
  return grouped;
}

async function getAllInquiries(): Promise<InquiryDto[]> {
  const rows = await db.query<{
    id: string;
    name: string;
    email: string;
    topic: string;
    message: string;
    created_at: string;
    resolved: number;
  }>('SELECT * FROM inquiries ORDER BY created_at_ms DESC');

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    topic: r.topic,
    message: r.message,
    createdAt: r.created_at,
    resolved: Number(r.resolved) === 1,
  }));
}

async function getAllSubscribers(): Promise<string[]> {
  const rows = await db.query<{ email: string }>(
    'SELECT email FROM subscribers ORDER BY created_at_ms DESC',
  );
  return rows.map((r) => r.email);
}

async function computeSalesAnalytics() {
  const allOrders = await getAllAdminOrders();
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

  const revenueByPaymentMethod = { cod: 0, invoice: 0 };
  const ordersByStatus: Record<string, number> = {
    Pending: 0,
    Confirmed: 0,
    Processing: 0,
    Shipped: 0,
    Delivered: 0,
    Cancelled: 0,
  };
  const unitsByProduct: Record<string, number> = {};

  for (const o of allOrders) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
    if (o.status !== 'Cancelled') {
      revenueByPaymentMethod[o.paymentMethod] =
        (revenueByPaymentMethod[o.paymentMethod] || 0) + o.total;

      const dayKey = o.createdAtIso ? o.createdAtIso.slice(0, 10) : '';
      if (dayKey) {
        const existingDay = dailyMap.get(dayKey) ?? {
          date: dayKey,
          ordersCount: 0,
          unitsSold: 0,
          revenue: 0,
        };
        const orderUnits = o.items.reduce((s, it) => s + it.quantity, 0);
        existingDay.ordersCount += 1;
        existingDay.unitsSold += orderUnits;
        existingDay.revenue += o.total;
        dailyMap.set(dayKey, existingDay);
      }

      const monthKey = o.createdAtIso ? o.createdAtIso.slice(0, 7) : '';
      if (monthKey) {
        const existingMonth = monthlyMap.get(monthKey) ?? {
          month: monthKey,
          ordersCount: 0,
          unitsSold: 0,
          revenue: 0,
          avgOrderValue: 0,
        };
        const orderUnits = o.items.reduce((s, it) => s + it.quantity, 0);
        existingMonth.ordersCount += 1;
        existingMonth.unitsSold += orderUnits;
        existingMonth.revenue += o.total;
        monthlyMap.set(monthKey, existingMonth);
      }

      for (const it of o.items) {
        unitsByProduct[it.name] = (unitsByProduct[it.name] || 0) + it.quantity;
      }
    }
  }

  const dailyReport = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const monthlyReport = Array.from(monthlyMap.values())
    .map((m) => ({
      ...m,
      avgOrderValue: m.ordersCount > 0 ? Math.round(m.revenue / m.ordersCount) : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const topSellingFragrances = Object.entries(unitsByProduct)
    .map(([name, units]) => ({ name, units }))
    .sort((a, b) => b.units - a.units);

  return {
    grossRevenue,
    collectedRevenue,
    pendingCollectionRevenue,
    totalUnitsSold,
    totalDiscountsGiven,
    averageOrderValue,
    totalOrdersCount: allOrders.length,
    validOrdersCount: validOrders.length,
    cancelledOrdersCount: cancelledOrders.length,
    revenueByPaymentMethod,
    ordersByStatus,
    topSellingFragrances,
    dailyReport,
    monthlyReport,
    computedAtIso: new Date().toISOString(),
  };
}

function listBackups(): BackupDto[] {
  try {
    if (!fs.existsSync(backupsDir)) return [];
    return fs
      .readdirSync(backupsDir)
      .filter((f) => f.endsWith('.sqlite') || f.endsWith('.json'))
      .map((filename) => {
        const stat = fs.statSync(path.join(backupsDir, filename));
        return {
          filename,
          sizeBytes: stat.size,
          createdAtIso: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  } catch {
    return [];
  }
}

async function createDatabaseBackup(tag = 'manual'): Promise<BackupDto> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `norva_backup_${tag}_${timestamp}.json`;
  const targetPath = path.join(backupsDir, filename);

  const snapshot = {
    timestamp: new Date().toISOString(),
    engine: db.engine,
    orders: await db.query('SELECT * FROM orders'),
    orderItems: await db.query('SELECT * FROM order_items'),
    productOverrides: await db.query('SELECT * FROM product_overrides'),
    shippingRates: await db.query('SELECT * FROM shipping_rates'),
    coupons: await db.query('SELECT * FROM coupons'),
    productReviews: await db.query('SELECT * FROM product_reviews'),
    wishlists: await db.query('SELECT * FROM wishlists'),
    inquiries: await db.query('SELECT * FROM inquiries'),
    subscribers: await db.query('SELECT * FROM subscribers'),
  };

  fs.writeFileSync(targetPath, JSON.stringify(snapshot, null, 2), 'utf8');

  // Rotate old backups
  const existing = listBackups();
  if (existing.length > MAX_BACKUPS_RETAINED) {
    for (const b of existing.slice(MAX_BACKUPS_RETAINED)) {
      try {
        fs.unlinkSync(path.join(backupsDir, b.filename));
      } catch {}
    }
  }

  const stat = fs.statSync(targetPath);
  return {
    filename,
    sizeBytes: stat.size,
    createdAtIso: stat.mtime.toISOString(),
  };
}

async function generateUniqueOrderNumber(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `NV-${Math.floor(10000 + Math.random() * 90000)}`;
    const existing = await db.queryOne('SELECT 1 FROM orders WHERE order_number = ?', [candidate]);
    if (!existing) return candidate;
  }
  return `NV-${Date.now().toString().slice(-5)}`;
}

// Global active authenticated admin WebSocket clients for live broadcast
const adminWsClients = new Set<WebSocket>();

function broadcastToAdmins(eventPayload: Record<string, unknown>): void {
  const message = JSON.stringify(eventPayload);
  for (const client of adminWsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch {
        adminWsClients.delete(client);
      }
    }
  }
}

// ============================================================================
// EXPRESS APPLICATION FACTORY
// ============================================================================
export function createExpressApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');

  // Ensure pre-parsed bodies in serverless/Vercel request bridges do not stall body parsing
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      (req as unknown as { _body?: boolean })._body = true;
    }
    next();
  });

  // Lightweight built-in Gzip compression for JSON API payloads (> 1 KB) to speed up slow connections
  app.use((req: Request, res: Response, next: NextFunction) => {
    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    if (!/\bgzip\b/i.test(acceptEncoding) || req.path === '/api/admin/ws') {
      next();
      return;
    }
    const origJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const jsonStr = JSON.stringify(body);
      if (jsonStr.length < 1024 || res.headersSent) {
        return origJson(body);
      }
      try {
        const compressed = zlib.gzipSync(Buffer.from(jsonStr, 'utf8'), {
          level: zlib.constants.Z_BEST_SPEED,
        });
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Length', String(compressed.length));
        return res.send(compressed);
      } catch {
        return origJson(body);
      }
    }) as typeof res.json;
    next();
  });

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

  // Lightweight health probe for checkout keep-alive & deployment diagnostics
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      await ensureDatabaseReady();
      res.json({
        ok: true,
        status: 'ok',
        engine: db.engine,
        persistentStorage: db.isPersistent,
        connection: db.connectionInfo,
      });
    } catch (err) {
      console.error('[Health check DB error]', err);
      res.status(500).json({
        ok: false,
        error: 'Database initialization failed.',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Guarantee database & schema are ready before handling any /api route
  app.use('/api', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureDatabaseReady();
      next();
    } catch (err) {
      console.error('[NORVA DB initialization failure]:', err);
      res.status(500).json({
        ok: false,
        error: 'Unable to connect to the NORVA order database right now. Please check server logs and database configuration.',
      });
    }
  });

  // Graceful response for WebSocket endpoint when accessed via HTTP in serverless
  app.get('/api/admin/ws', (_req: Request, res: Response) => {
    res.status(426).json({
      ok: false,
      error: 'WebSocket connection not supported in serverless environment. Polling fallback is active.',
    });
  });

  // --------------------------------------------------------------------------
  // PUBLIC STOREFRONT ENDPOINTS (ZERO CUSTOMER PII EXPOSED)
  // --------------------------------------------------------------------------
  app.get('/api/storefront/bootstrap', async (req: Request, res: Response) => {
    try {
      const clientId =
        typeof req.query.clientId === 'string' ? req.query.clientId.trim() : '';
      let wishlist: string[] | undefined;
      if (clientId.length >= 8) {
        const rows = await db.query<{ product_id: string }>(
          'SELECT product_id FROM wishlists WHERE client_id = ? ORDER BY created_at_ms DESC',
          [clientId],
        );
        wishlist = rows.map((r) => r.product_id);
      }

      res.setHeader('Cache-Control', 'no-cache');
      res.json({
        ok: true,
        productOverrides: await getProductOverridesMap(),
        shippingRates: await getShippingRates(true),
        reviewsByProduct: await getReviewsGroupedByProduct(),
        ...(wishlist !== undefined ? { wishlist } : {}),
      });
    } catch (err) {
      console.error('[Storefront Bootstrap Error]', err);
      res.status(500).json({ ok: false, error: 'Failed to load storefront data.' });
    }
  });

  app.get('/api/shipping-rates', async (_req: Request, res: Response) => {
    res.json({
      ok: true,
      shippingRates: await getShippingRates(true),
    });
  });

  // Validate Discount / Coupon Code in Checkout
  app.post('/api/coupons/validate', async (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '');
    const subtotal = Math.max(0, Math.round(Number(req.body?.subtotal) || 0));
    const evaluation = await evaluateCoupon(code, subtotal);
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
  app.get('/api/wishlist/:clientId', async (req: Request, res: Response) => {
    const clientId = String(req.params.clientId ?? '').trim();
    if (!clientId || clientId.length < 8) {
      res.json({ ok: true, wishlist: [] });
      return;
    }
    const rows = await db.query<{ product_id: string }>(
      'SELECT product_id FROM wishlists WHERE client_id = ? ORDER BY created_at_ms DESC',
      [clientId],
    );
    res.json({
      ok: true,
      wishlist: rows.map((r) => r.product_id),
    });
  });

  app.post('/api/wishlist/:clientId/toggle', async (req: Request, res: Response) => {
    const clientId = String(req.params.clientId ?? '').trim();
    const productId = String(req.body?.productId ?? '').trim();
    if (!clientId || clientId.length < 8 || !productId) {
      res.status(400).json({ ok: false, error: 'Valid clientId and productId required.' });
      return;
    }

    const existing = await db.queryOne(
      'SELECT 1 FROM wishlists WHERE client_id = ? AND product_id = ?',
      [clientId, productId],
    );

    if (existing) {
      await db.execute('DELETE FROM wishlists WHERE client_id = ? AND product_id = ?', [
        clientId,
        productId,
      ]);
    } else {
      await db.execute(
        'INSERT INTO wishlists (client_id, product_id, created_at_ms) VALUES (?, ?, ?)',
        [clientId, productId, Date.now()],
      );
    }

    const rows = await db.query<{ product_id: string }>(
      'SELECT product_id FROM wishlists WHERE client_id = ? ORDER BY created_at_ms DESC',
      [clientId],
    );

    res.json({
      ok: true,
      saved: !existing,
      wishlist: rows.map((r) => r.product_id),
    });
  });

  // Persistent Product Reviews
  app.get('/api/reviews', async (_req: Request, res: Response) => {
    res.json({
      ok: true,
      reviewsByProduct: await getReviewsGroupedByProduct(),
    });
  });

  app.post('/api/products/:productId/reviews', async (req: Request, res: Response) => {
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
      const ordMatch = await db.queryOne(
        "SELECT 1 FROM orders WHERE UPPER(order_number) = ? AND status != 'Cancelled'",
        [orderNumber],
      );
      if (ordMatch) verifiedPurchase = 1;
    }

    const id = `rev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const dateLabel = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    await db.execute(
      `INSERT INTO product_reviews (
        id, product_id, author, location, rating, title, comment, verified_purchase, date_label, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
    );

    const reviewPayload = {
      id,
      productId,
      author,
      location,
      rating,
      title,
      comment,
      verifiedPurchase: verifiedPurchase === 1,
      date: dateLabel,
    };

    broadcastToAdmins({
      type: 'review:created',
      review: reviewPayload,
    });

    res.status(201).json({
      ok: true,
      review: reviewPayload,
    });
  });

  // Customer Order Tracking with Phone Verification
  app.post('/api/orders/track', async (req: Request, res: Response) => {
    try {
      const orderNumber = String(req.body?.orderNumber ?? '').trim().toUpperCase();
      const phoneInput = String(req.body?.phone ?? '').trim();

      if (!orderNumber || !phoneInput) {
        res.status(400).json({
          ok: false,
          error: 'Please enter both your order number and phone number.',
        });
        return;
      }

      const row = await db.queryOne<RawOrderRow>(
        'SELECT * FROM orders WHERE UPPER(order_number) = ?',
        [orderNumber],
      );

      if (!row) {
        res.status(404).json({
          ok: false,
          error: `Order "${orderNumber}" was not found. Please double-check the order ID from your confirmation receipt.`,
        });
        return;
      }

      const phoneMatches = phonesMatchForVerification(
        row.customer_phone_digits || row.customer_phone,
        phoneInput,
      );

      if (!phoneMatches) {
        res.status(403).json({
          ok: false,
          error:
            'The phone number entered does not match the delivery contact on this order.',
        });
        return;
      }

      const hydrated = await hydrateOrders([row], false);
      res.json({
        ok: true,
        order: hydrated[0],
      });
    } catch (err) {
      console.error('[Track Order Error]', err);
      res.status(500).json({ ok: false, error: 'Unable to track order right now.' });
    }
  });

  // Client Concierge Inquiry Submission
  app.post('/api/inquiries', async (req: Request, res: Response) => {
    const name = String(req.body?.name ?? '').trim().slice(0, 100);
    const email = String(req.body?.email ?? '').trim().toLowerCase().slice(0, 150);
    const topic = String(req.body?.topic ?? '').trim().slice(0, 100) || 'General Inquiry';
    const message = String(req.body?.message ?? '').trim().slice(0, 2000);

    if (!name || !email || !message) {
      res.status(400).json({
        ok: false,
        error: 'Please enter your name, email, and message.',
      });
      return;
    }

    const id = `inq-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = Date.now();
    const createdAt = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    await db.execute(
      'INSERT INTO inquiries (id, name, email, topic, message, created_at, created_at_ms, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
      [id, name, email, topic, message, createdAt, now],
    );

    const inquiryPayload = {
      id,
      name,
      email,
      topic,
      message,
      createdAt,
      resolved: false,
    };

    broadcastToAdmins({
      type: 'inquiry:created',
      inquiry: inquiryPayload,
    });

    res.status(201).json({
      ok: true,
      inquiry: inquiryPayload,
    });
  });

  // Newsletter Subscription
  app.post('/api/newsletter/subscribe', async (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
      return;
    }
    await db.execute(
      'INSERT OR IGNORE INTO subscribers (email, created_at_ms) VALUES (?, ?)',
      [email, Date.now()],
    );
    broadcastToAdmins({
      type: 'subscriber:created',
      email,
    });
    res.json({ ok: true, message: 'Welcome to the NORVA private circle.' });
  });

  // --------------------------------------------------------------------------
  // PERSISTENT ORDER SUBMISSION WITH DUPLICATE PROTECTION & STOCK CHECK
  // --------------------------------------------------------------------------
  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const idempotencyKey =
        typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length >= 8
          ? body.idempotencyKey.trim()
          : null;

      // 1. Check Idempotency Key
      if (idempotencyKey) {
        const existingByKey = await db.queryOne<RawOrderRow>(
          'SELECT * FROM orders WHERE idempotency_key = ?',
          [idempotencyKey],
        );
        if (existingByKey) {
          const hydrated = await hydrateOrders([existingByKey], false);
          res.status(200).json({
            ok: true,
            order: hydrated[0],
            lookupToken: existingByKey.lookup_token,
            duplicatePrevented: true,
          });
          return;
        }
      }

      // 2. Validate Customer Details
      const rawCustomer = body.customer ?? {};
      const fullName = String(rawCustomer.fullName ?? '').trim();
      const phone = String(rawCustomer.phone ?? '').trim();
      const phoneDigits = normalizePhoneDigits(phone);
      const email = String(rawCustomer.email ?? '').trim().toLowerCase();
      const address = String(rawCustomer.address ?? rawCustomer.addressLine1 ?? '').trim();
      const city = String(rawCustomer.city ?? '').trim();
      const postalCode = String(rawCustomer.postalCode ?? '').trim();
      const country = String(rawCustomer.country ?? 'Pakistan').trim();
      const giftNote = String(rawCustomer.notes ?? body.giftNote ?? '').trim().slice(0, 500);

      if (!fullName || fullName.length < 2) {
        res.status(400).json({
          ok: false,
          error: 'Please enter your full recipient name for delivery.',
        });
        return;
      }

      if (!phone || phoneDigits.length < 10) {
        res.status(400).json({
          ok: false,
          error:
            'Please enter a valid Pakistani phone number (e.g. 0300-1234567) so the courier can contact you.',
        });
        return;
      }

      if (!address || address.length < 5) {
        res.status(400).json({
          ok: false,
          error: 'Please enter your complete street and house delivery address.',
        });
        return;
      }

      if (!city || city.length < 2) {
        res.status(400).json({
          ok: false,
          error: 'Please enter or select your delivery city.',
        });
        return;
      }

      // 3. Validate Cart Items Against Catalog
      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0) {
        res.status(400).json({
          ok: false,
          error: 'Your shopping bag is empty. Please select a fragrance to place an order.',
        });
        return;
      }

      const overrides = await getProductOverridesMap();
      const catalogById = new Map(CATALOG_DEFAULTS.map((c) => [c.id, c]));

      const sanitizedItems: OrderItemRecord[] = [];
      const qtyByProductId = new Map<string, { qty: number; name: string }>();

      for (const raw of rawItems) {
        if (!raw || typeof raw !== 'object') {
          res.status(400).json({
            ok: false,
            error: 'Invalid item format in shopping bag. Please refresh and try again.',
          });
          return;
        }
        const productId = String(raw.productId ?? '').trim();
        const catalogProduct = catalogById.get(productId);
        if (!catalogProduct) {
          res.status(400).json({
            ok: false,
            error:
              'One or more items in your bag are out of date. Please clear your bag, re-add your fragrance, and confirm again.',
          });
          return;
        }

        const parsedQty = Number(raw.quantity);
        if (!Number.isFinite(parsedQty) || Math.floor(parsedQty) < 1 || Math.floor(parsedQty) > 99) {
          res.status(400).json({
            ok: false,
            error: `Invalid quantity for ${catalogProduct.name}. Please choose between 1 and 99 flacons.`,
          });
          return;
        }

        const quantity = Math.floor(parsedQty);
        const unitPrice = overrides[productId]?.price ?? catalogProduct.defaultPrice;
        const key = String(raw.key || `${productId}__NV-50`);
        const sizeLabel = String(raw.sizeLabel || '50ml');
        const sizeSku = String(raw.sizeSku || 'NV-50');
        const concentration = String(raw.concentration || 'Extrait de Parfum');
        const image = typeof raw.image === 'string' && raw.image.length <= 2048 ? raw.image : '';

        sanitizedItems.push({
          key,
          productId,
          slug: String(raw.slug || productId),
          name: catalogProduct.name,
          concentration,
          image,
          sizeLabel,
          sizeSku,
          unitPrice,
          quantity,
        });

        const currentAgg = qtyByProductId.get(productId) ?? { qty: 0, name: catalogProduct.name };
        currentAgg.qty += quantity;
        qtyByProductId.set(productId, currentAgg);
      }

      // 4. Server-Side Totals Computation
      const subtotal = sanitizedItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
      const shippingSpeed = body.shippingSpeed === 'express' ? 'express' : 'standard';
      const shippingCalc = await calculateShippingForCity(city, shippingSpeed, subtotal);
      const shippingCost = shippingCalc.cost;

      let discountAmount = 0;
      let couponCode: string | null = null;
      if (typeof body.couponCode === 'string' && body.couponCode.trim()) {
        const evalResult = await evaluateCoupon(body.couponCode, subtotal);
        if (evalResult.ok) {
          discountAmount = evalResult.discountAmount;
          couponCode = evalResult.coupon.code;
        }
      }

      const total = Math.max(0, subtotal - discountAmount + shippingCost);
      const paymentMethod = body.paymentMethod === 'invoice' ? 'invoice' : 'cod';

      // 5. Short-window anti-spam fingerprinting
      const fingerprintHash = sha256Hex(
        `${phoneDigits}::${city.toLowerCase()}::${subtotal}::${sanitizedItems
          .map((i) => `${i.productId}:${i.quantity}`)
          .sort()
          .join('|')}`,
      );
      const now = Date.now();
      const recentDup = await db.queryOne<RawOrderRow>(
        'SELECT * FROM orders WHERE fingerprint_hash = ? AND created_at_ms >= ? ORDER BY created_at_ms DESC',
        [fingerprintHash, now - DUPLICATE_ORDER_WINDOW_MS],
      );

      if (recentDup) {
        const hydrated = await hydrateOrders([recentDup], false);
        res.status(200).json({
          ok: true,
          order: hydrated[0],
          lookupToken: recentDup.lookup_token,
          duplicatePrevented: true,
        });
        return;
      }

      // 6. Generate IDs
      const orderNumber = await generateUniqueOrderNumber();
      const lookupToken = `tok_${crypto.randomBytes(16).toString('hex')}`;
      const createdAtMs = now;
      const createdAtIso = new Date(now).toISOString();
      const createdAt = new Date(now).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // 7. Atomic Transaction: Stock check, stock deduction, coupon count increment, and order insertion
      await db.transaction(async (tx) => {
        // Stock Verification & Deduction
        for (const [prodId, reqInfo] of qtyByProductId.entries()) {
          const stockRow = await tx.queryOne<{ stock_units: number | null; in_stock: number | null }>(
            'SELECT stock_units, in_stock FROM product_overrides WHERE product_id = ?',
            [prodId],
          );

          const availableUnits = stockRow?.stock_units !== null && stockRow?.stock_units !== undefined
            ? Number(stockRow.stock_units)
            : 48;
          const isAvailable =
            stockRow?.in_stock === null || stockRow?.in_stock === undefined
              ? true
              : Number(stockRow.in_stock) === 1;

          if (!isAvailable || availableUnits <= 0) {
            throw new Error(`${reqInfo.name} is currently out of stock.`);
          }

          if (availableUnits < reqInfo.qty) {
            throw new Error(
              `Only ${availableUnits} flacon(s) of ${reqInfo.name} remain in stock. Please adjust your bag quantity.`,
            );
          }

          const nextUnits = availableUnits - reqInfo.qty;
          const nextInStock = nextUnits > 0 ? 1 : 0;

          await tx.execute(
            `INSERT INTO product_overrides (product_id, stock_units, in_stock, updated_at_ms)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(product_id) DO UPDATE SET
               stock_units = EXCLUDED.stock_units,
               in_stock = EXCLUDED.in_stock,
               updated_at_ms = EXCLUDED.updated_at_ms`,
            [prodId, nextUnits, nextInStock, createdAtMs],
          );
        }

        // Coupon Usage Increment
        if (couponCode) {
          await tx.execute('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', [
            couponCode,
          ]);
        }

        await tx.execute(
          `INSERT INTO orders (
            order_number, lookup_token, idempotency_key, fingerprint_hash, stock_deducted,
            status, payment_method, payment_status,
            shipping_speed, subtotal, discount_amount, shipping_cost, total,
            coupon_code, gift_note, admin_notes,
            customer_full_name, customer_email, customer_phone, customer_phone_digits,
            customer_address, customer_city, customer_postal_code, customer_country,
            is_seen_by_admin, created_at, created_at_iso, created_at_ms, updated_at_iso
          ) VALUES (?, ?, ?, ?, 1, 'Pending', ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [
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
          ],
        );

        for (const item of sanitizedItems) {
          await tx.execute(
            `INSERT INTO order_items (
              order_number, item_key, product_id, slug, name, concentration,
              image, size_label, size_sku, unit_price, quantity
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
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
            ],
          );
        }
      });

      const adminOrder = await getOrderByNumber(orderNumber, true);
      const buyerOrder = await getOrderByNumber(orderNumber, false);

      if (adminOrder) {
        broadcastToAdmins({
          type: 'order:created',
          order: adminOrder,
          unseenCount: await getUnseenOrderCount(),
          productOverrides: await getProductOverridesMap(),
          coupons: await getAllCoupons(),
        });
      }

      res.status(201).json({
        ok: true,
        order: buyerOrder ?? adminOrder,
        lookupToken,
        productOverrides: await getProductOverridesMap(),
      });
    } catch (err) {
      console.error('[Order Placement Error]', err);
      const msg = err instanceof Error ? err.message : 'Unable to complete order placement.';
      const statusCode = msg.includes('stock') ? 409 : 500;
      res.status(statusCode).json({
        ok: false,
        error: msg,
      });
    }
  });

  // --------------------------------------------------------------------------
  // AUTHENTICATED ADMIN API ENDPOINTS
  // --------------------------------------------------------------------------
  app.get('/api/admin/auth-status', async (_req: Request, res: Response) => {
    try {
      const ownerCountRow = await db.queryOne<{ cnt: string | number }>(
        "SELECT COUNT(*) AS cnt FROM admin_users WHERE role = 'owner' AND is_active = 1",
      );
      const isOwnerActive = Number(ownerCountRow?.cnt ?? 0) > 0;
      res.json({
        ok: true,
        isConfigured: isOwnerActive,
        setupTokenRequired: !isOwnerActive,
      });
    } catch (err) {
      console.error('[Admin Auth Status Error]', err);
      res.status(500).json({ ok: false, error: 'Database check failed.' });
    }
  });

  // Server-side bcrypt login with safe IP rate limiting & per-account brute-force lockout
  app.post('/api/admin/login', async (req: Request, res: Response) => {
    try {
      const clientIp = getClientIp(req);
      if (isIpRateLimited(clientIp)) {
        res.status(429).json({
          ok: false,
          error:
            'Too many failed sign-in attempts from this network. Please wait 10 minutes before retrying.',
        });
        return;
      }

      const rawIdentifier = String(req.body?.username ?? req.body?.email ?? '')
        .trim()
        .toLowerCase()
        .replace(/^@+/, '');
      const rawPassword = String(req.body?.password ?? '');

      if (!rawIdentifier || !rawPassword) {
        res.status(400).json({
          ok: false,
          error: 'Please enter both your admin username and password.',
        });
        return;
      }

      const userRow = await db.queryOne<AdminUserRow>(
        'SELECT * FROM admin_users WHERE LOWER(username) = ?',
        [rawIdentifier],
      );

      const now = Date.now();
      const lockedUntil = Number(userRow?.locked_until_ms || 0);
      if (userRow && lockedUntil > now) {
        const minsLeft = Math.max(1, Math.ceil((lockedUntil - now) / 60000));
        res.status(429).json({
          ok: false,
          error: `Account temporarily locked after repeated failed attempts. Try again in ${minsLeft} minute(s).`,
        });
        return;
      }

      const targetHash = userRow ? userRow.password_hash : DUMMY_BCRYPT_HASH;
      let passwordValid = await bcrypt.compare(rawPassword, targetHash);

      // Handle accidental mobile keyboard trailing space or mobile first-character auto-capitalization
      if (!passwordValid && userRow) {
        const trimmedPwd = rawPassword.trim();
        if (trimmedPwd && trimmedPwd !== rawPassword) {
          passwordValid = await bcrypt.compare(trimmedPwd, targetHash);
        }
        if (
          !passwordValid &&
          trimmedPwd.length >= 2 &&
          trimmedPwd[0] !== trimmedPwd[0].toLowerCase()
        ) {
          const uncapitalizedFirst = trimmedPwd[0].toLowerCase() + trimmedPwd.slice(1);
          passwordValid = await bcrypt.compare(uncapitalizedFirst, targetHash);
        }
      }

      if (!userRow || !passwordValid) {
        recordIpFailedAttempt(clientIp);
        if (userRow) {
          const nextFailures = (Number(userRow.failed_attempts) || 0) + 1;
          const nextLockUntil =
            nextFailures >= MAX_FAILED_LOGIN_ATTEMPTS ? now + ACCOUNT_LOCKOUT_MS : 0;
          await db.execute(
            `UPDATE admin_users
             SET failed_attempts = ?, locked_until_ms = ?, updated_at_iso = ?
             WHERE username = ?`,
            [
              nextFailures >= MAX_FAILED_LOGIN_ATTEMPTS ? 0 : nextFailures,
              nextLockUntil,
              new Date(now).toISOString(),
              userRow.username,
            ],
          );
        }
        res.status(401).json({
          ok: false,
          error: 'Invalid administrator username or password.',
        });
        return;
      }

      if (Number(userRow.is_active) !== 1) {
        res.status(403).json({
          ok: false,
          error: 'Administrator account is inactive and requires server-side activation.',
        });
        return;
      }

      // Reset failure counters and record login timestamp
      clearIpFailedAttempts(clientIp);
      const nowIso = new Date(now).toISOString();
      await db.execute(
        `UPDATE admin_users
         SET failed_attempts = 0, locked_until_ms = 0, last_login_at_iso = ?, updated_at_iso = ?
         WHERE username = ?`,
        [nowIso, nowIso, userRow.username],
      );

      await db.execute('DELETE FROM admin_sessions WHERE expires_at_ms <= ?', [now]);

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = sha256Hex(rawToken);
      const loggedInAt = new Date(now).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      await db.execute(
        `INSERT INTO admin_sessions (token_hash, username, email, logged_in_at, created_at_ms, expires_at_ms)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tokenHash, userRow.username, userRow.username, loggedInAt, now, now + SESSION_TTL_MS],
      );

      const isHttps =
        req.secure ||
        req.headers['x-forwarded-proto'] === 'https' ||
        process.env.NODE_ENV === 'production';
      const cookiePolicy = isHttps ? 'Secure; SameSite=None' : 'SameSite=Lax';
      res.setHeader(
        'Set-Cookie',
        `${ADMIN_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; ${cookiePolicy}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
      );

      res.json({
        ok: true,
        token: rawToken,
        session: {
          username: userRow.username,
          email: userRow.username,
          loggedInAt,
        },
      });
    } catch (err) {
      console.error(
        '[NORVA Admin Login Exception]',
        err instanceof Error ? err.stack || err.message : err,
      );
      res.status(500).json({
        ok: false,
        error:
          'Backend authentication error occurred. Please verify database connection and credentials in Vercel settings.',
      });
    }
  });

  // One-time / Secret-Gated Admin Account Activation & Credential Provisioning
  app.post('/api/admin/activate', async (req: Request, res: Response) => {
    try {
      const configuredSetupToken = stripSurroundingQuotes(process.env.ADMIN_SETUP_TOKEN || '');
      if (!configuredSetupToken || configuredSetupToken.length < 8) {
        res.status(403).json({
          ok: false,
          error:
            'ADMIN_SETUP_TOKEN is not configured on this server. Configure ADMIN_SETUP_TOKEN in Vercel environment variables to use activation.',
        });
        return;
      }

      const providedToken = String(req.body?.setupToken ?? '').trim();
      if (!safeCompareSecret(providedToken, configuredSetupToken)) {
        res.status(403).json({
          ok: false,
          error: 'Invalid setup token.',
        });
        return;
      }

      const rawUsername = String(req.body?.username ?? '').trim().toLowerCase().replace(/^@+/, '');
      const rawPassword = String(req.body?.password ?? '');

      if (!rawUsername || rawUsername.length < 3) {
        res.status(400).json({
          ok: false,
          error: 'Username must be at least 3 characters.',
        });
        return;
      }

      if (!rawPassword || rawPassword.length < 6) {
        res.status(400).json({
          ok: false,
          error: 'Password must be at least 6 characters.',
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const passwordHash = bcrypt.hashSync(rawPassword, BCRYPT_ROUNDS);

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
        [rawUsername, passwordHash, nowIso, nowIso],
      );

      // Invalidate existing sessions on password reset
      await db.execute('DELETE FROM admin_sessions');

      res.json({
        ok: true,
        message: `Admin account "${rawUsername}" successfully activated. You can now sign in.`,
      });
    } catch (err) {
      console.error('[Admin Activation Error]', err);
      res.status(500).json({ ok: false, error: 'Failed to activate administrator account.' });
    }
  });

  // Authenticated Admin Password Change
  app.post(
    '/api/admin/change-password',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const admin = (req as unknown as { adminUser: AuthenticatedAdmin }).adminUser;
        const currentPassword = String(req.body?.currentPassword ?? '');
        const newPassword = String(req.body?.newPassword ?? '');

        if (!currentPassword || !newPassword) {
          res.status(400).json({
            ok: false,
            error: 'Please provide both your current and new password.',
          });
          return;
        }

        if (newPassword.length < 6) {
          res.status(400).json({
            ok: false,
            error: 'New password must be at least 6 characters long.',
          });
          return;
        }

        const userRow = await db.queryOne<AdminUserRow>(
          'SELECT * FROM admin_users WHERE username = ?',
          [admin.username],
        );

        if (!userRow) {
          res.status(404).json({ ok: false, error: 'Administrator record not found.' });
          return;
        }

        const isValid = await bcrypt.compare(currentPassword, userRow.password_hash);
        if (!isValid) {
          res.status(401).json({ ok: false, error: 'Current password is not correct.' });
          return;
        }

        const nowIso = new Date().toISOString();
        const newHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);

        await db.execute(
          'UPDATE admin_users SET password_hash = ?, failed_attempts = 0, locked_until_ms = 0, updated_at_iso = ? WHERE username = ?',
          [newHash, nowIso, admin.username],
        );

        // Keep current session valid, invalidate all other concurrent sessions
        await db.execute(
          'DELETE FROM admin_sessions WHERE username = ? AND token_hash != ?',
          [admin.username, admin.tokenHash],
        );

        res.json({ ok: true, message: 'Password updated successfully.' });
      } catch (err) {
        console.error('[Change Password Error]', err);
        res.status(500).json({ ok: false, error: 'Failed to update administrator password.' });
      }
    },
  );

  // Authenticated Admin Session Probe
  app.get('/api/admin/session', requireAdminAuth, async (req: Request, res: Response) => {
    const admin = (req as unknown as { adminUser: AuthenticatedAdmin }).adminUser;
    const unseen = await getUnseenOrderCount();
    res.json({
      ok: true,
      session: {
        username: admin.username,
        email: admin.email,
        loggedInAt: admin.loggedInAt,
      },
      unseenCount: unseen,
    });
  });

  // Admin Logout
  app.post('/api/admin/logout', async (req: Request, res: Response) => {
    const rawToken = extractRawAdminToken(req);
    if (rawToken) {
      await db.execute('DELETE FROM admin_sessions WHERE token_hash = ?', [sha256Hex(rawToken)]);
    }

    const isHttps =
      req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      process.env.NODE_ENV === 'production';
    const cookiePolicy = isHttps ? 'Secure; SameSite=None' : 'SameSite=Lax';
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; ${cookiePolicy}; Max-Age=0`,
    );

    res.json({ ok: true });
  });

  // Authenticated Admin Dashboard Bootstrapping Data
  app.get(
    '/api/admin/dashboard-data',
    requireAdminAuth,
    async (_req: Request, res: Response) => {
      try {
        const [
          orders,
          unseenCount,
          inquiries,
          subscribers,
          productOverrides,
          shippingRates,
          coupons,
          reviewsByProduct,
          analytics,
        ] = await Promise.all([
          getAllAdminOrders(),
          getUnseenOrderCount(),
          getAllInquiries(),
          getAllSubscribers(),
          getProductOverridesMap(),
          getShippingRates(false),
          getAllCoupons(),
          getReviewsGroupedByProduct(),
          computeSalesAnalytics(),
        ]);

        res.setHeader('Cache-Control', 'no-cache');
        res.json({
          ok: true,
          orders,
          unseenCount,
          inquiries,
          subscribers,
          productOverrides,
          shippingRates,
          coupons,
          reviewsByProduct,
          analytics,
          backups: listBackups(),
          database: {
            engine: db.engine,
            persistent: db.isPersistent,
            connection: db.connectionInfo,
          },
        });
      } catch (err) {
        console.error('[Dashboard Data Error]', err);
        res.status(500).json({ ok: false, error: 'Failed to fetch dashboard data.' });
      }
    },
  );

  // Authenticated Sales Analytics Endpoint
  app.get('/api/admin/analytics', requireAdminAuth, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        analytics: await computeSalesAnalytics(),
      });
    } catch (err) {
      console.error('[Admin Analytics Error]', err);
      res.status(500).json({ ok: false, error: 'Failed to compute analytics.' });
    }
  });

  // Authenticated Orders List with Real-Time Filtering
  app.get('/api/admin/orders', requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const filters = {
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        orderId: typeof req.query.orderId === 'string' ? req.query.orderId : undefined,
        phone: typeof req.query.phone === 'string' ? req.query.phone : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        paymentStatus:
          typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus : undefined,
        onlyNew: req.query.new === '1' || req.query.new === 'true',
      };
      const orders = await getAllAdminOrders(filters);
      const unseenCount = await getUnseenOrderCount();
      res.json({
        ok: true,
        orders,
        unseenCount,
      });
    } catch (err) {
      console.error('[Admin Orders Error]', err);
      res.status(500).json({ ok: false, error: 'Failed to fetch orders.' });
    }
  });

  // Get Individual Order Details
  app.get(
    '/api/admin/orders/:orderNumber',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const order = await getOrderByNumber(req.params.orderNumber ?? '', true);
      if (!order) {
        res.status(404).json({ ok: false, error: 'Order not found.' });
        return;
      }
      res.json({ ok: true, order });
    },
  );

  // Mark all orders as seen
  app.post(
    '/api/admin/orders/mark-all-seen',
    requireAdminAuth,
    async (_req: Request, res: Response) => {
      await db.execute('UPDATE orders SET is_seen_by_admin = 1 WHERE is_seen_by_admin = 0');
      broadcastToAdmins({ type: 'orders:marked-seen' });
      res.json({ ok: true });
    },
  );

  // Update Order Status / Payment Status / Notes (with automatic stock restock on Cancelled)
  app.patch(
    '/api/admin/orders/:orderNumber',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const orderNumber = String(req.params.orderNumber ?? '').trim().toUpperCase();
      const existing = await getOrderByNumber(orderNumber, true);
      if (!existing) {
        res.status(404).json({ ok: false, error: `Order ${orderNumber} does not exist.` });
        return;
      }

      const body = req.body ?? {};
      const prevStatus = existing.status;
      const nextStatus: OrderStatus =
        body.status && VALID_ORDER_STATUSES.has(body.status) ? body.status : existing.status;
      const nextPaymentStatus: PaymentStatus =
        body.paymentStatus && VALID_PAYMENT_STATUSES.has(body.paymentStatus)
          ? body.paymentStatus
          : existing.paymentStatus;
      const nextAdminNotes =
        typeof body.adminNotes === 'string' ? body.adminNotes.trim() : existing.adminNotes || '';
      const nextSeen = body.isNew !== undefined ? (body.isNew ? 0 : 1) : 1;

      const rawRow = await db.queryOne<{ stock_deducted: number }>(
        'SELECT stock_deducted FROM orders WHERE order_number = ?',
        [orderNumber],
      );
      let nextStockDeducted = Number(rawRow?.stock_deducted ?? 1);
      const updatedAtIso = new Date().toISOString();
      const nowMs = Date.now();

      await db.transaction(async (tx) => {
        // Automatically restock inventory if transitioning into Cancelled
        if (nextStatus === 'Cancelled' && prevStatus !== 'Cancelled' && nextStockDeducted === 1) {
          const items = await tx.query<{ product_id: string; quantity: number }>(
            'SELECT product_id, quantity FROM order_items WHERE order_number = ?',
            [orderNumber],
          );

          for (const it of items) {
            const cur = await tx.queryOne<{ stock_units: number | null }>(
              'SELECT stock_units FROM product_overrides WHERE product_id = ?',
              [it.product_id],
            );
            const nextUnits = Number(cur?.stock_units ?? 0) + Number(it.quantity);
            await tx.execute(
              `UPDATE product_overrides SET stock_units = ?, in_stock = 1, updated_at_ms = ? WHERE product_id = ?`,
              [nextUnits, nowMs, it.product_id],
            );
          }
          nextStockDeducted = 0;
        } else if (
          prevStatus === 'Cancelled' &&
          nextStatus !== 'Cancelled' &&
          nextStockDeducted === 0
        ) {
          const items = await tx.query<{ product_id: string; quantity: number }>(
            'SELECT product_id, quantity FROM order_items WHERE order_number = ?',
            [orderNumber],
          );

          for (const it of items) {
            const cur = await tx.queryOne<{ stock_units: number | null }>(
              'SELECT stock_units FROM product_overrides WHERE product_id = ?',
              [it.product_id],
            );
            const nextUnits = Math.max(0, Number(cur?.stock_units ?? 48) - Number(it.quantity));
            await tx.execute(
              `UPDATE product_overrides SET stock_units = ?, in_stock = ?, updated_at_ms = ? WHERE product_id = ?`,
              [nextUnits, nextUnits > 0 ? 1 : 0, nowMs, it.product_id],
            );
          }
          nextStockDeducted = 1;
        }

        await tx.execute(
          `UPDATE orders
           SET status = ?, payment_status = ?, admin_notes = ?, is_seen_by_admin = ?, stock_deducted = ?, updated_at_iso = ?
           WHERE order_number = ?`,
          [
            nextStatus,
            nextPaymentStatus,
            nextAdminNotes,
            nextSeen,
            nextStockDeducted,
            updatedAtIso,
            orderNumber,
          ],
        );
      });

      const updated = await getOrderByNumber(orderNumber, true);
      if (updated) {
        broadcastToAdmins({
          type: 'order:updated',
          order: updated,
          unseenCount: await getUnseenOrderCount(),
          productOverrides: await getProductOverridesMap(),
        });
      }

      res.json({
        ok: true,
        order: updated,
      });
    },
  );

  // Delete an Order (Admin cleanup)
  app.delete(
    '/api/admin/orders/:orderNumber',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const orderNumber = String(req.params.orderNumber ?? '').trim().toUpperCase();
      const existing = await getOrderByNumber(orderNumber, true);
      if (!existing) {
        res.status(404).json({ ok: false, error: `Order ${orderNumber} does not exist.` });
        return;
      }

      await db.execute('DELETE FROM orders WHERE order_number = ?', [orderNumber]);
      broadcastToAdmins({
        type: 'order:deleted',
        orderNumber,
      });

      res.json({ ok: true });
    },
  );

  // Admin Server-Sent Events Fallback for Real-Time Updates
  app.get('/api/admin/orders/stream', requireAdminAuth, async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('init', {
      orders: await getAllAdminOrders(),
      unseenCount: await getUnseenOrderCount(),
    });

    const intervalId = setInterval(async () => {
      try {
        sendEvent('ping', { time: Date.now() });
      } catch {
        clearInterval(intervalId);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(intervalId);
    });
  });

  // Admin Product Inventory & Pricing Overrides
  app.patch(
    '/api/admin/products/:productId',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const productId = String(req.params.productId ?? '').trim();
      const existing = (await getProductOverridesMap())[productId] ?? {};

      const nextPrice =
        req.body?.price !== undefined ? Math.max(1, Math.round(Number(req.body.price))) : existing.price;
      const nextStock =
        req.body?.stockUnits !== undefined
          ? Math.max(0, Math.floor(Number(req.body.stockUnits)))
          : existing.stockUnits ?? 48;
      const nextThreshold =
        req.body?.lowStockThreshold !== undefined
          ? Math.max(1, Math.floor(Number(req.body.lowStockThreshold)))
          : existing.lowStockThreshold ?? 10;
      const nextInStock =
        req.body?.inStock !== undefined
          ? req.body.inStock
            ? 1
            : 0
          : nextStock > 0
            ? 1
            : 0;
      const nextBestSeller =
        req.body?.isBestSeller !== undefined ? (req.body.isBestSeller ? 1 : 0) : existing.isBestSeller ? 1 : 0;
      const nextNewArrival =
        req.body?.isNewArrival !== undefined ? (req.body.isNewArrival ? 1 : 0) : existing.isNewArrival ? 1 : 0;
      const nowMs = Date.now();

      await db.execute(
        `INSERT INTO product_overrides (
          product_id, price, stock_units, low_stock_threshold, in_stock, is_best_seller, is_new_arrival, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(product_id) DO UPDATE SET
          price = EXCLUDED.price,
          stock_units = EXCLUDED.stock_units,
          low_stock_threshold = EXCLUDED.low_stock_threshold,
          in_stock = EXCLUDED.in_stock,
          is_best_seller = EXCLUDED.is_best_seller,
          is_new_arrival = EXCLUDED.is_new_arrival,
          updated_at_ms = EXCLUDED.updated_at_ms`,
        [
          productId,
          nextPrice ?? null,
          nextStock,
          nextThreshold,
          nextInStock,
          nextBestSeller,
          nextNewArrival,
          nowMs,
        ],
      );

      const overrides = await getProductOverridesMap();
      broadcastToAdmins({
        type: 'products:updated',
        productOverrides: overrides,
      });

      res.json({
        ok: true,
        productOverrides: overrides,
      });
    },
  );

  app.post(
    '/api/admin/products/reset',
    requireAdminAuth,
    async (_req: Request, res: Response) => {
      await db.execute('DELETE FROM product_overrides');
      await seedInitialStoreConfiguration(db);
      const overrides = await getProductOverridesMap();
      broadcastToAdmins({
        type: 'products:updated',
        productOverrides: overrides,
      });
      res.json({ ok: true, productOverrides: overrides });
    },
  );

  // Admin Shipping Rates Management
  app.post(
    '/api/admin/shipping-rates',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const cityKey = String(req.body?.cityKey ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
      const cityName = String(req.body?.cityName ?? '').trim();
      const standardFee = Math.max(0, Math.round(Number(req.body?.standardFee) || 0));
      const expressFee = Math.max(0, Math.round(Number(req.body?.expressFee) || 0));
      const freeShippingThreshold = Math.max(
        0,
        Math.round(Number(req.body?.freeShippingThreshold) || 5000),
      );
      const estimatedDays = String(req.body?.estimatedDays ?? '2–4 Working Days').trim();
      const active = req.body?.active !== false ? 1 : 0;
      const nowMs = Date.now();

      if (!cityKey || !cityName) {
        res.status(400).json({ ok: false, error: 'City key and display name are required.' });
        return;
      }

      await db.execute(
        `INSERT INTO shipping_rates (
          city_key, city_name, standard_fee, express_fee, free_shipping_threshold, estimated_days, active, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(city_key) DO UPDATE SET
          city_name = EXCLUDED.city_name,
          standard_fee = EXCLUDED.standard_fee,
          express_fee = EXCLUDED.express_fee,
          free_shipping_threshold = EXCLUDED.free_shipping_threshold,
          estimated_days = EXCLUDED.estimated_days,
          active = EXCLUDED.active,
          updated_at_ms = EXCLUDED.updated_at_ms`,
        [
          cityKey,
          cityName,
          standardFee,
          expressFee,
          freeShippingThreshold,
          estimatedDays,
          active,
          nowMs,
        ],
      );

      const allRates = await getShippingRates(false);
      broadcastToAdmins({
        type: 'shipping:updated',
        shippingRates: allRates,
      });

      res.json({ ok: true, shippingRates: allRates });
    },
  );

  app.delete(
    '/api/admin/shipping-rates/:cityKey',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const cityKey = String(req.params.cityKey ?? '').trim().toLowerCase();
      if (cityKey === '__default__') {
        res.status(400).json({
          ok: false,
          error: 'The nationwide default shipping rate cannot be deleted.',
        });
        return;
      }

      await db.execute('DELETE FROM shipping_rates WHERE city_key = ?', [cityKey]);
      const allRates = await getShippingRates(false);
      broadcastToAdmins({
        type: 'shipping:updated',
        shippingRates: allRates,
      });

      res.json({ ok: true, shippingRates: allRates });
    },
  );

  // Admin Coupons Management
  app.post(
    '/api/admin/coupons',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const code = String(req.body?.code ?? '').trim().toUpperCase();
      const discountType: DiscountType =
        req.body?.discountType === 'fixed' ? 'fixed' : 'percentage';
      const discountValue = Math.max(1, Math.round(Number(req.body?.discountValue) || 10));
      const minOrderAmount = Math.max(0, Math.round(Number(req.body?.minOrderAmount) || 0));
      const maxUses =
        req.body?.maxUses !== null && req.body?.maxUses !== undefined
          ? Math.max(1, Math.floor(Number(req.body.maxUses)))
          : null;
      const description = String(req.body?.description ?? '').trim();
      const active = req.body?.active !== false ? 1 : 0;
      const expiresAtIso =
        typeof req.body?.expiresAt === 'string' && req.body.expiresAt.trim()
          ? new Date(req.body.expiresAt).toISOString()
          : null;
      const nowMs = Date.now();

      if (!code || code.length < 3) {
        res.status(400).json({ ok: false, error: 'Coupon code must be at least 3 characters.' });
        return;
      }

      await db.execute(
        `INSERT INTO coupons (
          code, discount_type, discount_value, min_order_amount, max_uses, used_count, description, active, expires_at_iso, created_at_ms
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          discount_type = EXCLUDED.discount_type,
          discount_value = EXCLUDED.discount_value,
          min_order_amount = EXCLUDED.min_order_amount,
          max_uses = EXCLUDED.max_uses,
          description = EXCLUDED.description,
          active = EXCLUDED.active,
          expires_at_iso = EXCLUDED.expires_at_iso`,
        [
          code,
          discountType,
          discountValue,
          minOrderAmount,
          maxUses,
          description,
          active,
          expiresAtIso,
          nowMs,
        ],
      );

      const allCoupons = await getAllCoupons();
      broadcastToAdmins({
        type: 'coupons:updated',
        coupons: allCoupons,
      });

      res.json({ ok: true, coupons: allCoupons });
    },
  );

  app.patch(
    '/api/admin/coupons/:code',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const code = String(req.params.code ?? '').trim().toUpperCase();
      const existing = await db.queryOne<{ active: number }>(
        'SELECT active FROM coupons WHERE code = ?',
        [code],
      );
      if (!existing) {
        res.status(404).json({ ok: false, error: 'Coupon not found.' });
        return;
      }

      const nextActive =
        req.body?.active !== undefined
          ? req.body.active
            ? 1
            : 0
          : Number(existing.active) === 1
            ? 0
            : 1;

      await db.execute('UPDATE coupons SET active = ? WHERE code = ?', [nextActive, code]);
      const allCoupons = await getAllCoupons();
      broadcastToAdmins({
        type: 'coupons:updated',
        coupons: allCoupons,
      });

      res.json({ ok: true, coupons: allCoupons });
    },
  );

  app.delete(
    '/api/admin/coupons/:code',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const code = String(req.params.code ?? '').trim().toUpperCase();
      await db.execute('DELETE FROM coupons WHERE code = ?', [code]);
      const allCoupons = await getAllCoupons();
      broadcastToAdmins({
        type: 'coupons:updated',
        coupons: allCoupons,
      });
      res.json({ ok: true, coupons: allCoupons });
    },
  );

  app.delete(
    '/api/admin/reviews/:reviewId',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const reviewId = String(req.params.reviewId ?? '').trim();
      await db.execute('DELETE FROM product_reviews WHERE id = ?', [reviewId]);
      broadcastToAdmins({
        type: 'reviews:updated',
        reviewsByProduct: await getReviewsGroupedByProduct(),
      });
      res.json({ ok: true });
    },
  );

  app.patch(
    '/api/admin/inquiries/:id',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const id = String(req.params.id ?? '').trim();
      const existing = await db.queryOne<{ resolved: number }>(
        'SELECT resolved FROM inquiries WHERE id = ?',
        [id],
      );
      if (!existing) {
        res.status(404).json({ ok: false, error: 'Inquiry not found.' });
        return;
      }
      const nextResolved =
        req.body?.resolved !== undefined
          ? req.body.resolved
            ? 1
            : 0
          : Number(existing.resolved) === 1
            ? 0
            : 1;

      await db.execute('UPDATE inquiries SET resolved = ? WHERE id = ?', [nextResolved, id]);
      res.json({ ok: true, inquiries: await getAllInquiries() });
    },
  );

  // Admin Backups
  app.get('/api/admin/backups', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({ ok: true, backups: listBackups() });
  });

  app.post('/api/admin/backups', requireAdminAuth, async (_req: Request, res: Response) => {
    try {
      const backup = await createDatabaseBackup('manual');
      res.json({ ok: true, backup, backups: listBackups() });
    } catch (err) {
      console.error('[Backup Error]', err);
      res.status(500).json({ ok: false, error: 'Failed to create database backup.' });
    }
  });

  app.get(
    '/api/admin/backups/export-json',
    requireAdminAuth,
    async (_req: Request, res: Response) => {
      try {
        const fullDump = {
          exportedAtIso: new Date().toISOString(),
          databaseEngine: db.engine,
          orders: await getAllAdminOrders(),
          reviews: await getReviewsGroupedByProduct(),
          shippingRates: await getShippingRates(false),
          coupons: await getAllCoupons(),
          inquiries: await getAllInquiries(),
          subscribers: await getAllSubscribers(),
          productOverrides: await getProductOverridesMap(),
        };

        const jsonStr = JSON.stringify(fullDump, null, 2);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="norva_store_export_${new Date().toISOString().slice(0, 10)}.json"`,
        );
        res.send(jsonStr);
      } catch (err) {
        console.error('[Export Error]', err);
        res.status(500).json({ ok: false, error: 'Export failed.' });
      }
    },
  );

  // 404 handler for unrecognized /api routes
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: 'API endpoint not found.' });
  });

  // Global Unhandled Error Middleware (prevents raw stack leakage)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Unhandled server error]:', err);
    if (res.headersSent) return;
    res.status(500).json({
      ok: false,
      error: 'An unexpected server error occurred. Please try again.',
    });
  });

  return app;
}

async function startServer(): Promise<void> {
  await ensureDatabaseReady();
  const app = createExpressApp();
  const httpServer = createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const viteModuleId = 'vite';
    const { createServer: createViteServer } = await import(viteModuleId);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        immutable: true,
        maxAge: '365d',
      }),
    );
    app.use(
      express.static(distPath, {
        maxAge: '1h',
      }),
    );
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATED ADMIN WEBSOCKET UPGRADE (/api/admin/ws)
  // --------------------------------------------------------------------------
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', async (request, socket, head) => {
    try {
      const host = request.headers.host || `localhost:${PORT}`;
      const parsedUrl = new URL(request.url || '/', `http://${host}`);

      if (parsedUrl.pathname !== '/api/admin/ws') {
        return;
      }

      const queryToken = parsedUrl.searchParams.get('token') ?? undefined;
      const rawToken = extractRawAdminToken(request, queryToken);
      const admin = await verifyAdminToken(rawToken);

      if (!admin) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, async (ws) => {
        adminWsClients.add(ws);

        ws.send(
          JSON.stringify({
            type: 'init',
            orders: await getAllAdminOrders(),
            unseenCount: await getUnseenOrderCount(),
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
    console.log(
      `NORVA server listening on http://0.0.0.0:${PORT} (${db.engine}: ${db.connectionInfo}, persistent: ${db.isPersistent})`,
    );
  });
}

const isServerlessEnv = Boolean(
  process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

if (!isServerlessEnv) {
  startServer().catch((err) => {
    console.error('[Fatal server startup error]:', err);
    process.exit(1);
  });
}
