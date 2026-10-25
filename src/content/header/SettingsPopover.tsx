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
import { IconChevronLeft, IconMoon, IconSun } from '../icons';
import { Popover } from '../ui/Popover';
import { PopoverRow } from '../ui/PopoverRow';

const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'System' },
];

const EXPORT_OPTIONS: ReadonlyArray<{
  format: AnnotationExportFormat;
  scope: AnnotationExportScope;
  label: string;
}> = [
  { format: 'json', scope: 'entry', label: 'This entry · JSON' },
  { format: 'md', scope: 'entry', label: 'This entry · Markdown' },
  { format: 'json', scope: 'all', label: 'All entries · JSON' },
  { format: 'md', scope: 'all', label: 'All entries · Markdown' },
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
  const [view, setView] = useState<'root' | 'export'>('root');
  const [exportError, setExportError] = useState<string | null>(null);

  async function runExport(
    format: AnnotationExportFormat,
    scope: AnnotationExportScope,
  ): Promise<void> {
    try {
      await onExport(format, scope);
      onClose();
    } catch (error: unknown) {
      setExportError(
        error instanceof Error ? error.message : 'Could not export annotations.',
      );
    }
  }

  const title =
    view === 'root' ? (
      'Settings'
    ) : (
      <button
        type="button"
        className="sep-popover-back"
        onClick={() => {
          setView('root');
          setExportError(null);
        }}
      >
        <IconChevronLeft />
        Export annotations
      </button>
    );

  return (
    <Popover
      id={id}
      open={open}
      align="end"
      title={title}
      ariaLabel="Settings"
      onExited={() => {
        setView('root');
        setExportError(null);
      }}
    >
      {view === 'root' ? (
        <>
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
            onClick={() => setView('export')}
          />
          <PopoverRow
            label="Send feedback"
            href={FEEDBACK_HREF}
            onClick={onClose}
          />
        </>
      ) : (
        <>
          {exportError ? (
            <div className="sep-popover-message is-error" role="alert">
              {exportError}
            </div>
          ) : null}
          {EXPORT_OPTIONS.map((option) => (
            <PopoverRow
              key={`${option.scope}-${option.format}`}
              label={option.label}
              disabled={option.scope === 'entry' && !canExportEntry}
              onClick={() => void runExport(option.format, option.scope)}
            />
          ))}
        </>
      )}
    </Popover>
  );
}
