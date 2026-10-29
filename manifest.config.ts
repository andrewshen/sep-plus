import { defineManifest } from '@crxjs/vite-plugin';

export type TargetBrowser = 'chrome' | 'firefox';

export function createManifest(browser: TargetBrowser) {
  return defineManifest({
    manifest_version: 3,
    name: 'SEP+',
    version: '2.0.0',
    description: 'Improve the Stanford Encyclopedia of Philosophy reading experience',
    homepage_url: 'https://andrewshen.net',
    default_locale: 'en',
    icons: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
    // WithHostAccess (not declarativeNetRequest) so install only shows Plato
    // host access — no "Block content on any page you visit" warning.
    permissions: ['storage', 'unlimitedStorage', 'declarativeNetRequestWithHostAccess'],
    host_permissions: [
      'http://plato.stanford.edu/*',
      'https://plato.stanford.edu/*',
    ],
    // Drop unused Font Awesome CSS (native chrome that used it is hidden).
    // Network-layer block beats the preload scanner; same-origin only so we
    // don't need Google Fonts host permissions or the broader DNR warning.
    declarative_net_request: {
      rule_resources: [
        {
          id: 'block-unused-fonts',
          enabled: true,
          path: 'src/rules/block-unused-fonts.json',
        },
      ],
    },
    // Only used to re-allow Font Awesome in a tab where SEP+ failed to start.
    // Firefox has no extension service workers; it runs this as an event page.
    background:
      browser === 'firefox'
        ? { scripts: ['src/background.ts'] }
        : { service_worker: 'src/background.ts', type: 'module' },
    content_scripts: [
      {
        matches: [
          'http://plato.stanford.edu/*',
          'https://plato.stanford.edu/*',
        ],
        // Declarative CSS is applied before first paint; JS-imported CSS is not.
        css: ['src/host/boot.css'],
        js: ['src/content/main.tsx'],
        run_at: 'document_start',
      },
    ],
    web_accessible_resources: [
      {
        resources: [
          'fonts/PublicSans-Regular.woff2',
          'fonts/PublicSans-Medium.woff2',
          'fonts/PublicSans-Bold.woff2',
          'fonts/LibreBaskerville-Regular.woff2',
          'fonts/LibreBaskerville-Italic.woff2',
          'fonts/LibreBaskerville-SemiBold.woff2',
          'fonts/LibreBaskerville-SemiBoldItalic.woff2',
        ],
        matches: [
          'http://plato.stanford.edu/*',
          'https://plato.stanford.edu/*',
        ],
      },
    ],
    ...(browser === 'firefox' ? FIREFOX_SETTINGS : {}),
  });
}

// Not inlined: CRXJS's manifest types don't know `gecko_android` yet.
const FIREFOX_SETTINGS = {
  browser_specific_settings: {
    gecko: {
      // Never change: Firefox keys storage.local (annotations) to this ID.
      id: 'sep-plus@andrewshen.net',
      // CSS Custom Highlight API and data_collection_permissions; ESR 140.
      strict_min_version: '140.0',
      data_collection_permissions: { required: ['none' as const] },
    },
    // Android got data_collection_permissions in 142, desktop in 140.
    gecko_android: { strict_min_version: '142.0' },
  },
};
