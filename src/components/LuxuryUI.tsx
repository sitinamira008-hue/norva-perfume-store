import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Heart, ShoppingBag } from 'lucide-react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { CatalogProduct, formatPKR } from '../data/products';
import { useStore } from '../context/StoreContext';
import { EssencePresetId } from '../webgl/FacetBottleScene';

export const PERFUME_CARD_SHADOW_BY_PRESET: Record<
  EssencePresetId,
  { shadowClass: string; ambientGlow: string }
> = {
  amber: {
    shadowClass: 'perfume-shadow-amber',
    ambientGlow:
      'bg-[radial-gradient(ellipse_85%_65%_at_50%_100%,rgba(238,144,42,0.16),transparent_72%)]',
  },
  cobalt: {
    shadowClass: 'perfume-shadow-cobalt',
    ambientGlow:
      'bg-[radial-gradient(ellipse_85%_65%_at_50%_100%,rgba(42,168,236,0.16),transparent_72%)]',
  },
  noir: {
    shadowClass: 'perfume-shadow-noir',
    ambientGlow:
      'bg-[radial-gradient(ellipse_85%_65%_at_50%_100%,rgba(164,180,224,0.14),transparent_72%)]',
  },
  champagne: {
    shadowClass: 'perfume-shadow-champagne',
    ambientGlow:
      'bg-[radial-gradient(ellipse_85%_65%_at_50%_100%,rgba(248,186,62,0.16),transparent_72%)]',
  },
  obsidian: {
    shadowClass: 'perfume-shadow-obsidian',
    ambientGlow:
      'bg-[radial-gradient(ellipse_85%_65%_at_50%_100%,rgba(184,116,252,0.16),transparent_72%)]',
  },
  violet: {
    shadowClass: 'perfume-shadow-obsidian',
    ambientGlow:
      'bg-[radial-gradient(ellipse_85%_65%_at_50%_100%,rgba(174,116,246,0.15),transparent_72%)]',
  },
  emerald: {
    shadowClass: 'perfume-shadow-cobalt',
    ambientGlow:
      'bg-[radial-gradient(ellipse_85%_65%_at_50%_100%,rgba(54,196,174,0.15),transparent_72%)]',
  },
};

export const SEOHead: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => {
  useEffect(() => {
    document.title = `${title} | NORVA`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', description);
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', `${title} | NORVA`);
    }
  }, [title, description]);

  return null;
};

export const LuxuryImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}> = ({ src, alt, className = '', priority = false }) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setErrored(false);
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  if (errored || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#12121a] to-[#060609] text-white/45 p-6 ${className}`}
      >
        <div className="w-10 h-14 border border-[#d6be96]/40 rounded-sm mb-3 relative">
          <div className="w-5 h-3 border border-[#d6be96]/40 mx-auto -mt-3.5" />
        </div>
        <span className="text-xs font-serif-display tracking-wide text-center">{alt}</span>
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setErrored(true)}
      className={`${className} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-92'}`}
    />
  );
};

export const MagneticWrap: React.FC<{
  children: React.ReactNode;
  className?: string;
  strength?: number;
}> = ({ children, className = '', strength = 0.2 }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  // Zero React re-renders: drive GPU transform directly via MotionValues
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 280, damping: 24, mass: 0.45 });
  const y = useSpring(rawY, { stiffness: 280, damping: 24, mass: 0.45 });

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width * 0.5);
    const dy = e.clientY - (rect.top + rect.height * 0.5);
    rawX.set(dx * strength);
    rawY.set(dy * strength);
  };

  const handleLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{ x, y }}
      className={`inline-block will-change-transform ${className}`}
    >
      {children}
    </motion.div>
  );
};

export const ProductCard: React.FC<{
  product: CatalogProduct & {
    inStock?: boolean;
    stockUnits?: number;
    lowStockThreshold?: number;
    isLowStock?: boolean;
  };
  index?: number;
}> = React.memo(({ product, index = 0 }) => {
  const { addToCart, toggleWishlist, isInWishlist, openQuickView } = useStore();
  const wished = isInWishlist(product.id);
  const inStock = product.inStock !== false && (product.stockUnits ?? 48) > 0;
  const isLowStock =
    inStock &&
    (product.isLowStock ||
      (product.stockUnits !== undefined &&
        product.stockUnits <= (product.lowStockThreshold ?? 10)));
  const defaultSizeIdx = 0;
  const displayOption = product.sizes[defaultSizeIdx];
  const aura =
    PERFUME_CARD_SHADOW_BY_PRESET[product.bottle3D.preset] ??
    PERFUME_CARD_SHADOW_BY_PRESET.amber;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: 0.36,
        delay: Math.min(index * 0.04, 0.16),
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`group relative flex flex-col bg-[#0a0a0f] border border-white/[0.08] rounded-xl overflow-hidden smooth-lift hover:-translate-y-1 hover:border-[#d6be96]/40 ${aura.shadowClass}`}
    >
      {/* Subtle perfumed mist gradient cast across bottom of obsidian card */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 opacity-75 group-hover:opacity-100 transition-opacity duration-200 ${aura.ambientGlow}`}
      />

      {/* Uniform 1:1 Product Imagery — uncropped on mobile, exact studio fill on desktop */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#050508]">
        <Link to={`/product/${product.slug}`} className="block w-full h-full">
          <LuxuryImage
            src={product.primaryImage}
            alt={product.name}
            priority={index < 3}
            className="w-full h-full object-contain lg:object-cover object-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04] will-change-transform"
          />
        </Link>

        {/* Subtle single text label top-left (Zero pill spam) */}
        {!inStock ? (
          <span className="pointer-events-none absolute top-2.5 left-2.5 sm:top-3.5 sm:left-4 text-[9.5px] sm:text-[11px] font-medium tracking-[0.1em] sm:tracking-[0.14em] uppercase text-red-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            Out of Stock
          </span>
        ) : isLowStock ? (
          <span className="pointer-events-none absolute top-2.5 left-2.5 sm:top-3.5 sm:left-4 text-[9.5px] sm:text-[11px] font-medium tracking-[0.1em] sm:tracking-[0.14em] uppercase text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            Only {product.stockUnits} Left
          </span>
        ) : (
          (product.isBestSeller || product.isNewArrival) && (
            <span className="pointer-events-none absolute top-2.5 left-2.5 sm:top-3.5 sm:left-4 text-[9.5px] sm:text-[11px] font-medium tracking-[0.1em] sm:tracking-[0.14em] uppercase text-[#d6be96] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              {product.isBestSeller ? 'Best Seller' : 'New Arrival'}
            </span>
          )
        )}

        {/* Wishlist toggle top-right (40px touch hitbox on mobile, 36px on desktop) */}
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-[#09090d]/90 border border-white/15 flex items-center justify-center text-white/75 hover:text-[#d6be96] active:scale-95 transition-all duration-150 cursor-pointer"
        >
          <Heart className={`w-4 h-4 ${wished ? 'fill-[#d6be96] text-[#d6be96]' : ''}`} />
        </button>

        {/* Desktop hover-reveal Quick Add & Quick View bar (100% preserved on lg:) */}
        <div className="hidden lg:flex absolute inset-x-3 bottom-3 items-center gap-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]">
          <button
            type="button"
            disabled={!inStock}
            onClick={() => addToCart(product, defaultSizeIdx, 1, true)}
            className={`flex-1 h-9 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0 ${
              inStock
                ? 'bg-[#f2e6d5]/96 hover:bg-[#d6be96] text-[#050508] cursor-pointer shadow-[0_8px_20px_rgba(0,0,0,0.85)]'
                : 'bg-white/15 text-white/50 cursor-not-allowed'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{inStock ? `Add · ${displayOption.label}` : 'Sold Out'}</span>
          </button>

          <button
            type="button"
            onClick={() => openQuickView(product)}
            aria-label={`Quick view ${product.name}`}
            className="h-9 px-3 rounded-lg bg-[#09090d]/94 hover:bg-[#14141e] text-white/90 border border-white/18 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 shadow-[0_8px_20px_rgba(0,0,0,0.85)]"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Quick View</span>
          </button>
        </div>
      </div>

      {/* Contiguous clean typography metadata */}
      <div className="relative z-[1] flex flex-col flex-1 justify-between p-3 sm:p-5 gap-2.5 sm:gap-3 min-w-0">
        <div className="space-y-1 sm:space-y-1.5 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11.5px] text-white/45 truncate">
            <span className="truncate">{product.concentration}</span>
            <span aria-hidden="true" className="shrink-0">·</span>
            <span className="truncate">{product.family}</span>
          </div>

          <Link
            to={`/product/${product.slug}`}
            className="block font-serif-display text-lg min-[390px]:text-xl sm:text-2xl font-medium text-white group-hover:text-[#d6be96] transition-colors duration-200 leading-snug sm:leading-tight truncate"
          >
            {product.name}
          </Link>

          <p className="text-[11px] sm:text-xs text-white/55 line-clamp-1 sm:line-clamp-2 leading-relaxed">
            {product.keyNotesSummary}
          </p>
        </div>

        <div className="pt-2.5 sm:pt-3 border-t border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-1 sm:gap-1.5 min-w-0">
              <span className="font-mono-tabular text-[13px] min-[390px]:text-[14px] sm:text-[15px] font-medium text-white whitespace-nowrap">
                {formatPKR(displayOption.price)}
              </span>
              <span className="text-[10.5px] sm:text-[11.5px] text-white/40 whitespace-nowrap">
                / {displayOption.label}
              </span>
            </div>

            <Link
              to={`/product/${product.slug}`}
              className="hidden sm:inline text-xs font-medium text-white/75 hover:text-[#d6be96] transition-colors duration-150 whitespace-nowrap shrink-0"
            >
              Explore →
            </Link>
          </div>

          {/* Dedicated unobstructed touch-friendly action bar on mobile/tablet (< lg) */}
          <div className="flex lg:hidden items-center gap-1.5">
            <button
              type="button"
              disabled={!inStock}
              onClick={() => addToCart(product, defaultSizeIdx, 1, true)}
              className={`flex-1 min-h-[40px] px-2.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all duration-150 whitespace-nowrap min-w-0 ${
                inStock
                  ? 'bg-[#f2e6d5] active:bg-[#d6be96] text-[#050508] cursor-pointer'
                  : 'bg-white/15 text-white/50 cursor-not-allowed'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{inStock ? `Add · ${displayOption.label}` : 'Sold Out'}</span>
            </button>

            <button
              type="button"
              onClick={() => openQuickView(product)}
              aria-label={`Quick view ${product.name}`}
              className="w-10 h-10 shrink-0 rounded-lg bg-[#101018] border border-white/15 text-white/85 active:scale-95 flex items-center justify-center cursor-pointer"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
});
