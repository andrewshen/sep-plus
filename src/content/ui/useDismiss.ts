import { useEffect, useRef, type RefObject } from 'react';

/**
 * Calls `onDismiss` on Escape or on a pointer press outside `ref`. Uses the
 * composed path so presses inside the shadow root count as inside.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  onDismiss: () => void,
): void {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function onPointerDown(event: PointerEvent): void {
      const node = ref.current;
      if (node && !event.composedPath().includes(node)) {
        onDismissRef.current();
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      // Escape during IME composition cancels the composition, not the popover.
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        onDismissRef.current();
      }
    }

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, ref]);
}
