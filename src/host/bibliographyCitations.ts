import type { MarginNoteRect } from '../lib/marginNotePlacement';

const CITATION_SELECTOR = '[data-sep-plus-bibliography-citation]';
const ASSIGNED_ENTRY_SELECTOR = '[data-sep-plus-bibliography-entry-id]';
const ENTRY_ID_PREFIX = 'sep-plus-bibliography-entry';
const POINTER_CLOSE_DELAY_MS = 80;
const YEAR_SOURCE = '(?:1[5-9]\\d{2}|20\\d{2})[a-z]?';
const ENTRY_SELECTOR = 'li, table tr, dl > dd';
const PROSE_BLOCK_SELECTOR = 'p, li, blockquote, dd, dt';
const EXCLUDED_PROSE_SELECTOR = [
  '#bibliography',
  '#academic-tools',
  '#other-internet-resources',
  '#related-entries',
  '.sep-plus-footnotes',
  'a',
  'button',
  'code',
  'pre',
  'script',
  'style',
  'noscript',
  'template',
  'sup',
  '[hidden]',
  '[aria-hidden="true"]',
  '[data-sep-plus-annotation-ui]',
  '[data-highlighters-overlay]',
  CITATION_SELECTOR,
].join(',');

type ArticleWithCitationCleanup = HTMLElement & {
  sepPlusBibliographyCitationCleanup?: () => void;
};

type TextSegment = {
  node: Text;
  start: number;
  end: number;
};

type TextRun = {
  text: string;
  segments: TextSegment[];
};

type AuthorOccurrence = {
  authorKey: string;
  start: number;
  end: number;
};

type YearOccurrence = {
  year: string;
  start: number;
  end: number;
};

type PendingCitationGroup = {
  /** Co-authors as cited, e.g. ["heck", "may"] for "Heck & May 2006". */
  chain: string[];
  start: number;
  end: number;
  entries: BibliographyEntry[];
  valid: boolean;
};

export type BibliographyEntry = {
  author: string;
  authorKey: string;
  year: string;
  title: string;
  element: HTMLElement;
  section: string;
};

export type BibliographyIndex = {
  entries: readonly BibliographyEntry[];
  authorNames: ReadonlyMap<string, string>;
  byAuthorYear: ReadonlyMap<string, readonly BibliographyEntry[]>;
};

export type BibliographyCitationTextMatch = {
  start: number;
  end: number;
  entries: readonly BibliographyEntry[];
};

export type BibliographyCitationTarget = {
  key: string;
  trigger: HTMLElement;
  entries: readonly BibliographyEntry[];
  rect: MarginNoteRect;
};

export type BibliographyCitationController = {
  cleanup: () => void;
  dismiss: () => void;
  previewPointerEnter: () => void;
  previewPointerLeave: () => void;
  previewFocusEnter: () => void;
  previewFocusLeave: () => void;
  /** Close the preview and put focus back on its citation. */
  returnFocus: () => void;
};

export type BibliographyCitationControllerOptions = {
  document?: Document;
  window?: Window;
  onActiveChange?: (target: BibliographyCitationTarget | null) => void;
  /** Enter or ↓ on a focused citation: move focus into its open preview. */
  onFocusPreview?: () => void;
};

function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeAuthor(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
    .trim();
}

function normalizeYear(value: string): string {
  return value.toLocaleLowerCase();
}

function authorYearKey(authorKey: string, year: string): string {
  return `${authorKey}\u0000${normalizeYear(year)}`;
}

function entryText(element: HTMLElement): string {
  if (element.tagName === 'TR') {
    return Array.from(element.querySelectorAll<HTMLElement>(':scope > th, :scope > td'))
      .map((cell) => cleanText(cell.textContent))
      .filter(Boolean)
      .join(', ');
  }
  return cleanText(element.textContent);
}

function extractBibliographyTitle(
  element: HTMLElement,
  text: string,
  yearEnd: number,
): string {
  const afterYear = text
    .slice(yearEnd)
    .replace(/^[\s,.;:]+/u, '')
    .trim();
  const doubleQuoted = afterYear.match(/[“"]([^”"]{2,300})[”"]/u)?.[1];
  if (doubleQuoted) {
    return cleanText(doubleQuoted);
  }
  const singleQuoted = afterYear.match(/‘([^’]{2,300})’/u)?.[1];
  if (singleQuoted) {
    return cleanText(singleQuoted);
  }
  const emphasized = element.querySelector<HTMLElement>('em, i, cite');
  const emphasizedTitle = cleanText(emphasized?.textContent);
  if (emphasizedTitle) {
    return emphasizedTitle;
  }
  return cleanText(afterYear.split(/[,.;]/u, 1)[0]).slice(0, 300);
}

export function buildPhilPapersSearchUrl(entry: BibliographyEntry): string {
  const publishedYear = entry.year.replace(/[a-z]$/iu, '');
  const query = [entry.title, publishedYear, entry.author]
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(' ');
  return `https://philpapers.org/s/${encodeURIComponent(query)}`;
}

function firstSignificantChild(element: Element): ChildNode | null {
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE && !cleanText(child.textContent)) {
      continue;
    }
    return child;
  }
  return null;
}

function startsWithTitleMarkup(element: HTMLElement): boolean {
  const first = firstSignificantChild(element);
  if (first instanceof Element) {
    return ['CITE', 'EM', 'I'].includes(first.tagName);
  }
  const text = cleanText(first?.textContent);
  return /^[“”‘’"'«]/u.test(text);
}

function stripTrailingInitials(value: string): string {
  const words = value.split(/\s+/);
  while (
    words.length > 1 &&
    /^(?:\p{Lu}|\p{Lu}(?:\.\p{Lu})*\.)$/u.test(words.at(-1) ?? '')
  ) {
    words.pop();
  }
  return words.join(' ');
}

function parseExplicitAuthor(authorText: string): string | null {
  if (!authorText.includes(',')) {
    return null;
  }
  const firstAuthor = stripTrailingInitials(
    authorText
      .slice(0, authorText.indexOf(','))
      .replace(/^[\s,.;:]+|[\s,.;:]+$/g, ''),
  );
  if (
    !firstAuthor ||
    firstAuthor.length > 80 ||
    !/\p{L}/u.test(firstAuthor) ||
    /^\d/u.test(firstAuthor)
  ) {
    return null;
  }
  return firstAuthor;
}

/** The author list as printed before the year. "–––" entries inherit the
 *  previous entry's list, co-authors included. */
const entryAuthorsText = new WeakMap<BibliographyEntry, string>();

function isRepeatedAuthorEntry(text: string): boolean {
  return /^[\s]*[‐‑‒–—−]{2,}\s*,?/u.test(text);
}

function entryGroup(element: HTMLElement, bibliography: HTMLElement): Element {
  return element.closest('ul, ol, table, dl') ?? bibliography;
}

/** Each entry's label is the last h2–h4 before it in the bibliography. One
 *  document-order pass instead of a backwards search per entry. */
function sectionLabels(
  bibliography: HTMLElement,
  elements: readonly HTMLElement[],
): Map<HTMLElement, string> {
  const wanted = new Set(elements);
  const labels = new Map<HTMLElement, string>();
  const walker = bibliography.ownerDocument.createTreeWalker(
    bibliography,
    bibliography.ownerDocument.defaultView?.NodeFilter.SHOW_ELEMENT ?? 1,
  );
  let current = 'Bibliography';
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node as HTMLElement;
    if (/^H[2-4]$/.test(element.tagName)) {
      current = cleanText(element.textContent) || 'Bibliography';
    } else if (wanted.has(element)) {
      labels.set(element, current);
    }
  }
  return labels;
}

function collectEntryElements(bibliography: HTMLElement): HTMLElement[] {
  const elements = Array.from(
    bibliography.querySelectorAll<HTMLElement>(ENTRY_SELECTOR),
  ).filter((element) => {
    const parentEntry = element.parentElement?.closest(ENTRY_SELECTOR);
    return !parentEntry || parentEntry === element;
  });
  for (const paragraph of Array.from(
    bibliography.querySelectorAll<HTMLElement>(':scope > p'),
  )) {
    elements.push(paragraph);
  }
  return elements.sort((left, right) => {
    if (left === right) {
      return 0;
    }
    return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1;
  });
}

export function collectBibliographyEntries(
  doc: Document = document,
): BibliographyIndex {
  const bibliography = doc.getElementById('bibliography');
  const entries: BibliographyEntry[] = [];
  const authorNames = new Map<string, string>();
  const mutableIndex = new Map<string, BibliographyEntry[]>();
  if (!bibliography) {
    return {
      entries,
      authorNames,
      byAuthorYear: mutableIndex,
    };
  }

  const previousAuthorByGroup = new Map<
    Element,
    { author: string; authorKey: string; authorsText: string }
  >();
  const yearPattern = new RegExp(`\\b(${YEAR_SOURCE})\\b`, 'iu');
  const elements = collectEntryElements(bibliography);
  const labels = sectionLabels(bibliography, elements);

  for (const element of elements) {
    const text = entryText(element);
    const yearMatch = yearPattern.exec(text);
    if (!yearMatch || yearMatch.index > 180) {
      continue;
    }
    const year = normalizeYear(yearMatch[1] ?? '');
    const group = entryGroup(element, bibliography);
    let author: string;
    let authorKey: string;
    let authorsText: string;

    if (isRepeatedAuthorEntry(text)) {
      const previous = previousAuthorByGroup.get(group);
      if (!previous) {
        continue;
      }
      author = previous.author;
      authorKey = previous.authorKey;
      authorsText = previous.authorsText;
    } else {
      if (startsWithTitleMarkup(element)) {
        continue;
      }
      const parsedAuthor = parseExplicitAuthor(text.slice(0, yearMatch.index));
      if (!parsedAuthor) {
        continue;
      }
      author = parsedAuthor;
      authorKey = normalizeAuthor(author);
      if (!authorKey) {
        continue;
      }
      authorsText = text.slice(0, yearMatch.index);
      previousAuthorByGroup.set(group, { author, authorKey, authorsText });
      if (!authorNames.has(authorKey)) {
        authorNames.set(authorKey, author);
      }
    }

    const entry: BibliographyEntry = {
      author,
      authorKey,
      year,
      title: extractBibliographyTitle(
        element,
        text,
        yearMatch.index + (yearMatch[1]?.length ?? 0),
      ),
      element,
      section: labels.get(element) ?? 'Bibliography',
    };
    entries.push(entry);
    entryAuthorsText.set(entry, authorsText);
    const key = authorYearKey(authorKey, year);
    const indexed = mutableIndex.get(key) ?? [];
    indexed.push(entry);
    mutableIndex.set(key, indexed);
  }

  return {
    entries,
    authorNames,
    byAuthorYear: mutableIndex,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function authorNamePattern(value: string): string {
  return Array.from(value)
    .map((character) => {
      if (/\s/u.test(character)) {
        return '\\s+';
      }
      if (character === "'" || character === '’' || character === '‘') {
        return "['’‘]";
      }
      if (/[‐‑‒–—−-]/u.test(character)) {
        return '[‐‑‒–—−-]';
      }
      return escapeRegExp(character);
    })
    .join('');
}

type CompiledPatterns = {
  /** Any indexed author name, longest first. */
  author: RegExp;
  /** `Author ... (years)` in running prose. */
  narrative: RegExp;
};

/** Compiling the author alternation is the expensive part of matching, and
 *  the index doesn't change while an entry is scanned. */
const compiledPatterns = new WeakMap<BibliographyIndex, CompiledPatterns | null>();

function patternsFor(index: BibliographyIndex): CompiledPatterns | null {
  if (compiledPatterns.has(index)) {
    return compiledPatterns.get(index) ?? null;
  }
  const names = Array.from(index.authorNames.values()).sort(
    (left, right) => right.length - left.length,
  );
  const authorPattern = names.length
    ? names.map((name) => authorNamePattern(name)).join('|')
    : null;
  const connector =
    "(?:and|&|et\\s+al\\.?|himself|herself|[\\p{Lu}][\\p{L}\\p{M}.'’‘-]*)";
  const compiled = authorPattern
    ? {
        author: new RegExp(
          `(?<![\\p{L}\\p{N}])(?:${authorPattern})(?![\\p{L}\\p{N}])`,
          'giu',
        ),
        narrative: new RegExp(
          `(?<![\\p{L}\\p{N}])(?<author>${authorPattern})(?:['’]s)?(?:\\s+${connector}){0,8}\\s*\\((?<years>[^()]*)\\)`,
          'gu',
        ),
      }
    : null;
  compiledPatterns.set(index, compiled);
  return compiled;
}

function findAuthorOccurrences(
  text: string,
  patterns: CompiledPatterns,
  index: BibliographyIndex,
): AuthorOccurrence[] {
  const occurrences: AuthorOccurrence[] = [];
  for (const match of text.matchAll(patterns.author)) {
    const matched = match[0];
    const start = match.index;
    if (start === undefined) {
      continue;
    }
    const authorKey = normalizeAuthor(matched);
    if (!index.authorNames.has(authorKey)) {
      continue;
    }
    occurrences.push({
      authorKey,
      start,
      end: start + matched.length,
    });
  }
  return occurrences;
}

function findYearOccurrences(text: string): YearOccurrence[] {
  const pattern = new RegExp(`\\b(${YEAR_SOURCE})\\b`, 'giu');
  const occurrences: YearOccurrence[] = [];
  for (const match of text.matchAll(pattern)) {
    const matched = match[1];
    const start = match.index;
    if (!matched || start === undefined) {
      continue;
    }
    occurrences.push({
      year: normalizeYear(matched),
      start,
      end: start + matched.length,
    });
  }
  return occurrences;
}

function resolveEntry(
  index: BibliographyIndex,
  authorKey: string,
  year: string,
): BibliographyEntry | null {
  const candidates = index.byAuthorYear.get(authorYearKey(authorKey, year));
  return candidates?.length === 1 ? (candidates[0] ?? null) : null;
}

const CO_AUTHOR_JOIN = /^\s*(?:,|&|and|,\s*(?:and|&))\s*$/iu;

/** The run of co-authors that ends with the last author ("Heck & May"). */
function lastAuthorChain(
  text: string,
  authors: readonly AuthorOccurrence[],
): AuthorOccurrence[] {
  const last = authors.at(-1);
  if (!last) {
    return [];
  }
  const chain = [last];
  for (let index = authors.length - 2; index >= 0; index -= 1) {
    const previous = authors[index];
    const head = chain[0];
    if (!previous || !head || !CO_AUTHOR_JOIN.test(text.slice(previous.end, head.start))) {
      break;
    }
    chain.unshift(previous);
  }
  return chain;
}

const entryAuthorKeys = new WeakMap<BibliographyEntry, ReadonlySet<string>>();

function authorsListedIn(
  entry: BibliographyEntry,
  patterns: CompiledPatterns,
  index: BibliographyIndex,
): ReadonlySet<string> {
  let keys = entryAuthorKeys.get(entry);
  if (!keys) {
    keys = new Set(
      findAuthorOccurrences(entryAuthorsText.get(entry) ?? '', patterns, index).map(
        (occurrence) => occurrence.authorKey,
      ),
    );
    entryAuthorKeys.set(entry, keys);
  }
  return keys;
}

/**
 * Bibliographies file co-authored works under the first author, so "Heck &
 * May 2006" is Heck's entry if it names May. Otherwise "Lewis and Kripke
 * (1980)" names two people and cites the one nearest the year.
 */
function resolveChainEntry(
  chain: readonly string[],
  year: string,
  patterns: CompiledPatterns,
  index: BibliographyIndex,
): { entry: BibliographyEntry; author: number } | null {
  const head = chain[0];
  if (!head) {
    return null;
  }
  const headEntry = resolveEntry(index, head, year);
  if (chain.length === 1) {
    return headEntry ? { entry: headEntry, author: 0 } : null;
  }
  if (headEntry) {
    const listed = authorsListedIn(headEntry, patterns, index);
    if (chain.slice(1).every((key) => listed.has(key))) {
      return { entry: headEntry, author: 0 };
    }
  }
  const lastEntry = resolveEntry(index, chain.at(-1) ?? head, year);
  return lastEntry ? { entry: lastEntry, author: chain.length - 1 } : null;
}

function uniqueEntries(
  entries: readonly BibliographyEntry[],
): BibliographyEntry[] {
  const seen = new Set<HTMLElement>();
  return entries.filter((entry) => {
    if (seen.has(entry.element)) {
      return false;
    }
    seen.add(entry.element);
    return true;
  });
}

function finalizeGroup(
  group: PendingCitationGroup | null,
  absoluteOffset: number,
  matches: BibliographyCitationTextMatch[],
): void {
  if (!group || !group.valid || group.entries.length === 0) {
    return;
  }
  matches.push({
    start: absoluteOffset + group.start,
    end: absoluteOffset + group.end,
    entries: uniqueEntries(group.entries),
  });
}

function parentheticalSegmentMatches(
  segment: string,
  absoluteOffset: number,
  patterns: CompiledPatterns,
  index: BibliographyIndex,
): BibliographyCitationTextMatch[] {
  const matches: BibliographyCitationTextMatch[] = [];
  const years = findYearOccurrences(segment);
  let cursor = 0;
  let group: PendingCitationGroup | null = null;

  for (const year of years) {
    const prefix = segment.slice(cursor, year.start);
    // "Kripke's reply to Lewis 1973" cites Lewis: the authors nearest the year.
    const chain = lastAuthorChain(
      prefix,
      findAuthorOccurrences(prefix, patterns, index),
    );
    const head = chain[0];
    if (head) {
      finalizeGroup(group, absoluteOffset, matches);
      group = {
        chain: chain.map((author) => author.authorKey),
        start: cursor + head.start,
        end: year.end,
        entries: [],
        valid: true,
      };
    }

    if (group) {
      const resolved = resolveChainEntry(group.chain, year.year, patterns, index);
      if (resolved) {
        group.entries.push(resolved.entry);
      } else {
        group.valid = false;
      }
      group.end = year.end;
    }
    cursor = year.end;
  }

  finalizeGroup(group, absoluteOffset, matches);
  return matches;
}

function findParentheticalMatches(
  text: string,
  patterns: CompiledPatterns,
  index: BibliographyIndex,
): BibliographyCitationTextMatch[] {
  const matches: BibliographyCitationTextMatch[] = [];
  const parentheses = /\(([^()]*)\)/gu;
  for (const parenthetical of text.matchAll(parentheses)) {
    const contents = parenthetical[1];
    const matchStart = parenthetical.index;
    if (contents === undefined || matchStart === undefined) {
      continue;
    }
    const contentsStart = matchStart + 1;
    let segmentStart = 0;
    for (let offset = 0; offset <= contents.length; offset += 1) {
      if (offset < contents.length && contents[offset] !== ';') {
        continue;
      }
      const segment = contents.slice(segmentStart, offset);
      matches.push(
        ...parentheticalSegmentMatches(
          segment,
          contentsStart + segmentStart,
          patterns,
          index,
        ),
      );
      segmentStart = offset + 1;
    }
  }
  return matches;
}

function findNarrativeMatches(
  text: string,
  patterns: CompiledPatterns,
  index: BibliographyIndex,
): BibliographyCitationTextMatch[] {
  const matches: BibliographyCitationTextMatch[] = [];
  const narrativePattern = new RegExp(patterns.narrative);

  for (
    let match = narrativePattern.exec(text);
    match;
    match = narrativePattern.exec(text)
  ) {
    const start = match.index;
    const authorText = match.groups?.author;
    const contents = match.groups?.years;
    if (!authorText || contents === undefined) {
      continue;
    }
    const resolved = resolveNarrative(
      match[0],
      contents,
      patterns,
      index,
    );
    if (resolved) {
      matches.push({
        start: start + resolved.offset,
        end: start + match[0].length,
        entries: resolved.entries,
      });
      continue;
    }
    // Connectors can swallow a later author ("Lewis and Kripke (1980)"), so
    // a failed match retries from just past its first author.
    narrativePattern.lastIndex = start + authorText.length;
  }
  return matches;
}

/** The authors nearest the parenthesis are the ones cited, and every year in
 *  the parenthesis must resolve to one of their entries. */
function resolveNarrative(
  matched: string,
  contents: string,
  patterns: CompiledPatterns,
  index: BibliographyIndex,
): { offset: number; entries: BibliographyEntry[] } | null {
  if (findAuthorOccurrences(contents, patterns, index).length > 0) {
    return null;
  }
  const lead = matched.slice(0, matched.lastIndexOf('('));
  const chain = lastAuthorChain(lead, findAuthorOccurrences(lead, patterns, index));
  const keys = chain.map((author) => author.authorKey);
  const years = findYearOccurrences(contents);
  if (chain.length === 0 || years.length === 0) {
    return null;
  }
  const entries: BibliographyEntry[] = [];
  let firstAuthor = chain.length - 1;
  for (const year of years) {
    const resolved = resolveChainEntry(keys, year.year, patterns, index);
    if (!resolved) {
      return null;
    }
    entries.push(resolved.entry);
    firstAuthor = Math.min(firstAuthor, resolved.author);
  }
  return {
    offset: chain[firstAuthor]?.start ?? 0,
    entries: uniqueEntries(entries),
  };
}

function nonOverlappingMatches(
  matches: readonly BibliographyCitationTextMatch[],
): BibliographyCitationTextMatch[] {
  const sorted = [...matches].sort(
    (left, right) =>
      left.start - right.start || right.end - right.start - (left.end - left.start),
  );
  const accepted: BibliographyCitationTextMatch[] = [];
  for (const match of sorted) {
    const previous = accepted.at(-1);
    if (previous && match.start < previous.end) {
      continue;
    }
    accepted.push(match);
  }
  return accepted;
}

export function findBibliographyCitationMatches(
  text: string,
  index: BibliographyIndex,
): BibliographyCitationTextMatch[] {
  const patterns = patternsFor(index);
  if (!patterns) {
    return [];
  }
  return nonOverlappingMatches([
    ...findParentheticalMatches(text, patterns, index),
    ...findNarrativeMatches(text, patterns, index),
  ]);
}

function isExcludedElement(element: Element): boolean {
  return element.matches(EXCLUDED_PROSE_SELECTOR);
}

function collectTextRuns(block: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];
  let parts: string[] = [];
  let segments: TextSegment[] = [];
  let length = 0;

  function flush(): void {
    if (segments.length > 0) {
      runs.push({ text: parts.join(''), segments });
    }
    parts = [];
    segments = [];
    length = 0;
  }

  function visit(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      if (text.data.length > 0) {
        parts.push(text.data);
        segments.push({
          node: text,
          start: length,
          end: length + text.data.length,
        });
        length += text.data.length;
      }
      return;
    }
    if (!(node instanceof Element)) {
      return;
    }
    if (node !== block && isExcludedElement(node)) {
      flush();
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      visit(child);
    }
  }

  visit(block);
  flush();
  return runs;
}

function collectProseBlocks(article: HTMLElement): HTMLElement[] {
  return Array.from(
    article.querySelectorAll<HTMLElement>(PROSE_BLOCK_SELECTOR),
  ).filter((block) => {
    if (block.closest(EXCLUDED_PROSE_SELECTOR)) {
      return false;
    }
    return !Array.from(block.querySelectorAll(PROSE_BLOCK_SELECTOR)).some(
      (nested) => nested !== block && !nested.closest(EXCLUDED_PROSE_SELECTOR),
    );
  });
}

function pointForOffset(
  segments: readonly TextSegment[],
  offset: number,
  endPoint: boolean,
): { node: Text; offset: number } | null {
  for (const segment of segments) {
    const contains = endPoint
      ? offset > segment.start && offset <= segment.end
      : offset >= segment.start && offset < segment.end;
    if (contains) {
      return {
        node: segment.node,
        offset: offset - segment.start,
      };
    }
  }
  return null;
}

function unwrapCitation(element: Element): void {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }
  element.replaceWith(...Array.from(element.childNodes));
  parent.normalize();
}

function removeStaleCitationMarkup(doc: Document): void {
  for (const citation of Array.from(doc.querySelectorAll(CITATION_SELECTOR))) {
    unwrapCitation(citation);
  }
  for (const entry of Array.from(
    doc.querySelectorAll<HTMLElement>(ASSIGNED_ENTRY_SELECTOR),
  )) {
    entry.removeAttribute('data-sep-plus-bibliography-entry-id');
    entry.removeAttribute('id');
  }
}

function ensureEntryId(
  entry: BibliographyEntry,
  doc: Document,
  assignedEntries: Set<HTMLElement>,
): string {
  if (entry.element.id) {
    return entry.element.id;
  }
  let suffix = assignedEntries.size + 1;
  let id = `${ENTRY_ID_PREFIX}-${suffix}`;
  while (doc.getElementById(id)) {
    suffix += 1;
    id = `${ENTRY_ID_PREFIX}-${suffix}`;
  }
  entry.element.id = id;
  entry.element.setAttribute('data-sep-plus-bibliography-entry-id', '');
  assignedEntries.add(entry.element);
  return id;
}

function triggerRect(trigger: HTMLElement): MarginNoteRect {
  const rect = trigger.getBoundingClientRect();
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function createNoopController(): BibliographyCitationController {
  return {
    cleanup: () => undefined,
    dismiss: () => undefined,
    previewPointerEnter: () => undefined,
    previewPointerLeave: () => undefined,
    previewFocusEnter: () => undefined,
    previewFocusLeave: () => undefined,
    returnFocus: () => undefined,
  };
}

export function initBibliographyCitations(
  options: BibliographyCitationControllerOptions = {},
): BibliographyCitationController {
  const doc = options.document ?? document;
  const win = options.window ?? doc.defaultView ?? window;
  const article = doc.getElementById(
    'article-content',
  ) as ArticleWithCitationCleanup | null;
  article?.sepPlusBibliographyCitationCleanup?.();
  removeStaleCitationMarkup(doc);
  if (!article || !doc.getElementById('bibliography')) {
    return createNoopController();
  }
  const articleRoot = article;

  const index = collectBibliographyEntries(doc);
  if (index.entries.length === 0) {
    return createNoopController();
  }

  const assignedEntries = new Set<HTMLElement>();
  const triggers: HTMLElement[] = [];
  const targets = new Map<
    string,
    { trigger: HTMLElement; entries: readonly BibliographyEntry[] }
  >();
  let targetCounter = 0;

  for (const block of collectProseBlocks(articleRoot)) {
    for (const run of collectTextRuns(block)) {
      const matches = findBibliographyCitationMatches(run.text, index);
      for (const match of [...matches].sort((left, right) => right.start - left.start)) {
        const start = pointForOffset(run.segments, match.start, false);
        const end = pointForOffset(run.segments, match.end, true);
        if (!start || !end || !start.node.isConnected || !end.node.isConnected) {
          continue;
        }
        const range = doc.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        if (range.collapsed || range.toString() !== run.text.slice(match.start, match.end)) {
          continue;
        }
        const key = `citation-${targetCounter + 1}`;
        const trigger = doc.createElement('span');
        trigger.dataset.sepPlusBibliographyCitation = key;
        trigger.tabIndex = 0;
        trigger.setAttribute('role', 'button');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute(
          'aria-label',
          `${range.toString()}, bibliography citation`,
        );
        const detailIds = match.entries.map((entry) =>
          ensureEntryId(entry, doc, assignedEntries),
        );
        trigger.setAttribute('aria-details', detailIds.join(' '));
        trigger.append(range.extractContents());
        range.insertNode(trigger);
        targetCounter += 1;
        triggers.push(trigger);
        targets.set(key, {
          trigger,
          entries: match.entries,
        });
      }
    }
  }

  if (targets.size === 0) {
    for (const entry of assignedEntries) {
      entry.removeAttribute('data-sep-plus-bibliography-entry-id');
      entry.removeAttribute('id');
    }
    return createNoopController();
  }

  const lifecycle = new AbortController();
  const hoverMedia = win.matchMedia('(hover: hover) and (pointer: fine)');
  let activeTarget:
    | { trigger: HTMLElement; entries: readonly BibliographyEntry[] }
    | null = null;
  let activeMode: 'pointer' | 'keyboard' = 'pointer';
  let closeTimer: number | null = null;
  let positionFrame: number | null = null;
  let pointerFocusTrigger: HTMLElement | null = null;
  let pointerFocusFrame: number | null = null;
  let previewPointerInside = false;
  let previewFocusInside = false;
  /** A trigger we're refocusing on purpose; its focusin shouldn't reopen. */
  let refocusingTrigger: HTMLElement | null = null;
  let cleaned = false;

  function setActiveTarget(
    next: { trigger: HTMLElement; entries: readonly BibliographyEntry[] } | null,
  ): void {
    activeTarget?.trigger.setAttribute('aria-expanded', 'false');
    activeTarget = next;
    next?.trigger.setAttribute('aria-expanded', 'true');
  }

  function returnFocus(): void {
    const trigger = activeTarget?.trigger;
    dismiss();
    if (trigger?.isConnected) {
      refocusingTrigger = trigger;
      trigger.focus();
      refocusingTrigger = null;
    }
  }

  function findTrigger(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) {
      return null;
    }
    const trigger = target.closest<HTMLElement>(CITATION_SELECTOR);
    return trigger && articleRoot.contains(trigger) ? trigger : null;
  }

  function targetForTrigger(
    trigger: HTMLElement,
  ): { trigger: HTMLElement; entries: readonly BibliographyEntry[] } | null {
    const key = trigger.dataset.sepPlusBibliographyCitation;
    return key ? (targets.get(key) ?? null) : null;
  }

  function emitActive(): void {
    if (!activeTarget || !activeTarget.trigger.isConnected) {
      options.onActiveChange?.(null);
      return;
    }
    const key = activeTarget.trigger.dataset.sepPlusBibliographyCitation;
    if (!key) {
      options.onActiveChange?.(null);
      return;
    }
    options.onActiveChange?.({
      key,
      trigger: activeTarget.trigger,
      entries: activeTarget.entries,
      rect: triggerRect(activeTarget.trigger),
    });
  }

  function clearCloseTimer(): void {
    if (closeTimer !== null) {
      win.clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function dismiss(): void {
    clearCloseTimer();
    if (!activeTarget) {
      return;
    }
    setActiveTarget(null);
    previewPointerInside = false;
    previewFocusInside = false;
    options.onActiveChange?.(null);
  }

  function show(trigger: HTMLElement, mode: 'pointer' | 'keyboard'): void {
    const target = targetForTrigger(trigger);
    if (!target) {
      return;
    }
    clearCloseTimer();
    if (activeTarget?.trigger === trigger) {
      if (mode === 'keyboard') {
        activeMode = 'keyboard';
      }
      return;
    }
    activeMode = mode;
    setActiveTarget(target);
    emitActive();
  }

  function shouldRemainOpen(): boolean {
    return Boolean(
      previewPointerInside ||
        previewFocusInside ||
        (activeMode === 'keyboard' &&
          activeTarget &&
          doc.activeElement === activeTarget.trigger),
    );
  }

  function scheduleClose(): void {
    clearCloseTimer();
    closeTimer = win.setTimeout(() => {
      closeTimer = null;
      if (!shouldRemainOpen()) {
        dismiss();
      }
    }, POINTER_CLOSE_DELAY_MS);
  }

  function schedulePosition(): void {
    if (!activeTarget || positionFrame !== null) {
      return;
    }
    positionFrame = win.requestAnimationFrame(() => {
      positionFrame = null;
      emitActive();
    });
  }

  articleRoot.addEventListener(
    'pointerover',
    (event) => {
      const pointerEvent = event as PointerEvent;
      if (!hoverMedia.matches || pointerEvent.pointerType === 'touch') {
        return;
      }
      const trigger = findTrigger(pointerEvent.target);
      if (trigger) {
        show(trigger, 'pointer');
      }
    },
    { signal: lifecycle.signal },
  );

  articleRoot.addEventListener(
    'pointerout',
    (event) => {
      const pointerEvent = event as PointerEvent;
      const trigger = findTrigger(pointerEvent.target);
      if (!trigger || trigger !== activeTarget?.trigger) {
        return;
      }
      if (
        pointerEvent.relatedTarget instanceof Node &&
        trigger.contains(pointerEvent.relatedTarget)
      ) {
        return;
      }
      scheduleClose();
    },
    { signal: lifecycle.signal },
  );

  doc.addEventListener(
    'pointerdown',
    (event) => {
      const trigger = findTrigger(event.target);
      pointerFocusTrigger = trigger;
      if (pointerFocusFrame !== null) {
        win.cancelAnimationFrame(pointerFocusFrame);
      }
      pointerFocusFrame = win.requestAnimationFrame(() => {
        pointerFocusFrame = null;
        pointerFocusTrigger = null;
      });

      if (!activeTarget) {
        return;
      }
      const path = event.composedPath();
      const insidePreview = path.some(
        (item) =>
          item instanceof Element &&
          item.hasAttribute('data-sep-plus-bibliography-preview'),
      );
      if (path.includes(activeTarget.trigger) || insidePreview) {
        return;
      }
      dismiss();
    },
    { capture: true, signal: lifecycle.signal },
  );

  articleRoot.addEventListener(
    'focusin',
    (event) => {
      const trigger = findTrigger(event.target);
      if (
        !trigger ||
        trigger === pointerFocusTrigger ||
        trigger === refocusingTrigger
      ) {
        return;
      }
      show(trigger, 'keyboard');
    },
    { signal: lifecycle.signal },
  );

  articleRoot.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter' && event.key !== 'ArrowDown') {
        return;
      }
      const trigger = findTrigger(event.target);
      if (!trigger) {
        return;
      }
      event.preventDefault();
      if (activeTarget?.trigger !== trigger) {
        show(trigger, 'keyboard');
      }
      options.onFocusPreview?.();
    },
    { signal: lifecycle.signal },
  );

  articleRoot.addEventListener(
    'focusout',
    () => {
      win.requestAnimationFrame(() => {
        if (activeMode === 'keyboard' && !shouldRemainOpen()) {
          dismiss();
        }
      });
    },
    { signal: lifecycle.signal },
  );

  doc.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !activeTarget) {
        return;
      }
      event.preventDefault();
      if (previewFocusInside) {
        returnFocus();
      } else {
        dismiss();
      }
    },
    { capture: true, signal: lifecycle.signal },
  );

  win.addEventListener('scroll', schedulePosition, {
    passive: true,
    signal: lifecycle.signal,
  });
  win.addEventListener('resize', schedulePosition, {
    signal: lifecycle.signal,
  });

  function cleanup(): void {
    if (cleaned) {
      return;
    }
    cleaned = true;
    lifecycle.abort();
    clearCloseTimer();
    if (positionFrame !== null) {
      win.cancelAnimationFrame(positionFrame);
      positionFrame = null;
    }
    if (pointerFocusFrame !== null) {
      win.cancelAnimationFrame(pointerFocusFrame);
      pointerFocusFrame = null;
    }
    activeTarget = null;
    for (const trigger of triggers) {
      if (trigger.isConnected) {
        unwrapCitation(trigger);
      }
    }
    for (const entry of assignedEntries) {
      if (entry.hasAttribute('data-sep-plus-bibliography-entry-id')) {
        entry.removeAttribute('data-sep-plus-bibliography-entry-id');
        entry.removeAttribute('id');
      }
    }
    if (articleRoot.sepPlusBibliographyCitationCleanup === cleanup) {
      delete articleRoot.sepPlusBibliographyCitationCleanup;
    }
  }

  articleRoot.sepPlusBibliographyCitationCleanup = cleanup;

  return {
    cleanup,
    dismiss,
    previewPointerEnter: () => {
      previewPointerInside = true;
      clearCloseTimer();
    },
    previewPointerLeave: () => {
      previewPointerInside = false;
      scheduleClose();
    },
    previewFocusEnter: () => {
      previewFocusInside = true;
      clearCloseTimer();
    },
    previewFocusLeave: () => {
      previewFocusInside = false;
      scheduleClose();
    },
    returnFocus,
  };
}
