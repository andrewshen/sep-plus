type Restore = () => void;

const restores: Restore[] = [];

/** Run `restore` if the boot fails and native SEP has to be put back. */
export function onRollback(restore: Restore): void {
  restores.push(restore);
}

/** Remove a native node, remembering where it lived. */
export function detachNative(node: Node | null | undefined): void {
  const parent = node?.parentNode;
  if (!node || !parent) {
    return;
  }
  const next = node.nextSibling;
  parent.removeChild(node);
  onRollback(() => {
    parent.insertBefore(node, next?.parentNode === parent ? next : null);
  });
}

/** Swap a native node for SEP+ markup, remembering the original. */
export function replaceNative(original: ChildNode, replacement: Node): void {
  original.replaceWith(replacement);
  onRollback(() => {
    if (replacement.parentNode) {
      (replacement as ChildNode).replaceWith(original);
    }
  });
}

/** Keep a copy of `element`'s children so a rollback can restore them. */
export function rememberChildren(element: Element): void {
  const original = Array.from(element.childNodes);
  onRollback(() => element.replaceChildren(...original));
}

/** Undo recorded host edits, newest first. */
export function rollbackHost(): void {
  while (restores.length) {
    const restore = restores.pop();
    try {
      restore?.();
    } catch (error: unknown) {
      console.warn('SEP+ could not restore part of the page.', error);
    }
  }
}

export function clearRollback(): void {
  restores.length = 0;
}
