/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { importSummary } from './useAnnotations';

function result(
  added: number,
  updated: number,
  entries: number,
  failed = 0,
) {
  return { added, updated, entries, failed };
}

describe('importSummary', () => {
  it('counts added and updated annotations together', () => {
    expect(importSummary(result(2, 1, 2), 0)).toEqual({
      text: 'Imported 3 annotations across 2 entries.',
      error: false,
    });
    expect(importSummary(result(1, 0, 1), 0).text).toBe(
      'Imported 1 annotation across 1 entry.',
    );
  });

  it('says so when everything is already saved', () => {
    expect(importSummary(result(0, 0, 0), 0)).toEqual({
      text: 'Everything in this file is already saved.',
      error: false,
    });
  });

  it('reports skipped and failed entries alongside what was imported', () => {
    expect(importSummary(result(4, 0, 1, 1), 1)).toEqual({
      text: 'Imported 4 annotations across 1 entry. 2 entries couldn’t be imported.',
      error: false,
    });
  });

  it('is an error when nothing was imported and some entries couldn’t be', () => {
    expect(importSummary(result(0, 0, 0, 1), 0)).toEqual({
      text: 'Nothing new was imported. 1 entry couldn’t be imported.',
      error: true,
    });
  });
});
