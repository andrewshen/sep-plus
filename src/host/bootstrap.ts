import { formatEntryTitle } from '../lib/formatEntryTitle';
import { getTheme, onThemeChanged } from '../lib/storage';
import type { ThemePreference } from '../lib/types';

function fontFace(
  family: string,
  file: string,
  weight: number,
  style: 'normal' | 'italic' = 'normal'
): string {
  return (
    '@font-face{font-family:"' +
    family +
    '";font-style:' +
    style +
    ';font-weight:' +
    weight +
    ';font-display:swap;src:url("' +
    chrome.runtime.getURL('fonts/' + file) +
    '") format("woff2");}'
  );
}

export function injectLocalFonts(): void {
  if (document.querySelector('[data-sep-plus-fonts="local"]')) {
    return;
  }
  const style = document.createElement('style');
  style.setAttribute('data-sep-plus-fonts', 'local');
  style.textContent = [
    fontFace('Public Sans', 'PublicSans-Regular.woff2', 400),
    fontFace('Public Sans', 'PublicSans-Medium.woff2', 500),
    fontFace('Public Sans', 'PublicSans-Bold.woff2', 700),
    fontFace('Libre Baskerville', 'LibreBaskerville-Regular.woff2', 400),
    fontFace('Libre Baskerville', 'LibreBaskerville-Italic.woff2', 400, 'italic'),
    fontFace('Libre Baskerville', 'LibreBaskerville-SemiBold.woff2', 600),
    fontFace(
      'Libre Baskerville',
      'LibreBaskerville-SemiBoldItalic.woff2',
      600,
      'italic'
    ),
    // Map CSS bold/700 onto the 600 face so <b>/strong/bold all use SemiBold.
    fontFace('Libre Baskerville', 'LibreBaskerville-SemiBold.woff2', 700),
    fontFace(
      'Libre Baskerville',
      'LibreBaskerville-SemiBoldItalic.woff2',
      700,
      'italic'
    ),
  ].join('');
  document.documentElement.appendChild(style);
}

export async function preloadLocalFonts(): Promise<void> {
  const fontsReady = Promise.all([
    document.fonts.load('400 1em "Public Sans"'),
    document.fonts.load('500 1em "Public Sans"'),
    document.fonts.load('700 1em "Public Sans"'),
    document.fonts.load('400 1em "Libre Baskerville"'),
    document.fonts.load('italic 400 1em "Libre Baskerville"'),
    document.fonts.load('600 1em "Libre Baskerville"'),
  ]).then(
    () => undefined,
    () => undefined
  );
  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, 300);
  });

  await Promise.race([fontsReady, timeout]);
}

export function setDarkMode(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
  document.body?.classList.toggle('dark', dark);
}

export function applyTheme(theme: ThemePreference): void {
  switch (theme) {
    case 'auto':
      setDarkMode(
        Boolean(
          window.matchMedia?.('(prefers-color-scheme: dark)').matches
        )
      );
      break;
    case 'dark':
      setDarkMode(true);
      break;
    case 'light':
    default:
      setDarkMode(false);
      break;
  }
}

function parsePubDates(text: string): {
  published: string | null;
  revised: string | null;
} {
  const published = text.match(
    /First published\s+\w+\s+(\w+\s+\d{1,2},\s+\d{4})/i
  );
  const revised = text.match(
    /substantive revision\s+\w+\s+(\w+\s+\d{1,2},\s+\d{4})/i
  );
  return {
    published: published?.[1] ?? null,
    revised: revised?.[1] ?? null,
  };
}

type EntryAuthor = { name: string; href: string | null };

function collectEntryAuthors(): EntryAuthor[] {
  const paragraph = document.querySelector('#article-copyright p');
  if (!paragraph) {
    return [];
  }

  const authors: EntryAuthor[] = [];
  let afterBy = false;
  let textBuffer = '';

  function flushTextAuthor(): void {
    const name = textBuffer.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
    textBuffer = '';
    if (!name || name.toLowerCase() === 'by' || name.includes('@')) {
      return;
    }
    authors.push({ name, href: null });
  }

  for (const node of Array.from(paragraph.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent || '';
      if (!afterBy) {
        if (!/\bby\b/i.test(text)) {
          continue;
        }
        afterBy = true;
        text = text.replace(/^[\s\S]*?\bby\b/i, '');
      }
      textBuffer += text;
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const el = node as HTMLElement;
    if (el.tagName === 'BR') {
      if (afterBy) {
        flushTextAuthor();
      }
      continue;
    }

    if (el.tagName !== 'A') {
      continue;
    }

    const href = el.getAttribute('href') || '';
    if (href.includes('info.html')) {
      continue;
    }

    if (href.startsWith('mailto:')) {
      if (afterBy) {
        flushTextAuthor();
      }
      const last = authors.at(-1);
      if (last && last.href === null) {
        last.href = (el as HTMLAnchorElement).href;
      }
      continue;
    }

    afterBy = true;
    flushTextAuthor();
    const name = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (name) {
      authors.push({ name, href: (el as HTMLAnchorElement).href });
    }
  }

  if (afterBy) {
    flushTextAuthor();
  }

  return authors;
}

export function reformatPubinfo(): void {
  const pubinfo = document.querySelector<HTMLElement>('#pubinfo');
  if (!pubinfo || pubinfo.dataset.sepPlusPubinfo === '1') {
    return;
  }

  const dates = parsePubDates(pubinfo.textContent || '');
  const authors = collectEntryAuthors();
  if (!authors.length && !dates.published && !dates.revised) {
    return;
  }

  const em = document.createElement('em');
  let needsSeparator = false;

  function appendSeparator(): void {
    if (!needsSeparator) {
      needsSeparator = true;
      return;
    }
    em.appendChild(document.createTextNode(' · '));
  }

  for (const author of authors) {
    appendSeparator();
    if (author.href) {
      const link = document.createElement('a');
      link.className = 'sep-pubinfo-author';
      link.href = author.href;
      if (!author.href.startsWith('mailto:')) {
        link.target = 'other';
        link.rel = 'noopener noreferrer';
      }
      link.textContent = author.name;
      em.appendChild(link);
    } else {
      em.appendChild(document.createTextNode(author.name));
    }
  }

  const displayDate = dates.revised || dates.published;
  if (displayDate) {
    appendSeparator();
    const dateEl = document.createElement('span');
    dateEl.className = 'sep-pubinfo-date';
    dateEl.textContent = displayDate;
    if (dates.revised && dates.published) {
      dateEl.title = 'First published ' + dates.published;
    }
    em.appendChild(dateEl);
  }

  pubinfo.replaceChildren(em);
  pubinfo.dataset.sepPlusPubinfo = '1';
}

export function isHomePage(): boolean {
  return /^\/(index\.html?)?$/.test(location.pathname);
}

export function isArticlePage(): boolean {
  return Boolean(
    document.querySelector('#article-nav li') &&
      !location.href.includes('notes.html')
  );
}

/** "1–10 of 1339 documents found" → summary copy for the search page. */
export function parseSearchSummary(
  status: string,
  query: string,
  pageSize = 10,
): { count: string; page: string; current: number; totalPages: number } | null {
  const match = status
    .replace(/\u2013/g, '-')
    .match(/(\d[\d,]*)\s*-\s*(\d[\d,]*)\s+of\s+(\d[\d,]*)/i);
  if (!match || pageSize < 1) {
    return null;
  }
  const start = Number((match[1] ?? '').replace(/,/g, ''));
  const total = Number((match[3] ?? '').replace(/,/g, ''));
  if (!Number.isFinite(total) || total < 1 || !Number.isFinite(start) || start < 1) {
    return null;
  }
  const current = Math.floor((start - 1) / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);
  return {
    count: `${total.toLocaleString('en-US')} results for “${query.trim()}”`,
    page: `Page ${current.toLocaleString('en-US')} of ${totalPages.toLocaleString('en-US')}`,
    current,
    totalPages,
  };
}

/** Nearby pages, plus the last page when it falls outside that window. */
export function searchPagerItems(
  current: number,
  totalPages: number,
): Array<number | 'ellipsis'> {
  if (totalPages < 1) {
    return [];
  }
  const page = Math.min(Math.max(current, 1), totalPages);
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);

  const items: Array<number | 'ellipsis'> = [];
  if (start > 1) {
    items.push(1);
    if (start > 2) {
      items.push('ellipsis');
    }
  }
  for (let number = start; number <= end; number += 1) {
    items.push(number);
  }
  if (end < totalPages) {
    if (end < totalPages - 1) {
      items.push('ellipsis');
    }
    items.push(totalPages);
  }
  return items;
}

/**
 * Stretch the title link over the listing so author and snippet share its
 * href. Safe to run more than once.
 */
function stretchSearchResultLinks(): void {
  for (const listing of document.querySelectorAll<HTMLElement>('.result_listing')) {
    if (listing.dataset.sepPlusResultLink === '1') {
      continue;
    }
    const link = listing.querySelector(':scope > .result_title a.l');
    if (!link) {
      continue;
    }
    listing.dataset.sepPlusResultLink = '1';
  }
}

/** Title, then author, then snippet. Safe to run more than once. */
function placeSearchAuthors(): void {
  for (const listing of document.querySelectorAll<HTMLElement>('.result_listing')) {
    const title = listing.querySelector(':scope > .result_title');
    const author = listing.querySelector(':scope > .result_author');
    if (!title || !author || title.nextElementSibling === author) {
      continue;
    }
    title.after(author);
  }
}

/**
 * Drop the native "Search" heading and replace the hit-range line with
 * "{total} results for "{query}"" and "Page n of m".
 */
export function restyleSearchResults(): void {
  placeSearchAuthors();
  stretchSearchResultLinks();

  const totalEl = document.querySelector<HTMLElement>('.search_total');
  if (!totalEl || totalEl.dataset.sepPlusSearchSummary === '1') {
    return;
  }

  const heading = totalEl
    .closest('#content')
    ?.querySelector<HTMLElement>(':scope > h1, :scope > .sep-plus-content-column > h1');
  if (heading && /^search$/i.test((heading.textContent ?? '').trim())) {
    heading.remove();
  }

  const query = new URLSearchParams(location.search).get('query') ?? '';
  const pageSize = Number(
    totalEl
      .parentElement?.querySelector<HTMLAnchorElement>('a[href*="pagesize="]')
      ?.href.match(/[?&]pagesize=(\d+)/)?.[1] ?? 10,
  );
  const parsed = parseSearchSummary(totalEl.textContent ?? '', query, pageSize);
  if (!parsed) {
    return;
  }

  restyleSearchPager(parsed.current, parsed.totalPages);

  const count = document.createElement('span');
  count.className = 'sep-plus-search-summary-count';
  const labelMatch = parsed.count.match(/^(.*?)(results for)(.*)$/);
  if (labelMatch) {
    const [, before = '', labelText = '', after = ''] = labelMatch;
    const label = document.createElement('span');
    label.className = 'sep-plus-search-summary-label';
    label.textContent = labelText;
    count.append(before, label, after);
  } else {
    count.textContent = parsed.count;
  }
  const page = document.createElement('span');
  page.className = 'sep-plus-search-summary-page';
  page.textContent = parsed.page;
  totalEl.replaceChildren(count, page);
  totalEl.classList.add('sep-plus-search-summary');
  totalEl.dataset.sepPlusSearchSummary = '1';
}

function pageHref(template: string, page: number): string {
  const url = new URL(template, location.href);
  url.searchParams.set('page', String(page));
  return url.href;
}

/** Centered page window, with Previous and Next only when they can be used. */
function restyleSearchPager(current: number, totalPages: number): void {
  const nav = document.querySelector<HTMLElement>('.PagingNav');
  if (!nav || totalPages < 1) {
    return;
  }

  const template = nav.querySelector('a[href*="page="]')?.getAttribute('href');
  if (!template) {
    return;
  }

  const pager = document.createElement('nav');
  pager.className = 'sep-plus-search-pager';
  pager.setAttribute('aria-label', 'Search results pages');

  const step = (label: string, page: number) => {
    const link = document.createElement('a');
    link.className = 'sep-plus-search-pager-step';
    link.href = pageHref(template, page);
    link.textContent = label;
    return link;
  };

  if (current > 1) {
    pager.append(step('Previous', current - 1));
  }

  for (const item of searchPagerItems(current, totalPages)) {
    if (item === 'ellipsis') {
      const gap = document.createElement('span');
      gap.className = 'sep-plus-search-pager-gap';
      gap.setAttribute('aria-hidden', 'true');
      gap.textContent = '…';
      pager.append(gap);
      continue;
    }
    if (item === current) {
      const currentPage = document.createElement('span');
      currentPage.className = 'sep-plus-search-pager-page is-current';
      currentPage.setAttribute('aria-current', 'page');
      currentPage.textContent = item.toLocaleString('en-US');
      pager.append(currentPage);
      continue;
    }
    const link = document.createElement('a');
    link.className = 'sep-plus-search-pager-page';
    link.href = pageHref(template, item);
    link.textContent = item.toLocaleString('en-US');
    pager.append(link);
  }

  if (current < totalPages) {
    pager.append(step('Next', current + 1));
  }

  nav.replaceWith(pager);
}

/**
 * Non-entry pages lack #article-content. Wrap #content’s main body in a
 * single column so max-width centering matches entry pages.
 */
export function wrapSiteContentColumn(): void {
  const content = document.querySelector<HTMLElement>('#content');
  if (
    !content ||
    content.querySelector('#article') ||
    content.dataset.sepPlusContentColumn === '1'
  ) {
    return;
  }

  // contents.html keeps #toc-wrapper as a sibling of #content (outside the
  // sheet). Pull it in so the title + A–Z nav sit in the reading column.
  const tocWrapper = document.querySelector<HTMLElement>('#toc-wrapper');
  if (tocWrapper && tocWrapper.parentElement !== content) {
    content.insertBefore(tocWrapper, content.firstChild);
  }

  const column = document.createElement('div');
  column.className = 'sep-plus-content-column';

  while (content.firstChild) {
    column.appendChild(content.firstChild);
  }
  content.appendChild(column);
  content.dataset.sepPlusContentColumn = '1';
}

/**
 * Turn pipe-separated Related Entries links into a wrap of pill chips.
 */
export function styleRelatedEntries(): void {
  const section = document.querySelector<HTMLElement>('#related-entries');
  if (!section || section.dataset.sepPlusRelated === '1') {
    return;
  }

  const paragraph = section.querySelector('p');
  if (!paragraph) {
    return;
  }

  const links = Array.from(
    paragraph.querySelectorAll<HTMLAnchorElement>('a[href]')
  );
  if (!links.length) {
    return;
  }

  const list = document.createElement('div');
  list.className = 'sep-plus-related-entries';
  for (const link of links) {
    const rawTitle = (link.textContent || '').replace(/\s+/g, ' ').trim();
    if (rawTitle) {
      // Keep raw title for search matching; formatEntryTitle is display-only.
      link.dataset.sepPlusRawTitle = rawTitle;
      link.textContent = formatEntryTitle(rawTitle, link.href);
    }
    list.appendChild(link);
  }
  paragraph.replaceWith(list);
  section.dataset.sepPlusRelated = '1';
}

/**
 * Remove SEP's entry end-matter (author copyright, fundraising banner,
 * institutional credits); the site footer covers the last two. Returns the
 * author copyright as a single line for the footer to show instead.
 */
export function extractEntryCopyright(): HTMLElement | null {
  const paragraph = document.querySelector('#article-copyright p');
  const line = paragraph ? (paragraph.cloneNode(true) as HTMLElement) : null;

  if (line) {
    for (const br of Array.from(line.querySelectorAll('br'))) {
      br.replaceWith(' ');
    }
    // Drop the <> around the author email; the mailto link stands alone.
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? '';
      if (/[<>]/.test(text)) {
        node.textContent = text.replace(/[<>]/g, '');
      }
    }
    // Obfuscated emails wrap each @ and . in <abbr> inside an <em>, which
    // renders italic with dotted underlines. Flatten them to plain text.
    for (const el of Array.from(line.querySelectorAll('abbr, em'))) {
      el.replaceWith(...Array.from(el.childNodes).map((child) =>
        child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName === 'ABBR'
          ? (child.textContent ?? '')
          : child,
      ));
    }
    line.normalize();

    // Mark author names (plain text or personal-site links after "by") so the
    // footer can show them in the primary text color.
    let afterBy = false;
    for (const node of Array.from(line.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        let text = node.textContent ?? '';
        let prefix = '';
        if (!afterBy) {
          const match = text.match(/^[\s\S]*?\bby\b/i);
          if (!match) {
            continue;
          }
          afterBy = true;
          prefix = match[0];
          text = text.slice(prefix.length);
        }
        if (text.trim()) {
          const span = document.createElement('span');
          span.className = 'sep-entry-author';
          span.textContent = text;
          node.textContent = prefix;
          node.after(span);
        }
      } else if (afterBy && node instanceof HTMLAnchorElement) {
        const href = node.getAttribute('href') ?? '';
        if (!href.startsWith('mailto:')) {
          node.classList.add('sep-entry-author');
        }
      }
    }

    for (const link of Array.from(line.querySelectorAll('a'))) {
      if ((link.getAttribute('href') ?? '').startsWith('mailto:')) {
        link.prepend('(');
        link.append(')');
      }
      link.removeAttribute('style');
      link.className = link.classList.contains('sep-entry-author')
        ? 'sep-fade-link sep-entry-author'
        : 'sep-fade-link';
    }
  }

  for (const selector of ['#article-copyright', '#article-banner', '#site-credits']) {
    document.querySelector(selector)?.remove();
  }

  return line;
}

export function bootstrapHost(theme: ThemePreference): void {
  injectLocalFonts();
  applyTheme(theme);

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      void getTheme().then((current) => {
        if (current === 'auto') {
          applyTheme('auto');
        }
      });
    });

  onThemeChanged((next) => {
    applyTheme(next);
  });
}
