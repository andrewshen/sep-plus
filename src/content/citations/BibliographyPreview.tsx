import { useLayoutEffect, useRef } from 'react';
import {
  buildPhilPapersSearchUrl,
  type BibliographyEntry,
} from '../../host/bibliographyCitations';

type BibliographyPreviewProps = {
  entries: readonly BibliographyEntry[];
};

const UNSAFE_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'video',
  'audio',
  'canvas',
  'svg',
].join(',');

function sanitizeLink(link: HTMLAnchorElement): void {
  const rawHref = link.getAttribute('href');
  if (!rawHref) {
    return;
  }
  try {
    const url = new URL(rawHref, link.ownerDocument.baseURI);
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      link.removeAttribute('href');
      link.removeAttribute('target');
      link.removeAttribute('rel');
      return;
    }
    link.href = url.href;
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
    }
  } catch {
    link.removeAttribute('href');
    link.removeAttribute('target');
    link.removeAttribute('rel');
  }
}

function sanitizePreview(root: HTMLElement): void {
  for (const unsafe of Array.from(root.querySelectorAll(UNSAFE_SELECTOR))) {
    unsafe.remove();
  }
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  for (const element of elements) {
    for (const attribute of Array.from(element.attributes)) {
      if (
        /^on/i.test(attribute.name) ||
        attribute.name === 'style' ||
        attribute.name === 'srcdoc'
      ) {
        element.removeAttribute(attribute.name);
      }
    }
    element.removeAttribute('id');
    element.removeAttribute('name');
    element.removeAttribute('aria-details');
    element.removeAttribute('aria-describedby');
    element.removeAttribute('aria-labelledby');
    element.removeAttribute('tabindex');
    element.removeAttribute('contenteditable');
    if (element instanceof HTMLAnchorElement) {
      sanitizeLink(element);
    }
  }
}

function cloneChildren(source: Element, target: HTMLElement): void {
  target.append(...Array.from(source.childNodes, (node) => node.cloneNode(true)));
}

function createPreviewEntry(
  entry: BibliographyEntry,
  doc: Document,
): HTMLElement {
  const wrapper = doc.createElement('div');
  wrapper.className = 'sep-bibliography-preview-entry';

  if (entry.element.tagName === 'TR') {
    const cells = Array.from(
      entry.element.querySelectorAll<HTMLElement>(':scope > th, :scope > td'),
    );
    for (const [index, cell] of cells.entries()) {
      const part = doc.createElement('div');
      part.className =
        index === 0
          ? 'sep-bibliography-preview-entry-key'
          : 'sep-bibliography-preview-entry-content';
      cloneChildren(cell, part);
      wrapper.appendChild(part);
    }
  } else {
    cloneChildren(entry.element, wrapper);
  }

  sanitizePreview(wrapper);
  const searchLink = doc.createElement('a');
  searchLink.className = 'sep-bibliography-preview-search';
  searchLink.href = buildPhilPapersSearchUrl(entry);
  searchLink.target = '_blank';
  searchLink.rel = 'noreferrer noopener';
  searchLink.setAttribute(
    'aria-label',
    `Search PhilPapers for ${entry.title || `${entry.author} ${entry.year}`}`,
  );
  searchLink.append('Search PhilPapers');
  const arrow = doc.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  searchLink.appendChild(arrow);
  wrapper.appendChild(searchLink);
  return wrapper;
}

export function BibliographyPreview({
  entries,
}: BibliographyPreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const doc = root.ownerDocument;
    const nodes = entries.map((entry) => createPreviewEntry(entry, doc));
    root.replaceChildren(...nodes);
    return () => root.replaceChildren();
  }, [entries]);

  return (
    <div
      ref={rootRef}
      className="sep-bibliography-preview"
      data-sep-plus-bibliography-preview=""
    />
  );
}
