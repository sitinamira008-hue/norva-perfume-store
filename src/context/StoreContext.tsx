import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CatalogProduct, PRODUCTS, ProductReview } from '../data/products';

export type OrderStatus = 'Pending' | 'Processing' | 'Dispatched' | 'Delivered' | 'Cancelled';

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
  status?: OrderStatus;
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
}

export interface ProductAdminOverride {
  price?: number;
  stockUnits?: number;
  inStock?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
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
  email: string;
  loggedInAt: string;
}

interface StoreContextValue {
  products: (CatalogProduct & { inStock: boolean; stockUnits: number })[];
  productOverrides: Record<string, ProductAdminOverride>;
  cart: CartItem[];
  wishlist: string[];
  orders: PlacedOrder[];
  profile: CustomerProfile;
  customReviews: Record<string, ProductReview[]>;
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

  addToCart: (product: CatalogProduct, sizeIdx?: number, quantity?: number, openDrawer?: boolean) => void;
  removeFromCart: (key: string) => void;
  updateCartQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;

  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;

  updateProfile: (partial: Partial<CustomerProfile>) => void;
  placeOrder: (order: Omit<PlacedOrder, 'orderNumber' | 'createdAt'>) => PlacedOrder;
  addProductReview: (productId: string, review: Omit<ProductReview, 'id' | 'date'>) => void;
  deleteProductReview: (productId: string, reviewId: string) => void;
  addInquiry: (inquiry: Omit<ConciergeInquiry, 'id' | 'createdAt' | 'resolved'>) => void;
  toggleInquiryResolved: (id: string) => void;
  addSubscriber: (email: string) => void;

  // Admin Methods
  loginAdmin: (email: string, password: string) => { ok: boolean; error?: string };
  logoutAdmin: () => void;
  updateOrderStatus: (orderNumber: string, status: OrderStatus) => void;
  deleteOrder: (orderNumber: string) => void;
  updateProductOverride: (productId: string, patch: ProductAdminOverride) => void;
  resetProductOverrides: () => void;

  showToast: (msg: string) => void;

  cartCount: number;
  cartSubtotal: number;
}

const STORAGE_KEYS = {
  cart: 'norva_cart_v1',
  wishlist: 'norva_wishlist_v1',
  orders: 'norva_orders_v1',
  profile: 'norva_profile_v1',
  reviews: 'norva_reviews_v1',
  overrides: 'norva_product_overrides_v1',
  inquiries: 'norva_inquiries_v1',
  subscribers: 'norva_subscribers_v1',
  admin: 'norva_admin_session_v1',
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
    } catch {}
  }, 0);
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const deduped = new Map<string, CartItem>();
    for (const item of readStorage<CartItem[]>(STORAGE_KEYS.cart, [])) {
      const current = PRODUCTS.find((p) => p.id === item.productId);
      if (!current) {
        deduped.set(item.key, item);
        continue;
      }
      const sz = current.sizes[0];
      const nextKey = `${current.id}__${sz.sku}`;
      const existing = deduped.get(nextKey);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        deduped.set(nextKey, {
          ...item,
          key: nextKey,
          name: current.name,
          slug: current.slug,
          image: current.primaryImage,
          sizeLabel: sz.label,
          sizeSku: sz.sku,
        });
      }
    }
    return Array.from(deduped.values());
  });
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage(STORAGE_KEYS.wishlist, []));
  const [orders, setOrders] = useState<PlacedOrder[]>(() =>
    readStorage<PlacedOrder[]>(STORAGE_KEYS.orders, []).map((ord) => ({
      ...ord,
      items: ord.items.map((it) => {
        const current = PRODUCTS.find((p) => p.id === it.productId);
        if (!current) return it;
        return {
          ...it,
          name: current.name,
          slug: current.slug,
          image: current.primaryImage,
          sizeLabel: current.sizes[0].label,
          sizeSku: current.sizes[0].sku,
        };
      }),
    })),
  );
  const [profile, setProfile] = useState<CustomerProfile>(() =>
    readStorage(STORAGE_KEYS.profile, DEFAULT_PROFILE),
  );
  const [customReviews, setCustomReviews] = useState<Record<string, ProductReview[]>>(() =>
    readStorage(STORAGE_KEYS.reviews, {}),
  );
  const [productOverrides, setProductOverrides] = useState<Record<string, ProductAdminOverride>>(
    () => readStorage(STORAGE_KEYS.overrides, {}),
  );
  const [inquiries, setInquiries] = useState<ConciergeInquiry[]>(() =>
    readStorage(STORAGE_KEYS.inquiries, []),
  );
  const [subscribers, setSubscribers] = useState<string[]>(() =>
    readStorage(STORAGE_KEYS.subscribers, []),
  );
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() =>
    readStorage(STORAGE_KEYS.admin, null),
  );

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<CatalogProduct | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.cart, cart);
  }, [cart]);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.wishlist, wishlist);
  }, [wishlist]);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.orders, orders);
  }, [orders]);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.profile, profile);
  }, [profile]);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.reviews, customReviews);
  }, [customReviews]);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.overrides, productOverrides);
  }, [productOverrides]);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.inquiries, inquiries);
  }, [inquiries]);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.subscribers, subscribers);
  }, [subscribers]);

  useEffect(() => {
    writeStorageDeferred(STORAGE_KEYS.admin, adminSession);
  }, [adminSession]);

  const products = useMemo(() => {
    return PRODUCTS.map((base) => {
      const ov = productOverrides[base.id];
      const nextPrice = ov?.price ?? base.sizes[0].price;
      return {
        ...base,
        isBestSeller: ov?.isBestSeller ?? base.isBestSeller,
        isNewArrival: ov?.isNewArrival ?? base.isNewArrival,
        inStock: ov?.inStock ?? true,
        stockUnits: ov?.stockUnits ?? 48,
        sizes: base.sizes.map((s, idx) => (idx === 0 ? { ...s, price: nextPrice } : s)),
      };
    });
  }, [productOverrides]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const addToCart = useCallback(
    (product: CatalogProduct, sizeIdx = 0, quantity = 1, openDrawer = true) => {
      const liveProd = products.find((p) => p.id === product.id) ?? {
        ...product,
        inStock: true,
        stockUnits: 48,
      };
      if (!liveProd.inStock) {
        showToast(`${liveProd.name} is currently out of stock`);
        return;
      }
      const safeIdx = Math.min(liveProd.sizes.length - 1, Math.max(0, sizeIdx));
      const sizeOpt = liveProd.sizes[safeIdx];
      const key = `${liveProd.id}__${sizeOpt.sku}`;

      setCart((prev) => {
        const existing = prev.find((item) => item.key === key);
        if (existing) {
          return prev.map((item) =>
            item.key === key
              ? { ...item, unitPrice: sizeOpt.price, quantity: item.quantity + quantity }
              : item,
          );
        }
        return [
          ...prev,
          {
            key,
            productId: liveProd.id,
            slug: liveProd.slug,
            name: liveProd.name,
            concentration: liveProd.concentration,
            image: liveProd.primaryImage,
            sizeLabel: sizeOpt.label,
            sizeSku: sizeOpt.sku,
            unitPrice: sizeOpt.price,
            quantity,
          },
        ];
      });

      if (openDrawer) {
        setIsCartOpen(true);
      } else {
        showToast(`${liveProd.name} (${sizeOpt.label}) added to bag`);
      }
    },
    [products, showToast],
  );

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const updateCartQuantity = useCallback((key: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.key !== key));
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.key === key ? { ...item, quantity } : item)),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const toggleWishlist = useCallback(
    (productId: string) => {
      const prod = products.find((p) => p.id === productId);
      setWishlist((prev) => {
        const exists = prev.includes(productId);
        if (exists) {
          showToast(`Removed ${prod?.name ?? 'item'} from wishlist`);
          return prev.filter((id) => id !== productId);
        }
        showToast(`Saved ${prod?.name ?? 'item'} to wishlist`);
        return [...prev, productId];
      });
    },
    [products, showToast],
  );

  const isInWishlist = useCallback((productId: string) => wishlist.includes(productId), [wishlist]);

  const updateProfile = useCallback((partial: Partial<CustomerProfile>) => {
    setProfile((prev) => ({ ...prev, ...partial }));
  }, []);

  const placeOrder = useCallback(
    (orderInput: Omit<PlacedOrder, 'orderNumber' | 'createdAt'>): PlacedOrder => {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const newOrder: PlacedOrder = {
        ...orderInput,
        status: orderInput.status ?? 'Pending',
        orderNumber: `NV-${randomNum}`,
        createdAt: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      };
      setOrders((prev) => [newOrder, ...prev]);
      setProfile(orderInput.customer);
      setCart([]);
      return newOrder;
    },
    [],
  );

  const addProductReview = useCallback(
    (productId: string, reviewInput: Omit<ProductReview, 'id' | 'date'>) => {
      const newReview: ProductReview = {
        ...reviewInput,
        id: `rev-${Date.now()}`,
        date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      };
      setCustomReviews((prev) => ({
        ...prev,
        [productId]: [newReview, ...(prev[productId] ?? [])],
      }));
      showToast('Thank you — your olfactory review has been published');
    },
    [showToast],
  );

  const deleteProductReview = useCallback(
    (productId: string, reviewId: string) => {
      setCustomReviews((prev) => ({
        ...prev,
        [productId]: (prev[productId] ?? []).filter((r) => r.id !== reviewId),
      }));
      showToast('Review removed');
    },
    [showToast],
  );

  const addInquiry = useCallback(
    (inquiry: Omit<ConciergeInquiry, 'id' | 'createdAt' | 'resolved'>) => {
      const entry: ConciergeInquiry = {
        ...inquiry,
        id: `inq-${Date.now()}`,
        createdAt: new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        resolved: false,
      };
      setInquiries((prev) => [entry, ...prev]);
    },
    [],
  );

  const toggleInquiryResolved = useCallback((id: string) => {
    setInquiries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, resolved: !item.resolved } : item)),
    );
  }, []);

  const addSubscriber = useCallback((email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setSubscribers((prev) => (prev.includes(clean) ? prev : [clean, ...prev]));
  }, []);

  // =========================================================================
  // ADMIN AUTHENTICATION & MANAGEMENT (Any Gmail + Password === 'usman122')
  // =========================================================================
  const loginAdmin = useCallback(
    (email: string, password: string): { ok: boolean; error?: string } => {
      const rawEmail = email.trim().toLowerCase();
      if (!rawEmail || !rawEmail.includes('@')) {
        return { ok: false, error: 'Please enter a valid Gmail or email address.' };
      }
      if (password !== 'usman122') {
        return { ok: false, error: 'Incorrect admin password.' };
      }
      const session: AdminSession = {
        email: rawEmail,
        loggedInAt: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setAdminSession(session);
      showToast(`Signed in to NORVA Admin as ${rawEmail}`);
      return { ok: true };
    },
    [showToast],
  );

  const logoutAdmin = useCallback(() => {
    setAdminSession(null);
    showToast('Signed out of NORVA Admin');
  }, [showToast]);

  const updateOrderStatus = useCallback(
    (orderNumber: string, status: OrderStatus) => {
      setOrders((prev) =>
        prev.map((ord) => (ord.orderNumber === orderNumber ? { ...ord, status } : ord)),
      );
      showToast(`Order ${orderNumber} marked as ${status}`);
    },
    [showToast],
  );

  const deleteOrder = useCallback(
    (orderNumber: string) => {
      setOrders((prev) => prev.filter((ord) => ord.orderNumber !== orderNumber));
      showToast(`Order ${orderNumber} removed`);
    },
    [showToast],
  );

  const updateProductOverride = useCallback(
    (productId: string, patch: ProductAdminOverride) => {
      setProductOverrides((prev) => ({
        ...prev,
        [productId]: {
          ...(prev[productId] ?? {}),
          ...patch,
        },
      }));
      showToast('Catalog updated live');
    },
    [showToast],
  );

  const resetProductOverrides = useCallback(() => {
    setProductOverrides({});
    showToast('All 5 fragrances restored to default PKR 2,500');
  }, [showToast]);

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

  const value = useMemo<StoreContextValue>(
    () => ({
      products,
      productOverrides,
      cart,
      wishlist,
      orders,
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
      updateProfile,
      placeOrder,
      addProductReview,
      deleteProductReview,
      addInquiry,
      toggleInquiryResolved,
      addSubscriber,
      loginAdmin,
      logoutAdmin,
      updateOrderStatus,
      deleteOrder,
      updateProductOverride,
      resetProductOverrides,
      showToast,
      cartCount,
      cartSubtotal,
    }),
    [
      products,
      productOverrides,
      cart,
      wishlist,
      orders,
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
      updateProfile,
      placeOrder,
      addProductReview,
      deleteProductReview,
      addInquiry,
      toggleInquiryResolved,
      addSubscriber,
      loginAdmin,
      logoutAdmin,
      updateOrderStatus,
      deleteOrder,
      updateProductOverride,
      resetProductOverrides,
      showToast,
      cartCount,
      cartSubtotal,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
