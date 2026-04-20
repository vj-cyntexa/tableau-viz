# Survival / Churn Curve — Tableau Viz Extension

Renders a Kaplan-Meier style survival curve showing customer retention probability over time. Multiple lines for loyalty segments, optional confidence interval bands, smooth or step interpolation, and median survival markers at the 50% crossing point.

## Live URLs

| Resource | URL |
|----------|-----|
| Production extension | `https://vj-cyntexa.github.io/tableau-viz/extensions/survival-curve/index.html` |
| Browser test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/survival-curve/test.html` |
| Production TREX | `extensions/survival-curve/survival-curve.trex` |
| Local dev TREX | `extensions/survival-curve/survival-curve-local.trex` |

## Encoding Slots

| Slot ID | Role | Required | Description |
|---------|------|----------|-------------|
| `period` | continuous-measure | Yes | Time period index (0, 1, 2, …). Typically months since acquisition. |
| `survival` | continuous-measure | Yes | Survival probability 0.0–1.0. Period 0 should be 1.0 (100%). |
| `segment` | discrete-dimension | No | Segment label for multiple lines. When absent, a single line is drawn. |
| `ci_lower` | continuous-measure | No | Lower bound of confidence interval (0.0–1.0). |
| `ci_upper` | continuous-measure | No | Upper bound of confidence interval (0.0–1.0). CI bands render only when BOTH ci_lower and ci_upper are present for a segment. |

## What Is Configurable

| Control | Description |
|---------|-------------|
| CI Bands (Show/Hide) | Toggle shaded confidence interval bands. Only renders for segments with complete CI data. |
| Curve Style | Smooth (monotone interpolation) or Step/KM (d3.curveStepAfter — true Kaplan-Meier appearance) |
| Median Marker (Show/Hide) | Vertical dashed line at the period where survival crosses 50%, labeled with segment name and period |

## What Is NOT Configurable from Tableau UI

- Y axis always fixed 0–100% (survival probability)
- Color palette (Tableau10, assigned by segment order)
- CI band opacity (fixed 15%)
- 50% reference line (always shown as a light dashed horizontal line)

## File Descriptions

| File | Purpose |
|------|---------|
| `survival-curve.trex` | Production manifest pointing to GitHub Pages URL |
| `survival-curve-local.trex` | Local dev manifest pointing to localhost:8080 |
| `index.html` | Tableau iframe shell with CI/curve/median toolbar |
| `chart.js` | All rendering: lines, CI area bands, median markers, crosshair tooltip |
| `test.html` | Standalone test — Gold/Silver/Bronze over 24 months with CI bands |
| `README.md` | This file |

## Local Dev Steps

1. Start local server from repo root:
   ```bash
   python3 -m http.server 8080
   ```
2. Open: `http://localhost:8080/extensions/survival-curve/test.html`
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `survival-curve-local.trex`

## Tableau Cloud Allowlist

```
https://vj-cyntexa.github.io/tableau-viz/extensions/survival-curve/index.html
```
**Path:** Tableau Cloud → Site Settings → Extensions → Add extension URL

## Data Requirements

One row per period per segment. Sort data by period ascending within each segment. `survival` value at period 0 should be 1.0 (all customers active at acquisition).

For CI bands: ensure every row for a segment includes both `ci_lower` and `ci_upper`. If any row is missing CI data for a segment, the CI band is skipped entirely for that segment (no partial rendering).

Pre-compute survival curves in Tableau or your data source (the extension does not compute Kaplan-Meier from raw event data — it displays pre-computed S(t) values).
