import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Navbar, Footer } from './components/NavbarAndFooter';
import {
  CartDrawer,
  QuickViewModal,
  SearchModal,
  ToastNotification,
} from './components/CartAndModals';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';
import { HomePage } from './pages/HomePage';

// Code-split secondary routes so initial load on mobile & PC stays ultra-fast
const ShopAllPage = lazy(() =>
  import('./pages/ShopAllPage').then((m) => ({ default: m.ShopAllPage })),
);
const CollectionPage = lazy(() =>
  import('./pages/CollectionPage').then((m) => ({ default: m.CollectionPage })),
);
const ProductDetailPage = lazy(() =>
  import('./pages/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })),
);
const ContactPage = lazy(() =>
  import('./pages/ContactPage').then((m) => ({ default: m.ContactPage })),
);
const CheckoutPage = lazy(() =>
  import('./pages/CheckoutAndAccountPages').then((m) => ({ default: m.CheckoutPage })),
);
const AccountPage = lazy(() =>
  import('./pages/CheckoutAndAccountPages').then((m) => ({ default: m.AccountPage })),
);
const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);

const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center px-4">
    <div className="text-center space-y-2 opacity-75">
      <p className="font-serif-display text-2xl tracking-[0.14em] text-[#d6be96]">NORVA</p>
      <div className="w-24 h-0.5 bg-white/10 rounded-full overflow-hidden mx-auto">
        <div className="w-1/2 h-full bg-[#d6be96] animate-pulse" />
      </div>
    </div>
  </div>
);

const ScrollAndShortcuts: React.FC = () => {
  const { pathname } = useLocation();
  const { openSearch } = useStore();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openSearch]);

  return null;
};

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="will-change-[opacity,transform]"
      >
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopAllPage />} />
          <Route path="/collections/:collectionId" element={<CollectionPage />} />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </Suspense>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <ScrollAndShortcuts />
        <div className="min-h-screen w-full overflow-x-clip flex flex-col bg-transparent text-[#f5f3ef] font-sans-body">
          <Navbar />

          <main className="flex-1 min-w-0">
            <AnimatedRoutes />
          </main>

          <Footer />

          {/* Global Shopping & Discovery Overlays */}
          <CartDrawer />
          <QuickViewModal />
          <SearchModal />
          <WhatsAppFloatingButton />
          <ToastNotification />
        </div>
      </StoreProvider>
    </BrowserRouter>
  );
}
