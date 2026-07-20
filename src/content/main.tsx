import { createRoot } from 'react-dom/client';
import {
  bootstrapHost,
  isArticlePage,
  reformatPubinfo,
  addFootnotes,
} from '../host/bootstrap';
import {
  collectTocItems,
  prepareArticleNav,
} from '../host/toc';
import { App } from './App';
import uiStyles from './styles.css?inline';
import '../host/styles.css';

function mountArticleShell(items: ReturnType<typeof collectTocItems>): void {
  document.body.classList.add('sep-plus-article');
  document.documentElement.classList.add('sep-plus-sidebar-open');
  document.body.classList.add('sep-plus-sidebar-open');

  const articleSidebar = document.querySelector<HTMLElement>('#article-sidebar');
  if (articleSidebar) {
    articleSidebar.style.display = 'none';
  }

  document.getElementById('sep-plus-root')?.remove();
  document.getElementById('sep-plus-edge-toggle')?.remove();
  document.getElementById('sep-plus-palette-layer')?.remove();

  const host = document.createElement('div');
  host.id = 'sep-plus-root';
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

  createRoot(mount).render(<App items={items} />);
}

async function main(): Promise<void> {
  const articleMode = isArticlePage();

  if (articleMode) {
    prepareArticleNav();
    const tocItems = collectTocItems();
    reformatPubinfo();
    addFootnotes();
    await bootstrapHost({ articleMode: true });
    if (tocItems.length || document.querySelector('#article')) {
      mountArticleShell(tocItems);
    }
    return;
  }

  await bootstrapHost({ articleMode: false });
}

void main();
