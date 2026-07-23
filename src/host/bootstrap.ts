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

export function isArticlePage(): boolean {
  return Boolean(
    document.querySelector('#article-nav li') &&
      !location.href.includes('notes.html')
  );
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

  const column = document.createElement('div');
  column.className = 'sep-plus-content-column';

  const nodes = Array.from(content.childNodes).filter(
    (node) =>
      !(node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).id === 'footer')
  );
  for (const node of nodes) {
    column.appendChild(node);
  }

  const footer = content.querySelector('#footer');
  if (footer) {
    content.insertBefore(column, footer);
  } else {
    content.appendChild(column);
  }

  content.dataset.sepPlusContentColumn = '1';
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
