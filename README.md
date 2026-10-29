# SEP+

SEP+ is a browser extension for the Stanford Encyclopedia of Philosophy that redesigns the reading experience: better typography, dark mode, a persistent contents sidebar, hover-preview footnotes and citations, highlights and notes, and a `⌘K` command palette for jumping between entries.

Install the extension on the [Chrome Web Store](https://chrome.google.com/webstore/detail/sep%2B/falicmbacjghbjdmmnaagmbkpgiphbbg).

## Features

- Improved typography and layout for better readability, with light, dark, and system themes
- Redesigned header, homepage, search page, and footer
- Collapsible sidebar with the entry's table of contents and site navigation
- `⌘K` / `Ctrl K` command palette with typeahead search to jump to any SEP entry (`/` also focuses search)
- Footnotes shown as hover/tap previews instead of jumping down the page
- Bibliography citations shown as previews inline, with PhilPapers search links
- Local text highlights and margin notes, with selectable highlight colors and JSON or Markdown export
- Print-optimized styles (inlines footnotes, removes irrelevant sections)

## Development

```bash
npm install
npm run dev
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist/chrome` folder created by Vite/CRXJS
4. Open any SEP article (e.g. https://plato.stanford.edu/entries/rawls/)

With `npm run dev` running, content-script changes hot-reload (refresh the page if the UI does not update).

### Firefox

Firefox 140 or later is required.

```bash
npm run dev:firefox                         # rebuilds dist/firefox on change
npx web-ext run --source-dir dist/firefox   # in a second terminal; reloads on rebuild
```

Or open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/firefox/manifest.json`.

### Scripts

```bash
npm run build         # production builds → dist/chrome and dist/firefox
npm run typecheck     # type-check without emitting
npm test              # run the vitest suite
npm run lint:firefox  # web-ext lint on dist/firefox
npm run zip:chrome    # fresh production build, packaged → artifacts/
npm run zip:firefox
```

CI runs `typecheck`, `test`, both builds, and `lint:firefox` on every push and pull request (see `.github/workflows/ci.yml`).

### Publishing to Firefox Add-ons

The build is bundled and minified, so AMO asks for the source code. Upload a zip of the repository (without `node_modules`, `dist`, or `artifacts`) along with these build instructions: Node 22, `npm ci && npm run build:firefox`, output in `dist/firefox`.

## Project structure

- `manifest.config.ts` — Manifest V3 config (via `@crxjs/vite-plugin`), with per-browser background and Firefox settings
- `src/host/` — Vanilla TS/CSS that styles and augments SEP's own DOM (footnotes, table of contents, site nav, boot styles) and runs at `document_start`
- `src/content/` — React app (sidebar, command palette, icons) mounted into a Shadow DOM tree under `#sep-plus-root`
- `src/lib/` — Shared types, storage helpers, entry index, and title formatting used by both the host and content layers

## Notes

- Sidebar / command palette UI mounts in a Shadow DOM tree under `#sep-plus-root`.
- Theme and annotations are stored locally in the current browser profile.
- Annotation exports are plaintext. Export a JSON backup before uninstalling the
  extension, because Chrome and Firefox both remove extension-local annotation
  data on uninstall.

SEP+ only has access to [plato.stanford.edu](https://plato.stanford.edu) and will never serve ads or collect user data.
