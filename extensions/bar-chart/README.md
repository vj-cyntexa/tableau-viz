# Bar Chart Viz Extension

A D3.js v7 Tableau Viz Extension that renders a bar chart with two modes:

- **Stacked bars** — color groups are stacked on top of each other per x-category
- **Grouped (side-by-side) bars** — color groups are placed next to each other per x-category

A toggle button inside the extension switches between modes with a 300ms animated transition.

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `x` | Discrete Dimension | Yes | X-axis categories (1 field) |
| `y` | Continuous Measure | Yes | Bar height / value (1 field) |
| `color` | Discrete Dimension | Yes | Grouping / stack dimension (1 field) |

## Files

| File | Description |
|---|---|
| `bar-chart.trex` | Production manifest — points to GitHub Pages |
| `bar-chart-local.trex` | Local dev manifest — points to localhost:8080 |
| `index.html` | Extension shell with D3 + Tableau Extensions API CDN |
| `chart.js` | D3 rendering logic, Tableau data integration |
| `test.html` | Standalone browser test with mock Tableau API |

## Local Development

1. From the repo root, start a local server:
   ```bash
   python3 -m http.server 8080
   ```

2. Open the test page in your browser:
   ```
   http://localhost:8080/extensions/bar-chart/test.html
   ```
   You will see a fully functional bar chart with mock data (3 product categories × 4 regions). No Tableau Desktop required.

3. To test inside Tableau Desktop:
   - Marks card → **Viz Extensions** → **Access Local Extension**
   - Select `extensions/bar-chart/bar-chart-local.trex`
   - Drag fields onto the three encoding slots (Category, Value, Group/Stack)

## Production Deployment

The extension is served from GitHub Pages:

```
https://vj-cyntexa.github.io/tableau-viz/extensions/bar-chart/index.html
```

To use the production version in Tableau Desktop:
- Marks card → **Viz Extensions** → **Access Extension**
- Select `extensions/bar-chart/bar-chart.trex`

## Extension IDs

| Manifest | Extension ID |
|---|---|
| Production | `com.cyntexa.barchart` |
| Local | `com.cyntexa.barchart.local` |

## Tech Stack

- [D3.js v7](https://d3js.org/) — rendering, scales, transitions
- [Tableau Extensions API 2.x](https://help.tableau.com/current/api/extensions_api/en-us/index.html) — data access
- Vanilla JS (ES2020), no build step
- GitHub Pages — hosting

## Author

Cyntexa — vishwajeet@cyntexa.com
