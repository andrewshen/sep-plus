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
import { IconSearch } from '../icons';
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

export function Search({
  variant = 'header',
  suggestions,
  suggestionsLabel = 'Related entries',
  open,
  onOpen,
  onClose,
}: SearchProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const prefetchedUrlsRef = useRef(new Set<string>());
  const [query, setQuery] = useState('');
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

  useEffect(() => {
    if (!open || entries) {
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
            setLoadError('Could not load entry titles');
            setEntries([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, POPOVER_EXIT_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, entries]);

  const trimmed = query.trim();
  const matches = useMemo(
    () => (entries ? filterEntries(entries, query, related) : []),
    [entries, query, related]
  );
  const rows = useMemo((): SearchRow[] => {
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
    if (!open) {
      return;
    }
    const row = rows[activeIndex];
    const url = row ? prefetchableUrl(rowHref(row)) : null;
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
  }, [open, rows, activeIndex]);

  useEffect(() => {
    if (!open || !listRef.current) {
      return;
    }
    listRef.current
      .querySelector<HTMLElement>('[role="option"][aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (!open) {
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
    <div className={`sep-search sep-search--${variant}`} ref={anchorRef}>
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
        <input
          ref={inputRef}
          className="sep-search-input"
          type="search"
          placeholder="Search"
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
        <kbd className="sep-search-slash">/</kbd>
      </div>

      <Popover
        open={open}
        align="center"
        variant="menu"
        role="group"
        ariaLabel="Search results"
        onExited={() => {
          setQuery('');
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
            aria-label={trimmed ? 'Search results' : suggestionsLabel}
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
