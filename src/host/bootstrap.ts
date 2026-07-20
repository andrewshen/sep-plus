import { getTheme, onThemeChanged, setTheme } from '../lib/storage';
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

function swapLogo(dark: boolean): void {
  const img = document.querySelector<HTMLImageElement>('#site-logo img');
  if (!img) {
    return;
  }
  img.src = dark
    ? 'https://i.imgur.com/eRpN6wC.png'
    : '../../symbols/sep-man-red.png';
}

export function setDarkMode(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
  document.body?.classList.toggle('dark', dark);
  swapLogo(dark);
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

function addFootnoteHoverState(): void {
  const footnotes = document.querySelector('#footnotes');
  if (!footnotes) {
    return;
  }

  const supLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('sup a')
  );
  const footnoteParagraphs = Array.from(
    footnotes.querySelectorAll<HTMLParagraphElement>('p')
  );

  for (const [index, link] of supLinks.entries()) {
    link.addEventListener('mouseenter', () => {
      const source = footnoteParagraphs[index];
      if (!source || !link.parentElement) {
        return;
      }
      const footnote = source.cloneNode(true);
      const container = document.createElement('div');
      container.className = 'footnote-annotation';
      container.appendChild(footnote);
      link.parentElement.appendChild(container);
    });

    link.addEventListener('mouseleave', () => {
      const annotation = link.parentElement?.querySelector(
        '.footnote-annotation'
      );
      if (!(annotation instanceof HTMLElement)) {
        return;
      }
      annotation.style.opacity = '0';
      window.setTimeout(() => annotation.remove(), 100);
    });
  }
}

export function addFootnotes(): void {
  const firstSup = document.querySelector<HTMLAnchorElement>(
    '#article-content sup a'
  );
  if (!firstSup?.href) {
    return;
  }

  const footnotesURL = firstSup.href.split('#')[0];
  if (!footnotesURL) {
    return;
  }

  void fetch(footnotesURL)
    .then((response) => response.text())
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const footnotes = doc.getElementById('aueditable');
      const bibliography = document.querySelector('#bibliography');
      if (!footnotes || !bibliography) {
        return;
      }

      footnotes.id = 'footnotes';
      bibliography.before(footnotes);

      const heading = footnotes.querySelector('h2');
      if (heading) {
        heading.textContent = 'Footnotes';
      }

      for (const link of Array.from(
        footnotes.querySelectorAll<HTMLAnchorElement>('p a')
      )) {
        const oldURL = link.getAttribute('href');
        if (!oldURL?.includes('#')) {
          continue;
        }
        link.setAttribute('href', `#${oldURL.split('#')[1]}`);
      }

      addFootnoteHoverState();
    })
    .catch(() => {
      console.log('No footnotes found');
    });
}

function themeIconSrc(theme: ThemePreference): string {
  switch (theme) {
    case 'auto':
      return 'https://i.imgur.com/e1Zorrs.png';
    case 'dark':
      return 'https://i.imgur.com/TyBZlqK.png';
    case 'light':
    default:
      return 'https://i.imgur.com/UUO3OBn.png';
  }
}

/** Theme picker in the SEP header — used on non-article pages only. */
export function mountHeaderThemeSelector(theme: ThemePreference): void {
  if (document.querySelector('.select-container')) {
    return;
  }

  const selectContainer = document.createElement('div');
  selectContainer.className = 'select-container';

  const themeSelector = document.createElement('select');
  themeSelector.id = 'theme-selector';

  for (const [value, label] of [
    ['light', 'Light'],
    ['dark', 'Dark'],
    ['auto', 'System'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    themeSelector.appendChild(option);
  }
  themeSelector.value = theme;

  const themeIcon = document.createElement('img');
  themeIcon.id = 'theme-icon';
  themeIcon.src = themeIconSrc(theme);
  themeIcon.alt = 'Theme Icon';
  themeIcon.width = 12;
  themeIcon.height = 12;

  const chevronIcon = document.createElement('img');
  chevronIcon.id = 'chevron-icon';
  chevronIcon.src = 'https://i.imgur.com/H0Ih6cL.png';
  chevronIcon.alt = 'Chevron';
  chevronIcon.width = 12;
  chevronIcon.height = 12;

  selectContainer.append(themeSelector, themeIcon, chevronIcon);

  const searchpageSearch = document.querySelector('.searchpage #search');
  const contentSearch = document.querySelector('#content #search');
  if (searchpageSearch || contentSearch) {
    const searchContainer = document.createElement('div');
    searchContainer.id = 'search';
    searchContainer.append(selectContainer);
    document.querySelector('#header')?.append(searchContainer);
    selectContainer.style.marginTop = '-15px';
  } else {
    document.querySelector('#search')?.append(selectContainer);
  }

  themeSelector.addEventListener('change', () => {
    const value = themeSelector.value;
    if (value === 'light' || value === 'dark' || value === 'auto') {
      void setTheme(value).then(() => applyTheme(value));
      themeIcon.src = themeIconSrc(value);
    }
  });
}

export function bindSearchKeyboard(): void {
  document.addEventListener('keyup', (event) => {
    const input = document.querySelector<HTMLInputElement>(
      'input[type=search]'
    );
    if (!input) {
      return;
    }
    if (event.key === '/') {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      input.focus();
    } else if (event.key === 'Escape') {
      input.blur();
    }
  });
}

export function isArticlePage(): boolean {
  return Boolean(
    document.querySelector('#article-nav li') &&
      !location.href.includes('notes.html')
  );
}

export function bootstrapHost(options: {
  articleMode: boolean;
  theme: ThemePreference;
}): void {
  injectLocalFonts();

  const searchInput = document.querySelector<HTMLInputElement>(
    'input[type=search]'
  );
  if (searchInput) {
    searchInput.placeholder = 'Type / to search SEP';
  }

  applyTheme(options.theme);

  if (!options.articleMode) {
    mountHeaderThemeSelector(options.theme);
  }

  bindSearchKeyboard();

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      void getTheme().then((theme) => {
        if (theme === 'auto') {
          applyTheme('auto');
        }
      });
    });

  onThemeChanged((theme) => {
    applyTheme(theme);
    const selector = document.querySelector<HTMLSelectElement>(
      '#theme-selector'
    );
    const icon = document.querySelector<HTMLImageElement>('#theme-icon');
    if (selector) {
      selector.value = theme;
    }
    if (icon) {
      icon.src = themeIconSrc(theme);
    }
  });
}
