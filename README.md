# SEP+

SEP+ is a browser extension for the Stanford Encyclopedia of Philosophy that improves typography, adds dark mode, a collapsible contents sidebar, hover-preview footnotes, and a `⌘K` command palette for jumping between entries.

Install the extension on the [Chrome Web Store](https://chrome.google.com/webstore/detail/sep%2B/falicmbacjghbjdmmnaagmbkpgiphbbg).

## Features

- Improved typography and layout for better readability, with dark mode
- Collapsible sidebar with the entry's table of contents and site navigation
- `⌘K` / `Ctrl K` command palette to search and jump to any SEP entry (`/` also focuses search)
- Footnotes shown as hover/tap previews instead of jumping down the page
- Local text highlights and notes with JSON or Markdown export
- Print-optimized styles (inlines footnotes, removes irrelevant sections)

## Development

```bash
npm install
npm run dev
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist` folder created by Vite/CRXJS
4. Open any SEP article (e.g. https://plato.stanford.edu/entries/rawls/)

With `npm run dev` running, content-script changes hot-reload (refresh the page if the UI does not update).

```bash
npm run build      # production build → dist/
npm run typecheck  # type-check without emitting
npm test           # run the vitest suite
```

CI runs `typecheck` and `test` on every push and pull request (see `.github/workflows/ci.yml`).

## Project structure

- `manifest.config.ts` — Manifest V3 config (via `@crxjs/vite-plugin`)
- `src/host/` — Vanilla TS/CSS that styles and augments SEP's own DOM (footnotes, table of contents, site nav, boot styles) and runs at `document_start`
- `src/content/` — React app (sidebar, command palette, icons) mounted into a Shadow DOM tree under `#sep-plus-root`
- `src/lib/` — Shared types, storage helpers, entry index, and title formatting used by both the host and content layers

## Notes

- Sidebar / command palette UI mounts in a Shadow DOM tree under `#sep-plus-root`.
- Theme and annotations are stored locally in the current Chrome profile.
- Annotation exports are plaintext. Export a JSON backup before uninstalling the
  extension, because Chrome removes extension-local annotation data on uninstall.

SEP+ only has access to [plato.stanford.edu](https://plato.stanford.edu) and will never serve ads or collect user data.
