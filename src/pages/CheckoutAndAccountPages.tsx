import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Heart,
  Loader2,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react';
import { formatPKR } from '../data/products';
import { CouponConfig, OrderStatus, PlacedOrder, useStore } from '../context/StoreContext';
import { LuxuryImage, SEOHead } from '../components/LuxuryUI';
import {
  WhatsAppIcon,
  buildOrderConfirmationWhatsAppUrl,
} from '../components/WhatsAppFloatingButton';

function getBuyerStatusStyle(status: OrderStatus = 'Pending'): string {
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

function generateIdempotencyKey(): string {
  return `nv_idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ===========================================================================
// CHECKOUT PAGE (CITY SHIPPING, LIVE COUPON VALIDATION, WHATSAPP & ANTI-DUP)
// ===========================================================================
export const CheckoutPage: React.FC = () => {
  const {
    products,
    cart,
    cartSubtotal,
    shippingRates,
    calculateCityShipping,
    validateCoupon,
    updateCartQuantity,
    removeFromCart,
    profile,
    updateProfile,
    placeOrder,
    showToast,
  } = useStore();

  const [fullName, setFullName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [city, setCity] = useState(profile.city || 'Karachi');
  const [postalCode, setPostalCode] = useState(profile.postalCode);
  const [country, setCountry] = useState(profile.country || 'Pakistan');

  const [shippingSpeed, setShippingSpeed] = useState<'standard' | 'express'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'invoice'>('cod');
  const [giftNote, setGiftNote] = useState('');

  // Live Coupon State
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponConfig | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponSuccessMsg, setCouponSuccessMsg] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Order Submission & Anti-Duplicate Idempotency Key
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingLockRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<PlacedOrder | null>(null);

  const fullNameInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const cityInputRef = useRef<HTMLInputElement | null>(null);

  // Keep proxy auth token cache warm while customer fills out checkout form
  useEffect(() => {
    const ping = () => {
      fetch('/api/health', { credentials: 'include' }).catch(() => {});
    };
    ping();
    const timer = window.setInterval(ping, 45000);
    return () => window.clearInterval(timer);
  }, []);

  const submissionSignature = useMemo(
    () =>
      [
        cart
          .map((i) => `${i.key}:${i.quantity}`)
          .sort()
          .join('|'),
        phone.trim(),
        city.trim().toLowerCase(),
        paymentMethod,
        shippingSpeed,
        appliedCoupon?.code ?? '',
      ].join('::'),
    [cart, phone, city, paymentMethod, shippingSpeed, appliedCoupon],
  );
  const idempotencyRef = useRef<{ sig: string; key: string }>({
    sig: '',
    key: generateIdempotencyKey(),
  });
  if (idempotencyRef.current.sig !== submissionSignature) {
    idempotencyRef.current = {
      sig: submissionSignature,
      key: generateIdempotencyKey(),
    };
  }

  //Selectable active cities configured in backend
  const selectableCities = useMemo(
    () => shippingRates.filter((r) => r.active && r.cityKey !== '__default__'),
    [shippingRates],
  );

  // Live shipping calculation by city & speed
  const standardShippingPreview = useMemo(
    () => calculateCityShipping(city, 'standard', cartSubtotal),
    [calculateCityShipping, city, cartSubtotal],
  );
  const expressShippingPreview = useMemo(
    () => calculateCityShipping(city, 'express', cartSubtotal),
    [calculateCityShipping, city, cartSubtotal],
  );

  const activeShipping =
    shippingSpeed === 'express' ? expressShippingPreview : standardShippingPreview;
  const shippingCost = cart.length === 0 ? 0 : activeShipping.cost;
  const matchedRate = activeShipping.matchedRate;

  const remainingForFreeShipping = Math.max(
    0,
    matchedRate.freeShippingThreshold - cartSubtotal,
  );

  // Live coupon discount calculation (and auto-invalidation if cart drops below minimum)
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (cartSubtotal < appliedCoupon.minOrderAmount) return 0;
    if (appliedCoupon.discountType === 'percentage') {
      return Math.min(
        cartSubtotal,
        Math.round((cartSubtotal * appliedCoupon.discountValue) / 100),
      );
    }
    return Math.min(cartSubtotal, Math.round(appliedCoupon.discountValue));
  }, [appliedCoupon, cartSubtotal]);

  useEffect(() => {
    if (appliedCoupon && cartSubtotal > 0 && cartSubtotal < appliedCoupon.minOrderAmount) {
      setCouponError(
        `Code ${appliedCoupon.code} requires a minimum subtotal of ${formatPKR(
          appliedCoupon.minOrderAmount,
        )}.`,
      );
      setAppliedCoupon(null);
      setCouponSuccessMsg(null);
    }
  }, [appliedCoupon, cartSubtotal]);

  const finalTotal = Math.max(0, cartSubtotal - discountAmount + shippingCost);

  // Live stock check for items currently in bag
  const stockIssueMessage = useMemo(() => {
    for (const item of cart) {
      const catalogProd = products.find((p) => p.id === item.productId);
      if (!catalogProd) continue;
      if (!catalogProd.inStock || catalogProd.stockUnits <= 0) {
        return `${item.name} is currently out of stock. Please remove it from your bag to proceed.`;
      }
      if (item.quantity > catalogProd.stockUnits) {
        return `Only ${catalogProd.stockUnits} flacon(s) of ${item.name} remain in stock. Please reduce quantity.`;
      }
    }
    return null;
  }, [cart, products]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code || isValidatingCoupon) return;

    setIsValidatingCoupon(true);
    setCouponError(null);
    setCouponSuccessMsg(null);

    try {
      const res = await validateCoupon(code, cartSubtotal);
      if (res.ok && res.coupon) {
        setAppliedCoupon(res.coupon);
        setCouponInput(res.coupon.code);
        const saved = res.discountAmount ?? 0;
        const msg = `${res.coupon.code} applied — you save ${formatPKR(saved)}${
          res.coupon.description ? ` (${res.coupon.description})` : ''
        }`;
        setCouponSuccessMsg(msg);
        showToast(`Privilege ${res.coupon.code} applied`);
      } else {
        setAppliedCoupon(null);
        setCouponError(res.error ?? 'Invalid or expired discount code.');
      }
    } catch {
      setCouponError('Unable to verify coupon right now. Please try again.');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponSuccessMsg(null);
    setCouponError(null);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || isSubmitting || submittingLockRef.current) return;

    if (stockIssueMessage) {
      setSubmitError(stockIssueMessage);
      return;
    }

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();
    const cleanCity = city.trim();
    const phoneDigits = cleanPhone.replace(/\D+/g, '');

    if (cleanName.length < 2) {
      setSubmitError('Please enter the recipient’s full name.');
      fullNameInputRef.current?.focus();
      return;
    }
    if (cleanEmail && (!cleanEmail.includes('@') || cleanEmail.length < 5)) {
      setSubmitError('Please enter a valid email address (or leave it blank for COD).');
      emailInputRef.current?.focus();
      return;
    }
    if (phoneDigits.length < 7) {
      setSubmitError('Please enter a valid phone / WhatsApp number (e.g. 0300-1234567).');
      phoneInputRef.current?.focus();
      return;
    }
    if (cleanAddress.length < 4) {
      setSubmitError('Please enter your complete street and house delivery address.');
      addressInputRef.current?.focus();
      return;
    }
    if (cleanCity.length < 2) {
      setSubmitError('Please select or enter your delivery city.');
      cityInputRef.current?.focus();
      return;
    }

    const customerData = {
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      address: cleanAddress,
      city: cleanCity,
      postalCode: postalCode.trim(),
      country: country.trim() || 'Pakistan',
    };

    submittingLockRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    updateProfile(customerData);

    try {
      const created = await placeOrder({
        idempotencyKey: idempotencyRef.current.key,
        items: cart,
        subtotal: cartSubtotal,
        discountAmount,
        shippingCost,
        total: finalTotal,
        couponCode: appliedCoupon?.code ?? undefined,
        paymentMethod,
        shippingSpeed,
        customer: customerData,
        giftNote: giftNote.trim() || undefined,
      });

      setCompletedOrder(created);
      showToast(
        created.duplicatePrevented
          ? `Order ${created.orderNumber} already confirmed`
          : `Order ${created.orderNumber} confirmed!`,
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to submit order right now. Please retry.';
      setSubmitError(msg);
      showToast(msg);
    } finally {
      submittingLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // ORDER CONFIRMATION RECEIPT VIEW (WITH WHATSAPP CONFIRMATION & TRACKING)
  // =========================================================================
  if (completedOrder) {
    const whatsappConfirmUrl = buildOrderConfirmationWhatsAppUrl(completedOrder);

    return (
      <div className="bg-transparent text-[#f5f3ef] py-10 sm:py-20">
        <SEOHead
          title={`Order Confirmed ${completedOrder.orderNumber}`}
          description="Your NORVA order confirmation and WhatsApp dispatch receipt."
        />
        <div className="max-w-3xl mx-auto px-3.5 sm:px-8">
          <div className="p-5 sm:p-11 rounded-2xl bg-[#0a0a0f] border border-[#36d67e]/35 space-y-6 sm:space-y-8">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#36d67e]/15 border border-[#36d67e]/40 flex items-center justify-center text-[#36d67e]">
                <Check className="w-6 h-6" />
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#36d67e]">
                NORVA Order Confirmed
              </p>
              <h1 className="font-serif-display text-3xl sm:text-5xl text-white">
                Thank You, {completedOrder.customer.fullName}
              </h1>
              <p className="text-sm text-white/70 leading-relaxed">
                Your order{' '}
                <span className="font-mono-tabular text-[#d6be96] font-semibold">
                  {completedOrder.orderNumber}
                </span>{' '}
                has been securely recorded for dispatch in our obsidian presentation box.
              </p>

              {completedOrder.duplicatePrevented && (
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-400/30 text-xs text-sky-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                  <span>
                    Duplicate submission protection kept your existing order{' '}
                    <strong className="font-mono-tabular">{completedOrder.orderNumber}</strong> safe
                    without creating a duplicate charge.
                  </span>
                </div>
              )}
            </div>

            {/* Tracking Reference Callout + Instant WhatsApp Confirmation */}
            <div className="p-4 sm:p-5 rounded-xl bg-[#060f0a] border border-[#25D366]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-white">
                  Instant WhatsApp Order Confirmation
                </p>
                <p className="text-xs text-white/65 leading-relaxed">
                  Send your prefilled receipt for{' '}
                  <span className="font-mono-tabular text-[#36d67e] font-medium">
                    {completedOrder.orderNumber}
                  </span>{' '}
                  directly to our concierge desk for priority dispatch verification.
                </p>
              </div>
              <a
                href={whatsappConfirmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 px-5 rounded-xl bg-[#25D366] hover:bg-[#32e275] text-[#050508] text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors shrink-0"
              >
                <WhatsAppIcon className="w-4 h-4" />
                <span>Confirm on WhatsApp</span>
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 py-5 sm:py-6 border-y border-white/[0.08] text-xs">
              <div className="space-y-1.5">
                <p className="uppercase tracking-[0.15em] text-white/45">Delivery Destination</p>
                <p className="text-white font-medium">{completedOrder.customer.fullName}</p>
                <p className="font-mono-tabular text-white/75">{completedOrder.customer.phone}</p>
                <p className="text-white/65">{completedOrder.customer.address}</p>
                <p className="text-white/65">
                  {completedOrder.customer.city}
                  {completedOrder.customer.postalCode
                    ? `, ${completedOrder.customer.postalCode}`
                    : ''}
                </p>
                <p className="text-white/65">{completedOrder.customer.country}</p>
              </div>

              <div className="space-y-1.5">
                <p className="uppercase tracking-[0.15em] text-white/45">Payment &amp; Dispatch</p>
                <p className="text-white font-medium">
                  {completedOrder.paymentMethod === 'cod'
                    ? 'Cash on Delivery (COD)'
                    : 'Bank Transfer / IBFT Reservation Invoice'}
                </p>
                <p className="text-white/65">
                  Payment Status:{' '}
                  <span className="text-[#d6be96] font-medium">
                    {completedOrder.paymentStatus ?? 'Pending'}
                  </span>
                </p>
                <p className="text-white/65">
                  {completedOrder.shippingSpeed === 'express'
                    ? 'Priority Express Air Courier (1–2 Working Days)'
                    : 'Standard Insured Courier (2–4 Working Days)'}
                </p>
                <p className="text-white/50 pt-1">
                  Track anytime using Order{' '}
                  <strong className="font-mono-tabular text-white">
                    {completedOrder.orderNumber}
                  </strong>{' '}
                  + Phone{' '}
                  <strong className="font-mono-tabular text-white">
                    {completedOrder.customer.phone}
                  </strong>
                  .
                </p>
                {completedOrder.giftNote && (
                  <p className="text-[#d6be96] italic pt-1">
                    Gift note: “{completedOrder.giftNote}”
                  </p>
                )}
              </div>
            </div>

            {/* Itemized Receipt */}
            <div className="space-y-4">
              {completedOrder.items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 sm:gap-4 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#050508] shrink-0">
                      <LuxuryImage
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain sm:object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-serif-display text-lg text-white truncate">{item.name}</p>
                      <p className="text-xs text-white/50 font-mono-tabular">
                        {item.sizeLabel} × {item.quantity}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-tabular text-white shrink-0">
                    {formatPKR(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-white/[0.08] space-y-2 text-xs">
              <div className="flex justify-between text-white/60">
                <span>Subtotal</span>
                <span className="font-mono-tabular">{formatPKR(completedOrder.subtotal)}</span>
              </div>
              {completedOrder.discountAmount > 0 && (
                <div className="flex justify-between text-[#36d67e]">
                  <span>Privilege ({completedOrder.couponCode})</span>
                  <span className="font-mono-tabular">
                    -{formatPKR(completedOrder.discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-white/60">
                <span>Courier ({completedOrder.customer.city})</span>
                <span className="font-mono-tabular">
                  {completedOrder.shippingCost === 0
                    ? 'Complimentary'
                    : formatPKR(completedOrder.shippingCost)}
                </span>
              </div>
              <div className="flex justify-between text-base font-medium text-white pt-2 border-t border-white/[0.08]">
                <span>Total Payable</span>
                <span className="font-mono-tabular text-xl">
                  {formatPKR(completedOrder.total)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-2">
              <Link
                to={`/track-order?order=${encodeURIComponent(completedOrder.orderNumber)}`}
                className="h-11 px-6 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Truck className="w-4 h-4" />
                <span>Track Live Order Status</span>
              </Link>
              <Link
                to="/account"
                className="h-11 px-5 rounded-lg border border-white/15 hover:border-white/30 text-xs font-medium uppercase tracking-[0.14em] text-white inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>Order History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/shop"
                className="h-11 px-5 rounded-lg text-xs font-medium uppercase tracking-[0.14em] text-white/65 hover:text-white inline-flex items-center justify-center transition-colors"
              >
                Continue Exploring
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // EMPTY BAG VIEW
  // =========================================================================
  if (cart.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center space-y-5">
        <SEOHead title="Checkout" description="Complete your NORVA order." />
        <ShoppingBag className="w-10 h-10 text-[#d6be96]" />
        <h1 className="font-serif-display text-3xl sm:text-5xl text-white">
          Your Shopping Bag is Empty
        </h1>
        <p className="text-sm text-white/60 max-w-md">
          Explore NORVA’s five signature 50ml smoked-glass fragrances (PKR 2,500 each) before
          proceeding to checkout.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/shop"
            className="h-11 px-7 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-2 transition-colors"
          >
            <span>Explore Fragrances</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/track-order"
            className="h-11 px-6 rounded-lg border border-white/15 hover:border-[#d6be96]/50 text-xs font-medium uppercase tracking-[0.14em] text-white inline-flex items-center gap-2 transition-colors"
          >
            <Truck className="w-4 h-4 text-[#d6be96]" />
            <span>Track Existing Order</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent text-[#f5f3ef] py-8 sm:py-12 lg:py-16">
      <SEOHead title="Checkout" description="Complete your NORVA order." />

      <div className="max-w-[1380px] mx-auto px-3.5 sm:px-8 space-y-7 sm:space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
              NORVA Insured Dispatch
            </p>
            <h1 className="font-serif-display text-3xl sm:text-5xl text-white mt-1">Checkout</h1>
          </div>

          <Link
            to="/track-order"
            className="text-xs text-white/60 hover:text-[#d6be96] inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <Truck className="w-3.5 h-3.5 text-[#d6be96]" />
            <span>Already placed an order? Track Order →</span>
          </Link>
        </div>

        {/* Complimentary City Courier Progress Banner */}
        <div className="px-4 py-3 rounded-xl bg-[#0a0a0f] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-white/80">
            <Truck className="w-4 h-4 text-[#d6be96] shrink-0" />
            {remainingForFreeShipping === 0 ? (
              <span>
                <strong className="text-[#36d67e]">Complimentary Standard Courier</strong> unlocked
                for <strong>{city.trim() || matchedRate.cityName}</strong> (
                {matchedRate.estimatedDays}).
              </span>
            ) : (
              <span>
                Add{' '}
                <strong className="font-mono-tabular text-[#d6be96]">
                  {formatPKR(remainingForFreeShipping)}
                </strong>{' '}
                more to unlock complimentary standard courier for{' '}
                <strong>{city.trim() || matchedRate.cityName}</strong>.
              </span>
            )}
          </div>
          <span className="font-mono-tabular text-[11px] text-white/45">
            Free threshold: {formatPKR(matchedRate.freeShippingThreshold)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 sm:gap-10 items-start">
          {/* Left Form: Shipping, Courier & Settlement */}
          <form
            onSubmit={handlePlaceOrder}
            noValidate
            className="lg:col-span-7 space-y-6 sm:space-y-8"
          >
            {/* 1. Client & City Shipping Information */}
            <div className="p-4 sm:p-8 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-4 sm:space-y-5">
              <h2 className="font-serif-display text-xl sm:text-2xl text-white">
                1. Recipient &amp; Shipping City
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-white/60 mb-1.5">Full Name *</label>
                  <input
                    ref={fullNameInputRef}
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setSubmitError(null);
                    }}
                    placeholder="Zainab Ali"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1.5">
                    Email Address <span className="text-[10.5px] text-white/40">(Optional)</span>
                  </label>
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setSubmitError(null);
                    }}
                    placeholder="client@domain.com"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1.5">
                    Phone / WhatsApp *{' '}
                    <span className="text-[10.5px] text-white/40">(Used for Order Tracking)</span>
                  </label>
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setSubmitError(null);
                    }}
                    placeholder="0300-1234567"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-white/60 mb-1.5">Street Address *</label>
                  <input
                    ref={addressInputRef}
                    type="text"
                    required
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setSubmitError(null);
                    }}
                    placeholder="House 14, Street 8, DHA Phase 6"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>

                {/* Configurable City Selection + Custom City Input */}
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs text-white/60">Delivery City *</label>
                    <span className="text-[11px] text-[#d6be96] font-mono-tabular">
                      {matchedRate.cityName} · {matchedRate.estimatedDays}
                    </span>
                  </div>

                  {selectableCities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectableCities.map((rate) => {
                        const isSelected =
                          city.trim().toLowerCase() === rate.cityName.toLowerCase();
                        return (
                          <button
                            key={rate.cityKey}
                            type="button"
                            onClick={() => {
                              setCity(rate.cityName);
                              setSubmitError(null);
                            }}
                            className={`h-8 px-3 rounded-lg text-xs border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#f2e6d5] text-[#050508] border-[#f2e6d5] font-semibold'
                                : 'bg-[#050508] text-white/70 border-white/12 hover:text-white hover:border-white/25'
                            }`}
                          >
                            <span>{rate.cityName}</span>
                            <span
                              className={`ml-1.5 font-mono-tabular text-[10.5px] ${
                                isSelected ? 'text-[#050508]/75' : 'text-white/45'
                              }`}
                            >
                              {cartSubtotal >= rate.freeShippingThreshold
                                ? 'Free'
                                : `PKR ${rate.standardFee}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <input
                        ref={cityInputRef}
                        type="text"
                        required
                        value={city}
                        onChange={(e) => {
                          setCity(e.target.value);
                          setSubmitError(null);
                        }}
                        placeholder="Enter any city in Pakistan..."
                        className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="Postal Code (Optional, e.g. 75500)"
                        className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm font-mono-tabular text-white focus:outline-none focus:border-[#d6be96]"
                      />
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-white/60 mb-1.5">Country *</label>
                  <input
                    type="text"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>
              </div>
            </div>

            {/* 2. Courier Speed & Gift Note */}
            <div className="p-4 sm:p-8 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-4 sm:space-y-5">
              <h2 className="font-serif-display text-xl sm:text-2xl text-white">
                2. Courier Speed &amp; Gift Note
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <button
                  type="button"
                  onClick={() => setShippingSpeed('standard')}
                  className={`p-3.5 sm:p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    shippingSpeed === 'standard'
                      ? 'bg-[#12121b] border-[#d6be96]'
                      : 'bg-[#06060a] border-white/12'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white">
                    <span>Standard Insured Courier</span>
                    <span className="font-mono-tabular text-[#d6be96] shrink-0">
                      {standardShippingPreview.cost === 0
                        ? 'Complimentary'
                        : formatPKR(standardShippingPreview.cost)}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">
                    {matchedRate.estimatedDays} · {city.trim() || matchedRate.cityName}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setShippingSpeed('express')}
                  className={`p-3.5 sm:p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    shippingSpeed === 'express'
                      ? 'bg-[#12121b] border-[#d6be96]'
                      : 'bg-[#06060a] border-white/12'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white">
                    <span>Priority Overnight Air</span>
                    <span className="font-mono-tabular text-[#d6be96] shrink-0">
                      {formatPKR(expressShippingPreview.cost)}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">1–2 working days priority dispatch</p>
                </button>
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1.5">
                  Complimentary Gift Card Note (Optional)
                </label>
                <input
                  type="text"
                  value={giftNote}
                  onChange={(e) => setGiftNote(e.target.value)}
                  placeholder="Write an optional dedication..."
                  className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                />
              </div>
            </div>

            {/* 3. Honest Payment Method */}
            <div className="p-4 sm:p-8 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-4 sm:space-y-5">
              <h2 className="font-serif-display text-xl sm:text-2xl text-white">
                3. Payment Method
              </h2>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`w-full p-3.5 sm:p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    paymentMethod === 'cod'
                      ? 'bg-[#12121b] border-[#36d67e]'
                      : 'bg-[#06060a] border-white/12'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">
                      Cash on Delivery (COD)
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        paymentMethod === 'cod' ? 'border-[#36d67e]' : 'border-white/30'
                      }`}
                    >
                      {paymentMethod === 'cod' && (
                        <span className="w-2 h-2 rounded-full bg-[#36d67e]" />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-white/55 mt-1">
                    Pay in cash directly to our courier upon receiving your sealed NORVA parcel.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('invoice')}
                  className={`w-full p-3.5 sm:p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    paymentMethod === 'invoice'
                      ? 'bg-[#12121b] border-[#36d67e]'
                      : 'bg-[#06060a] border-white/12'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">
                      Bank Transfer / Online IBFT Invoice
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        paymentMethod === 'invoice' ? 'border-[#36d67e]' : 'border-white/30'
                      }`}
                    >
                      {paymentMethod === 'invoice' && (
                        <span className="w-2 h-2 rounded-full bg-[#36d67e]" />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-white/55 mt-1">
                    Reserves your order immediately; official bank transfer details are confirmed
                    via email &amp; WhatsApp.
                  </p>
                </button>
              </div>

              {(stockIssueMessage || submitError) && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/35 text-xs text-red-200 flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{stockIssueMessage ?? submitError}</span>
                </div>
              )}

              {isSubmitting && (
                <div className="p-3.5 rounded-xl bg-[#d6be96]/10 border border-[#d6be96]/30 text-xs text-[#f2e6d5] flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-[#d6be96] shrink-0" />
                  <span>
                    Verifying live flacon inventory, applying city courier rate, and securing your
                    unique NORVA order number...
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || Boolean(stockIssueMessage)}
                className="w-full min-h-[48px] py-3.5 px-4 sm:px-6 rounded-xl bg-[#f2e6d5] hover:bg-[#d6be96] disabled:opacity-55 text-[#050508] text-[11.5px] sm:text-xs font-semibold uppercase tracking-[0.11em] sm:tracking-[0.16em] transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Securing Your Order...</span>
                  </>
                ) : (
                  <span>Confirm Order · {formatPKR(finalTotal)}</span>
                )}
              </button>
            </div>
          </form>

          {/* Right Sticky Order Summary & Live Backend Privilege Coupon */}
          <aside className="lg:col-span-5 lg:sticky lg:top-24 p-4 sm:p-8 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-5 sm:space-y-6">
            <h2 className="font-serif-display text-xl sm:text-2xl text-white">Order Summary</h2>

            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              {cart.map((item) => {
                const catalogProd = products.find((p) => p.id === item.productId);
                const maxAvail = catalogProd?.stockUnits ?? 99;
                return (
                  <div
                    key={item.key}
                    className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.06]"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-[#050508] shrink-0">
                        <LuxuryImage
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-contain sm:object-cover"
                        />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <Link
                          to={`/product/${item.slug}`}
                          className="font-serif-display text-lg text-white hover:text-[#d6be96] block truncate"
                        >
                          {item.name}
                        </Link>
                        <p className="text-xs text-white/50">
                          {item.sizeLabel}
                          {catalogProd?.isLowStock && (
                            <span className="ml-2 text-amber-300 font-mono-tabular">
                              · Only {catalogProd.stockUnits} left
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-1.5 sm:gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.key, item.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="w-8 h-8 sm:w-6 sm:h-6 rounded bg-white/[0.06] flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono-tabular text-xs text-white w-5 text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= maxAvail}
                            onClick={() => updateCartQuantity(item.key, item.quantity + 1)}
                            aria-label="Increase quantity"
                            className="w-8 h-8 sm:w-6 sm:h-6 rounded bg-white/[0.06] disabled:opacity-35 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.key)}
                            aria-label="Remove item"
                            className="ml-1 sm:ml-2 w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center text-white/40 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <span className="font-mono-tabular text-sm text-white shrink-0">
                      {formatPKR(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Live Discount Coupon Form */}
            <form onSubmit={handleApplyCoupon} className="space-y-2.5">
              <label className="flex items-center justify-between text-xs text-white/60">
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#d6be96]" />
                  <span>Discount / Privilege Code</span>
                </span>
                <span className="font-mono-tabular text-[11px] text-white/40">e.g. NORVA15</span>
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value);
                    setCouponError(null);
                  }}
                  placeholder="Enter code..."
                  disabled={isValidatingCoupon}
                  className="flex-1 min-w-0 h-11 sm:h-10 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular uppercase text-white focus:outline-none focus:border-[#d6be96]"
                />
                {appliedCoupon ? (
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="h-11 sm:h-10 px-3.5 rounded-lg bg-white/[0.08] hover:bg-red-500/20 text-xs font-medium text-white/80 hover:text-red-300 cursor-pointer shrink-0 inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isValidatingCoupon || !couponInput.trim()}
                    className="h-11 sm:h-10 px-4 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-50 text-xs font-medium text-white cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                  >
                    {isValidatingCoupon ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Checking</span>
                      </>
                    ) : (
                      <span>Apply</span>
                    )}
                  </button>
                )}
              </div>

              {couponError && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                  <span>{couponError}</span>
                </div>
              )}

              {appliedCoupon && couponSuccessMsg && (
                <div className="p-2.5 rounded-lg bg-[#36d67e]/10 border border-[#36d67e]/30 text-xs text-[#36d67e] flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{couponSuccessMsg}</span>
                </div>
              )}
            </form>

            {/* Totals Breakdown */}
            <div className="pt-4 border-t border-white/[0.08] space-y-2.5 text-xs">
              <div className="flex justify-between text-white/65">
                <span>Subtotal</span>
                <span className="font-mono-tabular">{formatPKR(cartSubtotal)}</span>
              </div>
              {discountAmount > 0 && appliedCoupon && (
                <div className="flex justify-between text-[#36d67e]">
                  <span>Discount ({appliedCoupon.code})</span>
                  <span className="font-mono-tabular">-{formatPKR(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-white/65">
                <span>
                  Courier ({city.trim() || matchedRate.cityName} ·{' '}
                  {shippingSpeed === 'express' ? 'Express' : 'Standard'})
                </span>
                <span className="font-mono-tabular">
                  {shippingCost === 0 ? 'Complimentary' : formatPKR(shippingCost)}
                </span>
              </div>
              <div className="pt-3 border-t border-white/[0.08] flex justify-between items-baseline">
                <span className="text-sm font-medium text-white">Total Payable</span>
                <span className="font-mono-tabular text-2xl font-semibold text-white">
                  {formatPKR(finalTotal)}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// CUSTOMER ORDER TRACKING PAGE (ORDER NUMBER + PHONE VERIFICATION)
// ===========================================================================
const TRACKING_STEPS: { status: OrderStatus; label: string; subtitle: string }[] = [
  { status: 'Pending', label: 'Order Placed', subtitle: 'Recorded in NORVA Atelier' },
  { status: 'Confirmed', label: 'Confirmed', subtitle: 'Verified for fulfillment' },
  { status: 'Processing', label: 'Bottling & Packing', subtitle: 'Obsidian box preparation' },
  { status: 'Shipped', label: 'Dispatched', subtitle: 'Handed to insured courier' },
  { status: 'Delivered', label: 'Delivered', subtitle: 'Received at destination' },
];

export const TrackOrderPage: React.FC = () => {
  const { trackOrder } = useStore();
  const [searchParams] = useSearchParams();

  const [orderNumberInput, setOrderNumberInput] = useState(
    () => searchParams.get('order') ?? '',
  );
  const [phoneInput, setPhoneInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<PlacedOrder | null>(null);

  useEffect(() => {
    const paramOrder = searchParams.get('order');
    if (paramOrder) {
      setOrderNumberInput(paramOrder);
    }
  }, [searchParams]);

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSearching) return;

    const cleanOrder = orderNumberInput.trim().toUpperCase();
    const cleanPhone = phoneInput.trim();
    if (!cleanOrder || !cleanPhone) {
      setErrorMsg('Please enter both your Order Number and the Phone Number used at checkout.');
      return;
    }

    setIsSearching(true);
    setErrorMsg(null);

    try {
      const res = await trackOrder(cleanOrder, cleanPhone);
      if (res.ok && res.order) {
        setTrackedOrder(res.order);
        setErrorMsg(null);
      } else {
        setTrackedOrder(null);
        setErrorMsg(
          res.error ??
            'No matching order found. Please check your Order Number (e.g. NV-12345) and Phone Number.',
        );
      }
    } catch {
      setTrackedOrder(null);
      setErrorMsg('Unable to reach the tracking service right now. Please retry in a moment.');
    } finally {
      setIsSearching(false);
    }
  };

  const activeStageIndex = useMemo(() => {
    if (!trackedOrder) return -1;
    const st = trackedOrder.status ?? 'Pending';
    if (st === 'Cancelled') return -2;
    return TRACKING_STEPS.findIndex((s) => s.status === st);
  }, [trackedOrder]);

  return (
    <div className="bg-transparent text-[#f5f3ef] min-h-[80vh] py-10 sm:py-16 lg:py-20">
      <SEOHead
        title="Track Your Order"
        description="Track your NORVA Haute Parfumerie order status using your unique order number and phone verification."
      />

      <div className="max-w-3xl mx-auto px-3.5 sm:px-8 space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.22em] text-[#d6be96]">
            NORVA Dispatch Verification
          </p>
          <h1 className="font-serif-display text-3xl sm:text-5xl text-white">
            Track Your Order
          </h1>
          <p className="text-xs sm:text-sm text-white/60 max-w-lg mx-auto">
            Enter your unique NORVA order number and the phone number provided during checkout to
            view live fulfillment status.
          </p>
        </div>

        {/* Verification Form */}
        <form
          onSubmit={handleTrackSubmit}
          className="p-5 sm:p-8 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/65 mb-1.5" htmlFor="track-order-num">
                Order Number *
              </label>
              <div className="relative">
                <Package className="w-4 h-4 text-[#d6be96] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="track-order-num"
                  type="text"
                  required
                  value={orderNumberInput}
                  onChange={(e) => {
                    setOrderNumberInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="NV-12345"
                  className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm font-mono-tabular uppercase text-white placeholder:text-white/30 focus:outline-none focus:border-[#d6be96]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/65 mb-1.5" htmlFor="track-order-phone">
                Checkout Phone Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#d6be96] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="track-order-phone"
                  type="tel"
                  required
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="0300-1234567"
                  className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm font-mono-tabular text-white placeholder:text-white/30 focus:outline-none focus:border-[#d6be96]"
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSearching}
            className="w-full h-11 rounded-xl bg-[#f2e6d5] hover:bg-[#d6be96] disabled:opacity-60 text-[#050508] text-xs font-semibold uppercase tracking-[0.15em] transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Order...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Verify &amp; Track Order</span>
              </>
            )}
          </button>
        </form>

        {/* Verified Order Result */}
        {trackedOrder && (
          <div className="p-5 sm:p-8 rounded-2xl bg-[#0a0a0f] border border-[#d6be96]/35 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-white/[0.08]">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-tabular text-xl sm:text-2xl font-semibold text-white">
                    {trackedOrder.orderNumber}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded border text-xs font-medium ${getBuyerStatusStyle(
                      trackedOrder.status ?? 'Pending',
                    )}`}
                  >
                    {trackedOrder.status ?? 'Pending'}
                  </span>
                </div>
                <p className="text-xs text-white/50 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-white/40" />
                  <span>Placed on {trackedOrder.createdAt}</span>
                </p>
              </div>

              <a
                href={buildOrderConfirmationWhatsAppUrl(trackedOrder)}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-4 rounded-xl bg-[#25D366] hover:bg-[#32e275] text-[#050508] text-xs font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <WhatsAppIcon className="w-4 h-4" />
                <span>WhatsApp Support</span>
              </a>
            </div>

            {/* Fulfillment Timeline */}
            {trackedOrder.status === 'Cancelled' ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200">
                This order has been marked as <strong>Cancelled</strong>. If you need assistance or
                wish to place a new reservation, please message our concierge on WhatsApp.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                {TRACKING_STEPS.map((step, index) => {
                  const completed = index <= activeStageIndex;
                  const isCurrent = index === activeStageIndex;
                  return (
                    <div
                      key={step.status}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        isCurrent
                          ? 'bg-[#13121c] border-[#d6be96]'
                          : completed
                            ? 'bg-[#09140e] border-[#36d67e]/35'
                            : 'bg-[#050508] border-white/[0.07] opacity-55'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono-tabular text-[11px] text-white/50">
                          0{index + 1}
                        </span>
                        {completed && (
                          <Check
                            className={`w-3.5 h-3.5 ${
                              isCurrent ? 'text-[#d6be96]' : 'text-[#36d67e]'
                            }`}
                          />
                        )}
                      </div>
                      <p className="text-xs font-semibold text-white">{step.label}</p>
                      <p className="text-[11px] text-white/50 mt-0.5 leading-snug">
                        {step.subtitle}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Destination & Payment Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
              <div className="p-4 rounded-xl bg-[#050508] border border-white/[0.07] space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.15em] text-[#d6be96] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Delivery Destination</span>
                </p>
                <p className="text-white font-medium">{trackedOrder.customer.fullName}</p>
                <p className="text-white/70">{trackedOrder.customer.address}</p>
                <p className="text-white/70">
                  {trackedOrder.customer.city}
                  {trackedOrder.customer.postalCode ? `, ${trackedOrder.customer.postalCode}` : ''},{' '}
                  {trackedOrder.customer.country}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#050508] border border-white/[0.07] space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.15em] text-[#d6be96] flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Settlement &amp; Courier</span>
                </p>
                <p className="text-white font-medium">
                  {trackedOrder.paymentMethod === 'cod'
                    ? 'Cash on Delivery (COD)'
                    : 'Bank Transfer / IBFT Invoice'}
                </p>
                <p className="text-white/70">
                  Payment Status:{' '}
                  <strong className="text-white">{trackedOrder.paymentStatus ?? 'Pending'}</strong>
                </p>
                <p className="text-white/70">
                  Courier:{' '}
                  {trackedOrder.shippingSpeed === 'express'
                    ? 'Priority Express Air'
                    : 'Standard Insured Courier'}
                </p>
              </div>
            </div>

            {/* Ordered Fragrances */}
            <div className="space-y-3 pt-2 border-t border-white/[0.08]">
              <p className="text-xs font-medium text-white/70">Ordered Fragrances</p>
              {trackedOrder.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-[#050508] border border-white/10 shrink-0">
                      <LuxuryImage
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/product/${item.slug}`}
                        className="font-serif-display text-base sm:text-lg text-white hover:text-[#d6be96] block truncate"
                      >
                        {item.name}
                      </Link>
                      <p className="text-white/50 font-mono-tabular">
                        {item.sizeLabel} × {item.quantity}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-tabular text-white shrink-0">
                    {formatPKR(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}

              <div className="pt-3 border-t border-white/[0.08] space-y-1.5 text-xs">
                <div className="flex justify-between text-white/60">
                  <span>Subtotal</span>
                  <span className="font-mono-tabular">{formatPKR(trackedOrder.subtotal)}</span>
                </div>
                {trackedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-[#36d67e]">
                    <span>Discount ({trackedOrder.couponCode})</span>
                    <span className="font-mono-tabular">
                      -{formatPKR(trackedOrder.discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-white/60">
                  <span>Shipping</span>
                  <span className="font-mono-tabular">
                    {trackedOrder.shippingCost === 0
                      ? 'Complimentary'
                      : formatPKR(trackedOrder.shippingCost)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-white pt-1.5 border-t border-white/[0.07]">
                  <span>Total</span>
                  <span className="font-mono-tabular text-lg text-[#d6be96]">
                    {formatPKR(trackedOrder.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ===========================================================================
// CUSTOMER ACCOUNT PAGE (PROFILE, ORDER HISTORY & WISHLIST)
// ===========================================================================
export const AccountPage: React.FC = () => {
  const {
    products,
    profile,
    updateProfile,
    orders,
    refreshBuyerOrders,
    wishlist,
    toggleWishlist,
    addToCart,
    showToast,
  } = useStore();

  const [tab, setTab] = useState<'wishlist' | 'orders' | 'profile'>('wishlist');
  const [formState, setFormState] = useState(profile);

  useEffect(() => {
    if (tab === 'orders') {
      refreshBuyerOrders();
    }
  }, [tab, refreshBuyerOrders]);

  const wishedProducts = useMemo(
    () => products.filter((p) => wishlist.includes(p.id)),
    [products, wishlist],
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formState);
    showToast('Client profile preferences saved.');
  };

  return (
    <div className="bg-transparent text-[#f5f3ef] min-h-[80vh] py-8 sm:py-14 lg:py-20">
      <SEOHead
        title="Client Account, Orders & Wishlist"
        description="Manage your NORVA saved fragrances, order archive, and delivery preferences."
      />

      <div className="max-w-[1380px] mx-auto px-3.5 sm:px-8 space-y-7 sm:space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6 pb-6 sm:pb-8 border-b border-white/[0.08]">
          <div className="space-y-1.5 sm:space-y-2">
            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
              NORVA Client Suite
            </p>
            <h1 className="font-serif-display text-3xl sm:text-5xl text-white">
              {profile.fullName ? `Welcome, ${profile.fullName}` : 'Your NORVA Account'}
            </h1>
          </div>

          <div className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex p-1 rounded-xl bg-[#0a0a0f] border border-white/10 self-start">
            <button
              type="button"
              onClick={() => setTab('wishlist')}
              className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 min-h-[42px] sm:min-h-0 px-2 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'wishlist'
                  ? 'bg-[#f2e6d5] text-[#050508]'
                  : 'text-white/65 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5 shrink-0" />
              <span>Wishlist ({wishedProducts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('orders')}
              className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 min-h-[42px] sm:min-h-0 px-2 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'orders'
                  ? 'bg-[#f2e6d5] text-[#050508]'
                  : 'text-white/65 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span>Orders ({orders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('profile')}
              className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 min-h-[42px] sm:min-h-0 px-2 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'profile'
                  ? 'bg-[#f2e6d5] text-[#050508]'
                  : 'text-white/65 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>Profile</span>
            </button>
          </div>
        </div>

        {/* TAB 1: WISHLIST */}
        {tab === 'wishlist' && (
          <div className="space-y-6">
            {wishedProducts.length === 0 ? (
              <div className="p-7 sm:p-14 rounded-2xl bg-[#0a0a0f] border border-white/[0.07] text-center space-y-4">
                <Heart className="w-8 h-8 text-[#d6be96] mx-auto" />
                <h2 className="font-serif-display text-2xl sm:text-3xl text-white">
                  Your Olfactory Wardrobe is Empty
                </h2>
                <p className="text-sm text-white/55 max-w-md mx-auto">
                  Tap the heart icon on any of our five signature 50ml flacons to save it to your
                  persistent wishlist.
                </p>
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-[#f2e6d5] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em]"
                >
                  <span>Discover Fragrances</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-7">
                {wishedProducts.map((product) => {
                  const sz = product.sizes[0];
                  return (
                    <div
                      key={product.id}
                      className="rounded-xl bg-[#0a0a0f] border border-white/[0.08] overflow-hidden flex flex-col justify-between"
                    >
                      <Link
                        to={`/product/${product.slug}`}
                        className="aspect-[4/3] block bg-[#050508]"
                      >
                        <LuxuryImage
                          src={product.primaryImage}
                          alt={product.name}
                          className="w-full h-full object-contain lg:object-cover p-2 lg:p-0"
                        />
                      </Link>
                      <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4">
                        <div>
                          <p className="text-xs text-white/45 truncate">
                            {product.concentration} · {product.family}
                          </p>
                          <Link
                            to={`/product/${product.slug}`}
                            className="font-serif-display text-xl sm:text-2xl text-white hover:text-[#d6be96] block truncate"
                          >
                            {product.name}
                          </Link>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p className="font-mono-tabular text-sm text-[#d6be96]">
                              {formatPKR(sz.price)} / {sz.label}
                            </p>
                            {!product.inStock ? (
                              <span className="text-[11px] text-red-300">Out of Stock</span>
                            ) : product.isLowStock ? (
                              <span className="text-[11px] text-amber-300 font-mono-tabular">
                                Only {product.stockUnits} left
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!product.inStock}
                            onClick={() => addToCart(product, 0, 1, true)}
                            className="flex-1 h-10 px-3 sm:px-4 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] disabled:opacity-45 text-[#050508] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                            <span>{product.inStock ? 'Move to Bag' : 'Sold Out'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleWishlist(product.id)}
                            aria-label="Remove from wishlist"
                            className="h-10 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] text-white/70 hover:text-white text-xs cursor-pointer shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ORDER HISTORY */}
        {tab === 'orders' && (
          <div className="space-y-4 sm:space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-white/55">
                Looking for an order placed on another device? Verify by Order ID &amp; Phone.
              </p>
              <Link
                to="/track-order"
                className="h-9 px-4 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs text-[#d6be96] inline-flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Track Any Order</span>
              </Link>
            </div>

            {orders.length === 0 ? (
              <div className="p-7 sm:p-14 rounded-2xl bg-[#0a0a0f] border border-white/[0.07] text-center space-y-4">
                <Package className="w-8 h-8 text-[#d6be96] mx-auto" />
                <h2 className="font-serif-display text-2xl sm:text-3xl text-white">
                  No Past Orders Yet
                </h2>
                <p className="text-sm text-white/55 max-w-md mx-auto">
                  Completed NORVA orders placed from this browser will appear here automatically
                  with live dispatch updates.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    to="/shop"
                    className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-[#f2e6d5] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em]"
                  >
                    <span>Browse Fragrances</span>
                  </Link>
                  <Link
                    to="/track-order"
                    className="inline-flex items-center gap-2 h-11 px-6 rounded-lg border border-white/15 text-white text-xs font-medium uppercase tracking-[0.14em]"
                  >
                    <span>Lookup by Order #</span>
                  </Link>
                </div>
              </div>
            ) : (
              orders.map((ord) => {
                const status = ord.status ?? 'Pending';
                return (
                  <div
                    key={ord.orderNumber}
                    className="p-4 sm:p-8 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-4 sm:space-y-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-white/[0.07]">
                      <div>
                        <span className="font-mono-tabular text-sm font-semibold text-[#d6be96]">
                          {ord.orderNumber}
                        </span>
                        <p className="text-xs text-white/45 mt-0.5">{ord.createdAt}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="font-mono-tabular text-lg font-semibold text-white block">
                          {formatPKR(ord.total)}
                        </span>
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={`px-2 py-0.5 rounded border text-[11px] font-medium ${getBuyerStatusStyle(
                              status,
                            )}`}
                          >
                            {status}
                          </span>
                          <span className="text-[11px] text-white/50">
                            Payment: {ord.paymentStatus ?? 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                      {ord.items.map((it) => (
                        <div key={it.key} className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#050508] shrink-0">
                            <LuxuryImage
                              src={it.image}
                              alt={it.name}
                              className="w-full h-full object-contain sm:object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/product/${it.slug}`}
                              className="font-serif-display text-lg text-white hover:text-[#d6be96] block truncate"
                            >
                              {it.name}
                            </Link>
                            <p className="text-xs text-white/50 font-mono-tabular">
                              {it.sizeLabel} × {it.quantity} ·{' '}
                              {formatPKR(it.unitPrice * it.quantity)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-end gap-2.5">
                      <Link
                        to={`/track-order?order=${encodeURIComponent(ord.orderNumber)}`}
                        className="h-9 px-3.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs text-white inline-flex items-center gap-1.5"
                      >
                        <Truck className="w-3.5 h-3.5 text-[#d6be96]" />
                        <span>Track Status</span>
                      </Link>
                      <a
                        href={buildOrderConfirmationWhatsAppUrl(ord)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 px-3.5 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/35 text-xs text-[#36d67e] font-medium inline-flex items-center gap-1.5"
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5" />
                        <span>Confirm on WhatsApp</span>
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: SAVED CLIENT PROFILE */}
        {tab === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="max-w-2xl p-5 sm:p-10 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-5"
          >
            <h2 className="font-serif-display text-2xl sm:text-3xl text-white">
              Saved Dispatch Coordinates
            </h2>
            <p className="text-xs text-white/55">
              Stored locally in your browser for effortless one-step checkout.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs text-white/60 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={formState.fullName}
                  onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                />
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1.5">Email</label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                />
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1.5">Phone / WhatsApp</label>
                <input
                  type="tel"
                  value={formState.phone}
                  onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-white/60 mb-1.5">Street Address</label>
                <input
                  type="text"
                  value={formState.address}
                  onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                />
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1.5">City</label>
                <input
                  type="text"
                  value={formState.city}
                  onChange={(e) => setFormState({ ...formState, city: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                />
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1.5">Postal Code</label>
                <input
                  type="text"
                  value={formState.postalCode}
                  onChange={(e) => setFormState({ ...formState, postalCode: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto h-11 px-7 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer"
            >
              Save Preferences
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
