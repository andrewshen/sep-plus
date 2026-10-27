import { useRef } from 'react';
import type { HighlightColor, ThemePreference } from '../../lib/types';
import type {
  AnnotationExportFormat,
  AnnotationExportScope,
  AnnotationListItem,
} from '../annotations/useAnnotations';
import { IconAnnotations, IconMore, SepLogo } from '../icons';
import { IconButton } from '../ui/IconButton';
import { useDismiss } from '../ui/useDismiss';
import { AnnotationsPopover } from './AnnotationsPopover';
import { Search } from './SearchPopover';
import { SettingsPopover } from './SettingsPopover';

export type HeaderPopover = 'search' | 'annotations' | 'settings';

const ANNOTATIONS_POPOVER_ID = 'sep-annotations-popover';
const SETTINGS_POPOVER_ID = 'sep-settings-popover';

type HeaderProps = {
  articleMode: boolean;
  dark: boolean;
  openPopover: HeaderPopover | null;
  onOpenPopoverChange: (next: HeaderPopover | null) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  highlightColor: HighlightColor;
  onHighlightColorChange: (color: HighlightColor) => void;
  annotations: AnnotationListItem[];
  annotationsLoading: boolean;
  annotationsError: string | null;
  onScrollToAnnotation: (annotationId: string) => boolean;
  onExportAnnotations: (
    format: AnnotationExportFormat,
    scope: AnnotationExportScope,
  ) => Promise<void>;
};

export function Header({
  articleMode,
  dark,
  openPopover,
  onOpenPopoverChange,
  theme,
  onThemeChange,
  highlightColor,
  onHighlightColorChange,
  annotations,
  annotationsLoading,
  annotationsError,
  onScrollToAnnotation,
  onExportAnnotations,
}: HeaderProps) {
  const annotationsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  function close(): void {
    onOpenPopoverChange(null);
  }

  function toggle(popover: HeaderPopover): void {
    onOpenPopoverChange(openPopover === popover ? null : popover);
  }

  useDismiss(annotationsRef, openPopover === 'annotations', close);
  useDismiss(settingsRef, openPopover === 'settings', close);

  return (
    <header className="sep-header">
      <a
        href="https://plato.stanford.edu/"
        className="sep-header-logo"
        aria-label="Stanford Encyclopedia of Philosophy home"
      >
        <SepLogo />
      </a>

      <Search
        open={openPopover === 'search'}
        onOpen={() => onOpenPopoverChange('search')}
        onClose={close}
      />

      <div className="sep-header-actions">
        {articleMode ? (
          <div className="sep-header-anchor" ref={annotationsRef}>
            <IconButton
              label="Annotations"
              expanded={openPopover === 'annotations'}
              controls={ANNOTATIONS_POPOVER_ID}
              onClick={() => toggle('annotations')}
            >
              <IconAnnotations />
            </IconButton>
            <AnnotationsPopover
              id={ANNOTATIONS_POPOVER_ID}
              open={openPopover === 'annotations'}
              annotations={annotations}
              loading={annotationsLoading}
              error={annotationsError}
              onScrollTo={onScrollToAnnotation}
              onClose={close}
            />
          </div>
        ) : null}
        <div className="sep-header-anchor" ref={settingsRef}>
          <IconButton
            label="Settings"
            expanded={openPopover === 'settings'}
            controls={SETTINGS_POPOVER_ID}
            onClick={() => toggle('settings')}
          >
            <IconMore />
          </IconButton>
          <SettingsPopover
            id={SETTINGS_POPOVER_ID}
            open={openPopover === 'settings'}
            dark={dark}
            theme={theme}
            onThemeChange={onThemeChange}
            highlightColor={highlightColor}
            onHighlightColorChange={onHighlightColorChange}
            onExport={onExportAnnotations}
            onClose={close}
          />
        </div>
      </div>
    </header>
  );
}
