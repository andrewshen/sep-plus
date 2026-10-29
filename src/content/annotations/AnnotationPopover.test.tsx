/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnotationPopover } from './AnnotationPopover';
import type { AnnotationListItem } from './useAnnotations';

const ANNOTATION: AnnotationListItem = {
  id: 'one',
  selector: {
    quote: { type: 'TextQuoteSelector', exact: 'Quoted', prefix: '', suffix: '' },
    position: { type: 'TextPositionSelector', start: 0, end: 6 },
  },
  note: '',
  createdAt: 1,
  updatedAt: 1,
  resolved: true,
};

const RECT = { top: 100, right: 300, bottom: 120, left: 200, width: 100, height: 20 };

let mount: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  const layer = document.createElement('div');
  layer.id = 'sep-plus-annotation-layer';
  document.body.appendChild(layer);
  mount = document.createElement('div');
  mount.id = 'sep-plus-annotation-mount';
  layer.attachShadow({ mode: 'open' }).appendChild(mount);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function renderPopover(overrides: Partial<Parameters<typeof AnnotationPopover>[0]> = {}) {
  const props = {
    annotation: ANNOTATION,
    anchorRect: RECT,
    dark: false,
    onSaveNote: vi.fn(() => Promise.resolve()),
    onDelete: vi.fn(() => Promise.resolve()),
    onDismiss: vi.fn(),
    ...overrides,
  };
  const result = render(<AnnotationPopover {...props} />);
  const textarea = () => mount.querySelector('textarea')!;
  const alert = () => mount.querySelector('[role="alert"]');
  return { ...result, props, textarea, alert };
}

async function settle(ms = 400): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('AnnotationPopover', () => {
  it('autosaves the trimmed note after a pause', async () => {
    const { props, textarea } = renderPopover();
    fireEvent.change(textarea(), { target: { value: '  A note  ' } });
    expect(props.onSaveNote).not.toHaveBeenCalled();
    await settle();
    expect(props.onSaveNote).toHaveBeenCalledWith('A note');
  });

  it('flushes an unsaved edit when it closes mid-debounce', () => {
    const { props, textarea, unmount } = renderPopover();
    fireEvent.change(textarea(), { target: { value: 'Quick' } });
    unmount();
    expect(props.onSaveNote).toHaveBeenCalledWith('Quick');
  });

  it('shows an inline error with Retry when a save fails', async () => {
    const onSaveNote = vi
      .fn<(note: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('QUOTA_BYTES exceeded'))
      .mockResolvedValue(undefined);
    const { textarea, alert } = renderPopover({ onSaveNote });
    fireEvent.change(textarea(), { target: { value: 'Keep me' } });
    await settle();
    expect(alert()?.textContent).toContain('QUOTA_BYTES exceeded');
    expect(textarea().value).toBe('Keep me');

    const retry = alert()?.querySelector('button');
    expect(retry?.textContent).toBe('Retry');
    fireEvent.click(retry!);
    await settle(0);
    expect(onSaveNote).toHaveBeenCalledTimes(2);
    expect(onSaveNote).toHaveBeenLastCalledWith('Keep me');
    expect(alert()).toBeNull();
  });

  it('retries a failed save when it closes', async () => {
    const onSaveNote = vi
      .fn<(note: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const { textarea, unmount } = renderPopover({ onSaveNote });
    fireEvent.change(textarea(), { target: { value: 'Unsaved' } });
    await settle();
    unmount();
    expect(onSaveNote).toHaveBeenCalledTimes(2);
  });

  it('asks for a reload, without Retry, after the extension updates', async () => {
    const onSaveNote = vi.fn(() =>
      Promise.reject(new Error('Extension context invalidated.')),
    );
    const { textarea, alert } = renderPopover({ onSaveNote });
    fireEvent.change(textarea(), { target: { value: 'Late' } });
    await settle();
    expect(alert()?.textContent).toContain('Reload the page');
    expect(alert()?.querySelector('button')).toBeNull();
  });

  it('does not save a pending edit once delete starts', async () => {
    let finishDelete!: () => void;
    const onDelete = vi.fn(
      () => new Promise<void>((resolve) => (finishDelete = resolve)),
    );
    const { props, textarea, unmount } = renderPopover({ onDelete });
    fireEvent.change(textarea(), { target: { value: 'Doomed' } });
    fireEvent.click(mount.querySelector('button[aria-label="Annotation actions"]')!);
    const deleteButton = Array.from(mount.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Delete'),
    );
    fireEvent.click(deleteButton!);
    await settle();
    finishDelete();
    unmount();
    expect(props.onSaveNote).not.toHaveBeenCalled();
  });
});
