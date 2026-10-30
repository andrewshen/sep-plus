import { normalizeEntryHref } from './entryIndex';

export type RecentEntry = {
  title: string;
  href: string;
  authors: string[];
  /** As printed on new.html, e.g. "October 8, 2026". */
  date: string;
  status: 'new' | 'revised';
};

type RecentEntriesCache = {
  fetchedAt: number;
  entries: RecentEntry[];
};

const STORAGE_KEY = 'recentEntries';
/** new.html changes a few times a week; refresh in the background hourly. */
const STALE_AFTER_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 20;
const STATUS_PATTERN = /\[\s*(NEW|REVISED)\s*:\s*([^\]]+)\]/i;

function isRecentEntry(value: unknown): value is RecentEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as RecentEntry;
  return (
    typeof entry.title === 'string' &&
    typeof entry.href === 'string' &&
    Array.isArray(entry.authors) &&
    typeof entry.date === 'string' &&
    (entry.status === 'new' || entry.status === 'revised')
  );
}

function isRecentEntriesCache(value: unknown): value is RecentEntriesCache {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const cache = value as RecentEntriesCache;
  return (
    typeof cache.fetchedAt === 'number' &&
    Array.isArray(cache.entries) &&
    cache.entries.every(isRecentEntry)
  );
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** "A, B, and C" / "A and B" → ["A", "B", "C"]. */
export function splitAuthors(text: string): string[] {
  return clean(text)
    .split(/\s*,\s*(?:and\s+)?|\s+and\s+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/** "October 8, 2026" → "October 8". */
export function formatRecentDate(date: string): string {
  return clean(date).replace(/,\s*\d{4}$/, '');
}

export function parseNewHtml(
  html: string,
  base = `${window.location.origin}/`,
): RecentEntry[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const entries: RecentEntry[] = [];
  const seen = new Set<string>();

  for (const item of Array.from(doc.querySelectorAll('li'))) {
    const link = item.querySelector<HTMLAnchorElement>('a[href*="entries/"]');
    const status = (item.textContent ?? '').match(STATUS_PATTERN);
    if (!link || !status?.[1] || !status[2]) {
      continue;
    }
    const href = normalizeEntryHref(link.getAttribute('href') ?? '', base);
    const title = clean(link.textContent ?? '');
    if (!href || !title || seen.has(href)) {
      continue;
    }
    // Authors are the parenthesized text right after the link.
    let afterLink = '';
    for (let node = link.nextSibling; node; node = node.nextSibling) {
      afterLink += node.textContent ?? '';
    }
    const authorsText = afterLink.match(/^\s*\(([^)]*)\)/)?.[1] ?? '';
    seen.add(href);
    entries.push({
      title,
      href,
      authors: splitAuthors(authorsText),
      date: clean(status[2]),
      status: status[1].toLowerCase() === 'new' ? 'new' : 'revised',
    });
    if (entries.length >= MAX_ENTRIES) {
      break;
    }
  }

  return entries;
}

async function fetchRecentEntries(): Promise<RecentEntry[]> {
  const response = await fetch('/new.html', { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`Failed to load new.html (${response.status})`);
  }
  return parseNewHtml(await response.text());
}

/** Null when there's no usable cache, including when storage can't be read
 *  after an extension update (chrome.* then throws synchronously). */
async function readCache(): Promise<RecentEntriesCache | null> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const cache = stored[STORAGE_KEY];
    return isRecentEntriesCache(cache) ? cache : null;
  } catch {
    return null;
  }
}

/**
 * Stale-while-revalidate: `onEntries` gets the cached list immediately (if
 * any), then the fresh list once it's fetched, when the cache is missing or
 * older than an hour.
 */
export async function loadRecentEntries(
  onEntries: (entries: RecentEntry[]) => void,
): Promise<void> {
  const cache = await readCache();
  if (cache?.entries.length) {
    onEntries(cache.entries);
    if (Date.now() - cache.fetchedAt < STALE_AFTER_MS) {
      return;
    }
  }
  const entries = await fetchRecentEntries();
  if (!entries.length) {
    return;
  }
  onEntries(entries);
  try {
    await chrome.storage.local.set({
      [STORAGE_KEY]: { fetchedAt: Date.now(), entries } satisfies RecentEntriesCache,
    });
  } catch {
    // Not cached; the next homepage visit fetches again.
  }
}
