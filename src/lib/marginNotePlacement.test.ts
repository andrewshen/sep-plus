import { describe, expect, it } from 'vitest';
import {
  computeMarginNotePlacement,
  formatRelativeAnnotationTime,
} from './marginNotePlacement';

describe('computeMarginNotePlacement', () => {
  it('opens above the trigger when there is room', () => {
    expect(
      computeMarginNotePlacement(
        {
          top: 300,
          right: 400,
          bottom: 340,
          left: 200,
          width: 200,
          height: 40,
        },
        { width: 400, height: 200 },
        { top: 0, left: 0, width: 1200, height: 800 },
      ),
    ).toEqual({
      top: 92,
      left: 100,
      placement: 'above',
    });
  });

  it('falls below when the space above is too tight', () => {
    expect(
      computeMarginNotePlacement(
        {
          top: 40,
          right: 400,
          bottom: 80,
          left: 200,
          width: 200,
          height: 40,
        },
        { width: 400, height: 200 },
        { top: 0, left: 0, width: 1200, height: 800 },
      ),
    ).toEqual({
      top: 88,
      left: 100,
      placement: 'below',
    });
  });
});

describe('formatRelativeAnnotationTime', () => {
  const now = Date.parse('2026-07-26T18:00:00.000Z');

  it('formats recent and older timestamps', () => {
    expect(formatRelativeAnnotationTime(now - 30_000, now)).toBe('just now');
    expect(formatRelativeAnnotationTime(now - 2 * 60_000, now)).toBe('2m ago');
    expect(formatRelativeAnnotationTime(now - 3 * 3_600_000, now)).toBe(
      '3h ago',
    );
    expect(formatRelativeAnnotationTime(now - 2 * 86_400_000, now)).toBe(
      '2d ago',
    );
  });
});
