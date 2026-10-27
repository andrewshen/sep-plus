import type { ReactNode } from 'react';

type IconButtonProps = {
  label: string;
  expanded: boolean;
  controls?: string;
  hasPopup?: 'dialog' | 'menu';
  onClick: () => void;
  children: ReactNode;
};

export function IconButton({
  label,
  expanded,
  controls,
  hasPopup = 'dialog',
  onClick,
  children,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={['sep-icon-button', expanded ? 'is-pressed' : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      aria-haspopup={hasPopup}
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
