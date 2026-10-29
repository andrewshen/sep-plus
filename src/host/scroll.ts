const MIN_DURATION_MS = 180;
const MAX_DURATION_MS = 380;
const MS_PER_PX = 0.12;

const INTERRUPT_EVENTS = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;

let cancelActive: (() => void) | null = null;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

const FOCUS_TARGET_ATTR = 'data-sep-plus-focus-target';

/**
 * After a keyboard jump, move focus to where the page scrolled so the next
 * Tab continues from there. Non-focusable targets get a temporary tabindex.
 */
export function focusJumpTarget(element: Element | null | undefined): void {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  if (!element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1');
    element.setAttribute(FOCUS_TARGET_ATTR, '');
    element.addEventListener(
      'blur',
      () => {
        element.removeAttribute('tabindex');
        element.removeAttribute(FOCUS_TARGET_ATTR);
      },
      { once: true },
    );
  }
  element.focus({ preventScroll: true });
}

/** Animated window scroll, faster than native `behavior: 'smooth'`. */
export function scrollWindowTo(top: number): void {
  cancelActive?.();

  const maxTop = document.documentElement.scrollHeight - window.innerHeight;
  const target = Math.max(0, Math.min(top, Math.max(maxTop, 0)));
  const start = window.scrollY;
  const distance = target - start;

  if (
    Math.abs(distance) < 1 ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    window.scrollTo({ top: target, behavior: 'instant' });
    return;
  }

  const duration = Math.min(
    MAX_DURATION_MS,
    Math.max(MIN_DURATION_MS, Math.abs(distance) * MS_PER_PX),
  );
  let startTime: number | null = null;
  let frame = 0;

  const stop = () => {
    cancelAnimationFrame(frame);
    for (const type of INTERRUPT_EVENTS) {
      window.removeEventListener(type, stop);
    }
    if (cancelActive === stop) {
      cancelActive = null;
    }
  };

  const step = (now: number) => {
    startTime ??= now;
    const progress = Math.min((now - startTime) / duration, 1);
    window.scrollTo({
      top: start + distance * easeOutCubic(progress),
      behavior: 'instant',
    });
    if (progress < 1) {
      frame = requestAnimationFrame(step);
    } else {
      stop();
    }
  };

  for (const type of INTERRUPT_EVENTS) {
    window.addEventListener(type, stop, { passive: true });
  }
  cancelActive = stop;
  frame = requestAnimationFrame(step);
}
