/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPopover } from './SettingsPopover';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { id: 'test' },
    storage: {
      local: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined) },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  } as unknown as typeof chrome);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderPopover(onImport: (file: File) => Promise<string>) {
  const view = render(
    <SettingsPopover
      id="settings"
      open
      dark={false}
      theme="light"
      onThemeChange={vi.fn()}
      highlightColor="yellow"
      onHighlightColorChange={vi.fn()}
      onExport={vi.fn(async () => undefined)}
      onImport={onImport}
      onClose={vi.fn()}
    />,
  );
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  return { ...view, input };
}

function chooseFile(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('SettingsPopover import', () => {
  it('opens the file picker from the Import annotations row', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const { getByText } = renderPopover(vi.fn());
    fireEvent.click(getByText('Import annotations').closest('button')!);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('shows the import summary as a status message', async () => {
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    const onImport = vi.fn(async () => 'Imported 2 annotations across 1 entry.');
    const { input, findByRole } = renderPopover(onImport);
    chooseFile(input, file);
    expect(onImport).toHaveBeenCalledWith(file);
    const status = await findByRole('status');
    expect(status.textContent).toBe('Imported 2 annotations across 1 entry.');
    expect(status.classList.contains('is-error')).toBe(false);
    expect(input.value).toBe('');
  });

  it('shows a failed import as an alert', async () => {
    const onImport = vi.fn(async () => {
      throw new Error('This isn’t a SEP+ annotations export.');
    });
    const { input, findByRole } = renderPopover(onImport);
    chooseFile(input, new File(['[]'], 'other.json'));
    const alert = await findByRole('alert');
    expect(alert.textContent).toBe('This isn’t a SEP+ annotations export.');
    expect(alert.classList.contains('is-error')).toBe(true);
  });
});
