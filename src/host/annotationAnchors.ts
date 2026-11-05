import type { Annotation, AnnotationSelector } from '../lib/annotations';

/** Only the selector is needed to find an annotation in the page. */
type Anchored = Pick<Annotation, 'selector'>;

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
  '[data-highlighters-overlay]',
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
 * prose whitespace (including <br>) is collapsed to one space, while
 * preformatted text is kept.
 */
export function buildTextProjection(root: HTMLElement): TextProjection {
  const document = root.ownerDocument;
  const view = document.defaultView;
  const showElementAndText =
    (view?.NodeFilter.SHOW_ELEMENT ?? 1) | (view?.NodeFilter.SHOW_TEXT ?? 4);
  const accept = view?.NodeFilter.FILTER_ACCEPT ?? 1;
  const reject = view?.NodeFilter.FILTER_REJECT ?? 2;
  const skip = view?.NodeFilter.FILTER_SKIP ?? 3;
  const walker = document.createTreeWalker(root, showElementAndText, {
    acceptNode: (candidate) => {
      if (candidate.nodeType === Node.TEXT_NODE) {
        return accept;
      }
      if ((candidate as Element).matches(EXCLUDED_SELECTOR)) {
        return reject;
      }
      return (candidate as Element).tagName === 'BR' ? accept : skip;
    },
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
    if (current.nodeType !== Node.TEXT_NODE) {
      const parent = current.parentNode;
      if (parent) {
        const index = Array.prototype.indexOf.call(parent.childNodes, current);
        const start = { node: parent, offset: index };
        const end = { node: parent, offset: index + 1 };
        if (pendingWhitespace) {
          pendingWhitespace.end = end;
        } else if (parts.length && parts.at(-1) !== ' ') {
          pendingWhitespace = { start, end };
        }
        previousEnd = end;
      }
      current = walker.nextNode();
      continue;
    }
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

type CachedProjection = {
  projection: TextProjection;
  observer: MutationObserver;
};

const projectionCache = new WeakMap<HTMLElement, CachedProjection>();

/** Highlight overlays and other excluded nodes don't change the projection. */
function changesProjection(record: MutationRecord): boolean {
  if (isExcludedNode(record.target)) {
    return false;
  }
  if (record.type === 'characterData') {
    return true;
  }
  return [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some(
    (node) =>
      node.nodeType === Node.TEXT_NODE ||
      (node.nodeType === Node.ELEMENT_NODE &&
        !(node as Element).matches(EXCLUDED_SELECTOR)),
  );
}

/**
 * The projection walks every character of the article, so reuse it until the
 * article's text actually changes.
 */
export function getTextProjection(root: HTMLElement): TextProjection {
  const cached = projectionCache.get(root);
  if (cached) {
    // Records not yet delivered to the callback (same task) count too.
    if (!cached.observer.takeRecords().some(changesProjection)) {
      return cached.projection;
    }
    cached.observer.disconnect();
    projectionCache.delete(root);
  }
  const projection = buildTextProjection(root);
  const view = root.ownerDocument.defaultView;
  if (!view?.MutationObserver) {
    return projection;
  }
  const observer = new view.MutationObserver((records) => {
    if (records.some(changesProjection)) {
      observer.disconnect();
      if (projectionCache.get(root)?.observer === observer) {
        projectionCache.delete(root);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  projectionCache.set(root, { projection, observer });
  return projection;
}

export function createSelectionAnchor(
  root: HTMLElement,
  sourceRange: Range,
  projection = getTextProjection(root),
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
    })
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

type Span = { start: number; end: number };

type Candidate = Span & { context: number; distance: number };

/** Highest context score wins, then nearest to the stored position. Two
 *  indistinguishable candidates are ambiguous, so neither is used. */
function bestCandidate(candidates: Candidate[]): Span | null {
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
  return best;
}

function contextScore(
  text: string,
  span: Span,
  prefix: string,
  suffix: string,
): number {
  return (
    prefixScore(prefix, text.slice(Math.max(0, span.start - prefix.length), span.start)) +
    suffixScore(suffix, text.slice(span.end, span.end + suffix.length))
  );
}

function exactCandidates(
  text: string,
  annotation: Anchored,
): Candidate[] {
  const { exact, prefix, suffix } = annotation.selector.quote;
  const candidates: Candidate[] = [];
  let fromIndex = 0;
  while (fromIndex <= text.length - exact.length) {
    const start = text.indexOf(exact, fromIndex);
    if (start < 0) {
      break;
    }
    const span = { start, end: start + exact.length };
    candidates.push({
      ...span,
      context: contextScore(text, span, prefix, suffix),
      distance: Math.abs(start - annotation.selector.position.start),
    });
    fromIndex = start + 1;
  }
  return candidates;
}

const QUOTE_FOLDS: Record<string, string> = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201a': "'",
  '\u2032': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u201e': '"',
  '\u2033': '"',
  '\u2010': '-',
  '\u2011': '-',
  '\u2012': '-',
  '\u2013': '-',
  '\u2014': '-',
  '\u2212': '-',
};

/** Text with whitespace removed and quotes and dashes folded, plus a map
 *  from each folded index back to the projection index. */
type FoldedText = { text: string; map: number[] };

function foldText(text: string): FoldedText {
  let folded = '';
  const map: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    if (/\s/.test(character)) {
      continue;
    }
    folded += QUOTE_FOLDS[character] ?? character;
    map.push(index);
  }
  return { text: folded, map };
}

function unfoldSpan(folded: FoldedText, span: Span): Span | null {
  const start = folded.map[span.start];
  const last = folded.map[span.end - 1];
  return start === undefined || last === undefined
    ? null
    : { start, end: last + 1 };
}

/** The quote with whitespace and typography differences ignored, so anchors
 *  survive punctuation and whitespace-only revisions. */
function foldedCandidates(
  folded: FoldedText,
  annotation: Anchored,
): Candidate[] {
  const quote = foldText(annotation.selector.quote.exact).text;
  if (!quote) {
    return [];
  }
  const prefix = foldText(annotation.selector.quote.prefix).text;
  const suffix = foldText(annotation.selector.quote.suffix).text;
  const candidates: Candidate[] = [];
  let fromIndex = 0;
  while (fromIndex <= folded.text.length - quote.length) {
    const start = folded.text.indexOf(quote, fromIndex);
    if (start < 0) {
      break;
    }
    const foldedSpan = { start, end: start + quote.length };
    const span = unfoldSpan(folded, foldedSpan);
    if (span) {
      candidates.push({
        ...span,
        context: contextScore(folded.text, foldedSpan, prefix, suffix),
        distance: Math.abs(span.start - annotation.selector.position.start),
      });
    }
    fromIndex = start + 1;
  }
  return candidates;
}

const BRACKET_CONTEXT = 24;
const MIN_BRACKET_CONTEXT = 8;
const BRACKET_LENGTH_TOLERANCE = 0.25;

/**
 * The quote itself was edited: find the unchanged text on either side of it
 * and take what lies between, if its length is close to the original.
 */
function bracketCandidates(
  folded: FoldedText,
  annotation: Anchored,
): Candidate[] {
  const prefix = foldText(annotation.selector.quote.prefix).text.slice(
    -BRACKET_CONTEXT,
  );
  const suffix = foldText(annotation.selector.quote.suffix).text.slice(
    0,
    BRACKET_CONTEXT,
  );
  const quoteLength = foldText(annotation.selector.quote.exact).text.length;
  if (
    prefix.length < MIN_BRACKET_CONTEXT ||
    suffix.length < MIN_BRACKET_CONTEXT ||
    !quoteLength
  ) {
    return [];
  }
  const tolerance = Math.max(2, Math.ceil(quoteLength * BRACKET_LENGTH_TOLERANCE));
  const candidates: Candidate[] = [];
  let fromIndex = 0;
  while (fromIndex < folded.text.length) {
    const prefixAt = folded.text.indexOf(prefix, fromIndex);
    if (prefixAt < 0) {
      break;
    }
    const start = prefixAt + prefix.length;
    const suffixAt = folded.text.indexOf(suffix, start);
    if (suffixAt >= 0 && Math.abs(suffixAt - start - quoteLength) <= tolerance) {
      const span = unfoldSpan(folded, { start, end: suffixAt });
      if (span && span.end > span.start) {
        candidates.push({
          ...span,
          context: 0,
          distance: Math.abs(span.start - annotation.selector.position.start),
        });
      }
    }
    fromIndex = prefixAt + 1;
  }
  return candidates;
}

function resolveSpan(
  projection: TextProjection,
  annotation: Anchored,
): Span | null {
  const { text } = projection;
  const { exact, prefix, suffix } = annotation.selector.quote;
  const stored = annotation.selector.position;
  // Fast path: the quote is still at its stored offsets with its full context.
  if (
    text.slice(stored.start, stored.end) === exact &&
    contextScore(text, stored, prefix, suffix) ===
      Math.min(prefix.length, stored.start) +
        Math.min(suffix.length, text.length - stored.end)
  ) {
    return stored;
  }
  const exactMatch = bestCandidate(exactCandidates(text, annotation));
  if (exactMatch) {
    return exactMatch;
  }
  const folded = foldText(text);
  return (
    bestCandidate(foldedCandidates(folded, annotation)) ??
    bestCandidate(bracketCandidates(folded, annotation))
  );
}

export function resolveAnnotationRange(
  root: HTMLElement,
  annotation: Anchored,
  projection = getTextProjection(root),
): Range | null {
  const span = resolveSpan(projection, annotation);
  return span ? rangeForOffsets(root, projection, span.start, span.end) : null;
}

export function rangeViewportRect(range: Range): DOMRect | null {
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 || rect.height > 0,
  );
  return rects[0] ?? range.getBoundingClientRect() ?? null;
}
