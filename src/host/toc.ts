import type { TocItem } from '../lib/types';
import { scrollWindowTo } from './scroll';

/** Height of the fixed SEP+ header; keep in sync with `.sep-header`. */
export const HEADER_HEIGHT = 60;

const SKIP_TEXTS = new Set([
  'Bibliography',
  'Academic Tools',
  'Other Internet Resources',
  'Related Entries',
]);

function getTocLevel(text: string): 1 | 2 | 3 {
  const match = text.trim().match(/^(\d+(?:\.\d+)*)/);
  if (!match?.[1]) {
    return 1;
  }
  const parts = match[1].split('.');
  if (parts.length >= 3) {
    return 3;
  }
  if (parts.length === 2) {
    return 2;
  }
  return 1;
}

export function prepareArticleNav(): void {
  const articleNav = document.querySelector('#article-nav');
  if (!articleNav) {
    return;
  }

  const firstItem = articleNav.querySelector('li');
  firstItem?.remove();

  for (const link of Array.from(articleNav.querySelectorAll('a'))) {
    const text = (link.textContent || '').replace(/\s+/g, ' ').trim();
    if (text === 'Bibliography' || text === 'Academic Tools') {
      const listItem = link.closest('li');
      if (listItem) {
        listItem.remove();
      } else {
        link.remove();
      }
    }
  }

  const toc = document.querySelector('#toc');
  const navList = articleNav.querySelector('ul');
  if (toc && navList) {
    const fragment = document.createDocumentFragment();
    for (const li of Array.from(toc.querySelectorAll('li'))) {
      fragment.appendChild(li);
    }
    navList.insertBefore(fragment, navList.firstChild);
    toc.remove();
  }
}

export function collectTocItems(): TocItem[] {
  const items: TocItem[] = [];
  const seen = new Set<string>();
  const links = document.querySelectorAll('#article-nav a, #toc a');

  for (const link of Array.from(links)) {
    const href = link.getAttribute('href');
    const text = (link.textContent || '').replace(/\s+/g, ' ').trim();

    if (!href || href.includes('://') || href === '#pagetopright') {
      continue;
    }
    if (SKIP_TEXTS.has(text) || seen.has(href)) {
      continue;
    }

    seen.add(href);
    items.push({
      href,
      text,
      level: getTocLevel(text),
    });
  }

  return items;
}

function findHeading(href: string): Element | null {
  const id = href.startsWith('#') ? href.slice(1) : href;
  return document.querySelector(`[name="${id}"], [id="${id}"]`);
}

/** Headings don't move between nodes, so resolve each list's targets once. */
const headingCache = new WeakMap<readonly TocItem[], (Element | null)[]>();

function headingsFor(items: readonly TocItem[]): (Element | null)[] {
  let headings = headingCache.get(items);
  if (!headings) {
    headings = items.map((item) => findHeading(item.href));
    headingCache.set(items, headings);
  }
  return headings;
}

export function smoothScrollToHref(href: string): void {
  const target = findHeading(href);
  if (!target) {
    return;
  }
  const top = target.getBoundingClientRect().top + window.scrollY;
  scrollWindowTo(top - HEADER_HEIGHT - 24);
}

export function getActiveTocIndex(
  items: readonly TocItem[],
  scrollOffset = HEADER_HEIGHT + 40
): number {
  const headings = headingsFor(items);
  let index = -1;

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    if (heading && heading.getBoundingClientRect().top <= scrollOffset) {
      index = i;
    }
  }

  if (index < 0 && items.length) {
    return 0;
  }
  return index;
}
