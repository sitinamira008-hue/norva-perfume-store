import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Heart,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  User,
} from 'lucide-react';
import { formatPKR } from '../data/products';
import { PlacedOrder, useStore } from '../context/StoreContext';
import { LuxuryImage, SEOHead } from '../components/LuxuryUI';

const VALID_COUPONS: Record<string, { pct: number; label: string }> = {
  NORVA15: { pct: 0.15, label: '15% NORVA Client Privilege' },
  NORVA10: { pct: 0.1, label: '10% Welcome Privilege' },
  ATELIER15: { pct: 0.15, label: '15% Atelier Privilege' },
};

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    cartSubtotal,
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
  const [city, setCity] = useState(profile.city);
  const [postalCode, setPostalCode] = useState(profile.postalCode);
  const [country, setCountry] = useState(profile.country || 'Pakistan');

  const [shippingSpeed, setShippingSpeed] = useState<'standard' | 'express'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'invoice'>('cod');
  const [giftNote, setGiftNote] = useState('');

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [completedOrder, setCompletedOrder] = useState<PlacedOrder | null>(null);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon || !VALID_COUPONS[appliedCoupon]) return 0;
    return Math.round(cartSubtotal * VALID_COUPONS[appliedCoupon].pct);
  }, [appliedCoupon, cartSubtotal]);

  const shippingCost = useMemo(() => {
    if (cart.length === 0) return 0;
    if (shippingSpeed === 'express') return 500;
    return cartSubtotal >= 5000 ? 0 : 250;
  }, [cart.length, cartSubtotal, shippingSpeed]);

  const finalTotal = Math.max(0, cartSubtotal - discountAmount + shippingCost);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (VALID_COUPONS[code]) {
      setAppliedCoupon(code);
      setCouponError(null);
      showToast(`Code ${code} applied (${VALID_COUPONS[code].label})`);
    } else {
      setCouponError('Unrecognized code. Try NORVA15 or NORVA10.');
    }
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const customerData = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      postalCode: postalCode.trim(),
      country: country.trim(),
    };

    updateProfile(customerData);

    const created = placeOrder({
      items: cart,
      subtotal: cartSubtotal,
      discountAmount,
      shippingCost,
      total: finalTotal,
      couponCode: appliedCoupon ?? undefined,
      paymentMethod,
      shippingSpeed,
      customer: customerData,
      giftNote: giftNote.trim() || undefined,
    });

    setCompletedOrder(created);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // ORDER CONFIRMATION RECEIPT VIEW
  // =========================================================================
  if (completedOrder) {
    return (
      <div className="bg-transparent text-[#f5f3ef] py-16 sm:py-24">
        <SEOHead
          title={`Order Confirmed ${completedOrder.orderNumber}`}
          description="Your NORVA order confirmation."
        />
        <div className="max-w-3xl mx-auto px-4 sm:px-8">
          <div className="p-8 sm:p-12 rounded-2xl bg-[#0a0a0f] border border-[#36d67e]/35 space-y-8">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#36d67e]/15 border border-[#36d67e]/40 flex items-center justify-center text-[#36d67e]">
                <Check className="w-6 h-6" />
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#36d67e]">
                NORVA Order Confirmed
              </p>
              <h1 className="font-serif-display text-4xl sm:text-5xl text-white">
                Thank You, {completedOrder.customer.fullName}
              </h1>
              <p className="text-sm text-white/65 leading-relaxed">
                Your order{' '}
                <span className="font-mono-tabular text-white font-semibold">
                  {completedOrder.orderNumber}
                </span>{' '}
                has been registered for dispatch in our obsidian presentation box.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-y border-white/[0.08] text-xs">
              <div className="space-y-1.5">
                <p className="uppercase tracking-[0.15em] text-white/45">Delivery Destination</p>
                <p className="text-white font-medium">{completedOrder.customer.fullName}</p>
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
                    : 'Bank Transfer / Boutique Reservation Invoice'}
                </p>
                <p className="text-white/65">
                  {completedOrder.shippingSpeed === 'express'
                    ? 'Express Air Courier (1–2 Working Days)'
                    : 'Standard Insured Courier (2–4 Working Days)'}
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
                <div key={item.key} className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#050508] shrink-0">
                      <LuxuryImage
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-serif-display text-lg text-white">{item.name}</p>
                      <p className="text-xs text-white/50">
                        {item.sizeLabel} × {item.quantity}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-tabular text-white">
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
                <span>Courier</span>
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

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/account"
                className="h-11 px-6 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-2 transition-colors"
              >
                <span>View Order in Account</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/shop"
                className="h-11 px-6 rounded-lg border border-white/15 text-xs font-medium uppercase tracking-[0.14em] text-white inline-flex items-center"
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
        <h1 className="font-serif-display text-4xl sm:text-5xl text-white">
          Your Shopping Bag is Empty
        </h1>
        <p className="text-sm text-white/60 max-w-md">
          Explore NORVA’s five signature smoked-glass fragrances (PKR 2,500 each) before proceeding
          to checkout.
        </p>
        <Link
          to="/shop"
          className="h-11 px-7 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-2 transition-colors"
        >
          <span>Explore Fragrances</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-transparent text-[#f5f3ef] py-12 lg:py-16">
      <SEOHead title="Checkout" description="Complete your NORVA order." />

      <div className="max-w-[1380px] mx-auto px-4 sm:px-8 space-y-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
            NORVA Dispatch
          </p>
          <h1 className="font-serif-display text-4xl sm:text-5xl text-white mt-1">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Form: Shipping, Courier & Settlement */}
          <form onSubmit={handlePlaceOrder} className="lg:col-span-7 space-y-8">
            {/* 1. Client & Shipping Information */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-5">
              <h2 className="font-serif-display text-2xl text-white">
                1. Recipient &amp; Shipping Address
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-white/60 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Zainab Ali"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@domain.com"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1.5">Phone / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-white/60 mb-1.5">Street Address *</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House 14, Street 8, DHA Phase 6"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1.5">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Karachi / Lahore / Islamabad"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1.5">Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="75500"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
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
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-5">
              <h2 className="font-serif-display text-2xl text-white">
                2. Courier Method &amp; Gift Note
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => setShippingSpeed('standard')}
                  className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    shippingSpeed === 'standard'
                      ? 'bg-[#12121b] border-[#d6be96]'
                      : 'bg-[#06060a] border-white/12'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-white">
                    <span>Standard Insured Courier</span>
                    <span className="font-mono-tabular text-[#d6be96]">
                      {cartSubtotal >= 5000 ? 'Complimentary' : 'PKR 250'}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">2–4 working days nationwide</p>
                </button>

                <button
                  type="button"
                  onClick={() => setShippingSpeed('express')}
                  className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    shippingSpeed === 'express'
                      ? 'bg-[#12121b] border-[#d6be96]'
                      : 'bg-[#06060a] border-white/12'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-white">
                    <span>Priority Overnight Air</span>
                    <span className="font-mono-tabular text-[#d6be96]">PKR 500</span>
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
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-5">
              <h2 className="font-serif-display text-2xl text-white">3. Payment Method</h2>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`w-full p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    paymentMethod === 'cod'
                      ? 'bg-[#12121b] border-[#36d67e]'
                      : 'bg-[#06060a] border-white/12'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      Cash on Delivery (COD)
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
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
                  className={`w-full p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    paymentMethod === 'invoice'
                      ? 'bg-[#12121b] border-[#36d67e]'
                      : 'bg-[#06060a] border-white/12'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      Bank Transfer / Online IBFT Invoice
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        paymentMethod === 'invoice' ? 'border-[#36d67e]' : 'border-white/30'
                      }`}
                    >
                      {paymentMethod === 'invoice' && (
                        <span className="w-2 h-2 rounded-full bg-[#36d67e]" />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-white/55 mt-1">
                    Reserves your order immediately; official bank transfer details are sent to your
                    email &amp; WhatsApp.
                  </p>
                </button>
              </div>

              <button
                type="submit"
                className="w-full h-13 py-3.5 px-6 rounded-xl bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.16em] transition-colors cursor-pointer"
              >
                Confirm Order · {formatPKR(finalTotal)}
              </button>
            </div>
          </form>

          {/* Right Sticky Order Summary & Privilege Coupon */}
          <aside className="lg:col-span-5 lg:sticky lg:top-24 p-6 sm:p-8 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-6">
            <h2 className="font-serif-display text-2xl text-white">Order Summary</h2>

            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              {cart.map((item) => (
                <div
                  key={item.key}
                  className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.06]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#050508] shrink-0">
                      <LuxuryImage
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-1">
                      <Link
                        to={`/product/${item.slug}`}
                        className="font-serif-display text-lg text-white hover:text-[#d6be96]"
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-white/50">{item.sizeLabel}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.key, item.quantity - 1)}
                          className="w-6 h-6 rounded bg-white/[0.06] flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono-tabular text-xs text-white w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.key, item.quantity + 1)}
                          className="w-6 h-6 rounded bg-white/[0.06] flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.key)}
                          aria-label="Remove item"
                          className="ml-2 text-white/40 hover:text-red-400 cursor-pointer"
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
              ))}
            </div>

            {/* Discount Coupon Form */}
            <form onSubmit={handleApplyCoupon} className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs text-white/60">
                <Tag className="w-3.5 h-3.5 text-[#d6be96]" />
                <span>Discount Code (Try NORVA15)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="NORVA15"
                  className="flex-1 h-10 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs font-mono-tabular uppercase text-white focus:outline-none focus:border-[#d6be96]"
                />
                <button
                  type="submit"
                  className="h-10 px-4 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs font-medium text-white cursor-pointer"
                >
                  Apply
                </button>
              </div>
              {couponError && <p className="text-xs text-amber-300">{couponError}</p>}
              {appliedCoupon && (
                <p className="text-xs text-[#36d67e]">
                  Applied {appliedCoupon}: {VALID_COUPONS[appliedCoupon].label}
                </p>
              )}
            </form>

            {/* Totals Breakdown */}
            <div className="pt-4 border-t border-white/[0.08] space-y-2.5 text-xs">
              <div className="flex justify-between text-white/65">
                <span>Subtotal</span>
                <span className="font-mono-tabular">{formatPKR(cartSubtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[#36d67e]">
                  <span>Discount ({appliedCoupon})</span>
                  <span className="font-mono-tabular">-{formatPKR(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-white/65">
                <span>Courier Shipping</span>
                <span className="font-mono-tabular">
                  {shippingCost === 0 ? 'Complimentary' : formatPKR(shippingCost)}
                </span>
              </div>
              <div className="pt-3 border-t border-white/[0.08] flex justify-between items-baseline">
                <span className="text-sm font-medium text-white">Total</span>
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
// CUSTOMER ACCOUNT PAGE (PROFILE, ORDER HISTORY & WISHLIST)
// ===========================================================================
export const AccountPage: React.FC = () => {
  const {
    products,
    profile,
    updateProfile,
    orders,
    wishlist,
    toggleWishlist,
    addToCart,
    showToast,
  } = useStore();

  const [tab, setTab] = useState<'wishlist' | 'orders' | 'profile'>('wishlist');
  const [formState, setFormState] = useState(profile);

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
    <div className="bg-transparent text-[#f5f3ef] min-h-[80vh] py-14 lg:py-20">
      <SEOHead
        title="Client Account, Orders & Wishlist"
        description="Manage your NORVA saved fragrances, order archive, and delivery preferences."
      />

      <div className="max-w-[1380px] mx-auto px-4 sm:px-8 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/[0.08]">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
              NORVA Client Suite
            </p>
            <h1 className="font-serif-display text-4xl sm:text-5xl text-white">
              {profile.fullName ? `Welcome, ${profile.fullName}` : 'Your NORVA Account'}
            </h1>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-[#0a0a0f] border border-white/10 self-start">
            <button
              type="button"
              onClick={() => setTab('wishlist')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                tab === 'wishlist'
                  ? 'bg-[#f2e6d5] text-[#050508]'
                  : 'text-white/65 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Wishlist ({wishedProducts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('orders')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                tab === 'orders'
                  ? 'bg-[#f2e6d5] text-[#050508]'
                  : 'text-white/65 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Orders ({orders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('profile')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                tab === 'profile'
                  ? 'bg-[#f2e6d5] text-[#050508]'
                  : 'text-white/65 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Profile</span>
            </button>
          </div>
        </div>

        {/* TAB 1: WISHLIST */}
        {tab === 'wishlist' && (
          <div className="space-y-6">
            {wishedProducts.length === 0 ? (
              <div className="p-14 rounded-2xl bg-[#0a0a0f] border border-white/[0.07] text-center space-y-4">
                <Heart className="w-8 h-8 text-[#d6be96] mx-auto" />
                <h2 className="font-serif-display text-3xl text-white">
                  Your Olfactory Wardrobe is Empty
                </h2>
                <p className="text-sm text-white/55 max-w-md mx-auto">
                  Tap the heart icon on any of our five signature flacons to save it to your
                  wishlist.
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {wishedProducts.map((product) => {
                  const sz = product.sizes[0];
                  return (
                    <div
                      key={product.id}
                      className="rounded-xl bg-[#0a0a0f] border border-white/[0.08] overflow-hidden flex flex-col justify-between"
                    >
                      <Link to={`/product/${product.slug}`} className="aspect-[4/3] block bg-[#050508]">
                        <LuxuryImage
                          src={product.primaryImage}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </Link>
                      <div className="p-5 space-y-4">
                        <div>
                          <p className="text-xs text-white/45">
                            {product.concentration} · {product.family}
                          </p>
                          <Link
                            to={`/product/${product.slug}`}
                            className="font-serif-display text-2xl text-white hover:text-[#d6be96]"
                          >
                            {product.name}
                          </Link>
                          <p className="font-mono-tabular text-sm text-[#d6be96] mt-1">
                            {formatPKR(sz.price)} / {sz.label}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => addToCart(product, 0, 1, true)}
                            className="flex-1 h-10 px-4 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Move to Bag</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleWishlist(product.id)}
                            aria-label="Remove from wishlist"
                            className="h-10 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] text-white/70 hover:text-white text-xs cursor-pointer"
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
          <div className="space-y-5">
            {orders.length === 0 ? (
              <div className="p-14 rounded-2xl bg-[#0a0a0f] border border-white/[0.07] text-center space-y-4">
                <Package className="w-8 h-8 text-[#d6be96] mx-auto" />
                <h2 className="font-serif-display text-3xl text-white">No Past Orders Yet</h2>
                <p className="text-sm text-white/55 max-w-md mx-auto">
                  Completed NORVA orders and receipts will appear here automatically.
                </p>
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-[#f2e6d5] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em]"
                >
                  <span>Browse Fragrances</span>
                </Link>
              </div>
            ) : (
              orders.map((ord) => (
                <div
                  key={ord.orderNumber}
                  className="p-6 sm:p-8 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
                    <div>
                      <span className="font-mono-tabular text-sm font-semibold text-[#d6be96]">
                        {ord.orderNumber}
                      </span>
                      <p className="text-xs text-white/45 mt-0.5">{ord.createdAt}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono-tabular text-lg font-semibold text-white">
                        {formatPKR(ord.total)}
                      </span>
                      <p className="text-xs text-[#36d67e]">
                        Status: {ord.status ?? 'Pending'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {ord.items.map((it) => (
                      <div key={it.key} className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#050508] shrink-0">
                          <LuxuryImage
                            src={it.image}
                            alt={it.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <Link
                            to={`/product/${it.slug}`}
                            className="font-serif-display text-lg text-white hover:text-[#d6be96]"
                          >
                            {it.name}
                          </Link>
                          <p className="text-xs text-white/50">
                            {it.sizeLabel} × {it.quantity} · {formatPKR(it.unitPrice * it.quantity)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: SAVED CLIENT PROFILE */}
        {tab === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="max-w-2xl p-7 sm:p-10 rounded-2xl bg-[#0a0a0f] border border-white/[0.08] space-y-5"
          >
            <h2 className="font-serif-display text-3xl text-white">Saved Dispatch Coordinates</h2>
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
              className="h-11 px-7 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer"
            >
              Save Preferences
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
