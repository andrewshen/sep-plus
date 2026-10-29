import { useEffect, useRef, useState } from 'react';
import type { MarginNoteRect } from '../../lib/marginNotePlacement';
import { IconCopy, IconMore, IconTrash } from '../icons';
import { ActionButton } from '../ui/ActionButton';
import { IconButton } from '../ui/IconButton';
import { Popover } from '../ui/Popover';
import { useDismiss } from '../ui/useDismiss';
import { MarginNotePopover } from './MarginNotePopover';
import { stashPendingNote } from './pendingNotes';
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
        if (mountedRef.current) {
          const stale = isContextInvalidated(error);
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

  useEffect(() => {
    if (draft.trim() === savedRef.current) {
      // Back to what's stored, so nothing is left unsaved.
      setSaveError(null);
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
            ref={textareaRef}
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
