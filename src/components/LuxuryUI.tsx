import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, Heart, ShoppingBag } from 'lucide-react';
import {
  CatalogProduct,
  formatPKR,
  IMAGE_ASSET_PAIR_MAP,
} from '../data/products';
import type { EssencePresetId } from '../webgl/bottleTypes';
import {
  HydratedCatalogProduct,
  useCatalogActions,
  useToastMessage,
  useWishlistSet,
} from '../context/StoreContext';

/**
 * Lightweight scent-matched border/glow tokens (box-shadows removed on low-spec PCs via CSS)
 */
export const PERFUME_CARD_SHADOW_BY_PRESET: Record<
  EssencePresetId,
  { shadowClass: string; ambientGlow: string }
> = {
  amber: {
    shadowClass: 'border-[#d6be96]/18',
    ambientGlow:
      'bg-[radial-gradient(circle_at_75%_35%,rgba(238,144,42,0.12),transparent_65%)]',
  },
  cobalt: {
    shadowClass: 'border-sky-400/18',
    ambientGlow:
      'bg-[radial-gradient(circle_at_75%_35%,rgba(42,168,236,0.12),transparent_65%)]',
  },
  noir: {
    shadowClass: 'border-white/14',
    ambientGlow:
      'bg-[radial-gradient(circle_at_75%_35%,rgba(164,180,224,0.10),transparent_65%)]',
  },
  champagne: {
    shadowClass: 'border-[#f2e6d5]/20',
    ambientGlow:
      'bg-[radial-gradient(circle_at_75%_35%,rgba(248,186,62,0.12),transparent_65%)]',
  },
  obsidian: {
    shadowClass: 'border-purple-400/18',
    ambientGlow:
      'bg-[radial-gradient(circle_at_75%_35%,rgba(184,116,252,0.12),transparent_65%)]',
  },
  violet: {
    shadowClass: 'border-purple-400/18',
    ambientGlow:
      'bg-[radial-gradient(circle_at_75%_35%,rgba(174,116,246,0.12),transparent_65%)]',
  },
  emerald: {
    shadowClass: 'border-emerald-400/18',
    ambientGlow:
      'bg-[radial-gradient(circle_at_75%_35%,rgba(54,196,174,0.12),transparent_65%)]',
  },
};

/**
 * Updates document title and meta description per route for clean SEO & tab clarity
 */
export const SEOHead: React.FC<{ title: string; description: string }> = React.memo(
  ({ title, description }) => {
    useEffect(() => {
      document.title = `${title} | NORVA Haute Parfumerie`;
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
  },
);
SEOHead.displayName = 'SEOHead';

/**
 * Zero-JS wrapper replacing heavy spring pointer tracking for instant response on older PCs
 */
export const MagneticWrap: React.FC<{
  children: React.ReactNode;
  className?: string;
  strength?: number;
}> = ({ children, className = '' }) => {
  return <div className={className}>{children}</div>;
};

/**
 * WebP-first luxury image loader with automatic progressive JPEG fallback for legacy Windows 7 browsers,
 * explicit intrinsic dimensions (zero CLS), and native lazy decoding.
 */
export const LuxuryImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}> = React.memo(({ src, alt, className = '', priority = false, width = 800, height = 800 }) => {
  const pair = IMAGE_ASSET_PAIR_MAP[src];

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#09090d]">
      {pair ? (
        <picture className="block w-full h-full">
          <source srcSet={pair.webp} type="image/webp" />
          <img
            src={pair.jpg}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            className={className}
          />
        </picture>
      ) : (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          className={className}
        />
      )}
    </div>
  );
});
LuxuryImage.displayName = 'LuxuryImage';

interface ProductCardInnerProps {
  product: CatalogProduct | HydratedCatalogProduct;
  index: number;
  wished: boolean;
}

const ProductCardInner: React.FC<ProductCardInnerProps> = React.memo(
  ({ product, index, wished }) => {
    const { addToCart, toggleWishlist, openQuickView } = useCatalogActions();
    const defaultSize = product.sizes[0];
    const inStock = 'inStock' in product ? product.inStock : true;
    const stockUnits = 'stockUnits' in product ? product.stockUnits : 48;
    const isLowStock = 'isLowStock' in product ? product.isLowStock : false;

    return (
      <article className="group luxury-card rounded-xl overflow-hidden flex flex-col justify-between">
        {/* Visual Frame */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[#060609]">
          <Link
            to={`/product/${product.slug}`}
            className="block w-full h-full"
            aria-label={`Explore ${product.name}`}
          >
            <LuxuryImage
              src={product.primaryImage}
              alt={`${product.name} — ${product.subtitle}`}
              priority={index < 2}
              className={`w-full h-full object-contain lg:object-cover p-2 lg:p-0 transition-transform duration-300 ease-out lg:group-hover:scale-[1.03] ${
                !inStock ? 'opacity-45 grayscale' : ''
              }`}
            />
          </Link>

          {/* Subtle bottom gradient for contrast */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#0a0a0f]/80 to-transparent" />

          {/* Top Left Editorial Edition & Stock Tag */}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1 pointer-events-none">
            <span className="font-mono-tabular text-[11px] tracking-[0.18em] uppercase text-white/80 bg-[#050508]/90 px-2.5 py-1 rounded border border-white/10">
              {product.editionNumber}
            </span>
            {!inStock ? (
              <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-red-300 bg-[#1a0707]/95 px-2.5 py-0.5 rounded border border-red-500/35">
                Sold Out
              </span>
            ) : isLowStock ? (
              <span className="font-mono-tabular text-[10px] font-medium tracking-[0.1em] uppercase text-amber-300 bg-[#191205]/95 px-2.5 py-0.5 rounded border border-amber-400/35">
                Only {stockUnits} Left
              </span>
            ) : product.isBestSeller ? (
              <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#f2e6d5] bg-[#0a0a0f]/92 px-2.5 py-0.5 rounded border border-[#d6be96]/30">
                House Icon
              </span>
            ) : product.isNewArrival ? (
              <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#c8bdff] bg-[#0a0a0f]/92 px-2.5 py-0.5 rounded border border-[#8e78ff]/35">
                New Edition
              </span>
            ) : null}
          </div>

          {/* Top Right Wishlist & Quick View Controls */}
          <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 flex flex-col gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
              className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
                wished
                  ? 'bg-[#d6be96]/20 border-[#d6be96]/50 text-[#f2e6d5]'
                  : 'bg-[#050508]/90 border-white/10 text-white/75 hover:text-white hover:border-white/25'
              }`}
            >
              <Heart className={`w-4 h-4 ${wished ? 'fill-current' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => openQuickView(product)}
              aria-label={`Quick view ${product.name}`}
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#050508]/90 border border-white/10 text-white/80 hover:text-white hover:border-white/25 transition-colors lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Product Details & Direct Add */}
        <div className="p-3.5 sm:p-5 flex-1 flex flex-col justify-between gap-3 sm:gap-4">
          <div className="space-y-1 sm:space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[10.5px] sm:text-xs text-white/50">
              <span className="truncate">{product.concentration}</span>
              <span className="text-[#d6be96]/85 shrink-0 hidden min-[420px]:inline">
                {product.family}
              </span>
            </div>

            <Link
              to={`/product/${product.slug}`}
              className="block group-hover:text-[#f2e6d5] transition-colors"
            >
              <h3 className="font-serif-display text-lg sm:text-2xl font-medium text-white leading-snug line-clamp-1">
                {product.name}
              </h3>
            </Link>

            <p className="text-[11px] sm:text-xs text-white/55 line-clamp-2 leading-relaxed">
              {product.keyNotesSummary}
            </p>
          </div>

          <div className="pt-2.5 sm:pt-3 border-t border-white/[0.06] flex flex-col min-[460px]:flex-row min-[460px]:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex min-[460px]:block items-baseline justify-between gap-1.5">
              <span className="font-mono-tabular text-xs sm:text-sm font-medium text-white">
                {formatPKR(defaultSize.price)}
              </span>
              <span className="text-[10.5px] sm:text-[11px] text-white/40 min-[460px]:ml-1.5">
                / {defaultSize.label}
              </span>
            </div>

            <button
              type="button"
              disabled={!inStock}
              onClick={() => addToCart(product, 0, 1, true)}
              className={`w-full min-[460px]:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] sm:text-xs font-medium tracking-wide transition-colors cursor-pointer whitespace-nowrap ${
                inStock
                  ? 'bg-white/[0.07] hover:bg-[#f2e6d5] text-white hover:text-[#050508] border border-white/10 hover:border-transparent'
                  : 'bg-white/[0.03] text-white/35 border border-white/[0.06] cursor-not-allowed'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span>{inStock ? 'Add to Bag' : 'Out of Stock'}</span>
            </button>
          </div>
        </div>
      </article>
    );
  },
);
ProductCardInner.displayName = 'ProductCardInner';

/**
 * Memoized Luxury Product Card — subscribes ONLY to its own wishlist boolean
 */
export const ProductCard: React.FC<{
  product: CatalogProduct | HydratedCatalogProduct;
  index?: number;
}> = React.memo(({ product, index = 0 }) => {
  const wishlistSet = useWishlistSet();
  const wished = wishlistSet.has(product.id);
  return <ProductCardInner product={product} index={index} wished={wished} />;
});
ProductCard.displayName = 'ProductCard';

/**
 * Isolated leaf ToastNotification — re-renders ONLY when toastMessage changes
 */
export const ToastNotification: React.FC = React.memo(() => {
  const toastMessage = useToastMessage();
  if (!toastMessage) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 sm:bottom-6 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#13131d] border border-[#d6be96]/40 text-white text-xs font-medium flex items-center justify-center sm:justify-start gap-2 max-w-md mx-auto norva-fade-in"
    >
      <Check className="w-3.5 h-3.5 text-[#d6be96] shrink-0" />
      <span className="truncate">{toastMessage}</span>
    </div>
  );
});
ToastNotification.displayName = 'ToastNotification';
