# Loyalty Report V2 — KPI Field Validation Suite

Read-only validation of 18 KPI fields in the Loyalty Report V2 published datasource on Tableau Cloud. No data is written to Tableau Cloud during execution.

---

## Setup

### 1. Set environment variables

```bash
export TABLEAU_PAT_NAME="your-token-name"
export TABLEAU_PAT_TOKEN="your-token-value"
```

Both variables must be set. The script exits immediately if either is missing or empty. Never commit these values to version control.

### 2. Install dependencies

```bash
pip install -r scripts/requirements_validation.txt
```

Requires Python 3.9 or later.

---

## Running the validation

From the project root:

```bash
cd scripts
python validate_kpi_fields.py
```

Or with an absolute path:

```bash
python /path/to/scripts/validate_kpi_fields.py
```

Execution takes 2–5 minutes depending on network latency and the number of views scanned during the secondary-connection fallback.

---

## Output files

All outputs are written to `scripts/output/`.

| File | Format | Purpose |
|---|---|---|
| `validation_report.json` | JSON | Machine-readable full results — one object per field with status, method, sample values, and metadata. Suitable for CI parsing or downstream tooling. |
| `validation_report.md` | Markdown | Human-readable summary table and per-field detail. Open in any Markdown viewer for a quick pass/fail review. |
| `validation_log.txt` | Plain text | Timestamped execution log. Every HTTP call, result, and fallback decision is recorded here. Use this for debugging unexpected results. |

A stdout summary is printed on completion showing totals and any action items.

---

## What the status values mean

| Status | Meaning |
|---|---|
| `YES` | Data confirmed via VizQL query against the primary datasource. |
| `YES_VIA_VIEW` | Data confirmed via a published view (secondary-connection field). |
| `EMPTY` | Field exists; VizQL returned 200 but zero rows. Investigate data pipeline. |
| `METADATA_ONLY` | Field found in downloaded .tdsx XML but data presence could not be confirmed. |
| `SECONDARY_PATH_REQUIRED` | Field is in the secondary connection and no published view exposes it. Data presence requires a direct Tableau Desktop connection. |
| `NOT_FOUND` | Field not found via any method. Verify the caption spelling in Tableau Desktop. |

---

## Security

- Credentials are read exclusively from environment variables — never from files or code.
- The PAT value is filtered out of all log output by `_RedactPATFilter`.
- No data is written to Tableau Cloud. All TSC calls are `get`, `get_by_id`, and `download` only.
- Output files contain aggregated metrics and field metadata — no row-level customer data.
- Output files are in `scripts/output/` which should be gitignored (add it if not already present).
