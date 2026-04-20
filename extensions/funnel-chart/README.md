# Funnel Chart — Tableau Viz Extension

## Live URLs

| Resource | URL |
|----------|-----|
| Production extension | https://vj-cyntexa.github.io/tableau-viz/extensions/funnel-chart/index.html |
| Test page | https://vj-cyntexa.github.io/tableau-viz/extensions/funnel-chart/test.html |

## Encoding Slots

| Slot ID | Type | Required | Description |
|---------|------|----------|-------------|
| `stage` | discrete-dimension | Yes | Stage label. **Order is determined by data row order from Tableau, not alphabetically.** Ensure your Tableau worksheet sorts the stage field in the correct funnel sequence. |
| `value` | continuous-measure | Yes | Volume at each stage (e.g., customer count, revenue). |
| `color` | discrete-dimension | No | Segment label for color differentiation. When present, each stage trapezoid uses a distinct Tableau10 color per segment. |

## What Is Configurable from Tableau's UI

- **Encoding slots** — drag fields to set stage, volume, and optional color segment.

## What Is NOT Configurable from Tableau's UI

- **Orientation** — toggle Vertical / Horizontal via in-extension toolbar.
- **Percentage mode** — show % of first stage or % of previous stage via toolbar.
- **Label position** — Inside (white text on trapezoid) or Outside (grey text beside) via toolbar.

## File Descriptions

| File | Description |
|------|-------------|
| `index.html` | Tableau iframe shell with toolbar. Loads D3 and Tableau Extensions API CDNs. |
| `chart.js` | All D3 trapezoid rendering. Preserves data row order for stage sequence. |
| `test.html` | Standalone browser test with 5-stage loyalty funnel mock data. |
| `funnel-chart.trex` | Production TREX manifest pointing to GitHub Pages URL. |
| `funnel-chart-local.trex` | Local dev TREX manifest pointing to `localhost:8080`. |

## Local Dev Steps

```bash
# From repo root
python3 -m http.server 8080
# Open: http://localhost:8080/extensions/funnel-chart/test.html
```

In Tableau Desktop: Marks card → Viz Extensions → Access Local → open `funnel-chart-local.trex`

## Stage Ordering Note

The funnel preserves data row order. In Tableau, make sure your worksheet has the stage field sorted in the intended funnel sequence (drag the field to a sorting position, or use a custom sort order). Do not rely on alphabetical sort.

## Tableau Cloud Allowlist

Add to the site's allowlist:
`https://vj-cyntexa.github.io/tableau-viz/extensions/funnel-chart/index.html`
