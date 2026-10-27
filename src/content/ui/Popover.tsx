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

type PopoverSurfaceProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  ref?: Ref<HTMLDivElement>;
  title?: ReactNode;
  /** Trailing control in the title row (e.g. an icon button). */
  accessory?: ReactNode;
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
  accessory,
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
      {title || accessory ? (
        <div className="sep-popover-title">
          <span className="sep-popover-title-text">{title}</span>
          {accessory}
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
  className?: string;
  children: ReactNode;
  onExited?: () => void;
};

/**
 * Header dropdown: a PopoverSurface that fades and scales in from its trigger
 * (via `@starting-style`), then stays mounted until its exit transition ends.
 */
export function Popover({
  open,
  align,
  variant = 'list',
  title,
  ariaLabel,
  role = 'dialog',
  id,
  className,
  children,
  onExited,
}: PopoverProps) {
  const [mounted, setMounted] = useState(open);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
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
        open ? 'is-open' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </PopoverSurface>
  );
}
