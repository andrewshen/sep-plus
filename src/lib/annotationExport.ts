import {
  ANNOTATION_SCHEMA_VERSION,
  sortAnnotations,
  type Annotation,
  type EntryAnnotations,
} from './annotations';

export const ANNOTATION_EXPORT_FORMAT = 'sep-plus-annotations' as const;

export type AnnotationExport = {
  format: typeof ANNOTATION_EXPORT_FORMAT;
  version: typeof ANNOTATION_SCHEMA_VERSION;
  exportedAt: string;
  extensionVersion: string;
  entries: EntryAnnotations[];
};

function sortedEntries(
  entries: readonly EntryAnnotations[],
): EntryAnnotations[] {
  return [...entries]
    .map((entry) => ({
      ...entry,
      annotations: sortAnnotations(entry.annotations),
    }))
    .sort((left, right) => left.source.localeCompare(right.source));
}

export function buildAnnotationExport(
  entries: readonly EntryAnnotations[],
  exportedAt = new Date(),
  extensionVersion = chrome.runtime.getManifest().version,
): AnnotationExport {
  return {
    format: ANNOTATION_EXPORT_FORMAT,
    version: ANNOTATION_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    extensionVersion,
    entries: sortedEntries(entries),
  };
}

export function serializeAnnotationExport(
  annotationExport: AnnotationExport,
): string {
  return `${JSON.stringify(annotationExport, null, 2)}\n`;
}

function escapeMarkdownLinkText(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
}

function quoteMarkdown(text: string): string {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n');
}

function annotationMarkdown(annotation: Annotation): string {
  const parts = [quoteMarkdown(annotation.selector.quote.exact)];
  if (annotation.note.trim()) {
    parts.push(annotation.note.trim());
  }
  const updated = new Date(annotation.updatedAt).toISOString();
  parts.push(`_Highlight · Updated ${updated}_`);
  return parts.join('\n\n');
}

export function serializeAnnotationsMarkdown(
  entries: readonly EntryAnnotations[],
  exportedAt = new Date(),
): string {
  const lines = [
    '# SEP+ Annotations',
    '',
    `Exported ${exportedAt.toISOString()}`,
  ];

  for (const entry of sortedEntries(entries)) {
    lines.push(
      '',
      `## [${escapeMarkdownLinkText(entry.pageTitle || entry.source)}](${entry.source})`,
    );
    let activeSection: string | undefined;
    for (const annotation of entry.annotations) {
      if (annotation.section && annotation.section !== activeSection) {
        activeSection = annotation.section;
        lines.push('', `### ${activeSection}`);
      }
      lines.push('', annotationMarkdown(annotation));
    }
  }

  return `${lines.join('\n')}\n`;
}

export function annotationExportFilename(
  format: 'json' | 'md',
  exportedAt = new Date(),
  scope: 'all' | 'entry' = 'all',
): string {
  const date = exportedAt.toISOString().slice(0, 10);
  const qualifier = scope === 'entry' ? '-entry' : '';
  return `sep-plus-annotations${qualifier}-${date}.${format}`;
}

export function downloadTextFile(
  contents: string,
  filename: string,
  type: string,
): void {
  const blob = new Blob([contents], { type });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
