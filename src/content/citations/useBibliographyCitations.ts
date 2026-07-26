import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  initBibliographyCitations,
  type BibliographyCitationController,
  type BibliographyCitationTarget,
} from '../../host/bibliographyCitations';
import type { MarginNoteRect } from '../../lib/marginNotePlacement';

type UseBibliographyCitationsOptions = {
  enabled: boolean;
  paletteOpen: boolean;
  sidebarPhase: string;
  onPreviewOpen: () => void;
};

export type ActiveBibliographyPreview = Omit<
  BibliographyCitationTarget,
  'rect'
> & {
  rect: MarginNoteRect;
};

function documentRect(
  rect: MarginNoteRect,
  target: HTMLElement,
): MarginNoteRect {
  const view = target.ownerDocument.defaultView;
  const scrollX = view?.scrollX ?? 0;
  const scrollY = view?.scrollY ?? 0;
  return {
    top: rect.top + scrollY,
    right: rect.right + scrollX,
    bottom: rect.bottom + scrollY,
    left: rect.left + scrollX,
    width: rect.width,
    height: rect.height,
  };
}

export function useBibliographyCitations({
  enabled,
  paletteOpen,
  sidebarPhase,
  onPreviewOpen,
}: UseBibliographyCitationsOptions) {
  const [active, setActive] = useState<ActiveBibliographyPreview | null>(null);
  const controllerRef = useRef<BibliographyCitationController | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const onPreviewOpenRef = useRef(onPreviewOpen);
  onPreviewOpenRef.current = onPreviewOpen;

  useLayoutEffect(() => {
    if (!enabled) {
      setActive(null);
      activeKeyRef.current = null;
      return;
    }
    let disposed = false;
    const controller = initBibliographyCitations({
      onActiveChange: (target) => {
        if (disposed) {
          return;
        }
        if (!target) {
          activeKeyRef.current = null;
          setActive(null);
          return;
        }
        if (activeKeyRef.current !== target.key) {
          activeKeyRef.current = target.key;
          onPreviewOpenRef.current();
        }
        setActive({
          ...target,
          rect: documentRect(target.rect, target.trigger),
        });
      },
    });
    controllerRef.current = controller;
    return () => {
      disposed = true;
      controller.cleanup();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      activeKeyRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (paletteOpen) {
      controllerRef.current?.dismiss();
    }
  }, [paletteOpen]);

  useEffect(() => {
    controllerRef.current?.dismiss();
  }, [sidebarPhase]);

  const dismiss = useCallback(() => {
    controllerRef.current?.dismiss();
  }, []);

  const previewPointerEnter = useCallback(() => {
    controllerRef.current?.previewPointerEnter();
  }, []);

  const previewPointerLeave = useCallback(() => {
    controllerRef.current?.previewPointerLeave();
  }, []);

  const previewFocusEnter = useCallback(() => {
    controllerRef.current?.previewFocusEnter();
  }, []);

  const previewFocusLeave = useCallback(() => {
    controllerRef.current?.previewFocusLeave();
  }, []);

  return {
    active,
    dismiss,
    previewPointerEnter,
    previewPointerLeave,
    previewFocusEnter,
    previewFocusLeave,
  };
}
