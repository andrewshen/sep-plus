export type BootOptions = {
  isHtmlDocument: boolean;
  waitForDomReady: () => Promise<void>;
  /** False on pages without SEP's #container/#content layout. */
  hasSepLayout: () => boolean;
  mount: () => Promise<void>;
  /** Hand a non-SEP-layout page back untouched (theme classes, native fonts). */
  release: () => void;
  reveal: () => void;
  rollback: (error: unknown) => void;
  /** Reveal the page if parsing stalls (DOMContentLoaded never arrives). */
  parseTimeoutMs: number;
  /** Reveal the page if mounting stalls after the DOM is ready. */
  mountTimeoutMs: number;
  setTimer?: (callback: () => void, ms: number) => number;
  clearTimer?: (id: number | undefined) => void;
};

const STALE_RELOAD_KEY = 'sep-plus:stale-reload';

/**
 * Firefox injects content scripts into open tabs when the add-on is installed
 * or updated. If an earlier copy already rewrote this page, the native nodes
 * it detached (and its rollback list) went with it, so this copy can't mount
 * over it or restore SEP.
 */
export function isRewrittenByEarlierInstance(doc: Document): boolean {
  return (
    doc.readyState !== 'loading' &&
    (doc.documentElement.classList.contains('sep-plus') ||
      doc.getElementById('sep-plus-root') !== null)
  );
}

/**
 * Reload a page an earlier copy rewrote, but never twice in a row: the flag
 * is cleared by the next normal start. Without sessionStorage to hold that
 * flag, leave the page alone rather than risk a loop.
 */
export function reloadRewrittenPage(
  getStorage: () => Storage,
  reload: () => void,
): void {
  try {
    const storage = getStorage();
    if (storage.getItem(STALE_RELOAD_KEY)) {
      storage.removeItem(STALE_RELOAD_KEY);
      return;
    }
    storage.setItem(STALE_RELOAD_KEY, '1');
  } catch {
    return;
  }
  reload();
}

export function clearRewrittenPageReload(getStorage: () => Storage): void {
  try {
    getStorage().removeItem(STALE_RELOAD_KEY);
  } catch {
    // Storage disabled; there was no flag to clear.
  }
}

/**
 * Timeouts only reveal the page; they never cancel mounting, so a slow load
 * still ends up enhanced. Any failure rolls back to native SEP.
 */
export async function boot(options: BootOptions): Promise<void> {
  const setTimer =
    options.setTimer ?? ((callback, ms) => window.setTimeout(callback, ms));
  const clearTimer =
    options.clearTimer ?? ((id) => window.clearTimeout(id));

  if (!options.isHtmlDocument) {
    options.reveal();
    return;
  }

  let parseTimer: number | undefined = setTimer(
    options.reveal,
    options.parseTimeoutMs,
  );
  let mountTimer: number | undefined;
  try {
    await options.waitForDomReady();
    clearTimer(parseTimer);
    parseTimer = undefined;
    if (!options.hasSepLayout()) {
      options.release();
      return;
    }
    mountTimer = setTimer(options.reveal, options.mountTimeoutMs);
    await options.mount();
  } catch (error: unknown) {
    options.rollback(error);
  } finally {
    clearTimer(parseTimer);
    clearTimer(mountTimer);
    options.reveal();
  }
}
