import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  onHighlightColorChanged,
  onThemeChanged,
  setHighlightColor as storeHighlightColor,
  setTheme as storeTheme,
} from '../lib/storage';
import type { HighlightColor, ThemePreference, TocItem } from '../lib/types';
import { getActiveTocIndex } from '../host/toc';
import { AnnotationMarks } from './annotations/AnnotationMarks';
import { AnnotationPopover } from './annotations/AnnotationPopover';
import { MarginNotePopover } from './annotations/MarginNotePopover';
import { SelectionToolbar } from './annotations/SelectionToolbar';
import { useAnnotations } from './annotations/useAnnotations';
import { BibliographyPreview } from './citations/BibliographyPreview';
import { useBibliographyCitations } from './citations/useBibliographyCitations';
import { SiteFooter } from './footer/SiteFooter';
import { Header, type HeaderPopover } from './header/Header';
import { Search } from './header/SearchPopover';
import { SettingsMenu } from './header/SettingsMenu';
import { Homepage } from './home/Homepage';
import { Outline } from './outline/Outline';

type AppProps = {
  items: TocItem[];
  initialTheme: ThemePreference;
  initialHighlightColor: HighlightColor;
  articleMode: boolean;
  homeMode: boolean;
  articleSource?: string;
  articleTitle: string;
  entryCopyright?: HTMLElement | null;
};

function getFlowMount(id: string): HTMLElement | null {
  const host = document.getElementById(id);
  return host?.shadowRoot?.getElementById(`${id}-mount`) ?? null;
}

function flowAppClassName(dark: boolean, extra?: string): string {
  return ['sep-plus-app', 'sep-flow-app', extra, dark ? 'is-dark' : '']
    .filter(Boolean)
    .join(' ');
}

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
  homeMode,
  articleSource,
  articleTitle,
  entryCopyright = null,
}: AppProps) {
  const [openPopover, setOpenPopover] = useState<HeaderPopover | null>(null);
  const [homeMount] = useState(() =>
    homeMode ? getFlowMount('sep-plus-home') : null,
  );
  const [footerMount] = useState(() =>
    !homeMode ? getFlowMount('sep-plus-footer') : null,
  );
  const [searchMount] = useState(() =>
    !homeMode && !articleMode ? getFlowMount('sep-plus-search') : null,
  );
  const [searchQuery] = useState(
    () => new URLSearchParams(location.search).get('query')?.trim() ?? '',
  );
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
      {homeMode ? (
        <>
          {homeMount
            ? createPortal(
                <div className={flowAppClassName(dark)}>
                  <Homepage
                    searchOpen={openPopover === 'search'}
                    onSearchOpen={() => setOpenPopover('search')}
                    onSearchClose={() => setOpenPopover(null)}
                  />
                </div>,
                homeMount,
              )
            : null}
          {/* No header on the homepage; just its settings button, in place. */}
          <div className="sep-header-actions sep-home-actions">
            <SettingsMenu
              open={openPopover === 'settings'}
              onOpenChange={(next) => setOpenPopover(next ? 'settings' : null)}
              dark={dark}
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
              onExportAnnotations={annotationState.exportAnnotations}
            />
          </div>
        </>
      ) : (
        <Header
          articleMode={articleMode}
          showSearch={!searchMount}
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
      )}
      {searchMount
        ? createPortal(
            <div className={flowAppClassName(dark, 'sep-search-page')}>
              <Search
                variant="hero"
                initialQuery={searchQuery}
                open={openPopover === 'search'}
                onOpen={() => setOpenPopover('search')}
                onClose={() => setOpenPopover(null)}
              />
            </div>,
            searchMount,
          )
        : null}
      {footerMount
        ? createPortal(
            <div className={flowAppClassName(dark, 'sep-site-footer-page')}>
              <SiteFooter entryCopyright={entryCopyright} />
            </div>,
            footerMount,
          )
        : null}
      {articleMode ? <Outline items={items} activeIndex={activeIndex} /> : null}
      <AnnotationMarks
        ranges={annotationState.markedRanges}
        emphasizedIds={annotationState.emphasizedIds}
        host={annotationState.articleRoot}
        color={highlightColor}
        dark={dark}
      />
      <SelectionToolbar
        selection={annotationState.pendingSelection}
        dark={dark}
        onHighlight={() => annotationState.saveSelection('')}
        onAddNote={() => annotationState.saveSelection('', { openNote: true })}
        onDismiss={annotationState.dismissSelection}
      />
      {annotationState.activeAnnotation && activeNote ? (
        <AnnotationPopover
          key={annotationState.activeAnnotation.key}
          annotation={activeNote}
          anchorRect={annotationState.activeAnnotation.rect}
          dark={dark}
          onSaveNote={(note) =>
            annotationState.updateAnnotation(activeNote.id, { note })
          }
          onDelete={() => annotationState.deleteAnnotation(activeNote.id)}
          onDismiss={annotationState.dismissSelection}
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
