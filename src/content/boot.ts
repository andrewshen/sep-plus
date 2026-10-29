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
