import { describe, expect, it } from 'vitest';
import { parseSearchSummary, searchPagerItems } from './bootstrap';

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
});
