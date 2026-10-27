import { useState } from 'react';
import {
  HIGHLIGHT_COLOR_OPTIONS,
  highlightColorValue,
} from '../../lib/highlightColors';
import type { HighlightColor, ThemePreference } from '../../lib/types';
import type {
  AnnotationExportFormat,
  AnnotationExportScope,
} from '../annotations/useAnnotations';
import { IconMoon, IconSun } from '../icons';
import { Popover } from '../ui/Popover';
import { PopoverRow } from '../ui/PopoverRow';

const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'System' },
];

type ExportChoice = `${AnnotationExportScope}:${AnnotationExportFormat}`;

const EXPORT_GROUPS: Record<AnnotationExportScope, string> = {
  entry: 'This entry',
  all: 'All entries',
};

const EXPORT_FORMATS: ReadonlyArray<{
  format: AnnotationExportFormat;
  label: string;
}> = [
  { format: 'json', label: 'JSON' },
  { format: 'md', label: 'Markdown' },
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
  canExportEntry: boolean;
  onExport: (
    format: AnnotationExportFormat,
    scope: AnnotationExportScope,
  ) => Promise<void>;
  onClose: () => void;
};

export function SettingsPopover({
  id,
  open,
  dark,
  theme,
  onThemeChange,
  highlightColor,
  onHighlightColorChange,
  canExportEntry,
  onExport,
  onClose,
}: SettingsPopoverProps) {
  const [exportError, setExportError] = useState<string | null>(null);

  const exportOptions = (['entry', 'all'] as const).flatMap((scope) =>
    EXPORT_FORMATS.map(({ format, label }) => ({
      value: `${scope}:${format}` as ExportChoice,
      label,
      group: EXPORT_GROUPS[scope],
      disabled: scope === 'entry' && !canExportEntry,
    })),
  );

  async function runExport(choice: ExportChoice): Promise<void> {
    const [scope, format] = choice.split(':') as [
      AnnotationExportScope,
      AnnotationExportFormat,
    ];
    try {
      await onExport(format, scope);
      setExportError(null);
      onClose();
    } catch (error: unknown) {
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
      onExited={() => setExportError(null)}
    >
      {exportError ? (
        <div className="sep-popover-message is-error" role="alert">
          {exportError}
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
        label="Export annotations"
        select={{
          value: '',
          options: exportOptions,
          ariaLabel: 'Export annotations',
          placeholder: 'Choose',
          onChange: (choice) => void runExport(choice),
        }}
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
