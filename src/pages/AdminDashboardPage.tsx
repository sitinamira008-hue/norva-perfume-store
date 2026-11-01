import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Box,
  Check,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { formatPKR } from '../data/products';
import { OrderStatus, useStore } from '../context/StoreContext';
import { LuxuryImage, SEOHead } from '../components/LuxuryUI';

type AdminTab = 'overview' | 'orders' | 'products' | 'inquiries';

const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Processing',
  'Dispatched',
  'Delivered',
  'Cancelled',
];

function getStatusColor(status: OrderStatus = 'Pending'): string {
  switch (status) {
    case 'Delivered':
      return 'text-[#36d67e] bg-[#36d67e]/10 border-[#36d67e]/30';
    case 'Dispatched':
      return 'text-[#b9abff] bg-[#b9abff]/10 border-[#b9abff]/30';
    case 'Processing':
      return 'text-[#d6be96] bg-[#d6be96]/10 border-[#d6be96]/30';
    case 'Cancelled':
      return 'text-red-400 bg-red-500/10 border-red-500/30';
    default:
      return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  }
}

export const AdminDashboardPage: React.FC = () => {
  const {
    adminSession,
    loginAdmin,
    logoutAdmin,
    products,
    orders,
    inquiries,
    subscribers,
    customReviews,
    updateOrderStatus,
    deleteOrder,
    updateProductOverride,
    resetProductOverrides,
    toggleInquiryResolved,
    deleteProductReview,
  } = useStore();

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dashboard Workspace State
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | OrderStatus>('All');
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = loginAdmin(loginEmail, loginPassword);
    if (!res.ok) {
      setLoginError(res.error ?? 'Authentication failed');
    } else {
      setLoginError(null);
      setLoginPassword('');
    }
  };

  // Computed Storefront Metrics
  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== 'Cancelled');
    const totalRevenue = validOrders.reduce((acc, o) => acc + o.total, 0);
    const pendingOrders = orders.filter((o) => (o.status ?? 'Pending') === 'Pending').length;
    const totalUnitsSold = validOrders.reduce(
      (acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0),
      0,
    );
    const openInquiries = inquiries.filter((i) => !i.resolved).length;
    return {
      totalRevenue,
      totalOrders: orders.length,
      pendingOrders,
      totalUnitsSold,
      openInquiries,
    };
  }, [orders, inquiries]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((ord) => {
      const currentStatus = ord.status ?? 'Pending';
      if (orderStatusFilter !== 'All' && currentStatus !== orderStatusFilter) return false;
      if (q) {
        const hay = `${ord.orderNumber} ${ord.customer.fullName} ${ord.customer.email} ${ord.customer.phone} ${ord.customer.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, orderSearch, orderStatusFilter]);

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
        });
      });
    });
    return rows;
  }, [customReviews, products]);

  // =========================================================================
  // 1. ADMIN LOGIN GATE (ANY GMAIL + PASSWORD === 'usman122')
  // =========================================================================
  if (!adminSession) {
    return (
      <div className="min-h-[82vh] bg-transparent text-[#f5f3ef] flex items-center justify-center px-3.5 sm:px-4 py-10 sm:py-16">
        <SEOHead
          title="Admin Console Sign In"
          description="NORVA Haute Parfumerie Admin Dashboard authentication."
        />

        <div className="w-full max-w-md p-5 sm:p-10 rounded-2xl bg-[#0a0a0f] border border-white/10 space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-[#d6be96]">
              <Lock className="w-5 h-5" />
            </div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#d6be96] pt-1">
              NORVA Executive Console
            </p>
            <h1 className="font-serif-display text-3xl sm:text-4xl text-white">
              Admin Sign In
            </h1>
            <p className="text-xs text-white/55">
              Enter your Gmail address and administrator password to manage orders, inventory, and
              pricing.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-white/65 mb-1.5" htmlFor="admin-gmail">
                Gmail / Email Address
              </label>
              <input
                id="admin-gmail"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  setLoginError(null);
                }}
                placeholder="admin@gmail.com"
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
              className="w-full h-11 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer"
            >
              Access Dashboard
            </button>
          </form>

          <div className="pt-4 border-t border-white/[0.06] text-center">
            <Link to="/" className="text-xs text-white/45 hover:text-white transition-colors">
              ← Return to NORVA Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. AUTHENTICATED ADMIN WORKSPACE (SIDEBAR + TOP BAR + HIGH-DENSITY VIEWS)
  // =========================================================================
  const navItems: { id: AdminTab; label: string; badge?: number; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'orders',
      label: 'Orders',
      badge: metrics.pendingOrders > 0 ? metrics.pendingOrders : undefined,
      icon: <Package className="w-4 h-4" />,
    },
    {
      id: 'products',
      label: 'Fragrances (5)',
      icon: <Box className="w-4 h-4" />,
    },
    {
      id: 'inquiries',
      label: 'Inquiries & Registry',
      badge: metrics.openInquiries > 0 ? metrics.openInquiries : undefined,
      icon: <MessageSquare className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-[85vh] bg-[#050508] text-[#f5f3ef]">
      <SEOHead
        title="Admin Dashboard"
        description="NORVA Store Administration — Orders, Fragrance Inventory, and Client Inquiries."
      />

      <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row min-h-[85vh]">
        {/* Left Workspace Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 bg-[#08080c] border-b lg:border-b-0 lg:border-r border-white/[0.08] p-3.5 sm:p-5 flex flex-col justify-between gap-4 sm:gap-6">
          <div className="space-y-4 sm:space-y-6">
            <div className="px-1 sm:px-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#d6be96]">
                Admin Workspace
              </p>
              <p className="font-serif-display text-2xl text-white mt-0.5">NORVA Console</p>
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
                        className={`font-mono-tabular text-[11px] px-1.5 py-0.5 rounded ${
                          active ? 'bg-[#050507] text-white' : 'bg-[#d6be96]/20 text-[#d6be96]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="hidden lg:flex flex-col gap-2 pt-5 border-t border-white/[0.08]">
            <div className="px-2 pb-2">
              <p className="text-[11px] text-white/40">Signed in as</p>
              <p className="text-xs font-medium text-white truncate" title={adminSession.email}>
                {adminSession.email}
              </p>
            </div>

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
          <div className="h-14 px-4 sm:px-6 border-b border-white/[0.08] flex items-center justify-between gap-3 sm:gap-4 bg-[#07070b]">
            <div className="flex items-center gap-2 text-xs text-white/50 min-w-0">
              <span className="shrink-0">NORVA Admin</span>
              <span className="shrink-0">/</span>
              <span className="text-white font-medium capitalize truncate">{activeTab}</span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden sm:inline text-xs text-white/45 font-mono-tabular">
                {adminSession.email}
              </span>
              <button
                type="button"
                onClick={logoutAdmin}
                className="lg:hidden min-h-[36px] px-3 py-1.5 rounded-lg bg-white/[0.06] text-xs text-red-300 cursor-pointer whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
            {/* ===============================================================
                TAB 1: OVERVIEW KPI GRID & RECENT ORDERS
               =============================================================== */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Single-elevation 4-KPI Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="p-5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-1.5">
                    <p className="text-xs text-white/50">Confirmed Revenue</p>
                    <p className="font-mono-tabular text-2xl font-semibold text-white">
                      {formatPKR(metrics.totalRevenue)}
                    </p>
                    <p className="text-[11px] text-white/40 font-mono-tabular">
                      {metrics.totalUnitsSold} flacons sold
                    </p>
                  </div>

                  <div className="p-5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-1.5">
                    <p className="text-xs text-white/50">Total Orders</p>
                    <p className="font-mono-tabular text-2xl font-semibold text-white">
                      {metrics.totalOrders}
                    </p>
                    <p className="text-[11px] text-[#d6be96] font-mono-tabular">
                      {metrics.pendingOrders} awaiting dispatch
                    </p>
                  </div>

                  <div className="p-5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-1.5">
                    <p className="text-xs text-white/50">Active Signature Catalog</p>
                    <p className="font-mono-tabular text-2xl font-semibold text-[#36d67e]">
                      {products.filter((p) => p.inStock).length} / {products.length}
                    </p>
                    <p className="text-[11px] text-white/40">In stock &amp; live on storefront</p>
                  </div>

                  <div className="p-5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-1.5">
                    <p className="text-xs text-white/50">Client Registry &amp; Inquiries</p>
                    <p className="font-mono-tabular text-2xl font-semibold text-white">
                      {subscribers.length + inquiries.length}
                    </p>
                    <p className="text-[11px] text-white/40 font-mono-tabular">
                      {metrics.openInquiries} open inquiries · {subscribers.length} subscribers
                    </p>
                  </div>
                </div>

                {/* Recent Orders Preview Table */}
                <div className="rounded-xl bg-[#0a0a0f] border border-white/[0.08] overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Recent Customer Orders</h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="text-xs text-[#d6be96] hover:underline cursor-pointer"
                    >
                      Manage All Orders →
                    </button>
                  </div>

                  {orders.length === 0 ? (
                    <div className="p-10 text-center space-y-2">
                      <p className="text-sm text-white/75">No orders placed yet</p>
                      <p className="text-xs text-white/45">
                        Place a test Cash on Delivery order from the storefront to see live order
                        tracking here.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.07] text-white/45">
                            <th className="py-3 px-5 font-medium">Order ID</th>
                            <th className="py-3 px-4 font-medium">Customer</th>
                            <th className="py-3 px-4 font-medium">City</th>
                            <th className="py-3 px-4 font-medium">Payment</th>
                            <th className="py-3 px-4 font-medium">Status</th>
                            <th className="py-3 px-5 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {orders.slice(0, 5).map((ord) => {
                            const st = ord.status ?? 'Pending';
                            return (
                              <tr key={ord.orderNumber} className="hover:bg-white/[0.02]">
                                <td className="py-3 px-5 font-mono-tabular font-medium text-[#d6be96]">
                                  {ord.orderNumber}
                                </td>
                                <td className="py-3 px-4 text-white">{ord.customer.fullName}</td>
                                <td className="py-3 px-4 text-white/65">{ord.customer.city}</td>
                                <td className="py-3 px-4 uppercase text-white/60">
                                  {ord.paymentMethod}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded border text-[11px] ${getStatusColor(
                                      st,
                                    )}`}
                                  >
                                    {st}
                                  </span>
                                </td>
                                <td className="py-3 px-5 text-right font-mono-tabular text-white">
                                  {formatPKR(ord.total)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Live Catalog Snapshot */}
                <div className="rounded-xl bg-[#0a0a0f] border border-white/[0.08] overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">
                      The 5 Signature Fragrances (Live Storefront Status)
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('products')}
                      className="text-xs text-[#d6be96] hover:underline cursor-pointer"
                    >
                      Edit Prices &amp; Stock →
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.07] text-white/45">
                          <th className="py-3 px-5 font-medium">Code</th>
                          <th className="py-3 px-4 font-medium">Fragrance</th>
                          <th className="py-3 px-4 font-medium">SKU</th>
                          <th className="py-3 px-4 font-medium text-right">Stock</th>
                          <th className="py-3 px-5 font-medium text-right">Live Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {products.map((p) => (
                          <tr key={p.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-5 font-mono-tabular text-white/50">
                              {p.numberCode}
                            </td>
                            <td className="py-3 px-4 font-medium text-white">{p.name}</td>
                            <td className="py-3 px-4 font-mono-tabular text-white/55">
                              {p.sizes[0].sku}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular">
                              <span className={p.inStock ? 'text-[#36d67e]' : 'text-red-400'}>
                                {p.inStock ? `${p.stockUnits} units` : 'Out of Stock'}
                              </span>
                            </td>
                            <td className="py-3 px-5 text-right font-mono-tabular text-white font-medium">
                              {formatPKR(p.sizes[0].price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 2: ORDERS MANAGEMENT
               =============================================================== */}
            {activeTab === 'orders' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Search by Order ID, customer name, phone, or city..."
                      className="w-full h-10 pl-10 pr-3.5 rounded-lg bg-[#0a0a0f] border border-white/12 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-[#d6be96]"
                    />
                  </div>

                  <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5 -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
                    {(['All', ...ORDER_STATUSES] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setOrderStatusFilter(st)}
                        className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          orderStatusFilter === st
                            ? 'bg-[#f2e6d5] text-[#050508]'
                            : 'bg-[#0a0a0f] text-white/60 border border-white/10 hover:text-white'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="p-10 sm:p-12 rounded-xl bg-[#0a0a0f] border border-white/[0.08] text-center space-y-2">
                    <Package className="w-7 h-7 text-[#d6be96] mx-auto" />
                    <p className="text-sm text-white">No matching orders found</p>
                    <p className="text-xs text-white/45">
                      New customer Cash on Delivery and bank invoice orders appear here immediately.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredOrders.map((ord) => {
                      const currentStatus = ord.status ?? 'Pending';
                      return (
                        <div
                          key={ord.orderNumber}
                          className="p-4 sm:p-6 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-white/[0.07]">
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <span className="font-mono-tabular text-sm font-semibold text-[#d6be96]">
                                  {ord.orderNumber}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded border text-[11px] ${getStatusColor(
                                    currentStatus,
                                  )}`}
                                >
                                  {currentStatus}
                                </span>
                                <span className="text-xs text-white/40">{ord.createdAt}</span>
                              </div>
                              <p className="text-xs text-white/75 break-words">
                                <strong>{ord.customer.fullName}</strong> · {ord.customer.phone} ·{' '}
                                {ord.customer.email}
                              </p>
                              <p className="text-xs text-white/50">
                                {ord.customer.address}, {ord.customer.city} ({ord.customer.country})
                              </p>
                            </div>

                            <div className="flex items-center gap-2.5 sm:gap-3">
                              <select
                                value={currentStatus}
                                onChange={(e) =>
                                  updateOrderStatus(ord.orderNumber, e.target.value as OrderStatus)
                                }
                                aria-label={`Update status for ${ord.orderNumber}`}
                                className="h-10 sm:h-9 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs text-white focus:outline-none focus:border-[#d6be96]"
                              >
                                {ORDER_STATUSES.map((st) => (
                                  <option key={st} value={st} className="bg-[#0a0a0f]">
                                    {st}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => deleteOrder(ord.orderNumber)}
                                aria-label={`Delete order ${ord.orderNumber}`}
                                className="h-10 sm:h-9 px-2.5 rounded-lg bg-white/[0.04] hover:bg-red-500/15 text-white/50 hover:text-red-400 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                            <div className="flex flex-wrap gap-3">
                              {ord.items.map((it) => (
                                <span
                                  key={it.key}
                                  className="text-white/75 bg-white/[0.04] px-2.5 py-1 rounded"
                                >
                                  {it.name} ({it.sizeLabel}) ×{' '}
                                  <strong className="font-mono-tabular">{it.quantity}</strong>
                                </span>
                              ))}
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-white/45 mr-2 uppercase">
                                {ord.paymentMethod}:
                              </span>
                              <span className="font-mono-tabular text-base font-semibold text-white">
                                {formatPKR(ord.total)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ===============================================================
                TAB 3: FRAGRANCES INVENTORY & LIVE PKR PRICING EDITOR
               =============================================================== */}
            {activeTab === 'products' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Manage Signature Fragrances (Live Storefront Sync)
                    </h2>
                    <p className="text-xs text-white/50 mt-0.5">
                      Changes to PKR price, stock status, or badges immediately update all NORVA
                      pages.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      resetProductOverrides();
                      setPriceInputs({});
                      setStockInputs({});
                    }}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs text-white cursor-pointer self-start"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All to PKR 2,500</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {products.map((prod) => {
                    const currentPriceVal =
                      priceInputs[prod.id] ?? String(prod.sizes[0].price);
                    const currentStockVal =
                      stockInputs[prod.id] ?? String(prod.stockUnits);

                    return (
                      <div
                        key={prod.id}
                        className="p-4 sm:p-5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-center"
                      >
                        <div className="lg:col-span-4 flex items-center gap-3.5 sm:gap-4 min-w-0">
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#050508] shrink-0 border border-white/10">
                            <LuxuryImage
                              src={prod.primaryImage}
                              alt={prod.name}
                              className="w-full h-full object-contain sm:object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-mono-tabular text-[#d6be96]">
                              Edition {prod.numberCode} · {prod.sizes[0].sku}
                            </p>
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
                        <div className="lg:col-span-3 space-y-1">
                          <label className="block text-[11px] text-white/45">
                            Price (PKR · 50ml)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={100}
                              step={50}
                              value={currentPriceVal}
                              onChange={(e) =>
                                setPriceInputs({ ...priceInputs, [prod.id]: e.target.value })
                              }
                              className="w-full h-10 sm:h-9 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const parsed = Number(currentPriceVal);
                                if (!Number.isNaN(parsed) && parsed > 0) {
                                  updateProductOverride(prod.id, { price: parsed });
                                }
                              }}
                              className="h-10 sm:h-9 px-3.5 sm:px-3 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold cursor-pointer shrink-0"
                            >
                              Save
                            </button>
                          </div>
                        </div>

                        {/* Stock Units */}
                        <div className="lg:col-span-2 space-y-1">
                          <label className="block text-[11px] text-white/45">Stock Units</label>
                          <div className="flex gap-1.5">
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
                              className="w-full h-10 sm:h-9 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                            />
                          </div>
                        </div>

                        {/* Availability & Curation Toggles */}
                        <div className="lg:col-span-3 flex flex-wrap items-center justify-start lg:justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateProductOverride(prod.id, { inStock: !prod.inStock })
                            }
                            className={`min-h-[36px] sm:h-8 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                              prod.inStock
                                ? 'bg-[#36d67e]/12 text-[#36d67e] border-[#36d67e]/35'
                                : 'bg-red-500/12 text-red-300 border-red-500/35'
                            }`}
                          >
                            {prod.inStock ? 'In Stock' : 'Out of Stock'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateProductOverride(prod.id, {
                                isBestSeller: !prod.isBestSeller,
                              })
                            }
                            className={`min-h-[36px] sm:h-8 px-3 rounded-lg text-xs border transition-colors cursor-pointer ${
                              prod.isBestSeller
                                ? 'bg-[#d6be96]/15 text-[#d6be96] border-[#d6be96]/40'
                                : 'bg-white/[0.03] text-white/45 border-white/10 hover:text-white'
                            }`}
                          >
                            Best Seller
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 4: CONCIERGE INQUIRIES, NEWSLETTER REGISTRY & REVIEWS
               =============================================================== */}
            {activeTab === 'inquiries' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Concierge Messages */}
                <div className="lg:col-span-7 space-y-4">
                  <h2 className="text-sm font-semibold text-white">
                    Concierge Inquiries ({inquiries.length})
                  </h2>

                  {inquiries.length === 0 ? (
                    <div className="p-10 rounded-xl bg-[#0a0a0f] border border-white/[0.08] text-center space-y-2">
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

                  {/* Custom Reviews Moderation */}
                  {flatCustomReviews.length > 0 && (
                    <div className="pt-4 space-y-3">
                      <h3 className="text-sm font-semibold text-white">
                        Recent Client Reviews ({flatCustomReviews.length})
                      </h3>
                      {flatCustomReviews.map((r) => (
                        <div
                          key={r.id}
                          className="p-4 rounded-xl bg-[#0a0a0f] border border-white/[0.08] flex items-start justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <p className="text-xs text-[#d6be96]">
                              {r.productName} · {r.rating}/5 ★
                            </p>
                            <p className="text-xs font-medium text-white">{r.title}</p>
                            <p className="text-xs text-white/60">{r.comment}</p>
                            <p className="text-[11px] text-white/40">By {r.author}</p>
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
                      ))}
                    </div>
                  )}
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
          </div>
        </div>
      </div>
    </div>
  );
};
