import React, { useState } from 'react';
import { Check, ChevronDown, Clock, Mail, MapPin, Phone } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { SEOHead } from '../components/LuxuryUI';

const FAQS = [
  {
    q: 'What is the price of each NORVA signature fragrance?',
    a: 'All five NORVA 100 ml smoked-glass signature fragrances—Khamrah Qawa, Cool Water, 9mM Rebel, Jadora, and Gucci Flora—are priced at PKR 2,500 each.',
  },
  {
    q: 'How long do NORVA fragrances last on skin and clothes?',
    a: 'Our extraits and intense eaux de parfum are compounded at 28%–34% aromatic oil concentration and cold-macerated for 90 days, delivering 8 to 14+ hours of skin longevity.',
  },
  {
    q: 'Do you offer Cash on Delivery (COD) across Pakistan?',
    a: 'Yes. We offer insured Cash on Delivery nationwide across Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, and all major cities. Orders of PKR 5,000+ (2 or more bottles) qualify for free courier delivery.',
  },
  {
    q: 'What is your return and exchange policy?',
    a: 'Unopened full-size flacons in their original sealed obsidian presentation box may be exchanged or returned within 14 days of delivery.',
  },
  {
    q: 'Can I include a gift card with my order?',
    a: 'Yes—complimentary gift notes are available on every order. Simply enter your dedication in the gift note field during checkout.',
  },
];

export const ContactPage: React.FC = () => {
  const { addInquiry, showToast } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('Fragrance Recommendation');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    addInquiry({
      name: name.trim(),
      email: email.trim(),
      topic,
      message: message.trim(),
    });
    setSubmitted(true);
    showToast('NORVA Concierge inquiry received. Our team will reply within 24 hours.');
  };

  return (
    <div className="bg-transparent text-[#f5f3ef]">
      <SEOHead
        title="Concierge & Support"
        description="Contact NORVA Haute Parfumerie for scent recommendations, order tracking, Cash on Delivery support, and gifting inquiries."
      />

      {/* Header */}
      <section className="relative overflow-hidden border-b border-white/[0.08] py-16 lg:py-20 bg-[#050508]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_75%_at_75%_35%,rgba(214,190,150,0.10),rgba(82,214,196,0.05)_50%,transparent_76%)]"
        />
        <div className="relative max-w-[1380px] mx-auto px-4 sm:px-8 space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#d6be96]">
            NORVA Client Concierge
          </p>
          <h1 className="font-serif-display text-5xl sm:text-6xl font-medium text-white leading-[1.02]">
            At Your Personal Service
          </h1>
          <p className="text-base text-white/62 max-w-2xl leading-relaxed">
            Whether seeking scent pairing advice among our five signature creations or assistance
            with an existing order, our concierge team responds within one business day.
          </p>
        </div>
      </section>

      {/* Contact Form & Salon Directory */}
      <section className="py-16 border-b border-white/[0.08]">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Form */}
          <div className="lg:col-span-7">
            <div className="p-7 sm:p-10 rounded-2xl bg-[#0a0a0f] border border-white/10 perfume-ambient-panel">
              {submitted ? (
                <div className="py-10 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-[#36d67e]/15 border border-[#36d67e]/40 flex items-center justify-center text-[#36d67e]">
                    <Check className="w-6 h-6" />
                  </div>
                  <h2 className="font-serif-display text-3xl text-white">
                    Thank You, {name}
                  </h2>
                  <p className="text-sm text-white/65 leading-relaxed max-w-lg">
                    Your message regarding <strong>{topic}</strong> has been logged with NORVA
                    Client Concierge. We will reply to <strong>{email}</strong> shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setMessage('');
                    }}
                    className="h-10 px-5 rounded-lg bg-[#12121b] hover:bg-[#191926] border border-white/12 text-xs font-medium text-white cursor-pointer"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h2 className="font-serif-display text-3xl text-white">Direct Inquiry</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-white/60 mb-1.5">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ahmed Khan"
                        className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/60 mb-1.5">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="client@domain.com"
                        className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-white/60 mb-1.5">Subject</label>
                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                    >
                      <option value="Fragrance Recommendation" className="bg-[#0a0a0f]">Fragrance Recommendation</option>
                      <option value="Order & Courier Support" className="bg-[#0a0a0f]">Order &amp; Courier Assistance</option>
                      <option value="Corporate & Event Gifting" className="bg-[#0a0a0f]">
                        Corporate &amp; Event Gifting
                      </option>
                      <option value="Wholesale & Collaborations" className="bg-[#0a0a0f]">
                        Wholesale &amp; Collaborations
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-white/60 mb-1.5">Message *</label>
                    <textarea
                      rows={5}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us which notes, occasions, or order details we can assist with..."
                      className="w-full p-3.5 rounded-lg bg-[#050508] border border-white/15 text-sm text-white focus:outline-none focus:border-[#d6be96]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="h-12 px-7 rounded-lg bg-[#f2e6d5] hover:bg-[#d6be96] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer"
                  >
                    Send Message
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Studios, Email & Social */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-7 rounded-2xl bg-[#0a0a0f] border border-white/10 perfume-ambient-panel space-y-5">
              <h3 className="font-serif-display text-2xl text-white">NORVA Studios &amp; Support</h3>

              <div className="space-y-4 text-sm text-white/70">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#d6be96] shrink-0 mt-1" />
                  <div>
                    <p className="font-medium text-white">Flagship Lounge — Karachi</p>
                    <p className="text-xs text-white/55">
                      Bukhari Commercial, DHA Phase 6, Karachi
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#36d67e] shrink-0 mt-1" />
                  <div>
                    <p className="font-medium text-white">Display Atelier — Lahore</p>
                    <p className="text-xs text-white/55">
                      MM Alam Road, Gulberg III, Lahore
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#d6be96] shrink-0 mt-1" />
                  <div>
                    <p className="font-medium text-white">concierge@norvaparfums.com</p>
                    <p className="text-xs text-white/55">orders@norvaparfums.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-[#25D366] shrink-0 mt-1" />
                  <div>
                    <a
                      href="https://wa.me/923012697458?text=Assalam%20o%20Alaikum%20NORVA!%20I%20would%20like%20to%20place%20an%20order."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono-tabular text-white hover:text-[#36d67e] transition-colors"
                    >
                      0301-2697458
                    </a>
                    <p className="text-xs text-white/55">Direct Client &amp; WhatsApp Order Desk</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-[#d6be96] shrink-0 mt-1" />
                  <div>
                    <p className="font-medium text-white">Monday – Saturday, 11:00 AM – 9:00 PM PKT</p>
                    <p className="text-xs text-white/55">Nationwide insured courier dispatch</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.07] flex items-center gap-5 text-xs text-white/60">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#d6be96] transition-colors"
                >
                  Instagram ↗
                </a>
                <a
                  href="https://pinterest.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#d6be96] transition-colors"
                >
                  Pinterest ↗
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#d6be96] transition-colors"
                >
                  Atelier Films ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="py-20">
        <div className="max-w-[920px] mx-auto px-4 sm:px-8 space-y-10">
          <div className="space-y-2 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#d6be96]">
              Frequently Asked Questions
            </p>
            <h2 className="font-serif-display text-4xl text-white">
              Pricing, Delivery &amp; Longevity
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((item, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-xl bg-[#0a0a0f] border border-white/[0.08] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span className="font-serif-display text-xl sm:text-2xl text-white">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#d6be96] shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm text-white/65 leading-relaxed border-t border-white/[0.05] pt-4">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
