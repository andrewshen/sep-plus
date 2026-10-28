import { useRef } from 'react';
import type { HighlightColor, ThemePreference } from '../../lib/types';
import type {
  AnnotationExportFormat,
  AnnotationExportScope,
  AnnotationListItem,
} from '../annotations/useAnnotations';
import { IconAnnotations, SepLogo } from '../icons';
import { IconButton } from '../ui/IconButton';
import { useDismiss } from '../ui/useDismiss';
import { AnnotationsPopover } from './AnnotationsPopover';
import { Search } from './SearchPopover';
import { SettingsMenu } from './SettingsMenu';
import { useHeaderBorder } from './useHeaderBorder';

export type HeaderPopover = 'search' | 'annotations' | 'settings';

const ANNOTATIONS_POPOVER_ID = 'sep-annotations-popover';

type HeaderProps = {
  articleMode: boolean;
  /** Off on full-page search, which shows its own field above the results. */
  showSearch: boolean;
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
  showSearch,
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
  const scrolled = useHeaderBorder();
  function close(): void {
    onOpenPopoverChange(null);
  }

  function toggle(popover: HeaderPopover): void {
    onOpenPopoverChange(openPopover === popover ? null : popover);
  }

  useDismiss(annotationsRef, openPopover === 'annotations', close);

  return (
    <header className={scrolled ? 'sep-header is-scrolled' : 'sep-header'}>
      <a
        href="https://plato.stanford.edu/"
        className="sep-header-logo"
        aria-label="Stanford Encyclopedia of Philosophy home"
      >
        <SepLogo />
      </a>

      {showSearch ? (
        <Search
          open={openPopover === 'search'}
          onOpen={() => onOpenPopoverChange('search')}
          onClose={close}
        />
      ) : null}

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
        <SettingsMenu
          open={openPopover === 'settings'}
          onOpenChange={(next) => onOpenPopoverChange(next ? 'settings' : null)}
          dark={dark}
          theme={theme}
          onThemeChange={onThemeChange}
          highlightColor={highlightColor}
          onHighlightColorChange={onHighlightColorChange}
          onExportAnnotations={onExportAnnotations}
        />
      </div>
    </header>
  );
}
