import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { smoothScrollToHref } from '../../host/toc';
import type { TocItem } from '../../lib/types';

type OutlineProps = {
  items: TocItem[];
  /** Index into `items` of the deepest heading scrolled past. */
  activeIndex: number;
};

export function Outline({ items, activeIndex }: OutlineProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });
  const [overlapping, setOverlapping] = useState(false);
  const active = Math.min(Math.max(activeIndex, 0), items.length - 1);

  // Ticks pack tighter than labels, so the rail follows the panel by scroll
  // fraction rather than by pixel offset.
  const syncScroll = useCallback(() => {
    const panel = scrollRef.current;
    if (!panel) {
      return;
    }
    const maxScroll = panel.scrollHeight - panel.clientHeight;
    const rail = railRef.current;
    if (rail) {
      const railMax = rail.scrollHeight - rail.clientHeight;
      rail.scrollTop = maxScroll > 0 ? (panel.scrollTop / maxScroll) * railMax : 0;
    }
    const canScroll = maxScroll > 1;
    setFade({
      top: canScroll && panel.scrollTop > 1,
      bottom: canScroll && panel.scrollTop < maxScroll - 1,
    });
  }, []);

  // The open panel is opaque; once it reaches the reading column it covers
  // text, so it gets a border to read as a separate surface.
  const syncOverlap = useCallback(() => {
    const panel = panelRef.current;
    const nav = panel?.offsetParent;
    const content = document.querySelector(
      '#article-content, .sep-plus-content-column',
    );
    if (!panel || !nav || !content) {
      setOverlapping(false);
      return;
    }
    // Layout offsets, not the rect: the closed panel is nudged by a transform.
    const panelRight =
      nav.getBoundingClientRect().left + panel.offsetLeft + panel.offsetWidth;
    setOverlapping(panelRight > content.getBoundingClientRect().left);
  }, []);

  useLayoutEffect(() => {
    syncOverlap();
    window.addEventListener('resize', syncOverlap);
    return () => window.removeEventListener('resize', syncOverlap);
  }, [syncOverlap]);

  useLayoutEffect(() => {
    const panel = scrollRef.current;
    const row = panel?.querySelector<HTMLElement>(`[data-position="${active}"]`);
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
    syncScroll();
  }, [active, syncScroll]);

  useEffect(() => {
    window.addEventListener('resize', syncScroll);
    return () => window.removeEventListener('resize', syncScroll);
  }, [syncScroll]);

  if (!items.length) {
    return null;
  }

  return (
    <nav
      className={[
        'sep-outline',
        fade.top ? 'has-fade-top' : '',
        fade.bottom ? 'has-fade-bottom' : '',
        overlapping ? 'is-overlapping' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Table of contents"
    >
      <div className="sep-outline-rail" ref={railRef} aria-hidden="true">
        {items.map((item, position) => (
          <span
            key={item.href}
            className={[
              'sep-outline-tick',
              `sep-outline-tick--level-${item.level}`,
              position === active ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>
      <div className="sep-outline-panel" ref={panelRef}>
        <div
          className="sep-outline-panel-scroll"
          ref={scrollRef}
          onScroll={syncScroll}
        >
          {items.map((item, position) => (
            <button
              key={item.href}
              type="button"
              data-position={position}
              className={[
                'sep-outline-link',
                `sep-outline-link--level-${item.level}`,
                position === active ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={position === active ? 'location' : undefined}
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
      </div>
    </nav>
  );
}
