import { useEffect, useMemo, useState } from 'react';
import {
  onHighlightColorChanged,
  onThemeChanged,
  setHighlightColor as storeHighlightColor,
  setTheme as storeTheme,
} from '../lib/storage';
import type { HighlightColor, ThemePreference, TocItem } from '../lib/types';
import { getActiveTocIndex } from '../host/toc';
import { formatRelativeAnnotationTime } from '../lib/marginNotePlacement';
import { AnnotationMarks } from './annotations/AnnotationMarks';
import { MarginNotePopover } from './annotations/MarginNotePopover';
import { SelectionToolbar } from './annotations/SelectionToolbar';
import { useAnnotations } from './annotations/useAnnotations';
import { BibliographyPreview } from './citations/BibliographyPreview';
import { useBibliographyCitations } from './citations/useBibliographyCitations';
import { Header, type HeaderPopover } from './header/Header';
import { Outline } from './outline/Outline';

type AppProps = {
  items: TocItem[];
  initialTheme: ThemePreference;
  initialHighlightColor: HighlightColor;
  articleMode: boolean;
  articleSource?: string;
  articleTitle: string;
};

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

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT')
  );
}

export function App({
  items,
  initialTheme,
  initialHighlightColor,
  articleMode,
  articleSource,
  articleTitle,
}: AppProps) {
  const [openPopover, setOpenPopover] = useState<HeaderPopover | null>(null);
  const [theme, setTheme] = useState(initialTheme);
  const [highlightColor, setHighlightColor] = useState(initialHighlightColor);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dark, setDark] = useState(() =>
    document.body.classList.contains('dark'),
  );
  const popoverOpen = openPopover !== null;
  const annotationState = useAnnotations({
    enabled: articleMode && Boolean(articleSource),
    source: articleSource,
    pageTitle: articleTitle,
    popoverOpen,
  });
  const citationState = useBibliographyCitations({
    enabled: articleMode,
    popoverOpen,
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

  useEffect(() => {
    if (!articleMode) {
      return;
    }
    let frame: number | null = null;
    function scheduleUpdate() {
      if (frame !== null) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setActiveIndex(getActiveTocIndex(items));
      });
    }
    setActiveIndex(getActiveTocIndex(items));
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [articleMode, items]);

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

  useEffect(() => {
    const stopTheme = onThemeChanged(setTheme);
    const stopHighlight = onHighlightColorChanged(setHighlightColor);
    return () => {
      stopTheme();
      stopHighlight();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isSearchShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isSearchShortcut) {
        event.preventDefault();
        setOpenPopover((open) => (open === 'search' ? null : 'search'));
        return;
      }

      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        openPopover !== 'search' &&
        !isEditableTarget(event.composedPath()[0] ?? null)
      ) {
        event.preventDefault();
        setOpenPopover('search');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openPopover]);

  return (
    <div
      className={['sep-plus-app', dark ? 'is-dark' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <Header
        articleMode={articleMode}
        dark={dark}
        openPopover={openPopover}
        onOpenPopoverChange={setOpenPopover}
        theme={theme}
        onThemeChange={(next) => {
          setTheme(next);
          void storeTheme(next);
        }}
        highlightColor={highlightColor}
        onHighlightColorChange={(next) => {
          setHighlightColor(next);
          void storeHighlightColor(next);
        }}
        annotations={annotationState.annotations}
        annotationsLoading={annotationState.loading}
        annotationsError={annotationState.error}
        onScrollToAnnotation={annotationState.scrollToAnnotation}
        onExportAnnotations={annotationState.exportAnnotations}
      />
      {articleMode ? <Outline items={items} activeIndex={activeIndex} /> : null}
      <AnnotationMarks
        ranges={annotationState.markedRanges}
        emphasizedIds={annotationState.emphasizedIds}
        host={annotationState.articleRoot}
        color={highlightColor}
      />
      <SelectionToolbar
        selection={annotationState.pendingSelection}
        dark={dark}
        onSave={annotationState.saveSelection}
        onDismiss={annotationState.dismissSelection}
      />
      {annotationState.activeAnnotation &&
      activeNote &&
      !activeNote.note.trim() ? (
        <SelectionToolbar
          selection={annotationState.activeAnnotation}
          dark={dark}
          onSave={async (note) => {
            await annotationState.updateAnnotation(activeNote.id, { note });
            annotationState.dismissSelection();
          }}
          onRemove={() => annotationState.deleteAnnotation(activeNote.id)}
          onDismiss={annotationState.dismissSelection}
        />
      ) : null}
      {annotationState.activeAnnotation &&
      activeNote &&
      activeNote.note.trim() ? (
        <MarginNotePopover
          anchorRect={annotationState.activeAnnotation.rect}
          label={`Private note · ${formatRelativeAnnotationTime(activeNote.updatedAt)}`}
          body={activeNote.note}
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
          structuredBody
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
