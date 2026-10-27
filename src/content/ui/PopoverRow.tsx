import type { MouseEvent, ReactNode } from 'react';
import { IconChevron } from '../icons';

type SelectOption<T extends string> = {
  value: T;
  label: string;
  /** Options sharing a group render under one native `<optgroup>`. */
  group?: string;
  disabled?: boolean;
};

type PopoverRowSelect<T extends string> = {
  /** `''` shows the placeholder (action menus with no current value). */
  value: T | '';
  options: ReadonlyArray<SelectOption<T>>;
  ariaLabel: string;
  placeholder?: string;
  onChange: (value: T) => void;
};

type PopoverRowProps<T extends string> = {
  label: ReactNode;
  secondary?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  /** Native select stretched over the row; the trailing slot shows its value. */
  select?: PopoverRowSelect<T>;
};

function renderOptions<T extends string>(
  options: ReadonlyArray<SelectOption<T>>,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < options.length) {
    const group = options[index]?.group;
    const run: SelectOption<T>[] = [];
    while (index < options.length && options[index]?.group === group) {
      run.push(options[index] as SelectOption<T>);
      index += 1;
    }
    const items = run.map((option) => (
      <option key={option.value} value={option.value} disabled={option.disabled}>
        {option.label}
      </option>
    ));
    nodes.push(
      group ? (
        <optgroup key={group} label={group}>
          {items}
        </optgroup>
      ) : (
        items
      ),
    );
  }
  return nodes;
}

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
  const trailingContent = trailing ?? select?.placeholder;
  const content = (
    <>
      {leading ? <span className="sep-popover-row-leading">{leading}</span> : null}
      <span className="sep-popover-row-main">
        <span className="sep-popover-row-label">{label}</span>
        {secondary ? (
          <span className="sep-popover-row-secondary">{secondary}</span>
        ) : null}
      </span>
      {trailingContent || select ? (
        <span className="sep-popover-row-trailing">
          {trailingContent}
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
          {select.placeholder ? (
            <option value="" disabled hidden>
              {select.placeholder}
            </option>
          ) : null}
          {renderOptions(select.options)}
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
