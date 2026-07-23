export type ThemePreference = 'light' | 'dark' | 'auto';

export type TocItem = {
  href: string;
  text: string;
  level: 1 | 2 | 3;
};

export type SiteNavLink = {
  href: string;
  text: string;
};

export type SiteNavSection = {
  title: string;
  links: SiteNavLink[];
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
