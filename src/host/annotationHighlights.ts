import { scrollWindowTo } from './scroll';

export type ResolvedAnnotationRange = {
  id: string;
  range: Range;
};

export class AnnotationHighlightRenderer {
  private readonly ranges = new Map<string, Range>();

  redraw(resolved: readonly ResolvedAnnotationRange[]): void {
    this.ranges.clear();
    for (const item of resolved) {
      this.ranges.set(item.id, item.range);
    }
  }

  getRange(annotationId: string): Range | null {
    return this.ranges.get(annotationId) ?? null;
  }

  annotationAtPoint(clientX: number, clientY: number): string | null {
    const matches: Array<{ id: string; length: number }> = [];
    for (const [id, range] of this.ranges) {
      const hit = Array.from(range.getClientRects()).some(
        (rect) =>
          rect.width > 0 &&
          rect.height > 0 &&
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom,
      );
      if (hit) {
        matches.push({ id, length: range.toString().length });
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
  }
}
