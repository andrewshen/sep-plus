import { useEffect, useRef } from 'react';
import type { TocItem } from '../../lib/types';
import { smoothScrollToHref } from '../../host/toc';

type ContentsTabProps = {
  items: TocItem[];
  activeIndex: number;
};

export function ContentsTab({ items, activeIndex }: ContentsTabProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list || activeIndex < 0) {
      return;
    }
    const active = list.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    if (!active) {
      return;
    }
    const top = active.offsetTop;
    const bottom = top + active.offsetHeight;
    if (top < list.scrollTop) {
      list.scrollTop = top;
    } else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [activeIndex]);

  if (!items.length) {
    return <div className="sep-stub">No contents for this entry.</div>;
  }

  return (
    <div className="sep-toc-scroll" ref={listRef}>
      {items.map((item, index) => (
        <button
          key={`${item.href}-${index}`}
          type="button"
          data-index={index}
          className={[
            'sep-toc-link',
            `sep-toc-link--level-${item.level}`,
            index === activeIndex ? 'is-active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => {
            smoothScrollToHref(item.href);
          }}
        >
          {item.text}
        </button>
      ))}
    </div>
  );
}
