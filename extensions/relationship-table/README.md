# Relationship Table — Tableau Viz Extension

A D3 v7 Tableau Viz Extension that renders a relationship matrix table. Rows are one dimension, columns are another dimension, and cells show a numeric measure. Cells are color-coded by value intensity.

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `row` | Discrete dimension | Yes | Values become row labels |
| `column` | Discrete dimension | Yes | Values become column headers |
| `value` | Continuous measure | Yes | Numeric value shown in each cell |

## Display Modes

Toggle between two modes using the toolbar buttons:

- **Heatmap** (default) — cells are colored by value intensity using a sequential Blues scale. High values are dark blue; low values are light blue. Text is white or black depending on background luminance.
- **Table** — cell backgrounds are white; text is colored by value rank within each column (dark blue = high, grey = low).

## Features

- Sticky row headers and column headers for large matrices
- Click any column header to sort rows by that column's value (click again to reverse)
- "Row Total" column (sortable) and "Column Total" footer row
- Grand total in the bottom-right corner
- Hover tooltip showing exact value, row name, and column name
- Number formatting: `,.0f` for cell values, `~s` (SI prefix) for totals

## Live URL

`https://vj-cyntexa.github.io/tableau-viz/extensions/relationship-table/index.html`

## Dev Workflow

```bash
# 1. Start local server from repo root
python3 -m http.server 8080

# 2. Open test page (no Tableau required)
open http://localhost:8080/extensions/relationship-table/test.html

# 3. Load in Tableau Desktop
# Marks card → Viz Extensions → Access Local Extensions → relationship-table-local.trex
```

## TREX Files

| File | URL |
|---|---|
| `relationship-table.trex` | `https://vj-cyntexa.github.io/tableau-viz/...` |
| `relationship-table-local.trex` | `http://localhost:8080/...` |

## Author

Cyntexa
