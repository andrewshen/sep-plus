import { useRef } from 'react';
import type { HighlightColor, ThemePreference } from '../../lib/types';
import type {
  AnnotationExportFormat,
  AnnotationExportResult,
  AnnotationExportScope,
} from '../annotations/useAnnotations';
import { IconMore } from '../icons';
import { IconButton } from '../ui/IconButton';
import { useDismiss } from '../ui/useDismiss';
import { SettingsPopover } from './SettingsPopover';

const SETTINGS_POPOVER_ID = 'sep-settings-popover';

type SettingsMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dark: boolean;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  highlightColor: HighlightColor;
  onHighlightColorChange: (color: HighlightColor) => void;
  onExportAnnotations: (
    format: AnnotationExportFormat,
    scope: AnnotationExportScope,
  ) => Promise<AnnotationExportResult>;
};

/** The ⋯ button and its settings popover, shared by the header and homepage. */
export function SettingsMenu({
  open,
  onOpenChange,
  dark,
  theme,
  onThemeChange,
  highlightColor,
  onHighlightColorChange,
  onExportAnnotations,
}: SettingsMenuProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const close = () => onOpenChange(false);

  useDismiss(anchorRef, open, close);

  return (
    <div className="sep-header-anchor" ref={anchorRef}>
      <IconButton
        label="Settings"
        expanded={open}
        controls={SETTINGS_POPOVER_ID}
        onClick={() => onOpenChange(!open)}
      >
        <IconMore />
      </IconButton>
      <SettingsPopover
        id={SETTINGS_POPOVER_ID}
        open={open}
        dark={dark}
        theme={theme}
        onThemeChange={onThemeChange}
        highlightColor={highlightColor}
        onHighlightColorChange={onHighlightColorChange}
        onExport={onExportAnnotations}
        onClose={close}
      />
    </div>
  );
}
