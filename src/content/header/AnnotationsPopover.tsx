import type { RefObject } from 'react';
import type { AnnotationListItem } from '../annotations/useAnnotations';
import { Popover } from '../ui/Popover';
import { PopoverRow } from '../ui/PopoverRow';

type AnnotationsPopoverProps = {
  id: string;
  open: boolean;
  annotations: AnnotationListItem[];
  loading: boolean;
  error: string | null;
  onScrollTo: (annotationId: string, options?: { focus?: boolean }) => boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function AnnotationsPopover({
  id,
  open,
  annotations,
  loading,
  error,
  onScrollTo,
  onClose,
  returnFocusRef,
}: AnnotationsPopoverProps) {
  return (
    <Popover
      id={id}
      open={open}
      returnFocusRef={returnFocusRef}
      align="end"
      title="Annotations"
      ariaLabel="Annotations"
      className="sep-popover--tight-bottom"
    >
      {error ? (
        <div className="sep-popover-message is-error" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="sep-popover-message">Loading annotations…</div>
      ) : null}
      {!loading && annotations.length === 0 ? (
        <div className="sep-popover-message">
          Select text in the article to add a highlight or note.
        </div>
      ) : null}
      {annotations.map((annotation) => (
        <PopoverRow
          key={annotation.id}
          label={annotation.selector.quote.exact}
          secondary={
            annotation.resolved
              ? annotation.note.trim() || undefined
              : ['Not found in this revision.', annotation.note.trim()]
                  .filter(Boolean)
                  .join(' ')
          }
          disabled={!annotation.resolved}
          onClick={(event) => {
            // Closing removes this row; if it still has focus, Chrome's focus
            // reset cancels the smooth scroll partway. From the keyboard
            // (detail 0), focus moves to the annotation's paragraph instead.
            event.currentTarget.blur();
            if (onScrollTo(annotation.id, { focus: event.detail === 0 })) {
              onClose();
            }
          }}
        />
      ))}
    </Popover>
  );
}
