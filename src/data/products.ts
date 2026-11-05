import imgKhamrahWebp from '../assets/images/optimized/khamrah_qawa.webp';
import imgKhamrahJpg from '../assets/images/optimized/khamrah_qawa.jpg';
import imgCoolWaterWebp from '../assets/images/optimized/cool_water.webp';
import imgCoolWaterJpg from '../assets/images/optimized/cool_water.jpg';
import imgRebelWebp from '../assets/images/optimized/9mm_rebel.webp';
import imgRebelJpg from '../assets/images/optimized/9mm_rebel.jpg';
import imgJadoraWebp from '../assets/images/optimized/jadora.webp';
import imgJadoraJpg from '../assets/images/optimized/jadora.jpg';
import imgGucciFloraWebp from '../assets/images/optimized/gucci_flora.webp';
import imgGucciFloraJpg from '../assets/images/optimized/gucci_flora.jpg';

import type { BottleLabelContent, EssencePresetId } from '../webgl/bottleTypes';

/**
 * Maps any primary image URL (WebP or JPEG) to its WebP + progressive JPEG pair
 * so `<LuxuryImage>` automatically serves lightweight WebP (20–37 KB) on modern browsers
 * and progressive JPEG (26–60 KB) on legacy Windows 7 browsers without extra props.
 */
export const IMAGE_ASSET_PAIR_MAP: Record<string, { webp: string; jpg: string }> = {
  [imgKhamrahWebp]: { webp: imgKhamrahWebp, jpg: imgKhamrahJpg },
  [imgKhamrahJpg]: { webp: imgKhamrahWebp, jpg: imgKhamrahJpg },
  [imgCoolWaterWebp]: { webp: imgCoolWaterWebp, jpg: imgCoolWaterJpg },
  [imgCoolWaterJpg]: { webp: imgCoolWaterWebp, jpg: imgCoolWaterJpg },
  [imgRebelWebp]: { webp: imgRebelWebp, jpg: imgRebelJpg },
  [imgRebelJpg]: { webp: imgRebelWebp, jpg: imgRebelJpg },
  [imgJadoraWebp]: { webp: imgJadoraWebp, jpg: imgJadoraJpg },
  [imgJadoraJpg]: { webp: imgJadoraWebp, jpg: imgJadoraJpg },
  [imgGucciFloraWebp]: { webp: imgGucciFloraWebp, jpg: imgGucciFloraJpg },
  [imgGucciFloraJpg]: { webp: imgGucciFloraWebp, jpg: imgGucciFloraJpg },
};

export type FragranceFamily =
  | 'Oud & Amber'
  | 'Floral & Musk'
  | 'Fresh & Aquatic'
  | 'Floral & Citrus';

export type ScentFamily = FragranceFamily;

export type CollectionSlug = 'signature' | 'mens' | 'womens' | 'unisex' | 'oud' | 'fresh';

export type GenderProfile = 'Unisex' | 'Masculine-Leaning' | 'Feminine-Leaning';

export interface ProductSizeOption {
  label: string;
  ml: number;
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
  editionNumber: string;
  name: string;
  subtitle: string;
  concentration: 'Extrait de Parfum' | 'Eau de Parfum Intense' | 'Eau de Parfum';
  oilConcentrationPct: number;
  family: FragranceFamily;
  gender: GenderProfile;
  collections: CollectionSlug[];
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  rating: number;
  reviewCount: number;
  keyNotesSummary: string;
  shortDescription: string;
  description: string;
  editorialStory: string;
  longevityLabel: string;
  longevityScore: number;
  projectionLabel: string;
  projectionScore: number;
  pyramid: {
    top: string[];
    heart: string[];
    base: string[];
  };
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  ingredients: string;
  primaryImage: string;
  primaryImageFallback: string;
  gallery: { src: string; caption: string }[];
  sizes: ProductSizeOption[];
  bottle3D: {
    preset: EssencePresetId;
    label: BottleLabelContent;
  };
  essencePreset: EssencePresetId;
  bottleLabel: BottleLabelContent;
  reviews: ProductReview[];
}

export interface CollectionMetaItem {
  title: string;
  kicker: string;
  description: string;
  bannerImage: string;
}

export const COLLECTIONS_META: Record<CollectionSlug, CollectionMetaItem> = {
  signature: {
    title: 'Signature Wardrobe',
    kicker: 'House Icons',
    description:
      'All five NORVA 50ml extraits and eaux de parfum—crafted in smoked optical glass for extraordinary 10–14 hour longevity at PKR 2,500.',
    bannerImage: imgKhamrahJpg,
  },
  mens: {
    title: 'Men’s Picks',
    kicker: 'Commanding Presence',
    description:
      'Crisp marine accords, roasted pineapple, smoked leather, and cedarwood tailored for lasting masculine presence.',
    bannerImage: imgRebelJpg,
  },
  womens: {
    title: 'Women’s Picks',
    kicker: 'Luminous Florals',
    description:
      'Radiant white gardenia, jasmine sambac, powdery iris, and creamy golden sandalwood.',
    bannerImage: imgGucciFloraJpg,
  },
  unisex: {
    title: 'Unisex Icons',
    kicker: 'Shared Luxury',
    description:
      'Balanced oud, spiced Arabica coffee, amber resin, and warm woods created to adapt effortlessly to every wearer.',
    bannerImage: imgKhamrahJpg,
  },
  oud: {
    title: 'Oud & Dark Woods',
    kicker: 'Evening & Statement',
    description:
      'Deep resinous oud, saffron, dark leather, and creamy sandalwood built for cool nights and formal occasions.',
    bannerImage: imgJadoraJpg,
  },
  fresh: {
    title: 'Fresh & Luminous',
    kicker: 'Daytime & Crisp',
    description:
      'Invigorating sea breeze, bergamot, crisp orchard fruit, and second-skin white musk formulated for warm weather.',
    bannerImage: imgCoolWaterJpg,
  },
};

export const PRODUCTS: CatalogProduct[] = [
  {
    id: 'frag-01',
    slug: 'khamrah-qawa',
    numberCode: '01',
    editionNumber: 'N° 01',
    name: 'Khamrah Qawa',
    subtitle: 'Smoked Oud, Spiced Coffee & Warm Amber',
    concentration: 'Extrait de Parfum',
    oilConcentrationPct: 30,
    family: 'Oud & Amber',
    gender: 'Unisex',
    collections: ['signature', 'unisex', 'oud', 'mens'],
    isBestSeller: true,
    rating: 4.9,
    reviewCount: 142,
    keyNotesSummary: 'Saffron · Roasted Coffee · Smoked Leather · Black Amber',
    shortDescription:
      'Khamrah Qawa opens with warm cardamom, saffron, and dark roasted coffee bean before settling into supple leather, oud wood, and golden amber resin.',
    description:
      'Khamrah Qawa opens with warm cardamom, saffron, and dark roasted coffee bean before settling into supple leather, oud wood, and golden amber resin. Rich, smooth, and built to project effortlessly into the night.',
    editorialStory:
      'Compounded at 30% aromatic oil concentration and cold-macerated to unite spiced roasted Arabica warmth with smoky resinous woods and velvety benzoin.',
    longevityLabel: '12 – 14+ Hours on Skin',
    longevityScore: 96,
    projectionLabel: 'Enveloping Evening Trail',
    projectionScore: 92,
    pyramid: {
      top: ['Saffron', 'Cardamom', 'Roasted Coffee'],
      heart: ['Smoked Leather', 'Dark Oud', 'Incense'],
      base: ['Black Amber', 'Benzoin', 'Warm Vanilla'],
    },
    topNotes: ['Saffron', 'Cardamom', 'Roasted Coffee'],
    heartNotes: ['Smoked Leather', 'Dark Oud', 'Incense'],
    baseNotes: ['Black Amber', 'Benzoin', 'Warm Vanilla'],
    ingredients:
      'Alcohol Denat., Parfum (Fragrance), Aqua (Water), Coumarin, Linalool, Limonene, Eugenol, Cinnamal.',
    primaryImage: imgKhamrahJpg,
    primaryImageFallback: imgKhamrahJpg,
    gallery: [
      {
        src: imgKhamrahJpg,
        caption: 'Khamrah Qawa · 50ml Smoked Amber Flacon',
      },
    ],
    sizes: [{ label: '50ml', ml: 50, price: 2500, sku: 'NV-01-50' }],
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
    essencePreset: 'amber',
    bottleLabel: {
      kicker: 'FRAGRANCE 01 · EXTRAIT',
      titleLine1: 'Khamrah',
      titleLine2: 'Qawa',
      notesLine: 'Oud · Leather · Amber · Saffron',
      concentration: 'EXTRAIT DE PARFUM',
      volume: '50 ML',
      editionCode: 'N° 01 · OUD',
    },
    reviews: [
      {
        id: 'rev-101',
        author: 'Hamza R.',
        location: 'Lahore',
        rating: 5,
        date: 'Feb 14, 2025',
        title: 'Incredible projection and lasting',
        comment:
          'Two sprays easily last the entire evening on clothes. Warm coffee and amber dry-down feels way above its price point.',
      },
      {
        id: 'rev-102',
        author: 'Zainab M.',
        location: 'Islamabad',
        rating: 5,
        date: 'Jan 29, 2025',
        title: 'My go-to winter evening scent',
        comment:
          'Smooth spiced oud without any harshness. Packaging and bottle presentation are spotless.',
      },
    ],
  },
  {
    id: 'frag-02',
    slug: 'cool-water',
    numberCode: '02',
    editionNumber: 'N° 02',
    name: 'Cool Water',
    subtitle: 'Crisp Marine Breeze, Mint & Clean Musk',
    concentration: 'Eau de Parfum Intense',
    oilConcentrationPct: 24,
    family: 'Fresh & Aquatic',
    gender: 'Masculine-Leaning',
    collections: ['signature', 'mens', 'fresh'],
    isBestSeller: true,
    rating: 4.8,
    reviewCount: 118,
    keyNotesSummary: 'Sea Breeze · Peppermint · Lavender · Cedarwood',
    shortDescription:
      'Cool Water delivers an invigorating wave of chilled sea breeze, bright bergamot, and aromatic lavender over a crisp base of cedarwood and white musk.',
    description:
      'Cool Water delivers an invigorating wave of chilled sea breeze, bright bergamot, and aromatic lavender over a crisp base of cedarwood and white musk. Effortlessly clean and refreshing.',
    editorialStory:
      'Re-engineered at Eau de Parfum Intense strength specifically for warm climates—preserving crisp coastal freshness from morning commute through evening.',
    longevityLabel: '8 – 10 Hours on Skin',
    longevityScore: 86,
    projectionLabel: 'Crisp Refined Aura',
    projectionScore: 82,
    pyramid: {
      top: ['Sea Breeze', 'Peppermint', 'Bergamot'],
      heart: ['Lavender', 'Geranium', 'Neroli'],
      base: ['Cedarwood', 'White Musk', 'Ambergris Accord'],
    },
    topNotes: ['Sea Breeze', 'Peppermint', 'Bergamot'],
    heartNotes: ['Lavender', 'Geranium', 'Neroli'],
    baseNotes: ['Cedarwood', 'White Musk', 'Ambergris Accord'],
    ingredients:
      'Alcohol Denat., Parfum (Fragrance), Aqua (Water), Limonene, Linalool, Citral, Citronellol, Geraniol.',
    primaryImage: imgCoolWaterJpg,
    primaryImageFallback: imgCoolWaterJpg,
    gallery: [
      {
        src: imgCoolWaterJpg,
        caption: 'Cool Water · 50ml Frosted Cobalt Flacon',
      },
    ],
    sizes: [{ label: '50ml', ml: 50, price: 2500, sku: 'NV-02-50' }],
    bottle3D: {
      preset: 'cobalt',
      label: {
        kicker: 'FRAGRANCE 02 · INTENSE',
        titleLine1: 'Cool',
        titleLine2: 'Water',
        notesLine: 'Marine Breeze · Lavender · Cedar · Musk',
        concentration: 'EAU DE PARFUM INTENSE',
        volume: '50 ML',
        editionCode: 'N° 02 · MARINE',
      },
    },
    essencePreset: 'cobalt',
    bottleLabel: {
      kicker: 'FRAGRANCE 02 · INTENSE',
      titleLine1: 'Cool',
      titleLine2: 'Water',
      notesLine: 'Marine Breeze · Lavender · Cedar · Musk',
      concentration: 'EAU DE PARFUM INTENSE',
      volume: '50 ML',
      editionCode: 'N° 02 · MARINE',
    },
    reviews: [
      {
        id: 'rev-201',
        author: 'Bilal K.',
        location: 'Karachi',
        rating: 5,
        date: 'Feb 19, 2025',
        title: 'Perfect for Karachi heat',
        comment:
          'Super clean, cooling, and fresh. Unlike regular freshies, this actually stays noticeable through a full workday.',
      },
    ],
  },
  {
    id: 'frag-03',
    slug: '9mm-rebel',
    numberCode: '03',
    editionNumber: 'N° 03',
    name: '9mM Rebel',
    subtitle: 'Smoky Pineapple, Bergamot & Dark Woods',
    concentration: 'Eau de Parfum',
    oilConcentrationPct: 25,
    family: 'Fresh & Aquatic',
    gender: 'Masculine-Leaning',
    collections: ['signature', 'mens', 'unisex', 'fresh', 'oud'],
    isBestSeller: true,
    isNewArrival: true,
    rating: 4.9,
    reviewCount: 96,
    keyNotesSummary: 'Roasted Pineapple · Bergamot · Dry Cedarwood · Ambroxan',
    shortDescription:
      '9mM Rebel strikes with vibrant mandarin, crisp apple, and caramelized pineapple before transitioning into dry cedarwood, oakmoss, and magnetic smoky ambroxan.',
    description:
      '9mM Rebel strikes with vibrant mandarin, crisp apple, and caramelized pineapple before transitioning into dry cedarwood, oakmoss, and magnetic smoky ambroxan. Bold, modern, and compliment-pulling.',
    editorialStory:
      'Built around a high-contrast accord of bright fruit top notes anchored by smoky woods and mineral ambroxan for commanding all-season versatility.',
    longevityLabel: '10 – 12 Hours on Skin',
    longevityScore: 91,
    projectionLabel: 'Commanding Trail',
    projectionScore: 90,
    pyramid: {
      top: ['Pineapple', 'Mandarin', 'Granny Smith Apple'],
      heart: ['Dry Cedarwood', 'Oakmoss', 'Vanilla'],
      base: ['Ambroxan', 'Smoky Woods', 'Dry Musk'],
    },
    topNotes: ['Pineapple', 'Mandarin', 'Granny Smith Apple'],
    heartNotes: ['Dry Cedarwood', 'Oakmoss', 'Vanilla'],
    baseNotes: ['Ambroxan', 'Smoky Woods', 'Dry Musk'],
    ingredients:
      'Alcohol Denat., Parfum (Fragrance), Aqua (Water), Limonene, Linalool, Citral, Coumarin.',
    primaryImage: imgRebelJpg,
    primaryImageFallback: imgRebelJpg,
    gallery: [
      {
        src: imgRebelJpg,
        caption: '9mM Rebel · 50ml Matte Noir Flacon',
      },
    ],
    sizes: [{ label: '50ml', ml: 50, price: 2500, sku: 'NV-03-50' }],
    bottle3D: {
      preset: 'noir',
      label: {
        kicker: 'FRAGRANCE 03 · EXTRAIT',
        titleLine1: '9mM',
        titleLine2: 'Rebel',
        notesLine: 'Pineapple · Bergamot · Cedarwood · Amber',
        concentration: 'EAU DE PARFUM',
        volume: '50 ML',
        editionCode: 'N° 03 · REBEL',
      },
    },
    essencePreset: 'noir',
    bottleLabel: {
      kicker: 'FRAGRANCE 03 · EXTRAIT',
      titleLine1: '9mM',
      titleLine2: 'Rebel',
      notesLine: 'Pineapple · Bergamot · Cedarwood · Amber',
      concentration: 'EAU DE PARFUM',
      volume: '50 ML',
      editionCode: 'N° 03 · REBEL',
    },
    reviews: [
      {
        id: 'rev-301',
        author: 'Saad A.',
        location: 'Rawalpindi',
        rating: 5,
        date: 'Feb 08, 2025',
        title: 'Instant compliments',
        comment:
          'That pineapple and smoky wood combo is addictive. Easily one of the strongest performers in my collection.',
      },
    ],
  },
  {
    id: 'frag-04',
    slug: 'jadora',
    numberCode: '04',
    editionNumber: 'N° 04',
    name: 'Jadora',
    subtitle: 'Luminous Jasmine, Golden Pear & Warm Sandalwood',
    concentration: 'Extrait de Parfum',
    oilConcentrationPct: 28,
    family: 'Floral & Musk',
    gender: 'Feminine-Leaning',
    collections: ['signature', 'womens', 'oud'],
    rating: 4.9,
    reviewCount: 109,
    keyNotesSummary: 'Pear Blossom · Jasmine Sambac · Damascus Rose · Sandalwood',
    shortDescription:
      'Jadora weaves radiant pear blossom and mandarin into an opulent heart of jasmine sambac, ylang-ylang, and Damascus rose over creamy golden sandalwood.',
    description:
      'Jadora weaves radiant pear blossom and mandarin into an opulent heart of jasmine sambac, ylang-ylang, and Damascus rose over creamy golden sandalwood and velvet musk.',
    editorialStory:
      'A sunlit floral bouquet balanced with smooth Mysore-style sandalwood and warm golden amber—graceful, polished, and unmistakably celebratory.',
    longevityLabel: '10 – 12 Hours on Skin',
    longevityScore: 92,
    projectionLabel: 'Radiant Floral Sillage',
    projectionScore: 88,
    pyramid: {
      top: ['Pear Blossom', 'Sweet Mandarin', 'Bergamot'],
      heart: ['Jasmine Sambac', 'Ylang-Ylang', 'Damascus Rose'],
      base: ['Creamy Sandalwood', 'Golden Amber', 'Velvet Musk'],
    },
    topNotes: ['Pear Blossom', 'Sweet Mandarin', 'Bergamot'],
    heartNotes: ['Jasmine Sambac', 'Ylang-Ylang', 'Damascus Rose'],
    baseNotes: ['Creamy Sandalwood', 'Golden Amber', 'Velvet Musk'],
    ingredients:
      'Alcohol Denat., Parfum (Fragrance), Aqua (Water), Benzyl Salicylate, Linalool, Hexyl Cinnamal, Citronellol.',
    primaryImage: imgJadoraJpg,
    primaryImageFallback: imgJadoraJpg,
    gallery: [
      {
        src: imgJadoraJpg,
        caption: 'Jadora · 50ml Champagne Gold Flacon',
      },
    ],
    sizes: [{ label: '50ml', ml: 50, price: 2500, sku: 'NV-04-50' }],
    bottle3D: {
      preset: 'champagne',
      label: {
        kicker: 'FRAGRANCE 04 · PURE EXTRAIT',
        titleLine1: 'Jadora',
        titleLine2: 'Parfum',
        notesLine: 'Jasmine · Rose · Sandalwood · Amber',
        concentration: 'EXTRAIT DE PARFUM',
        volume: '50 ML',
        editionCode: 'N° 04 · GOLD',
      },
    },
    essencePreset: 'champagne',
    bottleLabel: {
      kicker: 'FRAGRANCE 04 · PURE EXTRAIT',
      titleLine1: 'Jadora',
      titleLine2: 'Parfum',
      notesLine: 'Jasmine · Rose · Sandalwood · Amber',
      concentration: 'EXTRAIT DE PARFUM',
      volume: '50 ML',
      editionCode: 'N° 04 · GOLD',
    },
    reviews: [
      {
        id: 'rev-401',
        author: 'Ayesha N.',
        location: 'Karachi',
        rating: 5,
        date: 'Jan 22, 2025',
        title: 'Pure elegance in a bottle',
        comment:
          'Rich floral scent that smells sophisticated and airy at the same time. Gifted a second bottle to my sister.',
      },
    ],
  },
  {
    id: 'frag-05',
    slug: 'gucci-flora',
    numberCode: '05',
    editionNumber: 'N° 05',
    name: 'Gucci Flora',
    subtitle: 'White Gardenia, Mandarin Blossom & Soft Musk',
    concentration: 'Eau de Parfum',
    oilConcentrationPct: 24,
    family: 'Floral & Citrus',
    gender: 'Feminine-Leaning',
    collections: ['signature', 'womens', 'fresh'],
    isNewArrival: true,
    rating: 4.8,
    reviewCount: 87,
    keyNotesSummary: 'Mandarin Blossom · White Gardenia · Powdery Iris · White Musk',
    shortDescription:
      'Gucci Flora opens with sparkling mandarin and red berries, blooming into creamy white gardenia, jasmine, and powdery iris over a comforting trail of cashmere musk.',
    description:
      'Gucci Flora opens with sparkling mandarin and red berries, blooming into creamy white gardenia, jasmine, and powdery iris over a comforting trail of cashmere musk and soft patchouli.',
    editorialStory:
      'Luminous orchard blossoms layered atop Florentine iris and clean white musk—delivering an airy second-skin elegance that lasts all day.',
    longevityLabel: '8 – 10 Hours on Skin',
    longevityScore: 87,
    projectionLabel: 'Luminous Soft Trail',
    projectionScore: 84,
    pyramid: {
      top: ['Pear Blossom', 'Italian Mandarin', 'Red Berries'],
      heart: ['White Gardenia', 'Jasmine Absolute', 'Powdery Iris'],
      base: ['White Musk', 'Cashmere Woods', 'Soft Patchouli'],
    },
    topNotes: ['Pear Blossom', 'Italian Mandarin', 'Red Berries'],
    heartNotes: ['White Gardenia', 'Jasmine Absolute', 'Powdery Iris'],
    baseNotes: ['White Musk', 'Cashmere Woods', 'Soft Patchouli'],
    ingredients:
      'Alcohol Denat., Parfum (Fragrance), Aqua (Water), Hydroxycitronellal, Limonene, Linalool, Geraniol.',
    primaryImage: imgGucciFloraJpg,
    primaryImageFallback: imgGucciFloraJpg,
    gallery: [
      {
        src: imgGucciFloraJpg,
        caption: 'Gucci Flora · 50ml Amethyst Crystal Flacon',
      },
    ],
    sizes: [{ label: '50ml', ml: 50, price: 2500, sku: 'NV-05-50' }],
    bottle3D: {
      preset: 'obsidian',
      label: {
        kicker: 'FRAGRANCE 05 · LUMINOUS FLORAL',
        titleLine1: 'Gucci',
        titleLine2: 'Flora',
        notesLine: 'Gardenia · Jasmine · Iris · White Musk',
        concentration: 'EAU DE PARFUM',
        volume: '50 ML',
        editionCode: 'N° 05 · FLORA',
      },
    },
    essencePreset: 'obsidian',
    bottleLabel: {
      kicker: 'FRAGRANCE 05 · LUMINOUS FLORAL',
      titleLine1: 'Gucci',
      titleLine2: 'Flora',
      notesLine: 'Gardenia · Jasmine · Iris · White Musk',
      concentration: 'EAU DE PARFUM',
      volume: '50 ML',
      editionCode: 'N° 05 · FLORA',
    },
    reviews: [
      {
        id: 'rev-501',
        author: 'Maham S.',
        location: 'Lahore',
        rating: 5,
        date: 'Feb 11, 2025',
        title: 'Soft, floral, and very long lasting',
        comment:
          'Smells fresh and delicate without ever becoming overpowering. Stays on scarves for days.',
      },
    ],
  },
];

export function formatPKR(amount: number): string {
  return `PKR ${amount.toLocaleString('en-PK')}`;
}
