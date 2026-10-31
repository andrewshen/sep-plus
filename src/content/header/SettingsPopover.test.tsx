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

function renderPopover(
  onImport: (file: File) => Promise<string>,
  onExport: () => Promise<void> = vi.fn(async () => undefined),
) {
  const view = render(
    <SettingsPopover
      id="settings"
      open
      dark={false}
      theme="light"
      onThemeChange={vi.fn()}
      highlightColor="yellow"
      onHighlightColorChange={vi.fn()}
      onExport={onExport}
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

describe('SettingsPopover export', () => {
  it('reports a failed export in a native alert', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const onExport = vi.fn(async () => {
      throw new Error('There are no annotations to export.');
    });
    const { getByText, queryByRole } = renderPopover(vi.fn(), onExport);
    fireEvent.click(getByText('Export annotations').closest('button')!);
    await vi.waitFor(() =>
      expect(alert).toHaveBeenCalledWith('There are no annotations to export.'),
    );
    expect(queryByRole('alert')).toBeNull();
  });
});

describe('SettingsPopover import', () => {
  it('opens the file picker from the Import annotations row', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const { getByText } = renderPopover(vi.fn());
    fireEvent.click(getByText('Import annotations').closest('button')!);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('reports the import summary in a native alert', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    const onImport = vi.fn(async () => 'Imported 2 annotations across 1 entry.');
    const { input } = renderPopover(onImport);
    chooseFile(input, file);
    expect(onImport).toHaveBeenCalledWith(file);
    await vi.waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Imported 2 annotations across 1 entry.'),
    );
    expect(input.value).toBe('');
  });

  it('reports a failed import in a native alert', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const onImport = vi.fn(async () => {
      throw new Error('This isn’t a SEP+ annotations export.');
    });
    const { input, queryByRole } = renderPopover(onImport);
    chooseFile(input, new File(['[]'], 'other.json'));
    await vi.waitFor(() =>
      expect(alert).toHaveBeenCalledWith('This isn’t a SEP+ annotations export.'),
    );
    expect(queryByRole('alert')).toBeNull();
  });
});
