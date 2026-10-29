/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRollback,
  detachNative,
  onRollback,
  rememberChildren,
  replaceNative,
  rollbackHost,
} from './rollback';

afterEach(() => {
  clearRollback();
  document.body.innerHTML = '';
});

describe('rollback', () => {
  it('re-inserts detached nodes where they were, newest first', () => {
    document.body.innerHTML =
      '<ul id="list"><li id="a">A</li><li id="b">B</li><li id="c">C</li></ul>';
    detachNative(document.getElementById('b'));
    detachNative(document.getElementById('c'));
    detachNative(document.getElementById('a'));
    expect(document.getElementById('list')?.children).toHaveLength(0);

    rollbackHost();
    const ids = Array.from(document.getElementById('list')!.children).map(
      (child) => child.id,
    );
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('restores replaced nodes and remembered children', () => {
    document.body.innerHTML = '<nav id="pager">1 2 3</nav><p id="info">Old</p>';
    const replacement = document.createElement('div');
    replaceNative(document.getElementById('pager')!, replacement);
    const info = document.getElementById('info')!;
    rememberChildren(info);
    info.replaceChildren('New');

    rollbackHost();
    expect(document.getElementById('pager')?.textContent).toBe('1 2 3');
    expect(info.textContent).toBe('Old');
  });

  it('keeps going when one restore throws', () => {
    let restored = false;
    onRollback(() => {
      restored = true;
    });
    onRollback(() => {
      throw new Error('boom');
    });
    rollbackHost();
    expect(restored).toBe(true);
  });

  it('ignores nodes that are already detached', () => {
    const orphan = document.createElement('div');
    detachNative(orphan);
    detachNative(null);
    expect(() => rollbackHost()).not.toThrow();
  });
});
