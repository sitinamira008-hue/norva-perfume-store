import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  Box,
  Check,
  CheckCheck,
  Clock,
  CreditCard,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { formatPKR } from '../data/products';
import {
  DiscountType,
  OrderStatus,
  PaymentStatus,
  PlacedOrder,
  ShippingRateConfig,
  useStore,
} from '../context/StoreContext';
import { LuxuryImage, SEOHead } from '../components/LuxuryUI';

type AdminTab =
  | 'orders'
  | 'analytics'
  | 'products'
  | 'promotions'
  | 'inquiries'
  | 'backups';

const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
];

const PAYMENT_STATUSES: PaymentStatus[] = ['Pending', 'Paid', 'Refunded'];

function getStatusColor(status: OrderStatus = 'Pending'): string {
  switch (status) {
    case 'Delivered':
      return 'text-[#36d67e] bg-[#36d67e]/12 border-[#36d67e]/35';
    case 'Shipped':
      return 'text-[#b9abff] bg-[#b9abff]/12 border-[#b9abff]/35';
    case 'Processing':
      return 'text-[#d6be96] bg-[#d6be96]/12 border-[#d6be96]/35';
    case 'Confirmed':
      return 'text-sky-300 bg-sky-500/12 border-sky-400/35';
    case 'Cancelled':
      return 'text-red-400 bg-red-500/12 border-red-500/35';
    default:
      return 'text-amber-300 bg-amber-500/12 border-amber-500/35';
  }
}

function getPaymentStatusColor(status: PaymentStatus = 'Pending'): string {
  switch (status) {
    case 'Paid':
      return 'text-[#36d67e] bg-[#36d67e]/12 border-[#36d67e]/35';
    case 'Refunded':
      return 'text-red-300 bg-red-500/12 border-red-500/35';
    default:
      return 'text-amber-300 bg-amber-500/12 border-amber-500/35';
  }
}

function formatPaymentMethodLabel(method: 'cod' | 'invoice'): string {
  return method === 'cod' ? 'Cash on Delivery (COD)' : 'Bank Transfer / IBFT Invoice';
}

function formatWhatsAppHref(phone: string, orderNumber: string, customerName: string): string {
  let digits = phone.replace(/\D+/g, '');
  if (digits.startsWith('0')) {
    digits = `92${digits.slice(1)}`;
  } else if (!digits.startsWith('92') && digits.length === 10) {
    digits = `92${digits}`;
  }
  const msg = encodeURIComponent(
    `Assalam o Alaikum ${customerName}, this is NORVA Haute Parfumerie regarding your order ${orderNumber}.`,
  );
  return `https://wa.me/${digits}?text=${msg}`;
}

function formatBytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const AdminDashboardPage: React.FC = () => {
  const {
    adminSession,
    isAdminAuthChecking,
    isAdminLoading,
    loginAdmin,
    activateOrResetAdmin,
    changeAdminPassword,
    logoutAdmin,
    ensureAdminSessionChecked,
    products,
    lowStockProducts,
    adminOrders,
    adminCoupons,
    adminShippingRates,
    salesAnalytics,
    adminBackups,
    unseenOrderCount,
    refreshAdminOrders,
    inquiries,
    subscribers,
    customReviews,
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
    toggleInquiryResolved,
    deleteProductReview,
    showToast,
  } = useStore();

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Secure Owner Setup / Reset Mode (gated by server ADMIN_SETUP_TOKEN)
  const [isResetMode, setIsResetMode] = useState(false);
  const [setupTokenInput, setSetupTokenInput] = useState('');
  const [resetUsernameInput, setResetUsernameInput] = useState('');
  const [resetNewPwdInput, setResetNewPwdInput] = useState('');
  const [resetConfirmPwdInput, setResetConfirmPwdInput] = useState('');
  const [isResettingOwner, setIsResettingOwner] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [authStatusInfo, setAuthStatusInfo] = useState<{
    accountActive: boolean;
    setupTokenConfigured: boolean;
    persistentStorage: boolean;
  } | null>(null);

  // Authenticated Password Rotation Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPwdInput, setCurrentPwdInput] = useState('');
  const [newPwdInput, setNewPwdInput] = useState('');
  const [confirmPwdInput, setConfirmPwdInput] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);
  const [passwordFormSuccess, setPasswordFormSuccess] = useState<string | null>(null);

  // Dashboard Workspace State
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [orderIdSearch, setOrderIdSearch] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | 'New' | OrderStatus>('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'All' | PaymentStatus>('All');
  const [visibleOrdersLimit, setVisibleOrdersLimit] = useState(25);

  const deferredOrderIdSearch = useDeferredValue(orderIdSearch);
  const deferredPhoneFilter = useDeferredValue(phoneFilter);

  // Individual Order Details Modal State
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [confirmDeleteOrderNum, setConfirmDeleteOrderNum] = useState<string | null>(null);

  // Product Pricing, Stock & Low-Stock Threshold Inputs
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [thresholdInputs, setThresholdInputs] = useState<Record<string, string>>({});

  // Analytics Report Mode
  const [reportView, setReportView] = useState<'daily' | 'monthly'>('daily');

  // Shipping Rate Editor State
  const [cityNameDraft, setCityNameDraft] = useState('');
  const [cityKeyDraft, setCityKeyDraft] = useState<string | undefined>(undefined);
  const [standardFeeDraft, setStandardFeeDraft] = useState('250');
  const [expressFeeDraft, setExpressFeeDraft] = useState('500');
  const [freeThresholdDraft, setFreeThresholdDraft] = useState('5000');
  const [estimatedDaysDraft, setEstimatedDaysDraft] = useState('2–4 Working Days');
  const [cityActiveDraft, setCityActiveDraft] = useState(true);
  const [isSavingCity, setIsSavingCity] = useState(false);

  // Coupon Editor State
  const [couponCodeDraft, setCouponCodeDraft] = useState('');
  const [couponTypeDraft, setCouponTypeDraft] = useState<DiscountType>('percentage');
  const [couponValueDraft, setCouponValueDraft] = useState('15');
  const [couponMinOrderDraft, setCouponMinOrderDraft] = useState('0');
  const [couponMaxUsesDraft, setCouponMaxUsesDraft] = useState('');
  const [couponExpiryDraft, setCouponExpiryDraft] = useState('');
  const [couponDescDraft, setCouponDescDraft] = useState('');
  const [isSavingCoupon, setIsSavingCoupon] = useState(false);

  // Database Backup Action State
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  const selectedOrder: PlacedOrder | null = useMemo(() => {
    if (!selectedOrderNumber) return null;
    return adminOrders.find((o) => o.orderNumber === selectedOrderNumber) ?? null;
  }, [adminOrders, selectedOrderNumber]);

  useEffect(() => {
    if (selectedOrder) {
      setNotesDraft(selectedOrder.adminNotes ?? '');
      if (selectedOrder.isNew) {
        markOrderSeen(selectedOrder.orderNumber);
      }
    }
  }, [selectedOrder, markOrderSeen]);

  useEffect(() => {
    if (!selectedOrder) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedOrderNumber(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedOrder]);

  useEffect(() => {
    ensureAdminSessionChecked();
  }, [ensureAdminSessionChecked]);

  useEffect(() => {
    setVisibleOrdersLimit(25);
  }, [deferredOrderIdSearch, deferredPhoneFilter, orderStatusFilter, paymentStatusFilter]);

  useEffect(() => {
    if (adminSession) return;
    let cancelled = false;
    fetch('/api/admin/auth-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.ok) {
          setAuthStatusInfo({
            accountActive: Boolean(d.accountActive),
            setupTokenConfigured: Boolean(d.setupTokenConfigured),
            persistentStorage: d.persistentStorage !== false,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [adminSession, isResetMode]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(null);
    const normalizedUser = loginUsername.trim().replace(/^@+/, '');
    const res = await loginAdmin(normalizedUser, loginPassword);
    setIsLoggingIn(false);
    if (!res.ok) {
      setLoginError(res.error ?? 'Authentication failed');
    } else {
      setLoginError(null);
      setLoginPassword('');
    }
  };

  const handleOwnerResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isResettingOwner) return;
    setResetError(null);
    setResetSuccess(null);

    if (resetNewPwdInput.length < 8) {
      setResetError('New password must be at least 8 characters long.');
      return;
    }
    if (resetNewPwdInput !== resetConfirmPwdInput) {
      setResetError('New password and confirmation do not match.');
      return;
    }

    setIsResettingOwner(true);
    const cleanUser = resetUsernameInput.trim().toLowerCase().replace(/^@+/, '');
    const res = await activateOrResetAdmin({
      setupToken: setupTokenInput,
      username: cleanUser,
      password: resetNewPwdInput,
    });
    setIsResettingOwner(false);

    if (!res.ok) {
      setResetError(res.error ?? 'Failed to initialize owner password.');
      return;
    }

    setSetupTokenInput('');
    setResetNewPwdInput('');
    setResetConfirmPwdInput('');
    setLoginUsername(cleanUser);
    setResetSuccess(
      res.message || 'Owner password updated with bcrypt hashing. You can now sign in.',
    );
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUpdatingPassword) return;
    setPasswordFormError(null);
    setPasswordFormSuccess(null);

    if (newPwdInput.length < 8) {
      setPasswordFormError('New password must be at least 8 characters long.');
      return;
    }
    if (newPwdInput !== confirmPwdInput) {
      setPasswordFormError('New password and confirmation do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    const res = await changeAdminPassword(currentPwdInput, newPwdInput);
    setIsUpdatingPassword(false);

    if (!res.ok) {
      setPasswordFormError(res.error ?? 'Failed to update password.');
      return;
    }

    setCurrentPwdInput('');
    setNewPwdInput('');
    setConfirmPwdInput('');
    setPasswordFormSuccess('Administrator password updated with bcrypt hashing. Other sessions have been revoked.');
  };

  // Computed Storefront & Order Counter Metrics
  const metrics = useMemo(() => {
    const validOrders = adminOrders.filter((o) => o.status !== 'Cancelled');
    const totalRevenue = validOrders.reduce((acc, o) => acc + o.total, 0);
    const pendingCount = adminOrders.filter((o) => (o.status ?? 'Pending') === 'Pending').length;
    const confirmedCount = adminOrders.filter((o) => o.status === 'Confirmed').length;
    const processingCount = adminOrders.filter((o) => o.status === 'Processing').length;
    const shippedCount = adminOrders.filter((o) => o.status === 'Shipped').length;
    const deliveredCount = adminOrders.filter((o) => o.status === 'Delivered').length;
    const cancelledCount = adminOrders.filter((o) => o.status === 'Cancelled').length;
    const totalUnitsSold = validOrders.reduce(
      (acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0),
      0,
    );
    const openInquiries = inquiries.filter((i) => !i.resolved).length;
    const outOfStockCount = products.filter((p) => !p.inStock || p.stockUnits <= 0).length;
    return {
      totalRevenue,
      totalOrders: adminOrders.length,
      pendingCount,
      confirmedCount,
      processingCount,
      shippedCount,
      deliveredCount,
      cancelledCount,
      totalUnitsSold,
      openInquiries,
      outOfStockCount,
    };
  }, [adminOrders, inquiries, products]);

  const inventoryAlertCount = lowStockProducts.length + metrics.outOfStockCount;

  const statusCounts: Record<'All' | 'New' | OrderStatus, number> = useMemo(
    () => ({
      All: adminOrders.length,
      New: unseenOrderCount,
      Pending: metrics.pendingCount,
      Confirmed: metrics.confirmedCount,
      Processing: metrics.processingCount,
      Shipped: metrics.shippedCount,
      Delivered: metrics.deliveredCount,
      Cancelled: metrics.cancelledCount,
    }),
    [adminOrders.length, unseenOrderCount, metrics],
  );

  // Filtered Orders (strictly newest at the top, deferred for zero typing lag)
  const filteredOrders = useMemo(() => {
    const idQuery = deferredOrderIdSearch.trim().toLowerCase();
    const rawPhoneQuery = deferredPhoneFilter.trim().toLowerCase();
    const phoneDigitsQuery = deferredPhoneFilter.replace(/\D+/g, '');

    return adminOrders.filter((ord) => {
      const currentStatus = ord.status ?? 'Pending';
      const currentPayment = ord.paymentStatus ?? 'Pending';

      if (orderStatusFilter === 'New') {
        if (!ord.isNew) return false;
      } else if (orderStatusFilter !== 'All' && currentStatus !== orderStatusFilter) {
        return false;
      }

      if (paymentStatusFilter !== 'All' && currentPayment !== paymentStatusFilter) {
        return false;
      }

      if (idQuery) {
        const hayIdAndCustomer = `${ord.orderNumber} ${ord.customer.fullName} ${ord.customer.email}`.toLowerCase();
        if (!hayIdAndCustomer.includes(idQuery)) return false;
      }

      if (rawPhoneQuery) {
        const customerDigits = ord.customer.phone.replace(/\D+/g, '');
        const matchesDigits =
          phoneDigitsQuery.length > 0 && customerDigits.includes(phoneDigitsQuery);
        const matchesRaw = ord.customer.phone.toLowerCase().includes(rawPhoneQuery);
        if (!matchesDigits && !matchesRaw) return false;
      }

      return true;
    });
  }, [
    adminOrders,
    deferredOrderIdSearch,
    deferredPhoneFilter,
    orderStatusFilter,
    paymentStatusFilter,
  ]);

  const visibleOrders = useMemo(
    () => filteredOrders.slice(0, visibleOrdersLimit),
    [filteredOrders, visibleOrdersLimit],
  );

  const newestUnseenOrder = useMemo(
    () => adminOrders.find((o) => o.isNew) ?? null,
    [adminOrders],
  );

  const flatCustomReviews = useMemo(() => {
    const rows: {
      productId: string;
      productName: string;
      id: string;
      author: string;
      rating: number;
      title: string;
      comment: string;
      date: string;
      verifiedPurchase?: boolean;
    }[] = [];
    Object.entries(customReviews).forEach(([prodId, list]) => {
      const prod = products.find((p) => p.id === prodId);
      list.forEach((r) => {
        rows.push({
          productId: prodId,
          productName: prod?.name ?? prodId,
          id: r.id,
          author: r.author,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          date: r.date,
          verifiedPurchase: r.verifiedPurchase,
        });
      });
    });
    return rows;
  }, [customReviews, products]);

  const handleSaveAdminNotes = async () => {
    if (!selectedOrder || isSavingNotes) return;
    setIsSavingNotes(true);
    const updated = await updateOrderAdmin(selectedOrder.orderNumber, {
      adminNotes: notesDraft,
      isSeenByAdmin: true,
    });
    setIsSavingNotes(false);
    if (updated) {
      showToast(`Saved dispatch notes for ${selectedOrder.orderNumber}`);
    }
  };

  // Load existing city rate into form for quick editing
  const handleEditCityRate = (rate: ShippingRateConfig) => {
    setCityKeyDraft(rate.cityKey);
    setCityNameDraft(rate.cityName);
    setStandardFeeDraft(String(rate.standardFee));
    setExpressFeeDraft(String(rate.expressFee));
    setFreeThresholdDraft(String(rate.freeShippingThreshold));
    setEstimatedDaysDraft(rate.estimatedDays);
    setCityActiveDraft(rate.active);
  };

  const resetCityForm = () => {
    setCityKeyDraft(undefined);
    setCityNameDraft('');
    setStandardFeeDraft('250');
    setExpressFeeDraft('500');
    setFreeThresholdDraft('5000');
    setEstimatedDaysDraft('2–4 Working Days');
    setCityActiveDraft(true);
  };

  const handleSaveShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityNameDraft.trim() || isSavingCity) return;
    setIsSavingCity(true);
    const res = await saveAdminShippingRate({
      cityKey: cityKeyDraft,
      cityName: cityNameDraft.trim(),
      standardFee: Math.max(0, Number(standardFeeDraft) || 0),
      expressFee: Math.max(0, Number(expressFeeDraft) || 0),
      freeShippingThreshold: Math.max(0, Number(freeThresholdDraft) || 0),
      estimatedDays: estimatedDaysDraft.trim() || '2–4 Working Days',
      active: cityActiveDraft,
    });
    setIsSavingCity(false);
    if (res.ok) {
      resetCityForm();
    } else if (res.error) {
      showToast(res.error);
    }
  };

  const handleSaveCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = couponCodeDraft.trim().toUpperCase();
    if (!cleanCode || isSavingCoupon) return;
    setIsSavingCoupon(true);
    const parsedMax = couponMaxUsesDraft.trim() ? Number(couponMaxUsesDraft) : null;
    const res = await saveAdminCoupon({
      code: cleanCode,
      discountType: couponTypeDraft,
      discountValue: Math.max(1, Number(couponValueDraft) || 0),
      minOrderAmount: Math.max(0, Number(couponMinOrderDraft) || 0),
      maxUses: parsedMax && parsedMax > 0 ? parsedMax : null,
      description: couponDescDraft.trim() || `${cleanCode} Privilege`,
      active: true,
      expiresAtIso: couponExpiryDraft.trim()
        ? new Date(couponExpiryDraft).toISOString()
        : null,
    });
    setIsSavingCoupon(false);
    if (res.ok) {
      setCouponCodeDraft('');
      setCouponValueDraft('15');
      setCouponMinOrderDraft('0');
      setCouponMaxUsesDraft('');
      setCouponExpiryDraft('');
      setCouponDescDraft('');
    } else if (res.error) {
      showToast(res.error);
    }
  };

  const handleDownloadRevenueCsv = () => {
    if (!salesAnalytics) return;
    const lines: string[] = [];
    if (reportView === 'daily') {
      lines.push('Date,Orders Count,Units Sold,Revenue (PKR)');
      salesAnalytics.dailyReport.forEach((r) => {
        lines.push(`${r.date},${r.ordersCount},${r.unitsSold},${r.revenue}`);
      });
    } else {
      lines.push('Month,Orders Count,Units Sold,Revenue (PKR),Avg Order Value (PKR)');
      salesAnalytics.monthlyReport.forEach((r) => {
        lines.push(
          `${r.month},${r.ordersCount},${r.unitsSold},${r.revenue},${r.avgOrderValue}`,
        );
      });
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `norva-${reportView}-revenue-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${reportView} revenue CSV`);
  };

  const handleCreateSnapshot = async () => {
    if (isCreatingBackup) return;
    setIsCreatingBackup(true);
    await createAdminBackup();
    setIsCreatingBackup(false);
  };

  // =========================================================================
  // 0. VERIFYING ACTIVE ADMIN SESSION
  // =========================================================================
  if (isAdminAuthChecking && !adminSession) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3 text-white/70">
        <Loader2 className="w-6 h-6 animate-spin text-[#d6be96]" />
        <p className="text-xs uppercase tracking-[0.2em]">Verifying Admin Session...</p>
      </div>
    );
  }

  // =========================================================================
  // 1. PRIVATE ADMIN LOGIN GATE (SERVER-AUTHENTICATED)
  // =========================================================================
  if (!adminSession) {
    return (
      <div className="min-h-[82vh] bg-transparent text-[#f5f3ef] flex items-center justify-center px-3.5 sm:px-4 py-10 sm:py-16">
        <SEOHead
          title="Admin Console Sign In"
          description="NORVA Haute Parfumerie Private Admin Orders Dashboard authentication."
        />

        <div className="w-full max-w-md p-5 sm:p-10 rounded-2xl bg-[#0a0a0f] border border-white/10 space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-[#d6be96]">
              <Lock className="w-5 h-5" />
            </div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#d6be96] pt-1">
              NORVA Private Executive Console
            </p>
            <h1 className="font-serif-display text-3xl sm:text-4xl text-white">
              Admin Sign In
            </h1>
            <p className="text-xs text-white/55">
              Customer orders, revenue reports, and database backups are strictly protected. Sign in
              with your administrator username and password.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-white/65 mb-1.5" htmlFor="admin-username">
                Admin Username
              </label>
              <input
                id="admin-username"
                type="text"
                required
                autoComplete="username"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                value={loginUsername}
                onChange={(e) => {
                  setLoginUsername(e.target.value);
                  setLoginError(null);
                }}
                placeholder="Enter admin username"
                className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d6be96]"
              />
            </div>

            <div>
              <label className="block text-xs text-white/65 mb-1.5" htmlFor="admin-password">
                Admin Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="none"
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setLoginError(null);
                  }}
                  placeholder="Enter admin password"
                  className="w-full h-11 pl-3.5 pr-11 rounded-lg bg-[#050508] border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d6be96]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="w-10 h-10 flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-white/45 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-11 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] disabled:opacity-65 text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Access Admin Console</span>
              )}
            </button>
          </form>

          {isResetMode ? (
            <form
              onSubmit={handleOwnerResetSubmit}
              className="p-4 rounded-xl bg-[#050508] border border-white/12 space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#d6be96]">
                  Owner Password Initialization / Reset
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setResetError(null);
                    setResetSuccess(null);
                  }}
                  className="text-[11px] text-white/50 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <p className="text-[11px] text-white/50 leading-relaxed">
                Requires the server-side <code className="text-[#d6be96]">ADMIN_SETUP_TOKEN</code>{' '}
                secret. Hashes your new password on the server using salted bcrypt (cost 12).
                {authStatusInfo && !authStatusInfo.setupTokenConfigured && (
                  <span className="block mt-1 text-amber-300/90">
                    Status: ADMIN_SETUP_TOKEN is currently unset (locked) in Server Secrets.
                  </span>
                )}
              </p>

              <div>
                <label className="block text-[11px] text-white/65 mb-1" htmlFor="setup-token-input">
                  Server Setup Token (ADMIN_SETUP_TOKEN)
                </label>
                <input
                  id="setup-token-input"
                  type="password"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  value={setupTokenInput}
                  onChange={(e) => {
                    setSetupTokenInput(e.target.value);
                    setResetError(null);
                  }}
                  placeholder="Enter ADMIN_SETUP_TOKEN"
                  className="w-full h-10 px-3 rounded-lg bg-[#0a0a0f] border border-white/15 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#d6be96]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/65 mb-1" htmlFor="reset-owner-user">
                  Owner Username
                </label>
                <input
                  id="reset-owner-user"
                  type="text"
                  required
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="none"
                  value={resetUsernameInput}
                  onChange={(e) => {
                    setResetUsernameInput(e.target.value);
                    setResetError(null);
                  }}
                  placeholder="Enter owner username"
                  className="w-full h-10 px-3 rounded-lg bg-[#0a0a0f] border border-white/15 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#d6be96]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-white/65 mb-1" htmlFor="reset-new-pwd">
                    New Password
                  </label>
                  <input
                    id="reset-new-pwd"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                    value={resetNewPwdInput}
                    onChange={(e) => {
                      setResetNewPwdInput(e.target.value);
                      setResetError(null);
                    }}
                    placeholder="Min 8 characters"
                    className="w-full h-10 px-3 rounded-lg bg-[#0a0a0f] border border-white/15 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#d6be96]"
                  />
                </div>
                <div>
                  <label
                    className="block text-[11px] text-white/65 mb-1"
                    htmlFor="reset-confirm-pwd"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="reset-confirm-pwd"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                    value={resetConfirmPwdInput}
                    onChange={(e) => {
                      setResetConfirmPwdInput(e.target.value);
                      setResetError(null);
                    }}
                    placeholder="Repeat password"
                    className="w-full h-10 px-3 rounded-lg bg-[#0a0a0f] border border-white/15 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#d6be96]"
                  />
                </div>
              </div>

              {resetError && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                  {resetError}
                </div>
              )}

              {resetSuccess && (
                <div className="p-2.5 rounded-lg bg-[#36d67e]/10 border border-[#36d67e]/35 text-xs text-[#36d67e]">
                  {resetSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={isResettingOwner}
                className="w-full h-10 rounded-lg bg-white/[0.1] hover:bg-[#d6be96] hover:text-[#050508] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {isResettingOwner ? 'Initializing...' : 'Set Owner Credentials'}
              </button>
            </form>
          ) : (
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(true);
                  setResetError(null);
                  setResetSuccess(null);
                }}
                className="text-[11px] text-[#d6be96]/80 hover:text-[#d6be96] underline underline-offset-4 cursor-pointer"
              >
                Initialize or Reset Owner Password (Setup Token)
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-white/[0.06] space-y-2 text-center">
            <p className="text-[11px] text-white/40">
              Private administrator access only. Public registration is disabled.
            </p>
            <Link to="/" className="inline-block text-xs text-white/45 hover:text-white transition-colors">
              ← Return to NORVA Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. AUTHENTICATED ADMIN WORKSPACE
  // =========================================================================
  const navItems: {
    id: AdminTab;
    label: string;
    badge?: number;
    highlightBadge?: boolean;
    warningBadge?: boolean;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'orders',
      label: 'Orders Management',
      badge: unseenOrderCount > 0 ? unseenOrderCount : metrics.totalOrders,
      highlightBadge: unseenOrderCount > 0,
      icon: <Package className="w-4 h-4" />,
    },
    {
      id: 'analytics',
      label: 'Analytics & Reports',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'products',
      label: 'Inventory & Stock',
      badge: inventoryAlertCount > 0 ? inventoryAlertCount : undefined,
      warningBadge: inventoryAlertCount > 0,
      icon: <Box className="w-4 h-4" />,
    },
    {
      id: 'promotions',
      label: 'Shipping & Coupons',
      badge: adminCoupons.filter((c) => c.active).length,
      icon: <Tag className="w-4 h-4" />,
    },
    {
      id: 'inquiries',
      label: 'Reviews & Concierge',
      badge:
        metrics.openInquiries + flatCustomReviews.length > 0
          ? metrics.openInquiries + flatCustomReviews.length
          : undefined,
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      id: 'backups',
      label: 'Database Backups',
      badge: adminBackups.length > 0 ? adminBackups.length : undefined,
      icon: <Database className="w-4 h-4" />,
    },
  ];

  const maxDailyRev = Math.max(
    1,
    ...(salesAnalytics?.dailyReport.map((d) => d.revenue) ?? [1]),
  );
  const maxMonthlyRev = Math.max(
    1,
    ...(salesAnalytics?.monthlyReport.map((m) => m.revenue) ?? [1]),
  );

  return (
    <div className="min-h-[85vh] bg-[#050508] text-[#f5f3ef]">
      <SEOHead
        title={
          unseenOrderCount > 0
            ? `(${unseenOrderCount} New) Admin Orders Dashboard`
            : 'Admin Executive Console'
        }
        description="NORVA Store Administration — Orders, Analytics, City Shipping, Coupons, Inventory, and Backups."
      />

      <div className="max-w-[1460px] mx-auto flex flex-col lg:flex-row min-h-[85vh]">
        {/* Left Workspace Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 bg-[#08080c] border-b lg:border-b-0 lg:border-r border-white/[0.08] p-3.5 sm:p-5 flex flex-col justify-between gap-4 sm:gap-6">
          <div className="space-y-4 sm:space-y-6">
            <div className="px-1 sm:px-2 flex items-center justify-between lg:block">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#d6be96]">
                  Admin Workspace
                </p>
                <p className="font-serif-display text-2xl text-white mt-0.5">NORVA Console</p>
              </div>

              {unseenOrderCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('orders');
                    setOrderStatusFilter('New');
                  }}
                  className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#36d67e]/15 border border-[#36d67e]/40 text-[11px] font-medium text-[#36d67e] cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{unseenOrderCount} New</span>
                </button>
              )}
            </div>

            <nav className="flex lg:flex-col gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center justify-between gap-3 min-h-[40px] sm:min-h-0 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#f2e6d5] text-[#050508]'
                        : 'text-white/65 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`font-mono-tabular text-[11px] px-1.5 py-0.5 rounded font-semibold ${
                          item.highlightBadge
                            ? active
                              ? 'bg-[#050508] text-[#36d67e]'
                              : 'bg-[#36d67e] text-[#050508]'
                            : item.warningBadge
                              ? active
                                ? 'bg-[#050508] text-amber-300'
                                : 'bg-amber-400/20 text-amber-300'
                              : active
                                ? 'bg-[#050507] text-white'
                                : 'bg-[#d6be96]/20 text-[#d6be96]'
                        }`}
                      >
                        {item.highlightBadge ? `${item.badge} NEW` : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="hidden lg:flex flex-col gap-2 pt-5 border-t border-white/[0.08]">
            <div className="px-2 pb-2">
              <p className="text-[11px] text-white/40">Authenticated Admin</p>
              <p
                className="text-xs font-medium text-white font-mono-tabular truncate"
                title={adminSession.username || adminSession.email}
              >
                {adminSession.username || adminSession.email}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setPasswordFormError(null);
                setPasswordFormSuccess(null);
                setIsPasswordModalOpen(true);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
            >
              <Lock className="w-3.5 h-3.5 text-[#d6be96]" />
              <span>Change Password</span>
            </button>

            <Link
              to="/shop"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-white/65 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <span>Live Storefront</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>

            <button
              type="button"
              onClick={logoutAdmin}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Dashboard Viewport */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Contextual Top Header Bar */}
          <div className="min-h-[56px] py-2 px-4 sm:px-6 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 bg-[#07070b]">
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-white/50 min-w-0">
              <span className="shrink-0">NORVA Admin</span>
              <span className="shrink-0">/</span>
              <span className="text-white font-medium capitalize truncate">{activeTab}</span>

              <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] font-mono-tabular text-[11px] text-white/75">
                Orders: <strong className="text-white">{metrics.totalOrders}</strong>
              </span>

              {unseenOrderCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('orders');
                    setOrderStatusFilter('New');
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#36d67e]/15 border border-[#36d67e]/40 font-mono-tabular text-[11px] font-semibold text-[#36d67e] cursor-pointer"
                >
                  <Bell className="w-3 h-3" />
                  <span>{unseenOrderCount} New</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={refreshAdminOrders}
                disabled={isAdminLoading}
                title="Sync all store data from database"
                className="h-9 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-white/80 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAdminLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <span className="hidden md:inline text-xs text-white/45 font-mono-tabular">
                {adminSession.username || adminSession.email}
              </span>

              <button
                type="button"
                onClick={() => {
                  setPasswordFormError(null);
                  setPasswordFormSuccess(null);
                  setIsPasswordModalOpen(true);
                }}
                className="lg:hidden h-9 px-3 rounded-lg bg-white/[0.05] border border-white/10 text-xs text-white/80 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Lock className="w-3.5 h-3.5 text-[#d6be96]" />
                <span>Password</span>
              </button>

              <button
                type="button"
                onClick={logoutAdmin}
                className="lg:hidden h-9 px-3 rounded-lg bg-white/[0.06] text-xs text-red-300 cursor-pointer whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            </div>
          </div>

          <div className="p-3.5 sm:p-7 space-y-6">
            {/* ===============================================================
                NEW ORDERS LIVE NOTIFICATION BANNER
               =============================================================== */}
            {unseenOrderCount > 0 && (
              <div className="p-4 sm:p-5 rounded-xl bg-[#0b1812] border border-[#36d67e]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#36d67e]/15 border border-[#36d67e]/40 flex items-center justify-center text-[#36d67e] shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#36d67e]">
                        New Customer {unseenOrderCount === 1 ? 'Order' : 'Orders'} Alert
                      </span>
                      <span className="font-mono-tabular text-[11px] px-2 py-0.5 rounded bg-[#36d67e] text-[#050508] font-bold">
                        {unseenOrderCount} UNREAD
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-white/85">
                      {newestUnseenOrder ? (
                        <>
                          Latest:{' '}
                          <strong className="font-mono-tabular text-[#d6be96]">
                            {newestUnseenOrder.orderNumber}
                          </strong>{' '}
                          from <strong>{newestUnseenOrder.customer.fullName}</strong> (
                          {newestUnseenOrder.customer.city}) ·{' '}
                          <strong className="font-mono-tabular">
                            {formatPKR(newestUnseenOrder.total)}
                          </strong>
                        </>
                      ) : (
                        `${unseenOrderCount} new order(s) awaiting review and confirmation.`
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {newestUnseenOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('orders');
                        setSelectedOrderNumber(newestUnseenOrder.orderNumber);
                      }}
                      className="h-9 px-3.5 rounded-lg bg-[#36d67e] hover:bg-[#2fc270] text-[#050508] text-xs font-semibold cursor-pointer"
                    >
                      Inspect Latest Order
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={markAllOrdersSeen}
                    className="h-9 px-3.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 text-xs text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark All Read</span>
                  </button>
                </div>
              </div>
            )}

            {/* ===============================================================
                LOW-STOCK / OUT-OF-STOCK INVENTORY ALERT BANNER
               =============================================================== */}
            {inventoryAlertCount > 0 && (
              <div className="p-4 rounded-xl bg-[#181207] border border-amber-400/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs">
                    <p className="font-semibold text-amber-200 uppercase tracking-[0.14em]">
                      Inventory Restock Alert
                    </p>
                    <p className="text-white/80">
                      {products
                        .filter((p) => !p.inStock || p.isLowStock)
                        .map((p) => `${p.name} (${p.stockUnits} left)`)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
                {activeTab !== 'products' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('products')}
                    className="h-9 px-3.5 rounded-lg bg-amber-300 hover:bg-amber-200 text-[#050508] text-xs font-semibold cursor-pointer shrink-0 self-start sm:self-auto"
                  >
                    Manage Stock
                  </button>
                )}
              </div>
            )}

            {/* ===============================================================
                TAB 1: ORDERS MANAGEMENT
               =============================================================== */}
            {activeTab === 'orders' && (
              <div className="space-y-5">
                {/* Order Counter Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#0a0a0f] border border-white/[0.08]">
                    <p className="text-[11px] text-white/45">Total Orders</p>
                    <p className="font-mono-tabular text-xl font-semibold text-white mt-0.5">
                      {metrics.totalOrders}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0a0a0f] border border-[#36d67e]/25">
                    <p className="text-[11px] text-[#36d67e]">New Unread</p>
                    <p className="font-mono-tabular text-xl font-semibold text-[#36d67e] mt-0.5">
                      {unseenOrderCount}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0a0a0f] border border-white/[0.08]">
                    <p className="text-[11px] text-amber-300/80">Pending</p>
                    <p className="font-mono-tabular text-xl font-semibold text-amber-300 mt-0.5">
                      {metrics.pendingCount}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0a0a0f] border border-white/[0.08]">
                    <p className="text-[11px] text-sky-300/80">Confirmed / Processing</p>
                    <p className="font-mono-tabular text-xl font-semibold text-sky-300 mt-0.5">
                      {metrics.confirmedCount + metrics.processingCount}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0a0a0f] border border-white/[0.08]">
                    <p className="text-[11px] text-[#b9abff]">Shipped</p>
                    <p className="font-mono-tabular text-xl font-semibold text-[#b9abff] mt-0.5">
                      {metrics.shippedCount}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0a0a0f] border border-white/[0.08]">
                    <p className="text-[11px] text-[#d6be96]">Delivered</p>
                    <p className="font-mono-tabular text-xl font-semibold text-[#d6be96] mt-0.5">
                      {metrics.deliveredCount}
                    </p>
                  </div>
                </div>

                {/* Search & Multi-Filter Control Panel */}
                <div className="p-4 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                    <div className="relative lg:col-span-5">
                      <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={orderIdSearch}
                        onChange={(e) => setOrderIdSearch(e.target.value)}
                        placeholder="Search by Order ID (e.g. NV-12345), name, or email..."
                        aria-label="Search by Order ID or customer name"
                        className="w-full h-10 pl-10 pr-3.5 rounded-lg bg-[#050508] border border-white/12 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-[#d6be96]"
                      />
                    </div>

                    <div className="relative lg:col-span-4">
                      <Phone className="w-3.5 h-3.5 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={phoneFilter}
                        onChange={(e) => setPhoneFilter(e.target.value)}
                        placeholder="Filter by customer phone (e.g. 0300...)"
                        aria-label="Filter by customer phone number"
                        className="w-full h-10 pl-10 pr-3.5 rounded-lg bg-[#050508] border border-white/12 text-xs font-mono-tabular text-white placeholder:font-sans placeholder:text-white/35 focus:outline-none focus:border-[#d6be96]"
                      />
                    </div>

                    <div className="lg:col-span-3 flex gap-2">
                      <select
                        value={paymentStatusFilter}
                        onChange={(e) =>
                          setPaymentStatusFilter(e.target.value as 'All' | PaymentStatus)
                        }
                        aria-label="Filter by payment status"
                        className="flex-1 h-10 px-3 rounded-lg bg-[#050508] border border-white/12 text-xs text-white focus:outline-none focus:border-[#d6be96]"
                      >
                        <option value="All" className="bg-[#0a0a0f]">
                          Payment: All
                        </option>
                        {PAYMENT_STATUSES.map((ps) => (
                          <option key={ps} value={ps} className="bg-[#0a0a0f]">
                            Payment: {ps}
                          </option>
                        ))}
                      </select>

                      {(orderIdSearch ||
                        phoneFilter ||
                        orderStatusFilter !== 'All' ||
                        paymentStatusFilter !== 'All') && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrderIdSearch('');
                            setPhoneFilter('');
                            setOrderStatusFilter('All');
                            setPaymentStatusFilter('All');
                          }}
                          className="h-10 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-white/80 cursor-pointer shrink-0"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Order Status Filter Bar */}
                  <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5 pb-0.5">
                    {(['All', 'New', ...ORDER_STATUSES] as const).map((st) => {
                      const active = orderStatusFilter === st;
                      const cnt = statusCounts[st];
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setOrderStatusFilter(st)}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                            active
                              ? 'bg-[#f2e6d5] text-[#050508]'
                              : st === 'New' && cnt > 0
                                ? 'bg-[#36d67e]/12 text-[#36d67e] border border-[#36d67e]/35'
                                : 'bg-[#050508] text-white/65 border border-white/10 hover:text-white'
                          }`}
                        >
                          <span>{st}</span>
                          <span
                            className={`font-mono-tabular text-[10.5px] px-1.5 py-0.2 rounded ${
                              active ? 'bg-[#050508]/15 text-[#050508]' : 'bg-white/[0.06]'
                            }`}
                          >
                            {cnt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Orders List */}
                {filteredOrders.length === 0 ? (
                  <div className="p-10 sm:p-14 rounded-xl bg-[#0a0a0f] border border-white/[0.08] text-center space-y-2.5">
                    <Package className="w-8 h-8 text-[#d6be96] mx-auto" />
                    <p className="text-sm font-medium text-white">No matching orders found</p>
                    <p className="text-xs text-white/45 max-w-md mx-auto">
                      Every customer order placed on the NORVA storefront is saved to the database
                      and appears at the top of this list immediately.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleOrders.map((ord) => {
                      const currentStatus = ord.status ?? 'Pending';
                      const currentPayment = ord.paymentStatus ?? 'Pending';
                      const totalItemsQty = ord.items.reduce((s, i) => s + i.quantity, 0);

                      return (
                        <div
                          key={ord.orderNumber}
                          className={`p-4 sm:p-6 rounded-xl bg-[#0a0a0f] border transition-colors space-y-4 ${
                            ord.isNew
                              ? 'border-[#36d67e]/55'
                              : 'border-white/[0.08]'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-white/[0.07]">
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderNumber(ord.orderNumber)}
                                  className="font-mono-tabular text-sm sm:text-base font-semibold text-[#d6be96] hover:underline cursor-pointer"
                                >
                                  {ord.orderNumber}
                                </button>

                                {ord.isNew && (
                                  <span className="px-2 py-0.5 rounded bg-[#36d67e] text-[#050508] text-[10px] font-bold uppercase tracking-wider">
                                    New Order
                                  </span>
                                )}

                                <span
                                  className={`px-2.5 py-0.5 rounded border text-[11px] font-medium ${getStatusColor(
                                    currentStatus,
                                  )}`}
                                >
                                  {currentStatus}
                                </span>

                                <span
                                  className={`px-2.5 py-0.5 rounded border text-[11px] font-medium ${getPaymentStatusColor(
                                    currentPayment,
                                  )}`}
                                >
                                  Payment: {currentPayment}
                                </span>
                              </div>

                              <p className="text-xs text-white/45 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-white/35" />
                                  {ord.createdAt}
                                </span>
                                <span>·</span>
                                <span>{formatPaymentMethodLabel(ord.paymentMethod)}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-[11px] text-white/45">
                                  Total ({totalItemsQty} {totalItemsQty === 1 ? 'item' : 'items'})
                                </p>
                                <p className="font-mono-tabular text-lg sm:text-xl font-semibold text-white">
                                  {formatPKR(ord.total)}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => setSelectedOrderNumber(ord.orderNumber)}
                                className="h-9 px-3.5 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold cursor-pointer whitespace-nowrap"
                              >
                                View Details
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                            <div className="lg:col-span-4 space-y-1.5 p-3.5 rounded-lg bg-[#050508] border border-white/[0.06]">
                              <p className="text-[10.5px] uppercase tracking-[0.14em] text-white/40">
                                Customer Contact
                              </p>
                              <p className="text-sm font-semibold text-white break-words">
                                {ord.customer.fullName}
                              </p>
                              <p className="font-mono-tabular text-white/85 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-[#d6be96] shrink-0" />
                                <a href={`tel:${ord.customer.phone}`} className="hover:underline">
                                  {ord.customer.phone}
                                </a>
                              </p>
                              <p className="text-white/65 flex items-center gap-1.5 break-all">
                                <Mail className="w-3.5 h-3.5 text-white/40 shrink-0" />
                                <span>{ord.customer.email}</span>
                              </p>
                            </div>

                            <div className="lg:col-span-4 space-y-1.5 p-3.5 rounded-lg bg-[#050508] border border-white/[0.06]">
                              <p className="text-[10.5px] uppercase tracking-[0.14em] text-white/40">
                                Delivery Address
                              </p>
                              <p className="text-white/90 leading-relaxed break-words flex items-start gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-[#d6be96] shrink-0 mt-0.5" />
                                <span>
                                  {ord.customer.address}, {ord.customer.city}
                                  {ord.customer.postalCode ? ` ${ord.customer.postalCode}` : ''},{' '}
                                  {ord.customer.country}
                                </span>
                              </p>
                              <p className="text-[11px] text-white/45 pl-5">
                                Courier:{' '}
                                {ord.shippingSpeed === 'express'
                                  ? `Priority Air (${formatPKR(ord.shippingCost)})`
                                  : ord.shippingCost === 0
                                    ? 'Standard (Complimentary)'
                                    : `Standard (${formatPKR(ord.shippingCost)})`}
                              </p>
                              {ord.couponCode && (
                                <p className="text-[11px] text-[#36d67e] pl-5 font-mono-tabular">
                                  Coupon: {ord.couponCode} (-{formatPKR(ord.discountAmount)})
                                </p>
                              )}
                              {ord.giftNote && (
                                <p className="text-[11px] text-[#d6be96] italic pl-5 break-words">
                                  Gift Note: “{ord.giftNote}”
                                </p>
                              )}
                            </div>

                            <div className="lg:col-span-4 space-y-2 p-3.5 rounded-lg bg-[#050508] border border-white/[0.06]">
                              <p className="text-[10.5px] uppercase tracking-[0.14em] text-white/40">
                                Ordered Products
                              </p>
                              <div className="space-y-2">
                                {ord.items.map((it) => (
                                  <div
                                    key={it.key}
                                    className="flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-9 h-9 rounded bg-[#0a0a0f] border border-white/10 overflow-hidden shrink-0">
                                        <LuxuryImage
                                          src={it.image}
                                          alt={it.name}
                                          className="w-full h-full object-contain"
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-white font-medium truncate">{it.name}</p>
                                        <p className="text-[11px] text-white/50 font-mono-tabular">
                                          {it.sizeLabel} × <strong>{it.quantity}</strong>
                                        </p>
                                      </div>
                                    </div>
                                    <span className="font-mono-tabular text-white/85 shrink-0">
                                      {formatPKR(it.unitPrice * it.quantity)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-white/[0.06] flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <span className="text-[11px] text-white/45 mr-1">Quick Actions:</span>

                              <button
                                type="button"
                                disabled={currentStatus === 'Confirmed'}
                                onClick={() => updateOrderStatus(ord.orderNumber, 'Confirmed')}
                                className="h-8 px-3 rounded-lg bg-sky-500/12 hover:bg-sky-500/22 disabled:opacity-40 border border-sky-400/30 text-[11px] font-medium text-sky-300 cursor-pointer"
                              >
                                Confirm
                              </button>

                              <button
                                type="button"
                                disabled={currentStatus === 'Processing'}
                                onClick={() => updateOrderStatus(ord.orderNumber, 'Processing')}
                                className="h-8 px-3 rounded-lg bg-[#d6be96]/12 hover:bg-[#d6be96]/22 disabled:opacity-40 border border-[#d6be96]/35 text-[11px] font-medium text-[#d6be96] cursor-pointer"
                              >
                                Process
                              </button>

                              <button
                                type="button"
                                disabled={currentStatus === 'Shipped'}
                                onClick={() => updateOrderStatus(ord.orderNumber, 'Shipped')}
                                className="h-8 px-3 rounded-lg bg-[#b9abff]/12 hover:bg-[#b9abff]/22 disabled:opacity-40 border border-[#b9abff]/35 text-[11px] font-medium text-[#b9abff] cursor-pointer inline-flex items-center gap-1"
                              >
                                <Truck className="w-3 h-3" />
                                <span>Ship</span>
                              </button>

                              <button
                                type="button"
                                disabled={currentStatus === 'Delivered'}
                                onClick={() => updateOrderStatus(ord.orderNumber, 'Delivered')}
                                className="h-8 px-3 rounded-lg bg-[#36d67e]/12 hover:bg-[#36d67e]/22 disabled:opacity-40 border border-[#36d67e]/35 text-[11px] font-medium text-[#36d67e] cursor-pointer inline-flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>Deliver</span>
                              </button>

                              <button
                                type="button"
                                disabled={currentStatus === 'Cancelled'}
                                onClick={() => updateOrderStatus(ord.orderNumber, 'Cancelled')}
                                className="h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 border border-red-500/30 text-[11px] font-medium text-red-300 cursor-pointer inline-flex items-center gap-1"
                              >
                                <XCircle className="w-3 h-3" />
                                <span>Cancel</span>
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <label className="text-[11px] text-white/45 flex items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5 text-[#d6be96]" />
                                <span>Payment:</span>
                                <select
                                  value={currentPayment}
                                  onChange={(e) =>
                                    updateOrderPaymentStatus(
                                      ord.orderNumber,
                                      e.target.value as PaymentStatus,
                                    )
                                  }
                                  aria-label={`Payment status for ${ord.orderNumber}`}
                                  className="h-8 px-2.5 rounded-lg bg-[#050508] border border-white/15 text-xs text-white focus:outline-none focus:border-[#d6be96]"
                                >
                                  {PAYMENT_STATUSES.map((ps) => (
                                    <option key={ps} value={ps} className="bg-[#0a0a0f]">
                                      {ps}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <a
                                href={formatWhatsAppHref(
                                  ord.customer.phone,
                                  ord.orderNumber,
                                  ord.customer.fullName,
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 px-3 rounded-lg bg-[#36d67e]/10 hover:bg-[#36d67e]/20 border border-[#36d67e]/30 text-[11px] font-medium text-[#36d67e] inline-flex items-center gap-1"
                              >
                                <span>WhatsApp Client</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {filteredOrders.length > visibleOrders.length && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => setVisibleOrdersLimit((n) => n + 25)}
                          className="h-10 px-5 rounded-lg bg-[#0d0d14] hover:bg-white/[0.08] border border-white/15 text-xs font-medium text-[#f2e6d5] cursor-pointer"
                        >
                          Show Next {Math.min(25, filteredOrders.length - visibleOrders.length)}{' '}
                          Orders ({visibleOrders.length} of {filteredOrders.length} shown)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ===============================================================
                TAB 2: SALES ANALYTICS & DAILY / MONTHLY REVENUE REPORTS
               =============================================================== */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Sales Analytics &amp; Revenue Reports
                    </h2>
                    <p className="text-xs text-white/50 mt-0.5">
                      Real-time revenue metrics calculated directly from verified SQLite orders
                      (excluding cancelled orders).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadRevenueCsv}
                    className="h-9 px-4 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer self-start"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export {reportView === 'daily' ? 'Daily' : 'Monthly'} CSV</span>
                  </button>
                </div>

                {/* KPI Summary Row */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                  <div className="p-4 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-1">
                    <p className="text-[11px] text-white/50">Gross Revenue</p>
                    <p className="font-mono-tabular text-xl font-semibold text-white">
                      {formatPKR(salesAnalytics?.summary.grossRevenue ?? metrics.totalRevenue)}
                    </p>
                    <p className="font-mono-tabular text-[11px] text-white/40">
                      {salesAnalytics?.summary.validOrdersCount ?? 0} active orders
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-1">
                    <p className="text-[11px] text-white/50">Collected (Paid)</p>
                    <p className="font-mono-tabular text-xl font-semibold text-[#36d67e]">
                      {formatPKR(salesAnalytics?.summary.collectedRevenue ?? 0)}
                    </p>
                    <p className="text-[11px] text-white/40">Settled orders</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-1">
                    <p className="text-[11px] text-white/50">Pending Collection</p>
                    <p className="font-mono-tabular text-xl font-semibold text-amber-300">
                      {formatPKR(salesAnalytics?.summary.pendingCollectionRevenue ?? 0)}
                    </p>
                    <p className="text-[11px] text-white/40">Awaiting COD / IBFT</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-1">
                    <p className="text-[11px] text-white/50">Avg. Order Value</p>
                    <p className="font-mono-tabular text-xl font-semibold text-[#d6be96]">
                      {formatPKR(salesAnalytics?.summary.averageOrderValue ?? 0)}
                    </p>
                    <p className="text-[11px] text-white/40">Per active order</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-1">
                    <p className="text-[11px] text-white/50">Flacons Sold</p>
                    <p className="font-mono-tabular text-xl font-semibold text-white">
                      {salesAnalytics?.summary.totalUnitsSold ?? metrics.totalUnitsSold}
                    </p>
                    <p className="text-[11px] text-white/40">50ml units</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-1">
                    <p className="text-[11px] text-white/50">Discounts Granted</p>
                    <p className="font-mono-tabular text-xl font-semibold text-white">
                      {formatPKR(salesAnalytics?.summary.totalDiscountsGiven ?? 0)}
                    </p>
                    <p className="text-[11px] text-white/40">Privilege codes</p>
                  </div>
                </div>

                {/* Daily / Monthly Revenue Report Card */}
                <div className="rounded-xl bg-[#0a0a0f] border border-white/[0.08] overflow-hidden">
                  <div className="p-4 sm:px-5 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-semibold text-white">
                        {reportView === 'daily'
                          ? 'Daily Revenue Report (Last 14 Days)'
                          : 'Monthly Revenue Report'}
                      </h3>
                      <p className="text-xs text-white/45">
                        Verified order volume, unit sales, and PKR revenue by period.
                      </p>
                    </div>

                    <div className="inline-flex p-1 rounded-lg bg-[#050508] border border-white/10">
                      <button
                        type="button"
                        onClick={() => setReportView('daily')}
                        className={`h-8 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                          reportView === 'daily'
                            ? 'bg-[#f2e6d5] text-[#050508]'
                            : 'text-white/65 hover:text-white'
                        }`}
                      >
                        Daily (14d)
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportView('monthly')}
                        className={`h-8 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                          reportView === 'monthly'
                            ? 'bg-[#f2e6d5] text-[#050508]'
                            : 'text-white/65 hover:text-white'
                        }`}
                      >
                        Monthly
                      </button>
                    </div>
                  </div>

                  {reportView === 'daily' ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.07] text-white/45">
                            <th className="py-3 px-5 font-medium">Date</th>
                            <th className="py-3 px-4 font-medium">Orders</th>
                            <th className="py-3 px-4 font-medium">Units Sold</th>
                            <th className="py-3 px-4 font-medium w-56">Relative Volume</th>
                            <th className="py-3 px-5 font-medium text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {(salesAnalytics?.dailyReport ?? [])
                            .slice()
                            .reverse()
                            .map((row) => {
                              const pct = Math.min(100, Math.round((row.revenue / maxDailyRev) * 100));
                              return (
                                <tr key={row.date} className="hover:bg-white/[0.02]">
                                  <td className="py-2.5 px-5 font-mono-tabular text-white">
                                    {row.date}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono-tabular text-white/75">
                                    {row.ordersCount}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono-tabular text-white/75">
                                    {row.unitsSold}
                                  </td>
                                  <td className="py-2.5 px-4">
                                    <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                                      <div
                                        className="h-full bg-[#d6be96] rounded-full transition-all"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-5 text-right font-mono-tabular text-white font-medium">
                                    {formatPKR(row.revenue)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {(salesAnalytics?.monthlyReport.length ?? 0) === 0 ? (
                        <div className="p-8 text-center text-xs text-white/45">
                          Monthly aggregates appear automatically as orders are recorded.
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-white/[0.07] text-white/45">
                              <th className="py-3 px-5 font-medium">Month</th>
                              <th className="py-3 px-4 font-medium">Orders</th>
                              <th className="py-3 px-4 font-medium">Units Sold</th>
                              <th className="py-3 px-4 font-medium">Avg. Order</th>
                              <th className="py-3 px-4 font-medium w-48">Volume</th>
                              <th className="py-3 px-5 font-medium text-right">Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.05]">
                            {(salesAnalytics?.monthlyReport ?? []).map((row) => {
                              const pct = Math.min(
                                100,
                                Math.round((row.revenue / maxMonthlyRev) * 100),
                              );
                              return (
                                <tr key={row.month} className="hover:bg-white/[0.02]">
                                  <td className="py-3 px-5 font-mono-tabular text-white font-medium">
                                    {row.month}
                                  </td>
                                  <td className="py-3 px-4 font-mono-tabular text-white/75">
                                    {row.ordersCount}
                                  </td>
                                  <td className="py-3 px-4 font-mono-tabular text-white/75">
                                    {row.unitsSold}
                                  </td>
                                  <td className="py-3 px-4 font-mono-tabular text-white/75">
                                    {formatPKR(row.avgOrderValue)}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                                      <div
                                        className="h-full bg-[#36d67e] rounded-full"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </td>
                                  <td className="py-3 px-5 text-right font-mono-tabular text-[#d6be96] font-semibold">
                                    {formatPKR(row.revenue)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>

                {/* Top Fragrances & Top Cities */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="rounded-xl bg-[#0a0a0f] border border-white/[0.08] overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-white/[0.08]">
                      <h3 className="text-sm font-semibold text-white">
                        Top Performing Fragrances
                      </h3>
                    </div>
                    {(salesAnalytics?.topProducts.length ?? 0) === 0 ? (
                      <p className="p-6 text-xs text-white/45">No fragrance unit sales yet.</p>
                    ) : (
                      <div className="divide-y divide-white/[0.05] text-xs">
                        {salesAnalytics?.topProducts.map((tp, idx) => (
                          <div
                            key={tp.productId}
                            className="px-5 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono-tabular text-white/40">0{idx + 1}</span>
                              <span className="text-white font-medium truncate">{tp.name}</span>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 font-mono-tabular">
                              <span className="text-white/60">{tp.unitsSold} sold</span>
                              <span className="text-[#d6be96] font-semibold">
                                {formatPKR(tp.revenue)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-[#0a0a0f] border border-white/[0.08] overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-white/[0.08]">
                      <h3 className="text-sm font-semibold text-white">Top Delivery Cities</h3>
                    </div>
                    {(salesAnalytics?.topCities.length ?? 0) === 0 ? (
                      <p className="p-6 text-xs text-white/45">No city dispatch data yet.</p>
                    ) : (
                      <div className="divide-y divide-white/[0.05] text-xs">
                        {salesAnalytics?.topCities.map((tc, idx) => (
                          <div
                            key={tc.city}
                            className="px-5 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono-tabular text-white/40">0{idx + 1}</span>
                              <span className="text-white font-medium truncate">{tc.city}</span>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 font-mono-tabular">
                              <span className="text-white/60">{tc.ordersCount} orders</span>
                              <span className="text-[#36d67e] font-semibold">
                                {formatPKR(tc.revenue)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 3: INVENTORY, LOW-STOCK THRESHOLDS & LIVE PRICING
               =============================================================== */}
            {activeTab === 'products' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Inventory, Low-Stock Thresholds &amp; PKR Pricing
                    </h2>
                    <p className="text-xs text-white/50 mt-0.5">
                      Stock automatically deducts on order placement and restocks if an order is
                      cancelled.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      resetProductOverrides();
                      setPriceInputs({});
                      setStockInputs({});
                      setThresholdInputs({});
                    }}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs text-white cursor-pointer self-start"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Defaults (PKR 2,500 · 48 Units)</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {products.map((prod) => {
                    const currentPriceVal =
                      priceInputs[prod.id] ?? String(prod.sizes[0].price);
                    const currentStockVal =
                      stockInputs[prod.id] ?? String(prod.stockUnits);
                    const currentThresholdVal =
                      thresholdInputs[prod.id] ?? String(prod.lowStockThreshold);

                    return (
                      <div
                        key={prod.id}
                        className={`p-4 sm:p-5 rounded-xl bg-[#0a0a0f] border grid grid-cols-1 xl:grid-cols-12 gap-4 items-center ${
                          !prod.inStock
                            ? 'border-red-500/35'
                            : prod.isLowStock
                              ? 'border-amber-400/40'
                              : 'border-white/[0.08]'
                        }`}
                      >
                        <div className="xl:col-span-4 flex items-center gap-3.5 min-w-0">
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#050508] shrink-0 border border-white/10">
                            <LuxuryImage
                              src={prod.primaryImage}
                              alt={prod.name}
                              className="w-full h-full object-contain sm:object-cover"
                            />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-mono-tabular text-[#d6be96]">
                                Edition {prod.numberCode}
                              </span>
                              {!prod.inStock ? (
                                <span className="px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/35 text-[10px] font-semibold text-red-300">
                                  Out of Stock
                                </span>
                              ) : prod.isLowStock ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/35 text-[10px] font-semibold text-amber-300">
                                  Low Stock ({prod.stockUnits})
                                </span>
                              ) : null}
                            </div>
                            <Link
                              to={`/product/${prod.slug}`}
                              className="font-serif-display text-xl sm:text-2xl text-white hover:text-[#d6be96] block truncate"
                            >
                              {prod.name}
                            </Link>
                            <p className="text-xs text-white/45 truncate">{prod.keyNotesSummary}</p>
                          </div>
                        </div>

                        {/* Price Input (PKR) */}
                        <div className="xl:col-span-2 space-y-1">
                          <label className="block text-[11px] text-white/45">
                            Price (PKR · 50ml)
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              min={100}
                              step={50}
                              value={currentPriceVal}
                              onChange={(e) =>
                                setPriceInputs({ ...priceInputs, [prod.id]: e.target.value })
                              }
                              className="w-full h-9 px-2.5 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const parsed = Number(currentPriceVal);
                                if (!Number.isNaN(parsed) && parsed > 0) {
                                  updateProductOverride(prod.id, { price: parsed });
                                }
                              }}
                              className="h-9 px-2.5 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold cursor-pointer shrink-0"
                            >
                              Save
                            </button>
                          </div>
                        </div>

                        {/* Stock Units + Quick Restock */}
                        <div className="xl:col-span-3 space-y-1">
                          <label className="block text-[11px] text-white/45">
                            Stock Units (50ml Flacons)
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              value={currentStockVal}
                              onChange={(e) =>
                                setStockInputs({ ...stockInputs, [prod.id]: e.target.value })
                              }
                              onBlur={() => {
                                const parsed = Number(currentStockVal);
                                if (!Number.isNaN(parsed) && parsed >= 0) {
                                  updateProductOverride(prod.id, {
                                    stockUnits: parsed,
                                    inStock: parsed > 0,
                                  });
                                }
                              }}
                              className="w-20 h-9 px-2.5 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = prod.stockUnits + 10;
                                setStockInputs({ ...stockInputs, [prod.id]: String(next) });
                                updateProductOverride(prod.id, { stockUnits: next, inStock: true });
                              }}
                              className="h-9 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-mono-tabular text-white cursor-pointer"
                            >
                              +10
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = prod.stockUnits + 25;
                                setStockInputs({ ...stockInputs, [prod.id]: String(next) });
                                updateProductOverride(prod.id, { stockUnits: next, inStock: true });
                              }}
                              className="h-9 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-mono-tabular text-white cursor-pointer"
                            >
                              +25
                            </button>
                          </div>
                        </div>

                        {/* Low-Stock Alert Threshold + Toggles */}
                        <div className="xl:col-span-3 flex flex-wrap items-end justify-between xl:justify-end gap-2.5">
                          <div className="space-y-1">
                            <label className="block text-[11px] text-white/45">Alert At ≤</label>
                            <input
                              type="number"
                              min={1}
                              max={200}
                              value={currentThresholdVal}
                              onChange={(e) =>
                                setThresholdInputs({
                                  ...thresholdInputs,
                                  [prod.id]: e.target.value,
                                })
                              }
                              onBlur={() => {
                                const parsed = Number(currentThresholdVal);
                                if (!Number.isNaN(parsed) && parsed >= 0) {
                                  updateProductOverride(prod.id, { lowStockThreshold: parsed });
                                }
                              }}
                              className="w-16 h-9 px-2.5 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateProductOverride(prod.id, { inStock: !prod.inStock })
                              }
                              className={`h-9 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                                prod.inStock
                                  ? 'bg-[#36d67e]/12 text-[#36d67e] border-[#36d67e]/35'
                                  : 'bg-red-500/12 text-red-300 border-red-500/35'
                              }`}
                            >
                              {prod.inStock ? 'In Stock' : 'Paused'}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateProductOverride(prod.id, {
                                  isBestSeller: !prod.isBestSeller,
                                })
                              }
                              className={`h-9 px-2.5 rounded-lg text-xs border transition-colors cursor-pointer ${
                                prod.isBestSeller
                                  ? 'bg-[#d6be96]/15 text-[#d6be96] border-[#d6be96]/40'
                                  : 'bg-white/[0.03] text-white/45 border-white/10 hover:text-white'
                              }`}
                            >
                              Best Seller
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 4: CONFIGURABLE CITY SHIPPING & COUPON MANAGEMENT
               =============================================================== */}
            {activeTab === 'promotions' && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left Column: Configurable Shipping Charges by City */}
                <div className="xl:col-span-6 space-y-4">
                  <div className="p-5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Truck className="w-4 h-4 text-[#d6be96]" />
                          <span>Configurable City Shipping Charges</span>
                        </h2>
                        <p className="text-xs text-white/45 mt-0.5">
                          Set Standard, Express, and Free-Shipping thresholds per city.
                        </p>
                      </div>
                      {cityKeyDraft && (
                        <button
                          type="button"
                          onClick={resetCityForm}
                          className="text-xs text-[#d6be96] hover:underline cursor-pointer"
                        >
                          + New City
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleSaveShippingSubmit} className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-white/55 mb-1">
                            City Name *
                          </label>
                          <input
                            type="text"
                            required
                            disabled={cityKeyDraft === '__default__'}
                            value={cityNameDraft}
                            onChange={(e) => setCityNameDraft(e.target.value)}
                            placeholder="e.g. Sialkot, Gujranwala"
                            className="w-full h-9 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs text-white disabled:opacity-60 focus:outline-none focus:border-[#d6be96]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-white/55 mb-1">
                            Delivery Estimate
                          </label>
                          <input
                            type="text"
                            value={estimatedDaysDraft}
                            onChange={(e) => setEstimatedDaysDraft(e.target.value)}
                            placeholder="2–3 Working Days"
                            className="w-full h-9 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs text-white focus:outline-none focus:border-[#d6be96]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-white/55 mb-1">
                            Standard (PKR)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={standardFeeDraft}
                            onChange={(e) => setStandardFeeDraft(e.target.value)}
                            className="w-full h-9 px-2.5 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-white/55 mb-1">
                            Express (PKR)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={expressFeeDraft}
                            onChange={(e) => setExpressFeeDraft(e.target.value)}
                            className="w-full h-9 px-2.5 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-white/55 mb-1">
                            Free Over (PKR)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={freeThresholdDraft}
                            onChange={(e) => setFreeThresholdDraft(e.target.value)}
                            className="w-full h-9 px-2.5 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="inline-flex items-center gap-2 text-xs text-white/75 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cityActiveDraft}
                            onChange={(e) => setCityActiveDraft(e.target.checked)}
                            className="accent-[#d6be96]"
                          />
                          <span>Active on Checkout</span>
                        </label>

                        <button
                          type="submit"
                          disabled={isSavingCity}
                          className="h-9 px-4 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{cityKeyDraft ? 'Update City Rate' : 'Save City Rate'}</span>
                        </button>
                      </div>
                    </form>

                    {/* Configured Cities List */}
                    <div className="pt-3 border-t border-white/[0.08] divide-y divide-white/[0.06]">
                      {adminShippingRates.map((rate) => (
                        <div
                          key={rate.cityKey}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white truncate">
                                {rate.cityName}
                              </span>
                              {rate.cityKey === '__default__' && (
                                <span className="px-1.5 py-0.5 rounded bg-white/[0.07] text-[10px] text-[#d6be96]">
                                  Fallback
                                </span>
                              )}
                              {!rate.active && (
                                <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-[10px] text-red-300">
                                  Paused
                                </span>
                              )}
                            </div>
                            <p className="font-mono-tabular text-[11px] text-white/50">
                              Std: {formatPKR(rate.standardFee)} · Exp: {formatPKR(rate.expressFee)}{' '}
                              · Free ≥ {formatPKR(rate.freeShippingThreshold)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditCityRate(rate)}
                              className="h-8 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-white cursor-pointer"
                            >
                              Edit
                            </button>
                            {rate.cityKey !== '__default__' && (
                              <button
                                type="button"
                                onClick={() => deleteAdminShippingRate(rate.cityKey)}
                                aria-label={`Delete ${rate.cityName}`}
                                className="h-8 px-2 rounded-lg bg-white/[0.04] hover:bg-red-500/15 text-white/45 hover:text-red-300 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Discount & Coupon Code Management */}
                <div className="xl:col-span-6 space-y-4">
                  <div className="p-5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Tag className="w-4 h-4 text-[#d6be96]" />
                        <span>Discount &amp; Coupon Codes</span>
                      </h2>
                      <p className="text-xs text-white/45 mt-0.5">
                        Create percentage or fixed PKR coupons with minimum order rules and usage
                        caps.
                      </p>
                    </div>

                    <form onSubmit={handleSaveCouponSubmit} className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-white/55 mb-1">
                            Coupon Code *
                          </label>
                          <input
                            type="text"
                            required
                            value={couponCodeDraft}
                            onChange={(e) => setCouponCodeDraft(e.target.value.toUpperCase())}
                            placeholder="EID20 / VIP500"
                            className="w-full h-9 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular uppercase text-white focus:outline-none focus:border-[#d6be96]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/55 mb-1">
                            Discount Type
                          </label>
                          <select
                            value={couponTypeDraft}
                            onChange={(e) => setCouponTypeDraft(e.target.value as DiscountType)}
                            className="w-full h-9 px-2.5 rounded-lg bg-[#050508] border border-white/15 text-xs text-white focus:outline-none focus:border-[#d6be96]"
                          >
                            <option value="percentage" className="bg-[#0a0a0f]">
                              Percentage (%)
                            </option>
                            <option value="fixed" className="bg-[#0a0a0f]">
                              Fixed Amount (PKR)
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/55 mb-1">
                            {couponTypeDraft === 'percentage' ? 'Percent Off (%)' : 'PKR Off'} *
                          </label>
                          <input
                            type="number"
                            required
                            min={1}
                            max={couponTypeDraft === 'percentage' ? 90 : 100000}
                            value={couponValueDraft}
                            onChange={(e) => setCouponValueDraft(e.target.value)}
                            className="w-full h-9 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-white/55 mb-1">
                            Min. Subtotal (PKR)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={couponMinOrderDraft}
                            onChange={(e) => setCouponMinOrderDraft(e.target.value)}
                            className="w-full h-9 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/55 mb-1">
                            Max Uses (Blank = ∞)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={couponMaxUsesDraft}
                            onChange={(e) => setCouponMaxUsesDraft(e.target.value)}
                            placeholder="Unlimited"
                            className="w-full h-9 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/55 mb-1">
                            Optional Expiry Date
                          </label>
                          <input
                            type="date"
                            value={couponExpiryDraft}
                            onChange={(e) => setCouponExpiryDraft(e.target.value)}
                            className="w-full h-9 px-2.5 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="text"
                          value={couponDescDraft}
                          onChange={(e) => setCouponDescDraft(e.target.value)}
                          placeholder="Label shown at checkout (e.g. Private VIP Privilege)"
                          className="flex-1 h-9 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs text-white focus:outline-none focus:border-[#d6be96]"
                        />
                        <button
                          type="submit"
                          disabled={isSavingCoupon}
                          className="h-9 px-4 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold cursor-pointer shrink-0 inline-flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Save Coupon</span>
                        </button>
                      </div>
                    </form>

                    {/* Active & Saved Coupons List */}
                    <div className="pt-3 border-t border-white/[0.08] divide-y divide-white/[0.06]">
                      {adminCoupons.map((c) => (
                        <div
                          key={c.code}
                          className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono-tabular font-semibold text-[#d6be96]">
                                {c.code}
                              </span>
                              <span className="font-mono-tabular text-white">
                                {c.discountType === 'percentage'
                                  ? `${c.discountValue}% OFF`
                                  : `${formatPKR(c.discountValue)} OFF`}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  c.active
                                    ? 'bg-[#36d67e]/15 text-[#36d67e]'
                                    : 'bg-white/[0.07] text-white/45'
                                }`}
                              >
                                {c.active ? 'Active' : 'Paused'}
                              </span>
                            </div>
                            <p className="text-[11px] text-white/50 font-mono-tabular">
                              Min: {formatPKR(c.minOrderAmount)} · Used: {c.usedCount}
                              {c.maxUses !== null ? ` / ${c.maxUses}` : ''}{' '}
                              {c.description ? `· ${c.description}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleAdminCoupon(c.code, !c.active)}
                              className="h-8 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-white cursor-pointer"
                            >
                              {c.active ? 'Pause' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAdminCoupon(c.code)}
                              aria-label={`Delete coupon ${c.code}`}
                              className="h-8 px-2 rounded-lg bg-white/[0.04] hover:bg-red-500/15 text-white/45 hover:text-red-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 5: REVIEWS MODERATION, CONCIERGE INQUIRIES & REGISTRY
               =============================================================== */}
            {activeTab === 'inquiries' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-5">
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-white">
                      Client Product Reviews ({flatCustomReviews.length})
                    </h2>
                    {flatCustomReviews.length === 0 ? (
                      <div className="p-6 rounded-xl bg-[#0a0a0f] border border-white/[0.08] text-xs text-white/50">
                        Submitted customer reviews on product pages persist in SQLite and appear
                        here for moderation.
                      </div>
                    ) : (
                      flatCustomReviews.map((r) => (
                        <div
                          key={r.id}
                          className="p-4 rounded-xl bg-[#0a0a0f] border border-white/[0.08] flex items-start justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-[#d6be96]">
                                {r.productName} · {r.rating}/5 ★
                              </span>
                              {r.verifiedPurchase && (
                                <span className="px-1.5 py-0.5 rounded bg-[#36d67e]/15 text-[#36d67e] text-[10px] font-medium">
                                  Verified Order
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-white">{r.title}</p>
                            <p className="text-xs text-white/65">{r.comment}</p>
                            <p className="text-[11px] text-white/40">
                              By {r.author} · {r.date}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteProductReview(r.productId, r.id)}
                            className="p-1.5 text-white/40 hover:text-red-400 cursor-pointer"
                            aria-label="Delete review"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-3 pt-2">
                    <h2 className="text-sm font-semibold text-white">
                      Concierge Inquiries ({inquiries.length})
                    </h2>

                    {inquiries.length === 0 ? (
                      <div className="p-8 rounded-xl bg-[#0a0a0f] border border-white/[0.08] text-center space-y-2">
                        <Mail className="w-6 h-6 text-[#d6be96] mx-auto" />
                        <p className="text-sm text-white">No client messages yet</p>
                        <p className="text-xs text-white/45">
                          Messages submitted on the Contact page appear here in real time.
                        </p>
                      </div>
                    ) : (
                      inquiries.map((inq) => (
                        <div
                          key={inq.id}
                          className="p-5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-white">
                                {inq.name} ·{' '}
                                <span className="text-[#d6be96] font-normal">{inq.email}</span>
                              </p>
                              <p className="text-[11px] text-white/45">
                                {inq.topic} · {inq.createdAt}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleInquiryResolved(inq.id)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] border cursor-pointer ${
                                inq.resolved
                                  ? 'bg-[#36d67e]/15 text-[#36d67e] border-[#36d67e]/35'
                                  : 'bg-white/[0.05] text-white/70 border-white/15'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              <span>{inq.resolved ? 'Resolved' : 'Mark Resolved'}</span>
                            </button>
                          </div>

                          <p className="text-xs text-white/70 leading-relaxed">{inq.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Newsletter Subscribers List */}
                <div className="lg:col-span-5 p-5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">
                      Private Registry Subscribers
                    </h2>
                    <span className="font-mono-tabular text-xs text-[#d6be96]">
                      {subscribers.length}
                    </span>
                  </div>

                  {subscribers.length === 0 ? (
                    <p className="text-xs text-white/45 py-4">
                      Emails registered via the homepage NORVA Private Registry form will appear
                      here.
                    </p>
                  ) : (
                    <ul className="divide-y divide-white/[0.06] text-xs">
                      {subscribers.map((em) => (
                        <li key={em} className="py-2.5 text-white/80 font-mono-tabular break-all">
                          {em}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 6: SECURE DATABASE BACKUPS & JSON EXPORT
               =============================================================== */}
            {activeTab === 'backups' && (
              <div className="space-y-6">
                <div className="p-5 sm:p-6 rounded-xl bg-[#0a0a0f] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#d6be96]" />
                      <span>SQLite Database Snapshots &amp; Recovery</span>
                    </h2>
                    <p className="text-xs text-white/55 max-w-2xl leading-relaxed">
                      Create atomic point-in-time SQLite database snapshots using{' '}
                      <code className="font-mono-tabular text-[#d6be96]">VACUUM INTO</code> without
                      locking live customer checkouts, or download a complete JSON archive of all
                      orders, inventory, coupons, shipping rates, and reviews.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      disabled={isCreatingBackup}
                      onClick={handleCreateSnapshot}
                      className="h-10 px-4 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] disabled:opacity-60 text-[#050508] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                    >
                      {isCreatingBackup ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating Snapshot...</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-3.5 h-3.5" />
                          <span>Create SQLite Snapshot</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={exportAdminJsonBackup}
                      className="h-10 px-4 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs font-medium text-white inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#d6be96]" />
                      <span>Export Full JSON</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-[#0a0a0f] border border-white/[0.08] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">
                      Saved Server Snapshots ({adminBackups.length})
                    </h3>
                    <span className="text-[11px] text-white/45 font-mono-tabular">
                      Retains latest 20 snapshots
                    </span>
                  </div>

                  {adminBackups.length === 0 ? (
                    <div className="p-10 text-center space-y-2">
                      <Database className="w-7 h-7 text-[#d6be96] mx-auto" />
                      <p className="text-sm text-white">No manual snapshots created yet</p>
                      <p className="text-xs text-white/45">
                        Click “Create SQLite Snapshot” above to save an instant binary backup.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.06] text-xs">
                      {adminBackups.map((bk) => (
                        <div
                          key={bk.filename}
                          className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-mono-tabular text-white font-medium truncate">
                              {bk.filename}
                            </p>
                            <p className="text-[11px] text-white/45 font-mono-tabular">
                              Created: {new Date(bk.createdAtIso).toLocaleString()} · Size:{' '}
                              {formatBytesLabel(bk.sizeBytes)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => downloadAdminBackup(bk.filename)}
                            className="h-8 px-3.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] border border-white/12 text-xs text-white inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-[#d6be96]" />
                            <span>Download .sqlite</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          INDIVIDUAL ORDER DETAILS MODAL / DRAWER
         ===================================================================== */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => {
            setSelectedOrderNumber(null);
            setConfirmDeleteOrderNum(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-3xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#0a0a0f] border border-white/15 shadow-[0_28px_90px_rgba(0,0,0,0.95)] p-4 sm:p-7 space-y-6"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.08]">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-[#d6be96]">
                    Order Dossier
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded border text-[11px] font-medium ${getStatusColor(
                      selectedOrder.status ?? 'Pending',
                    )}`}
                  >
                    {selectedOrder.status ?? 'Pending'}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded border text-[11px] font-medium ${getPaymentStatusColor(
                      selectedOrder.paymentStatus ?? 'Pending',
                    )}`}
                  >
                    Payment: {selectedOrder.paymentStatus ?? 'Pending'}
                  </span>
                </div>
                <h2 className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-white">
                  {selectedOrder.orderNumber}
                </h2>
                <p className="text-xs text-white/50">Placed on {selectedOrder.createdAt}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedOrderNumber(null);
                  setConfirmDeleteOrderNum(null);
                }}
                aria-label="Close order details"
                className="w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/75 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Workflow Status Progression & Controls */}
            <div className="p-4 rounded-xl bg-[#050508] border border-white/[0.08] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-white">Fulfillment &amp; Status Actions</p>
                <span className="text-[11px] text-white/45">
                  Cancelling automatically restocks flacon inventory
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => updateOrderStatus(selectedOrder.orderNumber, 'Confirmed')}
                  className={`h-9 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                    selectedOrder.status === 'Confirmed'
                      ? 'bg-sky-400 text-[#050508] border-sky-400 font-semibold'
                      : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border-sky-400/30'
                  }`}
                >
                  1. Confirm
                </button>
                <button
                  type="button"
                  onClick={() => updateOrderStatus(selectedOrder.orderNumber, 'Processing')}
                  className={`h-9 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                    selectedOrder.status === 'Processing'
                      ? 'bg-[#d6be96] text-[#050508] border-[#d6be96] font-semibold'
                      : 'bg-[#d6be96]/10 hover:bg-[#d6be96]/20 text-[#d6be96] border-[#d6be96]/35'
                  }`}
                >
                  2. Process
                </button>
                <button
                  type="button"
                  onClick={() => updateOrderStatus(selectedOrder.orderNumber, 'Shipped')}
                  className={`h-9 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                    selectedOrder.status === 'Shipped'
                      ? 'bg-[#b9abff] text-[#050508] border-[#b9abff] font-semibold'
                      : 'bg-[#b9abff]/10 hover:bg-[#b9abff]/20 text-[#b9abff] border-[#b9abff]/35'
                  }`}
                >
                  3. Ship
                </button>
                <button
                  type="button"
                  onClick={() => updateOrderStatus(selectedOrder.orderNumber, 'Delivered')}
                  className={`h-9 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                    selectedOrder.status === 'Delivered'
                      ? 'bg-[#36d67e] text-[#050508] border-[#36d67e] font-semibold'
                      : 'bg-[#36d67e]/10 hover:bg-[#36d67e]/20 text-[#36d67e] border-[#36d67e]/35'
                  }`}
                >
                  4. Deliver
                </button>
                <button
                  type="button"
                  onClick={() => updateOrderStatus(selectedOrder.orderNumber, 'Cancelled')}
                  className={`col-span-2 sm:col-span-1 h-9 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                    selectedOrder.status === 'Cancelled'
                      ? 'bg-red-500 text-white border-red-500 font-semibold'
                      : 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30'
                  }`}
                >
                  Cancel Order
                </button>
              </div>
            </div>

            {/* Customer Info & Payment Info Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-[#050508] border border-white/[0.08] space-y-2">
                <p className="text-[11px] uppercase tracking-[0.15em] text-[#d6be96]">
                  Customer &amp; Delivery Address
                </p>
                <p className="text-sm font-semibold text-white">
                  {selectedOrder.customer.fullName}
                </p>
                <p className="font-mono-tabular text-white/85">
                  Phone:{' '}
                  <a href={`tel:${selectedOrder.customer.phone}`} className="underline">
                    {selectedOrder.customer.phone}
                  </a>
                </p>
                <p className="text-white/75 break-all">Email: {selectedOrder.customer.email}</p>
                <div className="pt-2 border-t border-white/[0.06] space-y-1 text-white/80">
                  <p>{selectedOrder.customer.address}</p>
                  <p>
                    {selectedOrder.customer.city}
                    {selectedOrder.customer.postalCode
                      ? `, ${selectedOrder.customer.postalCode}`
                      : ''}
                  </p>
                  <p>{selectedOrder.customer.country}</p>
                </div>
                <div className="pt-2">
                  <a
                    href={formatWhatsAppHref(
                      selectedOrder.customer.phone,
                      selectedOrder.orderNumber,
                      selectedOrder.customer.fullName,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#36d67e]/15 border border-[#36d67e]/35 text-[#36d67e] font-medium"
                  >
                    <span>Message Client on WhatsApp</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#050508] border border-white/[0.08] space-y-3">
                <p className="text-[11px] uppercase tracking-[0.15em] text-[#d6be96]">
                  Payment &amp; Courier Settlement
                </p>
                <div className="space-y-1.5 text-white/80">
                  <p>
                    Method:{' '}
                    <strong className="text-white">
                      {formatPaymentMethodLabel(selectedOrder.paymentMethod)}
                    </strong>
                  </p>
                  <p>
                    Courier Speed:{' '}
                    <strong className="text-white">
                      {selectedOrder.shippingSpeed === 'express'
                        ? 'Priority Overnight Air (1–2 Days)'
                        : 'Standard Insured Courier (2–4 Days)'}
                    </strong>
                  </p>
                  {selectedOrder.couponCode && (
                    <p className="text-[#36d67e]">
                      Coupon Applied: <strong>{selectedOrder.couponCode}</strong>
                    </p>
                  )}
                  {selectedOrder.giftNote && (
                    <p className="text-[#d6be96] italic">
                      Gift Card Note: “{selectedOrder.giftNote}”
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                  <label className="block text-[11px] text-white/55">Update Payment Status</label>
                  <div className="flex gap-1.5">
                    {PAYMENT_STATUSES.map((ps) => {
                      const active = (selectedOrder.paymentStatus ?? 'Pending') === ps;
                      return (
                        <button
                          key={ps}
                          type="button"
                          onClick={() => updateOrderPaymentStatus(selectedOrder.orderNumber, ps)}
                          className={`flex-1 h-8 rounded-lg border text-xs font-medium cursor-pointer ${
                            active
                              ? 'bg-[#f2e6d5] text-[#050508] border-[#f2e6d5]'
                              : 'bg-[#0a0a0f] text-white/65 border-white/12 hover:text-white'
                          }`}
                        >
                          {ps}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Ordered Items Breakdown */}
            <div className="rounded-xl bg-[#050508] border border-white/[0.08] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-2 text-xs font-semibold text-white">
                <ShoppingBag className="w-3.5 h-3.5 text-[#d6be96]" />
                <span>Ordered Fragrances ({selectedOrder.items.length})</span>
              </div>

              <div className="divide-y divide-white/[0.06]">
                {selectedOrder.items.map((item) => (
                  <div
                    key={item.key}
                    className="p-3.5 sm:px-4 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-[#0a0a0f] border border-white/10 overflow-hidden shrink-0">
                        <LuxuryImage
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-serif-display text-lg text-white truncate">
                          {item.name}
                        </p>
                        <p className="text-white/50 font-mono-tabular">
                          {item.sizeLabel} · SKU: {item.sizeSku} · {formatPKR(item.unitPrice)} ×{' '}
                          <strong className="text-white">{item.quantity}</strong>
                        </p>
                      </div>
                    </div>
                    <span className="font-mono-tabular text-sm font-semibold text-white shrink-0">
                      {formatPKR(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-[#08080d] border-t border-white/[0.08] space-y-1.5 text-xs">
                <div className="flex justify-between text-white/60">
                  <span>Items Subtotal</span>
                  <span className="font-mono-tabular">{formatPKR(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-[#36d67e]">
                    <span>Discount ({selectedOrder.couponCode})</span>
                    <span className="font-mono-tabular">
                      -{formatPKR(selectedOrder.discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-white/60">
                  <span>Courier Fee ({selectedOrder.customer.city})</span>
                  <span className="font-mono-tabular">
                    {selectedOrder.shippingCost === 0
                      ? 'Complimentary'
                      : formatPKR(selectedOrder.shippingCost)}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/[0.08] flex justify-between items-baseline text-sm font-semibold text-white">
                  <span>Total Order Amount</span>
                  <span className="font-mono-tabular text-lg text-[#d6be96]">
                    {formatPKR(selectedOrder.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Private Admin Dispatch / Tracking Notes */}
            <div className="p-4 rounded-xl bg-[#050508] border border-white/[0.08] space-y-2.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-white">
                <FileText className="w-3.5 h-3.5 text-[#d6be96]" />
                <span>Private Admin Notes (Courier Tracking ID / Internal Remarks)</span>
              </label>
              <textarea
                rows={2}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="e.g. TCS Tracking #77819204 — Confirmed via phone call..."
                className="w-full p-3 rounded-lg bg-[#0a0a0f] border border-white/15 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#d6be96]"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSaveAdminNotes}
                  disabled={isSavingNotes}
                  className="h-9 px-4 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold cursor-pointer"
                >
                  {isSavingNotes ? 'Saving...' : 'Save Admin Notes'}
                </button>

                {confirmDeleteOrderNum === selectedOrder.orderNumber ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-300">Permanently delete?</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const target = selectedOrder.orderNumber;
                        const ok = await deleteOrder(target);
                        if (ok) {
                          setSelectedOrderNumber(null);
                          setConfirmDeleteOrderNum(null);
                        }
                      }}
                      className="h-8 px-3 rounded-lg bg-red-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOrderNum(null)}
                      className="h-8 px-3 rounded-lg bg-white/[0.08] text-xs text-white cursor-pointer"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOrderNum(selectedOrder.orderNumber)}
                    className="h-9 px-3 rounded-lg bg-white/[0.04] hover:bg-red-500/15 text-xs text-white/55 hover:text-red-300 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Order</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          AUTHENTICATED ADMIN PASSWORD ROTATION MODAL
         ===================================================================== */}
      {isPasswordModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setIsPasswordModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#0a0a0f] border border-white/15 shadow-[0_28px_90px_rgba(0,0,0,0.95)] p-5 sm:p-7 space-y-5"
          >
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-white/[0.08]">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#d6be96]">
                  Account Security
                </p>
                <h2 className="font-serif-display text-2xl text-white mt-0.5">
                  Change Admin Password
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                aria-label="Close password modal"
                className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/75 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-white/65 mb-1.5" htmlFor="current-admin-pwd">
                  Current Password
                </label>
                <input
                  id="current-admin-pwd"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPwdInput}
                  onChange={(e) => {
                    setCurrentPwdInput(e.target.value);
                    setPasswordFormError(null);
                    setPasswordFormSuccess(null);
                  }}
                  placeholder="Enter current password"
                  className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d6be96]"
                />
              </div>

              <div>
                <label className="block text-xs text-white/65 mb-1.5" htmlFor="new-admin-pwd">
                  New Password (minimum 8 characters)
                </label>
                <input
                  id="new-admin-pwd"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={newPwdInput}
                  onChange={(e) => {
                    setNewPwdInput(e.target.value);
                    setPasswordFormError(null);
                    setPasswordFormSuccess(null);
                  }}
                  placeholder="Enter strong new password"
                  className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d6be96]"
                />
              </div>

              <div>
                <label className="block text-xs text-white/65 mb-1.5" htmlFor="confirm-admin-pwd">
                  Confirm New Password
                </label>
                <input
                  id="confirm-admin-pwd"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPwdInput}
                  onChange={(e) => {
                    setConfirmPwdInput(e.target.value);
                    setPasswordFormError(null);
                    setPasswordFormSuccess(null);
                  }}
                  placeholder="Re-enter new password"
                  className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d6be96]"
                />
              </div>

              {passwordFormError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                  {passwordFormError}
                </div>
              )}

              {passwordFormSuccess && (
                <div className="p-3 rounded-lg bg-[#36d67e]/10 border border-[#36d67e]/35 text-xs text-[#36d67e]">
                  {passwordFormSuccess}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="h-10 px-4 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-white cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="h-10 px-5 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] disabled:opacity-60 text-[#050508] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
