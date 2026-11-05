import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { StoreProvider, useOverlayState } from './context/StoreContext';
import { Footer, Navbar } from './components/NavbarAndFooter';
import { ToastNotification } from './components/LuxuryUI';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';
import { HomePage } from './pages/HomePage';

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
const TrackOrderPage = lazy(() =>
  import('./pages/CheckoutAndAccountPages').then((m) => ({ default: m.TrackOrderPage })),
);
const AccountPage = lazy(() =>
  import('./pages/CheckoutAndAccountPages').then((m) => ({ default: m.AccountPage })),
);
const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);

const LazyCartDrawer = lazy(() =>
  import('./components/CartAndModals').then((m) => ({ default: m.CartDrawer })),
);
const LazyQuickViewModal = lazy(() =>
  import('./components/CartAndModals').then((m) => ({ default: m.QuickViewModal })),
);
const LazySearchModal = lazy(() =>
  import('./components/CartAndModals').then((m) => ({ default: m.SearchModal })),
);

const ScrollToTopOnRoute: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
};

const PageLoaderFallback: React.FC = () => (
  <div className="min-h-[65vh] flex items-center justify-center bg-[#050508]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-7 h-7 rounded-full border-2 border-[#d6be96]/30 border-t-[#d6be96] animate-spin" />
      <span className="text-[11px] uppercase tracking-[0.24em] text-white/45">NORVA</span>
    </div>
  </div>
);

/**
 * Mounts interactive drawers/modals on demand so CartAndModals & QuickView's 3D stage
 * are never evaluated or downloaded until first opened.
 */
const DeferredStoreOverlays: React.FC = () => {
  const { isCartOpen, isSearchOpen, quickViewProduct } = useOverlayState();
  const [hasOpenedCart, setHasOpenedCart] = useState(false);
  const [hasOpenedSearch, setHasOpenedSearch] = useState(false);
  const [hasOpenedQuickView, setHasOpenedQuickView] = useState(false);

  useEffect(() => {
    if (isCartOpen) setHasOpenedCart(true);
  }, [isCartOpen]);

  useEffect(() => {
    if (isSearchOpen) setHasOpenedSearch(true);
  }, [isSearchOpen]);

  useEffect(() => {
    if (quickViewProduct) setHasOpenedQuickView(true);
  }, [quickViewProduct]);

  return (
    <Suspense fallback={null}>
      {(isCartOpen || hasOpenedCart) && <LazyCartDrawer />}
      {(Boolean(quickViewProduct) || hasOpenedQuickView) && <LazyQuickViewModal />}
      {(isSearchOpen || hasOpenedSearch) && <LazySearchModal />}
    </Suspense>
  );
};

const StorefrontRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoaderFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopAllPage />} />
        <Route path="/collections/:collectionId" element={<CollectionPage />} />
        <Route path="/product/:slug" element={<ProductDetailPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/track-order" element={<TrackOrderPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Suspense>
  );
};

export function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <ScrollToTopOnRoute />
        <div className="min-h-screen flex flex-col bg-[#050508] text-[#f5f3ef]">
          <Navbar />
          <main className="flex-1">
            <StorefrontRoutes />
          </main>
          <Footer />
          <DeferredStoreOverlays />
          <WhatsAppFloatingButton />
          <ToastNotification />
        </div>
      </StoreProvider>
    </BrowserRouter>
  );
}

export default App;
