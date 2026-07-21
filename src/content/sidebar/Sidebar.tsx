import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SidebarSurface, ThemePreference, TocItem } from '../../lib/types';
import { setTheme } from '../../lib/storage';
import { IconSearch } from '../icons';
import { Palette } from '../palette/Palette';
import { ContentsTab } from './ContentsTab';

type SidebarProps = {
  items: TocItem[];
  activeIndex: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  paletteOpen: boolean;
  onOpenPalette: () => void;
  onClosePalette: () => void;
  dark: boolean;
  initialTheme: ThemePreference;
};

type TogglePhase = 'idle' | 'area' | 'target' | 'pressed';

const SIDEBAR_TOGGLE_TRANSITION_MS = 200;
const SIDEBAR_TOGGLE_FALLBACK_MS = SIDEBAR_TOGGLE_TRANSITION_MS + 100;

function IconAnnotations() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <path
        transform="translate(2.5 4.38)"
        d="M0.322 10.005C0.249 10.067 0.16 10.106 0.066 10.119-0.029 10.131-0.124 10.117-0.21 10.077-0.297 10.037-0.37 9.973-0.421 9.893-0.473 9.812-0.5 9.719-0.5 9.624-0.5 9.624-0.5-0.376-0.5-0.376-0.5-0.509-0.447-0.636-0.353-0.73-0.26-0.823-0.133-0.876 0-0.876 0-0.876 11-0.876 11-0.876 11.133-0.876 11.26-0.823 11.354-0.73 11.447-0.636 11.5-0.509 11.5-0.376 11.5-0.376 11.5 7.624 11.5 7.624 11.5 7.757 11.447 7.884 11.354 7.977 11.26 8.071 11.133 8.124 11 8.124 11 8.124 2.5 8.124 2.5 8.124 2.5 8.124 0.322 10.005 0.322 10.005Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 7h4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M6 9h4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <circle cx="6.5" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle
        cx="10.5"
        cy="11"
        r="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M8 5h5.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M2.5 5H5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M12 11h1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M2.5 11H9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg
      className="sep-appearance-chevron"
      viewBox="0 0 12 12"
      aria-hidden="true"
      fill="none"
    >
      <polyline
        points="9.75 4.5 6 8.25 2.25 4.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Sidebar({
  items,
  activeIndex,
  collapsed,
  onToggleCollapsed,
  paletteOpen,
  onOpenPalette,
  onClosePalette,
  dark,
  initialTheme,
}: SidebarProps) {
  const [surface, setSurface] = useState<SidebarSurface>('toc');
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme);
  const [searchActive, setSearchActive] = useState(paletteOpen);
  const [togglePhase, setTogglePhase] = useState<TogglePhase>('idle');
  const [pressedFromCollapsed, setPressedFromCollapsed] = useState(collapsed);
  const toggleResetTimerRef = useRef<number | null>(null);
  const searchSlotRef = useRef<HTMLDivElement>(null);
  const logoSrc = chrome.runtime.getURL(
    dark ? 'sep-logo-white.png' : 'sep-logo.png',
  );

  useEffect(() => {
    if (paletteOpen) {
      setSearchActive(true);
      return;
    }
    const timer = window.setTimeout(() => setSearchActive(false), 150);
    return () => window.clearTimeout(timer);
  }, [paletteOpen]);

  useEffect(
    () => () => {
      if (toggleResetTimerRef.current !== null) {
        window.clearTimeout(toggleResetTimerRef.current);
      }
    },
    [],
  );

  function finishToggleTransition(): void {
    if (toggleResetTimerRef.current !== null) {
      window.clearTimeout(toggleResetTimerRef.current);
      toggleResetTimerRef.current = null;
    }
    setTogglePhase('idle');
  }

  function handleToggleCollapsed(): void {
    if (togglePhase === 'pressed') {
      return;
    }
    setPressedFromCollapsed(collapsed);
    setTogglePhase('pressed');
    toggleResetTimerRef.current = window.setTimeout(
      finishToggleTransition,
      SIDEBAR_TOGGLE_FALLBACK_MS,
    );
    onToggleCollapsed();
  }

  const togglePointsRight =
    togglePhase === 'pressed' ? pressedFromCollapsed : collapsed;

  return (
    <>
      <aside
        className={[
          'sep-sidebar',
          collapsed ? 'is-collapsed' : '',
          searchActive ? 'is-searching' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="SEP+ sidebar"
      >
        <div className="sep-logo-row">
          <div className="sep-logo-mark">
            <img
              className="sep-logo"
              src={logoSrc}
              alt="SEP+"
              width={18}
              height={28}
            />
          </div>
        </div>

        <div className="sep-search-slot" ref={searchSlotRef}>
          <button
            type="button"
            className={[
              'sep-search-trigger',
              searchActive ? 'is-placeholder' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label="Open search"
            aria-hidden={searchActive || undefined}
            tabIndex={searchActive ? -1 : undefined}
            onClick={onOpenPalette}
          >
            <IconSearch />
            <span className="sep-search-trigger-label">Search</span>
            <kbd className="sep-search-slash">/</kbd>
          </button>
          <Palette
            open={paletteOpen}
            onClose={onClosePalette}
            anchorRef={searchSlotRef}
            dark={dark}
          />
        </div>

        <div className="sep-sidebar-main">
          <nav className="sep-nav" aria-label="SEP+">
            <button
              type="button"
              className={[
                'sep-nav-item',
                surface === 'annotations' ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={surface === 'annotations' ? 'page' : undefined}
              onClick={() =>
                setSurface((current) =>
                  current === 'annotations' ? 'toc' : 'annotations',
                )
              }
            >
              <span className="sep-nav-icon">
                <IconAnnotations />
              </span>
              <span className="sep-nav-label">Annotations</span>
            </button>
            <button
              type="button"
              className={[
                'sep-nav-item',
                surface === 'settings' ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={surface === 'settings' ? 'page' : undefined}
              onClick={() =>
                setSurface((current) =>
                  current === 'settings' ? 'toc' : 'settings',
                )
              }
            >
              <span className="sep-nav-icon">
                <IconSettings />
              </span>
              <span className="sep-nav-label">Settings</span>
            </button>
          </nav>

          <div className="sep-sidebar-body">
            {surface === 'toc' ? (
              <ContentsTab items={items} activeIndex={activeIndex} />
            ) : null}
            {surface === 'annotations' ? (
              <div className="sep-stub">Annotations coming soon.</div>
            ) : null}
            {surface === 'settings' ? (
              <div className="sep-stub">Settings coming soon.</div>
            ) : null}
          </div>
        </div>

        <div className="sep-sidebar-footer">
          <div className="sep-footer-links">
            <a href="../../contents.html">Browse</a>
            <a href="../../about.html">About</a>
            <a href="../../support/">Support</a>
          </div>
          <label className="sep-appearance">
            <span className="sep-appearance-label">Appearance</span>
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
            <IconChevron />
          </label>
        </div>
      </aside>

      {createPortal(
        <div
          className={['sep-sidebar-toggle', collapsed ? 'is-collapsed' : '']
            .filter(Boolean)
            .join(' ')}
          data-phase={togglePhase}
          data-direction={togglePointsRight ? 'right' : 'left'}
          onMouseEnter={() => {
            if (togglePhase !== 'pressed') {
              setTogglePhase('area');
            }
          }}
          onMouseLeave={() => {
            if (togglePhase === 'area' || togglePhase === 'target') {
              setTogglePhase('idle');
            }
          }}
          onTransitionEnd={(event) => {
            if (
              togglePhase === 'pressed' &&
              event.target === event.currentTarget &&
              event.propertyName === 'transform'
            ) {
              finishToggleTransition();
            }
          }}
        >
          <button
            type="button"
            className="sep-sidebar-expander"
            aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            onClick={handleToggleCollapsed}
            onMouseEnter={() => {
              if (togglePhase !== 'pressed') {
                setTogglePhase('target');
              }
            }}
            onMouseLeave={() => {
              if (togglePhase === 'target') {
                setTogglePhase('area');
              }
            }}
            onFocus={() => {
              if (togglePhase !== 'pressed') {
                setTogglePhase('target');
              }
            }}
            onBlur={() => {
              if (togglePhase === 'target') {
                setTogglePhase('idle');
              }
            }}
          >
            <span className="sep-expander top" />
            <span className="sep-expander bottom" />
          </button>
        </div>,
        document.getElementById('sep-plus-edge-toggle') ?? document.body,
      )}
    </>
  );
}
