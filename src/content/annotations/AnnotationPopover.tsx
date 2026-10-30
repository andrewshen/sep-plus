import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MarginNoteRect } from '../../lib/marginNotePlacement';
import { IconCopy, IconMore, IconTrash } from '../icons';
import { ActionButton } from '../ui/ActionButton';
import { IconButton } from '../ui/IconButton';
import { Popover } from '../ui/Popover';
import { useDismiss } from '../ui/useDismiss';
import { MarginNotePopover } from './MarginNotePopover';
import { clearPendingNote, stashPendingNote } from './pendingNotes';
import {
  isContextInvalidated,
  type AnnotationListItem,
} from './useAnnotations';

type SaveError = { message: string; retryable: boolean };

const RETRY_MESSAGE = 'Couldn’t save, click to retry';
const RELOAD_MESSAGE = 'Reload page to keep saving';

type AnnotationPopoverProps = {
  annotation: AnnotationListItem;
  anchorRect: MarginNoteRect;
  dark: boolean;
  onSaveNote: (note: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onDismiss: () => void;
};

const MENU_ID = 'sep-annotation-menu';
const AUTOSAVE_DELAY_MS = 400;

function clipboardText(annotation: AnnotationListItem): string {
  const quote = `“${annotation.selector.quote.exact}”`;
  const note = annotation.note.trim();
  return note ? `${quote}\n\n${note}` : quote;
}

function fitToContent(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

/**
 * One popover for every highlight: the note is always editable in place and
 * saves itself; the menu holds copy and delete.
 */
export function AnnotationPopover({
  annotation,
  anchorRect,
  dark,
  onSaveNote,
  onDelete,
  onDismiss,
}: AnnotationPopoverProps) {
  const [draft, setDraft] = useState(annotation.note);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuAnchorRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  /** Last note text storage confirmed; only advances on success. */
  const savedRef = useRef(annotation.note.trim());
  const draftRef = useRef(draft);
  const deletingRef = useRef(false);
  const mountedRef = useRef(true);
  /** This popover left a draft in sessionStorage for the next load. */
  const stashedRef = useRef(false);
  const onSaveNoteRef = useRef(onSaveNote);
  draftRef.current = draft;
  onSaveNoteRef.current = onSaveNote;

  function save(next: string): void {
    void onSaveNoteRef.current(next).then(
      () => {
        savedRef.current = next;
        if (mountedRef.current) {
          setSaveError(null);
        }
      },
      (error: unknown) => {
        const stale = isContextInvalidated(error);
        // Also when the popover already closed: any later reload keeps it.
        // Not if the note was changed back to what's stored meanwhile.
        if (stale && draftRef.current.trim() !== savedRef.current) {
          stashPendingNote(annotation.id, next);
          stashedRef.current = true;
        }
        if (mountedRef.current) {
          setSaveError({
            message: stale ? RELOAD_MESSAGE : RETRY_MESSAGE,
            retryable: !stale,
          });
        }
      },
    );
  }

  useDismiss(menuAnchorRef, menuOpen, () => setMenuOpen(false));

  useEffect(() => {
    // Wait for the anchored placement to make the popover visible.
    const frame = window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus({ preventScroll: true });
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // The note grows with `field-sizing: content`. Without it (older Firefox)
  // the rows={1}, overflow-hidden textarea would clip, so fit it by hand: on
  // attach (refs land before the popover's first placement), when its width
  // changes (window resize, popover scrollbar), and on every edit.
  const attachNote = useCallback((textarea: HTMLTextAreaElement | null) => {
    textareaRef.current = textarea;
    if (!textarea || CSS.supports('field-sizing', 'content')) {
      return;
    }
    fitToContent(textarea);
    let width = textarea.clientWidth;
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth !== width) {
        width = textarea.clientWidth;
        fitToContent(textarea);
      }
    });
    observer.observe(textarea);
    return () => {
      observer.disconnect();
      textareaRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && !CSS.supports('field-sizing', 'content')) {
      fitToContent(textarea);
    }
  }, [draft]);

  useEffect(() => {
    if (draft.trim() === savedRef.current) {
      // Back to what's stored, so nothing is left unsaved, and a draft
      // stashed earlier mustn't overwrite the note on the next load. Only
      // this popover's own stash: another may still be waiting to restore.
      setSaveError(null);
      if (stashedRef.current) {
        clearPendingNote(annotation.id);
        stashedRef.current = false;
      }
      return;
    }
    const timer = window.setTimeout(() => {
      if (!deletingRef.current) {
        save(draft.trim());
      }
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  // Flush an unsaved (or failed) edit when the popover closes.
  useEffect(
    () => () => {
      mountedRef.current = false;
      const next = draftRef.current.trim();
      if (!deletingRef.current && next !== savedRef.current) {
        save(next);
      }
    },
    [],
  );

  async function copy(): Promise<void> {
    // Close like a click-away; the menu's own exit animation runs.
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(clipboardText({ ...annotation, note: draft }));
    } catch {
      // Clipboard access can be denied; there's nothing useful to show.
    }
  }

  async function remove(): Promise<void> {
    deletingRef.current = true;
    try {
      await onDelete();
    } catch {
      deletingRef.current = false;
      setMenuOpen(false);
    }
  }

  const accessory = (
    <div className="sep-annotation-menu-anchor" ref={menuAnchorRef}>
      <IconButton
        ref={menuButtonRef}
        label="Annotation actions"
        expanded={menuOpen}
        controls={MENU_ID}
        hasPopup="menu"
        onClick={() => {
          setMenuOpen((open) => !open);
        }}
      >
        <IconMore />
      </IconButton>
      <Popover
        id={MENU_ID}
        open={menuOpen}
        align="end"
        variant="menu"
        role="menu"
        ariaLabel="Annotation actions"
        returnFocusRef={menuButtonRef}
        className="sep-actions sep-actions--vertical"
      >
        <ActionButton
          role="menuitem"
          icon={<IconCopy />}
          onClick={() => void copy()}
        >
          Copy to clipboard
        </ActionButton>
        <ActionButton
          role="menuitem"
          icon={<IconTrash />}
          onClick={() => void remove()}
        >
          Delete
        </ActionButton>
      </Popover>
    </div>
  );

  return (
    <MarginNotePopover
      anchorRect={anchorRect}
      label="Annotation"
      accessory={accessory}
      className="sep-annotation-popover"
      structuredBody
      dark={dark}
      ariaLabel="Annotation"
      onDismiss={() => {
        if (menuOpen) {
          setMenuOpen(false);
          return;
        }
        onDismiss();
      }}
      body={
        <div className="sep-annotation-note-field">
          <textarea
            ref={attachNote}
            className="sep-annotation-note"
            value={draft}
            rows={1}
            maxLength={100_000}
            placeholder="Add note"
            aria-label="Note"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                onDismiss();
              }
            }}
          />
          {saveError ? (
            <div role="alert">
              <button
                type="button"
                className="sep-annotation-save-error"
                onClick={() => {
                  if (saveError.retryable) {
                    save(draftRef.current.trim());
                    return;
                  }
                  stashPendingNote(annotation.id, draftRef.current);
                  window.location.reload();
                }}
              >
                {saveError.message}
              </button>
            </div>
          ) : null}
        </div>
      }
    />
  );
}
