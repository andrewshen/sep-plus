export type ThemePreference = 'light' | 'dark' | 'auto';

export type TocItem = {
  href: string;
  text: string;
  level: 1 | 2 | 3;
};

export type SidebarSurface = 'toc' | 'annotations' | 'settings';

export type EntryIndexItem = {
  title: string;
  href: string;
};

export type EntryIndexCache = {
  fetchedAt: number;
  entries: EntryIndexItem[];
};
