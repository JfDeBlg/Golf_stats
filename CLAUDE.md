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
- `src/export/roundPdf.js` — builds a one-page PDF summary of a round (Carte de score's
  "Export partie" button) via vendored jsPDF, sharing/downloading the result the same way as
  the ZIP export (`shareOrDownloadZip`). Loaded lazily, same precaution as pdf.js.
- `src/lib/` — vendored third-party code only: pdf.js/pdf.worker.js (legacy build),
  jszip.min.js and jspdf.umd.min.js (UMD builds, each injected via a `<script>` tag on
  demand, never at startup).
- `src/ui/` — shared, dependency-free UI building blocks: form helpers incl. `formatGolfName`
  and `createInlineField` ([formHelpers.js](src/ui/formHelpers.js)), the shared
  Golf/Year/Month(/Club) filter bar ([filters.js](src/ui/filters.js)), inline-SVG icon builder
  ([icons.js](src/ui/icons.js)), line/bar chart SVG components with no external dependency —
  adaptive axis scale, target and average reference lines
  ([lineChart.js](src/ui/lineChart.js), [barChart.js](src/ui/barChart.js)), the reusable "?"
  help bubble ([helpOverlay.js](src/ui/helpOverlay.js), overlaid outside the router so closing
  it never touches navigation history), and the non-blocking save-reminder banner
  (`showSaveReminderToast`, [toast.js](src/ui/toast.js), shown after course create/edit and
  round completion — no silent background save is possible on iPhone).

## Data model (IndexedDB)

- **Player** *(singleton)*: `gender`, `firstName`, `lastName`, `handicapIndex`, `appMode`
  (`"expert" | "simplified"`)
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

## Keeping docs in sync

README.md carries the full file-tree map and a per-version changelog — update it (new
feature, file added/removed, data-model change, version bump) whenever you touch this repo, per
existing project convention.
