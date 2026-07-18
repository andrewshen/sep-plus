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
  permissions: ['storage'],
  host_permissions: [
    'http://plato.stanford.edu/*',
    'https://plato.stanford.edu/*',
  ],
  content_scripts: [
    {
      matches: [
        'http://plato.stanford.edu/*',
        'https://plato.stanford.edu/*',
      ],
      js: ['src/content/main.tsx'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: [
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
