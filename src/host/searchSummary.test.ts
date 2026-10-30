/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"url":"https://plato.stanford.edu/search/searcher.py?query=kant"}
 */
import { describe, expect, it } from 'vitest';
import {
  parseSearchSummary,
  searchPageSize,
  searchPagerItems,
} from './bootstrap';

describe('parseSearchSummary', () => {
  it('turns the first page range into a results row', () => {
    expect(parseSearchSummary('1–10 of 1339 documents found', 'ethics')).toEqual({
      count: '1,339 results for “ethics”',
      page: 'Page 1 of 134',
      current: 1,
      totalPages: 134,
    });
  });

  it('derives later pages from the hit range', () => {
    expect(parseSearchSummary('11-20 of 1339 documents found', 'ethics')).toEqual({
      count: '1,339 results for “ethics”',
      page: 'Page 2 of 134',
      current: 2,
      totalPages: 134,
    });
  });

  it('uses the page size so a short last page stays in range', () => {
    expect(parseSearchSummary('1331–1339 of 1339 documents found', 'ethics', 10)).toEqual({
      count: '1,339 results for “ethics”',
      page: 'Page 134 of 134',
      current: 134,
      totalPages: 134,
    });
  });

  it('reads comma-formatted counts and larger page sizes', () => {
    expect(
      parseSearchSummary('1,001–1,050 of 12,345 documents found', 'mind', 50),
    ).toMatchObject({
      count: '12,345 results for “mind”',
      current: 21,
      totalPages: 247,
    });
  });

  it('uses the singular for a single result', () => {
    expect(parseSearchSummary('1–1 of 1 documents found', 'akrasia')).toMatchObject({
      count: '1 result for “akrasia”',
      page: 'Page 1 of 1',
    });
  });

  it('returns null for text it cannot read', () => {
    expect(parseSearchSummary('', 'x')).toBeNull();
    expect(parseSearchSummary('No documents found', 'x')).toBeNull();
    expect(parseSearchSummary('0–0 of 0 documents found', 'x')).toBeNull();
    expect(parseSearchSummary('1–10 of 20 documents found', 'x', 0)).toBeNull();
  });
});

describe('searchPageSize', () => {
  function withResults(href: string): Document {
    document.body.innerHTML = `<div class="result_listing"><div class="result_title"><a class="l" href="${href}">Kant</a></div></div>`;
    return document;
  }

  it('prefers the page size in the URL', () => {
    const doc = withResults('/search/r?entry=/entries/kant/&pagesize=10');
    expect(searchPageSize(doc, '?query=kant&pagesize=25')).toBe(25);
  });

  it('falls back to the size SEP puts on result links, then to 10', () => {
    expect(
      searchPageSize(withResults('/search/r?entry=/entries/kant/&pagesize=20'), '?query=kant'),
    ).toBe(20);
    document.body.innerHTML = '';
    expect(searchPageSize(document, '?query=kant&pagesize=abc')).toBe(10);
  });
});

describe('searchPagerItems', () => {
  it('shows the first window, an ellipsis, and the last page', () => {
    expect(searchPagerItems(1, 834)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 834]);
  });

  it('keeps a short window around a middle page', () => {
    expect(searchPagerItems(40, 134)).toEqual([
      1,
      'ellipsis',
      38,
      39,
      40,
      41,
      42,
      'ellipsis',
      134,
    ]);
  });

  it('lists every page when there are seven or fewer', () => {
    expect(searchPagerItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(searchPagerItems(1, 1)).toEqual([1]);
    expect(searchPagerItems(1, 0)).toEqual([]);
  });
});
