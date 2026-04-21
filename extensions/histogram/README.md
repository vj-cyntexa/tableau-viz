# Histogram Viz Extension

A D3.js v7 Tableau Viz Extension that renders an interactive frequency-distribution histogram.
Supports optional per-segment overlapping layers, KDE smooth curve overlay, configurable binning,
and log-scale X axis.

## Live URLs

| Resource | URL |
|----------|-----|
| Production extension | `https://vj-cyntexa.github.io/tableau-viz/extensions/histogram/index.html` |
| Production TREX | `extensions/histogram/histogram.trex` |
| Local dev TREX | `extensions/histogram/histogram-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/histogram/test.html` |

## Encoding Slots

These are configured by dragging Tableau fields in the Viz Extension encoding panel.

| Slot ID | Type | Required | Description |
|---------|------|----------|-------------|
| `value` | Continuous Measure | Yes | The numeric measure to distribute across bins (e.g., CLV, Order Value) |
| `segment` | Discrete Dimension | No | When present, one overlapping histogram layer per unique segment value |
| `bin_count` | Continuous Measure | No | First-row value overrides the auto (Sturges) bin count |

## What Is Configurable vs Not Configurable from Tableau's UI

**Configurable from Tableau's encoding panel (drag-and-drop fields):**
- Which measure to distribute (`value` slot)
- Which dimension to split into layers (`segment` slot)
- Fixed bin count override (`bin_count` slot — uses the measure's first-row value)

**Not configurable from Tableau's encoding panel (toolbar controls inside the extension iframe):**
- Bin count (interactive slider, overrides encoding override and Sturges auto)
- Y axis mode: Count / Density / Percent
- KDE curve overlay on/off
- Log scale on X axis on/off

The toolbar lives inside the extension's iframe; Tableau has no API to control it externally.

## Bin Count Precedence

`slider input` > `bin_count encoding first-row value` > `Sturges auto (ceil(log2(n)+1))`

When the user moves the slider, slider wins. The slider resets to the auto/encoding value on
initial load if the user has not yet interacted with it.

## Files

| File | Description |
|------|-------------|
| `histogram.trex` | Production manifest — points to GitHub Pages |
| `histogram-local.trex` | Local dev manifest — points to localhost:8080 |
| `index.html` | Extension iframe shell + toolbar controls |
| `chart.js` | D3 binning, KDE, rendering, Tableau API integration |
| `test.html` | Standalone browser test — 120-row CLV dataset, 3 segments |

## Local Development

1. From the repo root, start a local server:
   ```bash
   python3 -m http.server 8080
   ```

2. Open the test page:
   ```
   http://localhost:8080/extensions/histogram/test.html
   ```
   Expected: overlapping histograms for Gold, Silver, Bronze CLV segments.
   All four toolbar controls are interactive.

3. To test inside Tableau Desktop:
   - Marks card > Viz Extensions > Access Local Extension
   - Select `extensions/histogram/histogram-local.trex`
   - Drag a continuous measure onto the `value` encoding slot
   - Optionally drag a dimension onto `segment`

## Tableau Cloud Allowlist

To use the production extension on Tableau Cloud, add the GitHub Pages domain to the
site's extension allowlist:

1. Tableau Cloud Admin > Extensions > Allowlist
2. Add: `https://vj-cyntexa.github.io`

## Extension IDs

| Manifest | ID |
|----------|----|
| Production | `com.cyntexa.histogram` |
| Local dev | `com.cyntexa.histogram.local` |

## Author

Cyntexa
