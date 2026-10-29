import { useEffect, useRef, useState } from 'react';
import type { MarginNoteRect } from '../../lib/marginNotePlacement';
import { IconCopy, IconMore, IconRefresh, IconTrash } from '../icons';
import { ActionButton } from '../ui/ActionButton';
import { IconButton } from '../ui/IconButton';
import { Popover } from '../ui/Popover';
import { useDismiss } from '../ui/useDismiss';
import { MarginNotePopover } from './MarginNotePopover';
import {
  annotationErrorMessage,
  isContextInvalidated,
  type AnnotationListItem,
} from './useAnnotations';

type SaveError = { message: string; retryable: boolean };

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
const COPIED_CLOSE_DELAY_MS = 600;

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
  const [copied, setCopied] = useState(false);
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
          setSaveError({
            message: annotationErrorMessage(error),
            retryable: !isContextInvalidated(error),
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

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => {
      setMenuOpen(false);
      setCopied(false);
    }, COPIED_CLOSE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(clipboardText({ ...annotation, note: draft }));
      setCopied(true);
    } catch {
      setMenuOpen(false);
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
          setCopied(false);
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
          {copied ? 'Copied' : 'Copy to clipboard'}
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
            <div className="sep-annotation-save-error" role="alert">
              <span>{saveError.message}</span>
              {saveError.retryable ? (
                <button
                  type="button"
                  className="sep-annotation-save-retry"
                  onClick={() => save(draftRef.current.trim())}
                >
                  <IconRefresh />
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      }
    />
  );
}
