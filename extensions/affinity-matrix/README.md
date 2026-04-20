# Affinity Matrix — Tableau Viz Extension

A D3 v7 Tableau Viz Extension that renders a product affinity / co-occurrence matrix. Shows which products are bought together, with metric toggle (Count / Lift / Support), a diverging color scale for Lift, diagonal highlighting, and sortable axes.

## Live URLs

| File | URL |
|---|---|
| Extension | `https://vj-cyntexa.github.io/tableau-viz/extensions/affinity-matrix/index.html` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/affinity-matrix/test.html` |

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `row` | Discrete dimension | Yes | Product field for row labels |
| `col` | Discrete dimension | Yes | Product field for column headers. Use the same field as `row` for a symmetric matrix |
| `count` | Continuous measure | Yes | Co-purchase count: how many transactions contain both products |
| `row_total` | Continuous measure | Yes | LOD calc: total purchases of the row product |
| `col_total` | Continuous measure | Yes | LOD calc: total purchases of the column product |
| `grand_total` | Continuous measure | No | LOD calc: total transactions. Required for Lift and Support metrics |

## Metrics

| Metric | Formula | Color Scale |
|---|---|---|
| Count | Raw co-purchase count | Sequential Blues (0 → max) |
| Support | `count / grand_total` | Sequential Blues (0 → max) |
| Lift | `count × grand_total / (row_total × col_total)` | Diverging PuOr: purple (<1 = avoidance), white (=1 = neutral), orange (>1 = affinity) |

**Lift interpretation:**
- `< 1` — products are bought together less often than chance (avoidance)
- `= 1` — no association
- `> 1` — products are bought together more often than chance (affinity)
- Color scale clamps at 2.0; true value still shown in cell and tooltip

## Features

- Symmetric mode auto-detected when row and col use the same field
- Click a column header to sort both axes by affinity with that product (symmetric mode keeps diagonal on diagonal)
- Grey diagonal cells with italic self-total
- Tooltip shows Count, Support, and Lift for every non-diagonal cell
- Lift and Support buttons disabled when `grand_total` encoding is empty, with explanatory tooltip
- Sticky row headers and column headers for large matrices

## What is NOT configurable from Tableau's UI

- Color palette (hardcoded: Blues for Count/Support, PuOr for Lift)
- Cell text format (auto-selected per metric)
- Lift color domain (fixed 0–1–2)

## File Descriptions

| File | Description |
|---|---|
| `affinity-matrix.trex` | Production manifest pointing to GitHub Pages |
| `affinity-matrix-local.trex` | Dev manifest pointing to localhost:8080 |
| `index.html` | Extension shell with toolbar, styles, and empty state |
| `chart.js` | All D3 rendering, Tableau API integration, metric logic |
| `test.html` | Standalone browser test — 5×5 coffee-shop products, no Tableau required |

## Dev Workflow

```bash
# 1. Start local server from repo root
python3 -m http.server 8080

# 2. Open test page (no Tableau required)
open http://localhost:8080/extensions/affinity-matrix/test.html

# 3. Load in Tableau Desktop
# Marks card → Viz Extensions → Access Local Extensions → affinity-matrix-local.trex
```

## Tableau Cloud Allowlist

Add `https://vj-cyntexa.github.io` to the site's allowlist under Settings → Extensions.

## Setting Up the Data in Tableau

Create a calculated field datasource with these LOD expressions:

```
// Co-purchase count (row A, col B — from a flat transactions table):
{ FIXED [Row Product], [Col Product] : COUNT([Transaction ID]) }

// Row product total:
{ FIXED [Row Product] : COUNT(DISTINCT [Transaction ID]) }

// Col product total:
{ FIXED [Col Product] : COUNT(DISTINCT [Transaction ID]) }

// Grand total:
{ FIXED : COUNT(DISTINCT [Transaction ID]) }
```

Drag each to its respective encoding slot. The extension handles all metric calculation internally.

## Author

Cyntexa — vishwajeet@cyntexa.com
