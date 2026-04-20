# Sankey Diagram — Tableau Viz Extension

Renders a Sankey/flow diagram showing how customers migrate between loyalty tiers or segments over time. Built with D3.js v7 and d3-sankey 0.12.3.

## Live URLs

| Resource | URL |
|----------|-----|
| Production extension | `https://vj-cyntexa.github.io/tableau-viz/extensions/sankey-diagram/index.html` |
| Browser test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/sankey-diagram/test.html` |
| Production TREX | `extensions/sankey-diagram/sankey-diagram.trex` |
| Local dev TREX | `extensions/sankey-diagram/sankey-diagram-local.trex` |

## Encoding Slots

| Slot ID | Role | Required | Description |
|---------|------|----------|-------------|
| `source` | discrete-dimension | Yes | Source node label (e.g., "Bronze (P1)") |
| `target` | discrete-dimension | Yes | Target node label (e.g., "Silver (P2)") |
| `value` | continuous-measure | Yes | Flow volume (member count or revenue) |

## What Is Configurable

| Control | How |
|---------|-----|
| Node alignment | Justify / Left / Right / Center toolbar buttons |
| Color mode | By source / By target / Single color toolbar buttons |

## What Is NOT Configurable from Tableau UI

- Node width (fixed at 20px)
- Node padding (fixed at 12px)
- Link opacity (0.3 default, 0.6 on hover — hardcoded)
- Font sizes

## File Descriptions

| File | Purpose |
|------|---------|
| `sankey-diagram.trex` | Production manifest pointing to GitHub Pages URL |
| `sankey-diagram-local.trex` | Local dev manifest pointing to localhost:8080 |
| `index.html` | Tableau iframe shell; loads CDNs and hosts toolbar |
| `chart.js` | All rendering logic: Tableau API, d3-sankey layout, D3 drawing |
| `test.html` | Standalone browser test with loyalty-tier migration mock data |
| `README.md` | This file |

## Local Dev Steps

1. Start local server from repo root:
   ```bash
   python3 -m http.server 8080
   ```
2. Open browser test: `http://localhost:8080/extensions/sankey-diagram/test.html`
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → select `sankey-diagram-local.trex`

## Tableau Cloud Allowlist

To use the production extension in Tableau Cloud, add the following URL to the site allowlist:

```
https://vj-cyntexa.github.io/tableau-viz/extensions/sankey-diagram/index.html
```

**Path:** Tableau Cloud → Site Settings → Extensions → Add extension URL

## Data Requirements

Your Tableau worksheet should produce one row per flow pair. Required fields:
- A dimension for the source node
- A dimension for the target node
- A measure for the flow volume

Cycles (A → B → A) are not supported by d3-sankey and will cause a layout error.
