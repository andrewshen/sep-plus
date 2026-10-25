import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  computeMarginNotePlacement,
  type MarginNotePlacement,
  type MarginNoteRect,
} from '../../lib/marginNotePlacement';

/** `pointer` fades and slides from the anchor; `instant` (keyboard) does not. */
export type PopoverMotion = 'pointer' | 'instant';

type Phase = 'hidden' | 'measuring' | 'open' | 'closing';

// Matches --sep-duration-fast, which drives the exit transition.
const EXIT_MS = 100;

export type PopoverProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'style'
> & {
  open: boolean;
  /** Anchor in document coordinates. */
  anchorRect: MarginNoteRect | null;
  motion?: PopoverMotion;
  dark: boolean;
  gap?: number;
  /** Called once the popover is visible (and can take focus). */
  onEntered?: () => void;
  children: ReactNode;
};

function getAnnotationMount(): HTMLElement | null {
  const layer = document.getElementById('sep-plus-annotation-layer');
  return layer?.shadowRoot?.getElementById('sep-plus-annotation-mount') ?? null;
}

function animatesExit(motion: PopoverMotion): boolean {
  return (
    motion === 'pointer' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function samePlacement(
  left: MarginNotePlacement | null,
  right: MarginNotePlacement,
): boolean {
  return (
    left !== null &&
    left.top === right.top &&
    left.left === right.left &&
    left.placement === right.placement
  );
}

/**
 * Shared shell for every anchored menu (selection toolbar, notes, citation and
 * footnote previews). Keeps rendering its last open content while it animates
 * out, so callers can simply flip `open` off.
 */
export function Popover({
  open,
  anchorRect,
  motion = 'pointer',
  dark,
  gap,
  onEntered,
  className,
  children,
  ...rest
}: PopoverProps) {
  const onEnteredRef = useRef(onEntered);
  onEnteredRef.current = onEntered;
  const isOpen = open && anchorRect !== null;
  const shownRef = useRef({ anchorRect, motion, children });
  if (isOpen) {
    shownRef.current = { anchorRect, motion, children };
  }
  const shown = shownRef.current;
  const nodeRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>(isOpen ? 'measuring' : 'hidden');
  const [position, setPosition] = useState<MarginNotePlacement | null>(null);
  const rendered = phase !== 'hidden';

  useLayoutEffect(() => {
    setPhase((current) => {
      if (isOpen) {
        if (current === 'hidden') {
          return 'measuring';
        }
        return current === 'closing' ? 'open' : current;
      }
      if (current === 'open') {
        return animatesExit(shownRef.current.motion) ? 'closing' : 'hidden';
      }
      return current === 'measuring' ? 'hidden' : current;
    });
  }, [isOpen]);

  useEffect(() => {
    if (phase !== 'closing') {
      return;
    }
    const timer = window.setTimeout(() => setPhase('hidden'), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const reposition = useCallback(() => {
    const node = nodeRef.current;
    const anchor = shownRef.current.anchorRect;
    if (!node || !anchor) {
      return;
    }
    const next = computeMarginNotePlacement(
      anchor,
      { width: node.offsetWidth, height: node.offsetHeight },
      {
        top: window.scrollY,
        left: window.scrollX,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      undefined,
      gap,
    );
    setPosition((current) => (samePlacement(current, next) ? current : next));
  }, [gap]);

  const anchor = shown.anchorRect;
  const anchorKey = anchor
    ? `${anchor.top}:${anchor.left}:${anchor.width}:${anchor.height}`
    : '';

  useLayoutEffect(() => {
    if (!rendered) {
      setPosition(null);
      return;
    }
    reposition();
  }, [anchorKey, rendered, reposition]);

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!rendered || !node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => reposition());
    observer.observe(node);
    return () => observer.disconnect();
  }, [rendered, reposition]);

  useLayoutEffect(() => {
    if (phase !== 'measuring' || !position) {
      return;
    }
    if (shownRef.current.motion === 'instant') {
      setPhase('open');
      return;
    }
    // Let the closed-state styles apply first so the entrance transitions.
    const frame = window.requestAnimationFrame(() => setPhase('open'));
    return () => window.cancelAnimationFrame(frame);
  }, [phase, position]);

  useEffect(() => {
    if (phase === 'open') {
      onEnteredRef.current?.();
    }
  }, [phase]);

  if (!rendered) {
    return null;
  }
  const mount = getAnnotationMount();
  if (!mount) {
    return null;
  }

  return createPortal(
    <div
      className={['sep-plus-app', 'sep-annotation-overlay', dark ? 'is-dark' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div
        {...rest}
        ref={nodeRef}
        className={['sep-popover', className].filter(Boolean).join(' ')}
        style={{ left: position?.left ?? 0, top: position?.top ?? 0 }}
        data-sep-plus-annotation-ui=""
        data-state={phase}
        data-motion={shown.motion}
        data-placement={position?.placement ?? 'above'}
        aria-hidden={phase === 'closing' ? true : undefined}
      >
        {shown.children}
      </div>
    </div>,
    mount,
  );
}
