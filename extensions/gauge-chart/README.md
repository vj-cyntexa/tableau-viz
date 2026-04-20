# Gauge Chart Viz Extension

270° semi-arc gauge showing a KPI value against a target with traffic-light coloring.
Supports multiple KPIs tiled side-by-side (up to 4 per row). Shows value, % of target,
over-target indicator, and a target tick mark on the arc.

## Live URLs

| Item | URL |
|---|---|
| Production extension | https://vj-cyntexa.github.io/tableau-viz/extensions/gauge-chart/index.html |
| Test page | https://vj-cyntexa.github.io/tableau-viz/extensions/gauge-chart/test.html |
| Production TREX | `extensions/gauge-chart/gauge-chart.trex` |
| Local dev TREX | `extensions/gauge-chart/gauge-chart-local.trex` |

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `value` | continuous-measure | Yes | Current KPI value |
| `target` | continuous-measure | Yes | Target / goal value |
| `label` | discrete-dimension | No | KPI name shown below the gauge |
| `min` | continuous-measure | No | Scale minimum (default 0) |
| `max` | continuous-measure | No | Scale maximum (default target × 1.25) |

**Multi-KPI:** Put multiple rows in the worksheet (one row per KPI) and the extension tiles up to 4 gauges per row automatically.

**Percentage values:** Pass decimals (e.g. 0.34 for 34%) or whole numbers (e.g. 34). The formatter auto-detects values < 1 and displays as percentage.

## What IS Configurable (inside the extension toolbar)

- Color scheme: Traffic Light (red/amber/green) or Blue gradient
- Red threshold: percentage of target below which arc is red (default 50%)
- Amber threshold: percentage of target below which arc is amber (default 80%)
- Show/hide target tick mark and label on arc
- Arc thickness: Thin / Medium / Thick

## What is NOT Configurable

- Gauge sweep angle (always 270°)
- Number of gauges per row (always auto, max 4)
- Font family or size
- Needle style

## Files

| File | Purpose |
|---|---|
| `index.html` | Extension iframe shell with toolbar |
| `chart.js` | D3 rendering + Tableau Extensions API integration |
| `test.html` | Browser test with 3 loyalty KPI mock rows |
| `gauge-chart.trex` | Production TREX manifest |
| `gauge-chart-local.trex` | Local dev TREX manifest (localhost:8080) |

## Local Dev Steps

1. From repo root: `python3 -m http.server 8080`
2. Open: `http://localhost:8080/extensions/gauge-chart/test.html`
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → open `gauge-chart-local.trex`

## Tableau Cloud Allowlist

Add to your Tableau Cloud site allowlist:
```
https://vj-cyntexa.github.io
```
Settings → Extensions → Add domain.
