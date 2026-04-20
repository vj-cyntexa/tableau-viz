# Network Graph Viz Extension

Force-directed node-link diagram for product co-purchase network analysis.
Nodes = products, edges = co-purchase relationships, edge thickness = relationship strength.

## Live URLs

| Item | URL |
|---|---|
| Production extension | https://vj-cyntexa.github.io/tableau-viz/extensions/network-graph/index.html |
| Test page | https://vj-cyntexa.github.io/tableau-viz/extensions/network-graph/test.html |
| Production TREX | `extensions/network-graph/network-graph.trex` |
| Local dev TREX | `extensions/network-graph/network-graph-local.trex` |

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `source` | discrete-dimension | Yes | Source product/node name |
| `target` | discrete-dimension | Yes | Target product/node name |
| `weight` | continuous-measure | Yes | Relationship strength (lift score or co-purchase count) |
| `node_size` | continuous-measure | No | Node size (e.g., total purchases). Falls back to degree centrality. |

## What IS Configurable (inside the extension toolbar)

- Strength threshold (percentile slider) — filters out weak edges
- Node label toggle (show/hide labels on nodes)
- Freeze/Unfreeze simulation toggle
- Drag individual nodes to pin them in place

## What is NOT Configurable

- Force simulation parameters (charge strength, link distance)
- Node color (assigned by name hash from Tableau10 palette)
- Layout algorithm (always force-directed)

## Files

| File | Purpose |
|---|---|
| `index.html` | Extension iframe shell with toolbar |
| `chart.js` | D3 force simulation + Tableau Extensions API integration |
| `test.html` | Browser test with 8 café products and 16 co-purchase edges |
| `network-graph.trex` | Production TREX manifest |
| `network-graph-local.trex` | Local dev TREX manifest (localhost:8080) |

## Local Dev Steps

1. From repo root: `python3 -m http.server 8080`
2. Open: `http://localhost:8080/extensions/network-graph/test.html`
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → open `network-graph-local.trex`

## Tableau Data Shape

Your Tableau worksheet needs one row per edge (source-target pair). If you have a co-purchase table, aggregate so each row is a unique product pair with its lift score.

## Tableau Cloud Allowlist

Add to your Tableau Cloud site allowlist:
```
https://vj-cyntexa.github.io
```
Settings → Extensions → Add domain.
