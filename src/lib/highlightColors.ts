import { resolveSwatch, type PaletteSwatch } from '@highlighters/core';
import type { HighlightColor } from './types';

export const HIGHLIGHT_COLOR_OPTIONS: ReadonlyArray<{
  value: HighlightColor;
  label: string;
}> = [
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'pink', label: 'Pink' },
  { value: 'purple', label: 'Purple' },
];

/** HSL lightness points the hover shade sits below its mild swatch. */
const EMPHASIS_DARKEN = 14;
/** Extra HSL saturation points for dark-mode ink, which screens toward gray. */
const DARK_INK_SATURATE = 20;

/** Marks and the settings swatch both read from the library's mild palette. */
export function highlightSwatch(color: HighlightColor): PaletteSwatch {
  return { palette: 'mild', swatch: color };
}

export function highlightColorValue(color: HighlightColor): string {
  return resolveSwatch(highlightSwatch(color));
}

/** Hover/active marks: the same mild hue and saturation, just darker. */
export function highlightEmphasisColor(color: HighlightColor): string {
  return darkenHex(highlightColorValue(color), EMPHASIS_DARKEN);
}

/** Dark-mode ink: the hover shade with extra saturation. */
export function highlightDarkInkColor(color: HighlightColor): string {
  return adjustHex(highlightColorValue(color), {
    lightness: -EMPHASIS_DARKEN,
    saturation: DARK_INK_SATURATE,
  });
}

export function darkenHex(hex: string, points: number): string {
  return adjustHex(hex, { lightness: -points });
}

/** Shift HSL saturation/lightness by percentage points, clamped to 0–100. */
export function adjustHex(
  hex: string,
  { lightness = 0, saturation = 0 }: { lightness?: number; saturation?: number },
): string {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const [h, s, l] = rgbToHsl(
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  );
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const [r, g, b] = hslToRgb(
    h,
    clamp(s + saturation / 100),
    clamp(l + lightness / 100),
  );
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return [0, 0, l];
  }
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d) % 6;
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  return [(h * 60 + 360) % 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [r, g, b].map((channel) => Math.round((channel + m) * 255)) as [
    number,
    number,
    number,
  ];
}
