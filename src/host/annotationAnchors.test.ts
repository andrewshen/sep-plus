/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"url":"https://plato.stanford.edu/entries/example/"}
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Annotation } from '../lib/annotations';
import {
  buildTextProjection,
  createSelectionAnchor,
  rangeViewportRect,
  resolveAnnotationRange,
} from './annotationAnchors';
import {
  AnnotationHighlightRenderer,
  type ResolvedAnnotationRange,
} from './annotationHighlights';

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
  it('renders, hit-tests, and leaves unrelated highlights alone', () => {
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
    const scrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    const values = new Map<string, Highlight>();
    values.set('unrelated-highlight', {} as Highlight);
    const registry = {
      set: vi.fn((name: string, value: Highlight) => {
        values.set(name, value);
      }),
      delete: vi.fn((name: string) => values.delete(name)),
    } as unknown as Pick<HighlightRegistry, 'delete' | 'set'>;
    const factory = vi.fn(
      (ranges: Range[]) => ({ ranges }) as unknown as Highlight,
    );
    const renderer = new AnnotationHighlightRenderer(registry, factory);
    const resolved: ResolvedAnnotationRange[] = [
      { id: 'one', range: first },
      { id: 'two', range: second },
    ];

    renderer.redraw(resolved);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(values.has('sep-plus-annotation')).toBe(true);
    expect(renderer.getRange('one')).toBe(first);
    expect(renderer.annotationAtPoint(10, 10)).toBe('one');
    expect(renderer.annotationAtPoint(35, 10)).toBeNull();
    renderer.setHovered('one');
    expect(values.has('sep-plus-annotation')).toBe(true);
    expect(values.has('sep-plus-annotation-hover')).toBe(true);
    expect(factory).toHaveBeenCalledTimes(3);
    renderer.setHovered(null);
    expect(values.has('sep-plus-annotation-hover')).toBe(false);
    renderer.setSelected('two');
    expect(values.has('sep-plus-annotation-hover')).toBe(true);
    renderer.setHovered(null);
    expect(values.has('sep-plus-annotation-hover')).toBe(true);
    renderer.setSelected(null);
    expect(values.has('sep-plus-annotation-hover')).toBe(false);
    expect(renderer.scrollTo('one')).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({
      top: 144,
      behavior: 'smooth',
    });

    renderer.clear();
    expect(values.has('unrelated-highlight')).toBe(true);
    expect(renderer.getRange('one')).toBeNull();
    expect(root.textContent).toBe('One two three.');
  });
});
