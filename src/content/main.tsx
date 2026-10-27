import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  applyTheme,
  bootstrapHost,
  injectLocalFonts,
  isArticlePage,
  isHomePage,
  preloadLocalFonts,
  reformatPubinfo,
  relocateArticleEndMatter,
  styleRelatedEntries,
  restyleSearchResults,
  wrapSiteContentColumn,
} from '../host/bootstrap';
import { initFootnotes } from '../host/footnotes';
import {
  collectTocItems,
  prepareArticleNav,
} from '../host/toc';
import { DEFAULT_HIGHLIGHT_COLOR, getHighlightColor, getTheme } from '../lib/storage';
import { normalizeEntryUrl } from '../lib/annotations';
import type { HighlightColor, ThemePreference, TocItem } from '../lib/types';
import { App } from './App';
import uiStyles from './styles.css?inline';
import '../host/styles.css';

const READY_CLASS = 'sep-plus-ready';
const BOOT_TIMEOUT_MS = 8000;

let bootTimedOut = false;
let bootTimeout: number | undefined;

function revealPage(): void {
  if (bootTimeout !== undefined) {
    window.clearTimeout(bootTimeout);
    bootTimeout = undefined;
  }
  document
    .getElementById('sep-plus-root')
    ?.removeAttribute('data-sep-plus-booting');
  // boot.css hides via html:not(.sep-plus-ready) until this class is set.
  document.documentElement.classList.add(READY_CLASS);
}

function waitForDomReady(): Promise<void> {
  if (document.readyState !== 'loading') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', () => resolve(), {
      once: true,
    });
  });
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

/** A shadow host in the page flow (unlike the fixed overlays), so it scrolls
 *  with the page. React portals into its `${id}-mount` element. */
function createFlowHost(id: string, insert: (host: HTMLElement) => void): void {
  const host = document.createElement('div');
  host.id = id;
  insert(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = uiStyles;
  shadow.appendChild(style);
  const mount = document.createElement('div');
  mount.id = `${id}-mount`;
  shadow.appendChild(mount);
}

/** Full-page search: the search field sits above the result count. */
function insertSearchHost(host: HTMLElement): void {
  const anchor =
    document.querySelector('.search_total') ??
    document.querySelector('.searchpage') ??
    document.querySelector('.sep-plus-content-column h1')?.nextElementSibling;
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(host, anchor);
  } else {
    document.querySelector('.sep-plus-content-column')?.prepend(host);
  }
}

function mountShell(
  items: TocItem[],
  initialTheme: ThemePreference,
  initialHighlightColor: HighlightColor,
  articleMode: boolean,
  homeMode: boolean,
  articleSource?: string,
  articleTitle = '',
): void {
  const searchMode =
    !articleMode && !homeMode && location.pathname.startsWith('/search/');
  document.documentElement.classList.add('sep-plus');
  document.body.classList.add('sep-plus');
  document.documentElement.classList.toggle('sep-plus-home', homeMode);
  document.body.classList.toggle('sep-plus-home', homeMode);
  document.body.classList.toggle('sep-plus-site', !articleMode && !homeMode);
  document.body.classList.toggle('sep-plus-search', searchMode);

  // Detach rather than hide: SEP's sticky-sidebar script rewrites this node's
  // inline styles on every scroll, which forces style + layout while attached.
  document.querySelector('#article-sidebar')?.remove();

  const existingHost = document.getElementById('sep-plus-root') as
    | (HTMLElement & { sepPlusUnmount?: () => void })
    | null;
  existingHost?.sepPlusUnmount?.();
  existingHost?.remove();
  document.getElementById('sep-plus-annotation-layer')?.remove();
  document.getElementById('sep-plus-home')?.remove();
  document.getElementById('sep-plus-footer')?.remove();
  document.getElementById('sep-plus-search')?.remove();

  const host = document.createElement('div') as HTMLDivElement & {
    sepPlusUnmount?: () => void;
  };
  host.id = 'sep-plus-root';
  host.setAttribute('data-sep-plus-booting', '');
  document.documentElement.appendChild(host);

  const annotationLayer = document.createElement('div');
  annotationLayer.id = 'sep-plus-annotation-layer';
  document.documentElement.appendChild(annotationLayer);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = uiStyles;
  shadow.appendChild(style);

  const mount = document.createElement('div');
  mount.id = 'sep-plus-shadow-root';
  shadow.appendChild(mount);

  const annotationShadow = annotationLayer.attachShadow({ mode: 'open' });
  const annotationStyle = document.createElement('style');
  annotationStyle.textContent = uiStyles;
  annotationShadow.appendChild(annotationStyle);
  const annotationMount = document.createElement('div');
  annotationMount.id = 'sep-plus-annotation-mount';
  annotationShadow.appendChild(annotationMount);

  if (homeMode) {
    createFlowHost('sep-plus-home', (homeHost) => document.body.prepend(homeHost));
  } else if (!articleMode) {
    createFlowHost('sep-plus-footer', (footerHost) => document.body.append(footerHost));
    if (searchMode) {
      createFlowHost('sep-plus-search', insertSearchHost);
    }
  }

  const root = createRoot(mount);
  host.sepPlusUnmount = () => root.unmount();
  flushSync(() => {
    root.render(
      <App
        items={items}
        initialTheme={initialTheme}
        initialHighlightColor={initialHighlightColor}
        articleMode={articleMode}
        homeMode={homeMode}
        articleSource={articleSource}
        articleTitle={articleTitle}
      />
    );
  });
}

async function main(): Promise<void> {
  await waitForDomReady();
  if (bootTimedOut) {
    return;
  }

  const [theme, highlightColor] = await Promise.all([
    themePromise,
    highlightColorPromise,
  ]);
  if (bootTimedOut) {
    return;
  }

  const articleMode = isArticlePage();
  const homeMode = !articleMode && isHomePage();
  const articleSource = articleMode
    ? normalizeEntryUrl(window.location.href) ?? undefined
    : undefined;
  const articleTitle = articleMode
    ? (
        document.querySelector<HTMLElement>('#article-content h1')
          ?.textContent ?? document.title
      )
        .replace(/\s+/g, ' ')
        .trim()
    : '';
  let tocItems: TocItem[] = [];

  if (articleMode) {
    prepareArticleNav();
    tocItems = collectTocItems();
    reformatPubinfo();
    styleRelatedEntries();
    relocateArticleEndMatter();
  } else if (!homeMode) {
    wrapSiteContentColumn();
    restyleSearchResults();
  }

  bootstrapHost(theme);
  mountShell(
    tocItems,
    theme,
    highlightColor,
    articleMode,
    homeMode,
    articleSource,
    articleTitle,
  );

  if (articleMode) {
    initFootnotes();
  }

  await fontsReadyPromise;
  if (bootTimedOut) {
    return;
  }

  await waitForNextFrame();
  revealPage();
}

// Ensure a prior ready state (e.g. bfcache) cannot skip the boot hide.
document.documentElement.classList.remove(READY_CLASS);

injectLocalFonts();
const fontsReadyPromise = preloadLocalFonts();
const themePromise: Promise<ThemePreference> = getTheme().then(
  (theme) => {
    applyTheme(theme);
    return theme;
  },
  (error: unknown) => {
    console.warn('SEP+ could not load the saved theme.', error);
    applyTheme('light');
    return 'light';
  }
);

const highlightColorPromise: Promise<HighlightColor> = getHighlightColor().catch(
  (error: unknown) => {
    console.warn('SEP+ could not load the saved highlight color.', error);
    return DEFAULT_HIGHLIGHT_COLOR;
  }
);

bootTimeout = window.setTimeout(() => {
  bootTimedOut = true;
  revealPage();
}, BOOT_TIMEOUT_MS);

void main().catch((error: unknown) => {
  console.error('SEP+ failed to initialize.', error);
  revealPage();
});
