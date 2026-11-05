import type {
  AnnotationExportFormat,
  HighlightColor,
  ThemePreference,
} from './types';

const THEME_KEY = 'theme';
const HIGHLIGHT_COLOR_KEY = 'highlightColor';
export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = 'yellow';
const EXPORT_FORMAT_KEY = 'annotationExportFormat';
export const DEFAULT_EXPORT_FORMAT: AnnotationExportFormat = 'json';

/**
 * False once the extension has been updated or reloaded under an open tab:
 * the old content script keeps running, but every chrome.* call throws.
 */
export function extensionAlive(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function isTheme(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'auto';
}

export function isHighlightColor(value: unknown): value is HighlightColor {
  return (
    value === 'yellow' ||
    value === 'green' ||
    value === 'blue' ||
    value === 'pink' ||
    value === 'purple'
  );
}

/**
 * chrome.storage is async, so the theme can't be known before first paint
 * from it alone. Mirror it in the page's localStorage for a synchronous read
 * at document_start.
 */
const THEME_CACHE_KEY = 'sep-plus-theme';

export function readCachedTheme(): ThemePreference | null {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    return isTheme(cached) ? cached : null;
  } catch {
    return null;
  }
}

function cacheTheme(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme);
  } catch {
    // Ignore restricted storage access.
  }
}

export async function getTheme(): Promise<ThemePreference> {
  const result = await chrome.storage.local.get(THEME_KEY);
  const stored = result[THEME_KEY];
  if (isTheme(stored)) {
    cacheTheme(stored);
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

  // First run: follow the system, like the pre-paint background in boot.css.
  await setTheme('auto');
  return 'auto';
}

export async function setTheme(theme: ThemePreference): Promise<void> {
  cacheTheme(theme);
  if (!extensionAlive()) {
    return;
  }
  await chrome.storage.local.set({ [THEME_KEY]: theme });
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
      cacheTheme(next);
      callback(next);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function getHighlightColor(): Promise<HighlightColor> {
  const result = await chrome.storage.local.get(HIGHLIGHT_COLOR_KEY);
  const stored = result[HIGHLIGHT_COLOR_KEY];
  return isHighlightColor(stored) ? stored : DEFAULT_HIGHLIGHT_COLOR;
}

export async function setHighlightColor(color: HighlightColor): Promise<void> {
  if (!extensionAlive()) {
    return;
  }
  await chrome.storage.local.set({ [HIGHLIGHT_COLOR_KEY]: color });
}

export function onHighlightColorChanged(
  callback: (color: HighlightColor) => void
): () => void {
  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
    changes,
    area
  ) => {
    if (area !== 'local' || !changes[HIGHLIGHT_COLOR_KEY]) {
      return;
    }
    const next = changes[HIGHLIGHT_COLOR_KEY].newValue;
    if (isHighlightColor(next)) {
      callback(next);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
function isExportFormat(value: unknown): value is AnnotationExportFormat {
  return value === 'json' || value === 'md' || value === 'doc';
}

export async function getExportFormat(): Promise<AnnotationExportFormat> {
  const result = await chrome.storage.local.get(EXPORT_FORMAT_KEY);
  const stored = result[EXPORT_FORMAT_KEY];
  return isExportFormat(stored) ? stored : DEFAULT_EXPORT_FORMAT;
}

export async function setExportFormat(format: AnnotationExportFormat): Promise<void> {
  if (!extensionAlive()) {
    return;
  }
  await chrome.storage.local.set({ [EXPORT_FORMAT_KEY]: format });
}

export function onExportFormatChanged(
  callback: (format: AnnotationExportFormat) => void
): () => void {
  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
    changes,
    area
  ) => {
    if (area !== 'local' || !changes[EXPORT_FORMAT_KEY]) {
      return;
    }
    const next = changes[EXPORT_FORMAT_KEY].newValue;
    if (isExportFormat(next)) {
      callback(next);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
