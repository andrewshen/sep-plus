import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
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
  permissions: ['storage', 'declarativeNetRequestWithHostAccess'],
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
        'sep-logo.png',
        'sep-logo-white.png',
        'fonts/PublicSans-Regular.woff2',
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
});
