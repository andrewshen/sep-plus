/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"url":"https://plato.stanford.edu/"}
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFootnoteSection,
  collectFootnoteReferences,
  initFootnotes as startFootnotes,
  parseFootnoteDocument,
  referenceLabel,
  stripMarkerDecoration,
  type FootnoteController,
  type FootnoteControllerOptions,
  type FootnotePreviewTarget,
  type ParsedFootnote,
} from './footnotes';

const controllers: FootnoteController[] = [];

function initFootnotes(options: FootnoteControllerOptions): FootnoteController {
  const controller = startFootnotes(options);
  controllers.push(controller);
  return controller;
}

function lastPreview(
  onPreviewChange: ReturnType<typeof vi.fn>
): FootnotePreviewTarget | null | undefined {
  return onPreviewChange.mock.calls.at(-1)?.[0];
}

const PAGE_URL = 'https://plato.stanford.edu/entries/example/index.html';
const NOTES_URL = 'https://plato.stanford.edu/entries/example/notes.html';

function setDocument(html: string): void {
  document.documentElement.innerHTML = `<head></head><body>${html}</body>`;
  window.history.replaceState({}, '', PAGE_URL);
}

function mapParsedNote(
  key: string,
  note: ParsedFootnote | undefined
): Map<string, ParsedFootnote> {
  if (!note) {
    throw new Error(`Missing parsed note for ${key}`);
  }
  return new Map([[key, note]]);
}

function mockMatchMedia(options: {
  hover?: boolean;
  reducedMotion?: boolean;
}): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => {
      const matches = query.includes('hover: hover')
        ? Boolean(options.hover)
        : query.includes('prefers-reduced-motion')
          ? Boolean(options.reducedMotion)
          : false;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      };
    },
  });
}

async function waitForFootnotes(): Promise<HTMLElement> {
  let section: HTMLElement | null = null;
  await vi.waitFor(() => {
    section = document.querySelector<HTMLElement>(
      '#footnotes[data-sep-plus-footnotes]'
    );
    expect(section).not.toBeNull();
  });
  if (!section) {
    throw new Error('Footnotes did not load');
  }
  return section;
}

beforeEach(() => {
  mockMatchMedia({});
});

afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.cleanup();
  }
  document.documentElement.innerHTML = '<head></head><body></body>';
  vi.restoreAllMocks();
});

describe('footnote discovery and parsing', () => {
  it('collects only same-origin notes references with fragments', () => {
    setDocument(`
      <main id="article-content">
        <p>
          Text
          <sup><a id="valid" href="notes.html#note-1">1</a></sup>
          <sup><a href="notes.html">missing fragment</a></sup>
          <sup><a href="https://example.com/notes.html#note-2">external</a></sup>
          <sup><a href="other.html#note-3">other page</a></sup>
        </p>
      </main>
    `);

    const references = collectFootnoteReferences(document, PAGE_URL);

    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({
      sourceUrl: NOTES_URL,
      fragment: 'note-1',
      key: `${NOTES_URL}#note-1`,
    });
    expect(references[0]?.link.id).toBe('valid');
  });

  it('maps container-based notes by fragment', () => {
    const parsed = parseFootnoteDocument(
      `
        <div id="aueditable">
          <h2>Notes</h2>
          <div id="note-1"><p>First note</p></div>
          <div id="note-2"><p>Second note</p></div>
        </div>
      `,
      NOTES_URL,
      new Set(['note-1', 'note-2'])
    );

    expect(parsed.get('note-1')?.blocks).toHaveLength(1);
    expect(parsed.get('note-1')?.blocks[0]?.textContent).toContain(
      'First note'
    );
    expect(parsed.get('note-2')?.blocks[0]?.textContent).toContain(
      'Second note'
    );
  });

  it('preserves multi-paragraph notes without absorbing introductory text', () => {
    const parsed = parseFootnoteDocument(
      `
        <div id="aueditable">
          <h2>Notes</h2>
          <p><strong>Advice to the reader</strong></p>
          <p><a id="note-1" href="index.html#ref-1">1.</a> First paragraph</p>
          <p>Continuation of note one</p>
          <p><a id="note-2" href="index.html#ref-2">2.</a> Second note</p>
        </div>
      `,
      NOTES_URL,
      new Set(['note-1', 'note-2'])
    );

    const first = parsed.get('note-1');
    expect(first?.blocks).toHaveLength(2);
    expect(first?.blocks.map((block) => block.textContent).join(' ')).toContain(
      'Continuation of note one'
    );
    expect(first?.blocks.map((block) => block.textContent).join(' ')).not.toContain(
      'Advice to the reader'
    );
  });
});

describe('reference labels', () => {
  it('strips brackets from inline citation markers', () => {
    setDocument(`
      <main id="article-content">
        <sup><a href="notes.html#note-1">[1]</a></sup>
        <sup><a href="notes.html#note-2">(2)</a></sup>
        <sup><a href="notes.html#note-3">3.</a></sup>
      </main>
    `);
    const references = collectFootnoteReferences(document, PAGE_URL);

    expect(referenceLabel(references[0]!)).toBe('1');
    expect(referenceLabel(references[1]!)).toBe('2');
    expect(referenceLabel(references[2]!)).toBe('3');
  });

  it('removes sibling bracket text nodes around the marker link', () => {
    setDocument(`
      <main id="article-content">
        <sup>[<a id="ref-1" href="notes.html#note-1">1</a>]</sup>
      </main>
    `);
    const link = document.querySelector<HTMLAnchorElement>('#ref-1');
    if (!link) {
      throw new Error('Missing link fixture');
    }
    const sup = link.parentElement;

    stripMarkerDecoration(link);

    expect(sup?.textContent).toBe('1');
    expect(Array.from(sup?.childNodes || []).map((node) => node.nodeType)).toEqual([
      Node.ELEMENT_NODE,
    ]);
  });
});

describe('footnote section construction', () => {
  it('sanitizes note markup and normalizes links and resources', () => {
    setDocument(`
      <main id="article-content">
        <sup><a id="ref-1" href="notes.html#note-1">[1]</a></sup>
      </main>
      <div id="bibliography"></div>
    `);
    const references = collectFootnoteReferences(document, PAGE_URL);
    const parsed = parseFootnoteDocument(
      `
        <div id="aueditable">
          <div id="note-1">
            <p>
              <a href="index.html#ref-1">1.</a>
              Note <a class="unsafe" href="javascript:alert(1)">bad</a>
              <a class="external" href="../other/#part">related</a>
              <img src="diagram.png" onload="alert(1)">
              <script>alert(1)</script>
            </p>
          </div>
        </div>
      `,
      NOTES_URL,
      new Set(['note-1'])
    );
    const reference = references[0];
    if (!reference) {
      throw new Error('Missing reference fixture');
    }

    const built = buildFootnoteSection(
      document,
      references,
      mapParsedNote(reference.key, parsed.get('note-1')),
      PAGE_URL
    );
    const note = built.notesByKey.get(reference.key);

    expect(note?.element.id).toMatch(/^sep-plus-note-1-note-1/);
    expect(note?.element.querySelector('script')).toBeNull();
    expect(
      note?.element.querySelector<HTMLAnchorElement>('a[href="#ref-1"]')
    ).not.toBeNull();
    expect(
      note?.element.querySelector<HTMLAnchorElement>('a.unsafe')?.hasAttribute(
        'href'
      )
    ).toBe(false);
    expect(
      note?.element.querySelector<HTMLAnchorElement>('a.external')?.href
    ).toBe('https://plato.stanford.edu/entries/other/#part');
    const image = note?.element.querySelector<HTMLImageElement>('img');
    expect(image?.src).toBe(
      'https://plato.stanford.edu/entries/example/diagram.png'
    );
    expect(image?.hasAttribute('onload')).toBe(false);
  });

  it('creates collision-safe IDs for notes from different documents', () => {
    setDocument(`
      <main id="article-content">
        <sup><a href="notes.html#note-1">1</a></sup>
        <sup><a href="../other/notes.html#note-1">2</a></sup>
      </main>
    `);
    const references = collectFootnoteReferences(document, PAGE_URL);
    const parsed = new Map<string, ParsedFootnote>();
    for (const reference of references) {
      const note = parseFootnoteDocument(
        '<div id="aueditable"><p><a id="note-1">1.</a> Note</p></div>',
        reference.sourceUrl,
        new Set(['note-1'])
      ).get('note-1');
      if (note) {
        parsed.set(reference.key, note);
      }
    }

    const built = buildFootnoteSection(
      document,
      references,
      parsed,
      PAGE_URL
    );
    const ids = Array.from(
      built.section.querySelectorAll<HTMLElement>('.sep-plus-footnote'),
      (element) => element.id
    );

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('controller lifecycle and interactions', () => {
  const notesHtml = `
    <div id="aueditable">
      <div id="note-1">
        <p><a href="index.html#ref-1">1.</a> Preview content</p>
      </div>
    </div>
  `;

  function articleFixture(bracketed = false): void {
    setDocument(`
      <article id="article">
        <div id="article-content">
          <p>Text <sup>${
            bracketed
              ? '[<a id="ref-1" href="notes.html#note-1">1</a>]'
              : '<a id="ref-1" href="notes.html#note-1">1</a>'
          }</sup></p>
        </div>
        <div id="bibliography"></div>
      </article>
    `);
  }

  it('loads once, rewrites references, and restores the page on cleanup', async () => {
    articleFixture(true);
    const fetcher: typeof fetch = async () =>
      new Response(notesHtml, { status: 200 });

    const controller = initFootnotes({
      document,
      window,
      fetch: fetcher,
    });
    const section = await waitForFootnotes();
    const link = document.querySelector<HTMLAnchorElement>('#ref-1');
    const sup = link?.parentElement;
    const localId = section.querySelector<HTMLElement>(
      '.sep-plus-footnote'
    )?.id;

    expect(localId).toBeTruthy();
    expect(link?.textContent).toBe('1');
    expect(sup?.textContent).toBe('1');
    expect(link?.getAttribute('href')).toBe(`#${localId}`);
    expect(link?.getAttribute('aria-details')).toBe(localId);

    controller.cleanup();

    expect(document.querySelector('#footnotes')).toBeNull();
    expect(link?.getAttribute('href')).toBe('notes.html#note-1');
    expect(link?.textContent).toBe('1');
    expect(sup?.textContent).toBe('[1]');
    expect(link?.hasAttribute('aria-details')).toBe(false);
  });

  it('reports keyboard focus previews as instant and closes with Escape', async () => {
    articleFixture();
    const onPreviewChange = vi.fn();
    initFootnotes({
      document,
      window,
      fetch: async () => new Response(notesHtml, { status: 200 }),
      onPreviewChange,
    });
    await waitForFootnotes();
    const link = document.querySelector<HTMLAnchorElement>('#ref-1');
    if (!link) {
      throw new Error('Missing preview fixture');
    }

    link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    const preview = lastPreview(onPreviewChange);
    expect(preview?.trigger).toBe(link);
    expect(preview?.motion).toBe('instant');
    const body = document.createElement('div');
    body.append(preview?.render() ?? '');
    expect(body.textContent?.trim()).toBe('Preview content');
    expect(body.querySelector('[id]')).toBeNull();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(lastPreview(onPreviewChange)).toBeNull();
  });

  it('opens pointer previews only when fine hover is available', async () => {
    mockMatchMedia({ hover: true });
    articleFixture();
    const onPreviewChange = vi.fn();
    initFootnotes({
      document,
      window,
      fetch: async () => new Response(notesHtml, { status: 200 }),
      onPreviewChange,
    });
    await waitForFootnotes();
    const link = document.querySelector<HTMLAnchorElement>('#ref-1');
    if (!link) {
      throw new Error('Missing pointer preview fixture');
    }

    link.dispatchEvent(
      new PointerEvent('pointerover', {
        bubbles: true,
        pointerType: 'mouse',
      })
    );

    expect(lastPreview(onPreviewChange)?.motion).toBe('pointer');
  });

  it('does not open a hover preview on coarse pointers', async () => {
    articleFixture();
    const onPreviewChange = vi.fn();
    initFootnotes({
      document,
      window,
      fetch: async () => new Response(notesHtml, { status: 200 }),
      onPreviewChange,
    });
    await waitForFootnotes();
    const link = document.querySelector<HTMLAnchorElement>('#ref-1');
    if (!link) {
      throw new Error('Missing coarse pointer fixture');
    }

    link.dispatchEvent(
      new PointerEvent('pointerover', {
        bubbles: true,
        pointerType: 'touch',
      })
    );

    expect(onPreviewChange).not.toHaveBeenCalled();
  });

  it('closes pointer previews shortly after the pointer leaves', async () => {
    mockMatchMedia({ hover: true });
    articleFixture();
    const onPreviewChange = vi.fn();
    initFootnotes({
      document,
      window,
      fetch: async () => new Response(notesHtml, { status: 200 }),
      onPreviewChange,
    });
    await waitForFootnotes();
    const link = document.querySelector<HTMLAnchorElement>('#ref-1');
    if (!link) {
      throw new Error('Missing pointer close fixture');
    }

    link.dispatchEvent(
      new PointerEvent('pointerover', {
        bubbles: true,
        pointerType: 'mouse',
      })
    );
    vi.useFakeTimers();
    link.dispatchEvent(
      new PointerEvent('pointerout', {
        bubbles: true,
        pointerType: 'mouse',
      })
    );
    vi.advanceTimersByTime(79);
    expect(lastPreview(onPreviewChange)).not.toBeNull();
    vi.advanceTimersByTime(1);

    expect(lastPreview(onPreviewChange)).toBeNull();
    vi.useRealTimers();
  });

  it('keeps the preview open while the pointer is inside it', async () => {
    mockMatchMedia({ hover: true });
    articleFixture();
    const onPreviewChange = vi.fn();
    const controller = initFootnotes({
      document,
      window,
      fetch: async () => new Response(notesHtml, { status: 200 }),
      onPreviewChange,
    });
    await waitForFootnotes();
    const link = document.querySelector<HTMLAnchorElement>('#ref-1');
    if (!link) {
      throw new Error('Missing preview hover fixture');
    }

    link.dispatchEvent(
      new PointerEvent('pointerover', {
        bubbles: true,
        pointerType: 'mouse',
      })
    );
    vi.useFakeTimers();
    link.dispatchEvent(
      new PointerEvent('pointerout', {
        bubbles: true,
        pointerType: 'mouse',
      })
    );
    controller.previewPointerEnter();
    vi.advanceTimersByTime(200);
    expect(lastPreview(onPreviewChange)).not.toBeNull();

    controller.previewPointerLeave();
    vi.advanceTimersByTime(80);
    expect(lastPreview(onPreviewChange)).toBeNull();
    vi.useRealTimers();
  });

  it('reinitializes without duplicating sections', async () => {
    articleFixture();
    let fetchCount = 0;
    const fetcher: typeof fetch = async () => {
      fetchCount += 1;
      return new Response(notesHtml, { status: 200 });
    };
    initFootnotes({
      document,
      window,
      fetch: fetcher,
    });
    await waitForFootnotes();

    initFootnotes({
      document,
      window,
      fetch: fetcher,
    });
    await waitForFootnotes();

    expect(
      document.querySelectorAll('#footnotes[data-sep-plus-footnotes]')
    ).toHaveLength(1);
    expect(fetchCount).toBe(2);
  });

  it('leaves remote links intact when loading fails', async () => {
    articleFixture();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    initFootnotes({
      document,
      window,
      fetch: async () => new Response('', { status: 503 }),
    });

    await vi.waitFor(() => expect(warn).toHaveBeenCalled());

    expect(document.querySelector('#footnotes')).toBeNull();
    expect(
      document
        .querySelector<HTMLAnchorElement>('#ref-1')
        ?.getAttribute('href')
    ).toBe('notes.html#note-1');
  });
});
