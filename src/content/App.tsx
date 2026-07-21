import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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

type SidebarPhase =
  | 'closed'
  | 'opening'
  | 'open'
  | 'closing-ready'
  | 'closing';

const SIDEBAR_TRANSITION_MS = 150;
const SIDEBAR_TRANSITION_FALLBACK_MS = SIDEBAR_TRANSITION_MS + 100;

function syncSidebarPhase(phase: SidebarPhase): void {
  document.documentElement.dataset.sepPlusSidebarPhase = phase;
  document.body.dataset.sepPlusSidebarPhase = phase;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function App({
  items,
  initialCollapsed,
  initialTheme,
}: AppProps) {
  const [sidebarPhase, setSidebarPhase] = useState<SidebarPhase>(
    initialCollapsed ? 'closed' : 'open'
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dark, setDark] = useState(() =>
    document.body.classList.contains('dark')
  );
  const prepareFrameRef = useRef<number | null>(null);
  const startFrameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    syncSidebarPhase(sidebarPhase);
  }, [sidebarPhase]);

  useEffect(
    () => () => {
      if (prepareFrameRef.current !== null) {
        window.cancelAnimationFrame(prepareFrameRef.current);
      }
      if (startFrameRef.current !== null) {
        window.cancelAnimationFrame(startFrameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (sidebarPhase !== 'opening' && sidebarPhase !== 'closing') {
      return;
    }

    const container = document.getElementById('container');
    const stablePhase = sidebarPhase === 'opening' ? 'open' : 'closed';
    let finished = false;

    function finish(): void {
      if (finished) {
        return;
      }
      finished = true;
      setSidebarPhase(stablePhase);
    }

    function onTransitionEnd(event: TransitionEvent): void {
      if (event.target === container && event.propertyName === 'transform') {
        finish();
      }
    }

    container?.addEventListener('transitionend', onTransitionEnd);
    const fallback = window.setTimeout(
      finish,
      SIDEBAR_TRANSITION_FALLBACK_MS
    );
    return () => {
      container?.removeEventListener('transitionend', onTransitionEnd);
      window.clearTimeout(fallback);
    };
  }, [sidebarPhase]);

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

  function toggleSidebar(): void {
    if (
      sidebarPhase === 'opening' ||
      sidebarPhase === 'closing-ready' ||
      sidebarPhase === 'closing'
    ) {
      return;
    }

    const opening = sidebarPhase === 'closed';
    writeSidebarCollapsed(!opening);

    if (prefersReducedMotion()) {
      setSidebarPhase(opening ? 'open' : 'closed');
      return;
    }

    if (opening) {
      setSidebarPhase('opening');
      return;
    }

    setSidebarPhase('closing-ready');
    prepareFrameRef.current = window.requestAnimationFrame(() => {
      prepareFrameRef.current = null;
      startFrameRef.current = window.requestAnimationFrame(() => {
        startFrameRef.current = null;
        setSidebarPhase('closing');
      });
    });
  }

  const sidebarCollapsed =
    sidebarPhase === 'closed' || sidebarPhase === 'closing';

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
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        paletteOpen={paletteOpen}
        onOpenPalette={openPalette}
        onClosePalette={closePalette}
        dark={dark}
        initialTheme={initialTheme}
      />
    </div>
  );
}
