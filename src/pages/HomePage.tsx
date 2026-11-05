import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ShoppingBag, Sparkles, Star } from 'lucide-react';
import { formatPKR } from '../data/products';
import { useCatalogActions, useOverlayState, useStore } from '../context/StoreContext';
import { ThreeBottleStage } from '../components/ThreeBottleStage';
import {
  LuxuryImage,
  MagneticWrap,
  PERFUME_CARD_SHADOW_BY_PRESET,
  ProductCard,
  SEOHead,
} from '../components/LuxuryUI';
import type { EssencePresetId } from '../webgl/bottleTypes';

const HERO_PERFUME_ATMOS_BY_PRESET: Record<EssencePresetId, string> = {
  amber: 'bg-[radial-gradient(circle_at_70%_45%,rgba(238,144,42,0.14),transparent_65%)]',
  cobalt: 'bg-[radial-gradient(circle_at_70%_45%,rgba(42,168,236,0.14),transparent_65%)]',
  noir: 'bg-[radial-gradient(circle_at_70%_45%,rgba(164,180,224,0.12),transparent_65%)]',
  champagne: 'bg-[radial-gradient(circle_at_70%_45%,rgba(248,186,62,0.14),transparent_65%)]',
  obsidian: 'bg-[radial-gradient(circle_at_70%_45%,rgba(184,116,252,0.14),transparent_65%)]',
  violet: 'bg-[radial-gradient(circle_at_70%_45%,rgba(174,116,246,0.14),transparent_65%)]',
  emerald: 'bg-[radial-gradient(circle_at_70%_45%,rgba(54,196,174,0.14),transparent_65%)]',
};

const TESTIMONIALS = [
  {
    quote:
      'Khamrah Qawa wears like tailored midnight velvet. Twelve hours after a single spray on my blazer, the smoked oud and dark Arabica still draw compliments everywhere.',
    author: 'Zain Raza',
    location: 'Lahore',
    creation: '01 · Khamrah Qawa Extrait',
    shadowClass: 'perfume-shadow-amber',
  },
  {
    quote:
      'Most fresh compositions vanish by noon. 9mM Rebel captures cold sea spray and dry cedarwood with an architectural permanence that easily lasts the entire day.',
    author: 'Hamza Malik',
    location: 'Karachi',
    creation: '03 · 9mM Rebel Eau de Parfum',
    shadowClass: 'perfume-shadow-noir',
  },
  {
    quote:
      'From the hand-beveled smoked silica flacon to the luminous iris dry-down of Gucci Flora, NORVA feels like an international niche perfumery at an incredible value.',
    author: 'Maham Siddiqui',
    location: 'Islamabad',
    creation: '05 · Gucci Flora Eau de Parfum',
    shadowClass: 'perfume-shadow-obsidian',
  },
];

export const HomePage: React.FC = () => {
  const { products } = useStore();
  const { addToCart, addSubscriber, showToast } = useCatalogActions();
  const { isCartOpen, isSearchOpen, quickViewProduct } = useOverlayState();

  const signatureFragrances = products;

  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const activeHeroProduct = signatureFragrances[activeHeroIndex] ?? signatureFragrances[0];
  const stagePaused = isCartOpen || isSearchOpen || Boolean(quickViewProduct);

  const [highlightTab, setHighlightTab] = useState<'bestsellers' | 'new'>('bestsellers');
  const highlightedProducts = useMemo(() => {
    if (highlightTab === 'bestsellers') {
      return signatureFragrances.filter((p) => p.isBestSeller);
    }
    return signatureFragrances.filter((p) => p.isNewArrival);
  }, [highlightTab, signatureFragrances]);

  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim() || !newsletterEmail.includes('@')) return;
    addSubscriber(newsletterEmail);
    setNewsletterSubscribed(true);
    showToast('Welcome to NORVA. Private privilege code NORVA15 unlocked.');
    setNewsletterEmail('');
  };

  const activePreset = activeHeroProduct?.bottle3D.preset ?? 'amber';
  const heroAtmosphere =
    HERO_PERFUME_ATMOS_BY_PRESET[activePreset] ?? HERO_PERFUME_ATMOS_BY_PRESET.amber;
  const heroCardAura =
    PERFUME_CARD_SHADOW_BY_PRESET[activePreset] ?? PERFUME_CARD_SHADOW_BY_PRESET.amber;

  return (
    <div className="bg-transparent text-[#f5f3ef]">
      <SEOHead
        title="Scent is an Art. Make It Yours"
        description="NORVA Haute Parfumerie — Five signature luxury fragrances in bespoke 3D 50ml smoked-glass flacons, each PKR 2,500."
      />

      {/* =====================================================================
          1. CINEMATIC INTERACTIVE 3D HERO SECTION (OBSIDIAN BLACK + PERFUMED MIST)
         ===================================================================== */}
      <section className="relative overflow-hidden border-b border-white/[0.08] bg-[#050508]">
        {/* Dynamic scent-matched perfumed studio mist gradient */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${heroAtmosphere}`}
        />

        <div className="relative max-w-[1380px] mx-auto px-3.5 sm:px-8 pt-5 pb-10 sm:pt-8 sm:pb-16 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-8 items-center lg:min-h-[calc(100vh-4rem)]">
          {/* Left Typography & Fragrance Selector Column */}
          <div className="lg:col-span-6 space-y-5 sm:space-y-8 z-10 min-w-0">
            <div className="space-y-3.5 sm:space-y-5">
              <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] sm:tracking-[0.22em] text-[#d6be96]">
                NORVA · Haute Parfumerie
              </p>

              <h1 className="font-serif-display text-[34px] min-[375px]:text-[40px] sm:text-6xl xl:text-[72px] font-medium tracking-[-0.02em] leading-[1.03] sm:leading-[0.98] text-white">
                Scent is an Art.
                <span className="block italic text-[#d6be96] mt-1">Make It Yours.</span>
              </h1>

              <p className="text-sm sm:text-[17px] text-white/65 max-w-[54ch] leading-relaxed">
                Five signature 50ml extraits housed in thick, hand-beveled smoked optical silica.
                Select any signature creation below to explore its olfactory profile.
              </p>
            </div>

            {/* Primary CTA Buttons */}
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-4">
              <MagneticWrap className="w-full sm:w-auto">
                <Link
                  to="/shop"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 sm:gap-2.5 h-11 sm:h-12 px-4 sm:px-7 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-[11px] sm:text-xs font-semibold uppercase tracking-[0.11em] sm:tracking-[0.14em] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Shop Now · {formatPKR(activeHeroProduct?.sizes[0].price ?? 2500)}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
              </MagneticWrap>

              <MagneticWrap className="w-full sm:w-auto">
                <Link
                  to="/collections/signature"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 sm:gap-2.5 h-11 sm:h-12 px-4 sm:px-7 rounded-lg bg-[#0c0c13] hover:bg-[#151520] border border-white/15 hover:border-[#d6be96]/40 text-white text-[11px] sm:text-xs font-medium uppercase tracking-[0.11em] sm:tracking-[0.14em] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Explore Collection</span>
                </Link>
              </MagneticWrap>
            </div>

            {/* Live Flacon Switcher for the 5 Signature Fragrances */}
            {activeHeroProduct && (
              <div className="pt-3.5 sm:pt-4 border-t border-white/[0.08] space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  <span className="text-[10.5px] sm:text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.18em] text-white/45 truncate">
                    Select Signature Flacon
                  </span>
                  <span className="font-mono-tabular text-[11.5px] sm:text-xs text-[#d6be96] shrink-0">
                    Edition {activeHeroProduct.numberCode} / 05
                  </span>
                </div>

                {/* Clean selector tabs */}
                <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-2 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
                  {signatureFragrances.map((frag, idx) => {
                    const active = idx === activeHeroIndex;
                    return (
                      <button
                        key={frag.id}
                        type="button"
                        onClick={() => setActiveHeroIndex(idx)}
                        className={`min-h-[40px] sm:min-h-0 px-3 sm:px-3.5 py-2 rounded-lg text-[11.5px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#12121b] text-white border border-[#d6be96]/70'
                            : 'bg-[#09090e] text-white/60 border border-white/10 hover:text-white hover:border-white/25'
                        }`}
                      >
                        <span className="font-mono-tabular text-[11px] opacity-60 mr-1.5">
                          {frag.numberCode}
                        </span>
                        {frag.name}
                      </button>
                    );
                  })}
                </div>

                {/* Active Flacon Live Brief */}
                <div
                  key={activeHeroProduct.id}
                  className={`relative overflow-hidden p-3.5 sm:p-4 rounded-xl bg-[#0a0a10] border border-white/12 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 ${heroCardAura.shadowClass}`}
                >
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-0 opacity-80 ${heroCardAura.ambientGlow}`}
                  />
                  <div className="relative z-[1] space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11.5px] sm:text-xs text-white/50">
                      <span>{activeHeroProduct.concentration}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeHeroProduct.sizes[0].label}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeHeroProduct.family}</span>
                    </div>
                    <Link
                      to={`/product/${activeHeroProduct.slug}`}
                      className="font-serif-display text-xl sm:text-2xl text-white hover:text-[#d6be96] transition-colors block truncate"
                    >
                      {activeHeroProduct.name}
                    </Link>
                    <p className="text-xs text-white/55">{activeHeroProduct.keyNotesSummary}</p>
                  </div>

                  <div className="relative z-[1] flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto pt-1 sm:pt-0 shrink-0">
                    <button
                      type="button"
                      onClick={() => addToCart(activeHeroProduct, 0, 1, true)}
                      className="min-h-[42px] sm:h-10 px-3.5 sm:px-4 rounded-lg bg-[#14141f] hover:bg-[#d6be96] border border-[#d6be96]/30 text-white hover:text-[#050508] text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono-tabular">
                        {formatPKR(activeHeroProduct.sizes[0].price)}
                      </span>
                      <span>· Add</span>
                    </button>

                    <Link
                      to={`/product/${activeHeroProduct.slug}`}
                      className="min-h-[40px] sm:min-h-0 inline-flex items-center px-1 text-xs font-medium text-[#d6be96] hover:underline whitespace-nowrap"
                    >
                      Details →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Interactive 3D Smoked-Glass Perfume Bottle (Static WebP/JPEG studio image on Windows 7 & weak PCs) */}
          <div className="lg:col-span-6 min-w-0">
            {activeHeroProduct && (
              <ThreeBottleStage
                label={activeHeroProduct.bottle3D.label}
                preset={activeHeroProduct.bottle3D.preset}
                fallbackImage={activeHeroProduct.primaryImage}
                paused={stagePaused}
                priorityImage
                interactiveControls
                className="w-full h-[340px] min-[390px]:h-[380px] sm:h-[580px] lg:h-[670px] rounded-2xl border border-white/[0.08]"
              />
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. OUR SIGNATURE FIVE COLLECTION
         ===================================================================== */}
      <section className="py-12 sm:py-20 lg:py-24 border-b border-white/[0.06] cv-auto">
        <div className="max-w-[1380px] mx-auto px-3.5 sm:px-8 space-y-8 sm:space-y-14">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
            <div className="space-y-2.5 sm:space-y-3 max-w-2xl">
              <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
                Our Signature Collection
              </p>
              <h2 className="font-serif-display text-3xl min-[375px]:text-[34px] sm:text-5xl font-medium text-white leading-[1.06]">
                Five Olfactory Sculptures
              </h2>
              <p className="text-sm sm:text-base text-white/60 leading-relaxed">
                Each 50ml creation in the NORVA Signature Wardrobe balances rare natural absolutes
                with modern molecular clarity—crafted for extraordinary longevity.
              </p>
            </div>

            <Link
              to="/shop"
              className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-white hover:text-[#d6be96] transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
            >
              <span>Shop All Five</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6 lg:gap-7">
            {signatureFragrances.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. BEST SELLERS & NEW ARRIVALS CURATION
         ===================================================================== */}
      <section className="relative py-12 sm:py-20 lg:py-24 bg-[#07070b] border-b border-white/[0.07] overflow-hidden cv-auto">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_50%_at_50%_0%,rgba(214,190,150,0.07),transparent_72%)]"
        />
        <div className="relative max-w-[1380px] mx-auto px-3.5 sm:px-8 space-y-8 sm:space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
            <div className="space-y-1.5 sm:space-y-2">
              <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
                Curated Acclaim
              </p>
              <h2 className="font-serif-display text-3xl min-[375px]:text-[34px] sm:text-5xl text-white">
                Best Sellers &amp; New Arrivals
              </h2>
            </div>

            {/* Clean Segmented Toggle */}
            <div className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex p-1 rounded-lg bg-[#0c0c12] border border-white/12 self-start">
              <button
                type="button"
                onClick={() => setHighlightTab('bestsellers')}
                className={`min-h-[40px] sm:min-h-0 px-3 sm:px-4 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap text-center ${
                  highlightTab === 'bestsellers'
                    ? 'bg-[#f2e6d5] text-[#050508]'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Best Sellers
              </button>
              <button
                type="button"
                onClick={() => setHighlightTab('new')}
                className={`min-h-[40px] sm:min-h-0 px-3 sm:px-4 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap text-center ${
                  highlightTab === 'new'
                    ? 'bg-[#f2e6d5] text-[#050508]'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                New Arrivals
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-6 lg:gap-7">
            {highlightedProducts.map((product, idx) => (
              <ProductCard key={product.id} product={product} index={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. COLLECTOR TESTIMONIALS
         ===================================================================== */}
      <section className="py-12 sm:py-20 lg:py-24 border-b border-white/[0.06] cv-auto">
        <div className="max-w-[1380px] mx-auto px-3.5 sm:px-8 space-y-8 sm:space-y-12">
          <div className="space-y-1.5 sm:space-y-2 max-w-xl">
            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
              Verified Collectors
            </p>
            <h2 className="font-serif-display text-3xl min-[375px]:text-[34px] sm:text-5xl text-white">
              Impressions on Skin
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-7">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.author}
                className={`p-5 sm:p-7 rounded-xl bg-[#0a0a0f] border border-white/[0.08] flex flex-col justify-between gap-4 sm:gap-6 smooth-lift hover:-translate-y-0.5 ${t.shadowClass}`}
              >
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-1 text-[#d6be96]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#d6be96]" />
                    ))}
                  </div>
                  <p className="font-serif-display text-lg sm:text-2xl text-white/90 leading-snug">
                    “{t.quote}”
                  </p>
                </div>

                <div className="pt-3.5 sm:pt-4 border-t border-white/[0.06] space-y-1">
                  <p className="text-xs font-semibold text-white">{t.author}</p>
                  <p className="text-[11.5px] text-white/45">
                    {t.location} · {t.creation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. VISUAL JOURNAL / GALLERY & PRIVATE NEWSLETTER
         ===================================================================== */}
      <section className="py-12 sm:py-20 lg:py-24 cv-auto">
        <div className="max-w-[1380px] mx-auto px-3.5 sm:px-8 space-y-12 sm:space-y-20">
          {/* Atelier Social Gallery */}
          <div className="space-y-5 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
              <div>
                <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-white/45">
                  @norva.parfums
                </p>
                <h2 className="font-serif-display text-2xl min-[375px]:text-3xl sm:text-4xl text-white mt-1">
                  Inside the Smoked-Glass Collection
                </h2>
              </div>
              <Link
                to="/shop"
                className="min-h-[38px] sm:min-h-0 inline-flex items-center text-xs font-medium text-[#d6be96] hover:underline whitespace-nowrap self-start sm:self-auto"
              >
                Shop All 5 Fragrances →
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
              {signatureFragrances.map((frag) => {
                const aura =
                  PERFUME_CARD_SHADOW_BY_PRESET[frag.bottle3D.preset] ??
                  PERFUME_CARD_SHADOW_BY_PRESET.amber;
                return (
                  <Link
                    key={frag.id}
                    to={`/product/${frag.slug}`}
                    className={`group relative aspect-square rounded-xl overflow-hidden bg-[#08080c] border border-white/[0.08] smooth-lift hover:-translate-y-1 ${aura.shadowClass}`}
                  >
                    <LuxuryImage
                      src={frag.primaryImage}
                      alt={frag.name}
                      className="w-full h-full object-contain lg:object-cover p-1.5 lg:p-0 transition-transform duration-500 lg:group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#030305]/92 via-transparent to-transparent opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-end p-2.5 sm:p-4">
                      <span className="text-[11px] sm:text-xs font-medium text-white truncate">
                        {frag.numberCode} · {frag.name} →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Private Client List / Newsletter */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#09090f] via-[#10101a] to-[#08080d] border border-white/12 p-5 sm:p-12 lg:p-16 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center perfume-ambient-panel">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_80%_at_85%_50%,rgba(214,190,150,0.11),rgba(138,92,226,0.06)_50%,transparent_78%)]"
            />
            <div className="relative z-[1] lg:col-span-7 space-y-2.5 sm:space-y-3">
              <div className="flex items-center gap-2 text-[11px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[#d6be96]">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>NORVA Private Registry</span>
              </div>
              <h2 className="font-serif-display text-2xl min-[375px]:text-3xl sm:text-4xl text-white leading-tight">
                Receive Early Batch Access &amp; 15% Welcome Privilege
              </h2>
              <p className="text-xs sm:text-sm text-white/60 max-w-xl leading-relaxed">
                Join the NORVA Private Client List for numbered batch dispatches and unlock 15% off
                your first order.
              </p>
            </div>

            <div className="relative z-[1] lg:col-span-5">
              {newsletterSubscribed ? (
                <div className="p-4 sm:p-5 rounded-xl bg-[#36d67e]/10 border border-[#36d67e]/35 flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#36d67e] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">
                      You are registered on the NORVA Client List.
                    </p>
                    <p className="text-xs text-white/65">
                      Apply code{' '}
                      <span className="font-mono-tabular text-[#36d67e] font-semibold">
                        NORVA15
                      </span>{' '}
                      at checkout for 15% off.
                    </p>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleNewsletterSubmit}
                  className="flex flex-col sm:flex-row gap-2.5 sm:gap-3"
                >
                  <input
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email address"
                    aria-label="Email address"
                    className="flex-1 h-12 px-4 rounded-lg bg-[#050508] border border-white/15 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#d6be96]"
                  />
                  <button
                    type="submit"
                    className="w-full sm:w-auto h-11 sm:h-12 px-6 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Join Registry
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
