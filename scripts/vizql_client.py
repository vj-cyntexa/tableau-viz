"""
VizQL Data Service query client — read-only.

Sends POST requests to the Tableau Cloud VizQL Data Service endpoint.
Authentication uses the session token obtained from TSC sign-in
(X-Tableau-Auth header), NOT a raw PAT Bearer token — the VDS endpoint
rejects raw PATs and expects only the session token issued at sign-in.

For secondary-connection field validation, this client also supports a
GET against the Tableau REST API view-data endpoint
(/api/3.0/sites/{site_id}/views/{view_luid}/data), which returns a CSV
whose header row reveals which field captions that view exposes.
VDS does not have a /query-view path; views must go through the REST API.
"""

from __future__ import annotations

import csv
import io
import logging
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "local-project-work" / ".env")

logger = logging.getLogger(__name__)

try:
    import requests
except ImportError:
    raise ImportError(
        "requests is not installed. Run: pip install 'requests>=2.31'"
    )


_VDS_BASE = "https://prod-apsoutheast-b.online.tableau.com/api/v1/vizql-data-service"
_REST_BASE = "https://prod-apsoutheast-b.online.tableau.com/api/3.0"
_QUERY_DATASOURCE_PATH = "/query-datasource"


class VizQLClient:
    """
    Thin client for the Tableau VizQL Data Service plus REST view data.

    Requires a live session auth_token from TableauClient.auth_token —
    obtain one by calling TableauClient.authenticate() first.
    site_id is the Tableau internal site LUID (from TableauClient.site_id),
    used for REST API view-data URLs.
    """

    def __init__(self, auth_token: str, site_id: str) -> None:
        self._auth_token = auth_token
        self._site_id = site_id
        self._session = requests.Session()
        self._session.headers.update(
            {
                # VizQL Data Service requires X-Tableau-Auth with the TSC
                # session token, not a Bearer-formatted PAT.
                "X-Tableau-Auth": self._auth_token,
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    # ------------------------------------------------------------------
    # Public query methods
    # ------------------------------------------------------------------

    def query_datasource(
        self,
        datasource_luid: str,
        fields: list[dict[str, str]],
        filters: list[dict[str, Any]] | None = None,
        limit: int = 10,
    ) -> dict[str, Any]:
        """
        Query a published datasource via VizQL Data Service.

        Args:
            datasource_luid: The LUID of the published datasource.
            fields: List of field descriptors. Measures must include
                    {"fieldCaption": "...", "function": "SUM"}.
                    Dimensions use {"fieldCaption": "..."} only.
            filters: Optional list of VDS filter objects.
            limit: Maximum rows to return (kept small — we need only
                   existence proof, not a full dataset).

        Returns:
            Parsed JSON response from VDS, or a dict with an "error" key
            if the request failed.
        """
        url = _VDS_BASE + _QUERY_DATASOURCE_PATH
        # Tableau Cloud VizQL Data Service API 3.28 does not accept a "limit"
        # key anywhere in the request body — placing it inside "options" causes
        # a 400 "Unrecognized field in request: options->limit". The API's
        # default row limit (~10000) is sufficient for existence-check queries.
        body: dict[str, Any] = {
            "datasource": {"datasourceLuid": datasource_luid},
            "query": {
                "fields": fields,
                "filters": filters or [],
            },
        }
        return self._post_with_retry(url, body)

    def check_field_in_view(
        self,
        view_luid: str,
        field_caption: str,
    ) -> dict[str, Any]:
        """
        Use the Tableau REST API view-data endpoint to check whether a view
        exposes a specific field caption.

        Returns {"found": True, "view_luid": ..., "row_count": N} or
        {"found": False, "error": ..., "status_code": N}.

        The REST API returns CSV for the view's aggregated data. We read
        only the header row to determine field presence — no row data is
        consumed, keeping it safely aggregated-only.
        """
        # /api/3.0/sites/<site_id>/views/<view_luid>/data returns CSV with
        # one row per mark. We fetch only a small page via maxRows parameter.
        url = (
            f"{_REST_BASE}/sites/{self._site_id}"
            f"/views/{view_luid}/data?maxRows=1"
        )
        headers = {
            "X-Tableau-Auth": self._auth_token,
            "Accept": "text/csv",
        }
        try:
            resp = self._session.get(url, headers=headers, timeout=30)
        except requests.exceptions.RequestException as exc:
            logger.debug("View data GET failed for %s: %s", view_luid, exc)
            return {"found": False, "error": str(exc), "status_code": 0}

        if resp.status_code == 200:
            # Read just the header line; the body may be large.
            header_line = resp.text.split("\n", 1)[0]
            try:
                reader = csv.reader(io.StringIO(header_line))
                csv_headers = [h.strip() for h in next(reader, [])]
            except Exception:
                csv_headers = []

            if field_caption in csv_headers:
                logger.info(
                    "Field '%s' confirmed in view %s (CSV header match).",
                    field_caption,
                    view_luid,
                )
                return {
                    "found": True,
                    "view_luid": view_luid,
                    "row_count": 1,
                }
            logger.debug(
                "View %s does not expose '%s' (headers: %s).",
                view_luid,
                field_caption,
                csv_headers[:10],
            )
            return {"found": False, "status_code": 200, "error": "field not in headers"}

        if resp.status_code in (401, 403):
            logger.debug(
                "HTTP %d on view %s — view not accessible or not tied to target datasource.",
                resp.status_code,
                view_luid,
            )
        else:
            logger.debug("HTTP %d on view data for %s.", resp.status_code, view_luid)

        return {"found": False, "status_code": resp.status_code, "error": resp.text[:200]}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _post_with_retry(
        self,
        url: str,
        body: dict[str, Any],
        max_attempts: int = 3,
        base_delay: float = 60.0,
    ) -> dict[str, Any]:
        """
        POST with exponential backoff on 429 / 503.

        Returns the parsed JSON on 2xx.
        Returns {"error": True, "status_code": N, "message": "..."} on
        non-retryable errors so callers can branch without catching exceptions.
        """
        for attempt in range(1, max_attempts + 1):
            try:
                resp = self._session.post(url, json=body, timeout=30)
            except requests.exceptions.Timeout:
                logger.warning(
                    "Request to %s timed out (attempt %d/%d).", url, attempt, max_attempts
                )
                if attempt == max_attempts:
                    return {"error": True, "status_code": 0, "message": "Timeout"}
                time.sleep(30.0)
                continue
            except requests.exceptions.RequestException as exc:
                logger.error("Request exception: %s", exc)
                return {"error": True, "status_code": 0, "message": str(exc)}

            if resp.status_code == 200:
                return resp.json()

            if resp.status_code in (429, 503):
                if attempt == max_attempts:
                    return {
                        "error": True,
                        "status_code": resp.status_code,
                        "message": f"Rate-limited / unavailable after {max_attempts} attempts.",
                    }
                delay = base_delay * (2 ** (attempt - 1))
                logger.warning(
                    "HTTP %d from VDS (attempt %d/%d). Retrying in %.0fs.",
                    resp.status_code,
                    attempt,
                    max_attempts,
                    delay,
                )
                time.sleep(delay)
                continue

            if resp.status_code == 401:
                logger.info(
                    "HTTP 401 from VDS for %s — field may be in secondary "
                    "connection or session has expired.",
                    url,
                )
                return {
                    "error": True,
                    "status_code": 401,
                    "message": (
                        "401 Unauthorized: field may be in secondary connection "
                        "or session expired. Try view lookup or metadata download."
                    ),
                }

            # All other non-2xx are permanent failures for this request.
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text[:500]
            logger.warning(
                "VDS returned HTTP %d for %s: %s", resp.status_code, url, detail
            )
            return {
                "error": True,
                "status_code": resp.status_code,
                "message": str(detail),
            }

        return {"error": True, "status_code": 0, "message": "Exhausted retries."}
