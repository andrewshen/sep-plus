import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { smoothScrollToHref } from '../../host/toc';
import type { TocItem } from '../../lib/types';

type OutlineProps = {
  items: TocItem[];
  /** Index into `items` of the deepest heading scrolled past. */
  activeIndex: number;
};

type OutlineEntry = { item: TocItem; index: number };

export function Outline({ items, activeIndex }: OutlineProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });

  const entries = useMemo((): OutlineEntry[] => {
    const all = items.map((item, index) => ({ item, index }));
    const topLevel = all.filter(({ item }) => item.level === 1);
    return topLevel.length ? topLevel : all;
  }, [items]);

  const activeEntry = useMemo(() => {
    let active = 0;
    entries.forEach((entry, position) => {
      if (entry.index <= activeIndex) {
        active = position;
      }
    });
    return active;
  }, [entries, activeIndex]);

  const updateFades = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const maxScroll = panel.scrollHeight - panel.clientHeight;
    const canScroll = maxScroll > 1;
    setFade({
      top: canScroll && panel.scrollTop > 1,
      bottom: canScroll && panel.scrollTop < maxScroll - 1,
    });
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const row = panel?.querySelector<HTMLElement>(
      `[data-position="${activeEntry}"]`,
    );
    if (panel && row) {
      if (row.offsetTop < panel.scrollTop) {
        panel.scrollTop = row.offsetTop;
      } else if (
        row.offsetTop + row.offsetHeight >
        panel.scrollTop + panel.clientHeight
      ) {
        panel.scrollTop = row.offsetTop + row.offsetHeight - panel.clientHeight;
      }
    }
    updateFades();
  }, [activeEntry, updateFades]);

  useEffect(() => {
    window.addEventListener('resize', updateFades);
    return () => window.removeEventListener('resize', updateFades);
  }, [updateFades]);

  if (!entries.length) {
    return null;
  }

  return (
    <nav
      className={[
        'sep-outline',
        fade.top ? 'has-fade-top' : '',
        fade.bottom ? 'has-fade-bottom' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Table of contents"
    >
      <div className="sep-outline-rail" aria-hidden="true">
        {entries.map(({ item }, position) => (
          <span
            key={item.href}
            className={[
              'sep-outline-tick',
              position === activeEntry ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>
      <div className="sep-outline-panel" ref={panelRef} onScroll={updateFades}>
        {entries.map(({ item }, position) => (
          <button
            key={item.href}
            type="button"
            data-position={position}
            className={[
              'sep-outline-link',
              position === activeEntry ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={position === activeEntry ? 'location' : undefined}
            onClick={(event) => {
              smoothScrollToHref(item.href);
              // Drop focus so :focus-within doesn't keep the panel open.
              event.currentTarget.blur();
            }}
          >
            {item.text}
          </button>
        ))}
      </div>
    </nav>
  );
}
