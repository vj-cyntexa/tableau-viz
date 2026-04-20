# RFM Scatter Plot — Tableau Viz Extension

Renders a bubble scatter plot for RFM (Recency-Frequency-Monetary) customer segmentation analysis. Recency on X axis (recent customers on right by default), Frequency on Y axis, Monetary value as bubble size, and RFM segment as color. Quadrant lines at median values create the classic RFM quadrant view.

## Live URLs

| Resource | URL |
|----------|-----|
| Production extension | `https://vj-cyntexa.github.io/tableau-viz/extensions/rfm-scatter/index.html` |
| Browser test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/rfm-scatter/test.html` |
| Production TREX | `extensions/rfm-scatter/rfm-scatter.trex` |
| Local dev TREX | `extensions/rfm-scatter/rfm-scatter-local.trex` |

## Encoding Slots

| Slot ID | Role | Required | Description |
|---------|------|----------|-------------|
| `recency` | continuous-measure | Yes | Days since last purchase (lower = more recent) |
| `frequency` | continuous-measure | Yes | Number of purchases |
| `monetary` | continuous-measure | Yes | Total spend — maps to bubble size |
| `segment` | discrete-dimension | Yes | RFM segment label (Champions, Loyal, etc.) |
| `label` | discrete-dimension | No | Customer name or ID — shown in tooltip |

## What Is Configurable

| Control | Description |
|---------|-------------|
| Quadrant Lines (On/Off) | Toggle dashed quadrant lines at median recency and frequency |
| Recency threshold | Manual override for X quadrant line position (default: median) |
| Frequency threshold | Manual override for Y quadrant line position (default: median) |
| Bubble size slider | Adjusts maximum bubble radius (4–40px) |
| X Axis direction | "Recent = Right" reverses axis so low recency plots on right |

## What Is NOT Configurable from Tableau UI

- Bubble minimum radius (fixed at 4px)
- Quadrant label text (hardcoded: Champions, Loyal/At Risk, Recent Low-Freq, Lost/Hibernating)
- Color palette (Tableau10 color scheme, assigned by segment order)
- Legend position (always right side)

## File Descriptions

| File | Purpose |
|------|---------|
| `rfm-scatter.trex` | Production manifest pointing to GitHub Pages URL |
| `rfm-scatter-local.trex` | Local dev manifest pointing to localhost:8080 |
| `index.html` | Tableau iframe shell with RFM toolbar controls |
| `chart.js` | All rendering: Tableau API, D3 bubble chart, quadrant lines, legend |
| `test.html` | Standalone browser test — 50 mock customers across 6 RFM segments |
| `README.md` | This file |

## Local Dev Steps

1. Start local server from repo root:
   ```bash
   python3 -m http.server 8080
   ```
2. Open: `http://localhost:8080/extensions/rfm-scatter/test.html`
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `rfm-scatter-local.trex`

## Tableau Cloud Allowlist

Add to site allowlist:
```
https://vj-cyntexa.github.io/tableau-viz/extensions/rfm-scatter/index.html
```
**Path:** Tableau Cloud → Site Settings → Extensions → Add extension URL

## Data Requirements

One row per customer (or per customer-segment aggregate). Required fields:
- A numeric measure for recency (days since last purchase)
- A numeric measure for frequency (purchase count)
- A numeric measure for monetary value (total spend)
- A string dimension for segment label

Recommended: Pre-calculate RFM segments in Tableau or the data source. The extension does not compute segments — it displays them.
