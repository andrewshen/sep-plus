import {
  useLayoutEffect,
  useRef,
  useState,
  type AriaRole,
  type CSSProperties,
  type FocusEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  computeMarginNotePlacement,
  type MarginNoteRect,
} from '../../lib/marginNotePlacement';
import { PopoverSurface } from '../ui/Popover';

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
  /** Body is structured markup (citation entries) rather than note text. */
  structuredBody?: boolean;
  bibliographyPreview?: boolean;
  onPointerEnter?: PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: PointerEventHandler<HTMLDivElement>;
  onFocusCapture?: FocusEventHandler<HTMLDivElement>;
  onBlurCapture?: FocusEventHandler<HTMLDivElement>;
};

function getAnnotationMount(): HTMLElement | null {
  const layer = document.getElementById('sep-plus-annotation-layer');
  return layer?.shadowRoot?.getElementById('sep-plus-annotation-mount') ?? null;
}

/** A PopoverSurface anchored to a range or link in the article. */
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
  structuredBody = false,
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
      <PopoverSurface
        ref={noteRef}
        className={['sep-popover--anchored', className].filter(Boolean).join(' ')}
        style={style}
        title={label}
        action={
          actionLabel && onAction
            ? { label: actionLabel, disabled: actionDisabled, onClick: onAction }
            : undefined
        }
        prose={!structuredBody}
        data-sep-plus-annotation-ui=""
        data-sep-plus-bibliography-preview={bibliographyPreview ? '' : undefined}
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
        {body}
      </PopoverSurface>
    </div>,
    mount,
  );
}
