import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Box,
  Image as ImageIcon,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { formatPKR } from '../data/products';
import { useStore } from '../context/StoreContext';
import { LuxuryImage, PERFUME_CARD_SHADOW_BY_PRESET } from './LuxuryUI';
import { ThreeBottleStage } from './ThreeBottleStage';
import {
  WHATSAPP_DISPLAY,
  WhatsAppIcon,
  buildCartWhatsAppUrl,
} from './WhatsAppFloatingButton';

const FREE_SHIPPING_THRESHOLD = 5000;

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    closeCart,
    removeFromCart,
    updateCartQuantity,
    cartSubtotal,
  } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCartOpen) closeCart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCartOpen, closeCart]);

  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - cartSubtotal);
  const progressPct = Math.min(100, (cartSubtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <AnimatePresence>
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeCart}
            className="fixed inset-0 bg-black/82"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            className="relative z-10 w-full max-w-md bg-[#09090d] border-l border-white/10 h-full flex flex-col justify-between shadow-[-24px_0_64px_rgba(0,0,0,0.95)] will-change-transform"
          >
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-white/[0.08] bg-gradient-to-b from-[#101018] to-[#09090d]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-4 h-4 text-[#d6be96]" />
                  <h2 className="font-serif-display text-xl sm:text-2xl text-white">
                    Your Shopping Bag
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeCart}
                  aria-label="Close shopping bag"
                  className="w-10 h-10 -mr-2 flex items-center justify-center text-white/55 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Complimentary Courier Progress */}
              <div className="mt-4 space-y-2">
                <p className="text-xs text-white/60">
                  {remainingForFreeShipping === 0 ? (
                    <span className="text-[#36d67e]">
                      Complimentary nationwide courier shipping unlocked
                    </span>
                  ) : (
                    <>
                      Add{' '}
                      <span className="font-mono-tabular text-white">
                        {formatPKR(remainingForFreeShipping)}
                      </span>{' '}
                      more for complimentary courier shipping
                    </>
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

            {/* Itemized List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-4">
                  <p className="font-serif-display text-2xl text-white/80">
                    Your bag is currently empty
                  </p>
                  <p className="text-xs text-white/50 max-w-xs leading-relaxed">
                    Explore NORVA’s five signature 50ml smoked-crystal extraits — each PKR 2,500.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      closeCart();
                      navigate('/shop');
                    }}
                    className="mt-2 h-11 px-5 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Explore Fragrances
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.key}
                    className="flex gap-3.5 sm:gap-4 pb-4 sm:pb-5 border-b border-white/[0.07]"
                  >
                    <Link
                      to={`/product/${item.slug}`}
                      onClick={closeCart}
                      className="w-18 h-18 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-[#050508] shrink-0 border border-white/12"
                    >
                      <LuxuryImage
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain sm:object-cover"
                      />
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/product/${item.slug}`}
                          onClick={closeCart}
                          className="font-serif-display text-lg text-white hover:text-[#d6be96] truncate"
                        >
                          {item.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.key)}
                          aria-label={`Remove ${item.name}`}
                          className="w-9 h-9 -mt-1.5 -mr-1.5 flex items-center justify-center text-white/45 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-[11.5px] text-white/45 mt-0.5 truncate">
                        {item.concentration} · {item.sizeLabel}
                      </p>

                      <div className="mt-2.5 sm:mt-3 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center border border-white/15 rounded-md bg-[#050508]">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.key, item.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="w-9 h-8 sm:w-auto sm:h-auto sm:p-1.5 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 sm:px-2.5 text-xs font-mono-tabular text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.key, item.quantity + 1)}
                            aria-label="Increase quantity"
                            className="w-9 h-8 sm:w-auto sm:h-auto sm:p-1.5 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-mono-tabular text-sm font-medium text-white whitespace-nowrap">
                          {formatPKR(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="p-4 sm:p-6 pb-safe border-t border-white/[0.08] bg-[#060609] space-y-3 sm:space-y-4">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2 text-white/60">
                    <span>Complimentary Samples</span>
                    <span className="text-[#d6be96] text-right">2 × 2 ml Vials Included</span>
                  </div>
                  <div className="flex justify-between text-base font-medium text-white pt-1">
                    <span>Subtotal</span>
                    <span className="font-mono-tabular">{formatPKR(cartSubtotal)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    closeCart();
                    navigate('/checkout');
                  }}
                  className="w-full h-11 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <a
                  href={buildCartWhatsAppUrl(cart, cartSubtotal)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeCart}
                  className="w-full h-11 px-3 rounded-lg bg-[#0b1610] hover:bg-[#25D366] text-[#36d67e] hover:text-[#050508] border border-[#25D366]/40 text-[11.5px] sm:text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <WhatsAppIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">Order Bag on WhatsApp · {WHATSAPP_DISPLAY}</span>
                </a>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

export const QuickViewModal: React.FC = () => {
  const { quickViewProduct, closeQuickView, addToCart } = useStore();
  const [sizeIdx, setSizeIdx] = useState(0);
  const [previewMode, setPreviewMode] = useState<'photo' | '3d'>('photo');

  useEffect(() => {
    if (quickViewProduct) {
      setSizeIdx(0);
      setPreviewMode('photo');
    }
  }, [quickViewProduct]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && quickViewProduct) closeQuickView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quickViewProduct, closeQuickView]);

  const aura = quickViewProduct
    ? PERFUME_CARD_SHADOW_BY_PRESET[quickViewProduct.bottle3D.preset] ??
      PERFUME_CARD_SHADOW_BY_PRESET.amber
    : PERFUME_CARD_SHADOW_BY_PRESET.amber;

  return (
    <AnimatePresence>
      {quickViewProduct && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 bg-black/84 flex items-center justify-center p-3 sm:p-4"
          onClick={closeQuickView}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-3xl max-h-[90dvh] overflow-y-auto md:max-h-none md:overflow-hidden bg-[#0a0a0f] border border-white/12 rounded-2xl grid grid-cols-1 md:grid-cols-2 will-change-[opacity,transform] ${aura.shadowClass}`}
          >
            <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[420px] bg-[#050508]">
              <button
                type="button"
                onClick={closeQuickView}
                aria-label="Close quick view"
                className="md:hidden absolute top-2.5 right-2.5 z-20 w-9 h-9 rounded-full bg-[#0b0b11]/95 border border-white/15 flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-20 inline-flex p-0.5 rounded-lg bg-[#0b0b11]/95 border border-white/15">
                <button
                  type="button"
                  onClick={() => setPreviewMode('photo')}
                  className={`flex items-center gap-1 min-h-[34px] sm:min-h-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    previewMode === 'photo'
                      ? 'bg-[#f2e6d5] text-[#050508]'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  <span>2D Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('3d')}
                  className={`flex items-center gap-1 min-h-[34px] sm:min-h-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    previewMode === '3d'
                      ? 'bg-[#f2e6d5] text-[#050508]'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Box className="w-3 h-3" />
                  <span>3D Flacon</span>
                </button>
              </div>

              {previewMode === '3d' ? (
                <ThreeBottleStage
                  label={quickViewProduct.bottle3D.label}
                  preset={quickViewProduct.bottle3D.preset}
                  fallbackImage={quickViewProduct.primaryImage}
                  className="w-full h-full min-h-[260px] sm:min-h-[320px] md:min-h-[420px]"
                />
              ) : (
                <LuxuryImage
                  src={quickViewProduct.primaryImage}
                  alt={quickViewProduct.name}
                  priority
                  className="w-full h-full object-contain md:object-cover"
                />
              )}
            </div>

            <div className="relative p-4 sm:p-8 flex flex-col justify-between space-y-4 sm:space-y-5">
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 opacity-70 ${aura.ambientGlow}`}
              />
              <div className="relative z-[1]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#d6be96]">
                    {quickViewProduct.concentration}
                  </span>
                  <button
                    type="button"
                    onClick={closeQuickView}
                    aria-label="Close quick view"
                    className="hidden md:inline-flex p-1 text-white/50 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="font-serif-display text-2xl sm:text-3xl text-white mt-1">
                  {quickViewProduct.name}
                </h3>
                <p className="text-xs text-white/55 mt-2 leading-relaxed">
                  {quickViewProduct.shortDescription}
                </p>

                {/* Olfactory Pyramid Summary */}
                <div className="mt-4 pt-4 border-t border-white/[0.08] space-y-1.5 text-xs">
                  <p className="text-white/50">
                    <strong className="text-white/85 font-medium">Top:</strong>{' '}
                    {quickViewProduct.pyramid.top.join(', ')}
                  </p>
                  <p className="text-white/50">
                    <strong className="text-white/85 font-medium">Heart:</strong>{' '}
                    {quickViewProduct.pyramid.heart.join(', ')}
                  </p>
                  <p className="text-white/50">
                    <strong className="text-white/85 font-medium">Base:</strong>{' '}
                    {quickViewProduct.pyramid.base.join(', ')}
                  </p>
                </div>

                {/* Size display */}
                <div className="mt-5">
                  <span className="block text-[11px] text-white/50 mb-2">Flacon Volume</span>
                  <div className="flex flex-wrap gap-2">
                    {quickViewProduct.sizes.map((opt, idx) => (
                      <button
                        key={opt.sku}
                        type="button"
                        onClick={() => setSizeIdx(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          idx === sizeIdx
                            ? 'bg-white/12 text-white border-[#d6be96]'
                            : 'bg-[#050508] text-white/60 border-white/10 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative z-[1] pt-4 border-t border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono-tabular text-xl font-medium text-white">
                    {formatPKR((quickViewProduct.sizes[sizeIdx] ?? quickViewProduct.sizes[0]).price)}
                  </span>
                  <Link
                    to={`/product/${quickViewProduct.slug}`}
                    onClick={closeQuickView}
                    className="text-xs font-medium text-[#d6be96] hover:underline"
                  >
                    Full Details &amp; 3D Flacon →
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    addToCart(quickViewProduct, sizeIdx, 1, true);
                    closeQuickView();
                  }}
                  className="w-full h-11 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Add to Shopping Bag —{' '}
                  {formatPKR((quickViewProduct.sizes[sizeIdx] ?? quickViewProduct.sizes[0]).price)}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const SearchModal: React.FC = () => {
  const { products, isSearchOpen, closeSearch } = useStore();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isSearchOpen) closeSearch();
      } else if (e.key === 'Escape' && isSearchOpen) {
        closeSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSearchOpen, closeSearch]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.keyNotesSummary.toLowerCase().includes(q) ||
        p.family.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.concentration.toLowerCase().includes(q),
    );
  }, [products, query]);

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black/84 flex items-start justify-center pt-12 sm:pt-24 p-3 sm:p-4"
          onClick={closeSearch}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#0a0a0f] border border-white/12 rounded-2xl overflow-hidden perfume-ambient-panel will-change-[opacity,transform]"
          >
            <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/10 bg-[#0d0d14]">
              <Search className="w-4 h-4 text-[#d6be96] shrink-0" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fragrances or notes (oud, vanilla, iris)..."
                className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
              />
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close search"
                className="w-9 h-9 -mr-1.5 flex items-center justify-center text-white/50 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[65dvh] overflow-y-auto p-3 sm:p-4 divide-y divide-white/[0.06]">
              {results.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <p className="text-sm text-white/75">No fragrances match "{query}"</p>
                  <button
                    type="button"
                    onClick={() => {
                      closeSearch();
                      navigate('/shop');
                    }}
                    className="text-xs text-[#d6be96] hover:underline cursor-pointer"
                  >
                    Browse All 5 Fragrances →
                  </button>
                </div>
              ) : (
                results.map((item) => (
                  <Link
                    key={item.id}
                    to={`/product/${item.slug}`}
                    onClick={closeSearch}
                    className="flex items-center gap-3 sm:gap-4 py-3 px-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#050508] border border-white/10 shrink-0">
                      <LuxuryImage
                        src={item.primaryImage}
                        alt={item.name}
                        className="w-full h-full object-contain sm:object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif-display text-lg sm:text-xl text-white truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-white/50 truncate">
                        {item.concentration} · {item.sizes[0].label} · {item.keyNotesSummary}
                      </p>
                    </div>
                    <span className="font-mono-tabular text-xs sm:text-sm text-white/85 shrink-0">
                      {formatPKR(item.sizes[0].price)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const ToastNotification: React.FC = () => {
  const { toastMessage } = useStore();
  return (
    <AnimatePresence>
      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          className="fixed bottom-20 sm:bottom-24 left-3 right-3 sm:left-auto sm:right-5 max-w-sm mx-auto sm:mx-0 z-50 px-4 py-3 rounded-xl bg-[#0b0b11] border border-[#d6be96]/40 text-xs font-medium text-white shadow-[0_18px_48px_rgba(0,0,0,0.94),0_8px_24px_rgba(214,190,150,0.18)]"
        >
          {toastMessage}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
