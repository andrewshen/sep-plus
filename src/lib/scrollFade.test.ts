/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackScrollFade } from './scrollFade';

type Metrics = { scrollHeight: number; clientHeight: number; scrollTop: number };

function scroller(metrics: Metrics): HTMLElement {
  const el = document.createElement('div');
  for (const key of ['scrollHeight', 'clientHeight', 'scrollTop'] as const) {
    Object.defineProperty(el, key, {
      configurable: true,
      get: () => metrics[key],
    });
  }
  document.body.appendChild(el);
  return el;
}

function fades(el: HTMLElement): [boolean, boolean] {
  return [el.hasAttribute('data-fade-top'), el.hasAttribute('data-fade-bottom')];
}

const flushMutations = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('trackScrollFade', () => {
  it('fades only the edges that have more content past them', () => {
    const metrics = { scrollHeight: 100, clientHeight: 100, scrollTop: 0 };
    const el = scroller(metrics);
    const stop = trackScrollFade(el);
    expect(fades(el)).toEqual([false, false]);

    metrics.scrollHeight = 300;
    el.dispatchEvent(new Event('scroll'));
    expect(fades(el)).toEqual([false, true]);

    metrics.scrollTop = 100;
    el.dispatchEvent(new Event('scroll'));
    expect(fades(el)).toEqual([true, true]);

    metrics.scrollTop = 200;
    el.dispatchEvent(new Event('scroll'));
    expect(fades(el)).toEqual([true, false]);
    stop();
  });

  it('updates when the content changes', async () => {
    const metrics = { scrollHeight: 100, clientHeight: 100, scrollTop: 0 };
    const el = scroller(metrics);
    const stop = trackScrollFade(el);
    metrics.scrollHeight = 400;
    el.append(document.createElement('p'));
    await flushMutations();
    expect(fades(el)).toEqual([false, true]);
    stop();
  });

  it('watches children so in-place growth updates the fade', async () => {
    const observed = new Set<Element>();
    let notify: (() => void) | null = null;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe(target: Element): void {
          observed.add(target);
        }
        disconnect(): void {
          observed.clear();
        }
      },
    );
    const metrics = { scrollHeight: 100, clientHeight: 100, scrollTop: 0 };
    const el = scroller(metrics);
    const first = document.createElement('p');
    el.append(first);
    const stop = trackScrollFade(el);
    expect(observed).toEqual(new Set([el, first]));

    const second = document.createElement('p');
    el.replaceChildren(second);
    await flushMutations();
    expect(observed).toEqual(new Set([el, second]));

    metrics.scrollHeight = 250;
    notify!();
    expect(fades(el)).toEqual([false, true]);

    stop();
    expect(observed.size).toBe(0);
  });

  it('removes its attributes and stops listening on cleanup', () => {
    const metrics = { scrollHeight: 300, clientHeight: 100, scrollTop: 100 };
    const el = scroller(metrics);
    const stop = trackScrollFade(el);
    expect(fades(el)).toEqual([true, true]);
    stop();
    expect(fades(el)).toEqual([false, false]);
    el.dispatchEvent(new Event('scroll'));
    expect(fades(el)).toEqual([false, false]);
  });
});
