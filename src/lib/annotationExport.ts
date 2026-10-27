import {
  ANNOTATION_SCHEMA_VERSION,
  sortAnnotations,
  type Annotation,
  type EntryAnnotations,
} from './annotations';
import type { AnnotationExportFormat } from './types';

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

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Escaped, with line breaks kept as `<br>`. */
function htmlLines(text: string): string {
  return text.trim().split(/\r?\n/).map(escapeHtml).join('<br>');
}

const WORD_STYLES = `
body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #21201c; }
h1, h2, h3 { font-family: Helvetica, Arial, sans-serif; color: #21201c; }
h1 { font-size: 20pt; margin: 0 0 4pt; }
h2 { font-size: 15pt; margin: 24pt 0 8pt; }
h3 { font-size: 12pt; margin: 16pt 0 6pt; }
a { color: #21201c; }
blockquote { margin: 12pt 0 6pt; padding-left: 10pt; border-left: 2pt solid #dad9d6; }
.meta { color: #82827c; font-size: 9pt; font-style: italic; margin: 0 0 12pt; }
`.trim();

function annotationWord(annotation: Annotation): string {
  const parts = [`<blockquote>${htmlLines(annotation.selector.quote.exact)}</blockquote>`];
  if (annotation.note.trim()) {
    parts.push(`<p>${htmlLines(annotation.note)}</p>`);
  }
  const updated = new Date(annotation.updatedAt).toISOString();
  parts.push(`<p class="meta">Highlight · Updated ${updated}</p>`);
  return parts.join('\n');
}

/**
 * HTML that Word, Pages and Google Docs open as a document when saved as
 * `.doc` (`application/msword`). Same structure as the Markdown export.
 */
export function serializeAnnotationsWord(
  entries: readonly EntryAnnotations[],
  exportedAt = new Date(),
): string {
  const body = [
    '<h1>SEP+ Annotations</h1>',
    `<p class="meta">Exported ${exportedAt.toISOString()}</p>`,
  ];

  for (const entry of sortedEntries(entries)) {
    body.push(
      `<h2><a href="${escapeHtml(entry.source)}">${escapeHtml(entry.pageTitle || entry.source)}</a></h2>`,
    );
    let activeSection: string | undefined;
    for (const annotation of entry.annotations) {
      if (annotation.section && annotation.section !== activeSection) {
        activeSection = annotation.section;
        body.push(`<h3>${escapeHtml(activeSection)}</h3>`);
      }
      body.push(annotationWord(annotation));
    }
  }

  // The BOM keeps Word from guessing a legacy encoding for accented text.
  return [
    '\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">',
    '<head>',
    '<meta charset="utf-8">',
    '<title>SEP+ Annotations</title>',
    `<style>\n${WORD_STYLES}\n</style>`,
    '</head>',
    '<body>',
    ...body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

export function annotationExportFilename(
  format: AnnotationExportFormat,
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
