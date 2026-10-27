import type { AnnotationListItem } from '../annotations/useAnnotations';
import { Popover } from '../ui/Popover';
import { PopoverRow } from '../ui/PopoverRow';

type AnnotationsPopoverProps = {
  id: string;
  open: boolean;
  annotations: AnnotationListItem[];
  loading: boolean;
  error: string | null;
  onScrollTo: (annotationId: string) => boolean;
  onClose: () => void;
};

export function AnnotationsPopover({
  id,
  open,
  annotations,
  loading,
  error,
  onScrollTo,
  onClose,
}: AnnotationsPopoverProps) {
  return (
    <Popover id={id} open={open} align="end" title="Annotations" ariaLabel="Annotations">
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
              : 'Text could not be located in this revision.'
          }
          disabled={!annotation.resolved}
          onClick={(event) => {
            // Closing removes this row; if it still has focus, Chrome's focus
            // reset cancels the smooth scroll partway.
            event.currentTarget.blur();
            if (onScrollTo(annotation.id)) {
              onClose();
            }
          }}
        />
      ))}
    </Popover>
  );
}
