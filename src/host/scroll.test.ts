/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollWindowTo } from './scroll';

afterEach(() => {
  vi.restoreAllMocks();
});

function startScroll() {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: 10000,
  });
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  const cancel = vi.spyOn(window, 'cancelAnimationFrame');
  scrollWindowTo(2000);
  cancel.mockClear();
  return cancel;
}

describe('scrollWindowTo', () => {
  it('keeps animating through Tab and Enter after a keyboard jump', () => {
    const cancel = startScroll();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(cancel).not.toHaveBeenCalled();
  });

  it('stops when a key scrolls the page', () => {
    const cancel = startScroll();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }));
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
