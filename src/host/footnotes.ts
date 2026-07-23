import footnoteStyles from './footnotes.css?inline';

const FOOTNOTE_LAYER_ID = 'sep-plus-footnote-layer';
const FOOTNOTE_SECTION_ID = 'footnotes';
const FOOTNOTE_HEADING_ID = 'sep-plus-footnotes-heading';
const FOOTNOTE_REFERENCE_SELECTOR =
  '#article-content sup a[data-sep-plus-footnote-key]';
const POINTER_CLOSE_DELAY_MS = 80;
const POINTER_TRANSITION_MS = 100;
const VIEWPORT_MARGIN_PX = 12;
const PREVIEW_GAP_PX = 10;

const BLOCKED_CONTENT_SELECTOR = [
  'script',
  'style',
  'link',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'template',
  'base',
  'meta',
].join(',');

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const SAFE_RESOURCE_PROTOCOLS = new Set(['http:', 'https:']);

export type FootnoteReference = {
  link: HTMLAnchorElement;
  sourceUrl: string;
  fragment: string;
  key: string;
};

export type ParsedFootnote = {
  sourceUrl: string;
  fragment: string;
  blocks: Element[];
};

type RenderedFootnote = {
  key: string;
  localId: string;
  label: string;
  element: HTMLElement;
};

type BuiltFootnotes = {
  section: HTMLElement;
  notesByKey: Map<string, RenderedFootnote>;
};

type FootnoteLayerElement = HTMLElement & {
  sepPlusCleanup?: () => void;
};

export type FootnoteControllerOptions = {
  document?: Document;
  window?: Window;
  fetch?: typeof fetch;
};

export type FootnotePlacement = {
  top: number;
  left: number;
  arrowLeft: number;
  placement: 'above' | 'below';
};

type RectLike = Pick<
  DOMRectReadOnly,
  'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'
>;

type Size = {
  width: number;
  height: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

function decodeFragment(hash: string): string {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

function withoutHash(url: URL): string {
  const next = new URL(url);
  next.hash = '';
  return next.href;
}

function pageIdentity(url: URL): string {
  const next = new URL(url);
  next.hash = '';
  next.search = '';
  next.pathname = next.pathname.replace(/\/index\.html$/i, '/');
  return next.href;
}

function footnoteKey(sourceUrl: string, fragment: string): string {
  return `${sourceUrl}#${fragment}`;
}

function slug(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return normalized || 'note';
}

function directChildOf(root: Element, element: Element): Element | null {
  let current = element;
  while (current.parentElement && current.parentElement !== root) {
    current = current.parentElement;
  }
  return current.parentElement === root ? current : null;
}

function allElements(root: Element): Element[] {
  return [root, ...Array.from(root.querySelectorAll('*'))];
}

function isSupportedNotesUrl(url: URL, pageUrl: URL): boolean {
  return (
    url.origin === pageUrl.origin &&
    /\/notes\.html$/i.test(url.pathname) &&
    Boolean(url.hash)
  );
}

export function collectFootnoteReferences(
  root: ParentNode,
  pageHref = window.location.href
): FootnoteReference[] {
  const pageUrl = new URL(pageHref);
  const references: FootnoteReference[] = [];

  for (const link of Array.from(
    root.querySelectorAll<HTMLAnchorElement>('#article-content sup a[href]')
  )) {
    const rawHref = link.getAttribute('href');
    if (!rawHref) {
      continue;
    }

    try {
      const url = new URL(rawHref, pageUrl);
      if (!isSupportedNotesUrl(url, pageUrl)) {
        continue;
      }
      const fragment = decodeFragment(url.hash);
      const sourceUrl = withoutHash(url);
      references.push({
        link,
        sourceUrl,
        fragment,
        key: footnoteKey(sourceUrl, fragment),
      });
    } catch {
      continue;
    }
  }

  return references;
}

export function parseFootnoteDocument(
  html: string,
  sourceUrl: string,
  requestedFragments: ReadonlySet<string>,
  parser = new DOMParser()
): Map<string, ParsedFootnote> {
  const parsed = parser.parseFromString(html, 'text/html');
  const root = parsed.getElementById('aueditable');
  const notes = new Map<string, ParsedFootnote>();
  if (!root) {
    return notes;
  }

  const children = Array.from(root.children);
  const starts = new Map<Element, number>();
  const markerByFragment = new Map<string, Element>();

  for (const marker of Array.from(root.querySelectorAll<HTMLElement>('[id]'))) {
    const id = marker.id;
    if (!/^note[-_:]\d/i.test(id) && !requestedFragments.has(id)) {
      continue;
    }
    const start = directChildOf(root, marker);
    if (!start) {
      continue;
    }
    const index = children.indexOf(start);
    if (index < 0) {
      continue;
    }
    starts.set(start, index);
    markerByFragment.set(id, marker);
  }

  const orderedStarts = Array.from(new Set(starts.values())).sort(
    (left, right) => left - right
  );

  for (const fragment of requestedFragments) {
    const marker =
      markerByFragment.get(fragment) ?? parsed.getElementById(fragment);
    if (!marker || !root.contains(marker)) {
      continue;
    }
    const start = directChildOf(root, marker);
    if (!start) {
      continue;
    }
    const startIndex = children.indexOf(start);
    if (startIndex < 0) {
      continue;
    }
    const nextIndex =
      orderedStarts.find((index) => index > startIndex) ?? children.length;
    notes.set(fragment, {
      sourceUrl,
      fragment,
      blocks: children.slice(startIndex, nextIndex),
    });
  }

  return notes;
}

function localIdMapForReferences(
  doc: Document,
  references: readonly FootnoteReference[]
): Map<string, string> {
  const sourceIndexes = new Map<string, number>();
  const usedIds = new Set<string>();
  const ids = new Map<string, string>();

  for (const reference of references) {
    if (!sourceIndexes.has(reference.sourceUrl)) {
      sourceIndexes.set(reference.sourceUrl, sourceIndexes.size + 1);
    }
    if (ids.has(reference.key)) {
      continue;
    }
    const sourceIndex = sourceIndexes.get(reference.sourceUrl);
    if (sourceIndex === undefined) {
      continue;
    }
    const base = `sep-plus-note-${sourceIndex}-${slug(reference.fragment)}`;
    let candidate = base;
    let suffix = 2;
    while (usedIds.has(candidate) || doc.getElementById(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(candidate);
    ids.set(reference.key, candidate);
  }

  return ids;
}

function normalizeLinkHref(
  rawHref: string,
  sourceUrl: string,
  pageHref: string,
  primaryIds: ReadonlyMap<string, string>,
  descendantIds: ReadonlyMap<string, string>
): string | null {
  if (rawHref.startsWith('#')) {
    const fragment = decodeFragment(rawHref);
    return `#${descendantIds.get(fragment) ?? primaryIds.get(fragment) ?? fragment}`;
  }

  try {
    const url = new URL(rawHref, sourceUrl);
    if (!SAFE_LINK_PROTOCOLS.has(url.protocol)) {
      return null;
    }
    const fragment = decodeFragment(url.hash);
    if (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    ) {
      if (pageIdentity(url) === pageIdentity(new URL(pageHref)) && fragment) {
        return `#${fragment}`;
      }
      if (withoutHash(url) === sourceUrl && fragment) {
        const localId =
          descendantIds.get(fragment) ?? primaryIds.get(fragment);
        if (localId) {
          return `#${localId}`;
        }
      }
    }
    return url.href;
  } catch {
    return null;
  }
}

function normalizeResourceUrl(
  rawUrl: string,
  sourceUrl: string
): string | null {
  try {
    const url = new URL(rawUrl, sourceUrl);
    return SAFE_RESOURCE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function sanitizeAndNormalizeBlock(
  block: Element,
  doc: Document,
  note: ParsedFootnote,
  primaryIds: ReadonlyMap<string, string>,
  descendantIds: ReadonlyMap<string, string>,
  pageHref: string
): Element {
  const clone = doc.importNode(block, true);

  for (const blocked of Array.from(
    clone.querySelectorAll(BLOCKED_CONTENT_SELECTOR)
  )) {
    blocked.remove();
  }

  for (const element of allElements(clone)) {
    const oldId = element.getAttribute('id');
    if (!oldId) {
      continue;
    }
    if (oldId === note.fragment) {
      element.removeAttribute('id');
      continue;
    }
    const mapped = descendantIds.get(oldId) ?? primaryIds.get(oldId);
    if (mapped) {
      element.id = mapped;
    } else {
      element.removeAttribute('id');
    }
  }

  for (const element of allElements(clone)) {
    for (const attribute of element.getAttributeNames()) {
      const lower = attribute.toLowerCase();
      if (
        lower.startsWith('on') ||
        lower === 'style' ||
        lower === 'srcdoc' ||
        lower === 'srcset' ||
        lower === 'formaction'
      ) {
        element.removeAttribute(attribute);
      }
    }

    const rawHref = element.getAttribute('href');
    if (rawHref) {
      const href = normalizeLinkHref(
        rawHref,
        note.sourceUrl,
        pageHref,
        primaryIds,
        descendantIds
      );
      if (href) {
        element.setAttribute('href', href);
      } else {
        element.removeAttribute('href');
      }
    }
    element.removeAttribute('xlink:href');

    if (element instanceof HTMLAnchorElement) {
      if (element.target === '_blank') {
        element.rel = 'noopener noreferrer';
      }
    }

    const rawSrc = element.getAttribute('src');
    if (rawSrc) {
      const src = normalizeResourceUrl(rawSrc, note.sourceUrl);
      if (src) {
        element.setAttribute('src', src);
      } else {
        element.removeAttribute('src');
      }
    }
    if (element instanceof HTMLImageElement) {
      element.loading = 'lazy';
    }
  }

  return clone;
}

export function referenceLabel(reference: FootnoteReference): string {
  const text = (reference.link.textContent || '').replace(/\s+/g, ' ').trim();
  return text.replace(/[\[\]().]/g, '') || reference.fragment;
}

/** SEP wraps markers as `<sup>[<a>1</a>]</sup>` — brackets are sibling text nodes. */
const MARKER_DECORATION = /^[\[\]().\s]+$/;

type RemovedDecoration = {
  parent: Node;
  node: Text;
  nextSibling: ChildNode | null;
};

export function stripMarkerDecoration(
  link: HTMLAnchorElement
): RemovedDecoration[] {
  const parent = link.parentElement;
  if (!parent || parent.tagName !== 'SUP') {
    return [];
  }
  const removed: RemovedDecoration[] = [];
  for (const node of Array.from(parent.childNodes)) {
    if (node === link || !(node instanceof Text)) {
      continue;
    }
    const text = node.data;
    if (!text || !MARKER_DECORATION.test(text)) {
      continue;
    }
    removed.push({ parent, node, nextSibling: node.nextSibling });
    node.remove();
  }
  return removed;
}

function restoreMarkerDecoration(removed: readonly RemovedDecoration[]): void {
  for (let index = removed.length - 1; index >= 0; index -= 1) {
    const item = removed[index];
    if (!item) {
      continue;
    }
    item.parent.insertBefore(item.node, item.nextSibling);
  }
}

function descendantIdMapForNote(
  note: ParsedFootnote,
  localId: string,
  primaryIds: ReadonlyMap<string, string>
): Map<string, string> {
  const ids = new Map<string, string>();
  for (const block of note.blocks) {
    for (const element of allElements(block)) {
      const oldId = element.getAttribute('id');
      if (!oldId || oldId === note.fragment) {
        continue;
      }
      ids.set(
        oldId,
        primaryIds.get(oldId) ?? `${localId}-${slug(oldId)}`
      );
    }
  }
  return ids;
}

export function buildFootnoteSection(
  doc: Document,
  references: readonly FootnoteReference[],
  parsedNotes: ReadonlyMap<string, ParsedFootnote>,
  pageHref = window.location.href
): BuiltFootnotes {
  const section = doc.createElement('section');
  section.id = FOOTNOTE_SECTION_ID;
  section.className = 'sep-plus-footnotes';
  section.dataset.sepPlusFootnotes = '1';
  section.setAttribute('role', 'doc-endnotes');
  section.setAttribute('aria-labelledby', FOOTNOTE_HEADING_ID);

  const heading = doc.createElement('h2');
  heading.id = FOOTNOTE_HEADING_ID;
  heading.textContent = 'Footnotes';
  section.appendChild(heading);

  const localIds = localIdMapForReferences(doc, references);
  const primaryIdsBySource = new Map<string, Map<string, string>>();
  for (const reference of references) {
    const localId = localIds.get(reference.key);
    if (!localId) {
      continue;
    }
    const ids =
      primaryIdsBySource.get(reference.sourceUrl) ?? new Map<string, string>();
    ids.set(reference.fragment, localId);
    primaryIdsBySource.set(reference.sourceUrl, ids);
  }

  const notesByKey = new Map<string, RenderedFootnote>();
  for (const reference of references) {
    if (notesByKey.has(reference.key)) {
      continue;
    }
    const note = parsedNotes.get(reference.key);
    const localId = localIds.get(reference.key);
    const primaryIds = primaryIdsBySource.get(reference.sourceUrl);
    if (!note || !localId || !primaryIds) {
      continue;
    }

    const wrapper = doc.createElement('div');
    wrapper.id = localId;
    wrapper.className = 'sep-plus-footnote';
    wrapper.setAttribute('role', 'doc-endnote');
    wrapper.dataset.sepPlusFootnoteKey = reference.key;
    const descendantIds = descendantIdMapForNote(
      note,
      localId,
      primaryIds
    );

    for (const block of note.blocks) {
      wrapper.appendChild(
        sanitizeAndNormalizeBlock(
          block,
          doc,
          note,
          primaryIds,
          descendantIds,
          pageHref
        )
      );
    }

    section.appendChild(wrapper);
    notesByKey.set(reference.key, {
      key: reference.key,
      localId,
      label: referenceLabel(reference),
      element: wrapper,
    });
  }

  return { section, notesByKey };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function computeFootnotePlacement(
  trigger: RectLike,
  preview: Size,
  viewport: ViewportSize,
  margin = VIEWPORT_MARGIN_PX,
  gap = PREVIEW_GAP_PX
): FootnotePlacement {
  const availableAbove = trigger.top - margin - gap;
  const availableBelow = viewport.height - trigger.bottom - margin - gap;
  const placement =
    availableAbove >= preview.height || availableAbove >= availableBelow
      ? 'above'
      : 'below';
  const idealTop =
    placement === 'above'
      ? trigger.top - preview.height - gap
      : trigger.bottom + gap;
  const top = clamp(
    idealTop,
    margin,
    viewport.height - preview.height - margin
  );
  const idealLeft = trigger.left + trigger.width / 2 - preview.width / 2;
  const left = clamp(
    idealLeft,
    margin,
    viewport.width - preview.width - margin
  );
  const arrowLeft = clamp(
    trigger.left + trigger.width / 2 - left,
    16,
    preview.width - 16
  );

  return { top, left, arrowLeft, placement };
}

function isFootnoteLabelText(text: string, label: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim().replace(/[\[\]().]/g, '');
  return normalized === label;
}

function stripLeadingPreviewLabel(root: ParentNode, label: string): void {
  const firstLink = root.querySelector('a');
  if (!(firstLink instanceof HTMLAnchorElement)) {
    return;
  }
  if (!isFootnoteLabelText(firstLink.textContent || '', label)) {
    return;
  }
  const previous = firstLink.previousSibling;
  if (
    previous?.nodeType === Node.TEXT_NODE &&
    /^[\s\u00a0]*$/.test(previous.textContent || '')
  ) {
    previous.parentNode?.removeChild(previous);
  }
  const next = firstLink.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE && next.textContent) {
    next.textContent = next.textContent.replace(/^[\s\u00a0]+/, '');
  }
  firstLink.remove();
}

function cloneNoteForPreview(
  note: RenderedFootnote,
  doc: Document
): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  for (const child of Array.from(note.element.children)) {
    const clone = child.cloneNode(true);
    if (!(clone instanceof Element)) {
      continue;
    }
    for (const element of allElements(clone)) {
      element.removeAttribute('id');
      element.removeAttribute('aria-labelledby');
      element.removeAttribute('aria-describedby');
      element.removeAttribute('aria-details');
    }
    fragment.appendChild(clone);
  }
  stripLeadingPreviewLabel(fragment, note.label);
  return fragment;
}

function createPreviewController(options: {
  doc: Document;
  win: Window;
  article: Element;
  layer: HTMLElement;
  shadow: ShadowRoot;
  preview: HTMLElement;
  content: HTMLElement;
  arrow: HTMLElement;
  notesByKey: ReadonlyMap<string, RenderedFootnote>;
  signal: AbortSignal;
}): () => void {
  const {
    doc,
    win,
    article,
    layer,
    shadow,
    preview,
    content,
    arrow,
    notesByKey,
    signal,
  } = options;
  const hoverMedia = win.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMedia = win.matchMedia('(prefers-reduced-motion: reduce)');
  let activeLink: HTMLAnchorElement | null = null;
  let showFrame: number | null = null;
  let positionFrame: number | null = null;
  let closeTimer: number | null = null;
  let hideTimer: number | null = null;
  let activeMotion: 'pointer' | 'instant' = 'instant';

  function clearCloseTimer(): void {
    if (closeTimer !== null) {
      win.clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function clearHideTimer(): void {
    if (hideTimer !== null) {
      win.clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function clearShowFrame(): void {
    if (showFrame !== null) {
      win.cancelAnimationFrame(showFrame);
      showFrame = null;
    }
  }

  function findReference(target: EventTarget | null): HTMLAnchorElement | null {
    if (!(target instanceof Element)) {
      return null;
    }
    const link = target.closest<HTMLAnchorElement>(
      FOOTNOTE_REFERENCE_SELECTOR
    );
    return link && article.contains(link) ? link : null;
  }

  function updatePosition(): void {
    positionFrame = null;
    if (!activeLink || preview.hidden || !activeLink.isConnected) {
      return;
    }
    const triggerRect = activeLink.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const placement = computeFootnotePlacement(
      triggerRect,
      {
        width: previewRect.width,
        height: previewRect.height,
      },
      {
        width: win.innerWidth,
        height: win.innerHeight,
      }
    );
    preview.style.top = `${placement.top}px`;
    preview.style.left = `${placement.left}px`;
    preview.dataset.placement = placement.placement;
    arrow.style.left = `${placement.arrowLeft}px`;
  }

  function schedulePosition(): void {
    if (!activeLink || positionFrame !== null) {
      return;
    }
    positionFrame = win.requestAnimationFrame(updatePosition);
  }

  function showPreview(
    link: HTMLAnchorElement,
    motion: 'pointer' | 'instant'
  ): void {
    const key = link.dataset.sepPlusFootnoteKey;
    const note = key ? notesByKey.get(key) : undefined;
    if (!note) {
      return;
    }

    clearCloseTimer();
    clearHideTimer();
    clearShowFrame();
    const wasOpen = !preview.hidden && preview.dataset.state === 'open';
    activeLink = link;
    activeMotion = motion;
    content.replaceChildren(cloneNoteForPreview(note, doc));
    preview.setAttribute('aria-label', `Footnote ${note.label}`);
    preview.dataset.motion = motion;
    preview.dataset.state = wasOpen ? 'open' : 'measuring';
    preview.hidden = false;
    updatePosition();

    if (wasOpen || motion === 'instant') {
      preview.dataset.state = 'open';
      return;
    }

    showFrame = win.requestAnimationFrame(() => {
      showFrame = null;
      if (activeLink === link) {
        preview.dataset.state = 'open';
      }
    });
  }

  function finishHide(): void {
    hideTimer = null;
    preview.hidden = true;
    preview.dataset.state = 'measuring';
    content.replaceChildren();
  }

  function hidePreview(animate: boolean): void {
    clearCloseTimer();
    clearShowFrame();
    if (!activeLink && preview.hidden) {
      return;
    }
    activeLink = null;
    const shouldAnimate =
      animate &&
      activeMotion === 'pointer' &&
      hoverMedia.matches &&
      !reduceMedia.matches;
    if (!shouldAnimate) {
      clearHideTimer();
      finishHide();
      return;
    }
    preview.dataset.state = 'closing';
    clearHideTimer();
    hideTimer = win.setTimeout(finishHide, POINTER_TRANSITION_MS);
  }

  function focusIsWithinPreview(): boolean {
    const shadowActive = shadow.activeElement;
    return Boolean(shadowActive && preview.contains(shadowActive));
  }

  function schedulePointerClose(): void {
    clearCloseTimer();
    closeTimer = win.setTimeout(() => {
      closeTimer = null;
      if (activeLink && doc.activeElement === activeLink) {
        return;
      }
      hidePreview(true);
    }, POINTER_CLOSE_DELAY_MS);
  }

  article.addEventListener(
    'pointerover',
    (event) => {
      const pointerEvent = event as PointerEvent;
      if (!hoverMedia.matches || pointerEvent.pointerType === 'touch') {
        return;
      }
      const link = findReference(pointerEvent.target);
      if (link) {
        showPreview(link, 'pointer');
      }
    },
    { signal }
  );

  article.addEventListener(
    'pointerout',
    (event) => {
      const pointerEvent = event as PointerEvent;
      const link = findReference(pointerEvent.target);
      if (!link || link !== activeLink) {
        return;
      }
      if (
        pointerEvent.relatedTarget instanceof Node &&
        link.contains(pointerEvent.relatedTarget)
      ) {
        return;
      }
      schedulePointerClose();
    },
    { signal }
  );

  article.addEventListener(
    'focusin',
    (event) => {
      const link = findReference(event.target);
      if (link) {
        showPreview(link, 'instant');
      }
    },
    { signal }
  );

  article.addEventListener(
    'focusout',
    () => {
      win.requestAnimationFrame(() => {
        if (
          (activeLink && doc.activeElement === activeLink) ||
          focusIsWithinPreview()
        ) {
          return;
        }
        hidePreview(false);
      });
    },
    { signal }
  );

  preview.addEventListener('pointerenter', clearCloseTimer, { signal });
  preview.addEventListener('pointerleave', schedulePointerClose, { signal });
  preview.addEventListener(
    'focusout',
    () => {
      win.requestAnimationFrame(() => {
        if (
          (activeLink && doc.activeElement === activeLink) ||
          focusIsWithinPreview()
        ) {
          return;
        }
        hidePreview(false);
      });
    },
    { signal }
  );

  doc.addEventListener(
    'pointerdown',
    (event) => {
      if (!activeLink) {
        return;
      }
      const path = event.composedPath();
      if (path.includes(activeLink) || path.includes(preview)) {
        return;
      }
      hidePreview(false);
    },
    { capture: true, signal }
  );

  doc.addEventListener(
    'click',
    (event) => {
      const link = findReference(event.target);
      if (link && link === activeLink) {
        hidePreview(false);
      }
    },
    { signal }
  );

  doc.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !activeLink) {
        return;
      }
      event.preventDefault();
      const returnTarget = activeLink;
      const shouldReturnFocus = focusIsWithinPreview();
      hidePreview(false);
      if (shouldReturnFocus) {
        returnTarget.focus();
      }
    },
    { capture: true, signal }
  );

  win.addEventListener('scroll', schedulePosition, {
    passive: true,
    signal,
  });
  win.addEventListener('resize', schedulePosition, { signal });

  return () => {
    clearCloseTimer();
    clearHideTimer();
    clearShowFrame();
    if (positionFrame !== null) {
      win.cancelAnimationFrame(positionFrame);
      positionFrame = null;
    }
    preview.hidden = true;
    content.replaceChildren();
    layer.remove();
  };
}

async function loadFootnoteDocuments(options: {
  references: readonly FootnoteReference[];
  fetcher: typeof fetch;
  signal: AbortSignal;
  parser: DOMParser;
  warn: (message: string) => void;
}): Promise<Map<string, ParsedFootnote>> {
  const { references, fetcher, signal, parser, warn } = options;
  const groups = new Map<string, Set<string>>();
  for (const reference of references) {
    const fragments = groups.get(reference.sourceUrl) ?? new Set<string>();
    fragments.add(reference.fragment);
    groups.set(reference.sourceUrl, fragments);
  }

  const parsedByKey = new Map<string, ParsedFootnote>();
  await Promise.all(
    Array.from(groups, async ([sourceUrl, fragments]) => {
      try {
        const response = await fetcher(sourceUrl, {
          credentials: 'same-origin',
          signal,
        });
        if (!response.ok) {
          throw new Error(`request returned ${response.status}`);
        }
        const html = await response.text();
        const responseUrl = response.url
          ? withoutHash(new URL(response.url))
          : sourceUrl;
        const parsed = parseFootnoteDocument(
          html,
          responseUrl,
          fragments,
          parser
        );
        for (const fragment of fragments) {
          const note = parsed.get(fragment);
          if (note) {
            parsedByKey.set(footnoteKey(sourceUrl, fragment), note);
          } else {
            warn(`SEP+ could not find footnote #${fragment}.`);
          }
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        const reason =
          error instanceof Error ? error.message : 'unknown loading error';
        warn(`SEP+ could not load footnotes from ${sourceUrl}: ${reason}`);
      }
    })
  );

  return parsedByKey;
}

export function initFootnotes(
  options: FootnoteControllerOptions = {}
): () => void {
  const doc = options.document ?? document;
  const win = options.window ?? doc.defaultView ?? window;
  const fetcher = options.fetch ?? win.fetch.bind(win);
  const existingLayer = doc.getElementById(
    FOOTNOTE_LAYER_ID
  ) as FootnoteLayerElement | null;
  existingLayer?.sepPlusCleanup?.();
  existingLayer?.remove();
  for (const link of Array.from(
    doc.querySelectorAll<HTMLAnchorElement>(
      '#article-content sup a[data-sep-plus-footnote-source-href]'
    )
  )) {
    const sourceHref = link.dataset.sepPlusFootnoteSourceHref;
    if (sourceHref) {
      link.setAttribute('href', sourceHref);
    }
    delete link.dataset.sepPlusFootnoteSourceHref;
    delete link.dataset.sepPlusFootnoteKey;
    link.removeAttribute('aria-details');
  }
  doc
    .querySelector<HTMLElement>(
      `#${FOOTNOTE_SECTION_ID}[data-sep-plus-footnotes]`
    )
    ?.remove();
  const references = collectFootnoteReferences(doc, win.location.href);
  if (!references.length || !doc.body) {
    return () => undefined;
  }

  const lifecycle = new AbortController();
  const restores: Array<{
    link: HTMLAnchorElement;
    href: string | null;
    ariaDetails: string | null;
    key: string | undefined;
    sourceHref: string | undefined;
    textContent: string | null;
    decoration: RemovedDecoration[];
  }> = [];
  let section: HTMLElement | null = null;
  let previewCleanup: (() => void) | null = null;
  let cleaned = false;

  const layer = doc.createElement('div') as FootnoteLayerElement;
  layer.id = FOOTNOTE_LAYER_ID;
  const shadow = layer.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = footnoteStyles;
  const preview = doc.createElement('aside');
  preview.className = 'sep-footnote-preview';
  preview.hidden = true;
  preview.dataset.state = 'measuring';
  preview.dataset.motion = 'instant';
  preview.setAttribute('role', 'note');
  const content = doc.createElement('div');
  content.className = 'sep-footnote-preview-content';
  const arrow = doc.createElement('span');
  arrow.className = 'sep-footnote-preview-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  preview.append(content, arrow);
  shadow.append(style, preview);
  doc.body.appendChild(layer);

  function cleanup(): void {
    if (cleaned) {
      return;
    }
    cleaned = true;
    lifecycle.abort();
    previewCleanup?.();
    previewCleanup = null;
    for (const restore of restores) {
      if (restore.href === null) {
        restore.link.removeAttribute('href');
      } else {
        restore.link.setAttribute('href', restore.href);
      }
      if (restore.ariaDetails === null) {
        restore.link.removeAttribute('aria-details');
      } else {
        restore.link.setAttribute('aria-details', restore.ariaDetails);
      }
      if (restore.key === undefined) {
        delete restore.link.dataset.sepPlusFootnoteKey;
      } else {
        restore.link.dataset.sepPlusFootnoteKey = restore.key;
      }
      if (restore.sourceHref === undefined) {
        delete restore.link.dataset.sepPlusFootnoteSourceHref;
      } else {
        restore.link.dataset.sepPlusFootnoteSourceHref = restore.sourceHref;
      }
      if (restore.textContent === null) {
        restore.link.textContent = '';
      } else {
        restore.link.textContent = restore.textContent;
      }
      restoreMarkerDecoration(restore.decoration);
    }
    section?.remove();
    section = null;
    layer.remove();
  }

  layer.sepPlusCleanup = cleanup;

  void loadFootnoteDocuments({
    references,
    fetcher,
    signal: lifecycle.signal,
    parser: new DOMParser(),
    warn: (message) => console.warn(message),
  }).then((parsedNotes) => {
    if (lifecycle.signal.aborted || !parsedNotes.size) {
      return;
    }

    const built = buildFootnoteSection(
      doc,
      references,
      parsedNotes,
      win.location.href
    );
    if (!built.notesByKey.size) {
      return;
    }

    const oldSection = doc.getElementById(FOOTNOTE_SECTION_ID);
    if (oldSection && oldSection !== built.section) {
      oldSection.remove();
    }
    const bibliography = doc.getElementById('bibliography');
    if (bibliography) {
      bibliography.before(built.section);
    } else {
      doc.getElementById('article')?.appendChild(built.section);
    }
    if (!built.section.isConnected) {
      return;
    }
    section = built.section;

    for (const reference of references) {
      const note = built.notesByKey.get(reference.key);
      if (!note) {
        continue;
      }
      restores.push({
        link: reference.link,
        href: reference.link.getAttribute('href'),
        ariaDetails: reference.link.getAttribute('aria-details'),
        key: reference.link.dataset.sepPlusFootnoteKey,
        sourceHref: reference.link.dataset.sepPlusFootnoteSourceHref,
        textContent: reference.link.textContent,
        decoration: stripMarkerDecoration(reference.link),
      });
      const sourceHref = reference.link.getAttribute('href');
      if (sourceHref) {
        reference.link.dataset.sepPlusFootnoteSourceHref = sourceHref;
      }
      reference.link.setAttribute('href', `#${note.localId}`);
      reference.link.setAttribute('aria-details', note.localId);
      reference.link.dataset.sepPlusFootnoteKey = reference.key;
      reference.link.textContent = note.label;
    }

    const article = doc.getElementById('article-content');
    if (!article) {
      return;
    }
    previewCleanup = createPreviewController({
      doc,
      win,
      article,
      layer,
      shadow,
      preview,
      content,
      arrow,
      notesByKey: built.notesByKey,
      signal: lifecycle.signal,
    });
  });

  return cleanup;
}
