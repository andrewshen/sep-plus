import { useEffect, useState, type RefObject } from 'react';
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
import {
  skippedLabel,
  type AnnotationExportResult,
  type AnnotationExportScope,
} from '../annotations/useAnnotations';
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
  ) => Promise<AnnotationExportResult>;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function SettingsPopover({
  id,
  open,
  dark,
  theme,
  onThemeChange,
  highlightColor,
  onHighlightColorChange,
  onExport,
  onClose,
  returnFocusRef,
}: SettingsPopoverProps) {
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState(DEFAULT_EXPORT_FORMAT);

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
      const { skipped } = await onExport(exportFormat, 'all');
      setExportError(null);
      if (skipped) {
        // Keep the popover open so the partial export doesn't go unnoticed.
        setExportNotice(
          `Exported, but skipped ${skippedLabel(skipped)} that couldn’t be read.`,
        );
        return;
      }
      setExportNotice(null);
      onClose();
    } catch (error: unknown) {
      setExportNotice(null);
      setExportError(
        error instanceof Error ? error.message : 'Could not export annotations.',
      );
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
      onExited={() => {
        setExportError(null);
        setExportNotice(null);
      }}
    >
      {exportError ? (
        <div className="sep-popover-message is-error" role="alert">
          {exportError}
        </div>
      ) : null}
      {exportNotice ? (
        <div className="sep-popover-message" role="status">
          {exportNotice}
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
        label="Send feedback"
        trailing="Email"
        href={FEEDBACK_HREF}
        onClick={onClose}
      />
    </Popover>
  );
}
