export type MarginNoteRect = Pick<
  DOMRectReadOnly,
  'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'
>;

export type MarginNoteSize = {
  width: number;
  height: number;
};

export type MarginNoteBounds = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type MarginNotePlacement = {
  top: number;
  left: number;
  placement: 'above' | 'below';
};

const DEFAULT_MARGIN_PX = 12;
const DEFAULT_GAP_PX = 8;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

/**
 * Place a note popover above its trigger, falling back below when there isn't
 * enough room.
 */
export function computeMarginNotePlacement(
  trigger: MarginNoteRect,
  preview: MarginNoteSize,
  bounds: MarginNoteBounds,
  margin = DEFAULT_MARGIN_PX,
  gap = DEFAULT_GAP_PX,
): MarginNotePlacement {
  const minLeft = bounds.left + margin;
  const maxLeft = bounds.left + bounds.width - preview.width - margin;
  const minTop = bounds.top + margin;
  const maxTop = bounds.top + bounds.height - preview.height - margin;
  const availableAbove = trigger.top - bounds.top - margin - gap;
  const availableBelow =
    bounds.top + bounds.height - trigger.bottom - margin - gap;
  const placement: 'above' | 'below' =
    availableAbove >= preview.height || availableAbove >= availableBelow
      ? 'above'
      : 'below';
  const idealTop =
    placement === 'above'
      ? trigger.top - preview.height - gap
      : trigger.bottom + gap;
  const idealLeft = trigger.left + trigger.width / 2 - preview.width / 2;

  return {
    top: clamp(idealTop, minTop, maxTop),
    left: clamp(idealLeft, minLeft, maxLeft),
    placement,
  };
}

export function formatRelativeAnnotationTime(
  timestamp: number,
  now = Date.now(),
): string {
  const deltaMs = Math.max(0, now - timestamp);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}
