/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"url":"https://plato.stanford.edu/"}
 */
import { describe, expect, it } from 'vitest';
import { formatRecentDate, parseNewHtml, splitAuthors } from './recentEntries';

const SAMPLE = `
<h1>What's New</h1>
<ul>
  <li> <a href="entries/ibn-bajja/"><strong>Ibn Bâjja [Avempace]</strong></a> (Josep Puig Montada) [REVISED: <em>October 26, 2026</em>]<div class="small">Changes to: Main text</div></li>
  <li> <a href="entries/academic-freedom/"><strong>Academic Freedom</strong></a> (Jacob T. Levy) [NEW: <em>October 17, 2026</em>]</li>
  <li> <a href="entries/metaphysical-explanation/"><strong>Metaphysical Explanation</strong></a> (Andrew Brenner, Anna-Sofia Maurin, and Naomi Thompson) [REVISED: <em>October 5, 2026</em>]</li>
  <li><a href="contents.html">Not an entry</a></li>
</ul>`;

describe('parseNewHtml', () => {
  it('reads title, link, authors, date, and status for each entry', () => {
    const entries = parseNewHtml(SAMPLE, 'https://plato.stanford.edu/');
    expect(entries).toEqual([
      {
        title: 'Ibn Bâjja [Avempace]',
        href: 'https://plato.stanford.edu/entries/ibn-bajja/',
        authors: ['Josep Puig Montada'],
        date: 'October 26, 2026',
        status: 'revised',
      },
      {
        title: 'Academic Freedom',
        href: 'https://plato.stanford.edu/entries/academic-freedom/',
        authors: ['Jacob T. Levy'],
        date: 'October 17, 2026',
        status: 'new',
      },
      {
        title: 'Metaphysical Explanation',
        href: 'https://plato.stanford.edu/entries/metaphysical-explanation/',
        authors: ['Andrew Brenner', 'Anna-Sofia Maurin', 'Naomi Thompson'],
        date: 'October 5, 2026',
        status: 'revised',
      },
    ]);
  });
});

describe('parseNewHtml link safety', () => {
  it('skips malformed, off-site, and non-http links without aborting', () => {
    const html = `<ul>
      <li><a href="http://[bad/entries/x/">Broken</a> (A) [NEW: <em>May 1, 2026</em>]</li>
      <li><a href="javascript:alert(1)//entries/x/">Script</a> (B) [NEW: <em>May 1, 2026</em>]</li>
      <li><a href="https://evil.example/entries/x/">Elsewhere</a> (C) [NEW: <em>May 1, 2026</em>]</li>
      <li><a href="entries/kant/index.html#top">Kant</a> (D) [REVISED: <em>May 1, 2026</em>]</li>
    </ul>`;
    expect(
      parseNewHtml(html, 'https://plato.stanford.edu/').map((entry) => entry.href),
    ).toEqual(['https://plato.stanford.edu/entries/kant/']);
  });
});

describe('splitAuthors', () => {
  it('splits comma and "and" separated names', () => {
    expect(splitAuthors('A. One and B. Two')).toEqual(['A. One', 'B. Two']);
    expect(splitAuthors('A, B, and C')).toEqual(['A', 'B', 'C']);
  });
});

describe('formatRecentDate', () => {
  it('drops the year', () => {
    expect(formatRecentDate('October 8, 2026')).toBe('October 8');
  });
});
