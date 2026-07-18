export type ThemePreference = 'light' | 'dark' | 'auto';

export type TocItem = {
  href: string;
  text: string;
  level: 1 | 2 | 3;
};

export type SidebarTab = 'contents' | 'highlights' | 'notes';
