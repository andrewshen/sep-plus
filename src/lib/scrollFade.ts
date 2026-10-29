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
  // (footnote text, note edits) both change what overflows.
  const resize =
    typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
  resize?.observe(el);
  const mutations =
    typeof MutationObserver === 'function' ? new MutationObserver(update) : null;
  mutations?.observe(el, { childList: true, subtree: true, characterData: true });

  return () => {
    el.removeEventListener('scroll', update);
    resize?.disconnect();
    mutations?.disconnect();
    el.removeAttribute('data-fade-top');
    el.removeAttribute('data-fade-bottom');
  };
}
