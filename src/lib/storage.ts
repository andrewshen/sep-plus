import type { ThemePreference } from './types';

const THEME_KEY = 'theme';
const SIDEBAR_COLLAPSED_KEY = 'sepPlusSidebarCollapsed';

function isTheme(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'auto';
}

export async function getTheme(): Promise<ThemePreference> {
  const result = await chrome.storage.local.get(THEME_KEY);
  const stored = result[THEME_KEY];
  if (isTheme(stored)) {
    return stored;
  }

  // One-time migrate from the previous localStorage key.
  try {
    const legacy = localStorage.getItem(THEME_KEY);
    if (isTheme(legacy)) {
      await setTheme(legacy);
      localStorage.removeItem(THEME_KEY);
      return legacy;
    }
  } catch {
    // Ignore restricted storage access.
  }

  await setTheme('light');
  return 'light';
}

export async function setTheme(theme: ThemePreference): Promise<void> {
  await chrome.storage.local.set({ [THEME_KEY]: theme });
}

export function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Ignore restricted storage access.
  }
}

export function onThemeChanged(
  callback: (theme: ThemePreference) => void
): () => void {
  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
    changes,
    area
  ) => {
    if (area !== 'local' || !changes[THEME_KEY]) {
      return;
    }
    const next = changes[THEME_KEY].newValue;
    if (isTheme(next)) {
      callback(next);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
