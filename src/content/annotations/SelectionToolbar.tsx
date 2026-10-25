import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { IconHighlight } from '../icons';
import { Popover } from '../popover/Popover';
import type { SelectionToolbarAnchor } from './useAnnotations';

type SelectionToolbarProps = {
  selection: { rect: SelectionToolbarAnchor; key: string } | null;
  dark: boolean;
  onHighlight: () => Promise<void>;
  onDismiss: () => void;
};

function keepSelection(event: ReactPointerEvent<HTMLButtonElement>): void {
  event.preventDefault();
}

export function SelectionToolbar({
  selection,
  dark,
  onHighlight,
  onDismiss,
}: SelectionToolbarProps) {
  const [saving, setSaving] = useState(false);
  const selectionKey = selection?.key ?? null;

  useEffect(() => {
    if (selectionKey !== null) {
      setSaving(false);
    }
  }, [selectionKey]);

  async function highlight() {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      await onHighlight();
    } catch {
      // The shared annotation state exposes the actionable error in the sidebar.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover
      open={selection !== null}
      anchorRect={selection?.rect ?? null}
      dark={dark}
      className="sep-annotation-toolbar"
      role="dialog"
      aria-label="Highlight selection"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      <button
        type="button"
        className="sep-annotation-highlight-trigger"
        disabled={saving}
        onPointerDown={keepSelection}
        onClick={() => void highlight()}
      >
        <IconHighlight />
        Highlight
      </button>
    </Popover>
  );
}
