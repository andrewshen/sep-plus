import {
  useEffect,
  useRef,
  useState,
  type AriaRole,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';

export const POPOVER_EXIT_MS = 150;

export type PopoverAction = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

type PopoverSurfaceProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  ref?: Ref<HTMLDivElement>;
  title?: ReactNode;
  /** Quiet text button at the end of the title row. */
  action?: PopoverAction;
  /** `list` insets content 20px (rows, prose); `menu` insets 8px (search). */
  variant?: 'list' | 'menu';
  /** Free-form text body (notes, footnotes) instead of rows. */
  prose?: boolean;
};

/**
 * Base popover markup shared by every SEP+ popover. Styles live in
 * `lib/popover.css`; footnotes build the same structure without React.
 */
export function PopoverSurface({
  ref,
  title,
  action,
  variant = 'list',
  prose = false,
  className,
  children,
  ...rest
}: PopoverSurfaceProps) {
  return (
    <div
      ref={ref}
      {...rest}
      className={[
        'sep-popover',
        variant === 'menu' ? 'sep-popover--menu' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {title || action ? (
        <div className="sep-popover-title">
          <span className="sep-popover-title-text">{title}</span>
          {action ? (
            <button
              type="button"
              className="sep-popover-action"
              disabled={action.disabled}
              // Keep focus (and any text selection) where it was.
              onPointerDown={(event) => event.preventDefault()}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ) : null}
        </div>
      ) : null}
      {children ? (
        <div
          className={['sep-popover-body', prose ? 'sep-popover-prose' : '']
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type PopoverProps = {
  open: boolean;
  align: 'center' | 'end';
  variant?: 'list' | 'menu';
  title?: ReactNode;
  ariaLabel: string;
  role?: AriaRole;
  id?: string;
  children: ReactNode;
  onExited?: () => void;
};

/** Header dropdown: a PopoverSurface that mounts, fades in, and fades out. */
export function Popover({
  open,
  align,
  variant = 'list',
  title,
  ariaLabel,
  role = 'dialog',
  id,
  children,
  onExited,
}: PopoverProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => {
      setMounted(false);
      onExitedRef.current?.();
    }, POPOVER_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!mounted) {
    return null;
  }

  return (
    <PopoverSurface
      id={id}
      role={role}
      aria-label={ariaLabel}
      title={title}
      variant={variant}
      className={[
        'sep-popover--dropdown',
        `sep-popover--${align}`,
        visible ? 'is-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </PopoverSurface>
  );
}
