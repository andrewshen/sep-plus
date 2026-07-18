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

  const existing = document.getElementById('sep-plus-root');
  existing?.remove();

  const host = document.createElement('div');
  host.id = 'sep-plus-root';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = uiStyles;
  shadow.appendChild(style);

  const mount = document.createElement('div');
  mount.id = 'sep-plus-shadow-root';
  shadow.appendChild(mount);

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
