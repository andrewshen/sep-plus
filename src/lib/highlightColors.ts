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

/** Marks and the settings swatch both read from the library's mild palette. */
export function highlightSwatch(color: HighlightColor): PaletteSwatch {
  return { palette: 'mild', swatch: color };
}

export function highlightColorValue(color: HighlightColor): string {
  return resolveSwatch(highlightSwatch(color));
}
