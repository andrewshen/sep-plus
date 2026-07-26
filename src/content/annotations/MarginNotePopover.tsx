import {
  useLayoutEffect,
  useRef,
  useState,
  type AriaRole,
  type CSSProperties,
  type FocusEventHandler,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  computeMarginNotePlacement,
  type MarginNoteRect,
} from '../../lib/marginNotePlacement';

export type MarginNotePopoverProps = {
  anchorRect: MarginNoteRect;
  label: string;
  body?: ReactNode;
  actionLabel?: string;
  actionDisabled?: boolean;
  dark: boolean;
  ariaLabel: string;
  onAction?: () => void;
  onDismiss: () => void;
  className?: string;
  role?: AriaRole;
  motion?: 'instant' | 'pointer';
  bibliographyPreview?: boolean;
  onPointerEnter?: PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: PointerEventHandler<HTMLDivElement>;
  onFocusCapture?: FocusEventHandler<HTMLDivElement>;
  onBlurCapture?: FocusEventHandler<HTMLDivElement>;
};

function keepFocus(event: ReactPointerEvent<HTMLButtonElement>): void {
  event.preventDefault();
}

function getAnnotationMount(): HTMLElement | null {
  const layer = document.getElementById('sep-plus-annotation-layer');
  return layer?.shadowRoot?.getElementById('sep-plus-annotation-mount') ?? null;
}

export function MarginNotePopover({
  anchorRect,
  label,
  body,
  actionLabel,
  actionDisabled,
  dark,
  ariaLabel,
  onAction,
  onDismiss,
  className,
  role = 'dialog',
  motion = 'instant',
  bibliographyPreview = false,
  onPointerEnter,
  onPointerLeave,
  onFocusCapture,
  onBlurCapture,
}: MarginNotePopoverProps) {
  const noteRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<'above' | 'below'>('above');
  const [style, setStyle] = useState<CSSProperties>({
    position: 'absolute',
    left: anchorRect.right + 12,
    top: anchorRect.top,
    visibility: 'hidden',
  });

  useLayoutEffect(() => {
    const node = noteRef.current;
    if (!node) {
      return;
    }
    const placement = computeMarginNotePlacement(
      anchorRect,
      {
        width: node.offsetWidth,
        height: node.offsetHeight,
      },
      {
        top: window.scrollY,
        left: window.scrollX,
        width: window.innerWidth,
        height: window.innerHeight,
      },
    );
    setPlacement(placement.placement);
    setStyle({
      position: 'absolute',
      left: placement.left,
      top: placement.top,
      visibility: 'visible',
    });
  }, [anchorRect]);

  const mount = getAnnotationMount();
  if (!mount) {
    return null;
  }

  return createPortal(
    <div
      className={['sep-plus-app', 'sep-annotation-overlay', dark ? 'is-dark' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div
        ref={noteRef}
        className={['sep-margin-note', className].filter(Boolean).join(' ')}
        style={style}
        data-sep-plus-annotation-ui=""
        data-sep-plus-bibliography-preview={
          bibliographyPreview ? '' : undefined
        }
        data-placement={placement}
        data-motion={motion}
        role={role}
        aria-label={ariaLabel}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onDismiss();
          }
        }}
      >
        <div className="sep-margin-note-header">
          <div className="sep-margin-note-label">{label}</div>
          {actionLabel && onAction ? (
            <button
              type="button"
              className="sep-margin-note-action"
              disabled={actionDisabled}
              onPointerDown={keepFocus}
              onClick={onAction}
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
        {body ? <div className="sep-margin-note-body">{body}</div> : null}
      </div>
    </div>,
    mount,
  );
}
