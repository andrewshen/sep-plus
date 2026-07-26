import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { writeSidebarCollapsed } from '../lib/storage';
import type {
  SiteNavSection,
  ThemePreference,
  TocItem,
} from '../lib/types';
import { getActiveTocIndex, identifyPrintBlock } from '../host/toc';
import { formatRelativeAnnotationTime } from '../lib/marginNotePlacement';
import { MarginNotePopover } from './annotations/MarginNotePopover';
import { SelectionToolbar } from './annotations/SelectionToolbar';
import { useAnnotations } from './annotations/useAnnotations';
import { BibliographyPreview } from './citations/BibliographyPreview';
import { useBibliographyCitations } from './citations/useBibliographyCitations';
import { Sidebar } from './sidebar/Sidebar';

type AppProps = {
  items: TocItem[];
  siteNav?: SiteNavSection[];
  initialCollapsed: boolean;
  initialTheme: ThemePreference;
  articleMode: boolean;
  articleSource?: string;
  articleTitle: string;
};

type SidebarPhase = 'closed' | 'opening' | 'open' | 'closing-ready' | 'closing';

const SIDEBAR_TRANSITION_MS = 200;
const SIDEBAR_TRANSITION_FALLBACK_MS = SIDEBAR_TRANSITION_MS + 100;

function bibliographyPreviewLabel(sections: readonly string[]): string {
  const unique = new Set(sections);
  if (unique.size !== 1) {
    return 'Bibliography';
  }
  const section = sections[0]?.trim();
  return section && section.toLocaleLowerCase() !== 'bibliography'
    ? `Bibliography · ${section}`
    : 'Bibliography';
}

function syncSidebarPhase(phase: SidebarPhase): void {
  document.documentElement.dataset.sepPlusSidebarPhase = phase;
  document.body.dataset.sepPlusSidebarPhase = phase;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function App({
  items,
  siteNav,
  initialCollapsed,
  initialTheme,
  articleMode,
  articleSource,
  articleTitle,
}: AppProps) {
  const [sidebarPhase, setSidebarPhase] = useState<SidebarPhase>(
    initialCollapsed ? 'closed' : 'open',
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dark, setDark] = useState(() =>
    document.body.classList.contains('dark'),
  );
  const prepareFrameRef = useRef<number | null>(null);
  const startFrameRef = useRef<number | null>(null);
  const annotationState = useAnnotations({
    enabled: articleMode && Boolean(articleSource),
    source: articleSource,
    pageTitle: articleTitle,
    paletteOpen,
    sidebarPhase,
  });
  const citationState = useBibliographyCitations({
    enabled: articleMode,
    paletteOpen,
    sidebarPhase,
    onPreviewOpen: annotationState.dismissSelection,
  });
  const [deletingAnnotation, setDeletingAnnotation] = useState(false);
  const activeNote = useMemo(() => {
    const activeId = annotationState.activeAnnotation?.annotationId;
    if (!activeId) {
      return null;
    }
    return (
      annotationState.annotations.find(
        (annotation) => annotation.id === activeId,
      ) ?? null
    );
  }, [annotationState.activeAnnotation?.annotationId, annotationState.annotations]);

  useLayoutEffect(() => {
    syncSidebarPhase(sidebarPhase);
  }, [sidebarPhase]);

  useEffect(() => {
    setDeletingAnnotation(false);
  }, [annotationState.activeAnnotation?.key]);

  useEffect(() => {
    if (annotationState.pendingSelection || annotationState.activeAnnotation) {
      citationState.dismiss();
    }
  }, [
    annotationState.activeAnnotation,
    annotationState.pendingSelection,
    citationState.dismiss,
  ]);

  useEffect(
    () => () => {
      if (prepareFrameRef.current !== null) {
        window.cancelAnimationFrame(prepareFrameRef.current);
      }
      if (startFrameRef.current !== null) {
        window.cancelAnimationFrame(startFrameRef.current);
      }
    },
    [],
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
    const fallback = window.setTimeout(finish, SIDEBAR_TRANSITION_FALLBACK_MS);
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
    <div
      className={['sep-plus-app', dark ? 'is-dark' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <Sidebar
        items={items}
        siteNav={siteNav}
        activeIndex={activeIndex}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        paletteOpen={paletteOpen}
        onOpenPalette={openPalette}
        onClosePalette={closePalette}
        dark={dark}
        initialTheme={initialTheme}
        annotations={annotationState.annotations}
        annotationsLoading={annotationState.loading}
        annotationsError={annotationState.error}
        highlightSupported={annotationState.highlightSupported}
        onScrollToAnnotation={annotationState.scrollToAnnotation}
        onUpdateAnnotation={annotationState.updateAnnotation}
        onDeleteAnnotation={annotationState.deleteAnnotation}
        onExportAnnotations={annotationState.exportAnnotations}
      />
      <SelectionToolbar
        selection={annotationState.pendingSelection}
        dark={dark}
        onSave={annotationState.saveSelection}
        onDismiss={annotationState.dismissSelection}
      />
      {annotationState.activeAnnotation && activeNote ? (
        <MarginNotePopover
          anchorRect={annotationState.activeAnnotation.rect}
          label={`Private note · ${formatRelativeAnnotationTime(activeNote.updatedAt)}`}
          body={activeNote.note.trim() ? activeNote.note : undefined}
          actionLabel={deletingAnnotation ? 'Deleting…' : 'Delete'}
          actionDisabled={deletingAnnotation}
          dark={dark}
          ariaLabel="Private note"
          onDismiss={annotationState.dismissSelection}
          onAction={() => {
            if (deletingAnnotation) {
              return;
            }
            setDeletingAnnotation(true);
            void annotationState
              .deleteAnnotation(activeNote.id)
              .catch(() => {
                setDeletingAnnotation(false);
              });
          }}
        />
      ) : null}
      {citationState.active ? (
        <MarginNotePopover
          key={citationState.active.key}
          anchorRect={citationState.active.rect}
          label={bibliographyPreviewLabel(
            citationState.active.entries.map((entry) => entry.section),
          )}
          body={
            <BibliographyPreview entries={citationState.active.entries} />
          }
          dark={dark}
          ariaLabel="Bibliography citation preview"
          role="note"
          motion="pointer"
          bibliographyPreview
          className="sep-bibliography-popover"
          onDismiss={citationState.dismiss}
          onPointerEnter={citationState.previewPointerEnter}
          onPointerLeave={citationState.previewPointerLeave}
          onFocusCapture={citationState.previewFocusEnter}
          onBlurCapture={(event) => {
            const next = event.relatedTarget;
            if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
              citationState.previewFocusLeave();
            }
          }}
        />
      ) : null}
    </div>
  );
}
