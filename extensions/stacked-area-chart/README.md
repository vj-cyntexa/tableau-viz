# Stacked Area Chart Viz Extension

A D3.js v7 Tableau Viz Extension that renders time-series composition as stacked areas.
Shows total volume AND segment breakdown at each time period. Three render modes:

- **Stacked** — segments stacked on top of each other; y axis = raw values
- **Normalized** — each period's total normalised to 100%; y axis = percentage share
- **Lines** — each segment as an independent line (no stacking); y axis = raw values

## Live URLs

| Resource | URL |
|----------|-----|
| Production extension | `https://vj-cyntexa.github.io/tableau-viz/extensions/stacked-area-chart/index.html` |
| Production TREX | `extensions/stacked-area-chart/stacked-area-chart.trex` |
| Local dev TREX | `extensions/stacked-area-chart/stacked-area-chart-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/stacked-area-chart/test.html` |

## Encoding Slots

These are configured by dragging Tableau fields in the Viz Extension encoding panel.

| Slot ID | Type | Required | Description |
|---------|------|----------|-------------|
| `date` | Discrete Dimension | Yes | Time period labels on the X axis (e.g., "Jan 2023") |
| `value` | Continuous Measure | Yes | Numeric value per segment per period |
| `segment` | Discrete Dimension | Yes | Dimension that creates one area layer per unique value |

## What Is Configurable vs Not Configurable from Tableau's UI

**Configurable from Tableau's encoding panel (drag-and-drop fields):**
- Which date/period field drives the X axis (`date` slot)
- Which measure drives the Y axis height (`value` slot)
- Which dimension splits the data into area layers (`segment` slot)

**Not configurable from Tableau's encoding panel (toolbar controls inside the extension iframe):**
- Render mode: Stacked / Normalized / Lines
- Area fill: filled areas vs stroke-only
- Segment sort order: By Total (largest on bottom) / Alphabetical

The toolbar lives inside the extension's iframe; Tableau has no API to control it externally.

## Render Mode Details

| Mode | D3 API Used | Y Axis |
|------|-------------|--------|
| Stacked | `d3.stack()` with `stackOffsetNone` + `d3.area()` | Raw values (`~s` format) |
| Normalized | `d3.stack()` with `stackOffsetExpand` + `d3.area()` | 0–100% (`.0%` format) |
| Lines | `d3.line()` per segment, no stack | Raw values (`~s` format) |

## Files

| File | Description |
|------|-------------|
| `stacked-area-chart.trex` | Production manifest — points to GitHub Pages |
| `stacked-area-chart-local.trex` | Local dev manifest — points to localhost:8080 |
| `index.html` | Extension iframe shell + toolbar controls |
| `chart.js` | D3 stack/area/line rendering, Tableau API integration |
| `test.html` | Standalone browser test — 96-row loyalty-tier membership dataset |

## Local Development

1. From the repo root, start a local server:
   ```bash
   python3 -m http.server 8080
   ```

2. Open the test page:
   ```
   http://localhost:8080/extensions/stacked-area-chart/test.html
   ```
   Expected: stacked area chart with 4 loyalty tiers (Bronze, Silver, Gold, Platinum)
   across 24 months. Bronze declining, others growing.

3. To test inside Tableau Desktop:
   - Marks card > Viz Extensions > Access Local Extension
   - Select `extensions/stacked-area-chart/stacked-area-chart-local.trex`
   - Drag a date/period dimension onto `date`
   - Drag a numeric measure onto `value`
   - Drag a dimension onto `segment`

## Tableau Cloud Allowlist

To use on Tableau Cloud, add the GitHub Pages domain to the site's extension allowlist:

1. Tableau Cloud Admin > Extensions > Allowlist
2. Add: `https://vj-cyntexa.github.io`

## Extension IDs

| Manifest | ID |
|----------|----|
| Production | `com.cyntexa.stackedareachart` |
| Local dev | `com.cyntexa.stackedareachart.local` |

## Author

Cyntexa
