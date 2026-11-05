/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"url":"https://plato.stanford.edu/entries/example/"}
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Annotation } from '../lib/annotations';
import {
  buildTextProjection,
  createSelectionAnchor,
  getTextProjection,
  rangeViewportRect,
  resolveAnnotationRange,
} from './annotationAnchors';
import {
  AnnotationHighlightRenderer,
  type ResolvedAnnotationRange,
} from './annotationHighlights';
import { scrollWindowTo } from './scroll';

vi.mock('./scroll', () => ({ scrollWindowTo: vi.fn() }));

function setArticle(html: string): HTMLElement {
  document.body.innerHTML = `<main id="article-content">${html}</main>`;
  const root = document.getElementById('article-content');
  if (!root) {
    throw new Error('Test article did not mount.');
  }
  return root;
}

function textNode(selector: string, index = 0): Text {
  const element = document.querySelector(selector);
  const node = element?.childNodes[index];
  if (!node || node.nodeType !== Node.TEXT_NODE) {
    throw new Error(`No text node at ${selector} child ${index}.`);
  }
  return node as Text;
}

function asAnnotation(
  anchor: NonNullable<ReturnType<typeof createSelectionAnchor>>,
): Annotation {
  return {
    id: 'annotation',
    selector: anchor.selector,
    note: '',
    ...(anchor.section ? { section: anchor.section } : {}),
    createdAt: 1,
    updatedAt: 1,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('annotation text anchors', () => {
  it('anchors selections spanning nested inline markup', () => {
    const root = setArticle(
      '<h2>Section</h2><p>Alpha <em>selected</em> text.</p>',
    );
    const range = document.createRange();
    range.setStart(textNode('em'), 0);
    range.setEnd(textNode('p', 2), 5);

    const anchor = createSelectionAnchor(root, range);
    expect(anchor?.selector.quote.exact).toBe('selected text');
    expect(anchor?.section).toBe('Section');
    expect(anchor?.selector.position.end).toBe(
      (anchor?.selector.position.start ?? 0) + 'selected text'.length,
    );
  });

  it('restores by quote and context after preceding text changes', () => {
    let root = setArticle('<p>Alpha <em>selected</em> text.</p>');
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('em') as Element);
    const anchor = createSelectionAnchor(root, range);
    expect(anchor).not.toBeNull();
    const annotation = asAnnotation(
      anchor as NonNullable<typeof anchor>,
    );

    root = setArticle(
      '<p>A newly revised introduction.</p><p>Alpha <em>selected</em> text.</p>',
    );
    const resolved = resolveAnnotationRange(root, annotation);
    expect(resolved?.toString()).toBe('selected');
  });

  it('normalizes prose whitespace across markup revisions', () => {
    let root = setArticle('<p>Alpha selected   text here.</p>');
    const node = textNode('p');
    const range = document.createRange();
    range.setStart(node, 6);
    range.setEnd(node, 21);
    const anchor = createSelectionAnchor(root, range);
    expect(anchor?.selector.quote.exact).toBe('selected text');

    root = setArticle('<p>Intro.</p><p>Alpha selected <em>text</em> here.</p>');
    const resolved = resolveAnnotationRange(
      root,
      asAnnotation(anchor as NonNullable<typeof anchor>),
    );
    expect(resolved?.toString()).toBe('selected text');
  });

  it('uses quote context to distinguish repeated text', () => {
    let root = setArticle(
      '<p>First target follows one.</p><p>Second target follows two.</p>',
    );
    const secondParagraph = document.querySelectorAll('p')[1];
    const secondText = secondParagraph?.firstChild;
    if (!secondText) {
      throw new Error('Missing second paragraph text.');
    }
    const range = document.createRange();
    range.setStart(secondText, 7);
    range.setEnd(secondText, 13);
    const anchor = createSelectionAnchor(root, range);
    expect(anchor).not.toBeNull();
    const annotation = asAnnotation(
      anchor as NonNullable<typeof anchor>,
    );

    root = setArticle(
      '<p>Inserted text.</p><p>First target follows one.</p><p>Second target follows two.</p>',
    );
    const resolved = resolveAnnotationRange(root, annotation);
    expect(resolved?.startContainer.parentElement?.textContent).toBe(
      'Second target follows two.',
    );
  });

  it('excludes mutable footnote markers from the projected text', () => {
    const root = setArticle(
      '<p>Before<sup><a href="notes.html#1">[1]</a></sup><span hidden>hidden</span><span data-sep-plus-annotation-ui>generated</span> after</p>',
    );
    expect(buildTextProjection(root).text).toBe('Before after');
  });

  it('returns null for outside, collapsed, and deleted selections', () => {
    const root = setArticle('<p>Keep this text.</p>');
    const outside = document.createElement('p');
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    const outsideRange = document.createRange();
    outsideRange.selectNodeContents(outside);
    expect(createSelectionAnchor(root, outsideRange)).toBeNull();

    const collapsed = document.createRange();
    collapsed.setStart(textNode('#article-content p'), 0);
    collapsed.collapse(true);
    expect(createSelectionAnchor(root, collapsed)).toBeNull();

    const range = document.createRange();
    range.setStart(textNode('#article-content p'), 5);
    range.setEnd(textNode('#article-content p'), 9);
    const anchor = createSelectionAnchor(root, range);
    expect(anchor).not.toBeNull();
    root.textContent = 'The selected words are gone.';
    expect(
      resolveAnnotationRange(
        root,
        asAnnotation(anchor as NonNullable<typeof anchor>),
      ),
    ).toBeNull();
  });

  it('uses UTF-16 positions consistently for emoji', () => {
    const root = setArticle('<p>A 😀 thought.</p>');
    const node = textNode('p');
    const range = document.createRange();
    range.setStart(node, 2);
    range.setEnd(node, 4);
    const anchor = createSelectionAnchor(root, range);
    expect(anchor?.selector.quote.exact).toBe('😀');
    expect(
      (anchor?.selector.position.end ?? 0) -
        (anchor?.selector.position.start ?? 0),
    ).toBe(2);
  });

  it('anchors selections that end on a footnote marker', () => {
    const root = setArticle(
      '<p>The argument.<sup><a href="notes.html#1">[1]</a></sup> Next.</p>',
    );
    const range = document.createRange();
    range.setStart(textNode('p'), 4);
    range.setEnd(textNode('a'), 2);
    const anchor = createSelectionAnchor(root, range);
    expect(anchor?.selector.quote.exact).toBe('argument.');
  });

  it('ignores selections made only of excluded text', () => {
    const root = setArticle(
      '<p>The argument.<sup><a href="notes.html#1">[1]</a></sup> Next.</p>',
    );
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('sup') as Element);
    expect(createSelectionAnchor(root, range)).toBeNull();
  });

  it('treats <br> as whitespace', () => {
    const root = setArticle('<p>line one<br>line two</p>');
    expect(buildTextProjection(root).text).toBe('line one line two');
  });

  it('re-finds anchors saved before <br> counted as whitespace', () => {
    const root = setArticle('<p>Intro text. line one<br>line two ends.</p>');
    const legacy: Annotation = {
      id: 'legacy',
      selector: {
        quote: {
          type: 'TextQuoteSelector',
          exact: 'oneline',
          prefix: 'Intro text. line ',
          suffix: ' two ends.',
        },
        position: { type: 'TextPositionSelector', start: 17, end: 24 },
      },
      note: '',
      createdAt: 1,
      updatedAt: 1,
    };
    const resolved = resolveAnnotationRange(root, legacy);
    // Range text skips the <br>, but the range spans it.
    expect(resolved?.toString()).toBe('oneline');
    expect(resolved?.startContainer).toBe(textNode('p', 0));
    expect(resolved?.endContainer).toBe(textNode('p', 2));
  });

  it('does not trust the stored position when its context changed', () => {
    let root = setArticle(
      '<p>Early on, Kant argued for idealism.</p><p>Later, Kant argued again.</p>',
    );
    const first = textNode('p');
    const range = document.createRange();
    range.setStart(first, 10);
    range.setEnd(first, 14);
    const annotation = asAnnotation(
      createSelectionAnchor(root, range) as NonNullable<
        ReturnType<typeof createSelectionAnchor>
      >,
    );
    expect(annotation.selector.quote.exact).toBe('Kant');

    // A revision puts a different "Kant" at the old offsets.
    root = setArticle(
      '<p>Early, Kant… Early on, Kant argued for idealism.</p><p>Later, Kant argued again.</p>',
    );
    const resolved = resolveAnnotationRange(root, annotation);
    expect(resolved?.startOffset).toBe(23);
  });

  it('survives quote, dash, and whitespace revisions inside the quote', () => {
    let root = setArticle("<p>He said it's a 'test' - really, in full.</p>");
    const node = textNode('p');
    const range = document.createRange();
    range.setStart(node, 8);
    range.setEnd(node, 30);
    const annotation = asAnnotation(
      createSelectionAnchor(root, range) as NonNullable<
        ReturnType<typeof createSelectionAnchor>
      >,
    );

    root = setArticle('<p>He said it’s a ‘test’ — really, in full.</p>');
    expect(resolveAnnotationRange(root, annotation)?.toString()).toBe(
      'it’s a ‘test’ — really',
    );
  });

  it('brackets an edited quote between its unchanged context', () => {
    let root = setArticle(
      '<p>The opening context stays. The highlighted claim is here. The closing context stays.</p>',
    );
    const node = textNode('p');
    const range = document.createRange();
    range.setStart(node, 27);
    range.setEnd(node, 57);
    const annotation = asAnnotation(
      createSelectionAnchor(root, range) as NonNullable<
        ReturnType<typeof createSelectionAnchor>
      >,
    );
    expect(annotation.selector.quote.exact).toBe('The highlighted claim is here.');

    root = setArticle(
      '<p>The opening context stays. The highlighted claim is there. The closing context stays.</p>',
    );
    expect(resolveAnnotationRange(root, annotation)?.toString()).toBe(
      'The highlighted claim is there.',
    );
  });

  it('reuses the projection until the article text changes', async () => {
    const root = setArticle('<p>Stable text.</p>');
    const first = getTextProjection(root);
    expect(getTextProjection(root)).toBe(first);

    const overlay = document.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.textContent = 'overlay';
    root.appendChild(overlay);
    expect(getTextProjection(root)).toBe(first);

    root.querySelector('p')?.append(' More.');
    const next = getTextProjection(root);
    expect(next).not.toBe(first);
    expect(next.text).toBe('Stable text. More.');
  });

  it('anchors the selection toolbar to the first rendered line', () => {
    setArticle('<p>A selection that spans several rendered lines.</p>');
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('p') as Element);
    Object.defineProperty(range, 'getClientRects', {
      configurable: true,
      value: () => [
        new DOMRect(20, 40, 300, 24),
        new DOMRect(20, 64, 260, 24),
        new DOMRect(20, 88, 180, 24),
      ],
    });
    expect(rangeViewportRect(range)?.top).toBe(40);
  });
});

describe('annotation highlight renderer', () => {
  it('tracks ranges, hit-tests, and scrolls without touching the DOM', () => {
    const root = setArticle('<p>One two three.</p>');
    const node = textNode('p');
    const first = document.createRange();
    first.setStart(node, 0);
    first.setEnd(node, 3);
    const second = document.createRange();
    second.setStart(node, 4);
    second.setEnd(node, 7);
    Object.defineProperty(first, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 240 }),
    });
    Object.defineProperty(first, 'getClientRects', {
      configurable: true,
      value: () => [new DOMRect(0, 0, 30, 20)],
    });
    Object.defineProperty(second, 'getClientRects', {
      configurable: true,
      value: () => [new DOMRect(40, 0, 30, 20)],
    });
    const renderer = new AnnotationHighlightRenderer();
    const resolved: ResolvedAnnotationRange[] = [
      { id: 'one', range: first },
      { id: 'two', range: second },
    ];

    renderer.redraw(resolved);
    expect(renderer.getRange('one')).toBe(first);
    expect(renderer.annotationAtPoint(10, 10)).toBe('one');
    expect(renderer.annotationAtPoint(50, 10)).toBe('two');
    expect(renderer.annotationAtPoint(35, 10)).toBeNull();
    expect(renderer.scrollTo('one')).toBe(true);
    expect(scrollWindowTo).toHaveBeenCalledWith(144);

    renderer.redraw([{ id: 'two', range: second }]);
    expect(renderer.getRange('one')).toBeNull();
    expect(renderer.scrollTo('one')).toBe(false);

    renderer.clear();
    expect(renderer.getRange('two')).toBeNull();
    expect(root.textContent).toBe('One two three.');
  });
});
