# Claude Code Instructions — Tableau Viz

## Project Purpose

Build Tableau workbooks and Viz Extensions locally using AI generation, then publish to Tableau Cloud. Claude Code generates all TWB XML, Hyper extract scripts, and Extension code. The human reviews in Tableau Desktop and approves before publishing.

## Tableau Cloud Connection

- **Server:** *(specify Tableau server URL here)*
- **Site:** *(specify site name here)*
- **MCP server:** `@tableau/mcp-server` — configured in `.mcp.json` (never commit this file)
- Use MCP tools to inspect existing workbooks, datasources, views, and Pulse metrics before building anything new.

## Gallery Page

- **Gallery URL:** https://vj-cyntexa.github.io/tableau-viz/gallery.html
- **Local file:** `gallery.html` (at repo root)
- **Rule:** Whenever a new extension is built or a test page URL changes, update `gallery.html` to add/update the extension card. Add Live cards under "Live Extensions" with working test page and extension links. Add planned extensions as dimmed cards under "Planned Extensions".

## Folder Conventions

Always maintain this structure. Create folders if missing:

```
data/raw/          ← source CSVs / JSON (gitignored)
data/extracts/     ← .hyper files (gitignored)
workbooks/templates/   ← Jinja2 TWB XML templates (committed)
workbooks/output/      ← generated .twb/.twbx (gitignored)
extensions/<name>/     ← .html, .js, .trex per extension
scripts/               ← Python scripts for extract, build, publish
config/workbook_spec.yml  ← spec file (committed)
```

## Workflow: Building a Workbook

1. Read `config/workbook_spec.yml` for requirements.
2. Use MCP tools to check what datasources and workbooks already exist on Tableau Cloud.
3. Generate TWB XML using Jinja2 templates in `workbooks/templates/`.
4. Package into `.twbx` using `scripts/build_workbook.py`.
5. Human opens in Tableau Desktop for visual review.
6. After approval, publish via `scripts/publish.py` using `tableauserverclient`.

## Workflow: Building a Viz Extension

1. Check [exchange.tableau.com/viz-extensions](https://exchange.tableau.com/viz-extensions) first — use community extensions when available.
2. Only build custom when the chart type doesn't exist or specific branding is required.
3. Generate: `<name>.trex` (manifest), `<name>.html` (shell), `<name>.js` (D3/SVG rendering).
4. Test locally: `npm start` in `extensions-api/` → port 8765. In Tableau Desktop: Marks card → Viz Extensions → Access Local → open `.trex`.
5. After approval, deploy to HTTPS host (GitHub Pages / Vercel) and update URL in `.trex`.

## Key Python Libraries

```bash
pip install tableauserverclient      # publish and manage on Tableau Cloud
pip install tableaudocumentapi       # read/modify TWB/TWBX XML
pip install tableauhyperapi          # create .hyper extract files
pip install simple-salesforce        # SOQL queries to Salesforce
pip install jinja2 pandas
```

## Packaging a TWBX

```python
import zipfile, os

def package_twbx(twb_path, hyper_paths, output_path):
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(twb_path, os.path.basename(twb_path))
        for h in hyper_paths:
            zf.write(h, f"Data/Extracts/{os.path.basename(h)}")
```

## MCP Tools Available

Use these to inspect the live Tableau Cloud environment:

- `list-workbooks` / `get-workbook` — existing workbooks
- `list-datasources` / `get-datasource-metadata` / `query-datasource` — available data
- `list-views` / `get-view-data` / `get-view-image` — view content
- `list-all-pulse-metric-definitions` / `generate-pulse-insight-brief` — Pulse metrics
- `search-content` — find any content by keyword

## Security Rules

- Never commit `.mcp.json` — it contains the PAT secret.
- Never commit `config/datasources.yml` — it contains connection credentials.
- Never hardcode credentials in scripts; read from environment variables or config files that are gitignored.

## References

- [Local Development Guide](./tableau-ai-local-development.md)
- [Extensions Guide](./tableau-extensions-guide.md)
- [TSC Docs](https://tableau.github.io/server-client-python/docs/)
- [Hyper API Docs](https://tableau.github.io/hyper-db/docs/)
- [Extensions API Docs](https://tableau.github.io/extensions-api/docs/)

## Extensions

### multi-line-chart

| Item | Value |
|---|---|
| Folder | `extensions/multi-line-chart/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/multi-line-chart/index.html` |
| Production TREX | `extensions/multi-line-chart/multi-line-chart.trex` |
| Local dev TREX | `extensions/multi-line-chart/multi-line-chart-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/multi-line-chart/test.html` |
| README | `extensions/multi-line-chart/README.md` |

**Encodings:**
- `x` — Date dimension (1 field, required)
- `y` — Numeric measure (1 field, required)
- `color` — Dimension for line grouping / series (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/multi-line-chart/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `multi-line-chart-local.trex`

**To add a new extension:** copy the `multi-line-chart/` folder, update IDs in `.trex`, update the URL, and add it to this section.

**Extension README convention:** Every extension folder must have a `README.md` documenting: live URLs, encoding slots, what is and isn't configurable from Tableau's UI, file descriptions, local dev steps, and Tableau Cloud allowlist instructions. When you modify an extension (new encodings, changed URLs, new files), update its `README.md` in the same commit.

### bar-line-combo

| Item | Value |
|---|---|
| Folder | `extensions/bar-line-combo/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/bar-line-combo/index.html` |
| Production TREX | `extensions/bar-line-combo/bar-line-combo.trex` |
| Local dev TREX | `extensions/bar-line-combo/bar-line-combo-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/bar-line-combo/test.html` |
| README | `extensions/bar-line-combo/README.md` |

**Encodings:**
- `x` — Date or categorical dimension (1 field, required)
- `bar` — Primary numeric measure for bars, left Y axis (1 field, required)
- `line` — Secondary numeric measure for line overlay, right Y axis (1 field, required)
- `color` — Optional dimension for stacked bar grouping (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/bar-line-combo/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `bar-line-combo-local.trex`

### bar-chart

| Item | Value |
|---|---|
| Folder | `extensions/bar-chart/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/bar-chart/index.html` |
| Production TREX | `extensions/bar-chart/bar-chart.trex` |
| Local dev TREX | `extensions/bar-chart/bar-chart-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/bar-chart/test.html` |
| README | `extensions/bar-chart/README.md` |

**Encodings:**
- `x` — Discrete dimension for X-axis categories (1 field, required)
- `y` — Continuous measure for bar height/value (1 field, required)
- `color` — Discrete dimension for grouping/stacking (1 field, required)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/bar-chart/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `bar-chart-local.trex`

### donut-chart

| Item | Value |
|---|---|
| Folder | `extensions/donut-chart/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/donut-chart/index.html` |
| Production TREX | `extensions/donut-chart/donut-chart.trex` |
| Local dev TREX | `extensions/donut-chart/donut-chart-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/donut-chart/test.html` |
| README | `extensions/donut-chart/README.md` |

**Encodings:**
- `category` — Discrete dimension for slice labels (1 field, required)
- `value` — Continuous measure for outer arc sizes (1 field, required)
- `inner-value` — Continuous measure for inner ring in multi-ring mode (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/donut-chart/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `donut-chart-local.trex`

### kpi-card

| Item | Value |
|---|---|
| Folder | `extensions/kpi-card/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/kpi-card/index.html` |
| Production TREX | `extensions/kpi-card/kpi-card.trex` |
| Local dev TREX | `extensions/kpi-card/kpi-card-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/kpi-card/test.html` |
| README | `extensions/kpi-card/README.md` |

**Encodings:**
- `value` — Continuous measure for primary KPI value (1 field, required)
- `label` — Discrete dimension for card title/label (1 field, optional)
- `comparison` — Continuous measure for delta % in Comparison and Trend modes (1 field, optional)
- `history` — Continuous measure for sparkline series values (1 field, optional)
- `date` — Discrete dimension for sparkline X axis (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/kpi-card/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `kpi-card-local.trex`

### relationship-table

| Item | Value |
|---|---|
| Folder | `extensions/relationship-table/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/relationship-table/index.html` |
| Production TREX | `extensions/relationship-table/relationship-table.trex` |
| Local dev TREX | `extensions/relationship-table/relationship-table-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/relationship-table/test.html` |
| README | `extensions/relationship-table/README.md` |

**Encodings:**
- `row` — Discrete dimension for row labels (1 field, required)
- `column` — Discrete dimension for column headers (1 field, required)
- `value` — Continuous measure for cell values (1 field, required)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/relationship-table/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `relationship-table-local.trex`

### affinity-matrix

| Item | Value |
|---|---|
| Folder | `extensions/affinity-matrix/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/affinity-matrix/index.html` |
| Production TREX | `extensions/affinity-matrix/affinity-matrix.trex` |
| Local dev TREX | `extensions/affinity-matrix/affinity-matrix-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/affinity-matrix/test.html` |
| README | `extensions/affinity-matrix/README.md` |

**Encodings:**
- `row` — Discrete dimension for row labels / product (1 field, required)
- `col` — Discrete dimension for column headers / product (1 field, required)
- `count` — Continuous measure for co-purchase count (1 field, required)
- `row_total` — Continuous measure for total purchases of the row product (1 field, required)
- `col_total` — Continuous measure for total purchases of the column product (1 field, required)
- `grand_total` — Continuous measure for total transactions; required for Lift and Support (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/affinity-matrix/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `affinity-matrix-local.trex`

### venn-diagram

| Item | Value |
|---|---|
| Folder | `extensions/venn-diagram/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/venn-diagram/index.html` |
| Production TREX | `extensions/venn-diagram/venn-diagram.trex` |
| Local dev TREX | `extensions/venn-diagram/venn-diagram-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/venn-diagram/test.html` |
| README | `extensions/venn-diagram/README.md` |

**Encodings:**
- `Sets` — Discrete dimension for set name(s); use comma-separated values for intersections (1 field, required)
- `Value` — Continuous measure for count/size per segment (1 field, required)
- `Label` — Discrete dimension for display label inside region (1 field, optional)
- `Group` — Discrete dimension for multi-panel grouped view (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/venn-diagram/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `venn-diagram-local.trex`

### cohort-retention-heatmap

| Item | Value |
|---|---|
| Folder | `extensions/cohort-retention-heatmap/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/cohort-retention-heatmap/index.html` |
| Production TREX | `extensions/cohort-retention-heatmap/cohort-retention-heatmap.trex` |
| Local dev TREX | `extensions/cohort-retention-heatmap/cohort-retention-heatmap-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/cohort-retention-heatmap/test.html` |
| README | `extensions/cohort-retention-heatmap/README.md` |

**Encodings:**
- `cohort` — Discrete dimension for acquisition cohort label (1 field, required)
- `period` — Continuous measure for period index since acquisition (1 field, required)
- `retention` — Continuous measure for retention rate as a decimal 0.0–1.0 (1 field, required)
- `cohort_size` — Continuous measure for number of customers in cohort; tooltip only (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/cohort-retention-heatmap/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `cohort-retention-heatmap-local.trex`

### funnel-chart

| Item | Value |
|---|---|
| Folder | `extensions/funnel-chart/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/funnel-chart/index.html` |
| Production TREX | `extensions/funnel-chart/funnel-chart.trex` |
| Local dev TREX | `extensions/funnel-chart/funnel-chart-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/funnel-chart/test.html` |
| README | `extensions/funnel-chart/README.md` |

**Encodings:**
- `stage` — Discrete dimension for stage label; row order = funnel sequence (1 field, required)
- `value` — Continuous measure for volume at each stage (1 field, required)
- `color` — Discrete dimension for segment color differentiation (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/funnel-chart/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `funnel-chart-local.trex`

### sankey-diagram

| Item | Value |
|---|---|
| Folder | `extensions/sankey-diagram/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/sankey-diagram/index.html` |
| Production TREX | `extensions/sankey-diagram/sankey-diagram.trex` |
| Local dev TREX | `extensions/sankey-diagram/sankey-diagram-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/sankey-diagram/test.html` |
| README | `extensions/sankey-diagram/README.md` |

**Encodings:**
- `source` — Discrete dimension for source node label (1 field, required)
- `target` — Discrete dimension for target node label (1 field, required)
- `value` — Continuous measure for flow volume (1 field, required)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/sankey-diagram/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `sankey-diagram-local.trex`

### rfm-scatter

| Item | Value |
|---|---|
| Folder | `extensions/rfm-scatter/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/rfm-scatter/index.html` |
| Production TREX | `extensions/rfm-scatter/rfm-scatter.trex` |
| Local dev TREX | `extensions/rfm-scatter/rfm-scatter-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/rfm-scatter/test.html` |
| README | `extensions/rfm-scatter/README.md` |

**Encodings:**
- `recency` — Continuous measure for days since last purchase (1 field, required)
- `frequency` — Continuous measure for number of purchases (1 field, required)
- `monetary` — Continuous measure for total spend / bubble size (1 field, required)
- `segment` — Discrete dimension for RFM segment label and color (1 field, required)
- `label` — Discrete dimension for customer name/ID shown in tooltip (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/rfm-scatter/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `rfm-scatter-local.trex`

### treemap

| Item | Value |
|---|---|
| Folder | `extensions/treemap/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/treemap/index.html` |
| Production TREX | `extensions/treemap/treemap.trex` |
| Local dev TREX | `extensions/treemap/treemap-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/treemap/test.html` |
| README | `extensions/treemap/README.md` |

**Encodings:**
- `label` — Discrete dimension for leaf node label (1 field, required)
- `size` — Continuous measure for rectangle area (1 field, required)
- `parent` — Discrete dimension for parent category; enables 2-level hierarchy (1 field, optional)
- `color` — Continuous measure for sequential color encoding (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/treemap/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `treemap-local.trex`

### waterfall-chart

| Item | Value |
|---|---|
| Folder | `extensions/waterfall-chart/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/waterfall-chart/index.html` |
| Production TREX | `extensions/waterfall-chart/waterfall-chart.trex` |
| Local dev TREX | `extensions/waterfall-chart/waterfall-chart-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/waterfall-chart/test.html` |
| README | `extensions/waterfall-chart/README.md` |

**Encodings:**
- `label` — Discrete dimension for step label; row order = waterfall sequence (1 field, required)
- `value` — Continuous measure; positive = gain, negative = loss (1 field, required)
- `type` — Discrete dimension for bar type override: `total`, `subtotal`, or `relative` (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/waterfall-chart/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `waterfall-chart-local.trex`

### survival-curve

| Item | Value |
|---|---|
| Folder | `extensions/survival-curve/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/survival-curve/index.html` |
| Production TREX | `extensions/survival-curve/survival-curve.trex` |
| Local dev TREX | `extensions/survival-curve/survival-curve-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/survival-curve/test.html` |
| README | `extensions/survival-curve/README.md` |

**Encodings:**
- `period` — Continuous measure for time period index 0, 1, 2, … (1 field, required)
- `survival` — Continuous measure for survival probability 0.0–1.0 (1 field, required)
- `segment` — Discrete dimension for segment label / multiple lines (1 field, optional)
- `ci_lower` — Continuous measure for confidence interval lower bound (1 field, optional)
- `ci_upper` — Continuous measure for confidence interval upper bound (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/survival-curve/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `survival-curve-local.trex`

### bubble-chart

| Item | Value |
|---|---|
| Folder | `extensions/bubble-chart/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/bubble-chart/index.html` |
| Production TREX | `extensions/bubble-chart/bubble-chart.trex` |
| Local dev TREX | `extensions/bubble-chart/bubble-chart-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/bubble-chart/test.html` |
| README | `extensions/bubble-chart/README.md` |

**Encodings:**
- `x` — Continuous measure for X axis value (1 field, required)
- `y` — Continuous measure for Y axis value (1 field, required)
- `size` — Continuous measure for bubble area (1 field, required)
- `color` — Discrete dimension for segment label and color (1 field, required)
- `label` — Discrete dimension for text inside bubble (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/bubble-chart/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `bubble-chart-local.trex`

### network-graph

| Item | Value |
|---|---|
| Folder | `extensions/network-graph/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/network-graph/index.html` |
| Production TREX | `extensions/network-graph/network-graph.trex` |
| Local dev TREX | `extensions/network-graph/network-graph-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/network-graph/test.html` |
| README | `extensions/network-graph/README.md` |

**Encodings:**
- `source` — Discrete dimension for source node name (1 field, required)
- `target` — Discrete dimension for target node name (1 field, required)
- `weight` — Continuous measure for relationship strength (1 field, required)
- `node_size` — Continuous measure for node size; falls back to degree centrality (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/network-graph/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `network-graph-local.trex`

### gauge-chart

| Item | Value |
|---|---|
| Folder | `extensions/gauge-chart/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/gauge-chart/index.html` |
| Production TREX | `extensions/gauge-chart/gauge-chart.trex` |
| Local dev TREX | `extensions/gauge-chart/gauge-chart-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/gauge-chart/test.html` |
| README | `extensions/gauge-chart/README.md` |

**Encodings:**
- `value` — Continuous measure for current KPI value (1 field, required)
- `target` — Continuous measure for target/goal value (1 field, required)
- `label` — Discrete dimension for KPI name shown below gauge (1 field, optional)
- `min` — Continuous measure for scale minimum (1 field, optional)
- `max` — Continuous measure for scale maximum (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/gauge-chart/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `gauge-chart-local.trex`

### histogram

| Item | Value |
|---|---|
| Folder | `extensions/histogram/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/histogram/index.html` |
| Production TREX | `extensions/histogram/histogram.trex` |
| Local dev TREX | `extensions/histogram/histogram-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/histogram/test.html` |
| README | `extensions/histogram/README.md` |

**Encodings:**
- `value` — Continuous measure for the numeric distribution (1 field, required)
- `segment` — Discrete dimension for overlapping per-segment histogram layers (1 field, optional)
- `bin_count` — Continuous measure whose first-row value overrides auto bin count (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/histogram/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `histogram-local.trex`

### stacked-area-chart

| Item | Value |
|---|---|
| Folder | `extensions/stacked-area-chart/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/stacked-area-chart/index.html` |
| Production TREX | `extensions/stacked-area-chart/stacked-area-chart.trex` |
| Local dev TREX | `extensions/stacked-area-chart/stacked-area-chart-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/stacked-area-chart/test.html` |
| README | `extensions/stacked-area-chart/README.md` |

**Encodings:**
- `date` — Discrete dimension for time period labels on the X axis (1 field, required)
- `value` — Continuous measure for numeric value per segment per period (1 field, required)
- `segment` — Discrete dimension for area layers (1 field, required)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/stacked-area-chart/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `stacked-area-chart-local.trex`

### clv-churn-quadrant

| Item | Value |
|---|---|
| Folder | `extensions/clv-churn-quadrant/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/clv-churn-quadrant/index.html` |
| Production TREX | `extensions/clv-churn-quadrant/clv-churn-quadrant.trex` |
| Local dev TREX | `extensions/clv-churn-quadrant/clv-churn-quadrant-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/clv-churn-quadrant/test.html` |
| README | `extensions/clv-churn-quadrant/README.md` |

**Encodings:**
- `clv` — Continuous measure for Customer Lifetime Value on X axis (1 field, required)
- `churn_risk` — Continuous measure for churn probability 0.0–1.0 on Y axis (1 field, required)
- `segment` — Discrete dimension for segment label and color (1 field, required)
- `size` — Continuous measure for bubble radius via scaleSqrt (1 field, optional)
- `label` — Discrete dimension for text inside bubble (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/clv-churn-quadrant/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `clv-churn-quadrant-local.trex`

### lollipop-chart

| Item | Value |
|---|---|
| Folder | `extensions/lollipop-chart/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/lollipop-chart/index.html` |
| Production TREX | `extensions/lollipop-chart/lollipop-chart.trex` |
| Local dev TREX | `extensions/lollipop-chart/lollipop-chart-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/lollipop-chart/test.html` |
| README | `extensions/lollipop-chart/README.md` |

**Encodings:**
- `category` — Discrete dimension for category label per lollipop (1 field, required)
- `value` — Continuous measure for numeric metric value / lollipop length (1 field, required)
- `benchmark` — Continuous measure for benchmark/target reference line (1 field, optional)
- `color` — Discrete dimension for dot/stem color grouping (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/lollipop-chart/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `lollipop-chart-local.trex`
