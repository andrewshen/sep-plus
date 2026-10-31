import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  annotationExportFilename,
  buildAnnotationExport,
  serializeAnnotationExport,
  serializeAnnotationsMarkdown,
} from './annotationExport';
import {
  getAllEntryAnnotations,
  getEntryAnnotations,
  importEntryAnnotations,
  onEntryAnnotationsChanged,
  removeAnnotation,
  UNREADABLE_ANNOTATIONS_PREFIX,
  updateAnnotationNote,
  upsertAnnotation,
} from './annotationStorage';
import {
  ANNOTATION_SCHEMA_VERSION,
  annotationStorageKey,
  createEntryAnnotations,
  isEntryAnnotations,
  mergeEntryAnnotations,
  normalizeEntryUrl,
  type Annotation,
  type EntryAnnotations,
} from './annotations';

const SOURCE = 'https://plato.stanford.edu/entries/example/';

function annotation(
  id: string,
  exact = 'Example text',
  start = 0,
): Annotation {
  return {
    id,
    selector: {
      quote: {
        type: 'TextQuoteSelector',
        exact,
        prefix: '',
        suffix: '',
      },
      position: {
        type: 'TextPositionSelector',
        start,
        end: start + exact.length,
      },
    },
    note: '',
    createdAt: 100,
    updatedAt: 100,
  };
}

function entry(
  source = SOURCE,
  annotations: Annotation[] = [annotation('one')],
): EntryAnnotations {
  return {
    version: ANNOTATION_SCHEMA_VERSION,
    source,
    pageTitle: 'Example',
    annotations,
  };
}

type StorageChangeListener = Parameters<
  typeof chrome.storage.onChanged.addListener
>[0];

let stored: Record<string, unknown>;
let storageChangeListener: StorageChangeListener | null;

beforeEach(() => {
  stored = {};
  storageChangeListener = null;
  const local = {
    get: vi.fn(async (keys: unknown) => {
      if (keys === null) {
        return { ...stored };
      }
      if (typeof keys === 'string') {
        return keys in stored ? { [keys]: stored[keys] } : {};
      }
      return {};
    }),
    set: vi.fn(async (values: Record<string, unknown>) => {
      Object.assign(stored, values);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete stored[key];
      }
    }),
  };
  vi.stubGlobal('chrome', {
    runtime: {
      getManifest: () => ({ version: '2.0.0' }),
    },
    storage: {
      local,
      onChanged: {
        addListener: vi.fn((listener: StorageChangeListener) => {
          storageChangeListener = listener;
        }),
        removeListener: vi.fn((listener: StorageChangeListener) => {
          if (storageChangeListener === listener) {
            storageChangeListener = null;
          }
        }),
      },
    },
  } as unknown as typeof chrome);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('annotation data model', () => {
  it('normalizes live and archived entry URLs without merging revisions', () => {
    expect(
      normalizeEntryUrl(
        'http://plato.stanford.edu/entries/rawls/index.html?x=1#History',
      ),
    ).toBe('https://plato.stanford.edu/entries/rawls/');
    expect(
      normalizeEntryUrl(
        'https://plato.stanford.edu/archives/spr2025/entries/rawls/#History',
      ),
    ).toBe(
      'https://plato.stanford.edu/archives/spr2025/entries/rawls/',
    );
  });

  it('rejects non-entry, notes, and non-SEP URLs', () => {
    expect(
      normalizeEntryUrl('https://plato.stanford.edu/entries/rawls/notes.html'),
    ).toBeNull();
    expect(
      normalizeEntryUrl('https://plato.stanford.edu/about.html'),
    ).toBeNull();
    expect(
      normalizeEntryUrl('https://example.com/entries/rawls/'),
    ).toBeNull();
  });

  it('validates selectors, timestamps, and unique IDs', () => {
    expect(isEntryAnnotations(entry())).toBe(true);
    expect(
      isEntryAnnotations({
        ...entry(),
        annotations: [annotation('duplicate'), annotation('duplicate')],
      }),
    ).toBe(false);
    expect(
      isEntryAnnotations({
        ...entry(),
        annotations: [
          {
            ...annotation('bad-position'),
            selector: {
              ...annotation('bad-position').selector,
              position: {
                type: 'TextPositionSelector',
                start: 0,
                end: 2,
              },
            },
          },
        ],
      }),
    ).toBe(false);
  });
});

describe('annotation storage', () => {
  it('upserts, sorts, reads, and removes page-scoped annotations', async () => {
    await upsertAnnotation(SOURCE, 'Example', annotation('later', 'Later', 20));
    await upsertAnnotation(SOURCE, 'Example', annotation('first', 'First', 2));

    const loaded = await getEntryAnnotations(SOURCE);
    expect(loaded?.annotations.map((item) => item.id)).toEqual([
      'first',
      'later',
    ]);

    await removeAnnotation(SOURCE, 'first');
    expect((await getEntryAnnotations(SOURCE))?.annotations).toHaveLength(1);
    await removeAnnotation(SOURCE, 'later');
    expect(await getEntryAnnotations(SOURCE)).toBeNull();
    expect(stored[annotationStorageKey(SOURCE)]).toBeUndefined();
  });

  it('filters unrelated storage records when exporting all entries', async () => {
    stored.entryIndex = { fetchedAt: 1, entries: [] };
    stored[annotationStorageKey(SOURCE)] = entry();
    expect(await getAllEntryAnnotations()).toEqual({
      entries: [entry()],
      skipped: [],
    });
  });

  it('skips unreadable records when exporting all entries', async () => {
    const other = 'https://plato.stanford.edu/entries/other/';
    stored[annotationStorageKey(SOURCE)] = entry();
    stored[annotationStorageKey(other)] = { version: 99, source: other };
    expect(await getAllEntryAnnotations()).toEqual({
      entries: [entry()],
      skipped: [annotationStorageKey(other)],
    });
  });

  it('reports malformed stored records without overwriting them', async () => {
    const key = annotationStorageKey(SOURCE);
    stored[key] = { version: 99, source: SOURCE };
    await expect(getEntryAnnotations(SOURCE)).rejects.toThrow(
      'invalid or unsupported',
    );
    expect(stored[key]).toEqual({ version: 99, source: SOURCE });
  });

  it('sets an unreadable record aside before saving a new one', async () => {
    const key = annotationStorageKey(SOURCE);
    const unreadable = { version: 99, source: SOURCE, future: true };
    stored[key] = unreadable;
    await upsertAnnotation(SOURCE, 'Example', annotation('fresh'));
    expect((await getEntryAnnotations(SOURCE))?.annotations.map((a) => a.id))
      .toEqual(['fresh']);
    const backups = Object.entries(stored).filter(([storedKey]) =>
      storedKey.startsWith(UNREADABLE_ANNOTATIONS_PREFIX),
    );
    expect(backups).toHaveLength(1);
    expect(backups[0]?.[1]).toEqual(unreadable);
  });

  it('serializes concurrent writes to the same entry', async () => {
    await Promise.all([
      upsertAnnotation(SOURCE, 'Example', annotation('a', 'Alpha', 0)),
      upsertAnnotation(SOURCE, 'Example', annotation('b', 'Beta', 10)),
      upsertAnnotation(SOURCE, 'Example', annotation('c', 'Gamma', 20)),
    ]);
    expect(
      (await getEntryAnnotations(SOURCE))?.annotations.map((item) => item.id),
    ).toEqual(['a', 'b', 'c']);
  });

  it('keeps writing after a failed write in the queue', async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('boom'));
    const results = await Promise.allSettled([
      upsertAnnotation(SOURCE, 'Example', annotation('a')),
      upsertAnnotation(SOURCE, 'Example', annotation('b', 'Beta', 10)),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'rejected',
      'fulfilled',
    ]);
  });

  it('updates notes in place', async () => {
    await upsertAnnotation(SOURCE, 'Example', annotation('one'));
    const next = await updateAnnotationNote(SOURCE, 'one', 'New note', 500);
    expect(next?.annotations[0]).toMatchObject({ note: 'New note', updatedAt: 500 });
  });

  it('saves a note even if the clock now reads before its creation', async () => {
    await upsertAnnotation(SOURCE, 'Example', annotation('one'));
    const next = await updateAnnotationNote(SOURCE, 'one', 'Skewed', 50);
    expect(next?.annotations[0]).toMatchObject({ note: 'Skewed', updatedAt: 100 });
  });

  it('never dates an edit before the previous one', async () => {
    await upsertAnnotation(SOURCE, 'Example', annotation('one'));
    await updateAnnotationNote(SOURCE, 'one', 'First edit', 500);
    const next = await updateAnnotationNote(SOURCE, 'one', 'Second edit', 300);
    expect(next?.annotations[0]).toMatchObject({ note: 'Second edit', updatedAt: 500 });
  });

  it('never resurrects an annotation deleted before its note saves', async () => {
    await upsertAnnotation(SOURCE, 'Example', annotation('one'));
    await upsertAnnotation(SOURCE, 'Example', annotation('two', 'Two', 20));
    const [, saved] = await Promise.all([
      removeAnnotation(SOURCE, 'one'),
      updateAnnotationNote(SOURCE, 'one', 'Late note'),
    ]);
    expect(saved).toBeNull();
    expect(
      (await getEntryAnnotations(SOURCE))?.annotations.map((item) => item.id),
    ).toEqual(['two']);
  });

  it('propagates storage write failures', async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(
      new Error('QUOTA_BYTES exceeded'),
    );
    await expect(
      upsertAnnotation(SOURCE, 'Example', annotation('quota')),
    ).rejects.toThrow('QUOTA_BYTES exceeded');
  });

  it('subscribes only to the current local entry record', () => {
    const listener = vi.fn();
    const stop = onEntryAnnotationsChanged(SOURCE, listener);
    const key = annotationStorageKey(SOURCE);
    storageChangeListener?.(
      { unrelated: { newValue: entry() } },
      'local',
    );
    storageChangeListener?.({ [key]: { newValue: entry() } }, 'sync');
    storageChangeListener?.({ [key]: { newValue: entry() } }, 'local');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(entry());
    stop();
    expect(storageChangeListener).toBeNull();
  });
});

describe('mergeEntryAnnotations', () => {
  function edited(id: string, note: string, updatedAt: number): Annotation {
    return { ...annotation(id), note, updatedAt };
  }

  it('adds new annotations without dropping stored ones', () => {
    const merged = mergeEntryAnnotations(
      entry(SOURCE, [annotation('kept', 'Kept', 0)]),
      entry(SOURCE, [annotation('new', 'New', 10)]),
    );
    expect(merged.entry.annotations.map((item) => item.id)).toEqual([
      'kept',
      'new',
    ]);
    expect(merged).toMatchObject({ added: 1, updated: 0 });
  });

  it('keeps the more recently edited copy of a shared id', () => {
    const newer = mergeEntryAnnotations(
      entry(SOURCE, [edited('one', 'stored', 200)]),
      entry(SOURCE, [edited('one', 'imported', 300)]),
    );
    expect(newer.entry.annotations[0]?.note).toBe('imported');
    expect(newer).toMatchObject({ added: 0, updated: 1 });

    const older = mergeEntryAnnotations(
      entry(SOURCE, [edited('one', 'stored', 300)]),
      entry(SOURCE, [edited('one', 'imported', 200)]),
    );
    expect(older.entry.annotations[0]?.note).toBe('stored');
    expect(older).toMatchObject({ added: 0, updated: 0 });
  });

  it('keeps the stored copy on a tie', () => {
    const merged = mergeEntryAnnotations(
      entry(SOURCE, [edited('one', 'stored', 200)]),
      entry(SOURCE, [edited('one', 'imported', 200)]),
    );
    expect(merged.entry.annotations[0]?.note).toBe('stored');
    expect(merged.updated).toBe(0);
  });

  it('creates the entry when nothing is stored yet', () => {
    const merged = mergeEntryAnnotations(null, entry());
    expect(merged.entry).toEqual(entry());
    expect(merged.added).toBe(1);
  });

  it('refuses to exceed the per-entry annotation cap', () => {
    const many = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) => annotation(`${prefix}${index}`));
    expect(() =>
      mergeEntryAnnotations(
        entry(SOURCE, many('stored-', 3_000)),
        entry(SOURCE, many('imported-', 3_000)),
      ),
    ).toThrow('more than 5,000 annotations');
  });
});

describe('importEntryAnnotations', () => {
  const OTHER = 'https://plato.stanford.edu/entries/other/';

  it('merges imported entries into storage', async () => {
    await upsertAnnotation(SOURCE, 'Example', annotation('stored', 'Stored', 0));
    const result = await importEntryAnnotations([
      entry(SOURCE, [annotation('imported', 'Imported', 10)]),
      entry(OTHER, [annotation('other')]),
    ]);
    expect(result).toEqual({ added: 2, updated: 0, entries: 2, failed: 0 });
    expect(
      (await getEntryAnnotations(SOURCE))?.annotations.map((item) => item.id),
    ).toEqual(['stored', 'imported']);
    expect((await getEntryAnnotations(OTHER))?.annotations).toHaveLength(1);
  });

  it('skips the write when nothing is new', async () => {
    stored[annotationStorageKey(SOURCE)] = entry();
    vi.mocked(chrome.storage.local.set).mockClear();
    const result = await importEntryAnnotations([entry()]);
    expect(result).toEqual({ added: 0, updated: 0, entries: 0, failed: 0 });
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('counts failed entries and keeps importing the rest', async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('boom'));
    const result = await importEntryAnnotations([entry(SOURCE), entry(OTHER)]);
    expect(result).toEqual({ added: 1, updated: 0, entries: 1, failed: 1 });
    expect(await getEntryAnnotations(OTHER)).not.toBeNull();
  });

  it('leaves an unreadable stored record in place for an empty imported entry', async () => {
    const key = annotationStorageKey(SOURCE);
    const unreadable = { version: 99, source: SOURCE };
    stored[key] = unreadable;
    const result = await importEntryAnnotations([entry(SOURCE, [])]);
    expect(result).toEqual({ added: 0, updated: 0, entries: 0, failed: 0 });
    expect(stored[key]).toEqual(unreadable);
  });

  it('counts a source listed twice in the file as one entry', async () => {
    const result = await importEntryAnnotations([
      entry(SOURCE, [annotation('a', 'Alpha', 0)]),
      entry(SOURCE, [annotation('b', 'Beta', 10)]),
    ]);
    expect(result).toEqual({ added: 2, updated: 0, entries: 1, failed: 0 });
  });

  it('counts an entry with a non-SEP source as failed', async () => {
    const result = await importEntryAnnotations([
      entry('https://example.com/entries/x/'),
      entry(OTHER),
    ]);
    expect(result).toEqual({ added: 1, updated: 0, entries: 1, failed: 1 });
  });

  it('throws when every entry fails', async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValue(
      new Error('QUOTA_BYTES exceeded'),
    );
    await expect(importEntryAnnotations([entry()])).rejects.toThrow(
      'QUOTA_BYTES exceeded',
    );
  });
});

describe('annotation export', () => {
  it('creates deterministic JSON and Markdown exports', () => {
    const exportedAt = new Date('2026-07-25T12:00:00.000Z');
    const second = createEntryAnnotations(
      'https://plato.stanford.edu/entries/zeta/',
      'Zeta',
    );
    second.annotations = [
      {
        ...annotation('zeta', 'A cited passage'),
        note: 'A useful note.',
        section: 'Discussion',
      },
    ];
    const payload = buildAnnotationExport(
      [second, entry()],
      exportedAt,
      '2.0.0',
    );
    expect(payload.entries.map((item) => item.source)).toEqual([
      SOURCE,
      'https://plato.stanford.edu/entries/zeta/',
    ]);
    expect(serializeAnnotationExport(payload)).toContain(
      '"format": "sep-plus-annotations"',
    );

    const markdown = serializeAnnotationsMarkdown([second], exportedAt);
    expect(markdown).toContain('## [Zeta]');
    expect(markdown).toContain('### Discussion');
    expect(markdown).toContain('> A cited passage');
    expect(markdown).toContain('A useful note.');
    expect(annotationExportFilename('json', exportedAt, 'all')).toBe(
      'sep-plus-annotations-2026-07-25.json',
    );
  });
});
