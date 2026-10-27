import { describe, expect, it } from 'vitest';
import { parseSearchSummary } from './bootstrap';

describe('parseSearchSummary', () => {
  it('turns the first page range into a results row', () => {
    expect(parseSearchSummary('1–10 of 1339 documents found', 'ethics')).toEqual({
      count: '1,339 results for “ethics”',
      page: 'Page 1 of 134',
    });
  });

  it('derives later pages from the hit range', () => {
    expect(parseSearchSummary('11-20 of 1339 documents found', 'ethics')).toEqual({
      count: '1,339 results for “ethics”',
      page: 'Page 2 of 134',
    });
  });

  it('uses the page size so a short last page stays in range', () => {
    expect(parseSearchSummary('1331–1339 of 1339 documents found', 'ethics', 10)).toEqual({
      count: '1,339 results for “ethics”',
      page: 'Page 134 of 134',
    });
  });
});
