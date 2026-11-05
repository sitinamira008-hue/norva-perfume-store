export type EssencePresetId =
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'obsidian'
  | 'champagne'
  | 'cobalt'
  | 'noir';

export interface BottleLabelContent {
  kicker: string;
  titleLine1: string;
  titleLine2?: string;
  notesLine: string;
  concentration: string;
  volume: string;
  editionCode: string;
}

export type PlaqueStyleVariant = 'khamrah-square' | 'coolwater-square' | 'wide-rect';

export const DEFAULT_HERO_BOTTLE_LABEL: BottleLabelContent = {
  kicker: 'NORVA · HAUTE PARFUMERIE',
  titleLine1: 'Khamrah',
  titleLine2: 'Qawa',
  notesLine: 'Oud · Smoked Leather · Black Amber · Saffron',
  concentration: 'EXTRAIT DE PARFUM',
  volume: '50 ML',
  editionCode: 'N° 01 · GRASSE',
};
