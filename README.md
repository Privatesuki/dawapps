# DAWAPPS Playground

28 offline-capable mini apps. 100% vanilla JavaScript, no framework, no backend, no build step required.

## Structure

```
index.html            Hub: bento grid, live search, category filters, app workspace
manifest.json         PWA manifest (standalone, icons, shortcuts)
sw.js                 Service worker: precaches the shell + all 28 apps
vercel.json           Headers (sw.js never cached, correct manifest type) + build step
assets/
  css/global.css      Shared design system (CSS variables, light/dark)
  css/hub.css         Hub-only styles
  css/myapps.css      My Apps styles
  js/theme.js         Theme + standalone header (loaded by every app)
  js/common.js        Helpers: DAW.$, copy, toast, download, store
  js/apps.js          App registry: single source of truth for the hub
  js/hub.js           Search, filters, routing (#/app-id), install + update prompts
  js/myapps.js        My Apps catalogue (tabs, search/filter/sort, details modal, routing)
  js/qr.js            Offline QR encoder used by the QR generator
  js/i18n.js          Language engine (picker, live translation, RTL)
  i18n/               Language packs: id, jv, ja, de, ko, zh, es, ar (English is the source text)
  icons/              favicon.svg, icon-192/512, maskable-512, apple-touch-icon
apps/                 One self-contained HTML file per mini app (28)
  serial-monitor.html   Web Serial + Web Bluetooth live monitor      (IoT & Embedded)
  snippet-vault.html    JSON-driven C++ snippet viewer                (IoT & Embedded)
  electronics-calc.html Ohm's law, resistor colors, ADC mapping       (IoT & Embedded)
data/
  snippets.json       Snippet catalogue (metadata only): edit this to add snippets
  snippets/*.ino      One code file per snippet (loaded on demand, cached offline)
  my-apps.json        My Apps catalogue (Dwix Labs software): the only file to edit to add an app
scripts/
  stamp-sw.mjs        Stamps sw.js with a build id on each deploy
  validate-snippets.mjs  Checks snippets.json before every build (fails the deploy on mistakes)
  validate-my-apps.mjs   Checks my-apps.json before every build
```

## Deploy to Vercel

1. Push this folder to a Git repo (or run `vercel` from the folder).
2. Import it in Vercel. Framework preset: **Other**. No settings to change; `vercel.json` already sets
   the build command (`node scripts/validate-snippets.mjs && node scripts/validate-my-apps.mjs && node scripts/stamp-sw.mjs`) and output directory (`.`).
3. Attach the domain `dawapps.vercel.app`.

Each deploy gets a new cache id, so installed copies show an "Update available" prompt.

## Add an app

1. Create `apps/my-app.html` (copy any existing app as a template).
2. Add an entry to `assets/js/apps.js`.
3. Add `'apps/my-app.html'` to `PRECACHE` in `sw.js`.

## IoT & Embedded: add a code snippet (no HTML changes)

1. Save the sketch as `data/snippets/my_sketch.ino`.
2. Append an entry to `snippets` in `data/snippets.json`.
3. Add both `'data/snippets/my_sketch.ino'` to `PRECACHE` in `sw.js` (so it works offline).
4. Run `node scripts/validate-snippets.mjs`, then deploy. The vault, the hub search and the deep link
   `#/snippet-vault/<id>` pick it up automatically.

```json
{
  "schema": 1,
  "boards": { "esp32": "ESP32", "esp8266": "ESP8266", "arduino": "Arduino Uno / Nano" },
  "snippets": [
    {
      "id": "my-sketch",                 // lowercase, digits, dashes; used in the URL
      "title": "Short title",
      "summary": "One line shown on cards and in search results.",
      "description": "Optional longer text on the detail page.",
      "category": "Display",             // free text: Control, Display, Networking, Sensors...
      "boards": ["esp32", "arduino"],    // keys of "boards"
      "difficulty": "Beginner",          // Beginner | Intermediate | Advanced
      "tags": ["oled", "i2c"],           // extra search keywords
      "libraries": [ { "name": "Adafruit SSD1306", "note": "Library Manager" } ],
      "wiring": [ { "from": "OLED SDA", "to": "GPIO 21" } ],
      "notes": ["Free-text tips and warnings."],
      "filename": "my_sketch.ino",       // used by Download
      "language": "cpp",
      "codeFile": "data/snippets/my_sketch.ino"   // or "code": "..." / ["line 1", "line 2"]
    }
  ]
}
```

Required: `id`, `title`, `summary`, `filename`, `boards`, `tags`, and `codeFile` or `code`.
Snippet text is shown as written (not translated). The vault also has an "Add your own snippet" template to copy.

Web Serial / Web Bluetooth work in Chromium browsers (Chrome, Edge, Opera; Bluetooth also on Android) over HTTPS
or localhost. `vercel.json` sends `Permissions-Policy: serial=(self), bluetooth=(self)` and the hub iframe allows both.
Safari and Firefox show a notice instead.

## My Apps (Dwix Labs software catalogue)

DAW Apps is the website; **Dwix Labs** is the publisher of the downloadable software listed under **My Apps**
(`#/my-apps`, with platform tabs Android / iOS / Windows / Linux). Deep links: `#/my-apps/<platform>` and
`#/my-apps/<platform>/<app-id>` (opens the details modal).

### Add an application (JSON only, no frontend changes)

1. Build the installer and upload it to **external hosting** (GitHub Releases or Cloudflare R2). Do not commit installers
   to this repo; the service worker never caches installers.
2. Copy the direct download URL (it must be a full `https://` URL).
3. Optionally add an icon to `assets/my-apps/` (PNG/SVG/WebP) or use an emoji.
4. Append an object to `apps` in `data/my-apps.json`, run `node scripts/validate-my-apps.mjs`, deploy.

```json
{
  "id": "my-app",                      // lowercase, digits, dashes; used in the URL
  "name": "My App",
  "description": "One or two sentences.",
  "platform": "windows",               // android | ios | windows | linux
  "category": "Networking",            // free text: new categories appear in the filter automatically
  "version": "1.0.0",                  // or null
  "fileSize": "48 MB",                 // string, a number of bytes, or null
  "releaseDate": "2026-12-01",         // YYYY-MM-DD or null
  "status": "available",               // available | coming-soon | not-released
  "fileName": "my-app.exe",            // shown in the details
  "downloadUrl": "https://github.com/<owner>/<repo>/releases/download/v1.0.0/my-app.exe",
  "icon": "assets/my-apps/my-app.png", // image path / https URL, or an emoji
  "changelog": [ { "version": "1.0.0", "date": "2026-12-01", "notes": ["First release"] } ],
  "requirements": ["Windows 10 or later", "64-bit"]
}
```

- The **Download** button only appears when `status` is `available` **and** `downloadUrl` is a valid `https://` URL.
  Otherwise the card shows a disabled "Coming soon" / "Not released" / "Download unavailable" state, so a link is never invented.
  The validator fails the build for an `available` app without a URL.
- Release flow: leave `status` as `coming-soon`, upload the file, then set `status: "available"` and fill `downloadUrl`,
  `version`, `fileSize`, `releaseDate`.
- GitHub Releases: attach the file to a release, then use `https://github.com/<owner>/<repo>/releases/download/<tag>/<file>`.
  Cloudflare R2: enable a public bucket / custom domain and use `https://<your-domain>/<file>`.
- Copyright in the footer (`© <current year> Dwix Labs`) is generated with JavaScript.

## Local preview

```
python3 -m http.server 8000
```
The service worker only runs on `localhost` or HTTPS.

## Notes

- The Code Scanner uses the browser's built-in `BarcodeDetector` (Chrome, Edge, Android). Browsers without it
  show a clear notice instead of failing silently.
- Camera access needs HTTPS (Vercel provides it).

## Languages

English (International), Bahasa Indonesia, Basa Jawa, 日本語, Deutsch, 한국어, 中文（简体）, Español, العربية (right-to-left).

- A picker sits in the hub header and in every app's top bar. The choice is saved on the device and shared by the hub and all apps; open apps change language instantly.
- First visit: the browser language is used when supported, otherwise English.
- No markup changes are needed to translate: the English text in the HTML/JS is the key, and `assets/i18n/<code>.js` maps it to the translation. Keys can contain `{}` placeholders (`"Showing {} of {}"`); use `{2}` / `{1}` to reorder them.
- To add a language: add it to `LANGS` in `assets/js/i18n.js`, create `assets/i18n/<code>.js`, and list the file in `PRECACHE` in `sw.js`.
- To translate new UI text: add the English string as a key to each pack. Anything without an entry simply stays in English.
- Mark an element `translate="no"` to exclude it from translation.
