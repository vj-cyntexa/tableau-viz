# Waterfall Chart — Tableau Viz Extension

Renders a waterfall chart showing sequential contributions (gains and losses) and running totals. Used for net member movement analysis (joins, reactivations, churn) or revenue attribution across periods.

## Live URLs

| Resource | URL |
|----------|-----|
| Production extension | `https://vj-cyntexa.github.io/tableau-viz/extensions/waterfall-chart/index.html` |
| Browser test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/waterfall-chart/test.html` |
| Production TREX | `extensions/waterfall-chart/waterfall-chart.trex` |
| Local dev TREX | `extensions/waterfall-chart/waterfall-chart-local.trex` |

## Encoding Slots

| Slot ID | Role | Required | Description |
|---------|------|----------|-------------|
| `label` | discrete-dimension | Yes | Step label. **Row order in Tableau = waterfall sequence.** Do not sort. |
| `value` | continuous-measure | Yes | Positive = gain (bar goes up), Negative = loss (bar goes down) |
| `type` | discrete-dimension | No | Bar type override: `total`, `subtotal`, or `relative`. When absent: first and last rows are treated as `total`; all other rows as `relative`. |

## Bar Type Rules

| Type | Rendering |
|------|-----------|
| `total` | Absolute bar from 0 to value. Resets running total to this value. |
| `subtotal` | Absolute bar from 0 to current running total. Does not change running total. |
| `relative` | Floating bar from previous running total to running total + value. Updates running total. |

## What Is Configurable

| Control | Description |
|---------|-------------|
| Color scheme | Blue/Red (default), Green/Red, or Single color |
| Connectors | Show/hide horizontal connector lines between bar tops |
| Running Total | Show/hide running total labels on relative bars |

## What Is NOT Configurable from Tableau UI

- Bar padding (fixed at 0.25 D3 scaleBand padding)
- Connector line style (solid grey)
- Value label position (always above bar)
- Y axis format (auto SI prefix: K, M)

## File Descriptions

| File | Purpose |
|------|---------|
| `waterfall-chart.trex` | Production manifest pointing to GitHub Pages URL |
| `waterfall-chart-local.trex` | Local dev manifest pointing to localhost:8080 |
| `index.html` | Tableau iframe shell with color/connector/label toolbar |
| `chart.js` | All rendering: waterfall geometry, floating bars, connectors, tooltips |
| `test.html` | Standalone test — 8-step net member movement mock data |
| `README.md` | This file |

## Local Dev Steps

1. Start local server from repo root:
   ```bash
   python3 -m http.server 8080
   ```
2. Open: `http://localhost:8080/extensions/waterfall-chart/test.html`
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `waterfall-chart-local.trex`

## Tableau Cloud Allowlist

```
https://vj-cyntexa.github.io/tableau-viz/extensions/waterfall-chart/index.html
```
**Path:** Tableau Cloud → Site Settings → Extensions → Add extension URL

## Data Requirements

One row per waterfall step. **Row order determines waterfall sequence** — do not sort the dimension alphabetically in Tableau. Use a numeric row-order field or fixed sort to preserve sequence.

Recommended pattern:
1. Create a calculated field `[Step Order]` = CASE [Step] WHEN 'Start' THEN 1 WHEN 'Joins' THEN 2 ... END
2. Sort the dimension by `[Step Order]` in Tableau
3. Drag the Step dimension onto the `label` encoding slot
