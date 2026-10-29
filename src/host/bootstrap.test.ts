/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"url":"https://plato.stanford.edu/entries/example/"}
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractEntryCopyright,
  reformatPubinfo,
  restyleSearchResults,
  styleRelatedEntries,
  wrapSiteContentColumn,
} from './bootstrap';
import { clearRollback, rollbackHost } from './rollback';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { getURL: (path: string) => `chrome-extension://id/${path}` },
  });
});

afterEach(() => {
  clearRollback();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const COPYRIGHT = `
  <div id="article-copyright">
    <p>Copyright &copy; 2024 by<br>
      <a href="https://example.edu/~rohlf">Michael Rohlf</a>
      &lt;<a href="mailto:rohlf@example.edu"><em>rohlf<abbr>@</abbr>example<abbr>.</abbr>edu</em></a>&gt;<br>
      Jane Doe
    </p>
  </div>
  <div id="article-banner">Support SEP</div>
  <div id="site-credits">Credits</div>`;

describe('restyleSearchResults', () => {
  it('moves the author under the title and puts it back on rollback', () => {
    document.body.innerHTML = `
      <div class="result_listing">
        <div class="result_title"><a class="l" href="/entries/kant/">Kant</a></div>
        <div class="result_snippet">Snippet</div>
        <div class="result_author">by Jane Doe</div>
        <div class="result_url">url</div>
      </div>`;
    const order = () =>
      Array.from(document.querySelector('.result_listing')!.children, (el) => el.className);
    restyleSearchResults();
    expect(order()).toEqual(['result_title', 'result_author', 'result_snippet', 'result_url']);

    rollbackHost();
    expect(order()).toEqual(['result_title', 'result_snippet', 'result_author', 'result_url']);
  });
});

describe('reformatPubinfo', () => {
  it('shows authors and the latest revision date, and can be rolled back', () => {
    document.body.innerHTML = `
      <div id="pubinfo"><em>First published Thu May 20, 2010; substantive revision Wed Jul 31, 2024</em></div>
      ${COPYRIGHT}`;
    reformatPubinfo();
    const pubinfo = document.getElementById('pubinfo')!;
    expect(pubinfo.textContent).toBe('Michael Rohlf · Jane Doe · Jul 31, 2024');
    expect(pubinfo.querySelector('a.sep-pubinfo-author')?.getAttribute('href')).toBe(
      'https://example.edu/~rohlf',
    );
    expect(pubinfo.querySelector('.sep-pubinfo-date')?.getAttribute('title')).toBe(
      'First published May 20, 2010',
    );

    rollbackHost();
    expect(pubinfo.textContent).toContain('First published Thu May 20, 2010');
  });

  it('leaves pubinfo alone when there is nothing to show', () => {
    document.body.innerHTML = '<div id="pubinfo"><em>Unparseable</em></div>';
    reformatPubinfo();
    expect(document.getElementById('pubinfo')?.textContent).toBe('Unparseable');
  });
});

describe('extractEntryCopyright', () => {
  it('returns a one-line copyright and detaches the end matter reversibly', () => {
    document.body.innerHTML = `<div id="article">${COPYRIGHT}</div>`;
    const line = extractEntryCopyright();
    expect(line?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Copyright © 2024 by Michael Rohlf (rohlf@example.edu) Jane Doe',
    );
    expect(line?.querySelector('em, abbr')).toBeNull();
    expect(line?.querySelectorAll('.sep-entry-author')).toHaveLength(2);
    expect(document.getElementById('article-copyright')).toBeNull();
    expect(document.getElementById('site-credits')).toBeNull();

    rollbackHost();
    expect(document.getElementById('article-copyright')).not.toBeNull();
    expect(document.getElementById('article-banner')).not.toBeNull();
    expect(document.getElementById('site-credits')).not.toBeNull();
  });
});

describe('wrapSiteContentColumn', () => {
  it('wraps #content in one column, pulling in the contents nav, reversibly', () => {
    document.body.innerHTML = `
      <div id="container">
        <div id="toc-wrapper"><div id="toc-nav">A B C</div></div>
        <div id="content"><h1>Contents</h1><p>Body</p></div>
      </div>`;
    wrapSiteContentColumn();
    const content = document.getElementById('content')!;
    const column = content.querySelector(':scope > .sep-plus-content-column');
    expect(column?.firstElementChild?.id).toBe('toc-wrapper');
    expect(content.children).toHaveLength(1);

    wrapSiteContentColumn();
    expect(content.querySelectorAll('.sep-plus-content-column')).toHaveLength(1);

    rollbackHost();
    expect(content.querySelector('.sep-plus-content-column')).toBeNull();
    expect(document.getElementById('toc-wrapper')?.parentElement?.id).toBe('container');
    expect(content.firstElementChild?.tagName).toBe('H1');
  });

  it('skips entry pages', () => {
    document.body.innerHTML = '<div id="content"><div id="article">Entry</div></div>';
    wrapSiteContentColumn();
    expect(document.querySelector('.sep-plus-content-column')).toBeNull();
  });
});

describe('styleRelatedEntries', () => {
  it('turns the link list into chips and restores the original paragraph', () => {
    document.body.innerHTML = `
      <div id="related-entries"><p>
        <a href="../kant-moral/">Kant, Immanuel: moral philosophy</a> |
        <a href="../hume/">Hume, David</a>
      </p></div>`;
    styleRelatedEntries();
    const section = document.getElementById('related-entries')!;
    expect(section.querySelector('.sep-plus-related-entries')?.children).toHaveLength(2);

    rollbackHost();
    expect(section.querySelector('.sep-plus-related-entries')).toBeNull();
    expect(section.querySelector('p')?.textContent).toContain('Kant, Immanuel: moral philosophy');
  });
});
