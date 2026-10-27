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
  /** Trailing control in the title row. */
  accessory?: ReactNode;
  dark: boolean;
  ariaLabel: string;
  onDismiss: () => void;
  className?: string;
  role?: AriaRole;
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
  accessory,
  dark,
  ariaLabel,
  onDismiss,
  className,
  role = 'dialog',
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
    const element = node;
    function place(): void {
      const placement = computeMarginNotePlacement(
        anchorRect,
        {
          width: element.offsetWidth,
          height: element.offsetHeight,
        },
        {
          top: window.scrollY,
          left: window.scrollX,
          width: window.innerWidth,
          height: window.innerHeight,
        },
      );
      const originX =
        anchorRect.left + anchorRect.width / 2 - placement.left;
      setPlacement(placement.placement);
      setStyle({
        position: 'absolute',
        left: placement.left,
        top: placement.top,
        visibility: 'visible',
        '--sep-popover-origin-x': `${Math.min(
          Math.max(originX, 0),
          element.offsetWidth,
        )}px`,
      } as CSSProperties);
    }
    place();
    // Editable notes grow as you type; keep them clear of the highlight.
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => observer.disconnect();
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
        accessory={accessory}
        prose={!structuredBody}
        data-sep-plus-annotation-ui=""
        data-sep-plus-bibliography-preview={bibliographyPreview ? '' : undefined}
        data-placement={placement}
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
