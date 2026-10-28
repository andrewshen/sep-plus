import { useCallback, useEffect, useRef, type PointerEvent } from 'react';

type SpringConfig = { stiffness: number; damping: number };

/** Apple-style spring: perceptual duration plus bounce (0 = none, ~0.3 = lively). */
function spring(duration: number, bounce: number): SpringConfig {
  const omega = (2 * Math.PI) / duration;
  return {
    stiffness: omega * omega,
    damping: 2 * (1 - bounce) * omega,
  };
}

// Press settles fast with no overshoot; release gets a subtle bounce (0.1-0.3).
const PRESS_SPRING = spring(0.14, 0);
const RELEASE_SPRING = spring(0.35, 0.25);
const PRESSED_SCALE = 0.88;

const STEP = 1 / 240;
const MAX_FRAME = 1 / 30;
const REST_DELTA = 0.0005;
const REST_SPEED = 0.01;

/**
 * Press the logo: it springs down on pointer down, then springs back up (with
 * a little bounce) on release, calling `onPress` if the pointer is still over
 * it. The spring keeps its velocity when retargeted, so a fast tap reverses
 * smoothly mid-motion.
 */
export function useLogoPress(onPress: () => void) {
  const ref = useRef<HTMLSpanElement>(null);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const motion = useRef({
    value: 1,
    velocity: 0,
    target: 1,
    config: RELEASE_SPRING,
    frame: 0,
    last: 0,
    down: false,
  });

  const apply = useCallback(() => {
    const el = ref.current;
    if (el) {
      const { value } = motion.current;
      el.style.transform = value === 1 ? '' : `scale(${value})`;
    }
  }, []);

  const tick = useCallback(
    (now: number) => {
      const m = motion.current;
      let remaining = Math.min((now - m.last) / 1000, MAX_FRAME);
      m.last = now;
      while (remaining > 0) {
        const h = Math.min(STEP, remaining);
        const force =
          -m.config.stiffness * (m.value - m.target) -
          m.config.damping * m.velocity;
        m.velocity += force * h;
        m.value += m.velocity * h;
        remaining -= h;
      }
      if (
        Math.abs(m.value - m.target) < REST_DELTA &&
        Math.abs(m.velocity) < REST_SPEED
      ) {
        m.value = m.target;
        m.velocity = 0;
        m.frame = 0;
        apply();
        return;
      }
      apply();
      m.frame = requestAnimationFrame(tick);
    },
    [apply],
  );

  const animateTo = useCallback(
    (target: number, config: SpringConfig) => {
      const m = motion.current;
      m.target = target;
      m.config = config;
      if (!m.frame) {
        m.last = performance.now();
        m.frame = requestAnimationFrame(tick);
      }
    },
    [tick],
  );

  useEffect(() => {
    const m = motion.current;
    return () => cancelAnimationFrame(m.frame);
  }, []);

  const reduceMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLSpanElement>) => {
      if (event.button !== 0 || motion.current.down) {
        return;
      }
      motion.current.down = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (!reduceMotion()) {
        animateTo(PRESSED_SCALE, PRESS_SPRING);
      }
    },
    [animateTo],
  );

  const release = useCallback(
    (event: PointerEvent<HTMLSpanElement>, commit: boolean) => {
      const m = motion.current;
      if (!m.down) {
        return;
      }
      m.down = false;
      const el = event.currentTarget;
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      if (commit) {
        const rect = el.getBoundingClientRect();
        const inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;
        if (inside) {
          onPressRef.current();
        }
      }
      if (!reduceMotion()) {
        animateTo(1, RELEASE_SPRING);
      }
    },
    [animateTo],
  );

  return {
    ref,
    onPointerDown,
    onPointerUp: (event: PointerEvent<HTMLSpanElement>) => release(event, true),
    onPointerCancel: (event: PointerEvent<HTMLSpanElement>) =>
      release(event, false),
  };
}
