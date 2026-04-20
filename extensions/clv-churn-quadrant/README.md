# CLV vs Churn Risk Quadrant — Tableau Viz Extension

Scatter plot placing customer segments on two axes: Customer Lifetime Value (X) vs Churn Risk % (Y). Configurable threshold lines divide the chart into four named action quadrants to guide retention and investment strategy.

## Live URLs

| Resource | URL |
|---|---|
| Production extension | `https://vj-cyntexa.github.io/tableau-viz/extensions/clv-churn-quadrant/index.html` |
| Browser test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/clv-churn-quadrant/test.html` |
| Production TREX | `extensions/clv-churn-quadrant/clv-churn-quadrant.trex` |
| Local dev TREX | `extensions/clv-churn-quadrant/clv-churn-quadrant-local.trex` |

## Quadrant Definitions

| Quadrant | CLV | Churn Risk | Label | Color |
|---|---|---|---|---|
| Bottom-right | >= threshold | < threshold | **Protect & Grow** | Green `#27ae60` |
| Top-right | >= threshold | >= threshold | **Urgent Retention** | Red `#c0392b` |
| Bottom-left | < threshold | < threshold | **Nurture** | Blue `#2980b9` |
| Top-left | < threshold | >= threshold | **Deprioritize** | Grey `#999999` |

## Encoding Slots

| Slot ID | Role | Required | Description |
|---|---|---|---|
| `clv` | continuous-measure | Yes | Customer Lifetime Value — maps to X axis |
| `churn_risk` | continuous-measure | Yes | Churn probability 0.0–1.0 — maps to Y axis |
| `segment` | discrete-dimension | Yes | Segment label — drives bubble color + legend |
| `size` | continuous-measure | No | Customer count — drives bubble radius via scaleSqrt. Fixed 10px if absent. |
| `label` | discrete-dimension | No | Text to show inside bubble when "Segment Labels" enabled. Falls back to `segment` if absent. Hidden if bubble too small. |

## What IS Configurable (toolbar)

| Control | Element | Behavior |
|---|---|---|
| CLV Threshold | `<input type="number" id="clv-threshold">` | Moves vertical quadrant line. Default = median CLV from data. |
| Churn Threshold | `<input type="number" id="churn-threshold">` | Moves horizontal quadrant line. Default = 0.5. |
| Quadrant Labels | `<input type="checkbox" id="show-quad-labels">` | Toggles corner action labels on/off. Default on. |
| Segment Labels | `<input type="checkbox" id="show-seg-labels">` | Toggles segment name text inside bubbles. Default off. |

## What Is NOT Configurable from Tableau UI

- Color palette (always D3 schemeTableau10, assigned by segment order)
- Quadrant label text (hardcoded action labels per quadrant)
- Font size or family
- Legend position (always horizontal at bottom of chart)
- Bubble minimum/maximum radius when size encoding absent (fixed 10px)
- Bubble radius range when size encoding present (6–30px via scaleSqrt)

## File Descriptions

| File | Purpose |
|---|---|
| `clv-churn-quadrant.trex` | Production manifest — points to GitHub Pages URL |
| `clv-churn-quadrant-local.trex` | Local dev manifest — points to localhost:8080 |
| `index.html` | Tableau iframe shell with configuration toolbar |
| `chart.js` | All rendering: Tableau API integration, D3 scatter, quadrant lines, labels, legend, tooltips |
| `test.html` | Standalone browser test with 9-segment mock data covering all four quadrants |
| `README.md` | This file |

## Local Dev Steps

1. Start local server from repo root:
   ```bash
   python3 -m http.server 8080
   ```
2. Open: `http://localhost:8080/extensions/clv-churn-quadrant/test.html`
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `clv-churn-quadrant-local.trex`

## Tableau Cloud Allowlist

Add to site allowlist:
```
https://vj-cyntexa.github.io/tableau-viz/extensions/clv-churn-quadrant/index.html
```
**Path:** Tableau Cloud → Site Settings → Extensions → Add extension URL

## Data Requirements

One row per customer segment. Required fields:
- A numeric measure for CLV (dollar value, e.g., $150–$2,000)
- A numeric measure for churn risk (decimal 0.0–1.0 or percentage)
- A string dimension for segment name

Optional: a numeric measure for customer count (drives bubble size).

**Note:** Churn risk must be expressed as a decimal (0.08 = 8%), not as a whole percentage (8). If your source data uses whole numbers, create a calculated field: `[Churn Pct] / 100`.
