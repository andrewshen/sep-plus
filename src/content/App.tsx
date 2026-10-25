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
import { AnnotationMarks } from './annotations/AnnotationMarks';
import { HighlightMenu } from './annotations/HighlightMenu';
import { MarginNotePopover } from './annotations/MarginNotePopover';
import { SelectionToolbar } from './annotations/SelectionToolbar';
import { useAnnotations } from './annotations/useAnnotations';
import { BibliographyPreview } from './citations/BibliographyPreview';
import { useBibliographyCitations } from './citations/useBibliographyCitations';
import { FootnotePreviewBody } from './footnotes/FootnotePreviewBody';
import { useFootnotePreview } from './footnotes/useFootnotePreview';
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
const FOOTNOTE_PREVIEW_GAP_PX = 12;

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
    onPreviewOpen: () => {
      annotationState.dismissSelection();
      footnoteState.dismiss();
    },
  });
  const footnoteState = useFootnotePreview({
    enabled: articleMode,
    paletteOpen,
    sidebarPhase,
    onPreviewOpen: () => {
      annotationState.dismissSelection();
      citationState.dismiss();
    },
  });
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
    if (annotationState.pendingSelection || annotationState.activeAnnotation) {
      citationState.dismiss();
      footnoteState.dismiss();
    }
  }, [
    annotationState.activeAnnotation,
    annotationState.pendingSelection,
    citationState.dismiss,
    footnoteState.dismiss,
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
        onScrollToAnnotation={annotationState.scrollToAnnotation}
        onUpdateAnnotation={annotationState.updateAnnotation}
        onDeleteAnnotation={annotationState.deleteAnnotation}
        onExportAnnotations={annotationState.exportAnnotations}
      />
      <AnnotationMarks
        ranges={annotationState.markedRanges}
        emphasizedIds={annotationState.emphasizedIds}
        host={annotationState.articleRoot}
      />
      <SelectionToolbar
        selection={annotationState.pendingSelection}
        dark={dark}
        onHighlight={annotationState.createHighlight}
        onDismiss={annotationState.dismissSelection}
      />
      <HighlightMenu
        highlight={
          activeNote && annotationState.activeAnnotation
            ? {
                id: activeNote.id,
                note: activeNote.note,
                rect: annotationState.activeAnnotation.rect,
              }
            : null
        }
        dark={dark}
        onSaveNote={(id, note) => annotationState.updateAnnotation(id, { note })}
        onRemove={annotationState.deleteAnnotation}
        onDismiss={annotationState.dismissSelection}
      />
      <MarginNotePopover
        open={citationState.active !== null}
        anchorRect={citationState.active?.rect ?? null}
        motion={citationState.active?.motion}
        body={
          citationState.active ? (
            <BibliographyPreview entries={citationState.active.entries} />
          ) : null
        }
        dark={dark}
        ariaLabel="Bibliography citation preview"
        role="note"
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
      <MarginNotePopover
        open={footnoteState.active !== null}
        anchorRect={footnoteState.active?.rect ?? null}
        motion={footnoteState.active?.motion}
        gap={FOOTNOTE_PREVIEW_GAP_PX}
        label="Footnote"
        body={
          footnoteState.active ? (
            <FootnotePreviewBody
              noteKey={footnoteState.active.key}
              render={footnoteState.active.render}
            />
          ) : null
        }
        dark={dark}
        ariaLabel="Footnote"
        role="note"
        footnotePreview
        className="sep-footnote-preview"
        onDismiss={footnoteState.dismiss}
        onPointerEnter={footnoteState.previewPointerEnter}
        onPointerLeave={footnoteState.previewPointerLeave}
        onFocusCapture={footnoteState.previewFocusEnter}
        onBlurCapture={(event) => {
          const next = event.relatedTarget;
          if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
            footnoteState.previewFocusLeave();
          }
        }}
      />
    </div>
  );
}
