/**
 * Mirrors a scroller's overflow into `data-fade-top` / `data-fade-bottom` so
 * CSS can fade the clipped edge (see `.sep-popover-body` in popover.css).
 * Returns a cleanup function.
 */
export function trackScrollFade(el: HTMLElement): () => void {
  function update(): void {
    const max = el.scrollHeight - el.clientHeight;
    const scrollable = max > 1;
    el.toggleAttribute('data-fade-top', scrollable && el.scrollTop > 1);
    el.toggleAttribute('data-fade-bottom', scrollable && el.scrollTop < max - 1);
  }

  update();
  el.addEventListener('scroll', update, { passive: true });
  // Size changes (popover placement, window resize) and content swaps
  // (footnote text, note edits) both change what overflows. The children are
  // observed too: once the scroller is at its max height, content that grows
  // in place (a lazy image, a font swap) doesn't resize the scroller itself.
  const resize =
    typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
  function observeSizes(): void {
    if (!resize) {
      return;
    }
    resize.disconnect();
    resize.observe(el);
    for (const child of Array.from(el.children)) {
      resize.observe(child);
    }
  }
  observeSizes();
  const mutations =
    typeof MutationObserver === 'function'
      ? new MutationObserver((records) => {
          if (records.some((record) => record.type === 'childList' && record.target === el)) {
            observeSizes();
          }
          update();
        })
      : null;
  mutations?.observe(el, { childList: true, subtree: true, characterData: true });

  return () => {
    el.removeEventListener('scroll', update);
    resize?.disconnect();
    mutations?.disconnect();
    el.removeAttribute('data-fade-top');
    el.removeAttribute('data-fade-bottom');
  };
}
