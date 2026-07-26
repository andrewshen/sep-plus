import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  collectRelatedEntries,
  filterEntries,
  getEntryIndex,
  searchResultsUrl,
} from '../../lib/entryIndex';
import { formatEntryTitle } from '../../lib/formatEntryTitle';
import type { EntryIndexItem } from '../../lib/types';
import { IconSearch } from '../icons';

type PaletteProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  /** Collapsed sidebar: center the palette instead of morphing from the slot. */
  collapsed: boolean;
  dark: boolean;
};

type PaletteRow =
  | { kind: 'entry'; entry: EntryIndexItem }
  | { kind: 'search'; query: string };

type AnchorRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function navigateTo(
  url: string,
  onClose: () => void,
  newTab = false
): void {
  if (newTab) {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
    return;
  }
  // Skip the close morph — starting it then navigating freezes mid-transition
  // while the document unloads.
  window.location.assign(url);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function rowHref(row: PaletteRow): string {
  return row.kind === 'entry' ? row.entry.href : searchResultsUrl(row.query);
}

/** Absolute same-origin URL suitable for document prefetch, or null to skip. */
function prefetchableUrl(href: string): string | null {
  try {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) {
      return null;
    }
    url.hash = '';
    const current = new URL(location.href);
    current.hash = '';
    if (url.href === current.href) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

const PREFETCH_ATTR = 'data-sep-plus-prefetch';

function supportsSpeculationRules(): boolean {
  return (
    typeof HTMLScriptElement !== 'undefined' &&
    typeof HTMLScriptElement.supports === 'function' &&
    HTMLScriptElement.supports('speculationrules')
  );
}

function installDocumentPrefetch(url: string): void {
  if (supportsSpeculationRules()) {
    const script = document.createElement('script');
    script.type = 'speculationrules';
    script.setAttribute(PREFETCH_ATTR, url);
    script.textContent = JSON.stringify({
      prefetch: [{ urls: [url] }],
    });
    document.head.appendChild(script);
    return;
  }

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.setAttribute(PREFETCH_ATTR, url);
  document.head.appendChild(link);
}

function clearDocumentPrefetches(): void {
  for (const el of Array.from(
    document.querySelectorAll(`[${PREFETCH_ATTR}]`)
  )) {
    el.remove();
  }
}

const EXIT_MS = 150;
const PROTRUDE_PX = 60;
/** Sidebar content padding-right; included so width clears the sidebar edge. */
const SIDEBAR_PAD_RIGHT = 20;
/** Centered (collapsed-sidebar) palette width and viewport insets. */
const CENTERED_WIDTH = 560;
const CENTERED_MARGIN = 16;
/** Vertical placement as a fraction of viewport height (upper-center). */
const CENTERED_TOP_RATIO = 0.22;
const CLOSED_HEIGHT = 40;
/** Wait out rapid ↑/↓ before kicking off a prefetch. */
const PREFETCH_DEBOUNCE_MS = 75;

type PaletteLayout = {
  top: number;
  left: number;
  width: number;
};

function getCenteredLayout(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight
): PaletteLayout {
  const width = Math.min(
    CENTERED_WIDTH,
    Math.max(0, viewportWidth - CENTERED_MARGIN * 2)
  );
  return {
    width,
    left: Math.max(CENTERED_MARGIN, Math.round((viewportWidth - width) / 2)),
    top: Math.round(viewportHeight * CENTERED_TOP_RATIO),
  };
}

function getPaletteMount(): HTMLElement | null {
  const layer = document.getElementById('sep-plus-palette-layer');
  return layer?.shadowRoot?.getElementById('sep-plus-palette-mount') ?? null;
}

function measureAnchor(
  anchorRef: RefObject<HTMLElement | null>
): AnchorRect | null {
  const el = anchorRef.current;
  if (!el) {
    return null;
  }
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height || CLOSED_HEIGHT,
  };
}

export function Palette({
  open,
  onClose,
  anchorRef,
  collapsed,
  dark,
}: PaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<EntryIndexItem[] | null>(null);
  const [related, setRelated] = useState<EntryIndexItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const prevActiveIndexRef = useRef(0);
  const prefetchedUrlsRef = useRef(new Set<string>());
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  const closing = mounted && !open;
  // Layout mode is captured when opening so a sidebar toggle mid-session
  // (or during close) doesn't jump between centered and anchored geometry.
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const [centered, setCentered] = useState(collapsed);

  useEffect(() => {
    if (!open) {
      return;
    }
    setCentered(collapsedRef.current);
    setRelated(collectRelatedEntries());
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    const next = measureAnchor(anchorRef);
    setAnchor(next);
    setMounted(true);
    setExpanded(prefersReducedMotion());
  }, [open, anchorRef]);

  useEffect(() => {
    if (open || !mounted) {
      return;
    }
    setExpanded(false);
    const delay = prefersReducedMotion() ? 0 : EXIT_MS;
    const timer = window.setTimeout(() => {
      setMounted(false);
      setQuery('');
      setActiveIndex(0);
      prevActiveIndexRef.current = 0;
      setLoadError(null);
      setAnchor(null);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useLayoutEffect(() => {
    if (!mounted || !open || !anchor) {
      return;
    }
    if (prefersReducedMotion()) {
      setExpanded(true);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      setExpanded(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [mounted, open, anchor]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    function onResize(): void {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const next = measureAnchor(anchorRef);
      if (next) {
        setAnchor(next);
      }
    }

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mounted, anchorRef]);

  useEffect(() => {
    if (!mounted || closing || !anchor) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mounted, closing, anchor]);

  useEffect(() => {
    if (!open || closing || entries) {
      return;
    }
    let cancelled = false;
    // Defer index fetch until after the open morph so setState doesn't
    // re-render mid-animation (first open only — later opens are cached).
    const timer = window.setTimeout(() => {
      setLoading(true);
      setLoadError(null);
      void getEntryIndex()
        .then((items) => {
          if (!cancelled) {
            setEntries(items);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoadError('Could not load entry titles');
            setEntries([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, EXIT_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, closing, entries]);

  const matches = useMemo(
    () => (entries ? filterEntries(entries, query, related) : []),
    [entries, query, related]
  );

  const trimmed = query.trim();
  const rows = useMemo((): PaletteRow[] => {
    if (!trimmed) {
      return related.map((entry) => ({ kind: 'entry' as const, entry }));
    }
    return [
      ...matches.map((entry) => ({ kind: 'entry' as const, entry })),
      { kind: 'search' as const, query: trimmed },
    ];
  }, [matches, related, trimmed]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, rows.length]);

  useEffect(() => {
    if (!open || closing) {
      return;
    }
    const row = rows[activeIndex];
    if (!row) {
      return;
    }
    const url = prefetchableUrl(rowHref(row));
    if (!url || prefetchedUrlsRef.current.has(url)) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (prefetchedUrlsRef.current.has(url)) {
        return;
      }
      prefetchedUrlsRef.current.add(url);
      installDocumentPrefetch(url);
    }, PREFETCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [open, closing, rows, activeIndex]);

  useEffect(() => {
    if (open) {
      return;
    }
    prefetchedUrlsRef.current.clear();
    clearDocumentPrefetches();
  }, [open]);

  useEffect(() => {
    if (!open || closing || !expanded || !listRef.current) {
      return;
    }
    const previousIndex = prevActiveIndexRef.current;
    prevActiveIndexRef.current = activeIndex;
    // Skip idle/initial index 0 — scrollIntoView during the open morph nudges the
    // list. Still scroll when wrapping from the last result back to the first.
    if (activeIndex === 0 && previousIndex === 0) {
      return;
    }
    const active = listRef.current.querySelector<HTMLElement>(
      '[role="option"][aria-selected="true"]'
    );
    active?.scrollIntoView({ block: 'nearest' });
  }, [open, closing, expanded, activeIndex]);

  useEffect(() => {
    if (!open || closing) {
      return;
    }

    function activateRow(row: PaletteRow, newTab = false): void {
      if (row.kind === 'entry') {
        navigateTo(row.entry.href, onClose, newTab);
        return;
      }
      navigateTo(searchResultsUrl(row.query), onClose, newTab);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        if (!rows.length) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => (index + 1) % rows.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        if (!rows.length) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => (index - 1 + rows.length) % rows.length);
        return;
      }

      if (event.key === 'Enter') {
        const row = rows[activeIndex];
        if (!row) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        activateRow(row, event.metaKey || event.ctrlKey);
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, closing, onClose, rows, activeIndex]);

  const mountNode = getPaletteMount();

  if (!mounted || !anchor || !mountNode) {
    return null;
  }

  const layout: PaletteLayout = centered
    ? getCenteredLayout(viewport.width, viewport.height)
    : {
        top: anchor.top,
        left: anchor.left,
        width: expanded
          ? anchor.width + SIDEBAR_PAD_RIGHT + PROTRUDE_PX
          : anchor.width,
      };

  return createPortal(
    <div
      className={['sep-plus-app', dark ? 'is-dark' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'sep-palette-scrim',
          expanded ? 'is-visible' : '',
          closing ? 'is-exiting' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onMouseDown={(event) => {
          if (closing || !expanded) {
            return;
          }
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      />
      <div
        className={[
          'sep-palette-inline',
          centered ? 'is-centered' : '',
          expanded ? 'is-open' : '',
          closing ? 'is-closing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal={expanded ? true : undefined}
        aria-label="Search"
        style={{
          top: layout.top,
          left: layout.left,
          width: layout.width,
        }}
      >
        <div className="sep-palette-input-row">
          <IconSearch />
          <input
            ref={inputRef}
            className="sep-palette-input"
            type="search"
            placeholder="Search"
            aria-label="Search"
            aria-controls="sep-palette-results"
            aria-autocomplete="list"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd className="sep-palette-esc">Esc</kbd>
        </div>

        <div className="sep-palette-results-wrap">
          <div className="sep-palette-body">
            {/* Never stack loading above related rows — that shifts the list on first open. */}
            {loading && !entries && rows.length === 0 ? (
              <div className="sep-palette-empty">Loading titles…</div>
            ) : null}

            {!loading && loadError && rows.length === 0 ? (
              <div className="sep-palette-empty">{loadError}</div>
            ) : null}

            {!loading &&
            !loadError &&
            !trimmed &&
            related.length === 0 &&
            rows.length === 0 ? (
              <div className="sep-palette-empty">Type to search by title</div>
            ) : null}

            {rows.length > 0 ? (
              <ul
                ref={listRef}
                id="sep-palette-results"
                className="sep-palette-results"
                role="listbox"
                aria-label={trimmed ? 'Search results' : 'Related entries'}
              >
                {rows.map((row, index) => {
                  const selected = index === activeIndex;
                  if (row.kind === 'entry') {
                    return (
                      <li key={row.entry.href} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={[
                            'sep-palette-result',
                            selected ? 'is-active' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => navigateTo(row.entry.href, onClose)}
                        >
                          {formatEntryTitle(row.entry.title, row.entry.href)}
                        </button>
                      </li>
                    );
                  }
                  return (
                    <li key="search-fallback" role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={[
                          'sep-palette-result',
                          'sep-palette-result--search',
                          selected ? 'is-active' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() =>
                          navigateTo(searchResultsUrl(row.query), onClose)
                        }
                      >
                        Search for “{row.query}”
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    mountNode
  );
}
