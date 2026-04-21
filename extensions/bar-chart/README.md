# Bar Chart Viz Extension

A D3.js v7 Tableau Viz Extension that renders a bar chart with five modes controlled by two independent toolbar toggles.

## Modes

**Layout toggle** (Stacked / Grouped / 100%):

- **Stacked** — color groups stacked on top of each other per x-category
- **Grouped** — color groups placed side-by-side per x-category
- **100% Stacked** — each x-category normalized to 100%; Y axis shows 0–100%; always vertical

**Orientation toggle** (Vertical / Horizontal):

- **Vertical** — bars grow upward; categories on X axis, values on Y axis
- **Horizontal** — bars grow rightward; categories on Y axis, values on X axis

This yields five effective combinations:

| # | Layout | Orientation |
|---|--------|-------------|
| 1 | Stacked | Vertical (default) |
| 2 | Grouped | Vertical |
| 3 | Stacked | Horizontal |
| 4 | Grouped | Horizontal |
| 5 | 100% Stacked | Vertical (orientation toggle disabled) |

All mode switches animate with a 300ms D3 transition.

## Average Reference Line

A dotted reference line can be overlaid on the chart at the mean Y value of all bars:

- **Toggle** — use the "Avg line" checkbox in the toolbar to show/hide the line (default: off)
- **Color** — the color picker next to the checkbox lets you choose the line color (default: `#e74c3c`)
- **Label** — a small "Avg: {value}" label appears at the right end (vertical) or top (horizontal) of the line
- **Scope** — the average is computed across all displayed raw values (all color groups × all x-categories)
- **100% Stacked mode** — the average line is automatically hidden in 100% stacked mode, since values are normalized and a raw-value average would be misleading

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

Cyntexa
