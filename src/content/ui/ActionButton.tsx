import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
};

/**
 * Icon + label action. Lives inside a `.sep-actions` surface: a row for the
 * selection toolbar, a column (`.sep-actions--vertical`) for overflow menus.
 */
export function ActionButton({
  icon,
  children,
  className,
  type = 'button',
  ...rest
}: ActionButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={['sep-action', className].filter(Boolean).join(' ')}
    >
      <span className="sep-action-icon">{icon}</span>
      {children}
    </button>
  );
}
