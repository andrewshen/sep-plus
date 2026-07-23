import { useEffect, useRef } from 'react';
import type { SiteNavSection, TocItem } from '../../lib/types';
import { smoothScrollToHref } from '../../host/toc';

type ContentsTabProps = {
  items: TocItem[];
  activeIndex: number;
  siteNav?: SiteNavSection[];
};

function isCurrentPage(href: string): boolean {
  try {
    const url = new URL(href, location.href);
    return (
      url.origin === location.origin &&
      url.pathname.replace(/\/+$/, '') ===
        location.pathname.replace(/\/+$/, '')
    );
  } catch {
    return false;
  }
}

export function ContentsTab({
  items,
  activeIndex,
  siteNav,
}: ContentsTabProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list || activeIndex < 0 || siteNav?.length) {
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
  }, [activeIndex, siteNav]);

  if (siteNav?.length) {
    return (
      <div className="sep-toc-scroll" ref={listRef}>
        {siteNav.map((section) => (
          <div key={section.title} className="sep-site-nav-section">
            <div className="sep-contents-label">{section.title}</div>
            {section.links.map((link) => (
              <a
                key={`${section.title}-${link.href}`}
                href={link.href}
                className={[
                  'sep-toc-link',
                  isCurrentPage(link.href) ? 'is-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {link.text}
              </a>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return <div className="sep-stub">No contents on this page.</div>;
  }

  return (
    <div className="sep-toc-scroll" ref={listRef}>
      <div className="sep-contents-label">Contents</div>
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
