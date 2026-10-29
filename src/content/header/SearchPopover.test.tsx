/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"url":"https://plato.stanford.edu/entries/kant/"}
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryIndexItem } from '../../lib/types';

const getEntryIndex = vi.fn<() => Promise<EntryIndexItem[]>>();
vi.mock('../../lib/entryIndex', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/entryIndex')>()),
  getEntryIndex: () => getEntryIndex(),
}));

const { Search } = await import('./SearchPopover');

const ENTRIES: EntryIndexItem[] = [
  { title: 'Frege, Gottlob', href: 'https://plato.stanford.edu/entries/frege/' },
  { title: 'Frege’s Logic', href: 'https://plato.stanford.edu/entries/frege-logic/' },
];

function Harness({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <Search open={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} />
  );
}

let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  getEntryIndex.mockReset();
  assign = vi.fn();
  vi.spyOn(window.location, 'assign').mockImplementation(assign);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.head.innerHTML = '';
});

async function flush(ms = 200): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function input(): HTMLInputElement {
  return document.querySelector('input[role="combobox"]') as HTMLInputElement;
}

async function typeQuery(value: string): Promise<void> {
  fireEvent.focus(input());
  await flush();
  fireEvent.change(input(), { target: { value } });
  await flush();
}

function prefetched(): string[] {
  return Array.from(document.querySelectorAll('[data-sep-plus-prefetch]')).map(
    (element) => element.getAttribute('data-sep-plus-prefetch') ?? '',
  );
}

describe('Search', () => {
  it('does not navigate when Enter confirms an IME candidate', async () => {
    getEntryIndex.mockResolvedValue(ENTRIES);
    render(<Harness />);
    await typeQuery('frege');
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input(), { key: 'Enter', keyCode: 229 });
    expect(assign).not.toHaveBeenCalled();

    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(assign).toHaveBeenCalledWith(ENTRIES[0]?.href);
  });

  it('prefetches entry rows but never full-text search rows', async () => {
    getEntryIndex.mockResolvedValue(ENTRIES);
    render(<Harness />);
    await typeQuery('frege');
    expect(prefetched()).toEqual([ENTRIES[0]?.href]);

    fireEvent.change(input(), { target: { value: 'no such entry' } });
    await flush();
    expect(prefetched().some((url) => url.includes('searcher.py'))).toBe(false);
  });

  it('keeps at most three prefetches', async () => {
    const many = Array.from({ length: 6 }, (_, index) => ({
      title: `Frege ${index}`,
      href: `https://plato.stanford.edu/entries/frege-${index}/`,
    }));
    getEntryIndex.mockResolvedValue(many);
    render(<Harness />);
    await typeQuery('frege');
    for (let step = 0; step < 5; step += 1) {
      fireEvent.keyDown(input(), { key: 'ArrowDown' });
      await flush(100);
    }
    expect(prefetched()).toHaveLength(3);
  });

  it('keeps focus in the field after Escape', async () => {
    getEntryIndex.mockResolvedValue(ENTRIES);
    render(<Harness />);
    input().focus();
    await typeQuery('frege');
    fireEvent.keyDown(input(), { key: 'Escape' });
    await flush();
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(input());
  });

  it('retries loading titles on the next open after a failure', async () => {
    getEntryIndex.mockRejectedValueOnce(new Error('offline'));
    getEntryIndex.mockResolvedValue(ENTRIES);
    render(<Harness />);
    await typeQuery('frege');
    expect(getEntryIndex).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input(), { key: 'Escape' });
    await flush();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    await flush();
    expect(getEntryIndex).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[role="option"]')?.textContent).toContain(
      'Frege',
    );
  });
});
