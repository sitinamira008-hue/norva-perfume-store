import imgKhamrah from '../assets/images/khamrah_qawa_bottle_1793438382586.jpg';
import imgCoolWater from '../assets/images/cool_water_bottle_1793438384442.jpg';
const imgRebel = '/assets/aistudio/image_4faf920d.png';
import imgJadora from '../assets/images/jadora_rect_bottle_1793439318180.jpg';
import imgGucciFlora from '../assets/images/gucci_flora_rect_bottle_1793439318069.jpg';
import imgAtelier from '../assets/images/editorial_craftsmanship_atelier_1793434423009.jpg';

import { EssencePresetId } from '../webgl/FacetBottleScene';
import { BottleLabelContent } from '../webgl/labelTexture';

export const ATELIER_HERO_IMAGE = imgAtelier;

export function formatPKR(amount: number): string {
  return `PKR ${amount.toLocaleString('en-PK')}`;
}

export type FragranceFamily =
  | 'Oud & Amber'
  | 'Floral & Musk'
  | 'Fresh & Aquatic'
  | 'Floral & Citrus';

export type CollectionSlug =
  | 'signature'
  | 'mens'
  | 'womens'
  | 'unisex'
  | 'oud'
  | 'fresh';

export interface ProductSizeOption {
  label: string;
  price: number;
  sku: string;
}

export interface ProductReview {
  id: string;
  author: string;
  location: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  numberCode: string;
  name: string;
  subtitle: string;
  concentration: string;
  family: FragranceFamily;
  collections: CollectionSlug[];
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  isSignature?: boolean;
  shortDescription: string;
  editorialStory: string;
  keyNotesSummary: string;
  pyramid: {
    top: string[];
    heart: string[];
    base: string[];
  };
  longevityLabel: string;
  longevityScore: number; // 1-100
  projectionLabel: string;
  projectionScore: number; // 1-100
  sizes: ProductSizeOption[];
  primaryImage: string;
  gallery: { src: string; caption: string }[];
  bottle3D: {
    preset: EssencePresetId;
    label: BottleLabelContent;
  };
  reviews: ProductReview[];
}

export const PRODUCTS: CatalogProduct[] = [
  // =========================================================================
  // 01 — KHAMRAH QAWA
  // =========================================================================
  {
    id: 'frag-01',
    slug: 'khamrah-qawa',
    numberCode: '01',
    name: 'Khamrah Qawa',
    subtitle: 'Dark, mysterious, sophisticated.',
    concentration: 'Extrait de Parfum',
    family: 'Oud & Amber',
    collections: ['signature', 'oud', 'mens', 'unisex'],
    isSignature: true,
    isBestSeller: true,
    shortDescription:
      'A nocturnal study in smoked Cambodian oud, supple saddle leather, black amber resin, and ceremonial saffron.',
    editorialStory:
      'Macerated for ninety days in dark smoked silica vats, Khamrah Qawa opens with darkly roasted Arabica and crimson saffron threads before descending into a velvet core of smoked leather, aged Cambodian oud, and molten labdanum amber. Built for evenings that linger into dawn.',
    keyNotesSummary: 'Oud · Leather · Amber · Saffron',
    pyramid: {
      top: ['Crimson Saffron', 'Roasted Arabica Bean', 'Green Cardamom'],
      heart: ['Smoked Saddle Leather', 'Damascus Black Plum', 'Incense Smoke'],
      base: ['Aged Cambodian Oud', 'Black Amber Resin', 'Roasted Tonka'],
    },
    longevityLabel: '12–14 Hours on Skin',
    longevityScore: 95,
    projectionLabel: 'Commanding Architectural Trail',
    projectionScore: 88,
    sizes: [{ label: '50ml', price: 2500, sku: 'NV-KQ-50' }],
    primaryImage: imgKhamrah,
    gallery: [{ src: imgKhamrah, caption: 'Khamrah Qawa — Signature Flacon' }],
    bottle3D: {
      preset: 'amber',
      label: {
        kicker: 'FRAGRANCE 01 · EXTRAIT',
        titleLine1: 'Khamrah',
        titleLine2: 'Qawa',
        notesLine: 'Oud · Leather · Amber · Saffron',
        concentration: 'EXTRAIT DE PARFUM',
        volume: '50 ML',
        editionCode: 'N° 01 · OUD',
      },
    },
    reviews: [
      {
        id: 'rev-kq-1',
        author: 'Zain Raza',
        location: 'Lahore',
        rating: 5,
        date: 'October 2026',
        title: 'Unmatched depth and smoked-leather drydown',
        comment:
          'One spray on a waistcoat or blazer lasts for days. The saffron and dark coffee facets balance the richness of the oud effortlessly.',
      },
      {
        id: 'rev-kq-2',
        author: 'Areeba Tariq',
        location: 'Karachi',
        rating: 5,
        date: 'September 2026',
        title: 'True gallery-grade perfumery',
        comment:
          'Both the heavy smoked crystal flacon and the oil concentration feel far more luxurious than anything else in my collection.',
      },
    ],
  },

  // =========================================================================
  // 02 — COOL WATER
  // =========================================================================
  {
    id: 'frag-02',
    slug: 'cool-water',
    numberCode: '02',
    name: 'Cool Water',
    subtitle: 'Elegant, romantic and sensual.',
    concentration: 'Eau de Parfum Intense',
    family: 'Floral & Musk',
    collections: ['signature', 'womens', 'unisex'],
    isSignature: true,
    isBestSeller: true,
    shortDescription:
      'Moonlit Centifolia rose and night-blooming jasmine suspended in warm Madagascar vanilla and skin-close white silk musk.',
    editorialStory:
      'Reimagining nocturnal romance through translucent chiaroscuro, Cool Water drapes dewy Grasse rose petals and narcotic Sambac jasmine across a tactile foundation of raw Madagascar vanilla bean and weightless cashmere musk.',
    keyNotesSummary: 'Rose · Vanilla · Musk · Jasmine',
    pyramid: {
      top: ['Dewy Centifolia Rose', 'Pink Peppercorn', 'Bergamot Mist'],
      heart: ['Night-Blooming Jasmine', 'Sambac Absolute', 'Velvet Peony'],
      base: ['Madagascar Bourbon Vanilla', 'White Silk Musk', 'Soft Ambergris'],
    },
    longevityLabel: '9–11 Hours on Skin',
    longevityScore: 86,
    projectionLabel: 'Sensual Luminous Aura',
    projectionScore: 76,
    sizes: [{ label: '50ml', price: 2500, sku: 'NV-CW-50' }],
    primaryImage: imgCoolWater,
    gallery: [{ src: imgCoolWater, caption: 'Cool Water — Frosted Cobalt & Seafoam Flacon' }],
    bottle3D: {
      preset: 'cobalt',
      label: {
        kicker: 'FRAGRANCE 02 · INTENSE',
        titleLine1: 'Cool',
        titleLine2: 'Water',
        notesLine: 'Rose · Vanilla · Musk · Jasmine',
        concentration: 'EAU DE PARFUM INTENSE',
        volume: '50 ML',
        editionCode: 'N° 02 · FLORAL',
      },
    },
    reviews: [
      {
        id: 'rev-cw-1',
        author: 'Maham Siddiqui',
        location: 'Islamabad',
        rating: 5,
        date: 'October 2026',
        title: 'Velvety, intimate, endlessly complimented',
        comment:
          'The balance between dewy rose, night jasmine, and warm vanilla feels effortlessly sophisticated—never overly sweet, purely sensual.',
      },
    ],
  },

  // =========================================================================
  // 03 — 9mM REBEL
  // =========================================================================
  {
    id: 'frag-03',
    slug: '9mm-rebel',
    numberCode: '03',
    name: '9mM Rebel',
    subtitle: 'Fresh, aquatic and modern.',
    concentration: 'Eau de Parfum',
    family: 'Fresh & Aquatic',
    collections: ['signature', 'fresh', 'mens', 'unisex'],
    isSignature: true,
    isNewArrival: true,
    shortDescription:
      'Crisp Calabrian bergamot and cold Atlantic marine accords anchored by dry Atlas cedarwood and mineral vetiver.',
    editorialStory:
      'Cut like architectural glass against storm-dark sea cliffs, 9mM Rebel pairs electric cold-pressed Calabrian bergamot with ozonic marine spray and crushed violet leaf over a razor-clean spine of dry Atlas cedarwood.',
    keyNotesSummary: 'Bergamot · Marine Accords · Cedarwood',
    pyramid: {
      top: ['Calabrian Bergamot', 'Sea Salt Spray', 'Crushed Green Mint'],
      heart: ['Cold Marine Accords', 'Crushed Violet Leaf', 'Black Tellicherry Pepper'],
      base: ['Dry Atlas Cedarwood', 'Mineral Haitian Vetiver', 'Crystalline Ambroxan'],
    },
    longevityLabel: '8–10 Hours on Skin',
    longevityScore: 84,
    projectionLabel: 'Crisp Architectural Sillage',
    projectionScore: 82,
    sizes: [{ label: '50ml', price: 2500, sku: 'NV-9R-50' }],
    primaryImage: imgRebel,
    gallery: [{ src: imgRebel, caption: '9mM Rebel — Matte Noir & Smoked Obsidian Flacon' }],
    bottle3D: {
      preset: 'noir',
      label: {
        kicker: 'FRAGRANCE 03 · MODERN AQUATIC',
        titleLine1: '9PM',
        titleLine2: 'Rebel',
        notesLine: 'Bergamot · Marine Accords · Cedarwood',
        concentration: 'EAU DE PARFUM',
        volume: '50 ML',
        editionCode: 'N° 03 · MARINE',
      },
    },
    reviews: [
      {
        id: 'rev-9r-1',
        author: 'Hamza Malik',
        location: 'Karachi',
        rating: 5,
        date: 'October 2026',
        title: 'An aquatic that actually lasts all day in heat',
        comment:
          'Crisp bergamot and marine notes upfront with a super clean cedarwood dry-down that stays noticeable from morning till night.',
      },
    ],
  },

  // =========================================================================
  // 04 — JADORA
  // =========================================================================
  {
    id: 'frag-04',
    slug: 'jadora',
    numberCode: '04',
    name: 'Jadora',
    subtitle: 'Rich, warm and luxurious.',
    concentration: 'Extrait de Parfum',
    family: 'Oud & Amber',
    collections: ['signature', 'oud', 'womens', 'unisex'],
    isSignature: true,
    isBestSeller: true,
    shortDescription:
      'Opulent aged oud, creamy Mysore sandalwood, golden amber, and roasted exotic spices in a luminous extrait.',
    editorialStory:
      'Crafted with a 34% pure perfume oil concentration, Jadora wraps buttery aged sandalwood and toasted Ceylon spices around a heart of golden benzoin amber and sweet resinous oud.',
    keyNotesSummary: 'Oud · Sandalwood · Amber · Spices',
    pyramid: {
      top: ['Ceylon Cinnamon Bark', 'Warm Nutmeg', 'Bitter Blood Orange'],
      heart: ['Creamy Mysore Sandalwood', 'Clove Bud', 'Olibanum Tear'],
      base: ['Royal Resinous Oud', 'Golden Labdanum Amber', 'Siam Benzoin'],
    },
    longevityLabel: '14+ Hours on Skin',
    longevityScore: 98,
    projectionLabel: 'Opulent Enveloping Warmth',
    projectionScore: 91,
    sizes: [{ label: '50ml', price: 2500, sku: 'NV-JD-50' }],
    primaryImage: imgJadora,
    gallery: [
      { src: imgJadora, caption: 'Jadora — Smoked Champagne Flacon on Nero Marquina Marble' },
    ],
    bottle3D: {
      preset: 'champagne',
      label: {
        kicker: 'FRAGRANCE 04 · PURE EXTRAIT',
        titleLine1: 'Jadora',
        titleLine2: 'Parfum',
        notesLine: 'Oud · Sandalwood · Amber · Spices',
        concentration: 'EXTRAIT DE PARFUM',
        volume: '50 ML',
        editionCode: 'N° 04 · AMBER',
      },
    },
    reviews: [
      {
        id: 'rev-jd-1',
        author: 'Sana Farooq',
        location: 'Lahore',
        rating: 5,
        date: 'September 2026',
        title: 'Pure molten gold for evening events',
        comment:
          'The sandalwood is impossibly creamy and the spiced amber dry-down radiates luxury without feeling overwhelming.',
      },
    ],
  },

  // =========================================================================
  // 05 — GUCCI FLORA
  // =========================================================================
  {
    id: 'frag-05',
    slug: 'gucci-flora',
    numberCode: '05',
    name: 'Gucci Flora',
    subtitle: 'Clean, soft and refreshing.',
    concentration: 'Eau de Parfum',
    family: 'Floral & Citrus',
    collections: ['signature', 'fresh', 'womens', 'unisex'],
    isSignature: true,
    isNewArrival: true,
    shortDescription:
      'Crystalline white musk, three-year aged Florentine iris pallida, sunlit Sicilian citrus, and pale cashmere wood.',
    editorialStory:
      'Inspired by morning light refracting through clear optical prisms, Gucci Flora opens with sparkling Sicilian citrus and neroli blossom before settling into powdery Florentine orris butter, sheer white musk, and blond cashmere wood.',
    keyNotesSummary: 'White Musk · Iris · Citrus · Cashmere Wood',
    pyramid: {
      top: ['Sicilian Meyer Lemon', 'White Bergamot', 'Neroli Blossom'],
      heart: ['Florentine Iris Pallida', 'Steamed White Tea', 'Freesia Petal'],
      base: ['Sheer White Musk', 'Blond Cashmere Wood', 'Ambrette Seed'],
    },
    longevityLabel: '8–10 Hours on Skin',
    longevityScore: 82,
    projectionLabel: 'Refined Luminous Veil',
    projectionScore: 72,
    sizes: [{ label: '50ml', price: 2500, sku: 'NV-GF-50' }],
    primaryImage: imgGucciFlora,
    gallery: [
      { src: imgGucciFlora, caption: 'Gucci Flora — Smoked Amethyst & Optical Crystal Flacon' },
    ],
    bottle3D: {
      preset: 'obsidian',
      label: {
        kicker: 'FRAGRANCE 05 · LUMINOUS IRIS',
        titleLine1: 'Gucci',
        titleLine2: 'Flora',
        notesLine: 'White Musk · Iris · Citrus · Cashmere',
        concentration: 'EAU DE PARFUM',
        volume: '50 ML',
        editionCode: 'N° 05 · IRIS',
      },
    },
    reviews: [
      {
        id: 'rev-gf-1',
        author: 'Hira Daniyal',
        location: 'Islamabad',
        rating: 5,
        date: 'October 2026',
        title: 'Effortless everyday signature',
        comment:
          'Smells like crisp linen, soft iris, and fresh citrus sunlight. Clean, soft, and refreshing all day.',
      },
    ],
  },
];

export interface CollectionMeta {
  slug: CollectionSlug;
  title: string;
  kicker: string;
  description: string;
  bannerImage: string;
}

export const COLLECTIONS_META: Record<CollectionSlug, CollectionMeta> = {
  signature: {
    slug: 'signature',
    title: 'The Signature Five',
    kicker: 'Haute Parfumerie Wardrobe',
    description:
      'All five cornerstone olfactory sculptures—each bottled in 50ml smoked optical silica at PKR 2,500.',
    bannerImage: imgKhamrah,
  },
  mens: {
    slug: 'mens',
    title: 'Men’s Fragrances',
    kicker: 'Architectural Woods, Leather & Marine',
    description:
      'Commanding extraits and crisp mineral compositions structured around smoked oud, saddle leather, Calabrian bergamot, and dry Atlas cedarwood.',
    bannerImage: imgRebel,
  },
  womens: {
    slug: 'womens',
    title: 'Women’s Fragrances',
    kicker: 'Luminous Florals, Silk Musk & Golden Amber',
    description:
      'Sensual chiaroscuro compositions weaving Grasse rose, Florentine iris pallida, night-blooming jasmine, and spiced Mysore sandalwood.',
    bannerImage: imgCoolWater,
  },
  unisex: {
    slug: 'unisex',
    title: 'Unisex Fragrances',
    kicker: 'Genderless Olfactory Architecture',
    description:
      'Every NORVA creation is composed without convention—designed to adapt to skin chemistry with enduring depth and clarity.',
    bannerImage: imgJadora,
  },
  oud: {
    slug: 'oud',
    title: 'The Oud Collection',
    kicker: 'Rare Resins & Dark Agarwood',
    description:
      'Sustainably harvested Cambodian and royal agarwood steeped with saffron, leather, sandalwood, and molten labdanum.',
    bannerImage: imgKhamrah,
  },
  fresh: {
    slug: 'fresh',
    title: 'The Fresh Collection',
    kicker: 'Mineral Marine, Citrus & Iris',
    description:
      'Sunlit Sicilian citrus, cold Atlantic sea spray, crushed mint, and sheer cashmere wood with extraordinary longevity.',
    bannerImage: imgGucciFlora,
  },
};

export function getProductBySlug(slug?: string): CatalogProduct | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}
