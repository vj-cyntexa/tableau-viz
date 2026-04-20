# Lollipop / Ranking Chart — Tableau Viz Extension

A D3 v7 Tableau Viz Extension that renders a ranked lollipop chart: thin stem lines with circle dots at the value end. Cleaner than bar charts for dense rankings. Supports horizontal (default) and vertical orientation, an optional benchmark reference line, optional value labels, and color grouping by a discrete dimension.

## Live URLs

| Resource | URL |
|---|---|
| Extension page | `https://vj-cyntexa.github.io/tableau-viz/extensions/lollipop-chart/index.html` |
| Browser test | `https://vj-cyntexa.github.io/tableau-viz/extensions/lollipop-chart/test.html` |
| Production TREX | `extensions/lollipop-chart/lollipop-chart.trex` |
| Local dev TREX | `extensions/lollipop-chart/lollipop-chart-local.trex` |

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `category` | discrete-dimension | Yes | Category label for each lollipop (store, campaign, segment) |
| `value` | continuous-measure | Yes | Numeric metric value — determines lollipop length |
| `benchmark` | continuous-measure | No | Benchmark / target value — renders as dashed reference line |
| `color` | discrete-dimension | No | If set, dots and stems are colored by this dimension |

## What Is and Isn't Configurable from Tableau's UI

**Configurable via encoding slots:**
- Which field drives category, value, benchmark, and color grouping

**Configurable via in-extension toolbar:**
- Sort: Descending / Ascending / Data Order
- Orientation: Horizontal (stems grow right) / Vertical (stems grow up)
- Show/hide benchmark line (disabled automatically when no benchmark encoding is set)
- Show/hide value labels at the end of each stem

**Not configurable (hardcoded):**
- Default dot/stem color: `#1f77b4` (single-series, no color encoding)
- Color palette when color encoding is used: `d3.schemeTableau10`
- Dot radius: 6px
- Stem stroke width: 2px (60% opacity)
- Benchmark line color: `#e74c3c` (red), dash pattern `6 3`
- Value format: auto-detected — if max value < 2, uses `.1%` (percentage); otherwise uses `,.0f` (comma-formatted integer)
- Sort transition duration: 400ms

## File Descriptions

| File | Role |
|---|---|
| `index.html` | Extension shell loaded by Tableau in an iframe. Contains all CSS, toolbar HTML, and script tags. |
| `chart.js` | All D3 rendering and Tableau API integration. No build step, no dependencies beyond D3 and the Extensions API. |
| `lollipop-chart.trex` | Production manifest pointing to GitHub Pages URL. |
| `lollipop-chart-local.trex` | Local dev manifest pointing to `localhost:8080`. |
| `test.html` | Standalone browser test with mock Tableau API. 12 store locations ranked by redemption rate with 4 regional color groups and benchmark = 67.3%. |
| `README.md` | This file. |

## Local Development

```bash
# From the repo root:
python3 -m http.server 8080

# Then open:
# http://localhost:8080/extensions/lollipop-chart/test.html
```

To load in Tableau Desktop:
1. Marks card → Viz Extensions → Access Local Extension
2. Select `extensions/lollipop-chart/lollipop-chart-local.trex`
3. Drag fields onto the encoding slots: Category (required), Value (required), Benchmark (optional), Color Group (optional)

## Tableau Cloud Allowlist

To use the production extension on Tableau Cloud, add the GitHub Pages URL to the site's allowlist:

1. Tableau Cloud → Admin → Settings → Extensions
2. Add: `https://vj-cyntexa.github.io/tableau-viz/extensions/lollipop-chart/index.html`

## Notes

- **Horizontal mode (default):** Y axis = categories, X axis = values. Stems extend from x=0. Benchmark appears as a vertical dashed red line.
- **Vertical mode:** X axis = categories, Y axis = values. Stems extend from y=0. Benchmark appears as a horizontal dashed red line.
- **Benchmark aggregation:** The benchmark field is expected to be a constant repeated across all rows (e.g., an average or target). The extension reads the first row's benchmark value.
- **Value format auto-detection:** If the maximum value in the dataset is less than 2, values are formatted as percentages (`.1%`). Otherwise, they are formatted as comma-separated integers (`,.0f`). This covers both redemption-rate-style (0–1) and count/revenue-style data.
- **Resize handling:** The chart redraws on window resize using the cached last-fetched data. No re-fetch is triggered on resize.
