import type { TocItem } from '../lib/types';

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

export function getHeadingOffset(href: string): number | null {
  const id = href.startsWith('#') ? href.slice(1) : href;
  const target = document.querySelector(`[name="${id}"], [id="${id}"]`);
  if (!target) {
    return null;
  }
  const rect = target.getBoundingClientRect();
  return rect.top + window.scrollY;
}

export function smoothScrollToHref(href: string): void {
  const id = href.startsWith('#') ? href.slice(1) : href;
  const target = document.querySelector(`[name="${id}"], [id="${id}"]`);
  if (!target) {
    return;
  }
  const top = target.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({
    top: Math.max(top - 24, 0),
    behavior: 'smooth',
  });
}

export function getActiveTocIndex(
  items: TocItem[],
  scrollOffset = 80
): number {
  const scroll = window.scrollY + scrollOffset;
  let index = -1;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      continue;
    }
    const top = getHeadingOffset(item.href);
    if (typeof top === 'number' && top <= scroll) {
      index = i;
    }
  }

  if (index < 0 && items.length) {
    return 0;
  }
  return index;
}

export function identifyPrintBlock(): void {
  for (const el of Array.from(document.querySelectorAll('div'))) {
    const style = window.getComputedStyle(el);
    if (
      style.display === 'block' &&
      style.width === '242px' &&
      style.float === 'left'
    ) {
      el.id = 'print-block';
    }
  }
}
