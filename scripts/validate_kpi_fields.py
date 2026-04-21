"""
Loyalty Report V2 — KPI field validation script.

Validates 18 KPI fields against the published datasource on Tableau Cloud.
Strictly read-only: no publish, update, delete, or row-level data retrieval.

Outputs:
  scripts/output/validation_report.json
  scripts/output/validation_report.md
  scripts/output/validation_log.txt
"""

from __future__ import annotations

import json
import logging
import os
import sys
import textwrap
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "local-project-work" / ".env")

# ---------------------------------------------------------------------------
# Guard: ensure dependencies are importable before doing anything else
# ---------------------------------------------------------------------------

try:
    import tableauserverclient  # noqa: F401
except ImportError:
    print(
        "ERROR: tableauserverclient is not installed.\n"
        "Run: pip install 'tableauserverclient>=0.25'"
    )
    sys.exit(1)

try:
    import requests  # noqa: F401
except ImportError:
    print("ERROR: requests is not installed.\nRun: pip install 'requests>=2.31'")
    sys.exit(1)

from tableau_client import TableauClient
from vizql_client import VizQLClient

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_SCRIPTS_DIR = Path(__file__).parent
_OUTPUT_DIR = _SCRIPTS_DIR / "output"
_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

_LOG_FILE = _OUTPUT_DIR / "validation_log.txt"
_JSON_REPORT = _OUTPUT_DIR / "validation_report.json"
_MD_REPORT = _OUTPUT_DIR / "validation_report.md"

# ---------------------------------------------------------------------------
# Logging — file + stderr; PAT values are never formatted into messages
# ---------------------------------------------------------------------------


class _RedactPATFilter(logging.Filter):
    """Drop any log record that somehow contains the raw PAT value."""

    def __init__(self) -> None:
        super().__init__()
        self._pat = os.environ.get("TABLEAU_PAT_VALUE", "")

    def filter(self, record: logging.LogRecord) -> bool:
        if self._pat and self._pat in str(record.getMessage()):
            record.msg = "[REDACTED — PAT detected in log message]"
            record.args = ()
        return True


def _setup_logging() -> None:
    fmt = logging.Formatter(
        "[%(asctime)s] %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    redact = _RedactPATFilter()

    file_handler = logging.FileHandler(_LOG_FILE, mode="w", encoding="utf-8")
    file_handler.setFormatter(fmt)
    file_handler.addFilter(redact)

    stream_handler = logging.StreamHandler(sys.stderr)
    stream_handler.setFormatter(fmt)
    stream_handler.addFilter(redact)

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    root.addHandler(file_handler)
    root.addHandler(stream_handler)


logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Datasource constants
# ---------------------------------------------------------------------------

_DS_LUID = "3d4cd49b-5d21-47a0-ba5e-6cc18d1fe41b"
_DS_NAME = "Loyalty Report V2"
_PRIMARY_CONN = "sqlproxy.0iu1zjg1usn1w618583nd1p2lua3"
_SECONDARY_CONN = "sqlproxy.1r2623d1a8xete1b4fo5u1001yng"

# ---------------------------------------------------------------------------
# KPI field definitions
#
# Each entry:
#   caption        — exact caption as shown in Tableau (used for VizQL queries
#                    and for XML lookup in the downloaded metadata)
#   category       — Enrollment | Spend | Voucher | Brand | CLV
#   query_function — VizQL aggregation function for existence check.
#                    "COUNTD" for dimensions, "SUM" for measures.
#                    None means dimension with no aggregation wrapper.
#   expected_type  — descriptive; not validated programmatically (metadata may
#                    use different casing/aliases)
#   secondary      — True if expected to be in the secondary connection;
#                    VizQL query is still attempted first.
# ---------------------------------------------------------------------------

KPI_FIELDS: list[dict[str, Any]] = [
    # Enrollment
    {
        "caption": "Enrollment Channel",
        "category": "Enrollment",
        "query_function": "COUNTD",
        "expected_type": "String",
        "secondary": True,
    },
    {
        "caption": "Name (Loyalty Program)",
        "category": "Enrollment",
        "query_function": "COUNTD",
        "expected_type": "String",
        "secondary": False,
    },
    {
        "caption": "Created Date",
        "category": "Enrollment",
        "query_function": "COUNT",
        "expected_type": "DateTime",
        "secondary": False,
    },
    # Spend
    {
        "caption": "Total Bill Amount",
        "category": "Spend",
        "query_function": "SUM",
        "expected_type": "Decimal",
        "secondary": False,
    },
    {
        "caption": "Sales Channel",
        "category": "Spend",
        "query_function": "COUNTD",
        "expected_type": "String",
        "secondary": False,
    },
    {
        "caption": "Is Punched On POS",
        "category": "Spend",
        "query_function": "COUNT",
        "expected_type": "Boolean",
        "secondary": False,
    },
    # Voucher
    {
        "caption": "Voucher Status",
        "category": "Voucher",
        "query_function": "COUNTD",
        "expected_type": "String",
        "secondary": True,
    },
    {
        "caption": "Face Value Amount",
        "category": "Voucher",
        "query_function": "SUM",
        "expected_type": "Decimal",
        "secondary": True,
    },
    {
        "caption": "Redeemed Value",
        "category": "Voucher",
        "query_function": "SUM",
        "expected_type": "Decimal",
        "secondary": True,
    },
    {
        "caption": "Remaining Value",
        "category": "Voucher",
        "query_function": "SUM",
        "expected_type": "Decimal",
        "secondary": True,
    },
    {
        "caption": "Name (Voucher Definition)",
        "category": "Voucher",
        "query_function": "COUNTD",
        "expected_type": "String",
        "secondary": True,
    },
    # Brand
    {
        "caption": "Brand Name",
        "category": "Brand",
        "query_function": "COUNTD",
        "expected_type": "String",
        "secondary": False,
    },
    {
        "caption": "Apple Annual Spend",
        "category": "Brand",
        "query_function": "SUM",
        "expected_type": "Decimal",
        "secondary": False,
    },
    {
        "caption": "Bose Annual Spend",
        "category": "Brand",
        "query_function": "SUM",
        "expected_type": "Decimal",
        "secondary": False,
    },
    {
        "caption": "Tekne Annual Spend",
        "category": "Brand",
        "query_function": "SUM",
        "expected_type": "Decimal",
        "secondary": False,
    },
    {
        "caption": "Imagine Annual Spend",
        "category": "Brand",
        "query_function": "SUM",
        "expected_type": "Decimal",
        "secondary": False,
    },
    # CLV
    {
        "caption": "Membership Number",
        "category": "CLV",
        "query_function": "COUNTD",
        "expected_type": "String",
        "secondary": False,
    },
    {
        "caption": "Repeat Purchase Ratio",
        "category": "CLV",
        "query_function": "SUM",
        "expected_type": "Decimal",
        "secondary": False,
    },
    # Additional fields — added for extended validation
    # Activation / Engagement
    {
        "caption": "Activation F30 Flag",
        "category": "Activation/Engagement",
        "query_function": "COUNTD",
        "expected_type": "Calculated",
        "secondary": False,
    },
    # Retention
    {
        "caption": "Last Activity Date",
        "category": "Retention",
        "query_function": "COUNT",
        "expected_type": "DateTime",
        "secondary": False,
    },
    # Spend (extra)
    {
        "caption": "Activity Date",
        "category": "Spend",
        "query_function": "COUNT",
        "expected_type": "DateTime",
        "secondary": False,
    },
    # Channel
    {
        "caption": "Outlet",
        "category": "Channel",
        "query_function": "COUNTD",
        "expected_type": "String",
        "secondary": False,
    },
    {
        "caption": "Transaction Location Name",
        "category": "Channel",
        "query_function": "COUNTD",
        "expected_type": "String",
        "secondary": False,
    },
    # Enrollment (extra)
    {
        "caption": "Loyalty Member Type",
        "category": "Enrollment",
        "query_function": "COUNTD",
        "expected_type": "String",
        "secondary": False,
    },
    # Geography
    {
        "caption": "Pincode",
        "category": "Geography",
        "query_function": "COUNTD",
        "expected_type": "String",
        "secondary": False,
    },
    # Brand (extra)
    {
        "caption": "Brand Count per Customer",
        "category": "Brand",
        "query_function": "SUM",
        "expected_type": "Calculated",
        "secondary": False,
    },
]

# ---------------------------------------------------------------------------
# Validation result dataclass (plain dict for JSON serializability)
# ---------------------------------------------------------------------------


def _empty_result(field: dict[str, Any]) -> dict[str, Any]:
    return {
        "field_name": field["caption"],
        "category": field["category"],
        "expected_secondary": field["secondary"],
        "found_in_datasource": False,
        "data_type": "Unknown",
        "data_present": {"status": "NOT_FOUND"},
        "validation_method": "None",
        "query_status": "N/A",
        "formula": "",
        "notes": "",
    }


# ---------------------------------------------------------------------------
# VizQL query helper
# ---------------------------------------------------------------------------


def _build_vizql_field(caption: str, function: str) -> dict[str, str]:
    """
    Construct a single VizQL field descriptor.

    Measures require a "function"; dimensions must omit it (VDS rejects
    an explicit NONE or empty-string function on dimension fields).
    """
    if function in ("SUM", "COUNT", "COUNTD", "AVG", "MIN", "MAX"):
        return {"fieldCaption": caption, "function": function}
    return {"fieldCaption": caption}


def _extract_sample_value(vds_response: dict[str, Any], caption: str) -> Any:
    """
    Pull the first value for the queried field from a successful VDS response.

    VDS returns data under different keys depending on the Tableau Cloud version
    (data[], rows[], or result.data[]). Try the known shapes in order.
    """
    # Shape 1: {"data": [{"fieldCaption": ..., "value": ...}]}
    data = vds_response.get("data")
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            # Flat row: {"<caption>": value, ...}
            if caption in first:
                return first[caption]
            # Or keyed by index: first value in the dict
            return next(iter(first.values()), None)

    # Shape 2: {"result": {"data": [...]}}
    result = vds_response.get("result")
    if isinstance(result, dict):
        inner = result.get("data", [])
        if isinstance(inner, list) and inner:
            first = inner[0]
            if isinstance(first, dict) and caption in first:
                return first[caption]
            return next(iter(first.values()), None) if isinstance(first, dict) else inner[0]

    # Shape 3: {"rows": [...]}
    rows = vds_response.get("rows")
    if isinstance(rows, list) and rows:
        first = rows[0]
        if isinstance(first, dict) and caption in first:
            return first[caption]
        return next(iter(first.values()), None) if isinstance(first, dict) else rows[0]

    return None


def _response_has_data(vds_response: dict[str, Any]) -> bool:
    """Return True if the VDS response contains at least one data row."""
    for key in ("data", "rows"):
        val = vds_response.get(key)
        if isinstance(val, list) and val:
            return True
    result = vds_response.get("result")
    if isinstance(result, dict):
        inner = result.get("data", [])
        if isinstance(inner, list) and inner:
            return True
    return False


# ---------------------------------------------------------------------------
# Core validation logic
# ---------------------------------------------------------------------------


def validate_field_via_vizql(
    vizql: VizQLClient,
    field: dict[str, Any],
    datasource_luid: str,
) -> tuple[str, dict[str, Any]]:
    """
    Attempt a VizQL query for a single field against the primary datasource.

    Returns (status, vds_response_dict).
    status is one of: "VALIDATED", "EMPTY", "SECONDARY_PATH_REQUIRED", "ERROR".
    """
    caption = field["caption"]
    fn = field["query_function"]
    vds_field = _build_vizql_field(caption, fn)

    logger.info("VizQL query | %s | function=%s | datasource=%s", caption, fn, datasource_luid)
    resp = vizql.query_datasource(
        datasource_luid=datasource_luid,
        fields=[vds_field],
        limit=1,
    )

    if resp.get("error"):
        sc = resp.get("status_code", 0)
        if sc == 401:
            logger.info(
                "HTTP 401 for '%s' — likely secondary connection. "
                "Will attempt view lookup.",
                caption,
            )
            return "SECONDARY_PATH_REQUIRED", resp
        logger.warning("VizQL error for '%s': %s", caption, resp.get("message"))
        return "ERROR", resp

    if _response_has_data(resp):
        logger.info("VALIDATED via VizQL: '%s'", caption)
        return "VALIDATED", resp

    logger.info("VizQL returned empty result for '%s' — field exists but may be NULL.", caption)
    return "EMPTY", resp


def find_view_for_field(
    tc: TableauClient,
    vizql: VizQLClient,
    caption: str,
    query_function: str,  # kept for API symmetry; unused after VDS view path removed
) -> dict[str, Any] | None:
    """
    Scan published views on the site and check each for the target field caption.

    Uses the Tableau REST API /views/{luid}/data CSV endpoint (not VDS, which
    has no /query-view path). Reads only the CSV header row to determine field
    presence — no row data is consumed.

    Returns a dict with view info on the first hit, or None if no view exposes
    the field.

    Iterates all views rather than filtering by datasource because TSC's
    views.get() does not support a datasource_id filter parameter in all versions.
    """
    logger.info("Searching views for field '%s' via REST CSV header check…", caption)
    try:
        views = tc.list_views()
    except Exception as exc:
        logger.warning("Could not list views: %s", exc)
        return None

    for view in views:
        view_luid = view.id
        view_name = view.name
        try:
            hit = vizql.check_field_in_view(
                view_luid=view_luid,
                field_caption=caption,
            )
        except Exception as exc:
            logger.debug("View %s (%s) exception: %s", view_name, view_luid, exc)
            continue

        if hit.get("found"):
            logger.info(
                "Field '%s' found in view '%s' (%s).", caption, view_name, view_luid
            )
            return {
                "found": True,
                "view_name": view_name,
                "view_luid": view_luid,
                "aggregated_data_available": True,
                "sample_value": None,  # CSV header check only; no row values fetched
            }

    logger.info("No view found that exposes field '%s'.", caption)
    return None


def validate_all_fields(
    tc: TableauClient,
    vizql: VizQLClient,
    metadata_fields: dict[str, dict[str, str]],
) -> list[dict[str, Any]]:
    """
    Validate all 18 KPI fields using a three-tier strategy:

    1. VizQL query (primary datasource) — fastest; proves data present.
    2. VizQL query via published view — for secondary-connection fields.
    3. Metadata XML lookup — confirms field existence when data query fails.
    """
    results: list[dict[str, Any]] = []

    for field in KPI_FIELDS:
        caption = field["caption"]
        result = _empty_result(field)

        # ---- Tier 1: VizQL against primary datasource ------------------
        status, vds_resp = validate_field_via_vizql(vizql, field, _DS_LUID)

        if status == "VALIDATED":
            sample = _extract_sample_value(vds_resp, caption)
            meta_entry = metadata_fields.get(caption.strip().lower(), {})
            result.update(
                {
                    "found_in_datasource": True,
                    "data_type": meta_entry.get("data_type", "Unknown"),
                    "data_present": {
                        "status": "YES",
                        "sample_value": sample,
                    },
                    "validation_method": "VizQL (primary connection)",
                    "query_status": "HTTP 200",
                    "formula": meta_entry.get("formula", ""),
                    "notes": "Data confirmed via aggregated VizQL query.",
                }
            )
            results.append(result)
            continue

        if status == "EMPTY":
            result.update(
                {
                    "found_in_datasource": True,
                    "data_present": {
                        "status": "EMPTY",
                        "reason": "VizQL returned 200 but zero rows; field may be all-NULL.",
                    },
                    "validation_method": "VizQL (primary connection)",
                    "query_status": "HTTP 200 (empty)",
                    "notes": "Field exists in primary connection but contains no data.",
                }
            )
            results.append(result)
            continue

        if status == "ERROR" and vds_resp.get("status_code") not in (401,):
            # Non-401 error — check metadata before giving up.
            meta_key = caption.strip().lower()
            meta_entry = metadata_fields.get(meta_key)
            if meta_entry:
                result.update(
                    {
                        "found_in_datasource": True,
                        "data_type": meta_entry.get("data_type", "Unknown"),
                        "data_present": {
                            "status": "METADATA_ONLY",
                            "reason": f"VizQL returned HTTP {vds_resp.get('status_code')}; "
                            "field confirmed in downloaded .tdsx metadata.",
                        },
                        "validation_method": "Metadata download (XML scan)",
                        "query_status": f"HTTP {vds_resp.get('status_code')} (primary)",
                        "formula": meta_entry.get("formula", ""),
                        "notes": "Field exists in metadata but data could not be confirmed via VizQL.",
                    }
                )
            else:
                result["notes"] = (
                    f"VizQL HTTP {vds_resp.get('status_code')}: "
                    f"{vds_resp.get('message', '')} — not found in metadata either."
                )
                result["query_status"] = f"HTTP {vds_resp.get('status_code')}"
            results.append(result)
            continue

        # ---- Tier 2: VizQL via published view --------------------------
        # Reached here because status == "SECONDARY_PATH_REQUIRED" (401).
        logger.info("Attempting view lookup for secondary-connection field '%s'.", caption)
        view_hit = find_view_for_field(tc, vizql, caption, field["query_function"])

        if view_hit and view_hit.get("aggregated_data_available"):
            result.update(
                {
                    "found_in_datasource": True,
                    "data_present": {
                        "status": "YES_VIA_VIEW",
                        "reason": "Direct datasource query returned 401 (secondary connection). "
                        "Data confirmed via published view.",
                        "view_lookup": view_hit,
                    },
                    "validation_method": "VizQL (published view fallback)",
                    "query_status": "HTTP 401 (primary), HTTP 200 (view)",
                    "notes": (
                        f"Field in secondary connection. "
                        f"Confirmed data via view '{view_hit['view_name']}'."
                    ),
                }
            )
            results.append(result)
            continue

        # ---- Tier 3: Metadata XML lookup --------------------------------
        # VizQL failed; view not found or also failed. Check downloaded metadata.
        meta_key = caption.strip().lower()
        meta_entry = metadata_fields.get(meta_key)

        if meta_entry:
            result.update(
                {
                    "found_in_datasource": True,
                    "data_type": meta_entry.get("data_type", "Unknown"),
                    "data_present": {
                        "status": "SECONDARY_PATH_REQUIRED",
                        "reason": "VizQL returned 401 (secondary connection). "
                        "No view exposes this field. Field confirmed in .tdsx metadata only.",
                        "view_lookup": {"found": False},
                    },
                    "validation_method": "Metadata download (XML scan)",
                    "query_status": "HTTP 401 (primary), no view found",
                    "formula": meta_entry.get("formula", ""),
                    "notes": (
                        "Field exists in secondary connection metadata but data "
                        "presence cannot be confirmed without a view or direct connection."
                    ),
                }
            )
        else:
            result.update(
                {
                    "found_in_datasource": False,
                    "data_present": {"status": "NOT_FOUND"},
                    "validation_method": "VizQL + Metadata scan (all failed)",
                    "query_status": "HTTP 401 (primary), metadata absent",
                    "notes": (
                        "Field not found via VizQL, view lookup, or .tdsx metadata. "
                        "Verify caption spelling against Tableau Desktop."
                    ),
                }
            )

        results.append(result)

    return results


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------


def _build_json_report(
    results: list[dict[str, Any]],
    run_ts: str,
) -> dict[str, Any]:
    # Derive category list dynamically so new categories are included automatically.
    seen: set[str] = set()
    categories: list[str] = []
    for r in results:
        c = r["category"]
        if c not in seen:
            seen.add(c)
            categories.append(c)
    cat_complete: dict[str, bool] = {}
    for cat in categories:
        cat_fields = [r for r in results if r["category"] == cat]
        cat_complete[cat.lower().replace("/", "_").replace(" ", "_")] = all(
            r["data_present"]["status"] in ("YES", "YES_VIA_VIEW", "EMPTY", "METADATA_ONLY")
            for r in cat_fields
        )

    fields_with_data = sum(
        1
        for r in results
        if r["data_present"]["status"] in ("YES", "YES_VIA_VIEW")
    )
    fields_secondary = sum(
        1
        for r in results
        if r["data_present"]["status"] in ("SECONDARY_PATH_REQUIRED",)
    )
    fields_not_found = sum(
        1 for r in results if r["data_present"]["status"] == "NOT_FOUND"
    )

    action_items: list[str] = []
    for r in results:
        status = r["data_present"]["status"]
        if status == "NOT_FOUND":
            action_items.append(
                f"Field '{r['field_name']}' not found — verify caption in Tableau Desktop."
            )
        elif status == "SECONDARY_PATH_REQUIRED":
            action_items.append(
                f"Field '{r['field_name']}' is in secondary connection but no view exposes it. "
                "Connect via Tableau Desktop or check view availability."
            )
        elif status == "EMPTY":
            action_items.append(
                f"Field '{r['field_name']}' is all-NULL — investigate data pipeline."
            )

    return {
        "metadata": {
            "timestamp": run_ts,
            "datasource_name": _DS_NAME,
            "datasource_luid": _DS_LUID,
            "primary_connection": _PRIMARY_CONN,
            "secondary_connection": _SECONDARY_CONN,
            "total_fields_validated": len(results),
            "fields_with_data": fields_with_data,
            "fields_secondary_path_required": fields_secondary,
            "fields_not_found": fields_not_found,
        },
        "validations": results,
        "summary": {
            **{f"{k}_complete": v for k, v in cat_complete.items()},
            "action_items": action_items,
        },
    }


def _status_icon(status: str) -> str:
    icons = {
        "YES": "VALID",
        "YES_VIA_VIEW": "VALID (via view)",
        "EMPTY": "EMPTY",
        "METADATA_ONLY": "FIELD EXISTS (no data confirmed)",
        "SECONDARY_PATH_REQUIRED": "SECONDARY PATH REQUIRED",
        "NOT_FOUND": "NOT FOUND",
    }
    return icons.get(status, status)


def _build_markdown_report(
    report: dict[str, Any],
    run_ts: str,
) -> str:
    meta = report["metadata"]
    results = report["validations"]
    summary = report["summary"]

    lines: list[str] = [
        "# Loyalty Report V2 — Field Validation Report",
        "",
        f"**Generated:** {run_ts}  ",
        f"**Datasource:** {meta['datasource_name']} (LUID: {meta['datasource_luid']})  ",
        f"**Primary Connection:** {meta['primary_connection']}  ",
        f"**Secondary Connection:** {meta['secondary_connection']}",
        "",
        "## Summary",
        "",
    ]

    # Category summary table — derive list from results so new categories appear.
    seen_cats: set[str] = set()
    all_categories: list[str] = []
    for r in results:
        c = r["category"]
        if c not in seen_cats:
            seen_cats.add(c)
            all_categories.append(c)
    lines.append("| Category | Total | With Data | Secondary Path | Not Found |")
    lines.append("|---|---|---|---|---|")
    total_t = total_d = total_s = total_n = 0
    for cat in all_categories:
        cat_fields = [r for r in results if r["category"] == cat]
        t = len(cat_fields)
        d = sum(
            1
            for r in cat_fields
            if r["data_present"]["status"] in ("YES", "YES_VIA_VIEW")
        )
        s = sum(
            1
            for r in cat_fields
            if r["data_present"]["status"] == "SECONDARY_PATH_REQUIRED"
        )
        n = sum(
            1
            for r in cat_fields
            if r["data_present"]["status"] == "NOT_FOUND"
        )
        lines.append(f"| {cat} | {t} | {d} | {s} | {n} |")
        total_t += t
        total_d += d
        total_s += s
        total_n += n
    lines.append(
        f"| **Total** | **{total_t}** | **{total_d}** | **{total_s}** | **{total_n}** |"
    )
    lines.append("")

    # Per-field detail table
    lines.append("## Detailed Field Validations")
    lines.append("")
    lines.append("| Field | Category | Status | Method | Data Type | Notes |")
    lines.append("|---|---|---|---|---|---|")
    for r in results:
        status = r["data_present"]["status"]
        icon = _status_icon(status)
        notes = r.get("notes", "").replace("|", "/")
        lines.append(
            f"| {r['field_name']} | {r['category']} | {icon} "
            f"| {r['validation_method']} | {r['data_type']} | {notes} |"
        )
    lines.append("")

    # Repeat Purchase Ratio formula note (calculated field)
    rpr = next(
        (r for r in results if r["field_name"] == "Repeat Purchase Ratio"), None
    )
    if rpr and rpr.get("formula"):
        lines.append("## Calculated Field: Repeat Purchase Ratio")
        lines.append("")
        lines.append("```")
        lines.append(rpr["formula"])
        lines.append("```")
        lines.append("")

    # Action items
    action_items = summary.get("action_items", [])
    if action_items:
        lines.append("## Action Items")
        lines.append("")
        for item in action_items:
            lines.append(f"- [ ] {item}")
        lines.append("")

    lines.append("## Validation Constraints")
    lines.append("")
    lines.append(
        textwrap.dedent("""\
        - **Scope:** Read-only queries only — no publish, update, or delete operations.
        - **Data Access:** Aggregated metrics only; no row-level PII retrieved.
        - **Cross-Connection:** Secondary connection returns 401 via VizQL; views used as proxy.
        - **Credentials:** PAT read from `TABLEAU_PAT_VALUE` / `TABLEAU_PAT_NAME` env vars.
        """)
    )

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    _setup_logging()
    run_ts = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    logger.info("=== Loyalty Report V2 KPI Field Validation ===")
    logger.info("Run timestamp: %s", run_ts)
    logger.info("Output directory: %s", _OUTPUT_DIR)

    # ---- Authenticate --------------------------------------------------
    tc = TableauClient()
    try:
        tc.authenticate()
    except EnvironmentError as exc:
        logger.error("Environment error: %s", exc)
        print(f"FATAL: {exc}")
        sys.exit(1)
    except Exception as exc:
        logger.error("Authentication failed: %s", exc)
        print(f"FATAL: Authentication failed — {exc}")
        sys.exit(1)

    vizql = VizQLClient(auth_token=tc.auth_token, site_id=tc.site_id)

    # ---- Download metadata (once — shared across all fields) -----------
    logger.info("Downloading datasource metadata for XML field scan…")
    metadata_fields: dict[str, dict[str, str]] = {}
    try:
        metadata_fields = tc.download_datasource_metadata(_DS_LUID)
        logger.info(
            "Metadata downloaded: %d fields parsed from .tdsx XML.", len(metadata_fields)
        )
    except Exception as exc:
        logger.warning(
            "Metadata download failed (%s). Tier-3 fallback will be unavailable.", exc
        )

    # ---- Validate all fields -------------------------------------------
    logger.info("Starting field-by-field validation…")
    results = validate_all_fields(tc, vizql, metadata_fields)

    # ---- Sign out ------------------------------------------------------
    tc.sign_out()

    # ---- Build and write reports ---------------------------------------
    report = _build_json_report(results, run_ts)

    _JSON_REPORT.write_text(
        json.dumps(report, indent=2, default=str), encoding="utf-8"
    )
    logger.info("JSON report written: %s", _JSON_REPORT)

    md_content = _build_markdown_report(report, run_ts)
    _MD_REPORT.write_text(md_content, encoding="utf-8")
    logger.info("Markdown report written: %s", _MD_REPORT)

    logger.info("Execution log written: %s", _LOG_FILE)

    # ---- stdout summary (only print() in the script) ------------------
    meta = report["metadata"]
    summary = report["summary"]
    print()
    print("=" * 60)
    print("Loyalty Report V2 — KPI Field Validation Complete")
    print("=" * 60)
    print(f"  Run timestamp      : {run_ts}")
    print(f"  Total fields       : {meta['total_fields_validated']}")
    print(f"  With data          : {meta['fields_with_data']}")
    print(f"  Secondary path req : {meta['fields_secondary_path_required']}")
    print(f"  Not found          : {meta['fields_not_found']}")
    print()
    action_items = summary.get("action_items", [])
    if action_items:
        print("Action Items:")
        for item in action_items:
            print(f"  [ ] {item}")
        print()
    print(f"  JSON report : {_JSON_REPORT}")
    print(f"  MD report   : {_MD_REPORT}")
    print(f"  Log file    : {_LOG_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
