import {
  useEffect,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { IconAddNote, IconHighlight } from '../icons';
import type { PendingAnnotationSelection } from './useAnnotations';

type SelectionToolbarProps = {
  selection: PendingAnnotationSelection | null;
  dark: boolean;
  onSave: (note: string) => Promise<void>;
  onDismiss: () => void;
};

function getAnnotationMount(): HTMLElement | null {
  const layer = document.getElementById('sep-plus-annotation-layer');
  return layer?.shadowRoot?.getElementById('sep-plus-annotation-mount') ?? null;
}

function keepSelection(event: ReactPointerEvent<HTMLButtonElement>): void {
  event.preventDefault();
}

export function SelectionToolbar({
  selection,
  dark,
  onSave,
  onDismiss,
}: SelectionToolbarProps) {
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setComposing(false);
    setNote('');
    setSaving(false);
  }, [selection?.key]);

  if (!selection) {
    return null;
  }
  const mount = getAnnotationMount();
  if (!mount) {
    return null;
  }

  const estimatedWidth = composing ? 304 : 207;
  const halfWidth = estimatedWidth / 2;
  const left = Math.min(
    window.scrollX + window.innerWidth - halfWidth - 12,
    Math.max(
      window.scrollX + halfWidth + 12,
      selection.rect.left + selection.rect.width / 2,
    ),
  );
  const style: CSSProperties = {
    left,
    top: selection.rect.top - 8,
    ...(composing ? { width: 304 } : {}),
    transform: 'translate(-50%, -100%)',
  };

  async function save(nextNote: string) {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      await onSave(nextNote);
    } catch {
      // The shared annotation state exposes the actionable error in the sidebar.
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className={[
        'sep-plus-app',
        'sep-annotation-overlay',
        dark ? 'is-dark' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'sep-annotation-toolbar',
          composing ? 'is-composing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={style}
        data-sep-plus-annotation-ui=""
        role="dialog"
        aria-label={composing ? 'Add annotation note' : 'Highlight selection'}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onDismiss();
          }
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            void save(note);
          }
        }}
      >
        {composing ? (
          <>
            <textarea
              className="sep-annotation-note-input"
              value={note}
              autoFocus
              maxLength={100_000}
              placeholder="Add a note…"
              aria-label="Annotation note"
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="sep-annotation-composer-footer">
              <div className="sep-annotation-composer-actions">
                <button
                  type="button"
                  className="sep-annotation-button is-quiet"
                  onClick={onDismiss}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="sep-annotation-button is-primary"
                  disabled={saving}
                  onClick={() => void save(note)}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="sep-annotation-highlight-trigger"
              disabled={saving}
              onPointerDown={keepSelection}
              onClick={() => void save('')}
            >
              <IconHighlight />
              Highlight
            </button>
            <button
              type="button"
              className="sep-annotation-note-trigger"
              onPointerDown={keepSelection}
              onClick={() => setComposing(true)}
            >
              <IconAddNote />
              Add note
            </button>
          </>
        )}
      </div>
    </div>,
    mount,
  );
}
