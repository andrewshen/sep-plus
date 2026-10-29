/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"url":"https://plato.stanford.edu/entries/example/"}
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectTocItems,
  getActiveTocIndex,
  prepareArticleNav,
  smoothScrollToHref,
} from './toc';
import { clearRollback, rollbackHost } from './rollback';

vi.mock('./scroll', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./scroll')>()),
  scrollWindowTo: vi.fn(),
}));

afterEach(() => {
  clearRollback();
  document.body.innerHTML = '';
  history.replaceState(null, '', '/entries/example/');
  vi.restoreAllMocks();
});

function setScroll(scrollY: number, innerHeight: number, scrollHeight: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
}

describe('collectTocItems', () => {
  it('keeps in-page sections only', () => {
    document.body.innerHTML = `
      <div id="toc"><ul>
        <li><a href="#Intro">1. Introduction</a></li>
        <li><a href="#Hist">1.1 History</a></li>
        <li><a href="supplement.html">Supplement</a></li>
        <li><a href="https://example.com/#x">Elsewhere</a></li>
        <li><a href="#Bib">Bibliography</a></li>
      </ul></div>`;
    expect(collectTocItems()).toEqual([
      { href: '#Intro', text: '1. Introduction', level: 1 },
      { href: '#Hist', text: '1.1 History', level: 2 },
    ]);
  });
});

describe('smoothScrollToHref', () => {
  it('finds encoded and quote-containing ids without throwing', () => {
    document.body.innerHTML =
      '<h2 id="Kant’s View">Kant’s view</h2><h2 id=\'a"b\'>Odd</h2><h2><a name="Named">Named</a></h2>';
    expect(smoothScrollToHref('#Kant%E2%80%99s%20View')).toBe(true);
    expect(smoothScrollToHref('#a"b')).toBe(true);
    expect(smoothScrollToHref('#Named')).toBe(true);
    expect(smoothScrollToHref('#missing')).toBe(false);
  });

  it('updates the address like a native anchor', () => {
    document.body.innerHTML = '<h2 id="Intro">Introduction</h2>';
    smoothScrollToHref('#Intro');
    expect(location.hash).toBe('#Intro');
  });

  it('does not stack history entries for repeat jumps to an encoded id', () => {
    document.body.innerHTML = '<h2 id="Kant’s View">Kant’s view</h2>';
    const push = vi.spyOn(history, 'pushState');
    smoothScrollToHref('#Kant’s View');
    smoothScrollToHref('#Kant’s View');
    smoothScrollToHref('#Kant%E2%80%99s%20View');
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the section heading when asked', () => {
    document.body.innerHTML = '<h2><a name="Intro">Introduction</a></h2>';
    smoothScrollToHref('#Intro', { focus: true });
    expect(document.activeElement?.tagName).toBe('H2');
  });
});

describe('getActiveTocIndex', () => {
  const items = [
    { href: '#a', text: 'A', level: 1 as const },
    { href: '#b', text: 'B', level: 1 as const },
    { href: '#c', text: 'C', level: 1 as const },
  ];

  function headingsAt(tops: number[]) {
    document.body.innerHTML = items
      .map((item) => `<h2 id="${item.href.slice(1)}">${item.text}</h2>`)
      .join('');
    document.querySelectorAll('h2').forEach((heading, index) => {
      heading.getBoundingClientRect = () =>
        ({ top: tops[index] ?? 0 }) as DOMRect;
    });
  }

  it('selects the last heading scrolled past the header', () => {
    headingsAt([-400, 50, 600]);
    setScroll(1000, 800, 5000);
    expect(getActiveTocIndex(items)).toBe(1);
  });

  it('selects the last section once the page bottoms out', () => {
    headingsAt([-400, 50, 600]);
    setScroll(4200, 800, 5000);
    expect(getActiveTocIndex(items)).toBe(2);
  });
});

describe('prepareArticleNav', () => {
  it('can be rolled back to the native nav', () => {
    document.body.innerHTML = `<ul id="article-nav">
      <li><a href="#toc">Entry Contents</a></li>
      <li><a href="#Bib">Bibliography</a></li>
      <li><a href="#Acad">Academic Tools</a></li>
      <li><a href="#Other">Other Resources</a></li>
    </ul>`;
    prepareArticleNav();
    expect(document.querySelectorAll('#article-nav li')).toHaveLength(1);
    rollbackHost();
    expect(
      Array.from(document.querySelectorAll('#article-nav a')).map((a) => a.textContent),
    ).toEqual(['Entry Contents', 'Bibliography', 'Academic Tools', 'Other Resources']);
  });
});
