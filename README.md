# Tableau Viz

AI-assisted local Tableau development workspace. Claude Code generates all workbook XML, data pipelines, and Viz Extension code. Files are built locally, previewed in Tableau Desktop, then published to Tableau Cloud.

## Workflow

```
Describe requirements
        ↓
Claude Code generates TWB/TWBX/Extensions
        ↓
Preview in Tableau Desktop (local)
        ↓
Approve → publish to Tableau Cloud  |  Request changes → iterate
```

## Project Structure

```
tableau-viz/
  data/
    raw/              ← exported CSVs / JSON from source systems (gitignored)
    extracts/         ← generated .hyper files (gitignored)
  workbooks/
    templates/        ← Jinja2 TWB XML templates
    output/           ← generated .twb and .twbx files (gitignored)
  extensions/         ← custom Viz Extension code
    <name>/
      <name>.html
      <name>.js
      <name>.trex
  scripts/
    extract_data.py   ← pulls data from source systems
    build_workbook.py ← renders template → packages .twbx
    publish.py        ← pushes to Tableau Cloud via TSC
    refresh.py        ← triggers extract refresh on Tableau Cloud
  config/
    workbook_spec.yml ← dashboard / sheet / KPI definitions
  requirements.txt
```

## Prerequisites

| Tool | Purpose |
|---|---|
| Tableau Desktop (Creator license) | Preview generated workbooks locally |
| Python 3.10+ | Data extraction, workbook packaging, publishing |
| Node.js + npm | Only needed for custom Viz Extensions |

```bash
pip install tableauserverclient tableaudocumentapi tableauhyperapi simple-salesforce jinja2 pandas
```

## Tableau Cloud

- **URL:** https://prod-apsoutheast-b.online.tableau.com/
- **Site:** ample
- MCP server configured in `.mcp.json` (gitignored — contains credentials)

## File Types

| File | What It Is |
|---|---|
| `.twb` | Pure XML — workbook structure, sheets, dashboards |
| `.twbx` | ZIP: `.twb` + extract data + images |
| `.hyper` | Tableau columnar data extract (Hyper API) |
| `.trex` | Viz Extension manifest (XML) |

## References

- [Tableau Server Client (Python)](https://github.com/tableau/server-client-python)
- [Tableau Hyper API](https://tableau.github.io/hyper-db/docs/)
- [Extensions API SDK](https://github.com/tableau/extensions-api)
- [Tableau Exchange — free Viz Extensions](https://exchange.tableau.com/viz-extensions)
- [Local Development Guide](./tableau-ai-local-development.md)
- [Extensions Guide](./tableau-extensions-guide.md)
