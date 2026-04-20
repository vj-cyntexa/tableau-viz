# Cohort Retention Heatmap — Tableau Viz Extension

## Live URLs

| Resource | URL |
|----------|-----|
| Production extension | https://vj-cyntexa.github.io/tableau-viz/extensions/cohort-retention-heatmap/index.html |
| Test page | https://vj-cyntexa.github.io/tableau-viz/extensions/cohort-retention-heatmap/test.html |

## Encoding Slots

| Slot ID | Type | Required | Description |
|---------|------|----------|-------------|
| `cohort` | discrete-dimension | Yes | Acquisition cohort label (e.g., "Jan 2023"). Parsed with `d3.timeParse('%b %Y')` for chronological sort; falls back to lexicographic sort. |
| `period` | continuous-measure | Yes | Period index since acquisition (0-indexed integer). Period 0 = acquisition period, typically 100%. |
| `retention` | continuous-measure | Yes | Retention rate as a decimal (0.0–1.0). The color scale maps 0.0 → lightest, 1.0 → darkest. |
| `cohort_size` | continuous-measure | No | Number of customers in the acquisition cohort. Shown in tooltip only; does not affect color or layout. |

## What Is Configurable from Tableau's UI

- **Encoding slots** — drag fields to set cohort, period, retention rate, and cohort size via Tableau's Marks card.

## What Is NOT Configurable from Tableau's UI

- **Color scheme** — toggle between Blues / Greens / Purples via the in-extension toolbar.
- **Cell text** — show/hide percentage labels via the in-extension toolbar checkbox.
- Cell width is auto-calculated from available container width.

## File Descriptions

| File | Description |
|------|-------------|
| `index.html` | Tableau iframe shell. Loads D3 and Tableau Extensions API CDNs; hosts toolbar buttons. |
| `chart.js` | All D3 rendering and Tableau API integration. Module-level `state` object drives toolbar configuration. |
| `test.html` | Standalone browser test with mock Tableau API. 6 cohorts × 6 periods of realistic retention data. |
| `cohort-retention-heatmap.trex` | Production TREX manifest pointing to GitHub Pages URL. |
| `cohort-retention-heatmap-local.trex` | Local dev TREX manifest pointing to `localhost:8080`. |

## Local Dev Steps

```bash
# From repo root
python3 -m http.server 8080
# Open: http://localhost:8080/extensions/cohort-retention-heatmap/test.html
```

In Tableau Desktop: Marks card → Viz Extensions → Access Local → open `cohort-retention-heatmap-local.trex`

## Tableau Cloud Allowlist

Add to the site's allowlist:
`https://vj-cyntexa.github.io/tableau-viz/extensions/cohort-retention-heatmap/index.html`
