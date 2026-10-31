import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Box,
  Check,
  Heart,
  Image as ImageIcon,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
} from 'lucide-react';
import { formatPKR } from '../data/products';
import { useStore } from '../context/StoreContext';
import { ThreeBottleStage } from '../components/ThreeBottleStage';
import {
  LuxuryImage,
  PERFUME_CARD_SHADOW_BY_PRESET,
  ProductCard,
  SEOHead,
} from '../components/LuxuryUI';
import {
  WHATSAPP_DISPLAY,
  WhatsAppIcon,
  buildProductWhatsAppUrl,
} from '../components/WhatsAppFloatingButton';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const {
    products,
    addToCart,
    toggleWishlist,
    isInWishlist,
    customReviews,
    addProductReview,
    isCartOpen,
    isSearchOpen,
    quickViewProduct,
  } = useStore();

  const normalizedSlug = slug === 'khamrah-qahwa' ? 'khamrah-qawa' : slug;
  const product = useMemo(
    () => products.find((p) => p.slug === normalizedSlug),
    [products, normalizedSlug],
  );

  const [sizeIdx, setSizeIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [viewMode, setViewMode] = useState<'photo' | '3d'>('photo');
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Review Form State
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewAuthor, setReviewAuthor] = useState('');
  const [reviewLocation, setReviewLocation] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    if (!product) return;
    setSizeIdx(0);
    setQuantity(1);
    setActivePhotoIdx(0);
    setViewMode('photo');
  }, [product?.id]);

  const allReviews = useMemo(() => {
    if (!product) return [];
    const extra = customReviews[product.id] ?? [];
    return [...extra, ...product.reviews];
  }, [product, customReviews]);

  const averageRating = useMemo(() => {
    if (allReviews.length === 0) return 5.0;
    const sum = allReviews.reduce((acc, r) => acc + r.rating, 0);
    return Number((sum / allReviews.length).toFixed(1));
  }, [allReviews]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return products.filter((p) => p.id !== product.id).slice(0, 3);
  }, [product, products]);

  if (!product) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center space-y-5">
        <SEOHead title="Fragrance Not Found" description="Explore the NORVA signature catalog." />
        <p className="text-xs uppercase tracking-[0.2em] text-[#d6be96]">404 · Archive</p>
        <h1 className="font-serif-display text-4xl sm:text-5xl text-white">
          This Flacon Could Not Be Located
        </h1>
        <p className="text-sm text-white/60 max-w-md">
          Explore NORVA’s five signature fragrances in our catalog.
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Catalog</span>
        </Link>
      </div>
    );
  }

  const selectedSize = product.sizes[sizeIdx] ?? product.sizes[0];
  const wished = isInWishlist(product.id);
  const currentGalleryItem = product.gallery[activePhotoIdx] ?? {
    src: product.primaryImage,
    caption: product.name,
  };

  const handleBuyNow = () => {
    addToCart(product, sizeIdx, quantity, false);
    navigate('/checkout');
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewAuthor.trim() || !reviewTitle.trim() || !reviewComment.trim()) return;
    addProductReview(product.id, {
      author: reviewAuthor.trim(),
      location: reviewLocation.trim() || 'Verified Buyer',
      rating: reviewRating,
      title: reviewTitle.trim(),
      comment: reviewComment.trim(),
    });
    setReviewAuthor('');
    setReviewLocation('');
    setReviewTitle('');
    setReviewComment('');
    setReviewRating(5);
    setReviewOpen(false);
  };

  const stagePaused = isCartOpen || isSearchOpen || Boolean(quickViewProduct);
  const stageAura =
    PERFUME_CARD_SHADOW_BY_PRESET[product.bottle3D.preset] ??
    PERFUME_CARD_SHADOW_BY_PRESET.amber;

  return (
    <div className="bg-transparent text-[#f5f3ef]">
      <SEOHead title={product.name} description={product.shortDescription} />

      {/* Breadcrumb Bar */}
      <div className="max-w-[1380px] mx-auto px-4 sm:px-8 pt-6 pb-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-white/45">
          <Link to="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-white transition-colors">
            Signature Fragrances
          </Link>
          <span>/</span>
          <span className="text-white/85 truncate">{product.name}</span>
        </nav>
      </div>

      {/* =====================================================================
          PRIMARY SPLIT STAGE: GALLERY / 3D INSPECTOR + PURCHASE MODULE
         ===================================================================== */}
      <section className="max-w-[1380px] mx-auto px-4 sm:px-8 pb-20 pt-2 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        {/* Left Visual Column (Sticky on Desktop) */}
        <div className="lg:col-span-7 lg:sticky lg:top-24 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="inline-flex p-1 rounded-lg bg-[#0b0b11] border border-white/12">
              <button
                type="button"
                onClick={() => setViewMode('photo')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'photo'
                    ? 'bg-[#f2e6d5] text-[#050508]'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>
                  Studio Photography
                  {product.gallery.length > 1 ? ` (${product.gallery.length})` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === '3d'
                    ? 'bg-[#f2e6d5] text-[#050508]'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>Interactive 3D Flacon</span>
              </button>
            </div>

            <span className="hidden sm:inline text-xs font-mono-tabular text-white/40">
              Edition {product.numberCode} / 05
            </span>
          </div>

          {/* Main Stage with Scent-Matched Perfumed Shadow */}
          {viewMode === '3d' ? (
            <div
              className={`rounded-2xl overflow-hidden bg-[#06060a] border border-white/12 ${stageAura.shadowClass}`}
            >
              <ThreeBottleStage
                label={{
                  ...product.bottle3D.label,
                  volume: selectedSize.label.toUpperCase(),
                }}
                preset={product.bottle3D.preset}
                fallbackImage={product.primaryImage}
                paused={stagePaused}
                className="w-full h-[460px] sm:h-[560px]"
              />
            </div>
          ) : (
            <div
              className={`relative rounded-2xl overflow-hidden bg-[#050508] border border-white/12 aspect-square sm:aspect-[4/3] flex items-center justify-center ${stageAura.shadowClass}`}
            >
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 opacity-90 ${stageAura.ambientGlow}`}
              />
              <LuxuryImage
                src={currentGalleryItem.src}
                alt={currentGalleryItem.caption}
                priority
                className="relative z-[1] w-full h-full object-contain"
              />
              <div className="absolute bottom-3 left-4 right-4 z-[2] flex items-center justify-between text-[11.5px] text-white/85 bg-[#09090e]/90 px-3 py-1.5 rounded-lg border border-white/12">
                <span>{currentGalleryItem.caption}</span>
                {product.gallery.length > 1 && (
                  <span className="font-mono-tabular">
                    {activePhotoIdx + 1} / {product.gallery.length}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Gallery Thumbnails (only shown if multiple studio photos exist) */}
          {product.gallery.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setViewMode('3d')}
                className={`h-20 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs transition-colors cursor-pointer ${
                  viewMode === '3d'
                    ? 'border-[#d6be96] bg-[#13131d] text-white'
                    : 'border-white/10 bg-[#0a0a0f] text-white/60 hover:text-white'
                }`}
              >
                <Box className="w-4 h-4 text-[#d6be96]" />
                <span>3D Glass</span>
              </button>

              {product.gallery.map((item, idx) => {
                const isSelected = viewMode === 'photo' && activePhotoIdx === idx;
                return (
                  <button
                    key={`${item.caption}-${idx}`}
                    type="button"
                    onClick={() => {
                      setViewMode('photo');
                      setActivePhotoIdx(idx);
                    }}
                    className={`h-20 rounded-xl overflow-hidden border bg-[#06060a] transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#d6be96] ring-1 ring-[#d6be96]/40'
                        : 'border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <LuxuryImage
                      src={item.src}
                      alt={item.caption}
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Contiguous Purchase & Specification Column */}
        <div className="lg:col-span-5 space-y-7">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-[#d6be96] tracking-[0.14em] uppercase">
              <span>{product.concentration}</span>
              <span aria-hidden="true">·</span>
              <span>{product.family}</span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <h1 className="font-serif-display text-4xl sm:text-5xl font-medium text-white leading-[1.04]">
                {product.name}
              </h1>
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
                className="w-11 h-11 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/12 flex items-center justify-center text-white/80 hover:text-[#d6be96] transition-colors shrink-0 cursor-pointer"
              >
                <Heart className={`w-4 h-4 ${wished ? 'fill-[#d6be96] text-[#d6be96]' : ''}`} />
              </button>
            </div>

            <p className="font-serif-display italic text-xl text-white/75">{product.subtitle}</p>

            {/* Rating & Price Row */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-[#d6be96]">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={`w-3.5 h-3.5 ${
                        idx < Math.round(averageRating) ? 'fill-[#d6be96]' : 'opacity-30'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-white/60">
                  {averageRating} ({allReviews.length}{' '}
                  {allReviews.length === 1 ? 'review' : 'reviews'})
                </span>
              </div>

              <div className="text-right">
                <span className="font-mono-tabular text-2xl font-semibold text-white">
                  {formatPKR(selectedSize.price * quantity)}
                </span>
                {quantity > 1 && (
                  <span className="block text-[11px] font-mono-tabular text-white/45">
                    {formatPKR(selectedSize.price)} each
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm sm:text-[15px] text-white/68 leading-relaxed">
            {product.shortDescription}
          </p>

          {/* Bottle Size Format */}
          <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
            <div className="flex items-center justify-between text-xs">
              <span className="uppercase tracking-[0.15em] text-white/55">Flacon Size</span>
              <span className="font-mono-tabular text-white/45">SKU: {selectedSize.sku}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {product.sizes.map((sz, idx) => {
                const active = idx === sizeIdx;
                return (
                  <button
                    key={sz.sku}
                    type="button"
                    onClick={() => setSizeIdx(idx)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      active
                        ? 'bg-[#12121b] border-[#d6be96] text-white shadow-[0_10px_28px_-8px_rgba(214,190,150,0.25)]'
                        : 'bg-[#0a0a0f] border-white/10 text-white/65 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-medium">{sz.label} Smoked Glass Flacon</span>
                    <span className="font-mono-tabular text-sm font-semibold text-[#d6be96]">
                      {formatPKR(sz.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity + Add to Cart + Buy Now */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-3">
              {/* Quantity Stepper */}
              <div className="h-12 px-2 rounded-lg bg-[#0b0b11] border border-white/15 flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="p-1.5 text-white/65 hover:text-white cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono-tabular text-sm text-white w-5 text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label="Increase quantity"
                  className="p-1.5 text-white/65 hover:text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add to Bag */}
              <button
                type="button"
                onClick={() => addToCart(product, sizeIdx, quantity, true)}
                className="flex-1 h-12 px-6 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add to Bag</span>
              </button>
            </div>

            {/* Express Buy Now */}
            <button
              type="button"
              onClick={handleBuyNow}
              className="w-full h-12 px-6 rounded-lg bg-[#101018] hover:bg-[#d6be96] text-white hover:text-[#050508] border border-[#d6be96]/40 text-xs font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer"
            >
              Buy Now · {formatPKR(selectedSize.price * quantity)}
            </button>

            {/* Direct WhatsApp Order */}
            <a
              href={buildProductWhatsAppUrl(
                product.name,
                selectedSize.label,
                quantity,
                selectedSize.price,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-12 px-6 rounded-lg bg-[#0b1610] hover:bg-[#25D366] text-[#36d67e] hover:text-[#050508] border border-[#25D366]/40 text-xs font-semibold uppercase tracking-[0.12em] flex items-center justify-center gap-2.5 transition-colors"
            >
              <WhatsAppIcon className="w-4 h-4" />
              <span>Order on WhatsApp · {WHATSAPP_DISPLAY}</span>
            </a>
          </div>

          {/* Longevity & Projection Metrics */}
          <div className="p-5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/55">Longevity</span>
                <span className="text-white font-medium">{product.longevityLabel}</span>
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#d6be96]"
                  style={{ width: `${product.longevityScore}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/55">Projection &amp; Sillage</span>
                <span className="text-white font-medium">{product.projectionLabel}</span>
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#36d67e]"
                  style={{ width: `${product.projectionScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Boutique Guarantees */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs text-white/60">
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4 text-[#d6be96] shrink-0" />
              <span>Free courier over PKR 5,000</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#d6be96] shrink-0" />
              <span>Cash on Delivery nationwide</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#36d67e] shrink-0" />
              <span>High-concentration extrait oils</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-[#36d67e] shrink-0" />
              <span>NORVA obsidian gift box</span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          OLFACTORY NOTES PYRAMID & EDITORIAL COMPOSITION
         ===================================================================== */}
      <section className="py-20 bg-[#07070b] border-y border-white/[0.08] cv-auto">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-8 space-y-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
                Olfactory Architecture
              </p>
              <h2 className="font-serif-display text-4xl text-white leading-tight">
                The Fragrance Pyramid
              </h2>
              <p className="text-sm sm:text-base text-white/65 leading-relaxed">
                {product.editorialStory}
              </p>
            </div>

            {/* 3-Tier Architectural Notes Pyramid */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div
                className={`p-6 rounded-xl bg-[#0b0b11] border border-white/10 space-y-4 ${stageAura.shadowClass}`}
              >
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#d6be96]">
                  01 · Top Notes
                </span>
                <p className="text-xs text-white/45">First impression (0 – 20 mins)</p>
                <ul className="space-y-2 pt-2 border-t border-white/[0.06]">
                  {product.pyramid.top.map((note) => (
                    <li key={note} className="font-serif-display text-xl text-white">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className={`p-6 rounded-xl bg-[#0b0b11] border border-white/10 space-y-4 ${stageAura.shadowClass}`}
              >
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#36d67e]">
                  02 · Heart Notes
                </span>
                <p className="text-xs text-white/45">Core evolution (20 mins – 4 hrs)</p>
                <ul className="space-y-2 pt-2 border-t border-white/[0.06]">
                  {product.pyramid.heart.map((note) => (
                    <li key={note} className="font-serif-display text-xl text-white">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className={`p-6 rounded-xl bg-[#0b0b11] border border-white/10 space-y-4 ${stageAura.shadowClass}`}
              >
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#e5c287]">
                  03 · Base Notes
                </span>
                <p className="text-xs text-white/45">Enduring foundation (4 – 14+ hrs)</p>
                <ul className="space-y-2 pt-2 border-t border-white/[0.06]">
                  {product.pyramid.base.map((note) => (
                    <li key={note} className="font-serif-display text-xl text-white">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          CUSTOMER REVIEWS & IMPRESSIONS
         ===================================================================== */}
      <section className="py-20 border-b border-white/[0.08] cv-auto">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-8 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
                Verified Wearers
              </p>
              <h2 className="font-serif-display text-3xl sm:text-4xl text-white">
                Client Reviews ({allReviews.length})
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setReviewOpen((v) => !v)}
              className="h-10 px-5 rounded-lg bg-[#0d0d14] hover:bg-[#161622] border border-white/15 text-xs font-medium text-white transition-colors cursor-pointer self-start"
            >
              {reviewOpen ? 'Cancel Review' : 'Write a Review'}
            </button>
          </div>

          {reviewOpen && (
            <form
              onSubmit={handleSubmitReview}
              className="p-6 sm:p-8 rounded-xl bg-[#0a0a0f] border border-white/12 space-y-5 max-w-2xl perfume-ambient-panel"
            >
              <h3 className="font-serif-display text-2xl text-white">
                Share Your Olfactory Impression
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/60 mb-1.5">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={reviewAuthor}
                    onChange={(e) => setReviewAuthor(e.target.value)}
                    placeholder="e.g., Bilal Ahmed"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1.5">City</label>
                  <input
                    type="text"
                    value={reviewLocation}
                    onChange={(e) => setReviewLocation(e.target.value)}
                    placeholder="e.g., Karachi / Lahore"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs text-white/60 mb-1.5">Headline *</label>
                  <input
                    type="text"
                    required
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="Sum up the scent trail"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                  />
                </div>
                <div>
                  <span className="block text-xs text-white/60 mb-1.5">Rating</span>
                  <div className="flex items-center gap-1.5 h-11">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="p-1 cursor-pointer"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= reviewRating
                              ? 'text-[#d6be96] fill-[#d6be96]'
                              : 'text-white/25'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1.5">Your Review *</label>
                <textarea
                  rows={3}
                  required
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Describe how the top, heart, and base notes unfold..."
                  className="w-full p-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                />
              </div>

              <button
                type="submit"
                className="h-11 px-6 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer"
              >
                Publish Review
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {allReviews.map((rev) => (
              <div
                key={rev.id}
                className="p-6 rounded-xl bg-[#0a0a0f] border border-white/[0.08] space-y-3 perfume-ambient-panel"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[#d6be96]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-[#d6be96]' : 'opacity-25'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-white/40">{rev.date}</span>
                </div>

                <h3 className="font-serif-display text-2xl text-white">{rev.title}</h3>
                <p className="text-sm text-white/65 leading-relaxed">{rev.comment}</p>

                <p className="pt-2 text-xs text-white/45">
                  <span className="text-white/80 font-medium">{rev.author}</span> · {rev.location}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          RELATED SIGNATURE FRAGRANCES
         ===================================================================== */}
      <section className="py-20">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-8 space-y-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
                More From NORVA
              </p>
              <h2 className="font-serif-display text-3xl sm:text-4xl text-white mt-1">
                Explore Other Signature Fragrances
              </h2>
            </div>
            <Link to="/shop" className="text-xs font-medium text-white/70 hover:text-white">
              View All 5 →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            {relatedProducts.map((rel, idx) => (
              <ProductCard key={rel.id} product={rel} index={idx} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
