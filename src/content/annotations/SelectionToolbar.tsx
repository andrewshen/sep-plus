import {
  useEffect,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { IconAnnotations, IconHighlight } from '../icons';
import { ActionButton } from '../ui/ActionButton';
import { PopoverSurface } from '../ui/Popover';
import type { SelectionToolbarAnchor } from './useAnnotations';

type SelectionToolbarProps = {
  selection: { rect: SelectionToolbarAnchor; key: string } | null;
  dark: boolean;
  onHighlight: () => Promise<void>;
  /** Saves the highlight and opens its annotation popover for typing. */
  onAddNote: () => Promise<void>;
  onDismiss: () => void;
};

const TOOLBAR_WIDTH = 224;

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
  onHighlight,
  onAddNote,
  onDismiss,
}: SelectionToolbarProps) {
  const [saving, setSaving] = useState<'highlight' | 'note' | null>(null);
  // Add note swaps the toolbar for the note popover in place, so it stays
  // undimmed while saving; `run` still ignores repeat clicks.
  const dimmed = saving === 'highlight';

  useEffect(() => {
    setSaving(null);
  }, [selection?.key]);

  if (!selection) {
    return null;
  }
  const mount = getAnnotationMount();
  if (!mount) {
    return null;
  }

  const halfWidth = TOOLBAR_WIDTH / 2;
  const selectionCenter = selection.rect.left + selection.rect.width / 2;
  const left = Math.min(
    window.scrollX + window.innerWidth - halfWidth - 12,
    Math.max(window.scrollX + halfWidth + 12, selectionCenter),
  );
  const style = {
    left,
    top: selection.rect.top - 8,
    // `translate`, not `transform`, so the shared entry animation composes.
    translate: '-50% -100%',
    '--sep-popover-origin-x': `${halfWidth + selectionCenter - left}px`,
  } as CSSProperties;

  async function run(kind: 'highlight' | 'note', action: () => Promise<void>) {
    if (saving) {
      return;
    }
    setSaving(kind);
    try {
      await action();
    } catch {
      // The shared annotation state exposes the actionable error in the annotations popover.
    } finally {
      setSaving(null);
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
      <PopoverSurface
        key={selection.key}
        variant="menu"
        className="sep-popover--anchored sep-actions sep-annotation-toolbar"
        style={style}
        data-sep-plus-annotation-ui=""
        role="dialog"
        aria-label="Highlight selection"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onDismiss();
          }
        }}
      >
        <ActionButton
          icon={<IconHighlight />}
          disabled={dimmed}
          onPointerDown={keepSelection}
          onClick={() => void run('highlight', onHighlight)}
        >
          Highlight
        </ActionButton>
        <ActionButton
          icon={<IconAnnotations />}
          disabled={dimmed}
          onPointerDown={keepSelection}
          onClick={() => void run('note', onAddNote)}
        >
          Add note
        </ActionButton>
      </PopoverSurface>
    </div>,
    mount,
  );
}
