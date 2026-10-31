import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../context/StoreContext';

const COLLECTION_LINKS = [
  { to: '/collections/signature', label: 'Signature Five' },
  { to: '/collections/oud', label: 'Oud Collection' },
  { to: '/collections/fresh', label: 'Fresh Collection' },
  { to: '/collections/mens', label: 'Men’s Fragrances' },
  { to: '/collections/womens', label: 'Women’s Fragrances' },
  { to: '/collections/unisex', label: 'Unisex Fragrances' },
];

export const Navbar: React.FC = () => {
  const { cartCount, wishlist, openCart, openSearch } = useStore();
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  React.useEffect(() => {
    setCollectionsOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#050508]/97 border-b border-white/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.88)]">
      {/* Strictly 3-Zone Top Bar Contract (Zero backdrop-blur over WebGL for silky 60fps scroll) */}
      <div className="max-w-[1380px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single Brand Wordmark */}
        <Link
          to="/"
          className="font-serif-display text-2xl sm:text-[26px] font-medium tracking-[0.14em] text-white whitespace-nowrap shrink-0"
        >
          NORVA
        </Link>

        {/* Zone 2: Clean Single-Line Text Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-[13px] font-medium text-white/68">
          <NavLink
            to="/shop"
            className={({ isActive }) =>
              `hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                isActive ? 'text-white underline underline-offset-8 decoration-[#d6be96]' : ''
              }`
            }
          >
            Shop All
          </NavLink>

          <div
            className="relative"
            onMouseEnter={() => setCollectionsOpen(true)}
            onMouseLeave={() => setCollectionsOpen(false)}
          >
            <button
              type="button"
              onClick={() => setCollectionsOpen((v) => !v)}
              className="flex items-center gap-1 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2"
            >
              <span>Collections</span>
              <ChevronDown
                className={`w-3.5 h-3.5 opacity-70 transition-transform duration-200 ${
                  collectionsOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {collectionsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute left-0 top-full pt-1 w-56 z-50 will-change-[opacity,transform]"
                >
                  <div className="bg-[#0b0b11] border border-white/12 rounded-xl p-2 shadow-[0_24px_60px_rgba(0,0,0,0.95)] grid grid-cols-1 gap-0.5">
                    {COLLECTION_LINKS.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="px-3.5 py-2 rounded-lg text-xs text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors whitespace-nowrap"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <NavLink
            to="/collections/signature"
            className={({ isActive }) =>
              `hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                isActive ? 'text-white underline underline-offset-8 decoration-[#d6be96]' : ''
              }`
            }
          >
            Signature Five
          </NavLink>

          <NavLink
            to="/contact"
            className={({ isActive }) =>
              `hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                isActive ? 'text-white underline underline-offset-8 decoration-[#d6be96]' : ''
              }`
            }
          >
            Concierge
          </NavLink>
        </nav>

        {/* Zone 3: Search, Account & Bag Action Cluster */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search signature fragrances"
            className="p-2 text-white/75 hover:text-white transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>

          <Link
            to="/admin"
            className="hidden sm:inline-block text-xs font-medium text-white/60 hover:text-[#d6be96] transition-colors whitespace-nowrap shrink-0 px-1.5"
          >
            Admin
          </Link>

          <Link
            to="/account"
            aria-label="Account and Wishlist"
            className="hidden sm:flex items-center gap-1.5 p-2 text-white/75 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            {wishlist.length > 0 ? (
              <Heart className="w-4 h-4 text-[#d6be96] fill-[#d6be96]" />
            ) : (
              <User className="w-4 h-4" />
            )}
          </Link>

          <button
            type="button"
            onClick={openCart}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#101018] hover:bg-[#d6be96] border border-[#d6be96]/25 text-white hover:text-[#050508] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Bag</span>
            <span className="font-mono-tabular">({cartCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-2 text-white/80 hover:text-white cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden bg-[#08080c] border-t border-white/10 px-6 py-6 space-y-5 max-h-[80vh] overflow-y-auto will-change-[opacity,transform]"
          >
            <div className="flex flex-col gap-3 text-sm font-medium text-white/85">
              <Link to="/" className="py-1 hover:text-[#d6be96] transition-colors">
                Home
              </Link>
              <Link to="/shop" className="py-1 hover:text-[#d6be96] transition-colors">
                Shop All Fragrances
              </Link>
              <Link to="/collections/signature" className="py-1 hover:text-[#d6be96] transition-colors">
                The Signature Five
              </Link>
              <Link to="/contact" className="py-1 hover:text-[#d6be96] transition-colors">
                Client Concierge
              </Link>
              <Link to="/account" className="py-1 hover:text-[#d6be96] transition-colors">
                Account &amp; Wishlist ({wishlist.length})
              </Link>
              <Link to="/admin" className="py-1 text-[#d6be96] hover:underline">
                Admin Dashboard
              </Link>
            </div>

            <div className="pt-4 border-t border-white/10">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/40 mb-3">
                Curated Collections
              </p>
              <div className="grid grid-cols-2 gap-2.5 text-xs text-white/70">
                {COLLECTION_LINKS.map((item) => (
                  <Link key={item.to} to={item.to} className="py-1 hover:text-white transition-colors">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export const Footer: React.FC = () => {
  return (
    <footer className="relative bg-[#030305] border-t border-white/[0.08] text-white/65 overflow-hidden">
      {/* Subtle perfumed ambient glow along footer horizon */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(214,190,150,0.07),transparent_75%)]"
      />

      <div className="relative max-w-[1380px] mx-auto px-6 sm:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4 pr-4">
            <Link
              to="/"
              className="inline-block font-serif-display text-2xl tracking-[0.14em] text-white"
            >
              NORVA
            </Link>
            <p className="text-sm text-white/55 max-w-sm leading-relaxed">
              Five signature haute parfumerie creations bottled in thick smoked optical crystal.
              Every flacon honors rare botanical resins, noble woods, and enduring sillage.
            </p>
            <p className="text-xs text-white/40 pt-2">
              NORVA Haute Parfumerie · Nationwide Insured Delivery Across Pakistan
            </p>
          </div>

          {/* Signature Five */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/85">
              Signature Five
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link to="/product/khamrah-qawa" className="hover:text-white transition-colors">
                  01. Khamrah Qawa
                </Link>
              </li>
              <li>
                <Link to="/product/cool-water" className="hover:text-white transition-colors">
                  02. Cool Water
                </Link>
              </li>
              <li>
                <Link to="/product/9mm-rebel" className="hover:text-white transition-colors">
                  03. 9mM Rebel
                </Link>
              </li>
              <li>
                <Link to="/product/jadora" className="hover:text-white transition-colors">
                  04. Jadora
                </Link>
              </li>
              <li>
                <Link to="/product/gucci-flora" className="hover:text-white transition-colors">
                  05. Gucci Flora
                </Link>
              </li>
            </ul>
          </div>

          {/* Collections */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/85">
              Collections
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link to="/collections/signature" className="hover:text-white transition-colors">
                  The Signature Five
                </Link>
              </li>
              <li>
                <Link to="/collections/mens" className="hover:text-white transition-colors">
                  Men’s Fragrances
                </Link>
              </li>
              <li>
                <Link to="/collections/womens" className="hover:text-white transition-colors">
                  Women’s Fragrances
                </Link>
              </li>
              <li>
                <Link to="/collections/unisex" className="hover:text-white transition-colors">
                  Unisex Wardrobe
                </Link>
              </li>
              <li>
                <Link to="/collections/oud" className="hover:text-white transition-colors">
                  The Oud Collection
                </Link>
              </li>
              <li>
                <Link to="/collections/fresh" className="hover:text-white transition-colors">
                  The Fresh Collection
                </Link>
              </li>
            </ul>
          </div>

          {/* Client Concierge */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/85">
              Client Concierge
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link to="/shop" className="hover:text-white transition-colors">
                  Shop All Fragrances
                </Link>
              </li>
              <li>
                <Link to="/account" className="hover:text-white transition-colors">
                  Client Account &amp; Orders
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact &amp; Consultations
                </Link>
              </li>
              <li>
                <Link to="/checkout" className="hover:text-white transition-colors">
                  Cash on Delivery Checkout
                </Link>
              </li>
              <li>
                <a
                  href="https://wa.me/923012697458?text=Assalam%20o%20Alaikum%20NORVA!%20I%20would%20like%20to%20place%20an%20order."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#36d67e] hover:text-white transition-colors font-mono-tabular"
                >
                  WhatsApp: 0301-2697458
                </a>
              </li>
              <li>
                <Link to="/admin" className="text-[#d6be96] hover:text-white transition-colors">
                  Admin Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} NORVA Haute Parfumerie. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              Instagram
            </a>
            <a
              href="https://pinterest.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              Pinterest
            </a>
            <Link to="/contact" className="hover:text-white transition-colors">
              Shipping &amp; Returns
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
