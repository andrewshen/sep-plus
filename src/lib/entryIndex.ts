import { formatEntryTitle } from './formatEntryTitle';
import type { EntryIndexCache, EntryIndexItem } from './types';

/** Bump when parseContentsHtml output changes so stale caches are refetched. */
const STORAGE_KEY = 'entryIndex.v2';
const LEGACY_STORAGE_KEYS = ['entryIndex'];
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Cap for any list of search rows: typed matches and default suggestions. */
export const MAX_RESULTS = 12;

function isEntryIndexItem(value: unknown): value is EntryIndexItem {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as EntryIndexItem;
  return typeof item.title === 'string' && typeof item.href === 'string';
}

function isEntryIndexCache(value: unknown): value is EntryIndexCache {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const cache = value as EntryIndexCache;
  return (
    typeof cache.fetchedAt === 'number' &&
    Array.isArray(cache.entries) &&
    cache.entries.every(isEntryIndexItem)
  );
}

function normalizeEntryHref(
  href: string,
  base = `${window.location.origin}/`
): string | null {
  try {
    const url = new URL(href, base);
    const match = url.pathname.match(/\/entries\/([^/]+)\/?/);
    if (!match?.[1]) {
      return null;
    }
    return `${url.origin}/entries/${match[1]}/`;
  } catch {
    return null;
  }
}

export function collectRelatedEntries(): EntryIndexItem[] {
  const seen = new Set<string>();
  const items: EntryIndexItem[] = [];

  for (const link of Array.from(
    document.querySelectorAll<HTMLAnchorElement>('#related-entries a[href]')
  )) {
    const href = normalizeEntryHref(
      link.getAttribute('href') || '',
      window.location.href
    );
    const title = collapseWhitespace(
      link.dataset.sepPlusRawTitle || link.textContent || ''
    );
    if (!href || !title || seen.has(href)) {
      continue;
    }
    seen.add(href);
    items.push({ title, href });
  }

  return items;
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Heading of the `<li>` a nested contents entry sits under: the parent's own
 * bold entry link (`agency`), or its plain leading text (`aesthetics`), minus
 * any `— see …` cross-reference.
 */
function parentHeading(item: Element): string | null {
  const parent = item.parentElement?.closest('li');
  if (!parent) {
    return null;
  }
  let text = '';
  for (const node of Array.from(parent.childNodes)) {
    if (node instanceof Element) {
      if (node.tagName === 'UL') {
        break;
      }
      if (node.tagName === 'A' && node.querySelector('strong')) {
        return collapseWhitespace(node.textContent || '') || null;
      }
    }
    text += node.textContent ?? '';
  }
  return collapseWhitespace(text.replace(/\s+[—–-]+\s*see\b[\s\S]*$/, '')) || null;
}

/**
 * Nested contents entries only print their tail (`aesthetics` → `British, in
 * the 18th century`); SEP's full title — the one Related Entries uses — is
 * `parent: tail`.
 */
function contentsLinkTitle(link: HTMLAnchorElement): string {
  const title = collapseWhitespace(link.textContent || '');
  const item = link.closest('li');
  if (!title || !item || !link.querySelector('strong')) {
    return title;
  }
  const heading = parentHeading(item);
  return heading ? `${heading}: ${title}` : title;
}

export function parseContentsHtml(html: string): EntryIndexItem[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const canonical = new Map<string, string>();
  const longest = new Map<string, string>();

  for (const link of Array.from(
    doc.querySelectorAll<HTMLAnchorElement>('a[href*="entries/"]')
  )) {
    const href = normalizeEntryHref(link.getAttribute('href') || '');
    const title = contentsLinkTitle(link);
    if (!href || !title) {
      continue;
    }
    if (link.querySelector('strong') && !canonical.has(href)) {
      canonical.set(href, title);
    }
    const existing = longest.get(href);
    if (!existing || title.length > existing.length) {
      longest.set(href, title);
    }
  }

  return Array.from(longest, ([href, title]) => ({
    title: canonical.get(href) ?? title,
    href,
  }));
}

async function fetchEntryIndex(): Promise<EntryIndexItem[]> {
  const response = await fetch('/contents.html', { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`Failed to load contents (${response.status})`);
  }
  const html = await response.text();
  return parseContentsHtml(html);
}

async function refreshEntryIndex(): Promise<EntryIndexItem[]> {
  const entries = await fetchEntryIndex();
  const next: EntryIndexCache = {
    fetchedAt: Date.now(),
    entries,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  void chrome.storage.local.remove(LEGACY_STORAGE_KEYS);
  return entries;
}

let pendingRefresh: Promise<EntryIndexItem[]> | null = null;

/**
 * Cached titles, refreshed weekly. A stale cache is still returned at once
 * (and refreshed in the background) so search keeps working offline or when
 * SEP is down; only a missing cache waits on the network.
 */
export async function getEntryIndex(): Promise<EntryIndexItem[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const cache = stored[STORAGE_KEY];
  const usable = isEntryIndexCache(cache) && cache.entries.length > 0;
  if (usable && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.entries;
  }

  pendingRefresh ??= refreshEntryIndex().finally(() => {
    pendingRefresh = null;
  });
  if (usable) {
    pendingRefresh.catch(() => undefined);
    return cache.entries;
  }
  return pendingRefresh;
}

/** Lowercase, accent-free, straight-quoted: `Gödel` / `Kūkai` match `godel` / `kukai`. */
function foldForSearch(text: string): string {
  return collapseWhitespace(
    text
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[‘’ʿʾ]/g, "'")
      .toLowerCase()
  );
}

const searchKeys = new WeakMap<EntryIndexItem, string>();

/** Raw TOC title (aliases in brackets) plus the display title users read. */
function searchKey(entry: EntryIndexItem): string {
  let key = searchKeys.get(entry);
  if (key === undefined) {
    key = foldForSearch(
      `${entry.title} | ${formatEntryTitle(entry.title, entry.href)}`
    );
    searchKeys.set(entry, key);
  }
  return key;
}

/** Folded display title (what users read) and, for person entries, the
 *  surname from the raw `Surname, Given` TOC title. */
type RankTitles = { display: string; surname: string | null };

/** `Kant, Immanuel` / `Abelard [Abailard], Peter` — not topic heads like
 *  `logic, history of: modal`, which are lowercase or carry a colon. */
const PERSON_TITLE = /^(\p{Lu}[^,:[\]]*?)(?:\s*\[[^\]]*\])?,\s*\p{Lu}[^:]*$/u;

const rankTitles = new WeakMap<EntryIndexItem, RankTitles>();

function rankTitlesFor(entry: EntryIndexItem): RankTitles {
  let titles = rankTitles.get(entry);
  if (titles === undefined) {
    const person = PERSON_TITLE.exec(entry.title);
    titles = {
      display: foldForSearch(formatEntryTitle(entry.title, entry.href)),
      surname: person?.[1] ? foldForSearch(person[1]) : null,
    };
    rankTitles.set(entry, titles);
  }
  return titles;
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

/** Whether `needle` occurs in `text` at the start of a word. */
function startsWord(text: string, needle: string): boolean {
  for (
    let index = text.indexOf(needle);
    index !== -1;
    index = text.indexOf(needle, index + 1)
  ) {
    if (!isWordChar(text[index - 1])) {
      return true;
    }
  }
  return false;
}

/**
 * Lower is better:
 * 0 exact title (or the surname of a `Surname, Given` entry),
 * 1 title starts with the phrase as whole words, 2 whole words elsewhere,
 * 3 title starts with the phrase mid-word (`logic` → `Logical`),
 * 4 a word starts with it, 5 every query word starts a word,
 * 6 anywhere (mid-word or bracket aliases).
 */
function rankIn(text: string, phrase: string, terms: readonly string[]): number {
  if (text === phrase) {
    return 0;
  }
  let best = 6;
  for (
    let index = text.indexOf(phrase);
    index !== -1 && best > 1;
    index = text.indexOf(phrase, index + 1)
  ) {
    if (isWordChar(text[index - 1])) {
      continue;
    }
    const whole = !isWordChar(text[index + phrase.length]);
    const tier = index === 0 ? (whole ? 1 : 3) : whole ? 2 : 4;
    best = Math.min(best, tier);
  }
  if (best < 6) {
    return best;
  }
  return terms.every((term) => startsWord(text, term)) ? 5 : 6;
}

function matchRank(
  titles: RankTitles,
  phrase: string,
  terms: readonly string[],
): number {
  if (titles.surname === phrase) {
    return 0;
  }
  return rankIn(titles.display, phrase, terms);
}

type RankedEntry = { entry: EntryIndexItem; rank: number; length: number };

/** Best rank first; shorter titles break ties, then contents order. */
function byRank(left: RankedEntry, right: RankedEntry): number {
  return left.rank - right.rank || left.length - right.length;
}

const WARM_CHUNK = 200;

/** Build search keys in idle time so the first keystroke doesn't format every title. */
export function warmSearchKeys(entries: readonly EntryIndexItem[]): void {
  const schedule =
    typeof requestIdleCallback === 'function'
      ? (task: () => void) => requestIdleCallback(task)
      : (task: () => void) => setTimeout(task, 0);
  let index = 0;
  const step = () => {
    const end = Math.min(index + WARM_CHUNK, entries.length);
    for (; index < end; index++) {
      searchKey(entries[index]!);
      rankTitlesFor(entries[index]!);
    }
    if (index < entries.length) {
      schedule(step);
    }
  };
  schedule(step);
}

/**
 * Every query word must appear (any order); entries containing the whole
 * phrase rank first, each group ordered by `matchRank`. `related` entries
 * lead either way.
 */
export function filterEntries(
  entries: EntryIndexItem[],
  query: string,
  related: readonly EntryIndexItem[] = []
): EntryIndexItem[] {
  const phrase = foldForSearch(query);
  if (!phrase) {
    return [];
  }
  const terms = phrase.split(' ');
  const seen = new Set<string>();
  const results: EntryIndexItem[] = [];

  for (const pool of [related, entries]) {
    const whole: RankedEntry[] = [];
    const loose: RankedEntry[] = [];
    for (const entry of pool) {
      if (seen.has(entry.href)) {
        continue;
      }
      const key = searchKey(entry);
      const group = key.includes(phrase)
        ? whole
        : terms.every((term) => key.includes(term))
          ? loose
          : null;
      if (!group) {
        continue;
      }
      const titles = rankTitlesFor(entry);
      group.push({
        entry,
        rank: matchRank(titles, phrase, terms),
        length: titles.display.length,
      });
      seen.add(entry.href);
    }
    for (const group of [whole, loose]) {
      results.push(...group.sort(byRank).map(({ entry }) => entry));
    }
    if (results.length >= MAX_RESULTS) {
      break;
    }
  }

  return results.slice(0, MAX_RESULTS);
}

export function searchResultsUrl(query: string): string {
  const params = new URLSearchParams({ query: query.trim() });
  return `${window.location.origin}/search/searcher.py?${params.toString()}`;
}
