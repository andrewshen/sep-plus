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
  toTitleCase,
} from '../../lib/entryIndex';
import type { EntryIndexItem } from '../../lib/types';
import { IconSearch } from '../icons';

type PaletteProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
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

type Phase = 'from' | 'open' | 'closing';

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
  onClose();
  window.location.assign(url);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const EXIT_MS = 160;
const PROTRUDE_PX = 60;
/** Sidebar content padding-right; included so width clears the sidebar edge. */
const SIDEBAR_PAD_RIGHT = 20;
const CLOSED_HEIGHT = 40;

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

export function Palette({ open, onClose, anchorRef, dark }: PaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<EntryIndexItem[] | null>(null);
  const [related, setRelated] = useState<EntryIndexItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<Phase>('from');
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  const expanded = phase === 'open';
  const closing = phase === 'closing';

  useEffect(() => {
    if (!open) {
      return;
    }
    const next = measureAnchor(anchorRef);
    setAnchor(next);
    setMounted(true);
    setPhase(prefersReducedMotion() ? 'open' : 'from');
  }, [open, anchorRef]);

  useEffect(() => {
    if (open || !mounted) {
      return;
    }
    setPhase('closing');
    const delay = prefersReducedMotion() ? 0 : EXIT_MS;
    const timer = window.setTimeout(() => {
      setMounted(false);
      setPhase('from');
      setQuery('');
      setActiveIndex(0);
      setLoadError(null);
      setAnchor(null);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useLayoutEffect(() => {
    if (!mounted || !open || phase !== 'from') {
      return;
    }
    if (prefersReducedMotion()) {
      setPhase('open');
      return;
    }
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setPhase('open');
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [mounted, open, phase]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    function onResize(): void {
      const next = measureAnchor(anchorRef);
      if (next) {
        setAnchor(next);
      }
    }

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mounted, anchorRef]);

  useEffect(() => {
    if (!open || closing || !mounted) {
      return;
    }
    setRelated(collectRelatedEntries());
  }, [open, closing, mounted]);

  useEffect(() => {
    // Focus once the shell is painted so typing works through the morph.
    if (!mounted || closing || !anchor) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mounted, closing, anchor]);

  useEffect(() => {
    if (!open || closing) {
      return;
    }
    let cancelled = false;
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
    return () => {
      cancelled = true;
    };
  }, [open, closing]);

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
    if (!open || closing || !listRef.current) {
      return;
    }
    const active = listRef.current.querySelector<HTMLElement>(
      '[role="option"][aria-selected="true"]'
    );
    active?.scrollIntoView({ block: 'nearest' });
  }, [open, closing, activeIndex, rows.length]);

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

  const shellOpen = expanded;
  const width = shellOpen
    ? anchor.width + SIDEBAR_PAD_RIGHT + PROTRUDE_PX
    : anchor.width;

  return createPortal(
    <div
      className={['sep-plus-app', dark ? 'is-dark' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'sep-palette-scrim',
          shellOpen ? 'is-visible' : '',
          closing ? 'is-exiting' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onMouseDown={(event) => {
          if (closing || !shellOpen) {
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
          shellOpen ? 'is-open' : '',
          closing ? 'is-closing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal={shellOpen ? true : undefined}
        aria-label="Search"
        style={{
          top: anchor.top,
          left: anchor.left,
          width,
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
            {loading && !entries ? (
              <div className="sep-palette-empty">Loading titles…</div>
            ) : null}

            {!loading && loadError ? (
              <div className="sep-palette-empty">{loadError}</div>
            ) : null}

            {!loading && !loadError && !trimmed && related.length === 0 ? (
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
                          {toTitleCase(row.entry.title)}
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
