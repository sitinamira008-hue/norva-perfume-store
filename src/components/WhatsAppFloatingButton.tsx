import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronUp, Minus, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { formatPKR } from '../data/products';
import { CartItem, useStore } from '../context/StoreContext';

export const WHATSAPP_DISPLAY = '0301-2697458';
export const WHATSAPP_WA_NUMBER = '923012697458';

export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M12.031 2c-5.516 0-9.998 4.485-9.998 10.001 0 1.763.459 3.483 1.332 5.001L2 22l5.134-1.346a9.96 9.96 0 0 0 4.894 1.281h.004c5.515 0 9.998-4.485 9.998-10.001 0-2.672-1.04-5.184-2.928-7.073A9.936 9.936 0 0 0 12.031 2Zm5.822 14.127c-.246.693-1.432 1.326-1.976 1.409-.506.076-1.146.108-1.851-.116-.428-.136-.977-.317-1.682-.621-2.959-1.277-4.892-4.258-5.04-4.455-.147-.197-1.203-1.601-1.203-3.054 0-1.453.761-2.167 1.031-2.463.27-.296.59-.37.786-.37.197 0 .393.002.565.01.181.009.424-.069.663.507.246.591.835 2.044.909 2.192.074.148.123.32.025.517-.098.197-.147.32-.295.492-.147.173-.31.386-.442.518-.147.147-.301.307-.129.603.172.295.764 1.26 1.64 2.041 1.127 1.005 2.077 1.316 2.372 1.464.295.148.467.123.639-.074.172-.197.737-.862.934-1.157.196-.296.393-.246.663-.148.27.099 1.72.811 2.015.959.295.148.491.222.565.345.074.123.074.714-.172 1.407Z" />
  </svg>
);

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_WA_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function buildCartWhatsAppUrl(cart: CartItem[], subtotal: number): string {
  const lines = cart.map(
    (item, idx) =>
      `${idx + 1}. *${item.name}* (${item.sizeLabel}) × ${item.quantity} — ${formatPKR(
        item.unitPrice * item.quantity,
      )}`,
  );
  const msg = [
    'Assalam o Alaikum NORVA! 👋',
    'I would like to place an order on WhatsApp:',
    '',
    ...lines,
    '',
    `*Subtotal:* ${formatPKR(subtotal)}`,
    'Payment: Cash on Delivery',
    '',
    'My Name: ',
    'City & Delivery Address: ',
  ].join('\n');

  return buildWhatsAppUrl(msg);
}

export function buildProductWhatsAppUrl(
  productName: string,
  sizeLabel: string,
  quantity: number,
  unitPrice: number,
): string {
  const total = unitPrice * quantity;
  const msg = [
    'Assalam o Alaikum NORVA! 👋',
    'I want to order this fragrance via WhatsApp:',
    '',
    `• *Fragrance:* ${productName}`,
    `• *Size:* ${sizeLabel}`,
    `• *Quantity:* ${quantity}`,
    `• *Total:* ${formatPKR(total)}`,
    '• *Payment:* Cash on Delivery',
    '',
    'My Name: ',
    'City & Delivery Address: ',
  ].join('\n');

  return buildWhatsAppUrl(msg);
}

export const WhatsAppFloatingButton: React.FC = () => {
  const { pathname } = useLocation();
  const { products, cart, cartCount, cartSubtotal, isCartOpen } = useStore();

  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    () => products[0]?.id ?? 'frag-01',
  );
  const [quickQty, setQuickQty] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerCity, setCustomerCity] = useState('');

  // Match active product if currently on /product/:slug
  const currentRouteProduct = useMemo(() => {
    const match = pathname.match(/^\/product\/([^/]+)/);
    if (!match) return null;
    return products.find((p) => p.slug === match[1]) ?? null;
  }, [pathname, products]);

  // Smart 1-click WhatsApp URL based on customer's current context
  const directWhatsAppUrl = useMemo(() => {
    if (cart.length > 0) {
      return buildCartWhatsAppUrl(cart, cartSubtotal);
    }
    if (currentRouteProduct) {
      const sz = currentRouteProduct.sizes[0];
      return buildProductWhatsAppUrl(currentRouteProduct.name, sz.label, 1, sz.price);
    }
    return buildWhatsAppUrl(
      [
        'Assalam o Alaikum NORVA! 👋',
        'I would like to order from your 5 Signature Fragrances (PKR 2,500).',
        '',
        'Fragrance Name: ',
        'My Name: ',
        'City & Delivery Address: ',
      ].join('\n'),
    );
  }, [cart, cartSubtotal, currentRouteProduct]);

  const quickSelectedProduct =
    products.find((p) => p.id === selectedProductId) ?? products[0];

  const quickOrderUrl = useMemo(() => {
    if (!quickSelectedProduct) return directWhatsAppUrl;
    const sz = quickSelectedProduct.sizes[0];
    const total = sz.price * quickQty;
    const lines = [
      'Assalam o Alaikum NORVA! 👋',
      'I want to place an order on WhatsApp:',
      '',
      `• *Fragrance:* ${quickSelectedProduct.name} (${sz.label})`,
      `• *Quantity:* ${quickQty}`,
      `• *Total:* ${formatPKR(total)}`,
      '• *Payment:* Cash on Delivery',
      '',
      `My Name: ${customerName.trim() || ''}`,
      `City & Delivery Address: ${customerCity.trim() || ''}`,
    ];
    return buildWhatsAppUrl(lines.join('\n'));
  }, [quickSelectedProduct, quickQty, customerName, customerCity, directWhatsAppUrl]);

  // Hide on Admin Dashboard or while Cart Drawer is open
  if (pathname.startsWith('/admin') || isCartOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {/* Optional Quick-Order Popover */}
      <AnimatePresence>
        {isQuickOpen && quickSelectedProduct && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="w-[310px] sm:w-[340px] rounded-xl bg-[#09090d] border border-[#25D366]/35 shadow-[0_24px_60px_rgba(0,0,0,0.95),0_10px_30px_rgba(37,211,102,0.18)] overflow-hidden will-change-[opacity,transform]"
          >
            {/* Header */}
            <div className="px-4 py-3.5 bg-[#0b1610] border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#25D366] text-[#050508] flex items-center justify-center shrink-0">
                  <WhatsAppIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white leading-tight">
                    NORVA WhatsApp Order
                  </p>
                  <p className="font-mono-tabular text-[11px] text-[#36d67e]">
                    {WHATSAPP_DISPLAY}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickOpen(false)}
                aria-label="Close WhatsApp quick order"
                className="p-1 text-white/50 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-white/55 mb-1">
                  Select Signature Fragrance
                </label>
                <select
                  value={quickSelectedProduct.id}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[#050508] border border-white/15 text-xs text-white focus:outline-none focus:border-[#25D366]"
                >
                  {products.map((p, idx) => (
                    <option key={p.id} value={p.id} className="bg-[#09090d] text-white">
                      0{idx + 1}. {p.name} — {formatPKR(p.sizes[0].price)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-white/55">Quantity (100 ml)</span>
                <div className="h-8 px-2 rounded-lg bg-[#050508] border border-white/15 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setQuickQty((q) => Math.max(1, q - 1))}
                    className="p-1 text-white/65 hover:text-white cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono-tabular text-xs text-white w-4 text-center">
                    {quickQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickQty((q) => q + 1)}
                    className="p-1 text-white/65 hover:text-white cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your Name (optional)"
                  className="h-9 px-2.5 rounded-lg bg-[#050508] border border-white/12 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-[#25D366]"
                />
                <input
                  type="text"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  placeholder="City (e.g. Karachi)"
                  className="h-9 px-2.5 rounded-lg bg-[#050508] border border-white/12 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-[#25D366]"
                />
              </div>

              <div className="pt-1 flex items-center justify-between text-xs border-t border-white/[0.07]">
                <span className="text-white/55">Order Total (COD)</span>
                <span className="font-mono-tabular font-semibold text-[#36d67e]">
                  {formatPKR(quickSelectedProduct.sizes[0].price * quickQty)}
                </span>
              </div>

              <a
                href={quickOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsQuickOpen(false)}
                className="w-full h-10 rounded-lg bg-[#25D366] hover:bg-[#32e275] text-[#050507] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <WhatsAppIcon className="w-4 h-4" />
                <span>Send Order on WhatsApp</span>
              </a>

              {cart.length > 0 && (
                <a
                  href={directWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsQuickOpen(false)}
                  className="w-full h-9 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/12 text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>
                    Order Current Bag ({cartCount} {cartCount === 1 ? 'item' : 'items'} ·{' '}
                    {formatPKR(cartSubtotal)})
                  </span>
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Floating Bar: 1-Click Direct WhatsApp Link + Quick-Picker Toggle */}
      <div className="flex items-stretch rounded-xl bg-[#0b0b11]/98 border border-[#25D366]/45 hover:border-[#25D366] shadow-[0_18px_44px_-8px_rgba(0,0,0,0.95),0_8px_28px_-8px_rgba(37,211,102,0.28)] overflow-hidden smooth-lift hover:-translate-y-0.5">
        <a
          href={directWhatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Order on WhatsApp ${WHATSAPP_DISPLAY}`}
          className="flex items-center gap-3 pl-3 pr-3.5 py-2.5 group"
        >
          <span className="w-9 h-9 rounded-lg bg-[#25D366] group-hover:bg-[#32e275] text-[#050507] flex items-center justify-center shrink-0 transition-colors">
            <WhatsAppIcon className="w-5 h-5" />
          </span>
          <span className="flex flex-col text-left leading-tight">
            <span className="text-xs font-semibold text-white group-hover:text-[#36d67e] transition-colors">
              {cartCount > 0 ? `WhatsApp Bag (${cartCount})` : 'Order on WhatsApp'}
            </span>
            <span className="font-mono-tabular text-[11px] text-white/65">
              {WHATSAPP_DISPLAY}
            </span>
          </span>
        </a>

        <button
          type="button"
          onClick={() => setIsQuickOpen((prev) => !prev)}
          title="Quick-select fragrance for WhatsApp order"
          aria-label="Toggle WhatsApp quick fragrance selector"
          className="px-2.5 border-l border-white/10 text-white/60 hover:text-white hover:bg-white/[0.05] flex items-center justify-center transition-colors cursor-pointer"
        >
          <ChevronUp
            className={`w-4 h-4 transition-transform duration-200 ${
              isQuickOpen ? 'rotate-180 text-[#25D366]' : ''
            }`}
          />
        </button>
      </div>
    </div>
  );
};
