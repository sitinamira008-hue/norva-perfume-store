import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { formatPKR } from '../data/products';
import { useStore } from '../context/StoreContext';
import { LuxuryImage } from './LuxuryUI';
import { ThreeBottleStage } from './ThreeBottleStage';

const FREE_SHIPPING_THRESHOLD = 5000;

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    closeCart,
    removeFromCart,
    updateCartQuantity,
    cartSubtotal,
    products,
    addToCart,
  } = useStore();
  const navigate = useNavigate();

  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - cartSubtotal);
  const progressPct = Math.min(100, (cartSubtotal / FREE_SHIPPING_THRESHOLD) * 100);

  // Suggest one complementary scent not in bag
  const complementaryProduct = useMemo(() => {
    const inBagIds = new Set(cart.map((c) => c.productId));
    return products.find((p) => !inBagIds.has(p.id) && p.inStock) ?? products[0];
  }, [cart, products]);

  useEffect(() => {
    if (!isCartOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCartOpen, closeCart]);

  if (!isCartOpen) return null;

  return (
    <>
      <div
        onClick={closeCart}
        className="fixed inset-0 z-50 bg-black/75"
      />
      <aside
        aria-label="Shopping Bag"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0a0a10] border-l border-white/10 flex flex-col justify-between norva-fade-in"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/[0.08] space-y-3.5 sm:space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-4 h-4 text-[#d6be96]" />
              <h2 className="font-serif-display text-2xl text-white">Your Bag</h2>
            </div>
            <button
              type="button"
              onClick={closeCart}
              aria-label="Close bag"
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.05] text-white/75 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Free Shipping Progress */}
          <div className="space-y-1.5">
            <p className="text-xs text-white/65">
              {remainingForFreeShipping > 0 ? (
                <>
                  Add{' '}
                  <span className="font-mono-tabular text-[#f2e6d5] font-medium">
                    {formatPKR(remainingForFreeShipping)}
                  </span>{' '}
                  more for complimentary nationwide shipping
                </>
              ) : (
                <span className="text-[#23b98e] font-medium">
                  You have unlocked Complimentary Express Shipping
                </span>
              )}
            </p>
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#d6be96] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#d6be96]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-serif-display text-2xl text-white">Your bag is empty</p>
                <p className="text-xs text-white/50 max-w-xs">
                  Explore our small-batch Extrait de Parfum collection to find your signature trail.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeCart();
                  navigate('/shop');
                }}
                className="mt-2 px-5 py-2.5 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Explore Fragrances
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.key}
                    className="flex gap-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]"
                  >
                    <Link
                      to={`/product/${item.slug}`}
                      onClick={closeCart}
                      className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-[#050508]"
                    >
                      <LuxuryImage
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain sm:object-cover"
                      />
                    </Link>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link
                            to={`/product/${item.slug}`}
                            onClick={closeCart}
                            className="font-serif-display text-lg text-white hover:text-[#f2e6d5] leading-tight block"
                          >
                            {item.name}
                          </Link>
                          <p className="text-[11px] text-white/45 mt-0.5">
                            {item.concentration} · {item.sizeLabel}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.key)}
                          aria-label={`Remove ${item.name}`}
                          className="text-white/40 hover:text-red-400 transition-colors p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="inline-flex items-center rounded-lg border border-white/12 bg-[#050508]">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.key, item.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center font-mono-tabular text-xs text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.key, item.quantity + 1)}
                            aria-label="Increase quantity"
                            className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-mono-tabular text-sm font-medium text-white">
                          {formatPKR(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Complementary Pairing */}
              {complementaryProduct && (
                <div className="pt-4 border-t border-white/[0.06] space-y-2.5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                    Pairs Beautifully With
                  </p>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                        <LuxuryImage
                          src={complementaryProduct.primaryImage}
                          alt={complementaryProduct.name}
                          className="w-full h-full object-contain sm:object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-serif-display text-base text-white truncate">
                          {complementaryProduct.name}
                        </p>
                        <p className="font-mono-tabular text-xs text-white/55">
                          {formatPKR(complementaryProduct.sizes[0].price)} ·{' '}
                          {complementaryProduct.sizes[0].label}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToCart(complementaryProduct, 0, 1, true)}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-[#f2e6d5] text-white hover:text-[#050508] text-xs font-medium transition-colors shrink-0 cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Checkout CTA */}
        {cart.length > 0 && (
          <div className="p-4 sm:p-6 border-t border-white/[0.08] bg-[#08080d] space-y-3 sm:space-y-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/65">Subtotal</span>
              <span className="font-mono-tabular text-lg font-medium text-white">
                {formatPKR(cartSubtotal)}
              </span>
            </div>
            <p className="text-[11px] text-white/45">
              Complimentary gift box &amp; 2ml tester vial included with every order.
            </p>
            <button
              type="button"
              onClick={() => {
                closeCart();
                navigate('/checkout');
              }}
              className="w-full h-12 rounded-xl bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.16em] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export const QuickViewModal: React.FC = () => {
  const { quickViewProduct, closeQuickView, addToCart, products } = useStore();
  const [sizeIdx, setSizeIdx] = useState(0);

  useEffect(() => {
    setSizeIdx(0);
  }, [quickViewProduct]);

  useEffect(() => {
    if (!quickViewProduct) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeQuickView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quickViewProduct, closeQuickView]);

  if (!quickViewProduct) return null;

  const liveProduct = products.find((p) => p.id === quickViewProduct.id) ?? quickViewProduct;
  const inStock = 'inStock' in liveProduct ? liveProduct.inStock : true;
  const activeSize =
    liveProduct.sizes[Math.min(sizeIdx, liveProduct.sizes.length - 1)] ?? liveProduct.sizes[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div
        onClick={closeQuickView}
        className="fixed inset-0 bg-black/80"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={liveProduct.name}
        className="relative z-10 w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#0b0b12] border-t sm:border border-white/12 grid grid-cols-1 md:grid-cols-2 norva-fade-in"
      >
        <button
          type="button"
          onClick={closeQuickView}
          aria-label="Close quick view"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 w-9 h-9 rounded-lg bg-[#050508]/90 border border-white/15 flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left: Interactive 3D Flacon Stage (or Static Studio Image on low-spec / Windows 7) */}
        <div className="h-[270px] sm:h-[360px] md:h-auto md:min-h-[460px] bg-[#06060a] border-b md:border-b-0 md:border-r border-white/[0.08]">
          <ThreeBottleStage
            preset={liveProduct.essencePreset}
            label={liveProduct.bottleLabel}
            fallbackImage={liveProduct.primaryImage}
            interactiveControls
          />
        </div>

        {/* Right: Concise Olfactory Summary */}
        <div className="p-5 sm:p-8 flex flex-col justify-between gap-5 sm:gap-6">
          <div className="space-y-3.5 sm:space-y-4">
            <div className="text-[11px] sm:text-xs text-[#d6be96] tracking-[0.16em] uppercase font-mono-tabular pr-8">
              {liveProduct.editionNumber} · {liveProduct.concentration}
            </div>
            <div>
              <h2 className="font-serif-display text-2xl sm:text-4xl text-white">
                {liveProduct.name}
              </h2>
              <p className="text-xs sm:text-sm text-white/60 mt-1">{liveProduct.subtitle}</p>
            </div>

            <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
              {liveProduct.description}
            </p>

            {/* Fragrance Notes Trio */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.08] text-xs">
              <div>
                <span className="text-white/40 block mb-1">Top</span>
                <span className="text-white/85">{liveProduct.topNotes.slice(0, 2).join(', ')}</span>
              </div>
              <div>
                <span className="text-white/40 block mb-1">Heart</span>
                <span className="text-white/85">
                  {liveProduct.heartNotes.slice(0, 2).join(', ')}
                </span>
              </div>
              <div>
                <span className="text-white/40 block mb-1">Base</span>
                <span className="text-white/85">
                  {liveProduct.baseNotes.slice(0, 2).join(', ')}
                </span>
              </div>
            </div>

            {/* Volume Selector */}
            <div className="space-y-2 pt-2">
              <span className="text-xs text-white/50">Bottle Volume</span>
              <div className="flex flex-wrap gap-2">
                {liveProduct.sizes.map((sz, i) => (
                  <button
                    key={sz.sku}
                    type="button"
                    onClick={() => setSizeIdx(i)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-mono-tabular border transition-colors cursor-pointer ${
                      sizeIdx === i
                        ? 'bg-[#d6be96]/18 border-[#d6be96] text-white'
                        : 'bg-white/[0.03] border-white/12 text-white/70 hover:text-white'
                    }`}
                  >
                    {sz.label} — {formatPKR(sz.price)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/[0.08]">
            <button
              type="button"
              disabled={!inStock}
              onClick={() => {
                addToCart(liveProduct, sizeIdx, 1, true);
                closeQuickView();
              }}
              className="w-full h-12 rounded-xl bg-[#f2e6d5] hover:bg-[#d6be96] disabled:opacity-45 text-[#050508] text-xs font-semibold uppercase tracking-[0.16em] transition-colors cursor-pointer"
            >
              {inStock
                ? `Add to Bag — ${formatPKR(activeSize.price)}`
                : 'Currently Out of Stock'}
            </button>
            <Link
              to={`/product/${liveProduct.slug}`}
              onClick={closeQuickView}
              className="block text-center text-xs text-white/60 hover:text-white py-1 transition-colors"
            >
              View Full Olfactory Pyramid &amp; Reviews →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SearchModal: React.FC = () => {
  const { isSearchOpen, closeSearch, products } = useStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isSearchOpen) setQuery('');
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSearchOpen, closeSearch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 4);
    return products.filter((p) => {
      const hay = [
        p.name,
        p.subtitle,
        p.family,
        ...p.topNotes,
        ...p.heartNotes,
        ...p.baseNotes,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, products]);

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-3 sm:pt-24 px-3 sm:px-4">
      <div
        onClick={closeSearch}
        className="fixed inset-0 bg-black/80"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search NORVA Fragrances"
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-[#0b0b12] border border-white/12 overflow-hidden norva-fade-in"
      >
        <div className="flex items-center gap-3 px-4 sm:px-5 h-14 border-b border-white/10">
          <Search className="w-4 h-4 text-[#d6be96] shrink-0" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by scent note (Oud, Iris, Bergamot, Leather) or name..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={closeSearch}
            aria-label="Close search"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 max-h-[65vh] overflow-y-auto space-y-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            {query.trim() ? `Matching Creations (${filtered.length})` : 'Popular Creations'}
          </p>

          {filtered.length === 0 ? (
            <p className="text-sm text-white/55 py-8 text-center">
              No fragrances matched &ldquo;{query}&rdquo;. Try searching Oud, Rose, Cedarwood, or
              Musk.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  to={`/product/${p.slug}`}
                  onClick={closeSearch}
                  className="flex items-center gap-3.5 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] transition-colors"
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-[#050508]">
                    <LuxuryImage
                      src={p.primaryImage}
                      alt={p.name}
                      className="w-full h-full object-contain sm:object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-serif-display text-lg text-white truncate">{p.name}</p>
                    <p className="text-xs text-white/50 truncate">
                      {p.topNotes[0]} · {p.baseNotes[0]}
                    </p>
                    <p className="font-mono-tabular text-xs text-[#d6be96] mt-0.5">
                      {formatPKR(p.sizes[0].price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
