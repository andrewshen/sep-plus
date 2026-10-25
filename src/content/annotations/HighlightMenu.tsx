import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarginNoteRect } from '../../lib/marginNotePlacement';
import { IconRemove } from '../icons';
import { Popover } from '../popover/Popover';

export type HighlightMenuTarget = {
  id: string;
  note: string;
  rect: MarginNoteRect;
};

type HighlightMenuProps = {
  highlight: HighlightMenuTarget | null;
  dark: boolean;
  onSaveNote: (id: string, note: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onDismiss: () => void;
};

type Session = {
  id: string;
  saved: string;
  draft: string;
};

/**
 * Note editor for a single highlight. The draft is saved whenever the menu
 * closes or moves to another highlight, so Done, Escape, and clicking away all
 * keep what was typed.
 */
export function HighlightMenu({
  highlight,
  dark,
  onSaveNote,
  onRemove,
  onDismiss,
}: HighlightMenuProps) {
  const [draft, setDraft] = useState('');
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionRef = useRef<Session | null>(null);
  const onSaveNoteRef = useRef(onSaveNote);
  onSaveNoteRef.current = onSaveNote;
  const id = highlight?.id ?? null;
  const initialNote = highlight?.note ?? '';

  const flush = useCallback((session: Session | null) => {
    if (!session || session.draft.trim() === session.saved.trim()) {
      return;
    }
    session.saved = session.draft;
    void onSaveNoteRef.current(session.id, session.draft).catch(() => {
      // The shared annotation state exposes the actionable error in the sidebar.
    });
  }, []);

  useEffect(() => {
    const previous = sessionRef.current;
    if (previous?.id === id) {
      return;
    }
    flush(previous);
    sessionRef.current = id
      ? { id, saved: initialNote, draft: initialNote }
      : null;
    if (id) {
      setDraft(initialNote);
      setRemoving(false);
    }
    // initialNote is only read when a new highlight opens.
  }, [flush, id]);

  useEffect(() => () => flush(sessionRef.current), [flush]);

  const focusInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  useEffect(() => {
    if (id) {
      focusInput();
    }
  }, [focusInput, id]);

  async function remove(): Promise<void> {
    const session = sessionRef.current;
    if (!session || removing) {
      return;
    }
    sessionRef.current = null;
    setRemoving(true);
    try {
      await onRemove(session.id);
    } catch {
      sessionRef.current = session;
      setRemoving(false);
    }
  }

  return (
    <Popover
      open={highlight !== null}
      anchorRect={highlight?.rect ?? null}
      dark={dark}
      className="sep-highlight-menu"
      role="dialog"
      aria-label="Highlight note"
      onEntered={focusInput}
      onKeyDown={(event) => {
        if (
          event.key === 'Escape' ||
          ((event.metaKey || event.ctrlKey) && event.key === 'Enter')
        ) {
          event.preventDefault();
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      <textarea
        ref={inputRef}
        className="sep-highlight-menu-input"
        value={draft}
        maxLength={100_000}
        placeholder="Add a note…"
        aria-label="Note"
        onChange={(event) => {
          setDraft(event.target.value);
          if (sessionRef.current) {
            sessionRef.current.draft = event.target.value;
          }
        }}
      />
      <div className="sep-highlight-menu-footer">
        <button
          type="button"
          className="sep-highlight-menu-remove"
          aria-label="Remove highlight"
          title="Remove highlight"
          disabled={removing}
          onClick={() => void remove()}
        >
          <IconRemove />
        </button>
        <button
          type="button"
          className="sep-highlight-menu-done"
          onClick={onDismiss}
        >
          Done
        </button>
      </div>
    </Popover>
  );
}
