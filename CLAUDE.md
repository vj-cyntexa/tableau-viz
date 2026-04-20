# Claude Code Instructions — Tableau Viz

## Project Purpose

Build Tableau workbooks and Viz Extensions locally using AI generation, then publish to Tableau Cloud. Claude Code generates all TWB XML, Hyper extract scripts, and Extension code. The human reviews in Tableau Desktop and approves before publishing.

## Tableau Cloud Connection

- **Server:** https://prod-apsoutheast-b.online.tableau.com/
- **Site:** ample
- **MCP server:** `@tableau/mcp-server` — configured in `.mcp.json` (never commit this file)
- Use MCP tools to inspect existing workbooks, datasources, views, and Pulse metrics before building anything new.

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
