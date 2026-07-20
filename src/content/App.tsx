import { useCallback, useEffect, useState } from 'react';
import { writeSidebarCollapsed } from '../lib/storage';
import type { ThemePreference, TocItem } from '../lib/types';
import {
  getActiveTocIndex,
  identifyPrintBlock,
} from '../host/toc';
import { Sidebar } from './sidebar/Sidebar';

type AppProps = {
  items: TocItem[];
  initialCollapsed: boolean;
  initialTheme: ThemePreference;
};

function syncSidebarOpenClass(collapsed: boolean): void {
  const open = !collapsed;
  document.documentElement.classList.toggle('sep-plus-sidebar-open', open);
  document.body.classList.toggle('sep-plus-sidebar-open', open);
}

export function App({
  items,
  initialCollapsed,
  initialTheme,
}: AppProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dark, setDark] = useState(() =>
    document.body.classList.contains('dark')
  );

  useEffect(() => {
    syncSidebarOpenClass(collapsed);
    writeSidebarCollapsed(collapsed);
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
      if (isPaletteShortcut) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !paletteOpen
      ) {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT')
        ) {
          return;
        }
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen]);

  return (
    <div className={['sep-plus-app', dark ? 'is-dark' : ''].filter(Boolean).join(' ')}>
      <Sidebar
        items={items}
        activeIndex={activeIndex}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        paletteOpen={paletteOpen}
        onOpenPalette={openPalette}
        onClosePalette={closePalette}
        dark={dark}
        initialTheme={initialTheme}
      />
    </div>
  );
}
