const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  vectorEffect: 'non-scaling-stroke',
} as const;

/** Search, 16×16 (Paper header search pill). */
export function IconSearch() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <path
        {...STROKE}
        transform="translate(2 2)"
        d="M10 5C10 7.761 7.761 10 5 10C2.239 10 0 7.761 0 5C0 2.239 2.239 0 5 0C7.761 0 10 2.239 10 5Z"
      />
      <path {...STROKE} transform="translate(10.536 10.536)" d="M0 0L3.464 3.464" />
    </svg>
  );
}

/** Annotations (speech bubble), 20×20 (Paper header). */
export function IconAnnotations() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none">
      <g transform="translate(1 1)">
        <path
          {...STROKE}
          transform="translate(2.25 3.938)"
          d="M0.925 12.242C0.843 12.311 0.743 12.355 0.637 12.369C0.531 12.383 0.423 12.367 0.325 12.322C0.228 12.277 0.146 12.205 0.089 12.115C0.031 12.024 0 11.92 0 11.812L0 0.562C0 0.413 0.059 0.27 0.165 0.165C0.27 0.059 0.413 0 0.563 0L12.938 0C13.087 0 13.23 0.059 13.335 0.165C13.441 0.27 13.5 0.413 13.5 0.562L13.5 9.562C13.5 9.712 13.441 9.855 13.335 9.96C13.23 10.066 13.087 10.125 12.938 10.125L3.375 10.125L0.925 12.242Z"
        />
        <path {...STROKE} transform="translate(6.75 7.875)" d="M0 0L4.5 0" />
        <path {...STROKE} transform="translate(6.75 10.125)" d="M0 0L4.5 0" />
      </g>
    </svg>
  );
}

const MORE_DOT =
  'M1.667 0.833C1.667 1.294 1.294 1.667 0.833 1.667C0.373 1.667 0 1.294 0 0.833C0 0.373 0.373 0 0.833 0C1.294 0 1.667 0.373 1.667 0.833Z';

/** More (horizontal ellipsis), 20×20 (Paper header). */
export function IconMore() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none">
      {[3.333, 9.167, 15].map((x) => (
        <g key={x} transform={`translate(${x} 9.167)`}>
          <path d={MORE_DOT} fill="currentColor" />
          <path {...STROKE} d={MORE_DOT} />
        </g>
      ))}
    </svg>
  );
}

/** Moon, 20×20 (Paper settings: Appearance). */
export function IconMoon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none">
      <g transform="translate(1 1)">
        <path
          {...STROKE}
          transform="translate(2.816 1.976)"
          d="M4.786 0C4.432 1.17 4.403 2.414 4.7 3.6C4.998 4.785 5.612 5.868 6.476 6.732C7.34 7.596 8.423 8.21 9.608 8.508C10.794 8.805 12.038 8.776 13.208 8.422C12.869 9.537 12.246 10.546 11.402 11.349C10.557 12.152 9.519 12.723 8.388 13.006C7.257 13.289 6.072 13.274 4.949 12.963C3.825 12.652 2.801 12.055 1.977 11.231C1.153 10.407 0.556 9.383 0.245 8.259C-0.066 7.136 -0.081 5.951 0.202 4.82C0.485 3.689 1.055 2.651 1.859 1.806C2.662 0.961 3.671 0.339 4.786 0Z"
        />
      </g>
    </svg>
  );
}

/** Sun, 16×16 drawn into a 20×20 box to match {@link IconMoon} (Paper Icons). */
export function IconSun() {
  return (
    <svg viewBox="-2 -2 20 20" aria-hidden="true" fill="none">
      <path {...STROKE} d="M8 1V2.5" />
      <path
        {...STROKE}
        transform="translate(4.5 4.5)"
        d="M7 3.5C7 5.433 5.433 7 3.5 7C1.567 7 0 5.433 0 3.5C0 1.567 1.567 0 3.5 0C5.433 0 7 1.567 7 3.5Z"
      />
      <path {...STROKE} d="M4 4L3 3" />
      <path {...STROKE} d="M4 12L3 13" />
      <path {...STROKE} d="M12 4L13 3" />
      <path {...STROKE} d="M12 12L13 13" />
      <path {...STROKE} d="M2.5 8H1" />
      <path {...STROKE} d="M8 13.5V15" />
      <path {...STROKE} d="M13.5 8H15" />
    </svg>
  );
}

/** Chevron down, 12×12 (Paper settings rows). */
export function IconChevron() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" fill="none">
      <path {...STROKE} d="M9.75 4.5L6 8.25L2.25 4.5" />
    </svg>
  );
}

/** Highlighter, 16×16 (Paper annotation bar LTO-0). */
export function IconHighlight() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <path
        {...STROKE}
        transform="translate(1.88 10)"
        d="M3.624-2C3.624-2-0.376 2-0.376 2-0.376 2 4.124 3.5 4.124 3.5 4.124 3.5 6.624 1 6.624 1"
      />
      <path
        {...STROKE}
        transform="translate(5.88 6.25)"
        d="M5.617 3.75C5.617 3.75 3.97 5.396 3.97 5.396 3.924 5.443 3.869 5.479 3.808 5.504 3.748 5.53 3.682 5.543 3.617 5.543 3.551 5.543 3.486 5.53 3.425 5.504 3.365 5.479 3.309 5.443 3.263 5.396 3.263 5.396-1.03 1.103-1.03 1.103-1.076 1.057-1.113 1.002-1.138 0.941-1.163 0.88-1.176 0.815-1.176 0.75-1.176 0.684-1.163 0.619-1.138 0.559-1.113 0.498-1.076 0.443-1.03 0.396-1.03 0.396 0.617-1.25 0.617-1.25"
      />
      <path
        {...STROKE}
        transform="translate(7.76 1.25)"
        d="M7.742 5.75C7.742 5.75 4.595 8.896 4.595 8.896C4.549 8.943 4.494 8.979 4.433 9.004C4.373 9.03 4.307 9.043 4.242 9.043C4.176 9.043 4.111 9.03 4.05 9.004C3.99 8.979 3.934 8.943 3.888 8.896C3.888 8.896 -1.405 3.603 -1.405 3.603C-1.451 3.557 -1.488 3.502 -1.513 3.441C-1.538 3.38 -1.551 3.315 -1.551 3.25C-1.551 3.184 -1.538 3.119 -1.513 3.059C-1.488 2.998 -1.451 2.943 -1.405 2.896C-1.405 2.896 1.742 -0.25 1.742 -0.25"
      />
    </svg>
  );
}

/** Copy, 16×16 — Paper TN2-0 (Phosphor regular) redrawn as 1.25 strokes. */
export function IconCopy() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <path {...STROKE} d="M2.5 5.5H10.5V13.5H2.5Z" />
      <path {...STROKE} d="M10.5 10.5H13.5V2.5H5.5V5.5" />
    </svg>
  );
}

/** Trash, 16×16 — Paper TN0-0 (Phosphor regular) redrawn as 1.25 strokes. */
export function IconTrash() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <path {...STROKE} d="M2.5 3.5H13.5" />
      <path {...STROKE} d="M5.5 3.5V2.5A1 1 0 0 1 6.5 1.5H9.5A1 1 0 0 1 10.5 2.5V3.5" />
      <path {...STROKE} d="M12.5 3.5V13A0.5 0.5 0 0 1 12 13.5H4A0.5 0.5 0 0 1 3.5 13V3.5" />
      <path {...STROKE} d="M6.5 6.5V10.5" />
      <path {...STROKE} d="M9.5 6.5V10.5" />
    </svg>
  );
}
