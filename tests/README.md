# Preference checks

Run the storage regression tests from either frontend folder:

```sh
node --test tests/preferences.test.cjs
```

The browser checks in the official frontend cover both frontend folders. They require Playwright and a Chromium browser. Serve the workspace root (the directory containing both frontends and the backend) in a separate terminal:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Then run from the official frontend:

```sh
node --test tests/privacy-browser.test.cjs
```

Use `NODE_PATH` if Playwright is provided by a shared runtime. `MCSA_BROWSER_EXECUTABLE` can select an installed Chrome/Edge executable, and `MCSA_TEST_BASE_URL` can override the server address. Optional `MCSA_SCREENSHOT_DIR` saves desktop, mobile and settings screenshots to an existing directory.

The official-site checks substitute a successful backend snapshot and test API address inside the isolated browser context; they do not change deployment configuration. They also simulate an unavailable backend. The provisional-site checks use its local-data loading path. Each test uses an isolated browser profile; no personal browser data is touched.

## English translation checks

Start `python tests/translation_browser_server.py` from the backend directory
instead of the static server above. It serves an isolated CMS on port 8766 and
the workspace on port 8765, with a temporary SQLite database and fake translator.
Then run `node --test tests/translation-browser.test.cjs` here. This checks English
routes at desktop/mobile sizes, missing translations, filter and language
preservation, and the real CMS publish/draft/approve/preview/glossary flow.
The same browser and screenshot environment variables above apply.
