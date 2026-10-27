import { useLayoutEffect, useRef } from 'react';
import {
  buildPhilPapersSearchUrl,
  type BibliographyEntry,
} from '../../host/bibliographyCitations';
import { IconArrowUpRight } from '../icons';

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

/** Fill `target` with a sanitized copy of the entry's bibliography markup. */
function fillPreviewContent(target: HTMLElement, entry: BibliographyEntry): void {
  const doc = target.ownerDocument;
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
      target.appendChild(part);
    }
  } else {
    cloneChildren(entry.element, target);
  }
  sanitizePreview(target);
}

function PreviewEntry({ entry }: { entry: BibliographyEntry }) {
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }
    fillPreviewContent(content, entry);
    return () => content.replaceChildren();
  }, [entry]);

  return (
    <div className="sep-bibliography-preview-entry">
      <div ref={contentRef} className="sep-bibliography-preview-entry-body" />
      <a
        className="sep-bibliography-preview-search"
        href={buildPhilPapersSearchUrl(entry)}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`Search PhilPapers for ${entry.title || `${entry.author} ${entry.year}`}`}
      >
        Search PhilPapers
        <IconArrowUpRight />
      </a>
    </div>
  );
}

export function BibliographyPreview({
  entries,
}: BibliographyPreviewProps) {
  return (
    <div className="sep-bibliography-preview" data-sep-plus-bibliography-preview="">
      {entries.map((entry, index) => (
        <PreviewEntry key={`${entry.authorKey}-${entry.year}-${index}`} entry={entry} />
      ))}
    </div>
  );
}
