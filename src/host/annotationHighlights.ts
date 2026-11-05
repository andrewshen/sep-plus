import { scrollWindowTo } from './scroll';

export type ResolvedAnnotationRange = {
  id: string;
  range: Range;
};

type PageRect = { left: number; top: number; right: number; bottom: number };

export class AnnotationHighlightRenderer {
  private readonly ranges = new Map<string, Range>();
  /** Page-space rects per range, so hover hit-tests don't force layout on
   *  every pointer move. Cleared whenever layout may have changed. */
  private rects: Map<string, { rects: PageRect[]; length: number }> | null =
    null;

  redraw(resolved: readonly ResolvedAnnotationRange[]): void {
    this.ranges.clear();
    for (const item of resolved) {
      this.ranges.set(item.id, item.range);
    }
    this.invalidateLayout();
  }

  /** Call when the page reflows (resize, fonts, images). */
  invalidateLayout(): void {
    this.rects = null;
  }

  getRange(annotationId: string): Range | null {
    return this.ranges.get(annotationId) ?? null;
  }

  private pageRects(): Map<string, { rects: PageRect[]; length: number }> {
    if (!this.rects) {
      this.rects = new Map();
      for (const [id, range] of this.ranges) {
        this.rects.set(id, {
          rects: Array.from(range.getClientRects())
            .filter((rect) => rect.width > 0 && rect.height > 0)
            .map((rect) => ({
              left: rect.left + window.scrollX,
              top: rect.top + window.scrollY,
              right: rect.right + window.scrollX,
              bottom: rect.bottom + window.scrollY,
            })),
          length: range.toString().length,
        });
      }
    }
    return this.rects;
  }

  annotationAtPoint(clientX: number, clientY: number): string | null {
    const x = clientX + window.scrollX;
    const y = clientY + window.scrollY;
    const matches: Array<{ id: string; length: number }> = [];
    for (const [id, { rects, length }] of this.pageRects()) {
      const hit = rects.some(
        (rect) =>
          x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
      );
      if (hit) {
        matches.push({ id, length });
      }
    }
    matches.sort(
      (left, right) =>
        left.length - right.length || left.id.localeCompare(right.id),
    );
    return matches[0]?.id ?? null;
  }

  scrollTo(annotationId: string, offset = 96): boolean {
    const range = this.ranges.get(annotationId);
    if (!range) {
      return false;
    }
    const rect = range.getBoundingClientRect();
    scrollWindowTo(window.scrollY + rect.top - offset);
    return true;
  }

  clear(): void {
    this.ranges.clear();
    this.invalidateLayout();
  }
}
