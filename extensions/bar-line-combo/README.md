# Bar-Line Combo Chart — Tableau Viz Extension

A D3 v7 Tableau Viz Extension that renders a dual-axis combo chart: bars for a primary measure on the left Y axis and a line overlay for a secondary measure on the right Y axis.

## Live URLs

| Resource | URL |
|---|---|
| Extension page | `https://vj-cyntexa.github.io/tableau-viz/extensions/bar-line-combo/index.html` |
| Browser test | `https://vj-cyntexa.github.io/tableau-viz/extensions/bar-line-combo/test.html` |
| Production TREX | `extensions/bar-line-combo/bar-line-combo.trex` |
| Local dev TREX | `extensions/bar-line-combo/bar-line-combo-local.trex` |

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `x` | discrete-dimension | Yes | Date or categorical field for the X axis |
| `bar` | continuous-measure | Yes | Numeric measure rendered as bars (left Y axis) |
| `line` | continuous-measure | Yes | Numeric measure rendered as a line overlay (right Y axis) |
| `color` | discrete-dimension | No | If set, bars are stacked by this dimension |

## What Is and Isn't Configurable from Tableau's UI

**Configurable via encoding slots:**
- Which field drives X, bars, line, and stack grouping

**Not configurable (hardcoded):**
- Bar color: steel blue `#3498db` (single-series) or `d3.schemeTableau10` (stacked)
- Line color: orange `#e67e22`
- Bar opacity: 100%
- Line stroke width: 2.5px
- Stacking mode: always stacked when `color` is set (no grouped mode)
- Gridlines: left Y axis only

## File Descriptions

| File | Role |
|---|---|
| `index.html` | Extension shell loaded by Tableau in an iframe. Contains all CSS. |
| `chart.js` | All D3 rendering and Tableau API integration. No dependencies beyond D3 and the Extensions API. |
| `bar-line-combo.trex` | Production manifest pointing to GitHub Pages URL. |
| `bar-line-combo-local.trex` | Local dev manifest pointing to `localhost:8080`. |
| `test.html` | Standalone browser test with a mock Tableau API. 12 months of monthly revenue + growth rate %. No Tableau Desktop required. |

## Local Development

```bash
# From the repo root:
python3 -m http.server 8080

# Then open:
# http://localhost:8080/extensions/bar-line-combo/test.html
```

To load in Tableau Desktop:
1. Marks card → Viz Extensions → Access Local Extension
2. Select `extensions/bar-line-combo/bar-line-combo-local.trex`
3. Drag fields onto the encoding slots: X Axis, Bar Measure, Line Measure (Color is optional)

## Tableau Cloud Allowlist

To use the production extension on Tableau Cloud, add the GitHub Pages URL to the site's allowlist:

1. Tableau Cloud → Site Settings → Extensions
2. Add: `https://vj-cyntexa.github.io/tableau-viz/extensions/bar-line-combo/index.html`

## Notes

- **X axis date detection:** If all X values parse as valid `Date` objects, tick labels are formatted as `%b %Y` (e.g., `Jan 2024`). Otherwise, raw string values are shown.
- **Right Y axis range:** Auto-ranged with `d3.extent().nice()` — does not force 0, so negative line values (e.g., growth rate %) are displayed correctly.
- **Line aggregation when stacked:** When multiple rows share the same X value (due to the `color` grouping), line values are averaged per X category.
