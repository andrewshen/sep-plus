import type { EntryIndexCache, EntryIndexItem } from './types';

const STORAGE_KEY = 'entryIndex';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RESULTS = 12;

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
    const title = (link.textContent || '').replace(/\s+/g, ' ').trim();
    if (!href || !title || seen.has(href)) {
      continue;
    }
    seen.add(href);
    items.push({ title, href });
  }

  return items;
}

export function parseContentsHtml(html: string): EntryIndexItem[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const byHref = new Map<string, string>();

  for (const link of Array.from(
    doc.querySelectorAll<HTMLAnchorElement>('a[href*="entries/"]')
  )) {
    const href = normalizeEntryHref(link.getAttribute('href') || '');
    const title = (link.textContent || '').replace(/\s+/g, ' ').trim();
    if (!href || !title) {
      continue;
    }
    const existing = byHref.get(href);
    if (!existing || title.length > existing.length) {
      byHref.set(href, title);
    }
  }

  return Array.from(byHref, ([href, title]) => ({ title, href }));
}

async function fetchEntryIndex(): Promise<EntryIndexItem[]> {
  const response = await fetch('/contents.html', { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`Failed to load contents (${response.status})`);
  }
  const html = await response.text();
  return parseContentsHtml(html);
}

export async function getEntryIndex(): Promise<EntryIndexItem[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const cache = stored[STORAGE_KEY];
  if (
    isEntryIndexCache(cache) &&
    cache.entries.length > 0 &&
    Date.now() - cache.fetchedAt < CACHE_TTL_MS
  ) {
    return cache.entries;
  }

  const entries = await fetchEntryIndex();
  const next: EntryIndexCache = {
    fetchedAt: Date.now(),
    entries,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return entries;
}

export function filterEntries(
  entries: EntryIndexItem[],
  query: string,
  related: readonly EntryIndexItem[] = []
): EntryIndexItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }

  const matches: EntryIndexItem[] = [];
  const seen = new Set<string>();

  for (const entry of related) {
    if (!entry.title.toLowerCase().includes(trimmed) || seen.has(entry.href)) {
      continue;
    }
    seen.add(entry.href);
    matches.push(entry);
    if (matches.length >= MAX_RESULTS) {
      return matches;
    }
  }

  for (const entry of entries) {
    if (seen.has(entry.href) || !entry.title.toLowerCase().includes(trimmed)) {
      continue;
    }
    seen.add(entry.href);
    matches.push(entry);
    if (matches.length >= MAX_RESULTS) {
      break;
    }
  }

  return matches;
}

export function searchResultsUrl(query: string): string {
  const params = new URLSearchParams({ query: query.trim() });
  return `${window.location.origin}/search/searcher.py?${params.toString()}`;
}
