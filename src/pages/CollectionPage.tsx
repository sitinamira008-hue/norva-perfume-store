import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  COLLECTIONS_META,
  CollectionSlug,
  FragranceFamily,
} from '../data/products';
import { useStore } from '../context/StoreContext';
import { LuxuryImage, ProductCard, SEOHead } from '../components/LuxuryUI';

const ALL_COLLECTION_SLUGS: CollectionSlug[] = [
  'signature',
  'mens',
  'womens',
  'unisex',
  'oud',
  'fresh',
];

export const CollectionPage: React.FC = () => {
  const { products } = useStore();
  const { collectionId } = useParams<{ collectionId: string }>();
  const validSlug: CollectionSlug = ALL_COLLECTION_SLUGS.includes(collectionId as CollectionSlug)
    ? (collectionId as CollectionSlug)
    : 'signature';

  const meta = COLLECTIONS_META[validSlug];

  const [familyFilter, setFamilyFilter] = useState<'All' | FragranceFamily>('All');
  const [sortOrder, setSortOrder] = useState<'featured' | 'name-asc'>('featured');

  const collectionProducts = useMemo(() => {
    const base = products.filter((p) => p.collections.includes(validSlug));
    const byFamily =
      familyFilter === 'All' ? base : base.filter((p) => p.family === familyFilter);

    if (sortOrder === 'name-asc') {
      return [...byFamily].sort((a, b) => a.name.localeCompare(b.name));
    }
    return byFamily;
  }, [products, validSlug, familyFilter, sortOrder]);

  const availableFamilies = useMemo(() => {
    const set = new Set<FragranceFamily>();
    products.filter((p) => p.collections.includes(validSlug)).forEach((p) => set.add(p.family));
    return ['All' as const, ...Array.from(set)];
  }, [products, validSlug]);

  return (
    <div className="bg-transparent text-[#f5f3ef] min-h-screen">
      <SEOHead title={meta.title} description={meta.description} />

      {/* Bespoke Collection Banner */}
      <section className="relative overflow-hidden border-b border-white/[0.08] bg-[#050508]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_62%_75%_at_76%_44%,rgba(214,190,150,0.12),rgba(128,88,218,0.06)_50%,transparent_76%)]"
        />
        <div className="relative max-w-[1380px] mx-auto px-4 sm:px-8 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#d6be96]">
              NORVA · {meta.kicker}
            </p>
            <h1 className="font-serif-display text-5xl sm:text-6xl font-medium text-white leading-[1.02]">
              {meta.title}
            </h1>
            <p className="text-base text-white/65 leading-relaxed max-w-2xl">{meta.description}</p>

            {/* Quick Collection Switcher */}
            <div className="pt-4 flex flex-wrap items-center gap-2">
              {ALL_COLLECTION_SLUGS.map((slug) => {
                const active = slug === validSlug;
                return (
                  <Link
                    key={slug}
                    to={`/collections/${slug}`}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#f2e6d5] text-[#050508]'
                        : 'bg-[#0a0a0f] text-white/65 border border-white/10 hover:text-white hover:border-white/25'
                    }`}
                  >
                    {COLLECTIONS_META[slug].title}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-white/12 bg-[#06060a] perfume-ambient-panel">
              <LuxuryImage
                src={meta.bannerImage}
                alt={meta.title}
                priority
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Filter Toolbar & Product Grid */}
      <section className="py-14">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
            <div className="flex flex-wrap items-center gap-2">
              {availableFamilies.map((fam) => (
                <button
                  key={fam}
                  type="button"
                  onClick={() => setFamilyFilter(fam)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    familyFilter === fam
                      ? 'bg-[#12121b] text-[#d6be96] border border-[#d6be96]/50'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  {fam === 'All' ? 'All Families' : fam}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono-tabular text-white/45">
                {collectionProducts.length}{' '}
                {collectionProducts.length === 1 ? 'Fragrance' : 'Fragrances'} · PKR 2,500
              </span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'featured' | 'name-asc')}
                aria-label="Sort collection"
                className="h-9 px-3 rounded-lg bg-[#0c0c12] border border-white/12 text-xs text-white focus:outline-none focus:border-[#d6be96]"
              >
                <option value="featured">Edition Order</option>
                <option value="name-asc">Alphabetical (A–Z)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {collectionProducts.map((product, idx) => (
              <ProductCard key={product.id} product={product} index={idx} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
