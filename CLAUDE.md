# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GolfStats — an installable PWA (iPhone Safari/Chrome) for a single player: a golf scorecard
with automatic gross/net-stableford calculation, plus on-demand GPS assistance (course
calibration, distance to the flag, real distance of full shots). Current version lives in
[src/version.js](src/version.js) and must stay in sync with `CACHE_NAME` in
[service-worker.js](service-worker.js) — bump both together on every release.

## Commands

No build, no install, no package manager (no `package.json`, no npm dependency graph). Serve
the folder over HTTP — opening `index.html` via `file://` does not work because the Service
Worker and ES modules require an HTTP/HTTPS origin:

```bash
python -m http.server 8765
# then open http://localhost:8765/index.html
```

There is no test suite, linter, or bundler to run. Verify changes by exercising the app in a
browser (see `src/scoring/` for the pure calculation functions if you want to sanity-check
logic in a console instead).

## Non-negotiable principles (from README.md, do not violate silently)

- **No `watchPosition`**: every GPS read is a single `getCurrentPosition` triggered by an
  explicit user action, never continuous tracking.
- **Offline once a course is configured**: Service Worker (cache-first) + IndexedDB. No
  manual-entry feature may depend on the network.
- **GPS complements, never replaces**: any GPS feature (calibration, distance, auto-locate)
  must have an always-available, fully functional manual fallback, including when permission
  is denied or there is no signal.
- **Vanilla HTML/CSS/JS**: no framework, no bundler, no npm dependency unless strictly
  necessary. Only three exceptions exist today, all vendored locally under `src/lib/` and
  never loaded from a CDN: pdf.js (PDF scorecard import), JSZip (ZIP export/share) and jsPDF
  (round PDF export). Same principle for icons: only inline SVG paths in
  [src/icons/icons.js](src/icons/icons.js) (sometimes based on an existing set like Tabler
  Icons, but always inlined, never an icon font or CDN).
- **No silent background save is possible on iPhone**: after an important action (course
  create/edit, round completion), a non-blocking banner
  ([toast.js](src/ui/toast.js)) reminds the user to export, with a direct shortcut into the
  existing export flow — never a silent auto-save attempt.
- **Colors always via theme CSS variables** (`:root` in [style.css](style.css)), never a
  hardcoded color (`#fff`, `#eee`, etc.) next to one that already follows the theme — otherwise
  text/background can diverge and become unreadable in dark mode. This has caused real bugs
  (fixed in 1.2.52 on `.btn-secondary` and `:active` states; in 1.2.54 on `--color-primary`
  used as text color for charts/previews, replaced by `--color-accent-text`).
- **The player is never identified by name**: `Player.trigram` (3 letters) replaced
  `firstName`/`lastName` in 1.2.58 — the GitHub repo (and its `data/` folder, see below) is
  public, and backups are deposited there to be restored on another device.

## Architecture

No framework: [src/main.js](src/main.js) is a hand-rolled router that keeps a navigation stack
of `{ routeName, params }`, looks up a route table (`render` function + `title` + `showBack`),
and calls `route.render(appEl, params, navigate)`. Every screen is one module under
`src/views/` exporting a `render(container, params, navigate)` function. `main.js` also owns
the header's sandwich menu (built from `MENU_ITEMS`/`activateMenuItem` exported by
[src/views/menu.js](src/views/menu.js), so the main menu and the sandwich menu never drift
apart) and the Service Worker registration.

Layer boundaries:

- `src/db/` — [schema.js](src/db/schema.js) opens IndexedDB (stores: players, clubs, courses,
  rounds). [repository.js](src/db/repository.js) is the **only** CRUD access point to that
  data — views never talk to IndexedDB directly. [exportImport.js](src/db/exportImport.js)
  handles full JSON export (zipped via vendored JSZip, shared through the Web Share API with a
  direct-download fallback) and import (`.json` or `.zip`, full data replacement after
  confirmation).
- `src/scoring/` — pure calculation functions, no DOM access, safe to reason about or test in
  isolation: course handicap ([handicap.js](src/scoring/handicap.js)), net stableford points
  ([stableford.js](src/scoring/stableford.js)), haversine distance
  ([distance.js](src/scoring/distance.js)), calibration completeness
  ([calibration.js](src/scoring/calibration.js)), and round-to-18-holes normalization plus
  `formatToPar` ([roundSummary.js](src/scoring/roundSummary.js), shared by the scorecard, resume
  round, and history screens).
- `src/geo/` — [geolocation.js](src/geo/geolocation.js) wraps `navigator.geolocation` as a
  one-shot ping. [openStreetMap.js](src/geo/openStreetMap.js) seeds calibration via Nominatim
  (geocoding) and Overpass (golf tee/green/hole tags), by place search or by a direct
  OpenStreetMap `.../way/<id>` link.
- `src/import/pdfScorecard.js` — parses des-balles-et-des-birdies.com PDF scorecards by
  reconstructing layout from the (x, y) of text fragments pdf.js extracts. Loaded lazily via
  dynamic `import()` at time of use, never at app startup (a static import once caused a
  white-screen failure on some iOS engines — see the 1.2.5 entry in README.md).
  [serverRestore.js](src/import/serverRestore.js) proposes restoring a backup from the
  public `data/` folder (GitHub Pages) — automatically when the local DB is entirely empty
  at startup (`src/main.js`), or on demand from Réglages — using `data/index.json` as the
  sole source of what's available (GitHub Pages can't list a directory) and the existing
  `readExportFile`/`importExportData` path. `data/index.json` is regenerated by
  `tools/update-data-index.ps1`, which refuses (won't list) any ZIP whose exported JSON
  still carries a non-empty `firstName`/`lastName`.
- `src/export/` — `pdfLib.js` is the single lazy-loader for vendored jsPDF (`loadJsPDF`),
  shared by the other two builders so the loading boilerplate exists once. `roundPdf.js`
  builds a one-page PDF summary of a round (Carte de score's "Export partie" button); its
  totals row shows the real putts sum with a separate "Moyenne putts" line below (a 1.2.56
  version of this showed the average mislabeled as the total — fixed in 1.2.57, watch for the
  same sum-vs-average confusion elsewhere). `statsPdf.js` builds a numbers-only PDF of the
  Statistiques screen for whatever filters are active — no charts reproduced as images. Both
  export files share/download the result the same way as the ZIP export
  (`shareOrDownloadZip`) and load lazily, same precaution as pdf.js.
- `src/lib/` — vendored third-party code only: pdf.js/pdf.worker.js (legacy build),
  jszip.min.js and jspdf.umd.min.js (UMD builds, each injected via a `<script>` tag on
  demand, never at startup).
- `src/ui/` — shared, dependency-free UI building blocks: form helpers incl. `formatGolfName`,
  `createInlineField`, `createCheckboxField` and `sortCoursesByName` — the single sort used by
  every golf list in the app (course management/edit/delete/calibrate, round creation, the
  shared Golf filter) — in [formHelpers.js](src/ui/formHelpers.js); the shared
  Golf/Year/Month(/Club) filter bar ([filters.js](src/ui/filters.js)); inline-SVG icon builder
  ([icons.js](src/ui/icons.js)); line/bar chart SVG components with no external dependency —
  adaptive axis scale, an amber target line and an orange average line each with their own Y-axis
  tick, `--color-chart-target` and `--color-chart-average` kept deliberately distinct so the two
  never blend together ([lineChart.js](src/ui/lineChart.js), [barChart.js](src/ui/barChart.js));
  the reusable "?" help bubble ([helpOverlay.js](src/ui/helpOverlay.js), overlaid outside the
  router so closing it never touches navigation history); and the non-blocking save-reminder
  banner (`showSaveReminderToast`, [toast.js](src/ui/toast.js), shown after course create/edit
  and round completion — no silent background save is possible on iPhone).

Pattern worth reusing: [stats.js](src/views/stats.js)'s `buildStatsExportSummary` computes a
plain-data summary from the same pure functions the on-screen render uses
(`computeGlobalPuttsAndGir`, `computeScoreDistribution`, `computeClubDistanceStats`,
`computeDistributionCounts`), then `statsPdf.js` renders that summary to PDF — so the export
can never show different numbers than the filtered screen it was generated from. Follow this
shape (pure summary function + separate renderer) for any future screen-matching export
rather than re-deriving values inline in the PDF builder.

## Data model (IndexedDB)

- **Player** *(singleton)*: `gender`, `trigram` (3 letters, since 1.2.58 — replaced
  `firstName`/`lastName`), `handicapIndex`, `appMode` (`"expert" | "simplified"`)
- **Club**: `id`, `name`, `order`, `targetDistance`
- **Course**: `id`, `name`, `location`, `source`
  (`"manual" | "pdf_import" | "osm_prefilled" | "calibrated"`), `recommendedTees[]`
  (`{color, slope, sss}`), `holes[]` (`{number, par, strokeIndex, distanceByTee, teePositions,
  greenPositions}`) — `greenPositions`: `{front?, middle?, back?}`, only `middle` required for
  the hole to count as calibrated
- **Round**: `id`, `date`, `courseId`, `teeColor`, `handicapIndexAtPlay`, `courseHandicap`,
  `startHole`, `status` (`"in_progress" | "completed"`), `weather`, `holeScores[]`
- **HoleScore**: `holeNumber`, `status` (`"not_played" | "played" | "abandoned"`),
  `grossScore`, `putts`, `girHit` (manual boolean, no auto-calc), `stablefordNetPoints`,
  `shots[]`
- **Shot**: `clubId`, `isFullShot`, `startPosition`, `endPosition`, `distance`, `lie` (7
  values, incl. Green/Fringe/Out-Lost), `shape` (10 values, incl. Topped/Air shot/Shank),
  `contact` (Good/Average/Poor or `null`)

Notes:
- `Course.source` only becomes `"calibrated"` via an on-site manual calibration that completes
  all 18 holes; an OpenStreetMap prefill marks `"osm_prefilled"` and never self-promotes.
- `Course.location` has no manual input field in the course form since 1.2.51 (location now
  comes only from GPS/OSM calibration); the field stays in the data model for compatibility
  and still prefills the OSM search box in calibration when already set.
- Since 1.2.54, `Shot.startPosition`/`endPosition` are no longer implicitly chained by "Add a
  shot": each shot has its own explicit Start/End GPS buttons in `play.js`. "Add a shot" only
  prefills `startPosition` (calibrated tee for the hole's first shot, otherwise the previous
  shot's `endPosition` if set) — it never geolocates on its own.
- Every GPS position (`{lat, lng, accuracy}`) carries an optional `accuracy` in meters, used
  only for on-screen transparency about GPS precision, never in distance calculations.
- Since 1.2.55, `Hole.greenPosition` (single point) was replaced by `Hole.greenPositions`
  (`{front, middle, back}`). Migration happens at read time in
  [repository.js](src/db/repository.js) (`getCourse`/`getCourses`) — a legacy
  `Hole.greenPosition` is transparently treated as `greenPositions.middle`; nothing is written
  back until the course is saved again. `getMiddleGreen()` in
  [calibration.js](src/scoring/calibration.js) also falls back to the legacy field as a
  safety net for any course object that bypasses the repository.
- Since 1.2.58, `Player.firstName`/`lastName` are gone, replaced by `trigram`. Migration is
  immediate and persisted at read time (`migratePlayerRecord` in
  [repository.js](src/db/repository.js), called from `getPlayer`) — unlike the green-position
  migration above, this one writes back right away so the old fields never linger.
  `importExportData` runs the same migration before saving an imported player, so an old
  export's name is never written to the DB even transiently.

## Keeping docs in sync

README.md carries the full file-tree map and a per-version changelog — update it (new
feature, file added/removed, data-model change, version bump) whenever you touch this repo, per
existing project convention.
