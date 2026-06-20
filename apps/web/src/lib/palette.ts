// Wattz palette. Substation + electric wire network.
// These values must match tailwind.config.ts and globals.css.

export const palette = {
  steel: '#2A2A2A',
  cyanGlow: '#5BC0EB',
  wireGlow: '#FFD93D',
  nightNavy: '#0A0E27',
  nightDeep: '#050818',
  clusterWhite: '#F0EAD6',
  accentGold: '#D4AF37',
  substationShadow: '#1A1A2E',
  fogGrey: '#8B8680',
} as const;

export type PaletteKey = keyof typeof palette;

export const paletteRgb = {
  steel: [42, 42, 42],
  cyanGlow: [91, 192, 235],
  wireGlow: [255, 217, 61],
  nightNavy: [10, 14, 39],
  nightDeep: [5, 8, 24],
  clusterWhite: [240, 234, 214],
  accentGold: [212, 175, 55],
  substationShadow: [26, 26, 46],
  fogGrey: [139, 134, 128],
} as const;
