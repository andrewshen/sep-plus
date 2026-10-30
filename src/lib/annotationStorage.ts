import {
  ANNOTATION_STORAGE_PREFIX,
  annotationStorageKey,
  createEntryAnnotations,
  isEntryAnnotations,
  normalizeEntryUrl,
  sortAnnotations,
  type Annotation,
  type EntryAnnotations,
} from './annotations';

export type EntryAnnotationsChangeListener = (
  entry: EntryAnnotations | null,
  error?: Error,
) => void;

/** Unreadable records are moved here (never under the entry prefix) before a
 *  fresh record replaces them, so nothing a newer version wrote is lost. */
export const UNREADABLE_ANNOTATIONS_PREFIX = 'sepPlus:annotations:unreadable:';

export class UnreadableAnnotationsError extends Error {
  constructor(source: string) {
    super(`Stored annotations for ${source} are invalid or unsupported.`);
    this.name = 'UnreadableAnnotationsError';
  }
}

function withoutLegacyColor(annotation: Annotation): Annotation {
  const sanitized = { ...annotation } as Annotation & { color?: unknown };
  delete sanitized.color;
  return sanitized;
}

function sanitizeEntry(entry: EntryAnnotations): EntryAnnotations {
  return {
    ...entry,
    annotations: sortAnnotations(entry.annotations.map(withoutLegacyColor)),
  };
}

function parseStoredEntry(
  value: unknown,
  source: string,
): EntryAnnotations | null {
  if (value === undefined) {
    return null;
  }
  if (!isEntryAnnotations(value) || value.source !== source) {
    throw new UnreadableAnnotationsError(source);
  }
  return sanitizeEntry(value);
}

function normalizedSource(source: string): string {
  const normalized = normalizeEntryUrl(source);
  if (!normalized) {
    throw new Error('Annotations can only be accessed for SEP entry URLs.');
  }
  return normalized;
}

const writeQueues = new Map<string, Promise<unknown>>();

/** Run read-modify-write tasks for one storage key one at a time. */
function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  const settled = next.then(
    () => undefined,
    () => undefined,
  );
  writeQueues.set(key, settled);
  void settled.then(() => {
    if (writeQueues.get(key) === settled) {
      writeQueues.delete(key);
    }
  });
  return next;
}

export async function getEntryAnnotations(
  source: string,
): Promise<EntryAnnotations | null> {
  const normalized = normalizedSource(source);
  const key = annotationStorageKey(normalized);
  const stored = await chrome.storage.local.get(key);
  return parseStoredEntry(stored[key], normalized);
}

/** Like getEntryAnnotations, but sets an unreadable record aside so a new
 *  record can be written in its place. */
async function readEntryForWrite(
  normalized: string,
): Promise<EntryAnnotations | null> {
  const key = annotationStorageKey(normalized);
  const stored = await chrome.storage.local.get(key);
  try {
    return parseStoredEntry(stored[key], normalized);
  } catch (error: unknown) {
    if (!(error instanceof UnreadableAnnotationsError)) {
      throw error;
    }
    await chrome.storage.local.set({
      [`${UNREADABLE_ANNOTATIONS_PREFIX}${normalized}:${Date.now()}`]:
        stored[key],
    });
    await chrome.storage.local.remove(key);
    return null;
  }
}

export async function setEntryAnnotations(
  entry: EntryAnnotations,
): Promise<void> {
  if (!isEntryAnnotations(entry)) {
    throw new Error('Refusing to save invalid annotations.');
  }
  const sorted = sanitizeEntry(entry);
  await chrome.storage.local.set({
    [annotationStorageKey(sorted.source)]: sorted,
  });
}

export function upsertAnnotation(
  source: string,
  pageTitle: string,
  annotation: Annotation,
): Promise<EntryAnnotations> {
  const normalized = normalizedSource(source);
  return serialized(annotationStorageKey(normalized), async () => {
    const current =
      (await readEntryForWrite(normalized)) ??
      createEntryAnnotations(normalized, pageTitle);
    const annotations = current.annotations.filter(
      (candidate) => candidate.id !== annotation.id,
    );
    annotations.push(annotation);
    const next: EntryAnnotations = {
      ...current,
      pageTitle: pageTitle || current.pageTitle,
      annotations: sortAnnotations(annotations),
    };
    await setEntryAnnotations(next);
    return next;
  });
}

/**
 * Update an existing annotation's note. Returns null without writing if the
 * annotation no longer exists (e.g. deleted in another tab), so a late save
 * can never resurrect it.
 */
export function updateAnnotationNote(
  source: string,
  annotationId: string,
  note: string,
  updatedAt = Date.now(),
): Promise<EntryAnnotations | null> {
  const normalized = normalizedSource(source);
  return serialized(annotationStorageKey(normalized), async () => {
    const current = await getEntryAnnotations(normalized);
    const existing = current?.annotations.find(
      (annotation) => annotation.id === annotationId,
    );
    if (!current || !existing) {
      return null;
    }
    const next: EntryAnnotations = {
      ...current,
      annotations: current.annotations.map((annotation) =>
        annotation.id === annotationId
          ? // A clock set back mustn't date this edit before the last one (or
            // before creation, which validation rejects).
            { ...annotation, note, updatedAt: Math.max(updatedAt, existing.updatedAt) }
          : annotation,
      ),
    };
    await setEntryAnnotations(next);
    return next;
  });
}

export function removeAnnotation(
  source: string,
  annotationId: string,
): Promise<EntryAnnotations | null> {
  const normalized = normalizedSource(source);
  const key = annotationStorageKey(normalized);
  return serialized(key, async () => {
    const current = await getEntryAnnotations(normalized);
    if (!current) {
      return null;
    }
    const annotations = current.annotations.filter(
      (annotation) => annotation.id !== annotationId,
    );
    if (annotations.length === current.annotations.length) {
      return current;
    }
    if (annotations.length === 0) {
      await chrome.storage.local.remove(key);
      return null;
    }
    const next: EntryAnnotations = {
      ...current,
      annotations,
    };
    await setEntryAnnotations(next);
    return next;
  });
}

export function onEntryAnnotationsChanged(
  source: string,
  callback: EntryAnnotationsChangeListener,
): () => void {
  const normalized = normalizedSource(source);
  const key = annotationStorageKey(normalized);
  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
    changes,
    area,
  ) => {
    if (area !== 'local' || !changes[key]) {
      return;
    }
    try {
      callback(parseStoredEntry(changes[key].newValue, normalized));
    } catch (error: unknown) {
      callback(
        null,
        error instanceof Error ? error : new UnreadableAnnotationsError(normalized),
      );
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export type AllEntryAnnotations = {
  entries: EntryAnnotations[];
  /** Storage keys of records that couldn't be read and were left out. */
  skipped: string[];
};

export async function getAllEntryAnnotations(): Promise<AllEntryAnnotations> {
  const stored = await chrome.storage.local.get(null);
  const entries: EntryAnnotations[] = [];
  const skipped: string[] = [];

  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith(ANNOTATION_STORAGE_PREFIX)) {
      continue;
    }
    if (!isEntryAnnotations(value) || annotationStorageKey(value.source) !== key) {
      skipped.push(key);
      continue;
    }
    entries.push(sanitizeEntry(value));
  }

  return {
    entries: entries.sort((left, right) => left.source.localeCompare(right.source)),
    skipped,
  };
}
