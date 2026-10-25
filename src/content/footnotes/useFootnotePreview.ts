import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  initFootnotes,
  type FootnoteController,
  type FootnotePreviewTarget,
} from '../../host/footnotes';
import type { MarginNoteRect } from '../../lib/marginNotePlacement';

type UseFootnotePreviewOptions = {
  enabled: boolean;
  paletteOpen: boolean;
  sidebarPhase: string;
  onPreviewOpen: () => void;
};

export type ActiveFootnotePreview = Omit<FootnotePreviewTarget, 'rect'> & {
  rect: MarginNoteRect;
};

function documentRect(rect: MarginNoteRect): MarginNoteRect {
  return {
    top: rect.top + window.scrollY,
    right: rect.right + window.scrollX,
    bottom: rect.bottom + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
  };
}

export function useFootnotePreview({
  enabled,
  paletteOpen,
  sidebarPhase,
  onPreviewOpen,
}: UseFootnotePreviewOptions) {
  const [active, setActive] = useState<ActiveFootnotePreview | null>(null);
  const controllerRef = useRef<FootnoteController | null>(null);
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
    const controller = initFootnotes({
      onPreviewChange: (target) => {
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
        setActive({ ...target, rect: documentRect(target.rect) });
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
