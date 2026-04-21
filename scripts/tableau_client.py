"""
Read-only TSC wrapper for Tableau Cloud.

All write-path methods raise PermissionError immediately so callers cannot
accidentally trigger a publish, update, or delete even if they import this
module and call the wrong name.
"""

from __future__ import annotations

import logging
import os
import shutil
import tempfile
import time
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "local-project-work" / ".env")

logger = logging.getLogger(__name__)

try:
    import tableauserverclient as TSC
except ImportError:
    raise ImportError(
        "tableauserverclient is not installed. "
        "Run: pip install 'tableauserverclient>=0.25'"
    )

_TABLEAU_SERVER = "https://prod-apsoutheast-b.online.tableau.com"
_SITE_ID = "ample"

_FORBIDDEN_NAMES = frozenset(
    ["publish", "update", "delete", "create", "populate_connections"]
)


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise EnvironmentError(
            f"Required environment variable '{name}' is not set or is empty."
        )
    return value


class TableauClient:
    """
    Read-only wrapper around tableauserverclient.Server.

    Instantiate once, call authenticate(), then use the read methods.
    The server attribute is intentionally not exposed as a public attribute
    to discourage callers from bypassing the read-only guard.
    """

    def __init__(
        self,
        server_url: str = _TABLEAU_SERVER,
        site_id: str = _SITE_ID,
    ) -> None:
        self._server_url = server_url
        self._site_id = site_id
        self._server: TSC.Server | None = None
        self._auth_token: str | None = None

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    def authenticate(self) -> None:
        """
        Sign in using PAT credentials from environment variables.

        Stores the session auth_token for use by VizQL REST calls that need
        it as X-Tableau-Auth (TSC does not expose this via high-level methods).
        """
        pat_name = _require_env("TABLEAU_PAT_NAME")
        pat_token = _require_env("TABLEAU_PAT_VALUE")

        tableau_auth = TSC.PersonalAccessTokenAuth(
            token_name=pat_name,
            personal_access_token=pat_token,
            site_id=self._site_id,
        )
        server = TSC.Server(self._server_url, use_server_version=True)
        # Suppress the version-check request log to keep auth_token out of
        # debug output when httplib2 / requests debug logging is enabled.
        server.add_http_options({"verify": True})

        logger.info("Authenticating to %s (site: %s)", self._server_url, self._site_id)
        server.auth.sign_in(tableau_auth)
        self._server = server
        # auth_token is the session credential needed by raw REST / VizQL calls.
        self._auth_token = server.auth_token
        logger.info("Authentication successful.")

    def sign_out(self) -> None:
        if self._server is not None:
            try:
                self._server.auth.sign_out()
                logger.info("Signed out of Tableau Cloud.")
            except Exception as exc:
                logger.warning("Sign-out raised an exception: %s", exc)
            finally:
                self._server = None
                self._auth_token = None

    @property
    def auth_token(self) -> str:
        """
        Returns the live session token for use in raw REST / VizQL requests.
        """
        if not self._auth_token:
            raise RuntimeError("Not authenticated. Call authenticate() first.")
        return self._auth_token

    @property
    def site_id(self) -> str:
        """Tableau internal site LUID (resolved after sign-in)."""
        self._require_server()
        return self._server.site_id  # type: ignore[union-attr]

    # ------------------------------------------------------------------
    # Forbidden write operations — belt-and-suspenders guard
    # ------------------------------------------------------------------

    def __getattr__(self, name: str) -> Any:
        if name in _FORBIDDEN_NAMES:
            raise PermissionError(
                f"'{name}' is a write operation and is forbidden in this "
                "read-only client."
            )
        raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")

    # ------------------------------------------------------------------
    # Read methods
    # ------------------------------------------------------------------

    def get_datasource(self, datasource_luid: str) -> TSC.DatasourceItem:
        """Return a DatasourceItem for a single datasource by LUID."""
        self._require_server()
        logger.debug("Fetching datasource %s", datasource_luid)
        return self._retry(
            lambda: self._server.datasources.get_by_id(datasource_luid)  # type: ignore[union-attr]
        )

    def list_datasources(
        self, page_size: int = 100
    ) -> list[TSC.DatasourceItem]:
        """Return all datasources on the site (paginated internally)."""
        self._require_server()
        logger.debug("Listing all datasources (page_size=%d)", page_size)
        req_opts = TSC.RequestOptions(pagesize=page_size)
        all_items: list[TSC.DatasourceItem] = []
        for ds in TSC.Pager(self._server.datasources, request_opts=req_opts):  # type: ignore[union-attr]
            all_items.append(ds)
        logger.debug("Retrieved %d datasources.", len(all_items))
        return all_items

    def list_views(self, page_size: int = 100) -> list[TSC.ViewItem]:
        """Return all views on the site (paginated internally)."""
        self._require_server()
        logger.debug("Listing all views (page_size=%d)", page_size)
        req_opts = TSC.RequestOptions(pagesize=page_size)
        all_items: list[TSC.ViewItem] = []
        for view in TSC.Pager(self._server.views, request_opts=req_opts):  # type: ignore[union-attr]
            all_items.append(view)
        logger.debug("Retrieved %d views.", len(all_items))
        return all_items

    def get_view(self, view_luid: str) -> TSC.ViewItem:
        """Return a ViewItem for a single view by LUID."""
        self._require_server()
        logger.debug("Fetching view %s", view_luid)
        return self._retry(
            lambda: self._server.views.get_by_id(view_luid)  # type: ignore[union-attr]
        )

    def download_datasource_metadata(
        self, datasource_luid: str
    ) -> dict[str, dict[str, str]]:
        """
        Download the .tdsx (or .tds) for the datasource, parse all field
        definitions from the embedded XML, delete the temp file, and return
        a mapping of field_caption -> {data_type, role, formula}.

        The download is purely for schema inspection — it does not contain
        customer data rows.
        """
        self._require_server()
        tmp_dir = Path(tempfile.mkdtemp(prefix="tsc_meta_"))
        try:
            logger.info(
                "Downloading datasource metadata for LUID %s to %s",
                datasource_luid,
                tmp_dir,
            )
            download_path = self._retry(
                lambda: self._server.datasources.download(  # type: ignore[union-attr]
                    datasource_luid, filepath=str(tmp_dir)
                )
            )
            logger.info("Download complete: %s", download_path)
            return self._parse_datasource_file(Path(download_path))
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            logger.debug("Temporary metadata directory deleted: %s", tmp_dir)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _require_server(self) -> None:
        if self._server is None:
            raise RuntimeError("Not authenticated. Call authenticate() first.")

    def _parse_datasource_file(
        self, file_path: Path
    ) -> dict[str, dict[str, str]]:
        """
        Parse a .tdsx (zip) or .tds (plain XML) and return field metadata.

        Returns:
            A dict keyed by field caption (lowercase-stripped for fuzzy lookup)
            with sub-keys: caption, data_type, role, formula.
        """
        tds_xml: str | None = None

        if zipfile.is_zipfile(file_path):
            with zipfile.ZipFile(file_path, "r") as zf:
                tds_names = [n for n in zf.namelist() if n.endswith(".tds")]
                if not tds_names:
                    logger.warning(
                        ".tdsx archive contains no .tds file: %s", file_path
                    )
                    return {}
                # The primary .tds sits at the archive root.
                tds_names.sort(key=lambda n: n.count("/"))
                tds_xml = zf.read(tds_names[0]).decode("utf-8", errors="replace")
        else:
            tds_xml = file_path.read_text(encoding="utf-8", errors="replace")

        return self._extract_fields_from_tds(tds_xml)

    def _extract_fields_from_tds(self, tds_xml: str) -> dict[str, dict[str, str]]:
        """
        Walk the TDS XML and collect every <column> element that has a caption.

        Both direct <column> children of <datasource> and <column> elements
        inside <metadata-record> wrappers are captured, because the XML shape
        varies between datasource types.
        """
        try:
            root = ET.fromstring(tds_xml)
        except ET.ParseError as exc:
            logger.error("Failed to parse TDS XML: %s", exc)
            return {}

        fields: dict[str, dict[str, str]] = {}

        for col in root.iter("column"):
            caption = col.get("caption") or col.get("name", "")
            if not caption:
                continue
            data_type = col.get("datatype", "unknown")
            role = col.get("role", "unknown")
            formula_el = col.find("calculation")
            formula = formula_el.get("formula", "") if formula_el is not None else ""
            key = caption.strip().lower()
            fields[key] = {
                "caption": caption.strip(),
                "data_type": data_type,
                "role": role,
                "formula": formula,
            }

        # Some .tdsx variants embed field lists in <metadata-record class='column'>
        for record in root.iter("metadata-record"):
            if record.get("class") != "column":
                continue
            local_name_el = record.find("local-name")
            local_type_el = record.find("local-type")
            if local_name_el is None:
                continue
            caption = (local_name_el.text or "").strip()
            if not caption:
                continue
            key = caption.lower()
            if key not in fields:
                fields[key] = {
                    "caption": caption,
                    "data_type": (local_type_el.text or "unknown").strip()
                    if local_type_el is not None
                    else "unknown",
                    "role": "unknown",
                    "formula": "",
                }

        logger.info("Parsed %d fields from datasource XML.", len(fields))
        return fields

    def _retry(
        self,
        fn: Any,
        max_attempts: int = 3,
        base_delay: float = 60.0,
    ) -> Any:
        """
        Retry fn() on 429 / 503 with exponential backoff.

        Other TSC exceptions (401, 403, 404) are not transient and are
        re-raised immediately.
        """
        for attempt in range(1, max_attempts + 1):
            try:
                return fn()
            except TSC.exceptions.ServerResponseError as exc:
                code = getattr(exc, "code", "") or ""
                http_status = getattr(exc, "http_status", 0) or 0
                if http_status == 429 or http_status == 503:
                    if attempt == max_attempts:
                        raise
                    delay = base_delay * (2 ** (attempt - 1))
                    logger.warning(
                        "HTTP %s received (attempt %d/%d). Retrying in %.0fs.",
                        http_status,
                        attempt,
                        max_attempts,
                        delay,
                    )
                    time.sleep(delay)
                elif http_status == 401:
                    raise PermissionError(
                        "HTTP 401: PAT is invalid or expired. "
                        "Check TABLEAU_PAT_NAME and TABLEAU_PAT_VALUE."
                    ) from exc
                elif http_status == 403:
                    raise PermissionError(
                        f"HTTP 403: PAT lacks required scope. Detail: {exc}"
                    ) from exc
                else:
                    raise
