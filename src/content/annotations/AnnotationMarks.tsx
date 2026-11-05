import { useMemo } from 'react';
import { useHighlight, type HighlightOptions } from '@highlighters/react';
import type { ResolvedAnnotationRange } from '../../host/annotationHighlights';
import {
  highlightDarkInkColor,
  highlightEmphasisColor,
  highlightSwatch,
} from '../../lib/highlightColors';
import type { HighlightColor } from '../../lib/types';

type AnnotationMarksProps = {
  ranges: readonly ResolvedAnnotationRange[];
  emphasizedIds: ReadonlySet<string>;
  host: HTMLElement | null;
  color: HighlightColor;
  dark: boolean;
};

type AnnotationMarkProps = {
  id: string;
  range: Range;
  emphasized: boolean;
  host: HTMLElement;
  color: HighlightColor;
  dark: boolean;
};

/*
 * Light pages use the library's default multiply ink; emphasis swaps in a
 * deeper shade of the same hue. Multiply can only darken, so on dark pages
 * the band sinks toward black: there we use the library's `vivid: 'screen'`
 * ink, which brightens instead. The pale resting swatch screens to a hueless
 * gray, so dark mode inks with a deeper, more saturated shade and
 * emphasizes by opacity.
 */
const LIGHT_OPACITY = { base: 0.6, emphasized: 0.8 };
const DARK_OPACITY = { base: 0.4, emphasized: 0.6 };

function seedFromId(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function AnnotationMark({
  id,
  range,
  emphasized,
  host,
  color,
  dark,
}: AnnotationMarkProps) {
  const options = useMemo<HighlightOptions>(() => {
    const opacity = dark ? DARK_OPACITY : LIGHT_OPACITY;
    return {
      seed: seedFromId(id),
      color: dark
        ? highlightDarkInkColor(color)
        : emphasized
          ? highlightEmphasisColor(color)
          : highlightSwatch(color),
      vivid: dark ? 'screen' : false,
      tip: { type: 'fine' },
      // The library defaults to word snapping, which paints past the stored
      // range; clicks hit-test the exact range, so draw exactly that.
      snap: 'none',
      animation: { draw: false },
      opacity: emphasized ? opacity.emphasized : opacity.base,
    };
  }, [color, dark, emphasized, id]);
  useHighlight(range, options, host);
  return null;
}

export function AnnotationMarks({
  ranges,
  emphasizedIds,
  host,
  color,
  dark,
}: AnnotationMarksProps) {
  if (!host) {
    return null;
  }
  return (
    <>
      {ranges.map(({ id, range }) => (
        <AnnotationMark
          key={id}
          id={id}
          range={range}
          emphasized={emphasizedIds.has(id)}
          host={host}
          color={color}
          dark={dark}
        />
      ))}
    </>
  );
}
