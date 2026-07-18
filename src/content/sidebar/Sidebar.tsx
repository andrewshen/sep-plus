import { useEffect, useState } from 'react';
import type { SidebarTab, ThemePreference, TocItem } from '../../lib/types';
import { getTheme, setTheme } from '../../lib/storage';
import { ContentsTab } from './ContentsTab';

type SidebarProps = {
  items: TocItem[];
  activeIndex: number;
  collapsed: boolean;
  dark: boolean;
  onToggleCollapsed: () => void;
  onOpenPalette: () => void;
};

function IconContents() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2 3.5h12v1.25H2V3.5zm0 4h12v1.25H2V7.5zm0 4h8V12.75H2V11.5z"
      />
    </svg>
  );
}

function IconHighlight() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.2 1.8a1.5 1.5 0 0 1 2.1 2.1l-7.4 7.4-.9 2.2 2.2-.9 7.4-7.4a1.5 1.5 0 0 0-2.1-2.1L3.9 10.7l-.5 1.9 1.9-.5L12.2 1.8zM2 13.25h7v1.25H2v-1.25z"
      />
    </svg>
  );
}

function IconNotes() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 2.5h7.5L13 5v8.5H3V2.5zm7.25.6v2.15H12.3L10.25 3.1zM5 7h6v1.2H5V7zm0 2.5h6V10.7H5V9.5zm0 2.5h4v1.2H5V12z"
      />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.8 2.5a4.3 4.3 0 1 1 2.7 7.65l2.7 2.7-.9.9-2.75-2.75A4.3 4.3 0 0 1 6.8 2.5zm0 1.25a3.05 3.05 0 1 0 0 6.1 3.05 3.05 0 0 0 0-6.1z"
      />
    </svg>
  );
}

function IconCollapse() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.8 3.2 5 8l4.8 4.8.9-.9L6.8 8l3.9-3.9-.9-.9z"
      />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.2 3.2 11 8l-4.8 4.8-.9-.9L9.2 8 5.3 4.1l.9-.9z"
      />
    </svg>
  );
}

export function Sidebar({
  items,
  activeIndex,
  collapsed,
  dark,
  onToggleCollapsed,
  onOpenPalette,
}: SidebarProps) {
  const [tab, setTab] = useState<SidebarTab>('contents');
  const [theme, setThemeState] = useState<ThemePreference>('light');

  useEffect(() => {
    void getTheme().then(setThemeState);
  }, []);

  return (
    <>
      <aside
        className={['sep-sidebar', collapsed ? 'is-collapsed' : '']
          .filter(Boolean)
          .join(' ')}
        aria-label="SEP+ sidebar"
      >
        <div className="sep-sidebar-header">
          <div className="sep-logo" aria-hidden="true" />
          <div className="sep-tabs" role="tablist" aria-label="Sidebar tabs">
            <button
              type="button"
              className={['sep-tab', tab === 'contents' ? 'is-active' : '']
                .filter(Boolean)
                .join(' ')}
              role="tab"
              aria-selected={tab === 'contents'}
              onClick={() => setTab('contents')}
            >
              <IconContents />
              <span className="sep-tab-label">Contents</span>
            </button>
            <button
              type="button"
              className="sep-tab"
              role="tab"
              aria-selected={false}
              disabled
              title="Coming soon"
            >
              <IconHighlight />
            </button>
            <button
              type="button"
              className="sep-tab"
              role="tab"
              aria-selected={false}
              disabled
              title="Coming soon"
            >
              <IconNotes />
            </button>
          </div>
          <button
            type="button"
            className="sep-icon-btn"
            aria-label="Open search"
            onClick={onOpenPalette}
          >
            <IconSearch />
          </button>
          <button
            type="button"
            className="sep-icon-btn sep-sidebar-collapse"
            aria-label="Collapse sidebar"
            onClick={onToggleCollapsed}
          >
            <IconCollapse />
          </button>
        </div>

        <div className="sep-sidebar-body" role="tabpanel">
          {tab === 'contents' ? (
            <ContentsTab items={items} activeIndex={activeIndex} />
          ) : null}
          {tab === 'highlights' ? (
            <div className="sep-stub">Highlights coming soon.</div>
          ) : null}
          {tab === 'notes' ? (
            <div className="sep-stub">Notes coming soon.</div>
          ) : null}
        </div>

        <div className="sep-sidebar-footer">
          <div className="sep-footer-links">
            <a href="../../contents.html">Browse</a>
            <a href="../../about.html">About</a>
            <a href="../../support/">Support</a>
          </div>
          <label className="sep-appearance">
            <span className="visually-hidden" style={{ display: 'none' }}>
              Appearance
            </span>
            <select
              aria-label="Appearance"
              value={theme}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'light' || value === 'dark' || value === 'auto') {
                  setThemeState(value);
                  void setTheme(value);
                }
              }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">System</option>
            </select>
          </label>
        </div>
      </aside>

      <button
        type="button"
        className={[
          'sep-collapse-fab',
          collapsed ? 'is-visible' : '',
          dark ? 'is-dark' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Expand sidebar"
        onClick={onToggleCollapsed}
      >
        <IconExpand />
      </button>
    </>
  );
}
