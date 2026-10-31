import React, { useMemo, useState } from 'react';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { FragranceFamily, formatPKR } from '../data/products';
import { useStore } from '../context/StoreContext';
import { ProductCard, SEOHead } from '../components/LuxuryUI';

type ShopCategoryTab = 'all' | 'bestsellers' | 'new' | 'mens' | 'womens';
type SortOption = 'featured' | 'name-asc' | 'name-desc';

const CATEGORY_TABS: { id: ShopCategoryTab; label: string }[] = [
  { id: 'all', label: 'All 5 Fragrances' },
  { id: 'bestsellers', label: 'Best Sellers' },
  { id: 'new', label: 'New Arrivals' },
  { id: 'mens', label: 'Men’s Picks' },
  { id: 'womens', label: 'Women’s Picks' },
];

const FAMILIES: ('All' | FragranceFamily)[] = [
  'All',
  'Oud & Amber',
  'Floral & Musk',
  'Fresh & Aquatic',
  'Floral & Citrus',
];

export const ShopAllPage: React.FC = () => {
  const { products } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ShopCategoryTab>('all');
  const [selectedFamily, setSelectedFamily] = useState<'All' | FragranceFamily>('All');
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [sortBy, setSortBy] = useState<SortOption>('featured');

  const getRepresentativePrice = (p: (typeof products)[number]) => p.sizes[0].price;

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = products.filter((p) => {
      if (activeCategory === 'bestsellers' && !p.isBestSeller) return false;
      if (activeCategory === 'new' && !p.isNewArrival) return false;
      if (activeCategory === 'mens' && !p.collections.includes('mens')) return false;
      if (activeCategory === 'womens' && !p.collections.includes('womens')) return false;

      if (selectedFamily !== 'All' && p.family !== selectedFamily) return false;

      const repPrice = getRepresentativePrice(p);
      if (repPrice > maxPrice) return false;

      if (q) {
        const hay = `${p.name} ${p.subtitle} ${p.keyNotesSummary} ${p.family} ${p.concentration} ${p.pyramid.top.join(' ')} ${p.pyramid.heart.join(' ')} ${p.pyramid.base.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    if (sortBy === 'name-asc') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'name-desc') {
      return [...list].sort((a, b) => b.name.localeCompare(a.name));
    }
    return list;
  }, [products, activeCategory, selectedFamily, maxPrice, searchQuery, sortBy]);

  const resetFilters = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setSelectedFamily('All');
    setMaxPrice(10000);
    setSortBy('featured');
  };

  return (
    <div className="bg-transparent text-[#f5f3ef] min-h-screen">
      <SEOHead
        title="Shop All 5 Signature Fragrances — PKR 2,500"
        description="Explore NORVA’s five signature extraits de parfum in smoked-glass 100 ml flacons — Khamrah Qawa, Cool Water, 9mM Rebel, Jadora, and Gucci Flora at PKR 2,500."
      />

      {/* Header */}
      <section className="relative overflow-hidden border-b border-white/[0.08] py-14 sm:py-20 bg-[#050508]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_62%_75%_at_75%_30%,rgba(214,190,150,0.11),rgba(138,92,226,0.06)_50%,transparent_76%)]"
        />
        <div className="relative max-w-[1380px] mx-auto px-4 sm:px-8 space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#d6be96]">
            NORVA Signature Catalog · PKR 2,500
          </p>
          <h1 className="font-serif-display text-5xl sm:text-6xl font-medium text-white leading-[1.02]">
            The Five Fragrances
          </h1>
          <p className="text-sm sm:text-base text-white/60 max-w-2xl leading-relaxed">
            Five curated haute parfumerie compositions in 100 ml smoked optical glass—each priced at
            PKR 2,500.
          </p>
        </div>
      </section>

      {/* Interactive Filter & Search Controls */}
      <section className="py-12">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-8 space-y-8">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_TABS.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`h-10 px-4 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#f2e6d5] text-[#050508]'
                      : 'bg-[#0a0a0f] text-white/65 border border-white/10 hover:text-white hover:border-[#d6be96]/35'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search + Olfactory Family + Price + Sort Toolbar */}
          <div className="p-5 rounded-xl bg-[#0a0a0f] border border-white/10 perfume-ambient-panel grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-end">
            {/* Search Input */}
            <div className="lg:col-span-4 space-y-1.5">
              <label className="block text-[11px] uppercase tracking-[0.16em] text-white/45">
                Search Notes or Name
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Oud, bergamot, rose, iris..."
                  className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-[#050508] border border-white/14 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#d6be96]"
                />
              </div>
            </div>

            {/* Fragrance Family Filter */}
            <div className="lg:col-span-3 space-y-1.5">
              <label className="block text-[11px] uppercase tracking-[0.16em] text-white/45">
                Fragrance Family
              </label>
              <select
                value={selectedFamily}
                onChange={(e) => setSelectedFamily(e.target.value as 'All' | FragranceFamily)}
                className="w-full h-11 px-3.5 rounded-lg bg-[#050508] border border-white/14 text-sm text-white focus:outline-none focus:border-[#d6be96]"
              >
                {FAMILIES.map((fam) => (
                  <option key={fam} value={fam} className="bg-[#0a0a0f]">
                    {fam === 'All' ? 'All Olfactory Families' : fam}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Ceiling Slider */}
            <div className="lg:col-span-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em]">
                <span className="text-white/45">Max Price</span>
                <span className="font-mono-tabular text-[#d6be96]">Up to {formatPKR(maxPrice)}</span>
              </div>
              <input
                type="range"
                min={1000}
                max={10000}
                step={250}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full h-2 cursor-pointer"
              />
            </div>

            {/* Sort By */}
            <div className="lg:col-span-2 space-y-1.5">
              <label className="block text-[11px] uppercase tracking-[0.16em] text-white/45">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full h-11 px-3 rounded-lg bg-[#050508] border border-white/14 text-sm text-white focus:outline-none focus:border-[#d6be96]"
              >
                <option value="featured" className="bg-[#0a0a0f]">
                  Edition 01 – 05
                </option>
                <option value="name-asc" className="bg-[#0a0a0f]">
                  Name (A–Z)
                </option>
                <option value="name-desc" className="bg-[#0a0a0f]">
                  Name (Z–A)
                </option>
              </select>
            </div>
          </div>

          {/* Results Count & Active Reset */}
          <div className="flex items-center justify-between text-xs text-white/50">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#d6be96]" />
              <span>
                Showing{' '}
                <strong className="text-white font-mono-tabular">{filteredProducts.length}</strong>{' '}
                of {products.length} signature fragrances
              </span>
            </div>

            {(searchQuery ||
              activeCategory !== 'all' ||
              selectedFamily !== 'All' ||
              maxPrice < 10000) && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-[#d6be96] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Product Grid or Clean Empty State */}
          {filteredProducts.length === 0 ? (
            <div className="py-20 text-center rounded-2xl bg-[#0a0a0f] border border-white/10 perfume-ambient-panel space-y-4">
              <p className="font-serif-display text-3xl text-white">
                No Fragrances Match Your Current Selection
              </p>
              <p className="text-sm text-white/55 max-w-md mx-auto">
                All five NORVA signature 100 ml flacons are priced at PKR 2,500. Reset filters to
                view the full collection.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="h-11 px-6 rounded-lg bg-[#f2e6d5] text-[#050508] text-xs font-semibold uppercase tracking-[0.14em] cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
              {filteredProducts.map((product, idx) => (
                <ProductCard key={product.id} product={product} index={idx} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
