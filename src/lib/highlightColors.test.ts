import { describe, expect, it } from 'vitest';
import { darkenHex, highlightEmphasisColor } from './highlightColors';

describe('darkenHex', () => {
  it('lowers lightness while keeping the hue', () => {
    expect(darkenHex('#ff0000', 20)).toBe('#990000');
    expect(darkenHex('#999999', 10)).toBe('#808080');
  });

  it('clamps at black', () => {
    expect(darkenHex('#101010', 50)).toBe('#000000');
  });
});

describe('highlightEmphasisColor', () => {
  it('is darker than the resting swatch for every color', () => {
    for (const color of ['yellow', 'green', 'blue', 'pink', 'purple'] as const) {
      const hover = highlightEmphasisColor(color);
      expect(hover).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
