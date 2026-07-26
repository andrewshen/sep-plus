export const ANNOTATION_SCHEMA_VERSION = 1 as const;
export const ANNOTATION_STORAGE_PREFIX = 'sepPlus:annotations:entry:';

export type TextQuoteSelector = {
  type: 'TextQuoteSelector';
  exact: string;
  prefix: string;
  suffix: string;
};

export type TextPositionSelector = {
  type: 'TextPositionSelector';
  start: number;
  end: number;
};

export type AnnotationSelector = {
  quote: TextQuoteSelector;
  position: TextPositionSelector;
};

export type Annotation = {
  id: string;
  selector: AnnotationSelector;
  note: string;
  section?: string;
  createdAt: number;
  updatedAt: number;
};

export type EntryAnnotations = {
  version: typeof ANNOTATION_SCHEMA_VERSION;
  source: string;
  pageTitle: string;
  annotations: Annotation[];
};

const MAX_ID_LENGTH = 128;
const MAX_PAGE_TITLE_LENGTH = 1_000;
const MAX_SECTION_LENGTH = 1_000;
const MAX_QUOTE_LENGTH = 100_000;
const MAX_CONTEXT_LENGTH = 256;
const MAX_NOTE_LENGTH = 100_000;
const MAX_ANNOTATIONS_PER_ENTRY = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedString(
  value: unknown,
  maximum: number,
  allowEmpty = true,
): value is string {
  return (
    typeof value === 'string' &&
    value.length <= maximum &&
    (allowEmpty || value.length > 0)
  );
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0;
}

function isTextQuoteSelector(value: unknown): value is TextQuoteSelector {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.type === 'TextQuoteSelector' &&
    isBoundedString(value.exact, MAX_QUOTE_LENGTH, false) &&
    isBoundedString(value.prefix, MAX_CONTEXT_LENGTH) &&
    isBoundedString(value.suffix, MAX_CONTEXT_LENGTH)
  );
}

function isTextPositionSelector(value: unknown): value is TextPositionSelector {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.type === 'TextPositionSelector' &&
    typeof value.start === 'number' &&
    typeof value.end === 'number' &&
    Number.isSafeInteger(value.start) &&
    Number.isSafeInteger(value.end) &&
    value.start >= 0 &&
    value.end > value.start
  );
}

function isAnnotationSelector(value: unknown): value is AnnotationSelector {
  if (!isRecord(value)) {
    return false;
  }
  if (
    !isTextQuoteSelector(value.quote) ||
    !isTextPositionSelector(value.position)
  ) {
    return false;
  }
  return (
    value.position.end - value.position.start === value.quote.exact.length
  );
}

export function isAnnotation(value: unknown): value is Annotation {
  if (!isRecord(value)) {
    return false;
  }
  const sectionValid =
    value.section === undefined ||
    isBoundedString(value.section, MAX_SECTION_LENGTH, false);
  return (
    isBoundedString(value.id, MAX_ID_LENGTH, false) &&
    isAnnotationSelector(value.selector) &&
    isBoundedString(value.note, MAX_NOTE_LENGTH) &&
    sectionValid &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    value.updatedAt >= value.createdAt
  );
}

export function isEntryAnnotations(value: unknown): value is EntryAnnotations {
  if (!isRecord(value)) {
    return false;
  }
  if (
    value.version !== ANNOTATION_SCHEMA_VERSION ||
    typeof value.source !== 'string' ||
    normalizeEntryUrl(value.source) !== value.source ||
    !isBoundedString(value.pageTitle, MAX_PAGE_TITLE_LENGTH) ||
    !Array.isArray(value.annotations) ||
    value.annotations.length > MAX_ANNOTATIONS_PER_ENTRY ||
    !value.annotations.every(isAnnotation)
  ) {
    return false;
  }
  return new Set(value.annotations.map((annotation) => annotation.id)).size ===
    value.annotations.length;
}

/**
 * Return a stable SEP entry URL. Query strings, fragments, and index.html are
 * ignored, while archive paths are retained so revisions do not share anchors.
 */
export function normalizeEntryUrl(
  input: string,
  base = 'https://plato.stanford.edu/',
): string | null {
  try {
    const url = new URL(input, base);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.hostname.toLowerCase() !== 'plato.stanford.edu'
    ) {
      return null;
    }

    const match = url.pathname.match(
      /^(\/archives\/[^/]+)?\/entries\/([^/]+)\/(?:index\.html)?$/i,
    );
    const archivePath = match?.[1];
    const slug = match?.[2];
    if (!slug) {
      return null;
    }

    return `https://plato.stanford.edu${archivePath ?? ''}/entries/${slug}/`;
  } catch {
    return null;
  }
}

export function annotationStorageKey(source: string): string {
  const normalized = normalizeEntryUrl(source);
  if (!normalized) {
    throw new Error('Annotations can only be stored for SEP entry URLs.');
  }
  return `${ANNOTATION_STORAGE_PREFIX}${encodeURIComponent(normalized)}`;
}

export function createEntryAnnotations(
  source: string,
  pageTitle: string,
): EntryAnnotations {
  const normalized = normalizeEntryUrl(source);
  if (!normalized) {
    throw new Error('Annotations can only be created for SEP entry URLs.');
  }
  return {
    version: ANNOTATION_SCHEMA_VERSION,
    source: normalized,
    pageTitle: pageTitle.slice(0, MAX_PAGE_TITLE_LENGTH),
    annotations: [],
  };
}

export function sortAnnotations(
  annotations: readonly Annotation[],
): Annotation[] {
  return [...annotations].sort(
    (left, right) =>
      left.selector.position.start - right.selector.position.start ||
      left.createdAt - right.createdAt ||
      left.id.localeCompare(right.id),
  );
}
