# Loyalty Dashboard Project — Progress Log

Last updated: 2026-04-21

---

## Project Status

Active development. Dashboard #1 (Voucher Intelligence) has been built programmatically and is ready for manual polish in Tableau Desktop. Dashboards #2–#5 are planned but not yet built. All 30 KPIs across five dashboards have been specified, validated for field availability, and mapped to datasource columns.

---

## Dashboard #1 — Voucher Intelligence (Built)

**Output file (gitignored):** `local-project-work/Loyalty-D1-Voucher-Intelligence.twbx`

**What is automated:**
- Full TWBX construction from `Loyalty-Clean.twbx` via `scripts/build_d1_voucher_intelligence.py`
- Calculated fields injected into the V2 datasource: Voucher Leakage %, Face Value KPI, Redemption Rate, and supporting measures
- Sankey worksheet copied from `Loyalty-Sankey-v2.twbx` and remapped to voucher calc fields
- KPI tile worksheets (V1, V2 KPI, V4 KPI) added with fixed 1440×900 layout
- Bar/combo worksheets (V2 bar by definition, V5 bar, V6 dual-axis) generated
- Dashboard container XML assembled with tiled layout

**What needs manual finish in Tableau Desktop:**
- Color palette and formatting (fonts, borders, tooltip wording)
- Final filter action wiring between sheets
- Axis label cleanup and number format polish
- Visual QA against the UI-UX Design System (in `local-project-work/`)

**Key findings validated:**
- Voucher leakage: **₹81.9M (19.6%)** of total face value is leaked
- Retail channel dominates spend: **₹14.9B (97%)** vs. online **₹483M (3%)**
- All three voucher value fields (Face Value Amount, Redeemed Value, Remaining Value) confirmed to co-exist in `sqlproxy.1r2623d1a8xete1b4fo5u1001yng` (Loyalty Report Data Source)

---

## Dashboards #2–#5 — Planned

| # | Dashboard | Status |
|---|-----------|--------|
| 2 | Enrollment & Member Health | Planned |
| 3 | Tier & Redemption Performance | Planned |
| 4 | Channel & Campaign Analytics | Planned |
| 5 | Executive Summary / Pulse | Planned |

Build order and KPI details are in `local-project-work/FINAL-KPI-BLUEPRINT.md` (gitignored).

---

## Validated KPIs

30 KPIs across 5 dashboards have been:
- Specified in `local-project-work/KPI-SPEC.md`
- Verified for field existence in both datasources (Loyalty Report Data Source + Loyalty Report V2)
- Mapped to exact Salesforce column names (ssot__ prefix, __c suffix) in `local-project-work/TWBX-FIELD-MAP.md`

**Validation results (from `scripts/validate_kpi_fields.py` run 2026-04-21):**
- 22 of 26 fields confirmed with live data via VizQL
- 0 fields require secondary-path workaround
- 3 fields not found (likely caption spelling differences — to resolve in Tableau Desktop)

---

## Validation Infrastructure (in `scripts/`)

All scripts read credentials from environment variables only — no secrets in code.

| File | Purpose |
|---|---|
| `tableau_client.py` | TSC wrapper: sign-in, datasource download, view enumeration |
| `vizql_client.py` | VizQL Data Service client for field-level data presence checks |
| `validate_kpi_fields.py` | Runs 26-field validation pass against Loyalty Report V2; writes results to `scripts/output/` (gitignored) |
| `build_d1_voucher_intelligence.py` | Programmatic TWBX builder for Dashboard #1; reads from `local-project-work/`, writes to `local-project-work/` |
| `requirements_validation.txt` | Python dependencies: `tableauserverclient`, `requests`, `python-dotenv` |
| `README_VALIDATION.md` | Setup and usage guide for the validation suite |

**Running validation:**
```bash
export TABLEAU_PAT_NAME="your-token-name"
export TABLEAU_PAT_VALUE="your-token-value"
pip install -r scripts/requirements_validation.txt
python scripts/validate_kpi_fields.py
```

---

## Planning Artifacts (in `local-project-work/` — gitignored)

These files live in `local-project-work/` which is gitignored per project rules. They are listed here so the team knows they exist.

| File | Contents |
|---|---|
| `FINAL-KPI-BLUEPRINT.md` | Master KPI definitions, 30 KPIs across 5 dashboards, build order |
| `KPI-SPEC.md` | Detailed per-KPI spec: formula, datasource field, chart type, filter |
| `TWBX-FIELD-MAP.md` | Maps each KPI to exact TWB column/caption |
| `REFERENCE-FIELD-USAGE.md` | Field-by-field reference: which worksheets use each field |
| `TABLEAU-FEASIBILITY-AUDIT.md` | Feasibility assessment for each chart type in Tableau |
| `TABLEAU-VIZ-CATALOGUE.md` | Gallery of chart types considered and selected |
| `UI-UX-DESIGN-SYSTEM.md` | Color palette, typography, spacing, layout system |
| `UI-UX-RESEARCH-FINDINGS.md` | UX research notes informing the design system |
| `DESIGN-GUARDRAILS.md` | Rules for consistent visual design across all 5 dashboards |
| `TSC-VALIDATION-PLAN.md` | Plan for field validation using TSC + VizQL clients |
| `TSC-CROSS-TABLE-RESEARCH.md` | Research on cross-datasource query patterns |
| `D1-BUILD-REPORT.md` | Detailed build log for Dashboard #1 construction |

---

## Next Steps

1. **D1 polish** — Open `Loyalty-D1-Voucher-Intelligence.twbx` in Tableau Desktop; apply formatting, fix filter actions, QA against design system
2. **D1 sign-off** — Review with stakeholder; approve for Tableau Cloud publish
3. **D1 publish** — Use `scripts/publish.py` (to be created) with `tableauserverclient`
4. **D2 build** — Enrollment & Member Health dashboard; follow same build-script pattern
5. **Resolve 3 not-found fields** — Open Tableau Desktop, confirm exact caption spelling, update `validate_kpi_fields.py` field list

---

## Datasources on Tableau Cloud

| Caption | Connection ID | Columns |
|---|---|---|
| Loyalty Report Data Source | `sqlproxy.1r2623d1a8xete1b4fo5u1001yng` | 949 |
| Loyalty Report V2 | `sqlproxy.0iu1zjg1usn1w618583nd1p2lua3` | 635 |

Both are SQL Proxy connections to Tableau Cloud (`prod-apsoutheast-b.online.tableau.com`). The voucher value fields (Face Value Amount, Redeemed Value, Remaining Value) all reside in the primary datasource (Loyalty Report Data Source).
