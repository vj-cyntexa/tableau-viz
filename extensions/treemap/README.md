# Treemap — Tableau Viz Extension

Renders nested rectangles where area represents a size measure. Supports 1-level (flat) or 2-level (parent → children) hierarchies with four tiling algorithms. Used for visualizing loyalty segment composition by customer count and CLV.

## Live URLs

| Resource | URL |
|----------|-----|
| Production extension | `https://vj-cyntexa.github.io/tableau-viz/extensions/treemap/index.html` |
| Browser test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/treemap/test.html` |
| Production TREX | `extensions/treemap/treemap.trex` |
| Local dev TREX | `extensions/treemap/treemap-local.trex` |

## Encoding Slots

| Slot ID | Role | Required | Description |
|---------|------|----------|-------------|
| `label` | discrete-dimension | Yes | Leaf node label (segment name) |
| `parent` | discrete-dimension | No | Parent category (e.g., loyalty tier). Enables 2-level hierarchy |
| `size` | continuous-measure | Yes | Determines rectangle area (customer count, revenue) |
| `color` | continuous-measure | No | Color encoding — if numeric, drives sequential blue scale |

## What Is Configurable

| Control | Description |
|---------|-------------|
| Tiling algorithm | Squarify / Slice / Dice / SliceDice toolbar buttons |
| Color mode | By Category (ordinal colors per parent) / By Value (sequential blues) |
| Parent Labels | Show/hide parent category labels and border outlines |

## What Is NOT Configurable from Tableau UI

- Node padding (fixed at 2px inner, 20px outer for 2-level hierarchy)
- Text clipping threshold (text hidden if node width < 40px)
- Color palettes (Tableau10 for category mode, Blues sequential for value mode)

## File Descriptions

| File | Purpose |
|------|---------|
| `treemap.trex` | Production manifest pointing to GitHub Pages URL |
| `treemap-local.trex` | Local dev manifest pointing to localhost:8080 |
| `index.html` | Tableau iframe shell with tiling/color/label toolbar |
| `chart.js` | All rendering: D3 treemap layout, label clipping, luminance-based text color |
| `test.html` | Standalone test — 15 loyalty segment/tier rows, 4 parent tiers |
| `README.md` | This file |

## Local Dev Steps

1. Start local server from repo root:
   ```bash
   python3 -m http.server 8080
   ```
2. Open: `http://localhost:8080/extensions/treemap/test.html`
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `treemap-local.trex`

## Tableau Cloud Allowlist

```
https://vj-cyntexa.github.io/tableau-viz/extensions/treemap/index.html
```
**Path:** Tableau Cloud → Site Settings → Extensions → Add extension URL

## Data Requirements

One row per leaf node. Required: a label dimension and a size measure.

For 2-level hierarchy: add a parent dimension column mapping each leaf to its parent category.

The `color` slot accepts a numeric measure; it drives the sequential color scale in "By Value" mode. In "By Category" mode, color is determined by the parent grouping.
