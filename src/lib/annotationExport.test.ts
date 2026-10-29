import { describe, expect, it } from 'vitest';
import {
  annotationExportFilename,
  escapeMarkdownText,
  serializeAnnotationsMarkdown,
  serializeAnnotationsWord,
} from './annotationExport';
import {
  ANNOTATION_SCHEMA_VERSION,
  type Annotation,
  type EntryAnnotations,
} from './annotations';

const SOURCE = 'https://plato.stanford.edu/entries/example/';
const EXPORTED_AT = new Date('2026-10-27T12:00:00.000Z');

function annotation(
  id: string,
  exact: string,
  start: number,
  extra: Partial<Pick<Annotation, 'note' | 'section'>> = {},
): Annotation {
  return {
    id,
    selector: {
      quote: { type: 'TextQuoteSelector', exact, prefix: '', suffix: '' },
      position: {
        type: 'TextPositionSelector',
        start,
        end: start + exact.length,
      },
    },
    note: '',
    createdAt: 100,
    updatedAt: Date.parse('2026-10-26T09:30:00.000Z'),
    ...extra,
  };
}

function entry(annotations: Annotation[]): EntryAnnotations {
  return {
    version: ANNOTATION_SCHEMA_VERSION,
    source: SOURCE,
    pageTitle: 'Example',
    annotations,
  };
}

describe('serializeAnnotationsWord', () => {
  it('lays out headings, sections, quotes, and notes in reading order', () => {
    const html = serializeAnnotationsWord(
      [
        entry([
          annotation('later', 'Second quote', 50, { section: '2. Later' }),
          annotation('first', 'First quote', 10, {
            section: '1. Intro',
            note: 'My note',
          }),
        ]),
      ],
      EXPORTED_AT,
    );

    const order = [
      '<h1>SEP+ Annotations</h1>',
      'Exported 2026-10-27T12:00:00.000Z',
      `<h2><a href="${SOURCE}">Example</a></h2>`,
      '<h3>1. Intro</h3>',
      '<blockquote>First quote</blockquote>',
      '<p>My note</p>',
      'Highlight · Updated 2026-10-26T09:30:00.000Z',
      '<h3>2. Later</h3>',
      '<blockquote>Second quote</blockquote>',
    ].map((fragment) => html.indexOf(fragment));

    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });

  it('escapes user text and keeps line breaks', () => {
    const html = serializeAnnotationsWord(
      [
        entry([
          annotation('one', 'a < b & "c"', 0, {
            note: 'line one\n<script>x</script>',
          }),
        ]),
      ],
      EXPORTED_AT,
    );

    expect(html).toContain('<blockquote>a &lt; b &amp; &quot;c&quot;</blockquote>');
    expect(html).toContain('<p>line one<br>&lt;script&gt;x&lt;/script&gt;</p>');
    expect(html).not.toContain('<script>');
  });

  it('starts with a BOM and declares the Word namespaces', () => {
    const html = serializeAnnotationsWord([entry([])], EXPORTED_AT);

    expect(html.startsWith('\ufeff<html')).toBe(true);
    expect(html).toContain('xmlns:w="urn:schemas-microsoft-com:office:word"');
    expect(html).toContain('<meta charset="utf-8">');
  });
});

describe('serializeAnnotationsMarkdown', () => {
  it('writes notes and quotes literally instead of as Markdown or HTML', () => {
    const markdown = serializeAnnotationsMarkdown(
      [
        entry([
          annotation('one', 'If *p* then [q] <b>', 0, {
            section: '2. *Modal* logic',
            note: 'First line\n## Not a heading\n- not a list\n1. not ordered\n<img src=x onerror=alert(1)>\n&copy; stays',
          }),
        ]),
      ],
      EXPORTED_AT,
    );

    expect(markdown).toContain('### 2. \\*Modal\\* logic');
    expect(markdown).toContain('> If \\*p\\* then \\[q\\] \\<b>');
    expect(markdown).toContain('\\## Not a heading');
    expect(markdown).toContain('\\- not a list');
    expect(markdown).toContain('1\\. not ordered');
    expect(markdown).toContain('\\<img src=x onerror=alert(1)>');
    expect(markdown).toContain('\\&copy; stays');
    expect(markdown).not.toMatch(/^## Not a heading/m);
  });

  it('links each entry title to its source', () => {
    const markdown = serializeAnnotationsMarkdown([entry([])], EXPORTED_AT);
    expect(markdown).toContain(`## [Example](<${SOURCE}>)`);
  });
});

describe('escapeMarkdownText', () => {
  it('leaves ordinary prose alone', () => {
    expect(escapeMarkdownText('Kant’s view, in 1781, was this: 2 + 2 = 4.')).toBe(
      'Kant’s view, in 1781, was this: 2 + 2 = 4.',
    );
  });
});

describe('annotationExportFilename', () => {
  it('names Word exports with a .doc extension', () => {
    expect(annotationExportFilename('doc', EXPORTED_AT)).toBe(
      'sep-plus-annotations-2026-10-27.doc',
    );
  });
});
