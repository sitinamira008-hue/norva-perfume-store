import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Droplets, Gem, ShieldCheck, ShoppingBag, Sparkles, Star, Truck } from 'lucide-react';
import { formatPKR } from '../data/products';
import { useCatalogActions, useOverlayState, useStore } from '../context/StoreContext';
import { ThreeBottleStage } from '../components/ThreeBottleStage';
import {
  MagneticWrap,
  ProductCard,
  SEOHead,
} from '../components/LuxuryUI';
import { WHATSAPP_DISPLAY, getStoreWhatsAppChatUrl, WhatsAppIcon } from '../components/WhatsAppFloatingButton';

const TESTIMONIALS = [
  {
    quote:
      'Khamrah Qawa wears like tailored midnight velvet. Twelve hours after a single spray on my blazer, the smoked oud and dark Arabica still draw compliments everywhere.',
    author: 'Zain Raza',
    location: 'Lahore',
    creation: '01 · Khamrah Qawa Extrait',
  },
  {
    quote:
      'Most fresh compositions vanish by noon. 9mM Rebel captures cold sea spray and dry cedarwood with an architectural permanence that easily lasts the entire day.',
    author: 'Hamza Malik',
    location: 'Karachi',
    creation: '03 · 9mM Rebel Eau de Parfum',
  },
  {
    quote:
      'From the hand-beveled smoked silica flacon to the luminous iris dry-down of Gucci Flora, NORVA feels like an international niche perfumery at an incredible value.',
    author: 'Maham Siddiqui',
    location: 'Islamabad',
    creation: '05 · Gucci Flora Eau de Parfum',
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

  return (
    <div className="bg-transparent text-[#f5f3ef]">
      <SEOHead
        title="Scent is an Art. Make It Yours"
        description="NORVA Haute Parfumerie — Five signature luxury fragrances in bespoke 3D 50ml smoked-glass flacons, each PKR 2,500."
      />

      {/* =====================================================================
          1. HERO SECTION WITH CLEAN 3D TURNTABLE BOTTLE
         ===================================================================== */}
      <section className="relative overflow-hidden border-b border-white/[0.08] bg-[#050508]">
        {/* Subtle, warm champagne-gold ambient atmosphere */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_75%_40%,rgba(214,190,150,0.09),transparent_70%)]"
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
                Explore each olfactory sculpture in real-time 3D below.
              </p>
            </div>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-4">
              <MagneticWrap className="w-full sm:w-auto">
                <Link
                  to="/shop"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 sm:gap-2.5 h-11 sm:h-12 px-4 sm:px-7 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-[11px] sm:text-xs font-semibold uppercase tracking-[0.11em] sm:tracking-[0.14em] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Shop Collection · {formatPKR(activeHeroProduct?.sizes[0]?.price ?? 2500)}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
              </MagneticWrap>

              <a
                href={getStoreWhatsAppChatUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-4 sm:px-6 rounded-lg bg-[#0c0c13] hover:bg-[#151520] border border-white/15 hover:border-[#25D366]/60 text-white text-[11px] sm:text-xs font-medium uppercase tracking-[0.11em] sm:tracking-[0.14em] transition-colors whitespace-nowrap shrink-0"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                <span>Order on WhatsApp</span>
              </a>
            </div>

            {/* Live Flacon Switcher for the 5 Signature Fragrances */}
            {activeHeroProduct && (
              <div className="pt-3.5 sm:pt-4 border-t border-white/[0.08] space-y-3 sm:space-y-3.5">
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  <span className="text-[10.5px] sm:text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.18em] text-white/45 truncate">
                    Select Flacon to Inspect
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
                            ? 'bg-[#141420] text-white border border-[#d6be96]'
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

                {/* Active Flacon Info Strip */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-[#09090e] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <span>{activeHeroProduct.concentration}</span>
                      <span>·</span>
                      <span>50ml Extrait</span>
                      <span>·</span>
                      <span className="text-[#d6be96] font-medium">{formatPKR(activeHeroProduct.sizes[0]?.price ?? 2500)}</span>
                    </div>
                    <Link
                      to={`/product/${activeHeroProduct.slug}`}
                      className="font-serif-display text-xl sm:text-2xl text-white hover:text-[#d6be96] transition-colors block truncate"
                    >
                      {activeHeroProduct.name}
                    </Link>
                    <p className="text-xs text-white/55 truncate">{activeHeroProduct.keyNotesSummary}</p>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => addToCart(activeHeroProduct, 0, 1, true)}
                      className="h-10 px-4 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                      <span>Add to Bag</span>
                    </button>

                    <Link
                      to={`/product/${activeHeroProduct.slug}`}
                      className="h-10 px-3 rounded-lg border border-white/15 hover:border-white/30 text-white/80 hover:text-white text-xs font-medium flex items-center transition-colors whitespace-nowrap"
                    >
                      Details →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Clean 3D Bottle Turntable */}
          <div className="lg:col-span-6 min-w-0">
            {activeHeroProduct && (
              <ThreeBottleStage
                label={activeHeroProduct.bottle3D.label}
                preset={activeHeroProduct.bottle3D.preset}
                fallbackImage={activeHeroProduct.primaryImage}
                paused={stagePaused}
                priorityImage
                interactiveControls
                autoSpin
                className="w-full h-[360px] min-[390px]:h-[400px] sm:h-[580px] lg:h-[650px] rounded-2xl border border-white/[0.08]"
              />
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. THE FIVE SIGNATURE FRAGRANCES (PRIMARY CATALOG)
         ===================================================================== */}
      <section className="py-12 sm:py-20 lg:py-24 border-b border-white/[0.06] cv-auto">
        <div className="max-w-[1380px] mx-auto px-3.5 sm:px-8 space-y-8 sm:space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
            <div className="space-y-2 max-w-2xl">
              <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
                Our Permanent Collection
              </p>
              <h2 className="font-serif-display text-3xl min-[375px]:text-[34px] sm:text-5xl font-medium text-white leading-tight">
                Five Signature Sculptures
              </h2>
              <p className="text-sm sm:text-base text-white/60 leading-relaxed">
                Hand-formulated with rare botanical absolutes and high perfume oil concentrations for remarkable sillage and all-day longevity.
              </p>
            </div>

            <Link
              to="/shop"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#d6be96] hover:text-white transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
            >
              <span>View Full Details</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-7">
            {signatureFragrances.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. THE NORVA CRAFTSMANSHIP & VALUE STANDARD
         ===================================================================== */}
      <section className="py-12 sm:py-16 border-b border-white/[0.06] bg-[#07070b]">
        <div className="max-w-[1380px] mx-auto px-3.5 sm:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="p-6 rounded-xl bg-[#09090e] border border-white/[0.08] space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#d6be96]/10 border border-[#d6be96]/20 flex items-center justify-center text-[#d6be96]">
                <Droplets className="w-5 h-5" />
              </div>
              <h3 className="font-serif-display text-lg sm:text-xl text-white">35% Extrait de Parfum</h3>
              <p className="text-xs sm:text-sm text-white/55 leading-relaxed">
                Unlike mass-market eau de toilettes that evaporate in hours, NORVA extraits are steeped for full, rich projection that lingers for 12+ hours.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#09090e] border border-white/[0.08] space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#d6be96]/10 border border-[#d6be96]/20 flex items-center justify-center text-[#d6be96]">
                <Gem className="w-5 h-5" />
              </div>
              <h3 className="font-serif-display text-lg sm:text-xl text-white">Smoked Optical Silica</h3>
              <p className="text-xs sm:text-sm text-white/55 leading-relaxed">
                Each flacon is molded in heavy, light-shielding smoked silica crystal with custom gold-finished atomizer collars to protect precious oils.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#09090e] border border-white/[0.08] space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#d6be96]/10 border border-[#d6be96]/20 flex items-center justify-center text-[#d6be96]">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="font-serif-display text-lg sm:text-xl text-white">Flat PKR 2,500 &amp; COD</h3>
              <p className="text-xs sm:text-sm text-white/55 leading-relaxed">
                Direct-to-client pricing with no department store markups. Cash on Delivery supported across all cities in Pakistan with swift dispatch.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. VERIFIED COLLECTOR TESTIMONIALS
         ===================================================================== */}
      <section className="py-12 sm:py-20 lg:py-24 border-b border-white/[0.06] cv-auto">
        <div className="max-w-[1380px] mx-auto px-3.5 sm:px-8 space-y-8 sm:space-y-12">
          <div className="space-y-1.5 sm:space-y-2 max-w-xl">
            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
              Verified Feedback
            </p>
            <h2 className="font-serif-display text-3xl min-[375px]:text-[34px] sm:text-5xl text-white">
              Impressions on Skin
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-7">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.author}
                className="p-5 sm:p-7 rounded-xl bg-[#0a0a0f] border border-white/[0.08] flex flex-col justify-between gap-4 sm:gap-6"
              >
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-1 text-[#d6be96]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#d6be96]" />
                    ))}
                  </div>
                  <p className="font-serif-display text-base sm:text-xl text-white/90 leading-snug">
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
          5. PRIVATE CLIENT LIST & 15% PRIVILEGE
         ===================================================================== */}
      <section className="py-12 sm:py-20 cv-auto">
        <div className="max-w-[1380px] mx-auto px-3.5 sm:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#09090f] via-[#101018] to-[#08080d] border border-white/12 p-6 sm:p-12 lg:p-16 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
            <div className="relative z-[1] lg:col-span-7 space-y-2.5 sm:space-y-3">
              <div className="flex items-center gap-2 text-[11px] sm:text-xs uppercase tracking-[0.2em] text-[#d6be96]">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>NORVA Private Registry</span>
              </div>
              <h2 className="font-serif-display text-2xl min-[375px]:text-3xl sm:text-4xl text-white leading-tight">
                Receive Early Batch Access &amp; 15% Welcome Privilege
              </h2>
              <p className="text-xs sm:text-sm text-white/60 max-w-xl leading-relaxed">
                Join our private client registry for numbered release notices and unlock 15% off your order.
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
