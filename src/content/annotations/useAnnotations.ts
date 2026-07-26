import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  annotationExportFilename,
  buildAnnotationExport,
  downloadTextFile,
  serializeAnnotationExport,
  serializeAnnotationsMarkdown,
} from '../../lib/annotationExport';
import {
  getAllEntryAnnotations,
  getEntryAnnotations,
  onEntryAnnotationsChanged,
  removeAnnotation,
  upsertAnnotation,
} from '../../lib/annotationStorage';
import type {
  Annotation,
  EntryAnnotations,
} from '../../lib/annotations';
import {
  buildTextProjection,
  createSelectionAnchor,
  rangeViewportRect,
  resolveAnnotationRange,
  type SelectionAnchor,
} from '../../host/annotationAnchors';
import {
  AnnotationHighlightRenderer,
  type ResolvedAnnotationRange,
} from '../../host/annotationHighlights';

export type AnnotationListItem = Annotation & {
  resolved: boolean;
};

export type SelectionToolbarAnchor = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

export type PendingAnnotationSelection = {
  anchor: SelectionAnchor;
  rect: SelectionToolbarAnchor;
  key: string;
};

export type ActiveAnnotationHighlight = {
  annotationId: string;
  rect: SelectionToolbarAnchor;
  key: string;
};

export type AnnotationExportFormat = 'json' | 'md';
export type AnnotationExportScope = 'entry' | 'all';

type UseAnnotationsOptions = {
  enabled: boolean;
  source?: string;
  pageTitle: string;
  paletteOpen: boolean;
  sidebarPhase: string;
};

type AnnotationUpdate = {
  note?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown annotation error.';
}

function isSepPlusUiEvent(event: Event): boolean {
  return event.composedPath().some(
    (target) =>
      target instanceof Element &&
      (target.id.startsWith('sep-plus-') ||
        Boolean(target.closest('[data-sep-plus-annotation-ui]'))),
  );
}

function documentRect(rect: DOMRect): SelectionToolbarAnchor {
  return {
    top: rect.top + window.scrollY,
    right: rect.right + window.scrollX,
    bottom: rect.bottom + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
  };
}

export function useAnnotations({
  enabled,
  source,
  pageTitle,
  paletteOpen,
  sidebarPhase,
}: UseAnnotationsOptions) {
  const [entry, setEntry] = useState<EntryAnnotations | null>(null);
  const [resolvedIds, setResolvedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [pendingSelection, setPendingSelection] =
    useState<PendingAnnotationSelection | null>(null);
  const [activeAnnotation, setActiveAnnotation] =
    useState<ActiveAnnotationHighlight | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const rendererRef = useRef<AnnotationHighlightRenderer | null>(null);
  if (!rendererRef.current) {
    rendererRef.current = new AnnotationHighlightRenderer();
  }
  const renderer = rendererRef.current;
  const articleRoot = enabled
    ? document.querySelector<HTMLElement>('#article-content')
    : null;

  useEffect(() => {
    if (!enabled || !source) {
      setEntry(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getEntryAnnotations(source)
      .then((stored) => {
        if (!cancelled) {
          setEntry(stored);
          setLoading(false);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(errorMessage(loadError));
          setLoading(false);
        }
      });
    const stopListening = onEntryAnnotationsChanged(
      source,
      (stored, changeError) => {
        if (cancelled) {
          return;
        }
        if (changeError) {
          setError(changeError.message);
          return;
        }
        setEntry(stored);
        setError(null);
      },
    );
    return () => {
      cancelled = true;
      stopListening();
    };
  }, [enabled, source]);

  useEffect(() => {
    if (!articleRoot || !entry) {
      renderer.clear();
      setResolvedIds(new Set());
      setActiveAnnotation(null);
      return;
    }
    const projection = buildTextProjection(articleRoot);
    const resolved: ResolvedAnnotationRange[] = [];
    const nextIds = new Set<string>();
    for (const annotation of entry.annotations) {
      const range = resolveAnnotationRange(
        articleRoot,
        annotation,
        projection,
      );
      if (!range) {
        continue;
      }
      nextIds.add(annotation.id);
      resolved.push({
        id: annotation.id,
        range,
      });
    }
    renderer.redraw(resolved);
    setResolvedIds(nextIds);
    setActiveAnnotation((current) => {
      if (!current) {
        return null;
      }
      const range = renderer.getRange(current.annotationId);
      const rect = range ? rangeViewportRect(range) : null;
      return rect
        ? {
            ...current,
            rect: documentRect(rect),
          }
        : null;
    });
    return () => renderer.clear();
  }, [articleRoot, entry, renderer]);

  useEffect(
    () => () => {
      renderer.clear();
    },
    [renderer],
  );

  useEffect(() => {
    if (!articleRoot) {
      return;
    }
    const root = articleRoot;
    let frame: number | null = null;

    function captureSelection(event: Event): void {
      if (isSepPlusUiEvent(event)) {
        return;
      }
      const pointer =
        event instanceof PointerEvent
          ? { clientX: event.clientX, clientY: event.clientY }
          : null;
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const selection = document.getSelection();
        if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) {
          setPendingSelection(null);
          const annotationId = pointer
            ? renderer.annotationAtPoint(pointer.clientX, pointer.clientY)
            : null;
          const range = annotationId
            ? renderer.getRange(annotationId)
            : null;
          const rect = range ? rangeViewportRect(range) : null;
          setActiveAnnotation(
            annotationId && rect
              ? {
                  annotationId,
                  rect: documentRect(rect),
                  key: `existing:${annotationId}`,
                }
              : null,
          );
          return;
        }
        const anchor = createSelectionAnchor(
          root,
          selection.getRangeAt(0).cloneRange(),
        );
        if (!anchor) {
          setPendingSelection(null);
          setActiveAnnotation(null);
          return;
        }
        const rect = rangeViewportRect(anchor.range);
        if (!rect) {
          setPendingSelection(null);
          setActiveAnnotation(null);
          return;
        }
        setActiveAnnotation(null);
        setPendingSelection({
          anchor,
          rect: documentRect(rect),
          key: `${anchor.selector.position.start}:${anchor.selector.position.end}:${anchor.selector.quote.exact}`,
        });
      });
    }

    document.addEventListener('pointerup', captureSelection);
    document.addEventListener('keyup', captureSelection);
    return () => {
      document.removeEventListener('pointerup', captureSelection);
      document.removeEventListener('keyup', captureSelection);
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [articleRoot, renderer]);

  useEffect(() => {
    if (!articleRoot) {
      return;
    }
    const root = articleRoot;
    let point: { clientX: number; clientY: number } | null = null;

    function updateHover(): void {
      const annotationId = point
        ? renderer.annotationAtPoint(point.clientX, point.clientY)
        : null;
      renderer.setHovered(annotationId);
      root.classList.toggle(
        'sep-plus-annotation-hovering',
        annotationId !== null,
      );
    }

    function onPointerMove(event: PointerEvent): void {
      point = isSepPlusUiEvent(event)
        ? null
        : { clientX: event.clientX, clientY: event.clientY };
      updateHover();
    }

    function clearHover(): void {
      point = null;
      updateHover();
    }

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', updateHover, { passive: true });
    window.addEventListener('blur', clearHover);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', updateHover);
      window.removeEventListener('blur', clearHover);
      root.classList.remove('sep-plus-annotation-hovering');
      renderer.setHovered(null);
    };
  }, [articleRoot, renderer]);

  useEffect(() => {
    renderer.setSelected(activeAnnotation?.annotationId ?? null);
  }, [activeAnnotation?.annotationId, renderer]);

  useEffect(() => {
    setPendingSelection(null);
    setActiveAnnotation(null);
  }, [paletteOpen, sidebarPhase]);

  useEffect(() => {
    let frame: number | null = null;

    function reposition(): void {
      if (frame !== null) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setPendingSelection((current) => {
          if (!current) {
            return null;
          }
          const rect = rangeViewportRect(current.anchor.range);
          return rect
            ? {
                ...current,
                rect: documentRect(rect),
              }
            : null;
        });
        setActiveAnnotation((current) => {
          if (!current) {
            return null;
          }
          const range = renderer.getRange(current.annotationId);
          const rect = range ? rangeViewportRect(range) : null;
          return rect
            ? {
                ...current,
                rect: documentRect(rect),
              }
            : null;
        });
      });
    }

    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('resize', reposition);
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [renderer]);

  const annotations = useMemo<AnnotationListItem[]>(
    () =>
      (entry?.annotations ?? []).map((annotation) => ({
        ...annotation,
        resolved: resolvedIds.has(annotation.id),
      })),
    [entry, resolvedIds],
  );

  const saveSelection = useCallback(
    async (note: string): Promise<void> => {
      if (!source || !pendingSelection) {
        return;
      }
      const now = Date.now();
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        selector: pendingSelection.anchor.selector,
        note: note.trim(),
        ...(pendingSelection.anchor.section
          ? { section: pendingSelection.anchor.section }
          : {}),
        createdAt: now,
        updatedAt: now,
      };
      try {
        const next = await upsertAnnotation(
          source,
          pageTitle,
          annotation,
        );
        setEntry(next);
        setPendingSelection(null);
        setActiveAnnotation(null);
        setError(null);
        document.getSelection()?.removeAllRanges();
      } catch (saveError: unknown) {
        setError(errorMessage(saveError));
        throw saveError;
      }
    },
    [pageTitle, pendingSelection, source],
  );

  const updateAnnotation = useCallback(
    async (annotationId: string, update: AnnotationUpdate): Promise<void> => {
      if (!source || !entry) {
        return;
      }
      const current = entry.annotations.find(
        (annotation) => annotation.id === annotationId,
      );
      if (!current) {
        return;
      }
      const nextAnnotation: Annotation = {
        ...current,
        ...(update.note !== undefined ? { note: update.note.trim() } : {}),
        updatedAt: Date.now(),
      };
      try {
        const next = await upsertAnnotation(
          source,
          pageTitle,
          nextAnnotation,
        );
        setEntry(next);
        setError(null);
      } catch (updateError: unknown) {
        setError(errorMessage(updateError));
        throw updateError;
      }
    },
    [entry, pageTitle, source],
  );

  const deleteAnnotation = useCallback(
    async (annotationId: string): Promise<void> => {
      if (!source) {
        return;
      }
      try {
        const next = await removeAnnotation(source, annotationId);
        setEntry(next);
        setActiveAnnotation((current) =>
          current?.annotationId === annotationId ? null : current,
        );
        setError(null);
      } catch (deleteError: unknown) {
        setError(errorMessage(deleteError));
        throw deleteError;
      }
    },
    [source],
  );

  const scrollToAnnotation = useCallback(
    (annotationId: string): boolean => renderer.scrollTo(annotationId),
    [renderer],
  );

  const exportAnnotations = useCallback(
    async (
      format: AnnotationExportFormat,
      scope: AnnotationExportScope,
    ): Promise<void> => {
      try {
        const entries =
          scope === 'all'
            ? await getAllEntryAnnotations()
            : entry
              ? [entry]
              : [];
        if (entries.length === 0) {
          throw new Error('There are no annotations to export.');
        }
        const exportedAt = new Date();
        if (format === 'json') {
          const contents = serializeAnnotationExport(
            buildAnnotationExport(entries, exportedAt),
          );
          downloadTextFile(
            contents,
            annotationExportFilename('json', exportedAt, scope),
            'application/json',
          );
        } else {
          downloadTextFile(
            serializeAnnotationsMarkdown(entries, exportedAt),
            annotationExportFilename('md', exportedAt, scope),
            'text/markdown',
          );
        }
        setError(null);
      } catch (exportError: unknown) {
        setError(errorMessage(exportError));
        throw exportError;
      }
    },
    [entry],
  );

  return {
    annotations,
    pendingSelection,
    activeAnnotation,
    loading,
    error,
    highlightSupported: renderer.supported,
    dismissSelection: () => {
      setPendingSelection(null);
      setActiveAnnotation(null);
    },
    saveSelection,
    updateAnnotation,
    deleteAnnotation,
    scrollToAnnotation,
    exportAnnotations,
  };
}
