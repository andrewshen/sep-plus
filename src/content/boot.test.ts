/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import {
  boot,
  clearRewrittenPageReload,
  isRewrittenByEarlierInstance,
  reloadRewrittenPage,
  type BootOptions,
} from './boot';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeTimers() {
  let nextId = 1;
  const timers = new Map<number, { callback: () => void; ms: number }>();
  return {
    setTimer: (callback: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { callback, ms });
      return id;
    },
    clearTimer: (id: number | undefined) => {
      if (id !== undefined) {
        timers.delete(id);
      }
    },
    fire(ms: number) {
      for (const [id, timer] of timers) {
        if (timer.ms === ms) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
    pending: () => timers.size,
  };
}

function options(overrides: Partial<BootOptions> = {}) {
  const timers = fakeTimers();
  const opts: BootOptions = {
    isHtmlDocument: true,
    waitForDomReady: () => Promise.resolve(),
    hasSepLayout: () => true,
    mount: () => Promise.resolve(),
    release: vi.fn(),
    reveal: vi.fn(),
    rollback: vi.fn(),
    parseTimeoutMs: 15000,
    mountTimeoutMs: 8000,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    ...overrides,
  };
  return { opts, timers };
}

describe('boot', () => {
  it('reveals once mounting finishes and clears its timers', async () => {
    const { opts, timers } = options();
    await boot(opts);
    expect(opts.reveal).toHaveBeenCalled();
    expect(opts.rollback).not.toHaveBeenCalled();
    expect(timers.pending()).toBe(0);
  });

  it('reveals non-HTML documents immediately without mounting', async () => {
    const mount = vi.fn(() => Promise.resolve());
    const { opts } = options({ isHtmlDocument: false, mount });
    await boot(opts);
    expect(opts.reveal).toHaveBeenCalledTimes(1);
    expect(mount).not.toHaveBeenCalled();
  });

  it('skips mounting on pages without SEP layout', async () => {
    const mount = vi.fn(() => Promise.resolve());
    const { opts } = options({ hasSepLayout: () => false, mount });
    await boot(opts);
    expect(mount).not.toHaveBeenCalled();
    expect(opts.release).toHaveBeenCalledTimes(1);
    expect(opts.rollback).not.toHaveBeenCalled();
    expect(opts.reveal).toHaveBeenCalled();
  });

  it('rolls back and reveals when mounting throws', async () => {
    const error = new Error('render failed');
    const { opts } = options({ mount: () => Promise.reject(error) });
    await boot(opts);
    expect(opts.rollback).toHaveBeenCalledWith(error);
    expect(opts.reveal).toHaveBeenCalled();
  });

  it('reveals on a stalled mount but still lets it finish', async () => {
    const mounting = deferred();
    const mounted = vi.fn();
    const { opts, timers } = options({
      mount: () => mounting.promise.then(mounted),
    });
    const done = boot(opts);
    await Promise.resolve();
    await Promise.resolve();
    timers.fire(8000);
    expect(opts.reveal).toHaveBeenCalledTimes(1);
    mounting.resolve();
    await done;
    expect(mounted).toHaveBeenCalled();
    expect(opts.rollback).not.toHaveBeenCalled();
  });

  it('reveals if DOMContentLoaded stalls, then mounts when it arrives', async () => {
    const domReady = deferred();
    const mount = vi.fn(() => Promise.resolve());
    const { opts, timers } = options({
      waitForDomReady: () => domReady.promise,
      mount,
    });
    const done = boot(opts);
    timers.fire(15000);
    expect(opts.reveal).toHaveBeenCalledTimes(1);
    expect(mount).not.toHaveBeenCalled();
    domReady.resolve();
    await done;
    expect(mount).toHaveBeenCalled();
  });

  it('starts the mount timeout only after the DOM is ready', async () => {
    const domReady = deferred();
    const { opts, timers } = options({ waitForDomReady: () => domReady.promise });
    const done = boot(opts);
    timers.fire(8000);
    expect(opts.reveal).not.toHaveBeenCalled();
    domReady.resolve();
    await done;
  });
});

function fakeDocument(
  readyState: DocumentReadyState,
  html = '',
): Document {
  const doc = document.implementation.createHTMLDocument('');
  doc.documentElement.innerHTML = html ? `<body>${html}</body>` : '<body></body>';
  Object.defineProperty(doc, 'readyState', { value: readyState });
  return doc;
}

describe('isRewrittenByEarlierInstance', () => {
  it('detects a loaded page an earlier copy rewrote', () => {
    const byClass = fakeDocument('complete');
    byClass.documentElement.classList.add('sep-plus');
    expect(isRewrittenByEarlierInstance(byClass)).toBe(true);
    expect(
      isRewrittenByEarlierInstance(
        fakeDocument('interactive', '<div id="sep-plus-root"></div>'),
      ),
    ).toBe(true);
  });

  it('ignores native pages and pages still loading', () => {
    expect(isRewrittenByEarlierInstance(fakeDocument('complete'))).toBe(false);
    const loading = fakeDocument('loading');
    loading.documentElement.classList.add('sep-plus');
    expect(isRewrittenByEarlierInstance(loading)).toBe(false);
  });
});

describe('reloadRewrittenPage', () => {
  it('reloads once, then not again until a normal start clears the flag', () => {
    sessionStorage.clear();
    const reload = vi.fn();
    const storage = () => sessionStorage;
    reloadRewrittenPage(storage, reload);
    reloadRewrittenPage(storage, reload);
    expect(reload).toHaveBeenCalledTimes(1);

    reloadRewrittenPage(storage, reload);
    clearRewrittenPageReload(storage);
    reloadRewrittenPage(storage, reload);
    expect(reload).toHaveBeenCalledTimes(3);
    sessionStorage.clear();
  });

  it('does not reload without sessionStorage', () => {
    const reload = vi.fn();
    reloadRewrittenPage(() => {
      throw new Error('SecurityError');
    }, reload);
    expect(reload).not.toHaveBeenCalled();
  });
});
