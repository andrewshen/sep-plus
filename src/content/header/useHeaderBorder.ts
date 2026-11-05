import { useEffect, useState } from 'react';
import { HEADER_HEIGHT } from '../../host/toc';

const TITLE_SELECTOR = '#article-content h1, .sep-plus-content-column h1';

/** Gap between the title's line box and the top of its ascenders, in ems:
 *  7.5px at 45px Public Sans Bold on a 50.4px line, measured. */
const TITLE_INK_INSET_EM = 7.5 / 45;

/** Document scroll offset at which the title's glyphs reach the header's
 *  bottom edge; 0 when the page has no title. */
function borderThreshold(): number {
  const title = document.querySelector<HTMLElement>(TITLE_SELECTOR);
  if (!title) {
    return 0;
  }
  const fontSize = Number.parseFloat(getComputedStyle(title).fontSize) || 0;
  const titleTop = title.getBoundingClientRect().top + window.scrollY;
  return Math.max(titleTop + fontSize * TITLE_INK_INSET_EM - HEADER_HEIGHT, 0);
}

/** Whether page content has scrolled up under the header. */
export function useHeaderBorder(): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;

    function update(): void {
      frame = 0;
      const threshold = borderThreshold();
      setScrolled(window.scrollY > 0 && window.scrollY >= threshold);
    }

    function schedule(): void {
      if (!frame) {
        frame = requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return scrolled;
}
