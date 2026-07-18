import { useEffect, useRef } from 'react';

type PaletteProps = {
  open: boolean;
  onClose: () => void;
};

function IconSearch() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.8 2.5a4.3 4.3 0 1 1 2.7 7.65l2.7 2.7-.9.9-2.75-2.75A4.3 4.3 0 0 1 6.8 2.5zm0 1.25a3.05 3.05 0 1 0 0 6.1 3.05 3.05 0 0 0 0-6.1z"
      />
    </svg>
  );
}

export function Palette({ open, onClose }: PaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="sep-palette-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="sep-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sep-palette-input-row">
          <IconSearch />
          <input
            ref={inputRef}
            className="sep-palette-input"
            type="search"
            placeholder="Search SEP entries…"
            aria-label="Search SEP entries"
          />
        </div>
        <div className="sep-palette-empty">Search coming soon</div>
      </div>
    </div>
  );
}
