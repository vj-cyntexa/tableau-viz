# Multi-Line Chart — Tableau Viz Extension

Multi-line time-series visualization built with D3.js v7 for Tableau Desktop and Tableau Cloud. Renders multiple series with date-based x-axis and numeric y-axis, with interactive hover tooltips and automatic legend.

## Live URLs

- **Production extension**: https://vj-cyntexa.github.io/tableau-viz/extensions/multi-line-chart/index.html
- **Browser test page**: https://vj-cyntexa.github.io/tableau-viz/extensions/multi-line-chart/test.html

## Encoding Slots (Marks Card)

| Slot | Label | Field Type | Required | Purpose |
|------|-------|-----------|----------|---------|
| X | Date (X Axis) | Discrete Dimension (Date/DateTime) | Yes | Horizontal axis; values must be parseable as dates |
| Y | Value (Y Axis) | Continuous Measure (numeric) | Yes | Vertical axis; aggregated values (sum, avg, etc.) |
| Color | Series | Discrete Dimension (string/category) | No | Groups data into separate lines; one line per unique value |

If **Color** is not provided, all data renders as a single series named "Value". If no valid data rows exist after parsing (missing X/Y or unparseable dates), an error message displays.

## Configurability

### Configurable via Tableau UI

- **Number of lines**: Determined by the unique values in the **Series** (Color) dimension field. Each distinct value gets its own line.
- **Date range**: Controlled by the date range of the dragged dimension on the X axis.
- **Measure values**: Determined by which numeric field is dragged onto the Y axis.

### NOT Configurable (Requires Code Changes)

- **Colors**: Auto-assigned from D3's `schemeTableau10` palette (10 distinct colors). After 10 series, colors repeat in the same order.
- **Line thickness**: Fixed at 2.5 pixels.
- **Curve type**: Fixed at `curveMonotoneX` (smooth monotone interpolation).
- **Margins, fonts, grid**: Hardcoded in `chart.js` and `index.html` stylesheet.

## Files

| File | Purpose |
|------|---------|
| `index.html` | HTML entry point loaded by Tableau in an iframe; includes D3 and Tableau Extensions API; defines styles and DOM structure |
| `chart.js` | Core D3 rendering logic; parses Tableau data via Extensions API; draws axes, lines, legend, grid, and tooltips |
| `multi-line-chart.trex` | Production manifest with HTTPS GitHub Pages URL; registered extension ID `com.cyntexa.multilinechart` |
| `multi-line-chart-local.trex` | Development manifest with localhost URL; ID `com.cyntexa.multilinechart.local` |
| `test.html` | Standalone browser test page; mocks Tableau API with 3 sample series and 24 months of data; no server required |
| `README.md` | This file |

## Local Development

Start a local HTTP server from the repository root:

```bash
cd /Users/vj/Office/Projects/vj-random-research-and-task/tableau-viz
python3 -m http.server 8080
```

Then open either:

- **Browser test**: http://localhost:8080/extensions/multi-line-chart/test.html (no Tableau required)
- **Tableau Desktop**: Marks card → Mark Type dropdown → Viz Extensions → Add Extension → Access Local → Browse to `multi-line-chart-local.trex`

After changes, refresh the page or re-add the extension. The local manifest points to `http://localhost:8080/extensions/multi-line-chart/index.html`.

## Adding This Extension to Tableau Cloud

1. The production `.trex` manifest already points to the GitHub Pages HTTPS URL.
2. A Tableau Cloud site admin must allowlist the extension domain:
   - Navigate to **Site Settings** → **Extensions** → **Add to safe list**
   - Enter the URL pattern: `https://vj-cyntexa.github.io/tableau-viz/.*`
3. Users can then add the extension via Marks card → Viz Extensions → Add Extension → From URL (if not pre-allowlisted).

## Making Changes

1. Edit `chart.js` for rendering logic (axes, colors, curve type, tooltips) or `index.html` for HTML structure and styles.
2. Test locally via browser test page: http://localhost:8080/extensions/multi-line-chart/test.html
3. For in-Tableau testing, use the local server and `multi-line-chart-local.trex` manifest.
4. Commit and push to main branch — GitHub Pages redeploys automatically within ~60 seconds.
5. Update this README if you change encoding slots, configurability, file structure, or deployment URLs.

Changes to `index.html` or `chart.js` are reflected on production within ~60 seconds of push.
