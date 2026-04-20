# Bubble Chart Viz Extension

Scatter plot with area-proportional bubbles for loyalty segment prioritization.
Each bubble represents a segment: X = one measure, Y = another, size = third measure, color = segment.

## Live URLs

| Item | URL |
|---|---|
| Production extension | https://vj-cyntexa.github.io/tableau-viz/extensions/bubble-chart/index.html |
| Test page | https://vj-cyntexa.github.io/tableau-viz/extensions/bubble-chart/test.html |
| Production TREX | `extensions/bubble-chart/bubble-chart.trex` |
| Local dev TREX | `extensions/bubble-chart/bubble-chart-local.trex` |

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `x` | continuous-measure | Yes | X axis value (e.g., Avg Order Value) |
| `y` | continuous-measure | Yes | Y axis value (e.g., Purchase Frequency) |
| `size` | continuous-measure | Yes | Bubble area (e.g., Customer Count) |
| `color` | discrete-dimension | Yes | Segment label — drives color |
| `label` | discrete-dimension | No | Text inside bubble (falls back to color field) |

## What IS Configurable (inside the extension toolbar)

- Bubble size range (min/max radius in px)
- Show/hide bubble labels
- Show/hide quadrant lines (at median X and median Y)
- X axis label text
- Y axis label text

## What is NOT Configurable

- Color palette (always Tableau10)
- Quadrant threshold values (always median; use CLV Churn Quadrant extension for custom thresholds)
- Font family or size

## Files

| File | Purpose |
|---|---|
| `index.html` | Extension iframe shell with toolbar |
| `chart.js` | D3 rendering + Tableau Extensions API integration |
| `test.html` | Browser test with 8 RFM mock segments |
| `bubble-chart.trex` | Production TREX manifest |
| `bubble-chart-local.trex` | Local dev TREX manifest (localhost:8080) |

## Local Dev Steps

1. From repo root: `python3 -m http.server 8080`
2. Open: `http://localhost:8080/extensions/bubble-chart/test.html`
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → open `bubble-chart-local.trex`

## Tableau Cloud Allowlist

Add to your Tableau Cloud site allowlist:
```
https://vj-cyntexa.github.io
```
Settings → Extensions → Add domain.
