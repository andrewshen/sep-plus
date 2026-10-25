import type { ReactNode } from 'react';
import { IconChevron } from '../icons';

type SelectOption<T extends string> = { value: T; label: string };

type PopoverRowSelect<T extends string> = {
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  ariaLabel: string;
  onChange: (value: T) => void;
};

type PopoverRowProps<T extends string> = {
  label: ReactNode;
  secondary?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Native select stretched over the row; the trailing slot shows its value. */
  select?: PopoverRowSelect<T>;
};

export function PopoverRow<T extends string = string>({
  label,
  secondary,
  leading,
  trailing,
  href,
  onClick,
  disabled,
  select,
}: PopoverRowProps<T>) {
  const content = (
    <>
      {leading ? <span className="sep-popover-row-leading">{leading}</span> : null}
      <span className="sep-popover-row-main">
        <span className="sep-popover-row-label">{label}</span>
        {secondary ? (
          <span className="sep-popover-row-secondary">{secondary}</span>
        ) : null}
      </span>
      {trailing || select ? (
        <span className="sep-popover-row-trailing">
          {trailing}
          {select ? (
            <span className="sep-popover-row-chevron">
              <IconChevron />
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );

  if (select) {
    return (
      <label className="sep-popover-row is-interactive">
        {content}
        <select
          className="sep-popover-row-select"
          aria-label={select.ariaLabel}
          value={select.value}
          onChange={(event) => {
            const next = select.options.find(
              (option) => option.value === event.target.value,
            );
            if (next) {
              select.onChange(next.value);
            }
          }}
        >
          {select.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (href) {
    return (
      <a className="sep-popover-row is-interactive" href={href} onClick={onClick}>
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        className="sep-popover-row is-interactive"
        disabled={disabled}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className="sep-popover-row">{content}</div>;
}
