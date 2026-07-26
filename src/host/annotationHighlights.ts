const HIGHLIGHT_NAME = 'sep-plus-annotation';
const HOVER_HIGHLIGHT_NAME = 'sep-plus-annotation-hover';

export type ResolvedAnnotationRange = {
  id: string;
  range: Range;
};

type HighlightRegistrySubset = Pick<HighlightRegistry, 'delete' | 'set'>;
type HighlightFactory = (ranges: Range[]) => Highlight;

function defaultRegistry(): HighlightRegistrySubset | null {
  return typeof CSS !== 'undefined' && 'highlights' in CSS
    ? CSS.highlights
    : null;
}

function defaultFactory(): HighlightFactory | null {
  return typeof Highlight === 'undefined'
    ? null
    : (ranges) => new Highlight(...ranges);
}

export class AnnotationHighlightRenderer {
  private readonly ranges = new Map<string, Range>();
  private hoveredId: string | null = null;
  private selectedId: string | null = null;

  constructor(
    private readonly registry = defaultRegistry(),
    private readonly factory = defaultFactory(),
  ) {}

  get supported(): boolean {
    return Boolean(this.registry && this.factory);
  }

  redraw(resolved: readonly ResolvedAnnotationRange[]): void {
    this.registry?.delete(HIGHLIGHT_NAME);
    this.registry?.delete(HOVER_HIGHLIGHT_NAME);
    this.ranges.clear();
    for (const item of resolved) {
      this.ranges.set(item.id, item.range);
    }
    if (this.hoveredId && !this.ranges.has(this.hoveredId)) {
      this.hoveredId = null;
    }
    if (this.selectedId && !this.ranges.has(this.selectedId)) {
      this.selectedId = null;
    }
    this.renderHighlights();
  }

  private emphasizedIds(): ReadonlySet<string> {
    const ids = new Set<string>();
    if (this.hoveredId && this.ranges.has(this.hoveredId)) {
      ids.add(this.hoveredId);
    }
    if (this.selectedId && this.ranges.has(this.selectedId)) {
      ids.add(this.selectedId);
    }
    return ids;
  }

  private renderHighlights(): void {
    if (!this.registry || !this.factory) {
      return;
    }
    this.registry.delete(HIGHLIGHT_NAME);
    this.registry.delete(HOVER_HIGHLIGHT_NAME);
    const emphasized = this.emphasizedIds();
    const normalRanges: Range[] = [];
    const emphasizedRanges: Range[] = [];
    for (const [id, range] of this.ranges) {
      if (emphasized.has(id)) {
        emphasizedRanges.push(range);
      } else {
        normalRanges.push(range);
      }
    }
    if (normalRanges.length > 0) {
      this.registry.set(HIGHLIGHT_NAME, this.factory(normalRanges));
    }
    if (emphasizedRanges.length > 0) {
      this.registry.set(
        HOVER_HIGHLIGHT_NAME,
        this.factory(emphasizedRanges),
      );
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

  setHovered(annotationId: string | null): void {
    if (annotationId === this.hoveredId) {
      return;
    }
    this.hoveredId = annotationId;
    this.renderHighlights();
  }

  setSelected(annotationId: string | null): void {
    if (annotationId === this.selectedId) {
      return;
    }
    this.selectedId = annotationId;
    this.renderHighlights();
  }

  scrollTo(annotationId: string, offset = 96): boolean {
    const range = this.ranges.get(annotationId);
    if (!range) {
      return false;
    }
    const rect = range.getBoundingClientRect();
    window.scrollTo({
      top: Math.max(0, window.scrollY + rect.top - offset),
      behavior: 'smooth',
    });
    return true;
  }

  clear(): void {
    this.registry?.delete(HIGHLIGHT_NAME);
    this.registry?.delete(HOVER_HIGHLIGHT_NAME);
    this.ranges.clear();
    this.hoveredId = null;
    this.selectedId = null;
  }
}
