import type {
  Annotation,
  AnnotationSelector,
} from '../lib/annotations';

const CONTEXT_LENGTH = 64;
const EXCLUDED_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'sup',
  '[hidden]',
  '[aria-hidden="true"]',
  '.sep-plus-footnotes',
  '[data-sep-plus-annotation-ui]',
].join(',');
const BLOCK_SELECTOR = [
  'address',
  'article',
  'aside',
  'blockquote',
  'dd',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
].join(',');

type DomPoint = {
  node: Node;
  offset: number;
};

type ProjectedUnit = {
  start: DomPoint;
  end: DomPoint;
};

export type TextProjection = {
  text: string;
  units: ProjectedUnit[];
};

export type SelectionAnchor = {
  selector: AnnotationSelector;
  range: Range;
  section?: string;
};

function elementForNode(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
}

function isExcludedNode(node: Node): boolean {
  return Boolean(elementForNode(node)?.closest(EXCLUDED_SELECTOR));
}

function nearestBlock(node: Text): Element | null {
  return node.parentElement?.closest(BLOCK_SELECTOR) ?? null;
}

function comparePoints(left: DomPoint, right: DomPoint): number {
  if (left.node === right.node) {
    return left.offset - right.offset;
  }
  const document = left.node.ownerDocument ?? right.node.ownerDocument;
  if (!document) {
    return 0;
  }
  const leftRange = document.createRange();
  const rightRange = document.createRange();
  leftRange.setStart(left.node, left.offset);
  leftRange.collapse(true);
  rightRange.setStart(right.node, right.offset);
  rightRange.collapse(true);
  return leftRange.compareBoundaryPoints(Range.START_TO_START, rightRange);
}

function pointInRoot(root: HTMLElement, point: DomPoint): boolean {
  return point.node === root || root.contains(point.node);
}

function appendUnit(
  parts: string[],
  units: ProjectedUnit[],
  text: string,
  start: DomPoint,
  end: DomPoint,
): void {
  parts.push(text);
  units.push({ start, end });
}

/**
 * Build the stable text model used by both selectors and restoration. Normal
 * prose whitespace is collapsed to one space, while preformatted text is kept.
 */
export function buildTextProjection(root: HTMLElement): TextProjection {
  const document = root.ownerDocument;
  const view = document.defaultView;
  const showText = view?.NodeFilter.SHOW_TEXT ?? 4;
  const accept = view?.NodeFilter.FILTER_ACCEPT ?? 1;
  const reject = view?.NodeFilter.FILTER_REJECT ?? 2;
  const walker = document.createTreeWalker(root, showText, {
    acceptNode: (candidate) =>
      isExcludedNode(candidate) ? reject : accept,
  });
  const parts: string[] = [];
  const units: ProjectedUnit[] = [];
  let pendingWhitespace: ProjectedUnit | null = null;
  let previousEnd: DomPoint | null = null;
  let previousBlock: Element | null = null;

  function flushWhitespace(): void {
    if (!pendingWhitespace) {
      return;
    }
    appendUnit(
      parts,
      units,
      ' ',
      pendingWhitespace.start,
      pendingWhitespace.end,
    );
    pendingWhitespace = null;
  }

  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const value = node.data;
    const block = nearestBlock(node);
    const preserveWhitespace = Boolean(node.parentElement?.closest('pre'));

    if (
      previousEnd &&
      previousBlock !== block &&
      !pendingWhitespace &&
      parts.at(-1) !== ' '
    ) {
      appendUnit(parts, units, ' ', previousEnd, { node, offset: 0 });
    }

    for (let offset = 0; offset < value.length; offset += 1) {
      const character = value[offset];
      if (!character) {
        continue;
      }
      const start = { node, offset };
      const end = { node, offset: offset + 1 };
      if (!preserveWhitespace && /\s/.test(character)) {
        if (pendingWhitespace) {
          pendingWhitespace.end = end;
        } else {
          pendingWhitespace = { start, end };
        }
        continue;
      }
      flushWhitespace();
      appendUnit(parts, units, character, start, end);
    }

    previousEnd = { node, offset: value.length };
    previousBlock = block;
    current = walker.nextNode();
  }
  flushWhitespace();

  return {
    text: parts.join(''),
    units,
  };
}

function projectedOffsetsForRange(
  projection: TextProjection,
  range: Range,
): { start: number; end: number } | null {
  const rangeStart = {
    node: range.startContainer,
    offset: range.startOffset,
  };
  const rangeEnd = {
    node: range.endContainer,
    offset: range.endOffset,
  };
  let low = 0;
  let high = projection.units.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const unit = projection.units[middle];
    if (unit && comparePoints(unit.end, rangeStart) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  let start = low;

  low = start;
  high = projection.units.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const unit = projection.units[middle];
    if (unit && comparePoints(unit.start, rangeEnd) < 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  let end = low;

  if (end <= start) {
    return null;
  }
  while (start < end && /\s/.test(projection.text[start] ?? '')) {
    start += 1;
  }
  while (end > start && /\s/.test(projection.text[end - 1] ?? '')) {
    end -= 1;
  }
  return end > start ? { start, end } : null;
}

function rangeForOffsets(
  root: HTMLElement,
  projection: TextProjection,
  start: number,
  end: number,
): Range | null {
  const first = projection.units[start];
  const last = projection.units[end - 1];
  if (!first || !last) {
    return null;
  }
  const range = root.ownerDocument.createRange();
  try {
    range.setStart(first.start.node, first.start.offset);
    range.setEnd(last.end.node, last.end.offset);
    return range;
  } catch {
    return null;
  }
}

export function sectionForRange(
  root: HTMLElement,
  range: Range,
): string | undefined {
  let section: string | undefined;
  for (const heading of Array.from(root.querySelectorAll('h2, h3, h4'))) {
    if (
      heading.contains(range.startContainer) ||
      heading.compareDocumentPosition(range.startContainer) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ) {
      const text = (heading.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text) {
        section = text;
      }
      continue;
    }
    break;
  }
  return section;
}

export function createSelectionAnchor(
  root: HTMLElement,
  sourceRange: Range,
  projection = buildTextProjection(root),
): SelectionAnchor | null {
  if (
    sourceRange.collapsed ||
    !pointInRoot(root, {
      node: sourceRange.startContainer,
      offset: sourceRange.startOffset,
    }) ||
    !pointInRoot(root, {
      node: sourceRange.endContainer,
      offset: sourceRange.endOffset,
    }) ||
    isExcludedNode(sourceRange.startContainer) ||
    isExcludedNode(sourceRange.endContainer)
  ) {
    return null;
  }
  const offsets = projectedOffsetsForRange(projection, sourceRange);
  if (!offsets) {
    return null;
  }
  const exact = projection.text.slice(offsets.start, offsets.end);
  if (!exact.trim()) {
    return null;
  }
  const range = rangeForOffsets(root, projection, offsets.start, offsets.end);
  if (!range) {
    return null;
  }
  const selector: AnnotationSelector = {
    quote: {
      type: 'TextQuoteSelector',
      exact,
      prefix: projection.text.slice(
        Math.max(0, offsets.start - CONTEXT_LENGTH),
        offsets.start,
      ),
      suffix: projection.text.slice(
        offsets.end,
        offsets.end + CONTEXT_LENGTH,
      ),
    },
    position: {
      type: 'TextPositionSelector',
      start: offsets.start,
      end: offsets.end,
    },
  };
  const section = sectionForRange(root, range);
  return {
    selector,
    range,
    ...(section ? { section } : {}),
  };
}

function prefixScore(expected: string, actual: string): number {
  let score = 0;
  while (
    score < expected.length &&
    score < actual.length &&
    expected[expected.length - score - 1] === actual[actual.length - score - 1]
  ) {
    score += 1;
  }
  return score;
}

function suffixScore(expected: string, actual: string): number {
  let score = 0;
  while (
    score < expected.length &&
    score < actual.length &&
    expected[score] === actual[score]
  ) {
    score += 1;
  }
  return score;
}

function quoteCandidateStart(
  projection: TextProjection,
  annotation: Annotation,
): number | null {
  const exact = annotation.selector.quote.exact;
  const candidates: Array<{
    start: number;
    context: number;
    distance: number;
  }> = [];
  let fromIndex = 0;

  while (fromIndex <= projection.text.length - exact.length) {
    const start = projection.text.indexOf(exact, fromIndex);
    if (start < 0) {
      break;
    }
    const end = start + exact.length;
    const prefix = projection.text.slice(
      Math.max(0, start - annotation.selector.quote.prefix.length),
      start,
    );
    const suffix = projection.text.slice(
      end,
      end + annotation.selector.quote.suffix.length,
    );
    candidates.push({
      start,
      context:
        prefixScore(annotation.selector.quote.prefix, prefix) +
        suffixScore(annotation.selector.quote.suffix, suffix),
      distance: Math.abs(start - annotation.selector.position.start),
    });
    fromIndex = start + 1;
  }

  candidates.sort(
    (left, right) =>
      right.context - left.context ||
      left.distance - right.distance ||
      left.start - right.start,
  );
  const best = candidates[0];
  if (!best) {
    return null;
  }
  const second = candidates[1];
  if (
    second &&
    second.context === best.context &&
    second.distance === best.distance
  ) {
    return null;
  }
  return best.start;
}

export function resolveAnnotationRange(
  root: HTMLElement,
  annotation: Annotation,
  projection = buildTextProjection(root),
): Range | null {
  const { start, end } = annotation.selector.position;
  if (
    projection.text.slice(start, end) === annotation.selector.quote.exact
  ) {
    return rangeForOffsets(root, projection, start, end);
  }
  const fallbackStart = quoteCandidateStart(projection, annotation);
  if (fallbackStart === null) {
    return null;
  }
  return rangeForOffsets(
    root,
    projection,
    fallbackStart,
    fallbackStart + annotation.selector.quote.exact.length,
  );
}

export function rangeViewportRect(range: Range): DOMRect | null {
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 || rect.height > 0,
  );
  return rects[0] ?? range.getBoundingClientRect() ?? null;
}
