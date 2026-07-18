import { useCallback, useEffect, useState } from 'react';
import type { TocItem } from '../lib/types';
import {
  getActiveTocIndex,
  identifyPrintBlock,
} from '../host/toc';
import { Sidebar } from './sidebar/Sidebar';
import { Palette } from './palette/Palette';

type AppProps = {
  items: TocItem[];
};

const SIDEBAR_COLLAPSED_KEY = 'sepPlusSidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Ignore.
  }
}

function syncSidebarOpenClass(collapsed: boolean): void {
  const open = !collapsed;
  document.documentElement.classList.toggle('sep-plus-sidebar-open', open);
  document.body.classList.toggle('sep-plus-sidebar-open', open);
}

export function App({ items }: AppProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dark, setDark] = useState(() =>
    document.body.classList.contains('dark')
  );

  useEffect(() => {
    syncSidebarOpenClass(collapsed);
    writeCollapsed(collapsed);
  }, [collapsed]);

  useEffect(() => {
    function updateActive() {
      identifyPrintBlock();
      setActiveIndex(getActiveTocIndex(items));
    }
    updateActive();
    window.addEventListener('scroll', updateActive, { passive: true });
    window.addEventListener('resize', updateActive);
    return () => {
      window.removeEventListener('scroll', updateActive);
      window.removeEventListener('resize', updateActive);
    };
  }, [items]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.body.classList.contains('dark'));
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isPaletteShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isPaletteShortcut) {
        return;
      }
      event.preventDefault();
      setPaletteOpen((open) => !open);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={['sep-plus-app', dark ? 'is-dark' : ''].filter(Boolean).join(' ')}>
      <Sidebar
        items={items}
        activeIndex={activeIndex}
        collapsed={collapsed}
        dark={dark}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        onOpenPalette={openPalette}
      />
      <Palette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}
