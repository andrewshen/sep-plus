export type ThemePreference = 'light' | 'dark' | 'auto';

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export type AnnotationExportFormat = 'json' | 'md' | 'doc';

export type TocItem = {
  href: string;
  text: string;
  level: 1 | 2 | 3;
};

export type EntryIndexItem = {
  title: string;
  href: string;
};

export type EntryIndexCache = {
  fetchedAt: number;
  entries: EntryIndexItem[];
};
