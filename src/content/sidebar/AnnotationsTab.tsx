import { useRef, useState } from 'react';
import type {
  AnnotationExportFormat,
  AnnotationExportScope,
  AnnotationListItem,
} from '../annotations/useAnnotations';

type AnnotationsTabProps = {
  annotations: AnnotationListItem[];
  loading: boolean;
  error: string | null;
  highlightSupported: boolean;
  onScrollTo: (annotationId: string) => boolean;
  onUpdate: (
    annotationId: string,
    update: { note?: string },
  ) => Promise<void>;
  onDelete: (annotationId: string) => Promise<void>;
  onExport: (
    format: AnnotationExportFormat,
    scope: AnnotationExportScope,
  ) => Promise<void>;
};

export function AnnotationsTab({
  annotations,
  loading,
  error,
  highlightSupported,
  onScrollTo,
  onUpdate,
  onDelete,
  onExport,
}: AnnotationsTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const exportRef = useRef<HTMLDetailsElement>(null);

  function beginEditing(annotation: AnnotationListItem): void {
    setEditingId(annotation.id);
    setNote(annotation.note);
  }

  async function saveEdit(): Promise<void> {
    if (!editingId || saving) {
      return;
    }
    setSaving(true);
    try {
      await onUpdate(editingId, { note });
      setEditingId(null);
    } catch {
      // The hook reports storage failures in the shared error message.
    } finally {
      setSaving(false);
    }
  }

  async function runExport(
    format: AnnotationExportFormat,
    scope: AnnotationExportScope,
  ): Promise<void> {
    try {
      await onExport(format, scope);
      if (exportRef.current) {
        exportRef.current.open = false;
      }
    } catch {
      // The hook reports export failures in the shared error message.
    }
  }

  return (
    <div className="sep-annotations">
      <div className="sep-annotations-header">
        <div className="sep-annotations-count">
          {annotations.length} {annotations.length === 1 ? 'item' : 'items'}
        </div>
        <details className="sep-annotation-export" ref={exportRef}>
          <summary>Export</summary>
          <div className="sep-annotation-export-menu">
            <button
              type="button"
              disabled={annotations.length === 0}
              onClick={() => void runExport('json', 'entry')}
            >
              This entry · JSON
            </button>
            <button
              type="button"
              disabled={annotations.length === 0}
              onClick={() => void runExport('md', 'entry')}
            >
              This entry · Markdown
            </button>
            <button
              type="button"
              onClick={() => void runExport('json', 'all')}
            >
              All entries · JSON
            </button>
            <button
              type="button"
              onClick={() => void runExport('md', 'all')}
            >
              All entries · Markdown
            </button>
          </div>
        </details>
      </div>

      {error ? (
        <div className="sep-annotation-message is-error" role="alert">
          {error}
        </div>
      ) : null}
      {!highlightSupported ? (
        <div className="sep-annotation-message">
          This browser can save notes, but it cannot display custom highlights.
        </div>
      ) : null}

      {loading ? <div className="sep-stub">Loading annotations…</div> : null}
      {!loading && annotations.length === 0 ? (
        <div className="sep-annotations-empty">
          Select text in the article to add a highlight or note.
        </div>
      ) : null}

      {annotations.length > 0 ? (
        <div className="sep-annotations-scroll">
          {annotations.map((annotation) => {
            const editing = editingId === annotation.id;
            return (
              <article
                key={annotation.id}
                className={[
                  'sep-annotation-card',
                  annotation.resolved ? '' : 'is-unresolved',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <button
                  type="button"
                  className="sep-annotation-quote"
                  disabled={!annotation.resolved}
                  onClick={() => onScrollTo(annotation.id)}
                >
                  “{annotation.selector.quote.exact}”
                </button>
                {annotation.section ? (
                  <div className="sep-annotation-section">
                    {annotation.section}
                  </div>
                ) : null}
                {!annotation.resolved ? (
                  <div className="sep-annotation-unresolved">
                    Text could not be located in this revision.
                  </div>
                ) : null}

                {editing ? (
                  <div className="sep-annotation-editor">
                    <textarea
                      value={note}
                      autoFocus
                      maxLength={100_000}
                      placeholder="Add a note…"
                      aria-label="Annotation note"
                      onChange={(event) => setNote(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setEditingId(null);
                        }
                        if (
                          (event.metaKey || event.ctrlKey) &&
                          event.key === 'Enter'
                        ) {
                          event.preventDefault();
                          void saveEdit();
                        }
                      }}
                    />
                    <div className="sep-annotation-editor-footer">
                      <div className="sep-annotation-editor-actions">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveEdit()}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {annotation.note ? (
                      <p className="sep-annotation-note">{annotation.note}</p>
                    ) : null}
                    <div className="sep-annotation-card-actions">
                      <button
                        type="button"
                        onClick={() => beginEditing(annotation)}
                      >
                        {annotation.note ? 'Edit' : 'Add note'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void onDelete(annotation.id).catch(() => undefined);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
