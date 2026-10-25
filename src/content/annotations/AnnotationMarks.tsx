import { useMemo } from 'react';
import { useHighlight, type HighlightOptions } from '@highlighters/react';
import type { ResolvedAnnotationRange } from '../../host/annotationHighlights';
import { highlightSwatch } from '../../lib/highlightColors';
import type { HighlightColor } from '../../lib/types';

type AnnotationMarksProps = {
  ranges: readonly ResolvedAnnotationRange[];
  emphasizedIds: ReadonlySet<string>;
  host: HTMLElement | null;
  color: HighlightColor;
};

type AnnotationMarkProps = {
  id: string;
  range: Range;
  emphasized: boolean;
  host: HTMLElement;
  color: HighlightColor;
};

const BASE_OPACITY = 0.6;
const EMPHASIZED_OPACITY = 0.85;

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
}: AnnotationMarkProps) {
  const options = useMemo<HighlightOptions>(
    () => ({
      seed: seedFromId(id),
      color: highlightSwatch(color),
      tip: { type: 'fine' },
      animation: { draw: false },
      opacity: emphasized ? EMPHASIZED_OPACITY : BASE_OPACITY,
    }),
    [color, emphasized, id],
  );
  useHighlight(range, options, host);
  return null;
}

export function AnnotationMarks({
  ranges,
  emphasizedIds,
  host,
  color,
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
        />
      ))}
    </>
  );
}
