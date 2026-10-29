import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import {
  applyTheme,
  bootstrapHost,
  extractEntryCopyright,
  injectLocalFonts,
  isArticlePage,
  isHomePage,
  preloadLocalFonts,
  reformatPubinfo,
  styleRelatedEntries,
  restyleSearchResults,
  wrapSiteContentColumn,
} from '../host/bootstrap';
import { initFootnotes } from '../host/footnotes';
import { detachNative, rollbackHost } from '../host/rollback';
import {
  collectContentsTocItems,
  collectTocItems,
  prepareArticleNav,
} from '../host/toc';
import {
  DEFAULT_HIGHLIGHT_COLOR,
  getHighlightColor,
  getTheme,
  readCachedTheme,
} from '../lib/storage';
import { normalizeEntryUrl } from '../lib/annotations';
import type { HighlightColor, ThemePreference, TocItem } from '../lib/types';
import { App } from './App';
import { boot } from './boot';
import uiStyles from './styles.css?inline';
import '../host/styles.css';

// Matches background.ts (not shared, so the content script stays one chunk).
const RESTORE_NATIVE_FONTS_MESSAGE = 'sep-plus:restore-native-fonts';
const READY_CLASS = 'sep-plus-ready';
const ALIVE_CLASS = 'sep-plus-alive';
const PARSE_TIMEOUT_MS = 15000;
const MOUNT_TIMEOUT_MS = 8000;
const HOST_IDS = [
  'sep-plus-root',
  'sep-plus-annotation-layer',
  'sep-plus-home',
  'sep-plus-footer',
  'sep-plus-search',
];
const PAGE_CLASSES = [
  'sep-plus',
  'sep-plus-home',
  'sep-plus-site',
  'sep-plus-search',
  'sep-plus-theme-applied',
  'dark',
];

let root: Root | null = null;
let stopFootnotes: (() => void) | null = null;
let renderError: unknown = null;
let booted = false;
let rolledBack = false;

function revealPage(): void {
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

function hasSepLayout(): boolean {
  return Boolean(
    document.body &&
      document.getElementById('container') &&
      document.getElementById('content'),
  );
}

/** Font Awesome is blocked for the SEP+ chrome; native SEP needs it back. */
function restoreNativeFonts(): void {
  try {
    void chrome.runtime
      .sendMessage({ type: RESTORE_NATIVE_FONTS_MESSAGE })
      .then((restored: unknown) => {
        if (!restored) {
          return;
        }
        for (const link of Array.from(
          document.querySelectorAll<HTMLLinkElement>(
            'link[rel="stylesheet"][href*="font-awesome"]',
          ),
        )) {
          link.after(link.cloneNode());
          link.remove();
        }
      })
      .catch(() => undefined);
  } catch {
    // Extension context is gone; nothing more to do.
  }
}

/** Put native SEP back after a failed boot or a crashed React tree. */
function rollback(error: unknown): void {
  if (rolledBack) {
    return;
  }
  rolledBack = true;
  console.error('SEP+ failed to initialize.', error);
  stopFootnotes?.();
  stopFootnotes = null;
  try {
    root?.unmount();
  } catch {
    // Already unmounted by React after the uncaught error.
  }
  root = null;
  for (const id of HOST_IDS) {
    document.getElementById(id)?.remove();
  }
  for (const element of [document.documentElement, document.body]) {
    element?.classList.remove(...PAGE_CLASSES);
  }
  rollbackHost();
  restoreNativeFonts();
  revealPage();
}

/** Not an SEP layout, so SEP+ never mounts: undo the document_start setup. */
function release(): void {
  // Wait out the stored theme so it can't re-add its classes afterwards.
  void themePromise.then(() => {
    for (const element of [document.documentElement, document.body]) {
      element?.classList.remove(...PAGE_CLASSES);
    }
    restoreNativeFonts();
  });
}

function onUncaughtRenderError(error: unknown): void {
  if (!booted) {
    renderError ??= error;
    return;
  }
  queueMicrotask(() => rollback(error));
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
  entryCopyright: HTMLElement | null = null,
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
  detachNative(document.querySelector('#article-sidebar'));

  const existingHost = document.getElementById('sep-plus-root') as
    | (HTMLElement & { sepPlusUnmount?: () => void })
    | null;
  existingHost?.sepPlusUnmount?.();
  for (const id of HOST_IDS) {
    document.getElementById(id)?.remove();
  }

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
  } else {
    createFlowHost('sep-plus-footer', (footerHost) => document.body.append(footerHost));
    if (searchMode) {
      createFlowHost('sep-plus-search', insertSearchHost);
    }
  }

  const reactRoot = createRoot(mount, {
    onUncaughtError: onUncaughtRenderError,
  });
  root = reactRoot;
  host.sepPlusUnmount = () => reactRoot.unmount();
  flushSync(() => {
    reactRoot.render(
      <App
        items={items}
        initialTheme={initialTheme}
        initialHighlightColor={initialHighlightColor}
        articleMode={articleMode}
        homeMode={homeMode}
        articleSource={articleSource}
        articleTitle={articleTitle}
        entryCopyright={entryCopyright}
      />
    );
  });
}

async function mount(): Promise<void> {
  const [theme, highlightColor] = await Promise.all([
    themePromise,
    highlightColorPromise,
  ]);

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
  let entryCopyright: HTMLElement | null = null;

  if (articleMode) {
    prepareArticleNav();
    tocItems = collectTocItems();
    reformatPubinfo();
    styleRelatedEntries();
    entryCopyright = extractEntryCopyright();
  } else if (!homeMode) {
    tocItems = collectContentsTocItems();
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
    entryCopyright,
  );
  if (renderError) {
    throw renderError;
  }

  if (articleMode) {
    stopFootnotes = initFootnotes();
  }

  await fontsReadyPromise;
  await waitForNextFrame();
  if (renderError) {
    throw renderError;
  }
  booted = true;
}

const isHtmlDocument = document.contentType === 'text/html';
if (isHtmlDocument) {
  // Ensure a prior ready state (e.g. bfcache) cannot skip the boot hide.
  document.documentElement.classList.remove(READY_CLASS);
}

const cachedTheme = isHtmlDocument ? readCachedTheme() : null;
if (cachedTheme) {
  applyTheme(cachedTheme);
}

if (isHtmlDocument) {
  injectLocalFonts();
}
const fontsReadyPromise = isHtmlDocument
  ? preloadLocalFonts()
  : Promise.resolve();
const themePromise: Promise<ThemePreference> = isHtmlDocument
  ? getTheme().then(
      (theme) => {
        applyTheme(theme);
        return theme;
      },
      (error: unknown) => {
        console.warn('SEP+ could not load the saved theme.', error);
        const fallback = cachedTheme ?? 'auto';
        applyTheme(fallback);
        return fallback;
      }
    )
  : Promise.resolve('light');

const highlightColorPromise: Promise<HighlightColor> = isHtmlDocument
  ? getHighlightColor().catch((error: unknown) => {
      console.warn('SEP+ could not load the saved highlight color.', error);
      return DEFAULT_HIGHLIGHT_COLOR;
    })
  : Promise.resolve(DEFAULT_HIGHLIGHT_COLOR);

// Only now does boot() own the reveal; until here, a throw leaves boot.css's
// failsafe in charge so the page can't stay hidden.
if (isHtmlDocument) {
  document.documentElement.classList.add(ALIVE_CLASS);
}
void boot({
  isHtmlDocument,
  waitForDomReady,
  hasSepLayout,
  mount,
  release,
  reveal: revealPage,
  rollback,
  parseTimeoutMs: PARSE_TIMEOUT_MS,
  mountTimeoutMs: MOUNT_TIMEOUT_MS,
});
