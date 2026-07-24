import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  applyTheme,
  bootstrapHost,
  injectLocalFonts,
  isArticlePage,
  preloadLocalFonts,
  reformatPubinfo,
  relocateArticleEndMatter,
  styleRelatedEntries,
  wrapSiteContentColumn,
} from '../host/bootstrap';
import { initFootnotes } from '../host/footnotes';
import { collectSiteNavSections } from '../host/siteNav';
import {
  collectTocItems,
  prepareArticleNav,
} from '../host/toc';
import {
  getTheme,
  readSidebarCollapsed,
} from '../lib/storage';
import type {
  SiteNavSection,
  ThemePreference,
  TocItem,
} from '../lib/types';
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

function mountShell(
  items: TocItem[],
  siteNav: SiteNavSection[] | undefined,
  initialCollapsed: boolean,
  initialTheme: ThemePreference
): void {
  const sidebarPhase = initialCollapsed ? 'closed' : 'open';
  document.documentElement.classList.add('sep-plus');
  document.body.classList.add('sep-plus');
  document.documentElement.dataset.sepPlusSidebarPhase = sidebarPhase;
  document.body.dataset.sepPlusSidebarPhase = sidebarPhase;

  const articleSidebar = document.querySelector<HTMLElement>('#article-sidebar');
  if (articleSidebar) {
    articleSidebar.style.display = 'none';
  }

  document.getElementById('sep-plus-root')?.remove();
  document.getElementById('sep-plus-edge-toggle')?.remove();
  document.getElementById('sep-plus-palette-layer')?.remove();

  const host = document.createElement('div');
  host.id = 'sep-plus-root';
  host.setAttribute('data-sep-plus-booting', '');
  document.documentElement.appendChild(host);

  const edgeToggle = document.createElement('div');
  edgeToggle.id = 'sep-plus-edge-toggle';
  document.documentElement.appendChild(edgeToggle);

  const paletteLayer = document.createElement('div');
  paletteLayer.id = 'sep-plus-palette-layer';
  document.documentElement.appendChild(paletteLayer);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = uiStyles;
  shadow.appendChild(style);

  const mount = document.createElement('div');
  mount.id = 'sep-plus-shadow-root';
  shadow.appendChild(mount);

  const paletteShadow = paletteLayer.attachShadow({ mode: 'open' });
  const paletteStyle = document.createElement('style');
  paletteStyle.textContent = uiStyles;
  paletteShadow.appendChild(paletteStyle);
  const paletteMount = document.createElement('div');
  paletteMount.id = 'sep-plus-palette-mount';
  paletteShadow.appendChild(paletteMount);

  const root = createRoot(mount);
  flushSync(() => {
    root.render(
      <App
        items={items}
        siteNav={siteNav}
        initialCollapsed={initialCollapsed}
        initialTheme={initialTheme}
      />
    );
  });
}

async function main(): Promise<void> {
  await waitForDomReady();
  if (bootTimedOut) {
    return;
  }

  const theme = await themePromise;
  if (bootTimedOut) {
    return;
  }

  const articleMode = isArticlePage();
  let tocItems: TocItem[] = [];
  let siteNav: SiteNavSection[] | undefined;

  if (articleMode) {
    prepareArticleNav();
    tocItems = collectTocItems();
    reformatPubinfo();
    styleRelatedEntries();
    relocateArticleEndMatter();
  } else {
    // Scrape footer nav before body.sep-plus hides #footer.
    siteNav = collectSiteNavSections();
    wrapSiteContentColumn();
  }

  bootstrapHost(theme);
  mountShell(tocItems, siteNav, readSidebarCollapsed(), theme);

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

bootTimeout = window.setTimeout(() => {
  bootTimedOut = true;
  revealPage();
}, BOOT_TIMEOUT_MS);

void main().catch((error: unknown) => {
  console.error('SEP+ failed to initialize.', error);
  revealPage();
});
