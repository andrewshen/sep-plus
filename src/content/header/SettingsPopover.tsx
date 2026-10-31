import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  HIGHLIGHT_COLOR_OPTIONS,
  highlightColorValue,
} from '../../lib/highlightColors';
import {
  DEFAULT_EXPORT_FORMAT,
  getExportFormat,
  onExportFormatChanged,
  setExportFormat as storeExportFormat,
} from '../../lib/storage';
import type {
  AnnotationExportFormat,
  HighlightColor,
  ThemePreference,
} from '../../lib/types';
import type { AnnotationExportScope } from '../annotations/useAnnotations';
import { IconMoon, IconSun } from '../icons';
import { Popover } from '../ui/Popover';
import { PopoverRow } from '../ui/PopoverRow';

const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'System' },
];

const EXPORT_FORMAT_OPTIONS: ReadonlyArray<{
  value: AnnotationExportFormat;
  label: string;
}> = [
  { value: 'json', label: 'JSON' },
  { value: 'md', label: 'Markdown' },
  { value: 'doc', label: 'Word' },
];

const FEEDBACK_HREF = `mailto:me@andrewshen.net?subject=${encodeURIComponent(
  'SEP+ Feedback',
)}`;

function optionLabel<T extends string>(
  options: ReadonlyArray<{ value: T; label: string }>,
  value: T,
): string {
  return options.find((option) => option.value === value)?.label ?? '';
}

type SettingsPopoverProps = {
  id: string;
  open: boolean;
  dark: boolean;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  highlightColor: HighlightColor;
  onHighlightColorChange: (color: HighlightColor) => void;
  onExport: (
    format: AnnotationExportFormat,
    scope: AnnotationExportScope,
  ) => Promise<void>;
  /** Resolves to a summary of what was imported. */
  onImport: (file: File) => Promise<string>;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

type SettingsMessage = { text: string; error: boolean };

export function SettingsPopover({
  id,
  open,
  dark,
  theme,
  onThemeChange,
  highlightColor,
  onHighlightColorChange,
  onExport,
  onImport,
  onClose,
  returnFocusRef,
}: SettingsPopoverProps) {
  const [message, setMessage] = useState<SettingsMessage | null>(null);
  const [exportFormat, setExportFormat] = useState(DEFAULT_EXPORT_FORMAT);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getExportFormat().then(
      (format) => {
        if (!cancelled) {
          setExportFormat(format);
        }
      },
      () => undefined,
    );
    const unsubscribe = onExportFormatChanged(setExportFormat);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function runExport(): Promise<void> {
    try {
      await onExport(exportFormat, 'all');
      setMessage(null);
      onClose();
    } catch (error: unknown) {
      setMessage({
        text:
          error instanceof Error ? error.message : 'Could not export annotations.',
        error: true,
      });
    }
  }

  // Stays open afterwards so the summary is visible.
  async function runImport(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    // Cleared so choosing the same file again still fires `change`.
    input.value = '';
    if (!file) {
      return;
    }
    try {
      setMessage({ text: await onImport(file), error: false });
    } catch (error: unknown) {
      setMessage({
        text:
          error instanceof Error ? error.message : 'Could not import annotations.',
        error: true,
      });
    }
  }

  return (
    <Popover
      id={id}
      open={open}
      align="end"
      title="Settings"
      ariaLabel="Settings"
      className="sep-popover--tight-bottom"
      returnFocusRef={returnFocusRef}
      onExited={() => setMessage(null)}
    >
      {message ? (
        <div
          className={
            message.error ? 'sep-popover-message is-error' : 'sep-popover-message'
          }
          role={message.error ? 'alert' : 'status'}
        >
          {message.text}
        </div>
      ) : null}
      <PopoverRow
        label="Appearance"
        trailing={
          <>
            {dark ? <IconMoon /> : <IconSun />}
            {optionLabel(THEME_OPTIONS, theme)}
          </>
        }
        select={{
          value: theme,
          options: THEME_OPTIONS,
          ariaLabel: 'Appearance',
          onChange: onThemeChange,
        }}
      />
      <PopoverRow
        label="Highlight color"
        trailing={
          <>
            <span className="sep-swatch-slot">
              <span
                className="sep-swatch"
                style={{ background: highlightColorValue(highlightColor) }}
              />
            </span>
            {optionLabel(HIGHLIGHT_COLOR_OPTIONS, highlightColor)}
          </>
        }
        select={{
          value: highlightColor,
          options: HIGHLIGHT_COLOR_OPTIONS,
          ariaLabel: 'Highlight color',
          onChange: onHighlightColorChange,
        }}
      />
      <PopoverRow
        label="Annotations format"
        trailing={optionLabel(EXPORT_FORMAT_OPTIONS, exportFormat)}
        select={{
          value: exportFormat,
          options: EXPORT_FORMAT_OPTIONS,
          ariaLabel: 'Annotations format',
          onChange: (format) => {
            setExportFormat(format);
            storeExportFormat(format).catch(() => undefined);
          },
        }}
      />
      <PopoverRow
        label="Export annotations"
        trailing="Download"
        onClick={() => void runExport()}
      />
      <PopoverRow
        label="Import annotations"
        trailing="Choose file"
        onClick={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => void runImport(event.currentTarget)}
      />
      <PopoverRow
        label="Send feedback"
        trailing="Email"
        href={FEEDBACK_HREF}
        onClick={onClose}
      />
    </Popover>
  );
}
