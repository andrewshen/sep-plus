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

function storageError(source: string): Error {
  return new Error(`Stored annotations for ${source} are invalid or unsupported.`);
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
    throw storageError(source);
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

export async function getEntryAnnotations(
  source: string,
): Promise<EntryAnnotations | null> {
  const normalized = normalizedSource(source);
  const key = annotationStorageKey(normalized);
  const stored = await chrome.storage.local.get(key);
  return parseStoredEntry(stored[key], normalized);
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

export async function upsertAnnotation(
  source: string,
  pageTitle: string,
  annotation: Annotation,
): Promise<EntryAnnotations> {
  const normalized = normalizedSource(source);
  const current =
    (await getEntryAnnotations(normalized)) ??
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
}

export async function removeAnnotation(
  source: string,
  annotationId: string,
): Promise<EntryAnnotations | null> {
  const normalized = normalizedSource(source);
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
    await chrome.storage.local.remove(annotationStorageKey(normalized));
    return null;
  }
  const next: EntryAnnotations = {
    ...current,
    annotations,
  };
  await setEntryAnnotations(next);
  return next;
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
        error instanceof Error ? error : storageError(normalized),
      );
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function getAllEntryAnnotations(): Promise<EntryAnnotations[]> {
  const stored = await chrome.storage.local.get(null);
  const entries: EntryAnnotations[] = [];

  for (const [key, value] of Object.entries(stored)) {
    if (!key.startsWith(ANNOTATION_STORAGE_PREFIX)) {
      continue;
    }
    if (!isEntryAnnotations(value) || annotationStorageKey(value.source) !== key) {
      throw new Error(`Stored annotation record ${key} is invalid or unsupported.`);
    }
    entries.push(sanitizeEntry(value));
  }

  return entries.sort((left, right) => left.source.localeCompare(right.source));
}
