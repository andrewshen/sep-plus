/**
 * Note drafts that couldn't be saved because the extension was updated. Kept
 * in the tab's sessionStorage (it survives the reload; extension storage is
 * unreachable until then) and written back once the entry loads again.
 */
const PREFIX = 'sep-plus:pending-note:';

export function stashPendingNote(annotationId: string, note: string): void {
  try {
    sessionStorage.setItem(PREFIX + annotationId, note);
  } catch {
    // Storage disabled or full; the reload goes ahead without the draft.
  }
}

export function pendingNotes(annotationIds: readonly string[]): Map<string, string> {
  const notes = new Map<string, string>();
  try {
    for (const id of annotationIds) {
      const note = sessionStorage.getItem(PREFIX + id);
      if (note !== null) {
        notes.set(id, note);
      }
    }
  } catch {
    // Storage disabled; nothing was stashed.
  }
  return notes;
}

export function clearPendingNote(annotationId: string): void {
  try {
    sessionStorage.removeItem(PREFIX + annotationId);
  } catch {
    // Storage disabled; nothing to clear.
  }
}
