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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  // happy-dom returns a fresh `CSS` object per access, so stub the global.
  it('grows the note to its content when field-sizing is unsupported', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    const scrollHeight = vi
      .spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(20);
    const { textarea } = renderPopover();
    expect(textarea().style.height).toBe('20px');

    scrollHeight.mockReturnValue(60);
    fireEvent.change(textarea(), { target: { value: 'Line one\nLine two\nLine three' } });
    expect(textarea().style.height).toBe('60px');
  });

  it('fits a saved multi-line note before the popover first measures itself', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(60);
    const heightsAtPlacement: string[] = [];
    const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains('sep-annotation-popover')) {
        heightsAtPlacement.push(this.querySelector('textarea')!.style.height);
      }
      return offsetHeight.get!.call(this) as number;
    });
    renderPopover({ annotation: { ...ANNOTATION, note: 'One\nTwo\nThree' } });
    expect(heightsAtPlacement[0]).toBe('60px');
  });

  it('refits the note when its width changes, not on its own height changes', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    const observers: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push(callback);
        }
        observe(): void {}
        disconnect(): void {}
      },
    );
    const scrollHeight = vi
      .spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(20);
    const clientWidth = vi
      .spyOn(HTMLTextAreaElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(360);
    const { textarea } = renderPopover();
    const notify = () =>
      act(() => {
        for (const callback of observers) {
          callback([], {} as ResizeObserver);
        }
      });

    scrollHeight.mockReturnValue(40);
    notify();
    expect(textarea().style.height).toBe('20px');

    clientWidth.mockReturnValue(300);
    notify();
    expect(textarea().style.height).toBe('40px');
  });

  it('leaves the note to field-sizing when supported', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    const { textarea } = renderPopover();
    expect(textarea().style.height).toBe('');
  });

  it('flushes an unsaved edit when it closes mid-debounce', () => {
    const { props, textarea, unmount } = renderPopover();
    fireEvent.change(textarea(), { target: { value: 'Quick' } });
    unmount();
    expect(props.onSaveNote).toHaveBeenCalledWith('Quick');
  });

  it('shows a clickable inline error that retries when a save fails', async () => {
    const onSaveNote = vi
      .fn<(note: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('QUOTA_BYTES exceeded'))
      .mockResolvedValue(undefined);
    const { textarea, alert } = renderPopover({ onSaveNote });
    fireEvent.change(textarea(), { target: { value: 'Keep me' } });
    await settle();
    expect(alert()?.textContent).toBe('Couldn’t save, click to retry');
    expect(textarea().value).toBe('Keep me');

    fireEvent.click(alert()!.querySelector('button')!);
    await settle(0);
    expect(onSaveNote).toHaveBeenCalledTimes(2);
    expect(onSaveNote).toHaveBeenLastCalledWith('Keep me');
    expect(alert()).toBeNull();
  });

  it('copies and closes the menu without a Copied label', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    renderPopover();
    fireEvent.click(mount.querySelector('[aria-label="Annotation actions"]')!);
    const item = Array.from(mount.querySelectorAll('[role="menuitem"]')).find((el) =>
      el.textContent?.includes('Copy'),
    )!;
    fireEvent.click(item);
    await settle(0);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(mount.textContent).not.toContain('Copied');
    expect(
      mount.querySelector('[aria-label="Annotation actions"][aria-expanded]')?.getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('clears the error once the note is back to what’s saved', async () => {
    const onSaveNote = vi.fn(() => Promise.reject(new Error('offline')));
    const { textarea, alert } = renderPopover({ onSaveNote });
    fireEvent.change(textarea(), { target: { value: 'Draft' } });
    await settle();
    expect(alert()).not.toBeNull();

    fireEvent.change(textarea(), { target: { value: '' } });
    await settle(0);
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

  it('offers a reload after the extension updates', async () => {
    const onSaveNote = vi.fn(() =>
      Promise.reject(new Error('Extension context invalidated.')),
    );
    const { textarea, alert } = renderPopover({ onSaveNote });
    fireEvent.change(textarea(), { target: { value: 'Late' } });
    await settle();
    expect(alert()?.textContent).toBe('Reload page to keep saving');
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      reload,
    } as Location);
    fireEvent.click(alert()!.querySelector('button')!);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onSaveNote).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('sep-plus:pending-note:one')).toBe('Late');
    sessionStorage.clear();
    vi.restoreAllMocks();
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
