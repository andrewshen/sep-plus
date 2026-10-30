import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  collectRelatedEntries,
  MAX_RESULTS,
  filterEntries,
  getEntryIndex,
  searchResultsUrl,
  warmSearchKeys,
} from '../../lib/entryIndex';
import { formatEntryTitle } from '../../lib/formatEntryTitle';
import type { EntryIndexItem } from '../../lib/types';
import { IconClose, IconSearch } from '../icons';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';
import { Popover, POPOVER_EXIT_MS } from '../ui/Popover';
import { useDismiss } from '../ui/useDismiss';

type SearchProps = {
  /** `header`: compact pill in the fixed header; `hero`: homepage search. */
  variant?: 'header' | 'hero';
  /**
   * Default rows for an empty query, also ranked first when typing. Omit to
   * use the current entry's Related Entries.
   */
  suggestions?: readonly EntryIndexItem[];
  suggestionsLabel?: string;
  /** Pre-filled query on mount. */
  initialQuery?: string;
  placeholder?: string;
  /**
   * With an empty input, show results for this query instead of the
   * suggestions. Suggestions still rank first once the user types.
   */
  emptyQuery?: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
};

type SearchRow =
  | { kind: 'entry'; entry: EntryIndexItem }
  | { kind: 'search'; query: string };

const RESULTS_ID = 'sep-search-results';
const PREFETCH_ATTR = 'data-sep-plus-prefetch';
/** Wait out rapid ↑/↓ before kicking off a prefetch. */
const PREFETCH_DEBOUNCE_MS = 75;
/** While typing, the top result changes on most keystrokes; wait for a real
 *  pause so each one doesn't fetch a whole entry page. */
const TYPING_PREFETCH_DEBOUNCE_MS = 300;
/** Only the most recent candidates stay prefetched. */
const MAX_PREFETCHES = 3;

function rowHref(row: SearchRow): string {
  return row.kind === 'entry' ? row.entry.href : searchResultsUrl(row.query);
}

function navigateTo(url: string, onClose: () => void, newTab = false): void {
  if (newTab) {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
    return;
  }
  window.location.assign(url);
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

function supportsSpeculationRules(): boolean {
  return (
    typeof HTMLScriptElement !== 'undefined' &&
    typeof HTMLScriptElement.supports === 'function' &&
    HTMLScriptElement.supports('speculationrules')
  );
}

/** Installs a prefetch and returns the URLs evicted to stay under the cap. */
function installDocumentPrefetch(url: string): string[] {
  if (supportsSpeculationRules()) {
    const script = document.createElement('script');
    script.type = 'speculationrules';
    script.setAttribute(PREFETCH_ATTR, url);
    script.textContent = JSON.stringify({
      prefetch: [{ urls: [url] }],
    });
    document.head.appendChild(script);
  } else {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.setAttribute(PREFETCH_ATTR, url);
    document.head.appendChild(link);
  }

  const installed = Array.from(document.querySelectorAll(`[${PREFETCH_ATTR}]`));
  return installed
    .slice(0, Math.max(0, installed.length - MAX_PREFETCHES))
    .map((element) => {
      element.remove();
      return element.getAttribute(PREFETCH_ATTR) ?? '';
    });
}

/** IME composition (e.g. Japanese, Chinese): keys confirm candidates. */
export function isComposingKey(event: {
  isComposing?: boolean;
  keyCode?: number;
}): boolean {
  return Boolean(event.isComposing) || event.keyCode === 229;
}

function clearDocumentPrefetches(): void {
  for (const el of Array.from(
    document.querySelectorAll(`[${PREFETCH_ATTR}]`)
  )) {
    el.remove();
  }
}

export function Search({
  variant = 'header',
  suggestions,
  suggestionsLabel = 'Related entries',
  initialQuery = '',
  placeholder = 'Search',
  emptyQuery,
  open,
  onOpen,
  onClose,
}: SearchProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const prefetchedUrlsRef = useRef(new Set<string>());
  const [query, setQuery] = useState(initialQuery);
  const [entries, setEntries] = useState<EntryIndexItem[] | null>(null);
  const [pageRelated, setPageRelated] = useState<EntryIndexItem[]>([]);
  const related = useMemo(
    () => (suggestions ?? pageRelated).slice(0, MAX_RESULTS),
    [suggestions, pageRelated]
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useDismiss(anchorRef, open, onClose);

  useEffect(() => {
    const input = inputRef.current;
    if (open) {
      if (!suggestions) {
        setPageRelated(collectRelatedEntries());
      }
      input?.focus();
      return;
    }
    input?.blur();
    prefetchedUrlsRef.current.clear();
    clearDocumentPrefetches();
  }, [open]);

  // An empty-state query needs the index before the results open, so load it
  // right away rather than on first open.
  const preload = Boolean(emptyQuery);
  useEffect(() => {
    if ((!open && !preload) || entries) {
      return;
    }
    let cancelled = false;
    // Defer the first index fetch past the open transition so setState doesn't
    // re-render mid-animation (later opens are cached).
    const timer = window.setTimeout(() => {
      setLoading(true);
      setLoadError(null);
      void getEntryIndex()
        .then((items) => {
          if (!cancelled) {
            setEntries(items);
            warmSearchKeys(items);
          }
        })
        .catch(() => {
          if (!cancelled) {
            // entries stays null, so the next open tries again.
            setLoadError('Could not load entry titles');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, open ? POPOVER_EXIT_MS : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, preload, entries]);

  const trimmed = query.trim();
  const emptyTrimmed = emptyQuery?.trim() ?? '';
  const matches = useMemo(
    () => (entries ? filterEntries(entries, query, related) : []),
    [entries, query, related]
  );
  const emptyMatches = useMemo(
    () => (entries && emptyTrimmed ? filterEntries(entries, emptyTrimmed) : []),
    [entries, emptyTrimmed]
  );
  const rows = useMemo((): SearchRow[] => {
    if (!trimmed && emptyTrimmed) {
      return [
        ...emptyMatches.map((entry) => ({ kind: 'entry' as const, entry })),
        { kind: 'search' as const, query: emptyTrimmed },
      ];
    }
    if (!trimmed) {
      return related.map((entry) => ({ kind: 'entry' as const, entry }));
    }
    return [
      ...matches.map((entry) => ({ kind: 'entry' as const, entry })),
      { kind: 'search' as const, query: trimmed },
    ];
  }, [matches, related, trimmed, emptyMatches, emptyTrimmed]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, rows.length]);

  const prefetchQueryRef = useRef(query);
  const queryChangedAtRef = useRef(0);
  useEffect(() => {
    // By time, not by comparing queries: the activeIndex reset that follows
    // a keystroke re-runs this effect with the query already up to date.
    if (prefetchQueryRef.current !== query) {
      prefetchQueryRef.current = query;
      queryChangedAtRef.current = Date.now();
    }
    const typing =
      Date.now() - queryChangedAtRef.current < TYPING_PREFETCH_DEBOUNCE_MS;
    if (!open) {
      return;
    }
    const row = rows[activeIndex];
    // Search rows would run SEP's full-text search on every pause in typing.
    const url =
      row?.kind === 'entry' ? prefetchableUrl(rowHref(row)) : null;
    if (!url || prefetchedUrlsRef.current.has(url)) {
      return;
    }
    const timer = window.setTimeout(
      () => {
        if (prefetchedUrlsRef.current.has(url)) {
          return;
        }
        prefetchedUrlsRef.current.add(url);
        for (const evicted of installDocumentPrefetch(url)) {
          prefetchedUrlsRef.current.delete(evicted);
        }
      },
      typing ? TYPING_PREFETCH_DEBOUNCE_MS : PREFETCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, rows, activeIndex, query]);

  useEffect(() => {
    if (!open || !listRef.current) {
      return;
    }
    listRef.current
      .querySelector<HTMLElement>('[role="option"][aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (isComposingKey(event.nativeEvent)) {
      return;
    }
    if (!open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        onOpen();
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!rows.length) {
        return;
      }
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => (index + step + rows.length) % rows.length);
      return;
    }
    if (event.key === 'Enter') {
      const row = rows[activeIndex];
      if (!row) {
        return;
      }
      event.preventDefault();
      navigateTo(rowHref(row), onClose, event.metaKey || event.ctrlKey);
    }
  }

  const activeOptionId = rows[activeIndex]
    ? `${RESULTS_ID}-${activeIndex}`
    : undefined;

  return (
    <div
      className={`sep-search sep-search--${variant}`}
      ref={anchorRef}
      onMouseDown={(event) => {
        // Presses anywhere in the results keep focus in the field.
        if (event.target !== inputRef.current) {
          event.preventDefault();
        }
      }}
      onBlur={() => {
        if (!open) {
          return;
        }
        // Wait for focus to land. Switching windows blurs without moving
        // focus, so the field is still the active element and stays open.
        window.setTimeout(() => {
          const anchor = anchorRef.current;
          const root = anchor?.getRootNode() as Document | ShadowRoot | undefined;
          const active = root?.activeElement ?? null;
          if (anchor && !(active && anchor.contains(active))) {
            onClose();
          }
        }, 0);
      }}
    >
      <div
        className={['sep-search-field', open ? 'is-open' : '']
          .filter(Boolean)
          .join(' ')}
        onMouseDown={(event) => {
          if (event.target !== inputRef.current) {
            event.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        <IconSearch />
        <span className="sep-search-input-wrap">
          <input
            ref={inputRef}
            className="sep-search-input"
            type="search"
            placeholder={placeholder}
            aria-label="Search entries"
            role="combobox"
            aria-expanded={open}
            aria-controls={RESULTS_ID}
            aria-autocomplete="list"
            aria-activedescendant={open ? activeOptionId : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onFocus={onOpen}
            onChange={(event) => {
              setQuery(event.target.value);
              onOpen();
            }}
            onKeyDown={onKeyDown}
          />
          <AnimatedPlaceholder text={placeholder} hidden={Boolean(query)} />
        </span>
        {query ? (
          <button
            type="button"
            className="sep-search-clear"
            aria-label="Clear search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
              onOpen();
            }}
          >
            <IconClose />
          </button>
        ) : (
          <kbd className="sep-search-slash">/</kbd>
        )}
      </div>

      <Popover
        open={open}
        align="center"
        variant="menu"
        role="group"
        ariaLabel="Search results"
        onExited={() => {
          setActiveIndex(0);
          setLoadError(null);
        }}
      >
        {/* Never stack loading above related rows — that shifts the list on first open. */}
        {loading && !entries && rows.length === 0 ? (
          <div className="sep-popover-message">Loading titles…</div>
        ) : null}
        {!loading && loadError && rows.length === 0 ? (
          <div className="sep-popover-message">{loadError}</div>
        ) : null}
        {!loading && !loadError && !trimmed && rows.length === 0 ? (
          <div className="sep-popover-message">Type to search by title</div>
        ) : null}

        {rows.length > 0 ? (
          <ul
            ref={listRef}
            id={RESULTS_ID}
            className="sep-search-results"
            role="listbox"
            aria-label={
              trimmed || emptyTrimmed ? 'Search results' : suggestionsLabel
            }
          >
            {rows.map((row, index) => (
              <li
                key={row.kind === 'entry' ? row.entry.href : 'search-fallback'}
                role="presentation"
              >
                <button
                  id={`${RESULTS_ID}-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === activeIndex}
                  className={[
                    'sep-menu-item',
                    row.kind === 'search' ? 'sep-menu-item--muted' : '',
                    index === activeIndex ? 'is-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) =>
                    navigateTo(
                      rowHref(row),
                      onClose,
                      event.metaKey || event.ctrlKey
                    )
                  }
                >
                  {row.kind === 'entry'
                    ? formatEntryTitle(row.entry.title, row.entry.href)
                    : `Search for “${row.query}”`}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Popover>
    </div>
  );
}
