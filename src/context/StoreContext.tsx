import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CatalogProduct, PRODUCTS, ProductReview, formatPKR } from '../data/products';
import { extractApiErrorMessage } from '../utils/apiError';

export { extractApiErrorMessage };

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export type PaymentStatus = 'Pending' | 'Paid' | 'Refunded';
export type DiscountType = 'percentage' | 'fixed';

export interface CartItem {
  key: string; // `${productId}__${sizeSku}`
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

export interface CustomerProfile {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface PlacedOrder {
  orderNumber: string;
  createdAt: string;
  createdAtIso?: string;
  createdAtMs?: number;
  updatedAtIso?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  shippingCost: number;
  total: number;
  couponCode?: string;
  paymentMethod: 'cod' | 'invoice';
  shippingSpeed: 'standard' | 'express';
  customer: CustomerProfile;
  giftNote?: string;
  adminNotes?: string;
  isNew?: boolean;
  duplicatePrevented?: boolean;
}

export interface ProductAdminOverride {
  price?: number;
  stockUnits?: number;
  lowStockThreshold?: number;
  inStock?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
}

export interface ShippingRateConfig {
  cityKey: string;
  cityName: string;
  standardFee: number;
  expressFee: number;
  freeShippingThreshold: number;
  estimatedDays: string;
  active: boolean;
}

export interface CouponConfig {
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

export interface SalesAnalyticsData {
  summary: {
    totalOrders: number;
    validOrdersCount: number;
    cancelledOrdersCount: number;
    grossRevenue: number;
    collectedRevenue: number;
    pendingCollectionRevenue: number;
    averageOrderValue: number;
    totalUnitsSold: number;
    totalDiscountsGiven: number;
  };
  dailyReport: {
    date: string;
    ordersCount: number;
    unitsSold: number;
    revenue: number;
  }[];
  monthlyReport: {
    month: string;
    ordersCount: number;
    unitsSold: number;
    revenue: number;
    avgOrderValue: number;
  }[];
  topProducts: {
    productId: string;
    name: string;
    unitsSold: number;
    revenue: number;
  }[];
  topCities: {
    city: string;
    ordersCount: number;
    revenue: number;
  }[];
}

export interface DatabaseBackupInfo {
  filename: string;
  sizeBytes: number;
  createdAtIso: string;
}

export interface ConciergeInquiry {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  createdAt: string;
  resolved: boolean;
}

export interface AdminSession {
  username: string;
  email?: string;
  loggedInAt: string;
}

export interface OrderAdminPatch {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  adminNotes?: string;
  isSeenByAdmin?: boolean;
}

export type HydratedCatalogProduct = CatalogProduct & {
  inStock: boolean;
  stockUnits: number;
  lowStockThreshold: number;
  isLowStock: boolean;
};

interface StoreContextValue {
  products: HydratedCatalogProduct[];
  lowStockProducts: HydratedCatalogProduct[];
  productOverrides: Record<string, ProductAdminOverride>;
  shippingRates: ShippingRateConfig[];
  cart: CartItem[];
  wishlist: string[];
  orders: PlacedOrder[];
  adminOrders: PlacedOrder[];
  adminCoupons: CouponConfig[];
  adminShippingRates: ShippingRateConfig[];
  salesAnalytics: SalesAnalyticsData | null;
  adminBackups: DatabaseBackupInfo[];
  unseenOrderCount: number;
  isAdminAuthChecking: boolean;
  isAdminLoading: boolean;
  isRealtimeConnected: boolean;
  profile: CustomerProfile;
  customReviews: Record<string, (ProductReview & { verifiedPurchase?: boolean })[]>;
  inquiries: ConciergeInquiry[];
  subscribers: string[];
  adminSession: AdminSession | null;

  isCartOpen: boolean;
  isSearchOpen: boolean;
  quickViewProduct: CatalogProduct | null;
  toastMessage: string | null;

  openCart: () => void;
  closeCart: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openQuickView: (product: CatalogProduct) => void;
  closeQuickView: () => void;

  addToCart: (
    product: CatalogProduct,
    sizeIdx?: number,
    quantity?: number,
    openDrawer?: boolean,
  ) => void;
  removeFromCart: (key: string) => void;
  updateCartQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;

  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;

  calculateCityShipping: (
    city: string,
    speed: 'standard' | 'express',
    subtotal: number,
  ) => { cost: number; matchedRate: ShippingRateConfig };
  validateCoupon: (
    code: string,
    subtotal: number,
  ) => Promise<{
    ok: boolean;
    coupon?: CouponConfig;
    discountAmount?: number;
    error?: string;
  }>;
  trackOrder: (
    orderNumber: string,
    phone: string,
  ) => Promise<{ ok: boolean; order?: PlacedOrder; error?: string }>;

  updateProfile: (partial: Partial<CustomerProfile>) => void;
  placeOrder: (
    order: Omit<PlacedOrder, 'orderNumber' | 'createdAt' | 'status' | 'paymentStatus'> & {
      idempotencyKey?: string;
    },
  ) => Promise<PlacedOrder>;
  refreshBuyerOrders: () => Promise<void>;
  addProductReview: (
    productId: string,
    review: Omit<ProductReview, 'id' | 'date'> & { orderNumber?: string },
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteProductReview: (productId: string, reviewId: string) => Promise<void>;
  addInquiry: (inquiry: Omit<ConciergeInquiry, 'id' | 'createdAt' | 'resolved'>) => void;
  toggleInquiryResolved: (id: string) => void;
  addSubscriber: (email: string) => void;

  // Authenticated Admin Methods
  loginAdmin: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  activateOrResetAdmin: (params: {
    setupToken: string;
    username: string;
    password: string;
  }) => Promise<{ ok: boolean; message?: string; error?: string }>;
  changeAdminPassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  logoutAdmin: () => Promise<void>;
  ensureAdminSessionChecked: () => Promise<void>;
  refreshAdminOrders: () => Promise<void>;
  updateOrderStatus: (orderNumber: string, status: OrderStatus) => Promise<boolean>;
  updateOrderPaymentStatus: (
    orderNumber: string,
    paymentStatus: PaymentStatus,
  ) => Promise<boolean>;
  updateOrderAdmin: (orderNumber: string, patch: OrderAdminPatch) => Promise<PlacedOrder | null>;
  markOrderSeen: (orderNumber: string) => Promise<void>;
  markAllOrdersSeen: () => Promise<void>;
  deleteOrder: (orderNumber: string) => Promise<boolean>;
  updateProductOverride: (productId: string, patch: ProductAdminOverride) => void;
  resetProductOverrides: () => void;

  // Admin Shipping, Coupons & Backups
  saveAdminShippingRate: (
    rate: Omit<ShippingRateConfig, 'cityKey'> & { cityKey?: string },
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteAdminShippingRate: (cityKey: string) => Promise<{ ok: boolean; error?: string }>;
  saveAdminCoupon: (
    coupon: Omit<CouponConfig, 'usedCount'>,
  ) => Promise<{ ok: boolean; error?: string }>;
  toggleAdminCoupon: (code: string, active: boolean) => Promise<boolean>;
  deleteAdminCoupon: (code: string) => Promise<boolean>;
  createAdminBackup: () => Promise<{ ok: boolean; error?: string }>;
  downloadAdminBackup: (filename: string) => Promise<void>;
  exportAdminJsonBackup: () => Promise<void>;

  showToast: (msg: string) => void;

  cartCount: number;
  cartSubtotal: number;
}

const STORAGE_KEYS = {
  clientId: 'norva_client_id_v1',
  cart: 'norva_cart_v1',
  wishlist: 'norva_wishlist_v1',
  buyerOrderTokens: 'norva_order_tokens_v1',
  profile: 'norva_profile_v1',
  adminToken: 'norva_admin_token_v1',
};

const DEFAULT_PROFILE: CustomerProfile = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'Pakistan',
};

const FALLBACK_SHIPPING_RATES: ShippingRateConfig[] = [
  {
    cityKey: 'karachi',
    cityName: 'Karachi',
    standardFee: 200,
    expressFee: 400,
    freeShippingThreshold: 5000,
    estimatedDays: '1–2 Working Days',
    active: true,
  },
  {
    cityKey: 'lahore',
    cityName: 'Lahore',
    standardFee: 250,
    expressFee: 500,
    freeShippingThreshold: 5000,
    estimatedDays: '2–3 Working Days',
    active: true,
  },
  {
    cityKey: 'islamabad',
    cityName: 'Islamabad',
    standardFee: 250,
    expressFee: 500,
    freeShippingThreshold: 5000,
    estimatedDays: '2–3 Working Days',
    active: true,
  },
  {
    cityKey: '__default__',
    cityName: 'Other Cities (Nationwide)',
    standardFee: 300,
    expressFee: 550,
    freeShippingThreshold: 5000,
    estimatedDays: '3–5 Working Days',
    active: true,
  },
];

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorageDeferred(key: string, value: unknown): void {
  window.setTimeout(() => {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // Ignore storage quota errors
    }
  }, 0);
}

function getOrCreateClientId(): string {
  const existing = readStorage<string | null>(STORAGE_KEYS.clientId, null);
  if (existing && existing.length >= 12) return existing;
  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `nv_${crypto.randomUUID()}`
      : `nv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  writeStorageDeferred(STORAGE_KEYS.clientId, generated);
  return generated;
}

function resolveCatalogOrderImages(ord: PlacedOrder): PlacedOrder {
  return {
    ...ord,
    items: (ord.items ?? []).map((it) => {
      const current = PRODUCTS.find((p) => p.id === it.productId);
      if (!current) return it;
      return {
        ...it,
        name: current.name,
        slug: current.slug,
        image: current.primaryImage || it.image,
      };
    }),
  };
}

function sortOrdersNewestFirst(list: PlacedOrder[]): PlacedOrder[] {
  return [...list].sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}


/**
 * Resilient JSON POST helper that includes cookies (required for cross-origin preview/public proxy)
 * and automatically re-sends the POST body if a 60s auth-bridge 302 redirect or server warmup
 * temporarily converts POST -> GET or returns an HTML warmup page.
 */
async function postJsonResilient<T = Record<string, any>>(
  url: string,
  payload: unknown,
  signal?: AbortSignal,
  maxRetries = 2,
): Promise<{ res: Response; data: T | null }> {
  const bodyStr = JSON.stringify(payload);
  let lastRes: Response | null = null;
  let lastData: T | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: bodyStr,
      signal,
    });

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const isJson = contentType.includes('application/json');
    let data: T | null = null;

    if (isJson) {
      data = (await res.json().catch(() => null)) as T | null;
    } else if (!res.ok) {
      const rawText = await res.text().catch(() => '');
      const trimmed = rawText.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          data = JSON.parse(trimmed) as T;
        } catch {
          data = null;
        }
      } else if (trimmed && !trimmed.startsWith('<!DOCTYPE') && !trimmed.startsWith('<html')) {
        data = ({ ok: false, error: trimmed.slice(0, 240) } as unknown) as T;
      }
    }

    lastRes = res;
    lastData = data;

    const convertedByRedirect =
      res.redirected && (!res.ok || !isJson || (data as Record<string, unknown> | null)?.retryPost === true);
    const transientGatewayOrWarmup =
      res.status === 405 ||
      res.status === 500 ||
      res.status === 502 ||
      res.status === 503 ||
      res.status === 504 ||
      (!isJson && res.status === 200);

    if ((convertedByRedirect || transientGatewayOrWarmup) && attempt < maxRetries) {
      await new Promise((r) => window.setTimeout(r, 250 * (attempt + 1)));
      continue;
    }

    return { res, data };
  }

  return { res: lastRes!, data: lastData };
}

export interface OverlayStateValue {
  isCartOpen: boolean;
  isSearchOpen: boolean;
  quickViewProduct: CatalogProduct | null;
  openCart: () => void;
  closeCart: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openQuickView: (product: CatalogProduct) => void;
  closeQuickView: () => void;
}

export interface HeaderCountsValue {
  cartCount: number;
  wishlistCount: number;
  unseenOrderCount: number;
  hasAdminSession: boolean;
}

export interface CatalogActionsValue {
  addToCart: (
    product: CatalogProduct,
    sizeIdx?: number,
    quantity?: number,
    openDrawer?: boolean,
  ) => void;
  toggleWishlist: (productId: string) => void;
  openQuickView: (product: CatalogProduct) => void;
  addSubscriber: (email: string) => void;
  showToast: (msg: string) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);
const ToastContext = createContext<string | null>(null);
const OverlayStateContext = createContext<OverlayStateValue | null>(null);
const HeaderCountsContext = createContext<HeaderCountsValue | null>(null);
const WishlistSetContext = createContext<ReadonlySet<string>>(new Set());
const CatalogActionsContext = createContext<CatalogActionsValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const clientIdRef = useRef<string>(getOrCreateClientId());

  const [cart, setCart] = useState<CartItem[]>(() => {
    const deduped = new Map<string, CartItem>();
    for (const item of readStorage<CartItem[]>(STORAGE_KEYS.cart, [])) {
      const current = PRODUCTS.find((p) => p.id === item.productId);
      if (!current) {
        continue;
      }
      const sz = current.sizes[0];
      const safeQty = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
      const nextKey = `${current.id}__${sz.sku}`;
      const existing = deduped.get(nextKey);
      if (existing) {
        existing.quantity = Math.min(99, existing.quantity + safeQty);
      } else {
        deduped.set(nextKey, {
          ...item,
          key: nextKey,
          productId: current.id,
          name: current.name,
          slug: current.slug,
          image: current.primaryImage,
          sizeLabel: sz.label,
          sizeSku: sz.sku,
          unitPrice: sz.price,
          quantity: safeQty,
        });
      }
    }
    return Array.from(deduped.values());
  });

  const [wishlist, setWishlist] = useState<string[]>(() => readStorage(STORAGE_KEYS.wishlist, []));
  const [buyerOrderTokens, setBuyerOrderTokens] = useState<string[]>(() =>
    readStorage<string[]>(STORAGE_KEYS.buyerOrderTokens, []),
  );
  const [orders, setOrders] = useState<PlacedOrder[]>([]);

  const [profile, setProfile] = useState<CustomerProfile>(() =>
    readStorage(STORAGE_KEYS.profile, DEFAULT_PROFILE),
  );
  const [customReviews, setCustomReviews] = useState<
    Record<string, (ProductReview & { verifiedPurchase?: boolean })[]>
  >({});

  // Server-backed storefront & private admin state
  const [productOverrides, setProductOverrides] = useState<Record<string, ProductAdminOverride>>(
    {},
  );
  const [shippingRates, setShippingRates] = useState<ShippingRateConfig[]>(
    FALLBACK_SHIPPING_RATES,
  );
  const [adminShippingRates, setAdminShippingRates] = useState<ShippingRateConfig[]>(
    FALLBACK_SHIPPING_RATES,
  );
  const [adminCoupons, setAdminCoupons] = useState<CouponConfig[]>([]);
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalyticsData | null>(null);
  const [adminBackups, setAdminBackups] = useState<DatabaseBackupInfo[]>([]);

  const [adminToken, setAdminToken] = useState<string | null>(() =>
    readStorage<string | null>(STORAGE_KEYS.adminToken, null),
  );
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [adminOrders, setAdminOrders] = useState<PlacedOrder[]>([]);
  const [unseenOrderCount, setUnseenOrderCount] = useState(0);
  const [inquiries, setInquiries] = useState<ConciergeInquiry[]>([]);
  const [subscribers, setSubscribers] = useState<string[]>([]);
  const [isAdminAuthChecking, setIsAdminAuthChecking] = useState<boolean>(() =>
    Boolean(readStorage<string | null>(STORAGE_KEYS.adminToken, null)),
  );
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<CatalogProduct | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const adminTokenRef = useRef<string | null>(adminToken);
  adminTokenRef.current = adminToken;

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.cart, cart);
  }, [cart]);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.wishlist, wishlist);
  }, [wishlist]);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.buyerOrderTokens, buyerOrderTokens);
  }, [buyerOrderTokens]);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.profile, profile);
  }, [profile]);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.adminToken, adminToken);
  }, [adminToken]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3600);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const buildAdminHeaders = useCallback((tokenOverride?: string | null): HeadersInit => {
    const tok = tokenOverride ?? adminTokenRef.current;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (tok) {
      headers.Authorization = `Bearer ${tok}`;
    }
    return headers;
  }, []);

  // 1. Load live storefront catalog overrides, shipping rates, reviews & persistent wishlist in ONE request
  useEffect(() => {
    let cancelled = false;
    const bootstrapUrl = `/api/storefront/bootstrap?clientId=${encodeURIComponent(clientIdRef.current)}`;
    fetch(bootstrapUrl, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;
        if (data.productOverrides) {
          setProductOverrides(data.productOverrides);
        }
        if (Array.isArray(data.shippingRates) && data.shippingRates.length > 0) {
          setShippingRates(data.shippingRates);
        }
        if (data.reviewsByProduct) {
          setCustomReviews(data.reviewsByProduct);
        }
        if (Array.isArray(data.wishlist) && data.wishlist.length > 0) {
          setWishlist((prev) => Array.from(new Set([...data.wishlist, ...prev])));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Fetch buyer's own past order receipts from SQLite using unguessable lookup tokens
  const refreshBuyerOrders = useCallback(async () => {
    if (buyerOrderTokens.length === 0) {
      setOrders([]);
      return;
    }
    try {
      const { res, data } = await postJsonResilient('/api/orders/lookup', {
        tokens: buyerOrderTokens,
      });
      if (!res.ok) return;
      if (data?.ok && Array.isArray(data.orders)) {
        setOrders(
          sortOrdersNewestFirst(
            (data.orders as PlacedOrder[]).map(resolveCatalogOrderImages),
          ),
        );
      }
    } catch {
      // Keep last loaded receipts on transient network issues
    }
  }, [buyerOrderTokens]);

  useEffect(() => {
    refreshBuyerOrders();
  }, [refreshBuyerOrders]);

  // 3. Load authenticated Admin Dashboard data from SQLite
  const fetchAdminDashboardData = useCallback(
    async (tokenOverride?: string | null): Promise<boolean> => {
      setIsAdminLoading(true);
      try {
        const res = await fetch('/api/admin/dashboard-data', {
          method: 'GET',
          credentials: 'include',
          headers: buildAdminHeaders(tokenOverride),
        });

        if (res.status === 401) {
          setAdminSession(null);
          setAdminToken(null);
          setAdminOrders([]);
          setUnseenOrderCount(0);
          return false;
        }

        if (!res.ok) return false;
        const data = await res.json();
        if (data?.ok) {
          const loadedOrders = Array.isArray(data.orders)
            ? sortOrdersNewestFirst(
                (data.orders as PlacedOrder[]).map(resolveCatalogOrderImages),
              )
            : [];
          setAdminOrders(loadedOrders);
          setUnseenOrderCount(
            typeof data.unseenCount === 'number'
              ? data.unseenCount
              : loadedOrders.filter((o) => o.isNew).length,
          );
          if (Array.isArray(data.inquiries)) setInquiries(data.inquiries);
          if (Array.isArray(data.subscribers)) setSubscribers(data.subscribers);
          if (data.productOverrides) setProductOverrides(data.productOverrides);
          if (Array.isArray(data.shippingRates)) {
            setAdminShippingRates(data.shippingRates);
            setShippingRates(data.shippingRates.filter((r: ShippingRateConfig) => r.active));
          }
          if (Array.isArray(data.coupons)) setAdminCoupons(data.coupons);
          if (data.reviewsByProduct) setCustomReviews(data.reviewsByProduct);
          if (data.analytics) setSalesAnalytics(data.analytics);
          if (Array.isArray(data.backups)) setAdminBackups(data.backups);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setIsAdminLoading(false);
      }
    },
    [buildAdminHeaders],
  );

  const adminSessionCheckedRef = useRef(false);

  const ensureAdminSessionChecked = useCallback(async () => {
    if (adminSessionCheckedRef.current) return;
    adminSessionCheckedRef.current = true;
    setIsAdminAuthChecking(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4500);
    try {
      const res = await fetch('/api/admin/session', {
        method: 'GET',
        credentials: 'include',
        headers: buildAdminHeaders(adminTokenRef.current),
        signal: controller.signal,
      });
      if (!res.ok) {
        setAdminSession(null);
        setAdminToken(null);
        return;
      }
      const data = await res.json();
      if (data?.ok && data.session) {
        setAdminSession(data.session);
        if (typeof data.unseenCount === 'number') {
          setUnseenOrderCount(data.unseenCount);
        }
        fetchAdminDashboardData(adminTokenRef.current);
      }
    } catch {
      if (!adminTokenRef.current) {
        setAdminSession(null);
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsAdminAuthChecking(false);
    }
  }, [buildAdminHeaders, fetchAdminDashboardData]);

  // Verify existing Admin session on boot ONLY if an admin token/cookie exists or user opened /admin directly
  useEffect(() => {
    const hasHint =
      Boolean(adminTokenRef.current) ||
      (typeof window !== 'undefined' &&
        (window.location.pathname.startsWith('/admin') ||
          document.cookie.includes('norva_admin_token')));

    if (hasHint) {
      ensureAdminSessionChecked();
    } else {
      setIsAdminAuthChecking(false);
    }
  }, [ensureAdminSessionChecked]);

  // 4. Real-Time Authenticated Admin WebSocket + Polling Fallback
  useEffect(() => {
    if (!adminSession) {
      setIsRealtimeConnected(false);
      return;
    }

    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;

    const refreshAnalyticsQuietly = () => {
      fetch('/api/admin/analytics', {
        method: 'GET',
        credentials: 'include',
        headers: buildAdminHeaders(adminTokenRef.current),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!disposed && d?.ok && d.analytics) {
            setSalesAnalytics(d.analytics);
          }
        })
        .catch(() => {});
    };

    const handleRealtimeMessage = (rawData: string) => {
      try {
        const msg = JSON.parse(rawData);
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'init' && Array.isArray(msg.orders)) {
          const synced = sortOrdersNewestFirst(
            (msg.orders as PlacedOrder[]).map(resolveCatalogOrderImages),
          );
          setAdminOrders(synced);
          if (typeof msg.unseenCount === 'number') {
            setUnseenOrderCount(msg.unseenCount);
          }
        } else if (msg.type === 'order:created' && msg.order) {
          const incoming = resolveCatalogOrderImages(msg.order as PlacedOrder);
          setAdminOrders((prev) => {
            const exists = prev.some((o) => o.orderNumber === incoming.orderNumber);
            const next = exists
              ? prev.map((o) => (o.orderNumber === incoming.orderNumber ? incoming : o))
              : [incoming, ...prev];
            return sortOrdersNewestFirst(next);
          });
          if (typeof msg.unseenCount === 'number') setUnseenOrderCount(msg.unseenCount);
          if (msg.productOverrides) setProductOverrides(msg.productOverrides);
          if (Array.isArray(msg.coupons)) setAdminCoupons(msg.coupons);
          refreshAnalyticsQuietly();
          showToast(
            `New Order ${incoming.orderNumber} (${formatPKR(incoming.total)}) from ${incoming.customer.fullName}`,
          );
        } else if (msg.type === 'order:updated' && msg.order) {
          const updated = resolveCatalogOrderImages(msg.order as PlacedOrder);
          setAdminOrders((prev) =>
            sortOrdersNewestFirst(
              prev.map((o) => (o.orderNumber === updated.orderNumber ? updated : o)),
            ),
          );
          if (typeof msg.unseenCount === 'number') setUnseenOrderCount(msg.unseenCount);
          if (msg.productOverrides) setProductOverrides(msg.productOverrides);
          refreshAnalyticsQuietly();
        } else if (msg.type === 'order:deleted' && typeof msg.orderNumber === 'string') {
          setAdminOrders((prev) => prev.filter((o) => o.orderNumber !== msg.orderNumber));
          if (typeof msg.unseenCount === 'number') setUnseenOrderCount(msg.unseenCount);
          refreshAnalyticsQuietly();
        } else if (msg.type === 'orders:marked-seen') {
          setAdminOrders((prev) => prev.map((o) => ({ ...o, isNew: false })));
          setUnseenOrderCount(0);
        } else if (msg.type === 'inquiry:created' && msg.inquiry) {
          const inq = msg.inquiry as ConciergeInquiry;
          setInquiries((prev) => (prev.some((i) => i.id === inq.id) ? prev : [inq, ...prev]));
        } else if (msg.type === 'subscriber:created' && typeof msg.email === 'string') {
          setSubscribers((prev) => (prev.includes(msg.email) ? prev : [msg.email, ...prev]));
        } else if (msg.type === 'products:updated' && msg.productOverrides) {
          setProductOverrides(msg.productOverrides);
        } else if (msg.type === 'shipping:updated' && Array.isArray(msg.shippingRates)) {
          setAdminShippingRates(msg.shippingRates);
          setShippingRates(msg.shippingRates.filter((r: ShippingRateConfig) => r.active));
        } else if (msg.type === 'coupons:updated' && Array.isArray(msg.coupons)) {
          setAdminCoupons(msg.coupons);
        } else if (msg.type === 'review:created' && msg.review) {
          const rev = msg.review as ProductReview & {
            productId: string;
            verifiedPurchase?: boolean;
          };
          setCustomReviews((prev) => {
            const existing = prev[rev.productId] ?? [];
            if (existing.some((x) => x.id === rev.id)) return prev;
            return { ...prev, [rev.productId]: [rev, ...existing] };
          });
        } else if (msg.type === 'reviews:updated' && msg.reviewsByProduct) {
          setCustomReviews(msg.reviewsByProduct);
        }
      } catch {
        // Ignore malformed frames
      }
    };

    const connectWs = () => {
      if (disposed) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const qs = adminTokenRef.current
          ? `?token=${encodeURIComponent(adminTokenRef.current)}`
          : '';
        ws = new WebSocket(`${protocol}//${window.location.host}/api/admin/ws${qs}`);

        ws.onopen = () => {
          if (!disposed) setIsRealtimeConnected(true);
        };

        ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            handleRealtimeMessage(event.data);
          }
        };

        ws.onclose = () => {
          if (disposed) return;
          setIsRealtimeConnected(false);
          reconnectTimer = window.setTimeout(connectWs, 3500);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        setIsRealtimeConnected(false);
        reconnectTimer = window.setTimeout(connectWs, 5000);
      }
    };

    connectWs();

    const syncInterval = window.setInterval(async () => {
      if (disposed || document.visibilityState === 'hidden') return;
      try {
        const res = await fetch('/api/admin/orders', {
          method: 'GET',
          credentials: 'include',
          headers: buildAdminHeaders(adminTokenRef.current),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.ok && Array.isArray(data.orders)) {
          const fresh = sortOrdersNewestFirst(
            (data.orders as PlacedOrder[]).map(resolveCatalogOrderImages),
          );
          setAdminOrders(fresh);
          if (typeof data.unseenCount === 'number') {
            setUnseenOrderCount(data.unseenCount);
          }
        }
      } catch {
        // Ignore background poll error
      }
    }, 8000);

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.clearInterval(syncInterval);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [adminSession, buildAdminHeaders, showToast]);

  const products = useMemo<HydratedCatalogProduct[]>(() => {
    return PRODUCTS.map((base) => {
      const ov = productOverrides[base.id];
      const nextPrice = ov?.price ?? base.sizes[0].price;
      const stockUnits = ov?.stockUnits ?? 48;
      const lowStockThreshold = ov?.lowStockThreshold ?? 10;
      const inStock = (ov?.inStock ?? true) && stockUnits > 0;
      const isLowStock = inStock && stockUnits <= lowStockThreshold;
      return {
        ...base,
        isBestSeller: ov?.isBestSeller ?? base.isBestSeller,
        isNewArrival: ov?.isNewArrival ?? base.isNewArrival,
        inStock,
        stockUnits,
        lowStockThreshold,
        isLowStock,
        sizes: base.sizes.map((s, idx) => (idx === 0 ? { ...s, price: nextPrice } : s)),
      };
    });
  }, [productOverrides]);

  const productsRef = useRef<HydratedCatalogProduct[]>([]);
  productsRef.current = products;

  const lowStockProducts = useMemo(
    () => products.filter((p) => !p.inStock || p.stockUnits <= p.lowStockThreshold),
    [products],
  );

  const calculateCityShipping = useCallback(
    (
      city: string,
      speed: 'standard' | 'express',
      subtotal: number,
    ): { cost: number; matchedRate: ShippingRateConfig } => {
      const clean = city.trim().toLowerCase();
      const exact = shippingRates.find(
        (r) => r.active && r.cityKey !== '__default__' && r.cityKey === clean,
      );
      const fallback =
        shippingRates.find((r) => r.cityKey === '__default__') ??
        FALLBACK_SHIPPING_RATES[FALLBACK_SHIPPING_RATES.length - 1];
      const rate = exact ?? fallback;

      if (subtotal <= 0) {
        return { cost: 0, matchedRate: rate };
      }
      if (speed === 'express') {
        return { cost: rate.expressFee, matchedRate: rate };
      }
      if (rate.freeShippingThreshold > 0 && subtotal >= rate.freeShippingThreshold) {
        return { cost: 0, matchedRate: rate };
      }
      return { cost: rate.standardFee, matchedRate: rate };
    },
    [shippingRates],
  );

  const validateCoupon = useCallback(
    async (
      code: string,
      subtotal: number,
    ): Promise<{
      ok: boolean;
      coupon?: CouponConfig;
      discountAmount?: number;
      error?: string;
    }> => {
      try {
        const { res, data } = await postJsonResilient('/api/coupons/validate', {
          code,
          subtotal,
        });
        if (!res.ok || !data?.ok) {
          return {
            ok: false,
            error: extractApiErrorMessage(data, 'Invalid or expired coupon code.'),
          };
        }
        return {
          ok: true,
          coupon: data.coupon as CouponConfig,
          discountAmount: Number(data.discountAmount) || 0,
        };
      } catch {
        return {
          ok: false,
          error: 'Unable to validate coupon right now. Please check your connection.',
        };
      }
    },
    [],
  );

  const trackOrder = useCallback(
    async (
      orderNumber: string,
      phone: string,
    ): Promise<{ ok: boolean; order?: PlacedOrder; error?: string }> => {
      try {
        const { res, data } = await postJsonResilient('/api/orders/track', {
          orderNumber,
          phone,
        });
        if (!res.ok || !data?.ok || !data.order) {
          return {
            ok: false,
            error: extractApiErrorMessage(
              data,
              'No matching order found for that Order Number and Phone Number.',
            ),
          };
        }
        return {
          ok: true,
          order: resolveCatalogOrderImages(data.order as PlacedOrder),
        };
      } catch {
        return {
          ok: false,
          error: 'Could not reach NORVA order tracking service. Please retry.',
        };
      }
    },
    [],
  );

  const addToCart = useCallback(
    (product: CatalogProduct, sizeIdx = 0, quantity = 1, openDrawer = true) => {
      const liveProd = productsRef.current.find((p) => p.id === product.id);
      const inStock = liveProd ? liveProd.inStock : true;
      const maxStock = liveProd ? liveProd.stockUnits : 48;

      if (!inStock || maxStock <= 0) {
        showToast(`${product.name} is currently out of stock`);
        return;
      }

      const targetProd = liveProd ?? product;
      const safeIdx = Math.min(targetProd.sizes.length - 1, Math.max(0, sizeIdx));
      const sizeOpt = targetProd.sizes[safeIdx];
      const key = `${targetProd.id}__${sizeOpt.sku}`;

      setCart((prev) => {
        const existing = prev.find((item) => item.key === key);
        const currentQty = existing?.quantity ?? 0;
        const nextQty = Math.min(maxStock, currentQty + quantity);
        if (currentQty + quantity > maxStock) {
          showToast(`Maximum available stock (${maxStock}) reached for ${targetProd.name}`);
        }
        if (existing) {
          return prev.map((item) =>
            item.key === key
              ? { ...item, unitPrice: sizeOpt.price, quantity: nextQty }
              : item,
          );
        }
        return [
          ...prev,
          {
            key,
            productId: targetProd.id,
            slug: targetProd.slug,
            name: targetProd.name,
            concentration: targetProd.concentration,
            image: targetProd.primaryImage,
            sizeLabel: sizeOpt.label,
            sizeSku: sizeOpt.sku,
            unitPrice: sizeOpt.price,
            quantity: Math.min(maxStock, quantity),
          },
        ];
      });

      if (openDrawer) {
        setIsCartOpen(true);
      } else {
        showToast(`${targetProd.name} (${sizeOpt.label}) added to bag`);
      }
    },
    [showToast],
  );

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const updateCartQuantity = useCallback(
    (key: string, quantity: number) => {
      if (quantity <= 0) {
        setCart((prev) => prev.filter((item) => item.key !== key));
        return;
      }
      setCart((prev) =>
        prev.map((item) => {
          if (item.key !== key) return item;
          const liveProd = productsRef.current.find((p) => p.id === item.productId);
          const maxStock = liveProd ? Math.max(1, liveProd.stockUnits) : 99;
          if (quantity > maxStock) {
            showToast(`Only ${maxStock} flacon(s) of ${item.name} available in stock`);
          }
          return { ...item, quantity: Math.min(maxStock, quantity) };
        }),
      );
    },
    [showToast],
  );

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const toggleWishlist = useCallback(
    (productId: string) => {
      const prod = productsRef.current.find((p) => p.id === productId);
      setWishlist((prev) => {
        const exists = prev.includes(productId);
        if (exists) {
          showToast(`Removed ${prod?.name ?? 'item'} from wishlist`);
          return prev.filter((id) => id !== productId);
        }
        showToast(`Saved ${prod?.name ?? 'item'} to wishlist`);
        return [...prev, productId];
      });

      // Persist wishlist toggle in SQLite backend
      fetch(`/api/wishlist/${encodeURIComponent(clientIdRef.current)}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      }).catch(() => {});
    },
    [showToast],
  );

  const wishlistSet = useMemo<ReadonlySet<string>>(() => new Set(wishlist), [wishlist]);
  const isInWishlist = useCallback((productId: string) => wishlistSet.has(productId), [wishlistSet]);

  const updateProfile = useCallback((partial: Partial<CustomerProfile>) => {
    setProfile((prev) => ({ ...prev, ...partial }));
  }, []);

  // =========================================================================
  // PERSISTENT BACKEND ORDER CREATION (WITH DUPLICATE PREVENTION & STOCK SYNC)
  // =========================================================================
  const placeOrder = useCallback(
    async (
      orderInput: Omit<PlacedOrder, 'orderNumber' | 'createdAt' | 'status' | 'paymentStatus'> & {
        idempotencyKey?: string;
      },
    ): Promise<PlacedOrder> => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);

      // Strip any oversized inline base64 data URLs so POST payload stays < 2KB
      const compactPayload = {
        ...orderInput,
        items: orderInput.items.map((item) => ({
          ...item,
          image:
            typeof item.image === 'string' && item.image.length <= 2048 ? item.image : '',
        })),
      };

      try {
        const { res, data } = await postJsonResilient(
          '/api/orders',
          compactPayload,
          controller.signal,
          2,
        );

        if (!res.ok || !data?.ok || !data.order) {
          const fallbackMsg =
            res.status >= 500
              ? `NORVA order server returned HTTP ${res.status}. Please wait a moment and tap Confirm Order again.`
              : `Order submission could not be completed (HTTP ${res.status}). Please verify your delivery details and try again.`;
          throw new Error(extractApiErrorMessage(data, fallbackMsg));
        }

        const savedOrder: PlacedOrder = {
          ...resolveCatalogOrderImages(data.order as PlacedOrder),
          duplicatePrevented: Boolean(data.duplicatePrevented),
        };
        const lookupToken = typeof data.lookupToken === 'string' ? data.lookupToken : null;

        if (data.productOverrides) {
          setProductOverrides(data.productOverrides);
        }

        if (lookupToken) {
          setBuyerOrderTokens((prev) => [lookupToken, ...prev.filter((t) => t !== lookupToken)]);
        }

        setOrders((prev) =>
          sortOrdersNewestFirst([
            savedOrder,
            ...prev.filter((o) => o.orderNumber !== savedOrder.orderNumber),
          ]),
        );

        if (adminSession) {
          const adminCopy: PlacedOrder = { ...savedOrder, isNew: true, adminNotes: '' };
          setAdminOrders((prev) => {
            if (prev.some((o) => o.orderNumber === adminCopy.orderNumber)) return prev;
            return sortOrdersNewestFirst([adminCopy, ...prev]);
          });
        }

        setProfile(orderInput.customer);
        setCart([]);
        return savedOrder;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error(
            'Order request timed out. Please check your connection and tap Confirm Order again — duplicate protection is active.',
          );
        }
        if (err instanceof Error) {
          if (err.message === '[object Object]') {
            throw new Error(
              'Unable to complete your order right now. Please verify your delivery details and tap Confirm Order again.',
            );
          }
          throw err;
        }
        throw new Error(
          extractApiErrorMessage(
            err,
            'Unable to submit order right now. Please check your connection and try again.',
          ),
        );
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    [adminSession],
  );

  const addProductReview = useCallback(
    async (
      productId: string,
      reviewInput: Omit<ProductReview, 'id' | 'date'> & { orderNumber?: string },
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reviewInput),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !data.review) {
          const errMsg = extractApiErrorMessage(data, 'Unable to publish review right now.');
          showToast(errMsg);
          return { ok: false, error: errMsg };
        }
        const saved = data.review as ProductReview & { verifiedPurchase?: boolean };
        setCustomReviews((prev) => ({
          ...prev,
          [productId]: [
            saved,
            ...(prev[productId] ?? []).filter((r) => r.id !== saved.id),
          ],
        }));
        showToast('Thank you — your review has been saved');
        return { ok: true };
      } catch {
        const errMsg = 'Network error while submitting review.';
        showToast(errMsg);
        return { ok: false, error: errMsg };
      }
    },
    [showToast],
  );

  const deleteProductReview = useCallback(
    async (productId: string, reviewId: string) => {
      try {
        const res = await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: buildAdminHeaders(),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok) {
          if (data.reviewsByProduct) {
            setCustomReviews(data.reviewsByProduct);
          } else {
            setCustomReviews((prev) => ({
              ...prev,
              [productId]: (prev[productId] ?? []).filter((r) => r.id !== reviewId),
            }));
          }
          showToast('Review removed');
        }
      } catch {
        showToast('Failed to remove review');
      }
    },
    [buildAdminHeaders, showToast],
  );

  const addInquiry = useCallback(
    (inquiry: Omit<ConciergeInquiry, 'id' | 'createdAt' | 'resolved'>) => {
      fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inquiry),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.ok && data.inquiry && adminSession) {
            setInquiries((prev) =>
              prev.some((i) => i.id === data.inquiry.id) ? prev : [data.inquiry, ...prev],
            );
          }
        })
        .catch(() => {});
    },
    [adminSession],
  );

  const toggleInquiryResolved = useCallback(
    (id: string) => {
      fetch(`/api/admin/inquiries/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: buildAdminHeaders(),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.ok) {
            setInquiries((prev) =>
              prev.map((item) => (item.id === id ? { ...item, resolved: data.resolved } : item)),
            );
          }
        })
        .catch(() => {});
    },
    [buildAdminHeaders],
  );

  const addSubscriber = useCallback(
    (email: string) => {
      const clean = email.trim().toLowerCase();
      if (!clean) return;
      fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.ok && adminSession) {
            setSubscribers((prev) => (prev.includes(clean) ? prev : [clean, ...prev]));
          }
        })
        .catch(() => {});
    },
    [adminSession],
  );

  // =========================================================================
  // SERVER-VERIFIED ADMIN AUTHENTICATION & MANAGEMENT
  // =========================================================================
  const loginAdmin = useCallback(
    async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !data.session) {
          if (!data && (res.status === 404 || res.status === 405)) {
            return {
              ok: false,
              error: `Backend API (/api/admin/login) returned HTTP ${res.status}. Ensure the Node API server is deployed alongside the frontend.`,
            };
          }
          if (!data && res.status >= 500) {
            return {
              ok: false,
              error: 'Authentication server is synchronizing. Please tap Access Admin Console again to sign in.',
            };
          }
          return {
            ok: false,
            error: extractApiErrorMessage(data, 'Invalid administrator username or password.'),
          };
        }

        const tok = typeof data.token === 'string' ? data.token : null;
        adminTokenRef.current = tok;
        setAdminToken(tok);
        setAdminSession(data.session);

        await fetchAdminDashboardData(tok);
        showToast(
          `Signed in to NORVA Admin as ${data.session.username || data.session.email}`,
        );
        return { ok: true };
      } catch {
        return {
          ok: false,
          error: 'Could not reach NORVA authentication server. Please retry.',
        };
      }
    },
    [fetchAdminDashboardData, showToast],
  );

  const activateOrResetAdmin = useCallback(
    async (params: {
      setupToken: string;
      username: string;
      password: string;
    }): Promise<{ ok: boolean; message?: string; error?: string }> => {
      try {
        const res = await fetch('/api/admin/activate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-setup-token': params.setupToken.trim(),
          },
          body: JSON.stringify({
            username: params.username.trim(),
            password: params.password,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          return {
            ok: false,
            error: extractApiErrorMessage(
              data,
              `Owner initialization failed (HTTP ${res.status}). Verify ADMIN_SETUP_TOKEN in Server Secrets.`,
            ),
          };
        }
        showToast('Owner credentials initialized securely');
        return { ok: true, message: data.message };
      } catch {
        return {
          ok: false,
          error: 'Could not reach NORVA server to initialize owner account.',
        };
      }
    },
    [showToast],
  );

  const changeAdminPassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/admin/change-password', {
          method: 'POST',
          credentials: 'include',
          headers: buildAdminHeaders(),
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          return {
            ok: false,
            error: extractApiErrorMessage(data, 'Unable to update administrator password.'),
          };
        }
        showToast('Administrator password updated securely');
        return { ok: true };
      } catch {
        return {
          ok: false,
          error: 'Network error while updating administrator password.',
        };
      }
    },
    [buildAdminHeaders, showToast],
  );

  const logoutAdmin = useCallback(async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: buildAdminHeaders(),
      });
    } catch {}
    adminTokenRef.current = null;
    setAdminToken(null);
    setAdminSession(null);
    setAdminOrders([]);
    setUnseenOrderCount(0);
    setInquiries([]);
    setSubscribers([]);
    setSalesAnalytics(null);
    setAdminBackups([]);
    showToast('Signed out of NORVA Admin');
  }, [buildAdminHeaders, showToast]);

  const refreshAdminOrders = useCallback(async () => {
    await fetchAdminDashboardData();
  }, [fetchAdminDashboardData]);

  const updateOrderAdmin = useCallback(
    async (orderNumber: string, patch: OrderAdminPatch): Promise<PlacedOrder | null> => {
      try {
        const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderNumber)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: buildAdminHeaders(),
          body: JSON.stringify(patch),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !data.order) {
          showToast(extractApiErrorMessage(data, `Failed to update ${orderNumber}`));
          return null;
        }
        const updated = resolveCatalogOrderImages(data.order as PlacedOrder);
        setAdminOrders((prev) =>
          sortOrdersNewestFirst(
            prev.map((ord) => (ord.orderNumber === orderNumber ? updated : ord)),
          ),
        );
        if (typeof data.unseenCount === 'number') {
          setUnseenOrderCount(data.unseenCount);
        }
        if (data.productOverrides) {
          setProductOverrides(data.productOverrides);
        }
        setOrders((prev) =>
          prev.map((ord) =>
            ord.orderNumber === orderNumber
              ? {
                  ...ord,
                  status: updated.status,
                  paymentStatus: updated.paymentStatus,
                }
              : ord,
          ),
        );
        return updated;
      } catch {
        showToast(`Network error while updating ${orderNumber}`);
        return null;
      }
    },
    [buildAdminHeaders, showToast],
  );

  const updateOrderStatus = useCallback(
    async (orderNumber: string, status: OrderStatus): Promise<boolean> => {
      const updated = await updateOrderAdmin(orderNumber, { status, isSeenByAdmin: true });
      if (updated) {
        showToast(`Order ${orderNumber} marked as ${status}`);
        return true;
      }
      return false;
    },
    [showToast, updateOrderAdmin],
  );

  const updateOrderPaymentStatus = useCallback(
    async (orderNumber: string, paymentStatus: PaymentStatus): Promise<boolean> => {
      const updated = await updateOrderAdmin(orderNumber, { paymentStatus, isSeenByAdmin: true });
      if (updated) {
        showToast(`Order ${orderNumber} payment set to ${paymentStatus}`);
        return true;
      }
      return false;
    },
    [showToast, updateOrderAdmin],
  );

  const markOrderSeen = useCallback(
    async (orderNumber: string): Promise<void> => {
      const target = adminOrders.find((o) => o.orderNumber === orderNumber);
      if (!target || !target.isNew) return;
      await updateOrderAdmin(orderNumber, { isSeenByAdmin: true });
    },
    [adminOrders, updateOrderAdmin],
  );

  const markAllOrdersSeen = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders/mark-all-seen', {
        method: 'POST',
        credentials: 'include',
        headers: buildAdminHeaders(),
      });
      if (res.ok) {
        setAdminOrders((prev) => prev.map((o) => ({ ...o, isNew: false })));
        setUnseenOrderCount(0);
        showToast('All new orders marked as reviewed');
      }
    } catch {}
  }, [buildAdminHeaders, showToast]);

  const deleteOrder = useCallback(
    async (orderNumber: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderNumber)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: buildAdminHeaders(),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          showToast(extractApiErrorMessage(data, `Unable to remove ${orderNumber}`));
          return false;
        }
        setAdminOrders((prev) => prev.filter((ord) => ord.orderNumber !== orderNumber));
        setOrders((prev) => prev.filter((ord) => ord.orderNumber !== orderNumber));
        if (typeof data.unseenCount === 'number') {
          setUnseenOrderCount(data.unseenCount);
        }
        showToast(`Order ${orderNumber} permanently deleted`);
        return true;
      } catch {
        showToast(`Network error while removing ${orderNumber}`);
        return false;
      }
    },
    [buildAdminHeaders, showToast],
  );

  const updateProductOverride = useCallback(
    (productId: string, patch: ProductAdminOverride) => {
      fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: buildAdminHeaders(),
        body: JSON.stringify(patch),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.ok && data.productOverrides) {
            setProductOverrides(data.productOverrides);
            showToast('Inventory & catalog updated');
          }
        })
        .catch(() => {
          showToast('Failed to update product catalog');
        });
    },
    [buildAdminHeaders, showToast],
  );

  const resetProductOverrides = useCallback(() => {
    fetch('/api/admin/products/reset', {
      method: 'POST',
      credentials: 'include',
      headers: buildAdminHeaders(),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ok) {
          setProductOverrides(data.productOverrides ?? {});
          showToast('All 5 fragrances restored to PKR 2,500 and 48 stock units');
        }
      })
      .catch(() => {});
  }, [buildAdminHeaders, showToast]);

  // Admin City Shipping Rates
  const saveAdminShippingRate = useCallback(
    async (
      rate: Omit<ShippingRateConfig, 'cityKey'> & { cityKey?: string },
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/admin/shipping-rates', {
          method: 'POST',
          credentials: 'include',
          headers: buildAdminHeaders(),
          body: JSON.stringify(rate),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !Array.isArray(data.shippingRates)) {
          return {
            ok: false,
            error: extractApiErrorMessage(data, 'Failed to save shipping rate.'),
          };
        }
        setAdminShippingRates(data.shippingRates);
        setShippingRates(data.shippingRates.filter((r: ShippingRateConfig) => r.active));
        showToast(`Saved shipping rate for ${rate.cityName}`);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while saving shipping rate.' };
      }
    },
    [buildAdminHeaders, showToast],
  );

  const deleteAdminShippingRate = useCallback(
    async (cityKey: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch(`/api/admin/shipping-rates/${encodeURIComponent(cityKey)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: buildAdminHeaders(),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !Array.isArray(data.shippingRates)) {
          const errMsg = extractApiErrorMessage(data, 'Unable to delete shipping rate.');
          showToast(errMsg);
          return { ok: false, error: errMsg };
        }
        setAdminShippingRates(data.shippingRates);
        setShippingRates(data.shippingRates.filter((r: ShippingRateConfig) => r.active));
        showToast('City shipping rate removed');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while deleting shipping rate.' };
      }
    },
    [buildAdminHeaders, showToast],
  );

  // Admin Coupons
  const saveAdminCoupon = useCallback(
    async (coupon: Omit<CouponConfig, 'usedCount'>): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/admin/coupons', {
          method: 'POST',
          credentials: 'include',
          headers: buildAdminHeaders(),
          body: JSON.stringify(coupon),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !Array.isArray(data.coupons)) {
          return {
            ok: false,
            error: extractApiErrorMessage(data, 'Failed to save coupon code.'),
          };
        }
        setAdminCoupons(data.coupons);
        showToast(`Coupon ${coupon.code.toUpperCase()} saved`);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while saving coupon.' };
      }
    },
    [buildAdminHeaders, showToast],
  );

  const toggleAdminCoupon = useCallback(
    async (code: string, active: boolean): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: buildAdminHeaders(),
          body: JSON.stringify({ active }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !Array.isArray(data.coupons)) return false;
        setAdminCoupons(data.coupons);
        showToast(`Coupon ${code} ${active ? 'activated' : 'paused'}`);
        return true;
      } catch {
        return false;
      }
    },
    [buildAdminHeaders, showToast],
  );

  const deleteAdminCoupon = useCallback(
    async (code: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: buildAdminHeaders(),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !Array.isArray(data.coupons)) return false;
        setAdminCoupons(data.coupons);
        showToast(`Coupon ${code} deleted`);
        return true;
      } catch {
        return false;
      }
    },
    [buildAdminHeaders, showToast],
  );

  // Admin Database Backups
  const createAdminBackup = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        credentials: 'include',
        headers: buildAdminHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        return {
          ok: false,
          error: extractApiErrorMessage(data, 'Failed to create database backup.'),
        };
      }
      if (Array.isArray(data.backups)) {
        setAdminBackups(data.backups);
      }
      showToast(`Created database snapshot ${data.backup?.filename ?? ''}`);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while creating backup.' };
    }
  }, [buildAdminHeaders, showToast]);

  const downloadAdminBackup = useCallback(
    async (filename: string): Promise<void> => {
      try {
        const res = await fetch(
          `/api/admin/backups/${encodeURIComponent(filename)}/download`,
          {
            method: 'GET',
            credentials: 'include',
            headers: buildAdminHeaders(),
          },
        );
        if (!res.ok) {
          showToast('Unable to download database snapshot');
          return;
        }
        const blob = await res.blob();
        triggerBlobDownload(blob, filename);
        showToast(`Downloaded ${filename}`);
      } catch {
        showToast('Network error while downloading backup');
      }
    },
    [buildAdminHeaders, showToast],
  );

  const exportAdminJsonBackup = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/admin/backups/export-json', {
        method: 'GET',
        credentials: 'include',
        headers: buildAdminHeaders(),
      });
      if (!res.ok) {
        showToast('Unable to export JSON backup');
        return;
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      triggerBlobDownload(blob, `norva_backup_${stamp}.json`);
      showToast('Exported complete store backup (.json)');
    } catch {
      showToast('Network error while exporting JSON backup');
    }
  }, [buildAdminHeaders, showToast]);

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart],
  );
  const cartSubtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0),
    [cart],
  );

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const openQuickView = useCallback((p: CatalogProduct) => setQuickViewProduct(p), []);
  const closeQuickView = useCallback(() => setQuickViewProduct(null), []);

  const overlayValue = useMemo<OverlayStateValue>(
    () => ({
      isCartOpen,
      isSearchOpen,
      quickViewProduct,
      openCart,
      closeCart,
      openSearch,
      closeSearch,
      openQuickView,
      closeQuickView,
    }),
    [
      isCartOpen,
      isSearchOpen,
      quickViewProduct,
      openCart,
      closeCart,
      openSearch,
      closeSearch,
      openQuickView,
      closeQuickView,
    ],
  );

  const headerCountsValue = useMemo<HeaderCountsValue>(
    () => ({
      cartCount,
      wishlistCount: wishlist.length,
      unseenOrderCount,
      hasAdminSession: Boolean(adminSession),
    }),
    [cartCount, wishlist.length, unseenOrderCount, adminSession],
  );

  const catalogActionsValue = useMemo<CatalogActionsValue>(
    () => ({
      addToCart,
      toggleWishlist,
      openQuickView,
      addSubscriber,
      showToast,
    }),
    [addToCart, toggleWishlist, openQuickView, addSubscriber, showToast],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      products,
      lowStockProducts,
      productOverrides,
      shippingRates,
      cart,
      wishlist,
      orders,
      adminOrders,
      adminCoupons,
      adminShippingRates,
      salesAnalytics,
      adminBackups,
      unseenOrderCount,
      isAdminAuthChecking,
      isAdminLoading,
      isRealtimeConnected,
      profile,
      customReviews,
      inquiries,
      subscribers,
      adminSession,
      isCartOpen,
      isSearchOpen,
      quickViewProduct,
      toastMessage,
      openCart,
      closeCart,
      openSearch,
      closeSearch,
      openQuickView,
      closeQuickView,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      toggleWishlist,
      isInWishlist,
      calculateCityShipping,
      validateCoupon,
      trackOrder,
      updateProfile,
      placeOrder,
      refreshBuyerOrders,
      addProductReview,
      deleteProductReview,
      addInquiry,
      toggleInquiryResolved,
      addSubscriber,
      loginAdmin,
      activateOrResetAdmin,
      changeAdminPassword,
      logoutAdmin,
      ensureAdminSessionChecked,
      refreshAdminOrders,
      updateOrderStatus,
      updateOrderPaymentStatus,
      updateOrderAdmin,
      markOrderSeen,
      markAllOrdersSeen,
      deleteOrder,
      updateProductOverride,
      resetProductOverrides,
      saveAdminShippingRate,
      deleteAdminShippingRate,
      saveAdminCoupon,
      toggleAdminCoupon,
      deleteAdminCoupon,
      createAdminBackup,
      downloadAdminBackup,
      exportAdminJsonBackup,
      showToast,
      cartCount,
      cartSubtotal,
    }),
    [
      products,
      lowStockProducts,
      productOverrides,
      shippingRates,
      cart,
      wishlist,
      orders,
      adminOrders,
      adminCoupons,
      adminShippingRates,
      salesAnalytics,
      adminBackups,
      unseenOrderCount,
      isAdminAuthChecking,
      isAdminLoading,
      isRealtimeConnected,
      profile,
      customReviews,
      inquiries,
      subscribers,
      adminSession,
      isCartOpen,
      isSearchOpen,
      quickViewProduct,
      toastMessage,
      openCart,
      closeCart,
      openSearch,
      closeSearch,
      openQuickView,
      closeQuickView,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      toggleWishlist,
      isInWishlist,
      calculateCityShipping,
      validateCoupon,
      trackOrder,
      updateProfile,
      placeOrder,
      refreshBuyerOrders,
      addProductReview,
      deleteProductReview,
      addInquiry,
      toggleInquiryResolved,
      addSubscriber,
      loginAdmin,
      activateOrResetAdmin,
      changeAdminPassword,
      logoutAdmin,
      ensureAdminSessionChecked,
      refreshAdminOrders,
      updateOrderStatus,
      updateOrderPaymentStatus,
      updateOrderAdmin,
      markOrderSeen,
      markAllOrdersSeen,
      deleteOrder,
      updateProductOverride,
      resetProductOverrides,
      saveAdminShippingRate,
      deleteAdminShippingRate,
      saveAdminCoupon,
      toggleAdminCoupon,
      deleteAdminCoupon,
      createAdminBackup,
      downloadAdminBackup,
      exportAdminJsonBackup,
      showToast,
      cartCount,
      cartSubtotal,
    ],
  );

  return (
    <ToastContext.Provider value={toastMessage}>
      <OverlayStateContext.Provider value={overlayValue}>
        <HeaderCountsContext.Provider value={headerCountsValue}>
          <WishlistSetContext.Provider value={wishlistSet}>
            <CatalogActionsContext.Provider value={catalogActionsValue}>
              <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
            </CatalogActionsContext.Provider>
          </WishlistSetContext.Provider>
        </HeaderCountsContext.Provider>
      </OverlayStateContext.Provider>
    </ToastContext.Provider>
  );
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function useToastMessage(): string | null {
  return useContext(ToastContext);
}

export function useOverlayState(): OverlayStateValue {
  const ctx = useContext(OverlayStateContext);
  if (!ctx) throw new Error('useOverlayState must be used inside StoreProvider');
  return ctx;
}

export function useHeaderCounts(): HeaderCountsValue {
  const ctx = useContext(HeaderCountsContext);
  if (!ctx) throw new Error('useHeaderCounts must be used inside StoreProvider');
  return ctx;
}

export function useWishlistSet(): ReadonlySet<string> {
  return useContext(WishlistSetContext);
}

export function useCatalogActions(): CatalogActionsValue {
  const ctx = useContext(CatalogActionsContext);
  if (!ctx) throw new Error('useCatalogActions must be used inside StoreProvider');
  return ctx;
}
