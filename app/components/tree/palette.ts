import { isNightAt } from '@/lib/tree';

export interface TreePalette {
  night: boolean;
  sky: string;
  celestial: string;      // sun or moon fill
  canopy: string;
  canopySide: string;
  highlight: string;
  trunk: string;
  ground: string;
  blossom: string;
  blossomCenter: string;
  fruit: string;
  text: string;           // primary text over the sky
  textSoft: string;       // secondary text over the sky
}

export const DAY_PALETTE: TreePalette = {
  night: false,
  sky: '#DFF3E7',
  celestial: '#FFE08A',
  canopy: '#2E9E6E',
  canopySide: '#3FB07E',
  highlight: '#57C596',
  trunk: '#8B5E3C',
  ground: '#CDEBD9',
  blossom: '#FFB7C5',
  blossomCenter: '#FFD166',
  fruit: '#F4845F',
  text: '#1A5B3E',
  textSoft: '#4B7A63',
};

export const NIGHT_PALETTE: TreePalette = {
  night: true,
  sky: '#1F3A4D',
  celestial: '#FFE9A8',
  canopy: '#256B4E',
  canopySide: '#2E7D5B',
  highlight: '#3E8E68',
  trunk: '#5E4126',
  ground: '#2C4A3E',
  blossom: '#D98A9C',
  blossomCenter: '#D9B25A',
  fruit: '#C96B4A',
  text: '#FFFFFF',
  textSoft: 'rgba(255,255,255,0.75)',
};

export function paletteForDate(d: Date = new Date()): TreePalette {
  return isNightAt(d.getHours()) ? NIGHT_PALETTE : DAY_PALETTE;
}
