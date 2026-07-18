# SEP+

SEP+ is a browser extension for the Stanford Encyclopedia of Philosophy that improves typography, adds dark mode, a collapsible contents sidebar, and reading affordances.

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
npm run build    # production build → dist/
npm run typecheck
```

## Notes

- Host-page styles live in `src/host/` (they style SEP’s DOM).
- Sidebar / command palette UI mounts in a Shadow DOM tree under `#sep-plus-root`.
- Theme preference is stored in `chrome.storage.local`.

SEP+ only has access to [plato.stanford.edu](https://plato.stanford.edu) and will never serve ads or collect user data.
