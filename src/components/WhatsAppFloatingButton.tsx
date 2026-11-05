import React from 'react';
import { useLocation } from 'react-router-dom';
import { formatPKR } from '../data/products';
import type { PlacedOrder } from '../context/StoreContext';

export const NORVA_WHATSAPP_DISPLAY = '+92 310 7019192';
export const WHATSAPP_DISPLAY = NORVA_WHATSAPP_DISPLAY;
const DEFAULT_WHATSAPP_DIGITS = '923107019192';

export function getStoreWhatsAppDigits(): string {
  const envVal = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_WHATSAPP_NUMBER;
  const cleaned = String(envVal || DEFAULT_WHATSAPP_DIGITS).replace(/\D+/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `92${cleaned.slice(1)}`;
  }
  return cleaned || DEFAULT_WHATSAPP_DIGITS;
}

export function buildWhatsAppMessageUrl(message: string): string {
  const digits = getStoreWhatsAppDigits();
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function getStoreWhatsAppChatUrl(): string {
  return buildWhatsAppMessageUrl(
    'Assalam-o-Alaikum NORVA Concierge! I would like assistance choosing or ordering a fragrance.',
  );
}

export function buildProductWhatsAppUrl(
  productName: string,
  sizeLabel: string,
  quantity: number,
  unitPrice: number,
): string {
  const lineTotal = unitPrice * quantity;
  const msg = [
    'Assalam-o-Alaikum NORVA Concierge,',
    'I would like to order:',
    `• Fragrance: ${productName} (${sizeLabel})`,
    `• Quantity: ${quantity}`,
    `• Item Price: ${formatPKR(lineTotal)}`,
    '',
    'Please share delivery details for my city.',
  ].join('\n');

  return buildWhatsAppMessageUrl(msg);
}

export function buildProductWhatsAppOrderUrl(params: {
  productName: string;
  sizeLabel: string;
  unitPrice: number;
  quantity: number;
}): string {
  return buildProductWhatsAppUrl(
    params.productName,
    params.sizeLabel,
    params.quantity,
    params.unitPrice,
  );
}

export function buildOrderConfirmationWhatsAppUrl(order: PlacedOrder): string {
  const itemLines = order.items
    .map(
      (i) =>
        `• ${i.name} (${i.sizeLabel}) × ${i.quantity} — ${formatPKR(i.unitPrice * i.quantity)}`,
    )
    .join('\n');

  const lines: string[] = [
    'Assalam-o-Alaikum NORVA Concierge,',
    `Please confirm my order *${order.orderNumber}*:`,
    '',
    '*Ordered Fragrances:*',
    itemLines,
    '',
    `Subtotal: ${formatPKR(order.subtotal)}`,
  ];

  if (order.discountAmount > 0) {
    lines.push(
      `Discount${order.couponCode ? ` (${order.couponCode})` : ''}: -${formatPKR(order.discountAmount)}`,
    );
  }

  lines.push(
    `Shipping (${order.customer.city}): ${order.shippingCost === 0 ? 'Complimentary' : formatPKR(order.shippingCost)}`,
    `*Total Payable: ${formatPKR(order.total)}*`,
    `Payment Method: ${order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Bank Transfer / IBFT'}`,
    '',
    '*Delivery Details:*',
    `Name: ${order.customer.fullName}`,
    `Phone: ${order.customer.phone}`,
    `Address: ${order.customer.address}, ${order.customer.city}${order.customer.postalCode ? ` ${order.customer.postalCode}` : ''}`,
  );

  if (order.giftNote) {
    lines.push(`Gift Note: "${order.giftNote}"`);
  }

  return buildWhatsAppMessageUrl(lines.join('\n'));
}

export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.968 0 1.758.459 3.474 1.332 4.988L2 22l5.188-1.361a9.927 9.927 0 0 0 4.842 1.258h.004c5.515 0 9.966-4.452 9.966-9.967A9.907 9.907 0 0 0 19.08 4.92 9.906 9.906 0 0 0 12.031 2Zm5.818 14.27c-.246.693-1.432 1.326-1.988 1.409-.508.076-1.15.108-1.856-.116-.428-.136-.978-.317-1.682-.621-2.96-1.278-4.893-4.259-5.041-4.456-.147-.198-1.204-1.602-1.204-3.056 0-1.454.762-2.169 1.032-2.465.271-.296.59-.37.787-.37.196 0 .393.002.565.01.181.009.425-.069.665.507.246.592.836 2.047.909 2.195.074.148.123.321.025.518-.099.198-.148.321-.295.493-.148.173-.311.386-.443.519-.148.148-.302.308-.13.604.172.296.764 1.261 1.641 2.043 1.128 1.005 2.079 1.317 2.374 1.465.295.148.467.123.639-.074.173-.197.738-.863.935-1.159.196-.296.393-.247.664-.148.27.099 1.721.812 2.016.96.295.148.492.222.566.345.073.124.073.715-.173 1.408Z" />
  </svg>
);

export const WhatsAppFloatingButton: React.FC = React.memo(() => {
  const location = useLocation();

  // Hide floating customer WhatsApp button inside private Admin console
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <a
      href={getStoreWhatsAppChatUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with NORVA on WhatsApp (${NORVA_WHATSAPP_DISPLAY})`}
      title={`WhatsApp Concierge · ${NORVA_WHATSAPP_DISPLAY}`}
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 group inline-flex items-center gap-2.5 h-12 sm:h-[52px] pl-3.5 pr-4 sm:pl-4 sm:pr-5 rounded-full bg-[#112419] hover:bg-[#163021] border border-[#25D366]/55 text-white transition-colors"
    >
      <span className="w-7 h-7 rounded-full bg-[#25D366] text-[#050508] flex items-center justify-center shrink-0">
        <WhatsAppIcon className="w-4 h-4" />
      </span>
      <span className="flex flex-col text-left leading-tight">
        <span className="text-[9.5px] uppercase tracking-[0.16em] text-[#36d67e] font-semibold">
          WhatsApp
        </span>
        <span className="text-xs font-medium text-white whitespace-nowrap">
          Order / Help
        </span>
      </span>
    </a>
  );
});
WhatsAppFloatingButton.displayName = 'WhatsAppFloatingButton';
