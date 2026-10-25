import {
  type AriaRole,
  type FocusEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from 'react';
import type { MarginNoteRect } from '../../lib/marginNotePlacement';
import { Popover, type PopoverMotion } from '../popover/Popover';

export type MarginNotePopoverProps = {
  open: boolean;
  anchorRect: MarginNoteRect | null;
  label?: string;
  body?: ReactNode;
  dark: boolean;
  ariaLabel: string;
  onDismiss: () => void;
  className?: string;
  role?: AriaRole;
  motion?: PopoverMotion;
  gap?: number;
  bibliographyPreview?: boolean;
  footnotePreview?: boolean;
  onPointerEnter?: PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: PointerEventHandler<HTMLDivElement>;
  onFocusCapture?: FocusEventHandler<HTMLDivElement>;
  onBlurCapture?: FocusEventHandler<HTMLDivElement>;
};

export function MarginNotePopover({
  open,
  anchorRect,
  label,
  body,
  dark,
  ariaLabel,
  onDismiss,
  className,
  role = 'dialog',
  motion = 'pointer',
  gap,
  bibliographyPreview = false,
  footnotePreview = false,
  onPointerEnter,
  onPointerLeave,
  onFocusCapture,
  onBlurCapture,
}: MarginNotePopoverProps) {
  return (
    <Popover
      open={open}
      anchorRect={anchorRect}
      motion={motion}
      dark={dark}
      gap={gap}
      className={['sep-margin-note', className].filter(Boolean).join(' ')}
      data-sep-plus-bibliography-preview={bibliographyPreview ? '' : undefined}
      data-sep-plus-footnote-preview={footnotePreview ? '' : undefined}
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
      {label ? (
        <div className="sep-margin-note-header">
          <div className="sep-margin-note-label">{label}</div>
        </div>
      ) : null}
      {body ? <div className="sep-margin-note-body">{body}</div> : null}
    </Popover>
  );
}
