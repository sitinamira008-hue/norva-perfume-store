import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Check,
  Heart,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  User,
  X,
} from 'lucide-react';
import {
  useCatalogActions,
  useHeaderCounts,
  useOverlayState,
} from '../context/StoreContext';
import { WhatsAppIcon, getStoreWhatsAppChatUrl, NORVA_WHATSAPP_DISPLAY } from './WhatsAppFloatingButton';

export const Navbar: React.FC = React.memo(() => {
  const { cartCount, wishlistCount, unseenOrderCount, hasAdminSession } = useHeaderCounts();
  const { openCart, openSearch } = useOverlayState();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const nextScrolled = window.scrollY > 18;
        setScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { label: 'Shop All', to: '/shop' },
    { label: 'Best Sellers', to: '/collections/best-sellers' },
    { label: 'Oud & Woods', to: '/collections/oud-dark-woods' },
    { label: 'Track Order', to: '/track-order' },
    { label: 'Contact', to: '/contact' },
  ];

  return (
    <>
      {/* Subtle Top Complimentary Announcement Bar */}
      <div className="bg-[#0b0b11] border-b border-white/[0.06] text-[10.5px] sm:text-xs text-white/75 py-2 px-3 sm:px-4 text-center tracking-wide">
        <span className="text-[#d6be96] font-medium">Complimentary Nationwide Delivery</span> on
        orders above PKR 5,000 · Use code{' '}
        <span className="font-mono-tabular text-[#f2e6d5] font-semibold">NORVA10</span> for 10% off
      </div>

      <header
        className={`sticky top-0 z-40 transition-colors duration-200 ${
          scrolled
            ? 'bg-[#050508]/95 border-b border-white/[0.08]'
            : 'bg-[#050508]/90 border-b border-white/[0.04]'
        }`}
      >
        <div className="max-w-[1380px] mx-auto px-3.5 sm:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Mobile Drawer Trigger + Desktop Nav */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden w-10 h-10 -ml-2 rounded-lg flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-7">
              {navLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `text-[13px] tracking-[0.04em] transition-colors ${
                      isActive
                        ? 'text-[#f2e6d5] font-medium'
                        : 'text-white/70 hover:text-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Center: NORVA Wordmark */}
          <Link
            to="/"
            className="flex flex-col items-center justify-center text-center group"
            aria-label="NORVA Home"
          >
            <span className="font-serif-display text-2xl sm:text-[30px] font-medium tracking-[0.24em] text-white group-hover:text-[#f2e6d5] transition-colors leading-none">
              NORVA
            </span>
            <span className="text-[9px] tracking-[0.32em] uppercase text-[#d6be96]/75 mt-1 hidden sm:block">
              Haute Parfumerie
            </span>
          </Link>

          {/* Right: Search, Track Order, Wishlist, Admin, Cart */}
          <div className="flex items-center justify-end gap-0.5 sm:gap-2">
            <button
              type="button"
              onClick={openSearch}
              aria-label="Search fragrances"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-white/75 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>

            <Link
              to="/track-order"
              aria-label="Track your order"
              title="Track Your Order"
              className="hidden sm:flex w-10 h-10 rounded-lg items-center justify-center text-white/75 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <Truck className="w-[18px] h-[18px]" />
            </Link>

            <Link
              to="/account"
              aria-label="Account and wishlist"
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-white/75 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <Heart className="w-[18px] h-[18px]" />
              {wishlistCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#d6be96]" />
              )}
            </Link>

            <Link
              to="/admin"
              aria-label="Store Admin Dashboard"
              title={
                hasAdminSession && unseenOrderCount > 0
                  ? `Admin Dashboard (${unseenOrderCount} new order${unseenOrderCount === 1 ? '' : 's'})`
                  : 'Admin Dashboard'
              }
              className="hidden md:flex relative h-9 px-3 rounded-lg items-center gap-1.5 text-xs text-white/60 hover:text-white hover:bg-white/[0.05] border border-transparent hover:border-white/10 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-[#d6be96]" />
              <span>Admin</span>
              {hasAdminSession && unseenOrderCount > 0 && (
                <span className="font-mono-tabular text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#36d67e] text-[#050508] leading-none">
                  {unseenOrderCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={openCart}
              aria-label={`Shopping bag with ${cartCount} items`}
              className="relative h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-lg flex items-center gap-1.5 sm:gap-2 bg-white/[0.06] hover:bg-white/[0.11] border border-white/10 text-white transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-[#d6be96]" />
              <span className="font-mono-tabular text-xs font-medium">{cartCount}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-50 bg-black/75 lg:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[86vw] max-w-xs bg-[#09090e] border-r border-white/10 p-6 flex flex-col justify-between lg:hidden norva-fade-in">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <span className="font-serif-display text-2xl tracking-[0.22em] text-white">
                  NORVA
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white/70 hover:text-white bg-white/[0.05]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex flex-col space-y-1">
                {navLinks.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `px-3 py-3 rounded-lg text-sm tracking-wide transition-colors ${
                        isActive
                          ? 'bg-white/[0.07] text-[#f2e6d5] font-medium'
                          : 'text-white/75 hover:bg-white/[0.04] hover:text-white'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                <NavLink
                  to="/collections/fresh-luminous"
                  className="px-3 py-3 rounded-lg text-sm tracking-wide text-white/75 hover:bg-white/[0.04] hover:text-white"
                >
                  Fresh &amp; Luminous
                </NavLink>
                <NavLink
                  to="/account"
                  className="px-3 py-3 rounded-lg text-sm tracking-wide text-white/75 hover:bg-white/[0.04] hover:text-white"
                >
                  My Account &amp; Wishlist
                </NavLink>
                <NavLink
                  to="/admin"
                  className="px-3 py-3 rounded-lg text-sm tracking-wide text-[#d6be96] hover:bg-white/[0.04] flex items-center justify-between"
                >
                  <span>Admin Dashboard</span>
                  {hasAdminSession && unseenOrderCount > 0 && (
                    <span className="font-mono-tabular text-[11px] font-semibold px-2 py-0.5 rounded bg-[#36d67e] text-[#050508]">
                      {unseenOrderCount} New
                    </span>
                  )}
                </NavLink>
              </nav>
            </div>

            <div className="pt-6 border-t border-white/10 space-y-2 text-xs text-white/50">
              <p>Small-Batch Extrait de Parfum</p>
              <p className="text-white/35">Crafted with Grasse Botanicals</p>
            </div>
          </aside>
        </>
      )}
    </>
  );
});
Navbar.displayName = 'Navbar';

export const Footer: React.FC = React.memo(() => {
  const { addSubscriber } = useCatalogActions();
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    addSubscriber(email);
    setEmail('');
    setJoined(true);
  };

  return (
    <footer className="bg-[#06060a] border-t border-white/[0.08] text-white/75 cv-auto">
      {/* Upper Assurance Strip */}
      <div className="max-w-[1380px] mx-auto px-4 sm:px-8 py-8 sm:py-10 border-b border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#d6be96] shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">24% – 32% Pure Perfume Oil</h3>
            <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
              True Extrait &amp; Intense concentrations aged in dark glass vats for 10–14 hour
              longevity.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#d6be96] shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Insured Express Dispatch</h3>
            <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
              Temperature-shielded luxury packaging with city-based courier rates &amp; live order
              tracking.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#d6be96] shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">IFRA Certified &amp; Cruelty-Free</h3>
            <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
              Formulated without phthalates, parabens, or synthetic dyes. Ethically harvested
              woods.
            </p>
          </div>
        </div>
      </div>

      {/* Main Footer Columns */}
      <div className="max-w-[1380px] mx-auto px-4 sm:px-8 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 sm:gap-10">
        <div className="lg:col-span-4 space-y-4">
          <Link to="/" className="inline-block">
            <span className="font-serif-display text-3xl tracking-[0.24em] text-white">
              NORVA
            </span>
          </Link>
          <p className="text-sm text-white/55 leading-relaxed max-w-sm">
            Contemporary haute parfumerie uniting rare resinous oud, Florentine iris, and crisp
            botanical absolutes inside weighted architectural flacons.
          </p>
          <p className="text-xs text-[#d6be96]/80 tracking-wider uppercase pt-1">
            Grasse · Lahore · Dubai
          </p>
          <div className="pt-1">
            <a
              href={getStoreWhatsAppChatUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#25D366]/14 hover:bg-[#25D366]/24 border border-[#25D366]/35 text-xs font-medium text-[#36d67e] transition-colors"
            >
              <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
              <span>Chat on WhatsApp · {NORVA_WHATSAPP_DISPLAY}</span>
            </a>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-white">
            Collections
          </h4>
          <ul className="space-y-2.5 text-sm text-white/60">
            <li>
              <Link to="/shop" className="hover:text-white transition-colors">
                All Fragrances
              </Link>
            </li>
            <li>
              <Link to="/collections/best-sellers" className="hover:text-white transition-colors">
                House Icons
              </Link>
            </li>
            <li>
              <Link to="/collections/oud-dark-woods" className="hover:text-white transition-colors">
                Oud &amp; Dark Woods
              </Link>
            </li>
            <li>
              <Link to="/collections/fresh-luminous" className="hover:text-white transition-colors">
                Fresh &amp; Luminous
              </Link>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-white">
            Client Care
          </h4>
          <ul className="space-y-2.5 text-sm text-white/60">
            <li>
              <Link to="/track-order" className="hover:text-white transition-colors text-[#d6be96]">
                Track Your Order
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-white transition-colors">
                Contact &amp; Concierge
              </Link>
            </li>
            <li>
              <Link to="/account" className="hover:text-white transition-colors">
                Orders &amp; Wishlist
              </Link>
            </li>
            <li>
              <Link to="/checkout" className="hover:text-white transition-colors">
                Shipping &amp; Checkout
              </Link>
            </li>
            <li>
              <Link to="/admin" className="hover:text-white transition-colors">
                Store Admin Console
              </Link>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-4 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-white">
            Private Dispatch List
          </h4>
          <p className="text-xs text-white/55 leading-relaxed">
            Receive early access to numbered micro-batch Extraits and private seasonal releases.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              aria-label="Email address for private dispatch list"
              className="flex-1 h-11 px-3.5 rounded-lg bg-white/[0.04] border border-white/12 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#d6be96]"
            />
            <button
              type="submit"
              className="h-11 px-5 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer shrink-0"
            >
              {joined ? <Check className="w-4 h-4 mx-auto" /> : 'Join'}
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Copyright */}
      <div className="border-t border-white/[0.06] py-6 px-4 sm:px-8">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <p>© {new Date().getFullYear()} NORVA Haute Parfumerie. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link to="/track-order" className="hover:text-white/70 transition-colors">
              Order Tracking
            </Link>
            <Link to="/contact" className="hover:text-white/70 transition-colors">
              Privacy &amp; Terms
            </Link>
            <Link to="/contact" className="hover:text-white/70 transition-colors">
              Authenticity Guarantee
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
});
Footer.displayName = 'Footer';
