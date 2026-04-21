#!/usr/bin/env python3
"""
Build script for Dashboard #1: Voucher Intelligence
Constructs Loyalty-D1-Voucher-Intelligence.twbx from Loyalty-Clean.twbx

Strategy:
- T0: Unzip Clean, verify ZIP integrity
- T1: Add new calc fields for voucher KPIs to V2 datasource
- T2: Copy Sankey worksheet from Loyalty-Sankey-v2 (remapped to voucher calcs)
- T3: Add KPI tile worksheets (V1, V2 KPI, V4 KPI)
- T4: Add bar/combo worksheets (V2 bar by definition, V5 bar, V6 dual-axis)
- T5: Add dashboard XML with 1440x900 fixed layout
- Repackage as TWBX

Run: python3 scripts/build_d1_voucher_intelligence.py [--tier N]
"""

import zipfile
import shutil
import os
import re
import sys
import uuid
import argparse
from pathlib import Path
from lxml import etree

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE = Path("/Users/vj/Office/Projects/vj-random-research-and-task/tableau-viz")
SOURCE_TWBX = BASE / "local-project-work/Loyalty-Clean.twbx"
REFERENCE_TWBX = BASE / "local-project-work/Loyalty-Sankey-v2.twbx"
OUTPUT_TWBX = BASE / "local-project-work/Loyalty-D1-Voucher-Intelligence.twbx"
WORK_DIR = Path("/tmp/twbx_d1_build")
CLEAN_DIR = WORK_DIR / "clean"
REF_DIR = Path("/tmp/twbx_work/Loyalty-Sankey-v2")

DS_NAME = "sqlproxy.0iu1zjg1usn1w618583nd1p2lua3"
DS_CAPTION = "Loyalty Report V2)"


# ── T0: Unzip & baseline ───────────────────────────────────────────────────────
def t0_unzip():
    print("[T0] Unzipping Clean workbook...")
    if WORK_DIR.exists():
        shutil.rmtree(WORK_DIR)
    WORK_DIR.mkdir(parents=True)
    CLEAN_DIR.mkdir(parents=True)
    with zipfile.ZipFile(SOURCE_TWBX, 'r') as zf:
        # Find the .twb file
        names = zf.namelist()
        twb_name = next(n for n in names if n.endswith('.twb'))
        zf.extractall(CLEAN_DIR)
    twb_files = list(CLEAN_DIR.rglob("*.twb"))
    assert twb_files, "No .twb file found in TWBX"
    print(f"  TWB file: {twb_files[0]}")
    return twb_files[0]


# ── XML helpers ────────────────────────────────────────────────────────────────
NSMAP = {"ns0": "http://www.tableausoftware.com/xml/user"}

def parse_twb(path):
    parser = etree.XMLParser(remove_blank_text=False, recover=True)
    with open(path, 'rb') as f:
        content = f.read()
    tree = etree.fromstring(content, parser)
    return tree

def serialize_twb(tree, path):
    xml_bytes = etree.tostring(tree, pretty_print=False, xml_declaration=True, encoding='utf-8')
    with open(path, 'wb') as f:
        f.write(xml_bytes)
    print(f"  Written {path} ({os.path.getsize(path):,} bytes)")


def make_column_instance(column_ref, derivation, name, pivot="key", col_type="nominal"):
    """Build a <column-instance> element."""
    ci = etree.Element("column-instance")
    ci.set("column", column_ref)
    ci.set("derivation", derivation)
    ci.set("name", name)
    ci.set("pivot", pivot)
    ci.set("type", col_type)
    return ci


def make_calc_column(name, caption, datatype, role, col_type, formula):
    """Build a <column> element with nested <calculation>."""
    col = etree.Element("column")
    col.set("caption", caption)
    col.set("datatype", datatype)
    col.set("name", name)
    col.set("role", role)
    col.set("type", col_type)
    calc = etree.SubElement(col, "calculation")
    calc.set("class", "tableau")
    calc.set("formula", formula)
    return col


def make_field_column(name, caption, datatype, aggregation, role="dimension", col_type="nominal", user_datatype=None):
    """Build a reference <column> element (non-calc)."""
    col = etree.Element("column")
    col.set("aggregation", aggregation)
    col.set("caption", caption)
    col.set("datatype", datatype)
    col.set("default-type", "quantitative" if col_type == "quantitative" else "nominal")
    col.set("layered", "true")
    col.set("name", name)
    col.set("pivot", "key")
    col.set("role", role)
    col.set("type", col_type)
    col.set("user-datatype", user_datatype or datatype)
    col.set("visual-totals", "Default")
    return col


# ── T1: Add calc fields to V2 datasource ──────────────────────────────────────
def t1_add_calcs(tree):
    print("[T1] Adding calc fields to V2 datasource...")

    # Find V2 datasource
    v2_ds = None
    for ds in tree.iter("datasource"):
        if ds.get("name") == DS_NAME:
            v2_ds = ds
            break
    assert v2_ds is not None, f"V2 datasource '{DS_NAME}' not found"

    # Find where to insert new columns (after existing columns, before end)
    # We'll append to the datasource element
    existing_names = {col.get("name") for col in v2_ds.iter("column")}
    print(f"  Found {len(existing_names)} existing columns")

    def add_if_new(col):
        name = col.get("name")
        if name not in existing_names:
            v2_ds.append(col)
            existing_names.add(name)
            print(f"    + Added: {name} ({col.get('caption', '')})")
        else:
            print(f"    ~ Skipped (exists): {name}")

    # ── Voucher Status field reference ──
    add_if_new(make_field_column(
        "[ssot__VoucherStatusId__c]", "Voucher Status",
        "string", "Count", "dimension", "nominal"
    ))

    # ── Face Value Amount reference ──
    add_if_new(make_field_column(
        "[ssot__FaceValueAmount__c]", "Face Value Amount",
        "real", "Sum", "measure", "quantitative", "real"
    ))

    # ── Voucher Id reference ──
    add_if_new(make_field_column(
        "[ssot__Id__c (Voucher)]", "Voucher Id",
        "string", "Count", "dimension", "nominal"
    ))

    # ── Voucher Definition Name reference ──
    add_if_new(make_field_column(
        "[ssot__Name__c (Voucher Definition)]", "Name (Voucher Definition)",
        "string", "Count", "dimension", "nominal"
    ))

    # ── Redeemed Value reference ──
    add_if_new(make_field_column(
        "[ssot__RedeemedValueAmount__c]", "Redeemed Value",
        "real", "Sum", "measure", "quantitative", "real"
    ))

    # ── Redemption Transaction Amount reference ──
    add_if_new(make_field_column(
        "[Redemption_Transaction_Amount__c]", "Redemption Transaction Amount",
        "real", "Sum", "measure", "quantitative", "real"
    ))

    # ── Cost Per Voucher reference ──
    add_if_new(make_field_column(
        "[Cost_Per_Voucher__c]", "Cost Per Voucher",
        "real", "Sum", "measure", "quantitative", "real"
    ))

    # ── Expiration Date reference ──
    add_if_new(make_field_column(
        "[ssot__ExpirationDate__c]", "Expiration Date",
        "date", "Year", "dimension", "ordinal", "date"
    ))

    # ── Journal Date reference ──
    add_if_new(make_field_column(
        "[ssot__JournalDate__c]", "Journal Date",
        "date", "Year", "dimension", "ordinal", "date"
    ))

    # ── Voucher Type reference ──
    add_if_new(make_field_column(
        "[Voucher_Type__c]", "Voucher Type",
        "string", "Count", "dimension", "nominal"
    ))

    # ── Loyalty Program Name reference ──
    add_if_new(make_field_column(
        "[ssot__Name__c (Loyalty Program)]", "Name (Loyalty Program)",
        "string", "Count", "dimension", "nominal"
    ))

    # ── Calc: Voucher Sankey Source (always "Issued") ──
    add_if_new(make_calc_column(
        "[Calculation_voucher_sankey_source]",
        "Voucher Flow Source",
        "string", "dimension", "nominal",
        '"Issued"'
    ))

    # ── Calc: Voucher Sankey Target (= Voucher Status) ──
    add_if_new(make_calc_column(
        "[Calculation_voucher_sankey_target]",
        "Voucher Flow Target",
        "string", "dimension", "nominal",
        "[ssot__VoucherStatusId__c]"
    ))

    # ── Calc: Voucher Sankey Value (Face Value Amount) ──
    # This is a passthrough for the SUM aggregation at worksheet level
    add_if_new(make_calc_column(
        "[Calculation_voucher_sankey_value]",
        "Voucher Flow Value",
        "real", "measure", "quantitative",
        "[ssot__FaceValueAmount__c]"
    ))

    # ── KPI: V1 Voucher Leakage Rate % ──
    add_if_new(make_calc_column(
        "[Calc_V1_Voucher_Leakage_Rate]",
        "Voucher Leakage Rate %",
        "real", "measure", "quantitative",
        "SUM(IF [ssot__VoucherStatusId__c] = 'Expired' THEN [ssot__FaceValueAmount__c] END) / "
        "NULLIF(SUM([ssot__FaceValueAmount__c]), 0) * 100"
    ))

    # ── KPI: V1 Leakage Amount ──
    add_if_new(make_calc_column(
        "[Calc_V1_Leakage_Amount]",
        "Leakage Amount",
        "real", "measure", "quantitative",
        "SUM(IF [ssot__VoucherStatusId__c] = 'Expired' THEN [ssot__FaceValueAmount__c] END)"
    ))

    # ── KPI: V2 Voucher Redemption Rate % ──
    add_if_new(make_calc_column(
        "[Calc_V2_Redemption_Rate]",
        "Voucher Redemption Rate %",
        "real", "measure", "quantitative",
        "COUNTD(IF [ssot__VoucherStatusId__c] = 'Redeemed' THEN [ssot__Id__c (Voucher)] END) / "
        "NULLIF(COUNTD([ssot__Id__c (Voucher)]), 0) * 100"
    ))

    # ── KPI: V4 Face Value Utilization % ──
    add_if_new(make_calc_column(
        "[Calc_V4_Face_Value_Utilization]",
        "Face Value Utilization %",
        "real", "measure", "quantitative",
        "SUM([ssot__RedeemedValueAmount__c]) / NULLIF(SUM([ssot__FaceValueAmount__c]), 0) * 100"
    ))

    # ── KPI: V5 Voucher ROI ──
    add_if_new(make_calc_column(
        "[Calc_V5_Voucher_ROI]",
        "Voucher ROI",
        "real", "measure", "quantitative",
        "(SUM([Redemption_Transaction_Amount__c]) - SUM([ssot__FaceValueAmount__c])) / "
        "NULLIF(SUM([Cost_Per_Voucher__c]), 0)"
    ))

    # ── Display: % format string ──
    add_if_new(make_calc_column(
        "[Calc_Pct_Display]",
        "Pct Display",
        "string", "dimension", "nominal",
        'STR(ROUND(SUM([ssot__RedeemedValueAmount__c]) / NULLIF(SUM([ssot__FaceValueAmount__c]),0)*100,1)) + "%"'
    ))

    # ── Display: V1 leakage formatted ──
    add_if_new(make_calc_column(
        "[Calc_V1_Leakage_Fmt]",
        "Leakage Rate Display",
        "string", "dimension", "nominal",
        'STR(ROUND(SUM(IF [ssot__VoucherStatusId__c] = \'Expired\' THEN [ssot__FaceValueAmount__c] END) '
        '/ NULLIF(SUM([ssot__FaceValueAmount__c]),0)*100,1)) + "%"'
    ))

    # ── Display: V2 redemption rate formatted ──
    add_if_new(make_calc_column(
        "[Calc_V2_Redemption_Fmt]",
        "Redemption Rate Display",
        "string", "dimension", "nominal",
        'STR(ROUND(COUNTD(IF [ssot__VoucherStatusId__c] = \'Redeemed\' THEN [ssot__Id__c (Voucher)] END) '
        '/ NULLIF(COUNTD([ssot__Id__c (Voucher)]),0)*100,1)) + "%"'
    ))

    # ── Display: V4 utilization formatted ──
    add_if_new(make_calc_column(
        "[Calc_V4_Utilization_Fmt]",
        "Utilization Display",
        "string", "dimension", "nominal",
        'STR(ROUND(SUM([ssot__RedeemedValueAmount__c]) / NULLIF(SUM([ssot__FaceValueAmount__c]),0)*100,1)) + "%"'
    ))

    # ── V6: Expiry trend calcs ──
    add_if_new(make_calc_column(
        "[Calc_V6_Expired_Value]",
        "Expired Face Value",
        "real", "measure", "quantitative",
        "SUM(IF [ssot__VoucherStatusId__c] = 'Expired' THEN [ssot__FaceValueAmount__c] END)"
    ))

    add_if_new(make_calc_column(
        "[Calc_V6_Issued_Value]",
        "Issued Face Value",
        "real", "measure", "quantitative",
        "SUM([ssot__FaceValueAmount__c])"
    ))

    # ── Program filter calc (for worksheets) ──
    add_if_new(make_calc_column(
        "[Calc_Program_Filter]",
        "Program Filter",
        "boolean", "dimension", "nominal",
        "[ssot__Name__c (Loyalty Program)] = [Parameters].[Parameter 3]"
    ))

    print("  T1 done.")
    return tree


# ── Worksheet XML builder helpers ──────────────────────────────────────────────

def make_datasource_ref(ds_name, ds_caption=None):
    ds = etree.Element("datasource")
    ds.set("name", ds_name)
    if ds_caption:
        ds.set("caption", ds_caption)
    return ds


def make_dep_column_instance(col_ref, derivation, ci_name, pivot="key", col_type="nominal"):
    ci = etree.Element("column-instance")
    ci.set("column", col_ref)
    ci.set("derivation", derivation)
    ci.set("name", ci_name)
    ci.set("pivot", pivot)
    ci.set("type", col_type)
    return ci


def make_dep_calc_column(name, caption, datatype, role, col_type, formula):
    col = etree.Element("column")
    col.set("caption", caption)
    col.set("datatype", datatype)
    col.set("name", name)
    col.set("role", role)
    col.set("type", col_type)
    calc = etree.SubElement(col, "calculation")
    calc.set("class", "tableau")
    calc.set("formula", formula)
    return col


def make_simple_text_worksheet(ws_name, measure_col_ref, ci_name, simple_id_uuid):
    """
    Minimal text mark worksheet that shows a single aggregated measure as big text.
    measure_col_ref: fully qualified ref e.g. [sqlproxy.xxx].[usr:Calc_XX:qk]
    ci_name: the column-instance name e.g. [usr:Calc_XX:qk]
    """
    ws = etree.Element("worksheet")
    ws.set("name", ws_name)

    table = etree.SubElement(ws, "table")
    view = etree.SubElement(table, "view")

    # Datasource reference
    dss = etree.SubElement(view, "datasources")
    ds_ref = etree.SubElement(dss, "datasource")
    ds_ref.set("caption", DS_CAPTION)
    ds_ref.set("name", DS_NAME)

    agg = etree.SubElement(view, "aggregation")
    agg.set("value", "true")

    etree.SubElement(table, "style")

    panes = etree.SubElement(table, "panes")
    pane = etree.SubElement(panes, "pane")
    pane.set("selection-relaxation-option", "selection-relaxation-allow")

    pane_view = etree.SubElement(pane, "view")
    bd = etree.SubElement(pane_view, "breakdown")
    bd.set("value", "auto")

    mark = etree.SubElement(pane, "mark")
    mark.set("class", "Text")

    encodings = etree.SubElement(pane, "encodings")
    text_enc = etree.SubElement(encodings, "text")
    text_enc.set("column", measure_col_ref)

    mark_style = etree.SubElement(pane, "style")
    sr = etree.SubElement(mark_style, "style-rule")
    sr.set("element", "mark")
    fmt1 = etree.SubElement(sr, "format")
    fmt1.set("attr", "mark-labels-show")
    fmt1.set("value", "true")
    fmt2 = etree.SubElement(sr, "format")
    fmt2.set("attr", "mark-labels-cull")
    fmt2.set("value", "true")
    fmt3 = etree.SubElement(sr, "format")
    fmt3.set("attr", "font-size")
    fmt3.set("value", "36")
    fmt4 = etree.SubElement(sr, "format")
    fmt4.set("attr", "font-bold")
    fmt4.set("value", "true")
    fmt5 = etree.SubElement(sr, "format")
    fmt5.set("attr", "color")
    fmt5.set("value", "#2D3748")

    etree.SubElement(table, "rows")
    etree.SubElement(table, "cols")

    sid = etree.SubElement(ws, "simple-id")
    sid.set("uuid", simple_id_uuid)
    return ws


def make_kpi_label_worksheet(ws_name, label_text, simple_id_uuid):
    """
    Minimal worksheet that shows a static text string as a KPI label.
    Uses a calculated field that returns a constant string.
    """
    ws = etree.Element("worksheet")
    ws.set("name", ws_name)

    table = etree.SubElement(ws, "table")
    view = etree.SubElement(table, "view")

    dss = etree.SubElement(view, "datasources")
    ds_ref = etree.SubElement(dss, "datasource")
    ds_ref.set("caption", DS_CAPTION)
    ds_ref.set("name", DS_NAME)

    # Inline calc for the label string
    deps = etree.SubElement(view, "datasource-dependencies")
    deps.set("datasource", DS_NAME)
    label_col = etree.SubElement(deps, "column")
    label_col.set("caption", f"_label_{ws_name[:20]}")
    label_col.set("datatype", "string")
    label_col.set("name", f"[_lbl_{ws_name[:15].replace(' ','')}]")
    label_col.set("role", "dimension")
    label_col.set("type", "nominal")
    calc = etree.SubElement(label_col, "calculation")
    calc.set("class", "tableau")
    calc.set("formula", f'"{label_text}"')

    ci = etree.SubElement(deps, "column-instance")
    ci.set("column", f"[_lbl_{ws_name[:15].replace(' ','')}]")
    ci.set("derivation", "User")
    ci.set("name", f"[usr:_lbl_{ws_name[:15].replace(' ','')}:nk]")
    ci.set("pivot", "key")
    ci.set("type", "nominal")

    agg = etree.SubElement(view, "aggregation")
    agg.set("value", "true")

    etree.SubElement(table, "style")

    panes = etree.SubElement(table, "panes")
    pane = etree.SubElement(panes, "pane")
    pane.set("selection-relaxation-option", "selection-relaxation-allow")

    pane_view = etree.SubElement(pane, "view")
    bd = etree.SubElement(pane_view, "breakdown")
    bd.set("value", "auto")

    mark = etree.SubElement(pane, "mark")
    mark.set("class", "Text")

    encodings = etree.SubElement(pane, "encodings")
    text_enc = etree.SubElement(encodings, "text")
    text_enc.set("column", f"[{DS_NAME}].[usr:_lbl_{ws_name[:15].replace(' ','')}:nk]")

    mark_style = etree.SubElement(pane, "style")
    sr = etree.SubElement(mark_style, "style-rule")
    sr.set("element", "mark")
    fmt1 = etree.SubElement(sr, "format")
    fmt1.set("attr", "mark-labels-show")
    fmt1.set("value", "true")
    fmt1 = etree.SubElement(sr, "format")
    fmt1.set("attr", "font-size")
    fmt1.set("value", "11")
    fmt1 = etree.SubElement(sr, "format")
    fmt1.set("attr", "color")
    fmt1.set("value", "#718096")

    etree.SubElement(table, "rows")
    etree.SubElement(table, "cols")

    sid = etree.SubElement(ws, "simple-id")
    sid.set("uuid", simple_id_uuid)
    return ws


def make_horizontal_bar_worksheet(ws_name, dimension_col, measure_col,
                                   dim_ci_name, meas_ci_name,
                                   dim_derivation, meas_derivation,
                                   simple_id_uuid, title=None):
    """
    Horizontal bar chart: dimension on Rows, measure on Cols.
    Bar orientation: rows=dimension, cols=measure → horizontal bars.
    """
    ws = etree.Element("worksheet")
    ws.set("name", ws_name)

    if title:
        lo = etree.SubElement(ws, "layout-options")
        t = etree.SubElement(lo, "title")
        ft = etree.SubElement(t, "formatted-text")
        run = etree.SubElement(ft, "run")
        run.text = title

    table = etree.SubElement(ws, "table")
    view = etree.SubElement(table, "view")

    dss = etree.SubElement(view, "datasources")
    ds_ref = etree.SubElement(dss, "datasource")
    ds_ref.set("caption", DS_CAPTION)
    ds_ref.set("name", DS_NAME)

    deps = etree.SubElement(view, "datasource-dependencies")
    deps.set("datasource", DS_NAME)
    ci_dim = etree.SubElement(deps, "column-instance")
    ci_dim.set("column", dimension_col)
    ci_dim.set("derivation", dim_derivation)
    ci_dim.set("name", dim_ci_name)
    ci_dim.set("pivot", "key")
    ci_dim.set("type", "nominal")

    ci_meas = etree.SubElement(deps, "column-instance")
    ci_meas.set("column", measure_col)
    ci_meas.set("derivation", meas_derivation)
    ci_meas.set("name", meas_ci_name)
    ci_meas.set("pivot", "key")
    ci_meas.set("type", "quantitative")

    agg = etree.SubElement(view, "aggregation")
    agg.set("value", "true")

    etree.SubElement(table, "style")

    panes = etree.SubElement(table, "panes")
    pane = etree.SubElement(panes, "pane")
    pane.set("selection-relaxation-option", "selection-relaxation-allow")

    pane_view = etree.SubElement(pane, "view")
    bd = etree.SubElement(pane_view, "breakdown")
    bd.set("value", "auto")

    mark = etree.SubElement(pane, "mark")
    mark.set("class", "Bar")

    # Rows = dimension (horizontal bar), Cols = measure
    rows_el = etree.SubElement(table, "rows")
    rows_el.text = f"[{DS_NAME}].{dim_ci_name}"
    cols_el = etree.SubElement(table, "cols")
    cols_el.text = f"[{DS_NAME}].{meas_ci_name}"

    sid = etree.SubElement(ws, "simple-id")
    sid.set("uuid", simple_id_uuid)
    return ws


# ── T2: Voucher Sankey worksheet ───────────────────────────────────────────────
def t2_build_sankey_worksheet():
    print("[T2] Building Voucher Flow Sankey worksheet...")

    ws = etree.Element("worksheet")
    ws.set("name", "V3 Voucher Flow Sankey")

    lo = etree.SubElement(ws, "layout-options")
    t = etree.SubElement(lo, "title")
    ft = etree.SubElement(t, "formatted-text")
    run = etree.SubElement(ft, "run")
    run.text = "Voucher Value Flow"

    table = etree.SubElement(ws, "table")
    view = etree.SubElement(table, "view")

    dss = etree.SubElement(view, "datasources")
    ds_ref = etree.SubElement(dss, "datasource")
    ds_ref.set("caption", DS_CAPTION)
    ds_ref.set("name", DS_NAME)

    deps = etree.SubElement(view, "datasource-dependencies")
    deps.set("datasource", DS_NAME)

    # Source column-instance (User derivation = use as-is)
    ci_src = etree.SubElement(deps, "column-instance")
    ci_src.set("column", "[Calculation_voucher_sankey_source]")
    ci_src.set("derivation", "User")
    ci_src.set("name", "[usr:Calculation_voucher_sankey_source:nk]")
    ci_src.set("pivot", "key")
    ci_src.set("type", "nominal")

    # Target column-instance
    ci_tgt = etree.SubElement(deps, "column-instance")
    ci_tgt.set("column", "[Calculation_voucher_sankey_target]")
    ci_tgt.set("derivation", "User")
    ci_tgt.set("name", "[usr:Calculation_voucher_sankey_target:nk]")
    ci_tgt.set("pivot", "key")
    ci_tgt.set("type", "nominal")

    # Value column-instance (Sum)
    ci_val = etree.SubElement(deps, "column-instance")
    ci_val.set("column", "[Calculation_voucher_sankey_value]")
    ci_val.set("derivation", "Sum")
    ci_val.set("name", "[usr:Calculation_voucher_sankey_value:qk]")
    ci_val.set("pivot", "key")
    ci_val.set("type", "quantitative")

    agg = etree.SubElement(view, "aggregation")
    agg.set("value", "true")

    etree.SubElement(table, "style")

    panes = etree.SubElement(table, "panes")
    pane = etree.SubElement(panes, "pane")
    pane.set("selection-relaxation-option", "selection-relaxation-allow")

    pane_view = etree.SubElement(pane, "view")
    bd = etree.SubElement(pane_view, "breakdown")
    bd.set("value", "auto")

    # VizExtensions marks
    false_mark = etree.SubElement(pane, "_.fcp.VizExtensions.false...mark")
    false_mark.set("class", "Automatic")
    true_mark = etree.SubElement(pane, "_.fcp.VizExtensions.true...mark")
    true_mark.set("class", "VizExtension")

    # Add-in element
    add_in = etree.SubElement(pane, "_.fcp.VizExtensions.true...add-in")
    add_in.set("add-in-id", "com.tableau.extension.sankey")
    add_in.set("extension-url", "https://extensions.tableauusercontent.com/sandbox/sankey/sankey.html")
    add_in.set("extension-version", "1.0.0")
    add_in.set("instance-id", "9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C")
    etree.SubElement(add_in, "instance-settings")
    ts = etree.SubElement(add_in, "type-settings")
    etree.SubElement(ts, "worksheet")

    # Encodings with paired UUIDs
    encodings = etree.SubElement(pane, "encodings")

    # source: level1
    src_uuid = "{E1A2B3C4-D5E6-7F8A-9B0C-1D2E3F4A5B6C}"
    false_lod_src = etree.SubElement(encodings, "_.fcp.VizExtensions.false...lod")
    false_lod_src.set("_.fcp.VizExtensionsDupEncodingUUID.true...encoding-id", src_uuid)
    false_lod_src.set("column", f"[{DS_NAME}].[usr:Calculation_voucher_sankey_source:nk]")
    true_custom_src = etree.SubElement(encodings, "_.fcp.VizExtensions.true...custom")
    true_custom_src.set("_.fcp.VizExtensionsDupEncodingUUID.true...encoding-id", src_uuid)
    true_custom_src.set("column", f"[{DS_NAME}].[usr:Calculation_voucher_sankey_source:nk]")
    true_custom_src.set("custom-type-name", "level1")

    # target: level2
    tgt_uuid = "{F2B3C4D5-E6F7-8A9B-0C1D-2E3F4A5B6C7D}"
    false_lod_tgt = etree.SubElement(encodings, "_.fcp.VizExtensions.false...lod")
    false_lod_tgt.set("_.fcp.VizExtensionsDupEncodingUUID.true...encoding-id", tgt_uuid)
    false_lod_tgt.set("column", f"[{DS_NAME}].[usr:Calculation_voucher_sankey_target:nk]")
    true_custom_tgt = etree.SubElement(encodings, "_.fcp.VizExtensions.true...custom")
    true_custom_tgt.set("_.fcp.VizExtensionsDupEncodingUUID.true...encoding-id", tgt_uuid)
    true_custom_tgt.set("column", f"[{DS_NAME}].[usr:Calculation_voucher_sankey_target:nk]")
    true_custom_tgt.set("custom-type-name", "level2")

    # value: link
    val_uuid = "{A3C4D5E6-F7A8-9B0C-1D2E-3F4A5B6C7D8E}"
    false_lod_val = etree.SubElement(encodings, "_.fcp.VizExtensions.false...lod")
    false_lod_val.set("_.fcp.VizExtensionsDupEncodingUUID.true...encoding-id", val_uuid)
    false_lod_val.set("column", f"[{DS_NAME}].[usr:Calculation_voucher_sankey_value:qk]")
    true_custom_val = etree.SubElement(encodings, "_.fcp.VizExtensions.true...custom")
    true_custom_val.set("_.fcp.VizExtensionsDupEncodingUUID.true...encoding-id", val_uuid)
    true_custom_val.set("column", f"[{DS_NAME}].[usr:Calculation_voucher_sankey_value:qk]")
    true_custom_val.set("custom-type-name", "link")

    mark_style = etree.SubElement(pane, "style")
    sr = etree.SubElement(mark_style, "style-rule")
    sr.set("element", "mark")
    fmt1 = etree.SubElement(sr, "format")
    fmt1.set("attr", "mark-labels-show")
    fmt1.set("value", "true")
    fmt2 = etree.SubElement(sr, "format")
    fmt2.set("attr", "mark-labels-cull")
    fmt2.set("value", "true")

    etree.SubElement(table, "rows")
    etree.SubElement(table, "cols")

    sid = etree.SubElement(ws, "simple-id")
    sid.set("uuid", "{C0000003-0003-0003-0003-000000000003}")
    return ws


# ── T3: KPI tile worksheets ────────────────────────────────────────────────────
def t3_build_kpi_worksheets():
    print("[T3] Building KPI tile worksheets...")
    worksheets = []

    ds = DS_NAME

    # V1: Voucher Leakage Rate — big number
    ws_v1 = make_simple_text_worksheet(
        "V1 Leakage Rate",
        f"[{ds}].[usr:Calc_V1_Voucher_Leakage_Rate:qk]",
        "[usr:Calc_V1_Voucher_Leakage_Rate:qk]",
        "{D0000004-0004-0004-0004-000000000004}"
    )
    worksheets.append(ws_v1)

    # V1 label
    ws_v1_lbl = make_kpi_label_worksheet(
        "V1 Leakage Label",
        "Voucher Leakage Rate",
        "{E0000005-0005-0005-0005-000000000005}"
    )
    worksheets.append(ws_v1_lbl)

    # V2 KPI: Redemption Rate — big number
    ws_v2_kpi = make_simple_text_worksheet(
        "V2 Redemption Rate KPI",
        f"[{ds}].[usr:Calc_V2_Redemption_Rate:qk]",
        "[usr:Calc_V2_Redemption_Rate:qk]",
        "{F0000006-0006-0006-0006-000000000006}"
    )
    worksheets.append(ws_v2_kpi)

    # V2 label
    ws_v2_lbl = make_kpi_label_worksheet(
        "V2 Redemption Label",
        "Voucher Redemption Rate",
        "{A0000007-0007-0007-0007-000000000007}"
    )
    worksheets.append(ws_v2_lbl)

    # V4 KPI: Face Value Utilization — big number
    ws_v4_kpi = make_simple_text_worksheet(
        "V4 Utilization KPI",
        f"[{ds}].[usr:Calc_V4_Face_Value_Utilization:qk]",
        "[usr:Calc_V4_Face_Value_Utilization:qk]",
        "{B0000008-0008-0008-0008-000000000008}"
    )
    worksheets.append(ws_v4_kpi)

    # V4 label
    ws_v4_lbl = make_kpi_label_worksheet(
        "V4 Utilization Label",
        "Face Value Utilization",
        "{C0000009-0009-0009-0009-000000000009}"
    )
    worksheets.append(ws_v4_lbl)

    print(f"  Built {len(worksheets)} KPI worksheets")
    return worksheets


# ── T4: Chart worksheets ───────────────────────────────────────────────────────
def t4_build_chart_worksheets():
    print("[T4] Building chart worksheets...")
    worksheets = []
    ds = DS_NAME

    # V2 Bar: Redemption Rate by Voucher Definition
    ws_v2_bar = make_horizontal_bar_worksheet(
        "V2 Redemption by Definition",
        "[ssot__Name__c (Voucher Definition)]",
        "[Calc_V2_Redemption_Rate]",
        "[none:ssot__Name__c (Voucher Definition):nk]",
        "[usr:Calc_V2_Redemption_Rate:qk]",
        "None", "User",
        "{D0000010-0010-0010-0010-000000000010}",
        title="Redemption Rate by Voucher Definition"
    )
    worksheets.append(ws_v2_bar)

    # V5 Bar: Voucher ROI by Type
    ws_v5_bar = make_horizontal_bar_worksheet(
        "V5 ROI by Voucher Type",
        "[Voucher_Type__c]",
        "[Calc_V5_Voucher_ROI]",
        "[none:Voucher_Type__c:nk]",
        "[usr:Calc_V5_Voucher_ROI:qk]",
        "None", "User",
        "{E0000011-0011-0011-0011-000000000011}",
        title="Voucher ROI by Type"
    )
    worksheets.append(ws_v5_bar)

    # V6 Dual-axis: Expired value bars + Issued line by month
    # Build manually as it requires dual axis
    ws_v6 = _make_v6_dual_axis_worksheet()
    worksheets.append(ws_v6)

    print(f"  Built {len(worksheets)} chart worksheets")
    return worksheets


def _make_v6_dual_axis_worksheet():
    """
    V6: Expired Face Value (bar) by month of expiration.
    Single-axis bar for safe programmatic generation.
    Dual-axis finishing (adding Issued Value as line) is a manual Desktop step.
    """
    ds = DS_NAME

    ws = etree.Element("worksheet")
    ws.set("name", "V6 Expiry Trend")

    lo = etree.SubElement(ws, "layout-options")
    t = etree.SubElement(lo, "title")
    ft = etree.SubElement(t, "formatted-text")
    run = etree.SubElement(ft, "run")
    run.text = "Voucher Expiry Trend"

    table = etree.SubElement(ws, "table")
    view = etree.SubElement(table, "view")

    dss = etree.SubElement(view, "datasources")
    ds_ref = etree.SubElement(dss, "datasource")
    ds_ref.set("caption", DS_CAPTION)
    ds_ref.set("name", ds)

    deps = etree.SubElement(view, "datasource-dependencies")
    deps.set("datasource", ds)

    # Month-truncated Expiration Date
    ci_month = etree.SubElement(deps, "column-instance")
    ci_month.set("column", "[ssot__ExpirationDate__c]")
    ci_month.set("derivation", "Month-Trunc")
    ci_month.set("name", "[tmn:ssot__ExpirationDate__c:qk]")
    ci_month.set("pivot", "key")
    ci_month.set("type", "quantitative")

    # Expired value
    ci_exp = etree.SubElement(deps, "column-instance")
    ci_exp.set("column", "[Calc_V6_Expired_Value]")
    ci_exp.set("derivation", "User")
    ci_exp.set("name", "[usr:Calc_V6_Expired_Value:qk]")
    ci_exp.set("pivot", "key")
    ci_exp.set("type", "quantitative")

    # Issued value (available in datasource-dependencies for Desktop finishing)
    ci_iss = etree.SubElement(deps, "column-instance")
    ci_iss.set("column", "[Calc_V6_Issued_Value]")
    ci_iss.set("derivation", "User")
    ci_iss.set("name", "[usr:Calc_V6_Issued_Value:qk]")
    ci_iss.set("pivot", "key")
    ci_iss.set("type", "quantitative")

    agg = etree.SubElement(view, "aggregation")
    agg.set("value", "true")

    etree.SubElement(table, "style")

    panes = etree.SubElement(table, "panes")

    # Single pane: Bar (Expired value by month)
    pane0 = etree.SubElement(panes, "pane")
    pane0.set("selection-relaxation-option", "selection-relaxation-allow")

    pv0 = etree.SubElement(pane0, "view")
    bd0 = etree.SubElement(pv0, "breakdown")
    bd0.set("value", "auto")

    mark0 = etree.SubElement(pane0, "mark")
    mark0.set("class", "Bar")

    # Rows = expired value; Cols = month dimension
    rows_el = etree.SubElement(table, "rows")
    rows_el.text = f"[{ds}].[usr:Calc_V6_Expired_Value:qk]"
    cols_el = etree.SubElement(table, "cols")
    cols_el.text = f"[{ds}].[tmn:ssot__ExpirationDate__c:qk]"

    sid = etree.SubElement(ws, "simple-id")
    sid.set("uuid", "{F0000012-0012-0012-0012-000000000012}")
    return ws


# ── T5: Dashboard layout ───────────────────────────────────────────────────────
def t5_build_dashboard():
    """Build Voucher Intelligence dashboard with 1440x900 fixed layout."""
    print("[T5] Building dashboard...")

    dash = etree.Element("dashboard")
    dash.set("name", "Voucher Intelligence")
    dash.set("enable-sort-zone-taborder", "true")

    lo = etree.SubElement(dash, "layout-options")
    t = etree.SubElement(lo, "title")
    ft = etree.SubElement(t, "formatted-text")
    run = etree.SubElement(ft, "run")
    run.set("fontsize", "18")
    run.set("bold", "true")
    run.text = "Voucher Intelligence"

    # Fixed 1440x900
    size_el = etree.SubElement(dash, "size")
    size_el.set("maxheight", "900")
    size_el.set("maxwidth", "1440")
    size_el.set("minheight", "900")
    size_el.set("minwidth", "1440")
    size_el.set("sizing-mode", "fixed")

    # ── Zone coordinate system ──────────────────────────────────────────────
    # Tableau uses a 0-100000 unit canvas regardless of pixel size.
    # For 1440x900: 1px_w = 100000/1440 ≈ 69, 1px_h = 100000/900 ≈ 111
    # All layout containers use type-v2, not type.
    # Every zone needs a <zone-style> child with border/margin/padding.
    # Worksheet zones reference sheets by name= attribute (no type-v2 needed).
    # Layout containers: type-v2="layout-flow" with param="vert" or param="horz"
    # ───────────────────────────────────────────────────────────────────────

    W = 100000  # full width
    H = 100000  # full height
    # pixels to units
    def px_w(px): return int(px * 100000 / 1440)
    def px_h(px): return int(px * 100000 / 900)

    zone_id = [1]
    def next_id():
        z = zone_id[0]
        zone_id[0] += 1
        return str(z)

    def zone_style(border_style="none", border_width="0", margin="4",
                   padding=None, background=None):
        """Return a <zone-style> element."""
        zs = etree.Element("zone-style")
        def fmt(attr, val):
            f = etree.SubElement(zs, "format")
            f.set("attr", attr)
            f.set("value", val)
        fmt("border-color", "#000000")
        fmt("border-style", border_style)
        fmt("border-width", border_width)
        fmt("margin", margin)
        if padding is not None:
            fmt("padding", padding)
        if background is not None:
            fmt("background-color", background)
        return zs

    def make_layout_zone(zone_type_v2, param, zid, x, y, w, h,
                         fixed_size=None, is_fixed=None,
                         background=None):
        """Layout container zone (layout-flow or layout-basic)."""
        z = etree.Element("zone")
        z.set("h", str(h))
        z.set("id", zid)
        z.set("param", param)
        z.set("type-v2", zone_type_v2)
        z.set("w", str(w))
        z.set("x", str(x))
        z.set("y", str(y))
        if fixed_size is not None:
            z.set("fixed-size", str(fixed_size))
        if is_fixed is not None:
            z.set("is-fixed", str(is_fixed))
        z.append(zone_style(background=background))
        return z

    def make_sheet_zone(name, zid, x, y, w, h,
                        fixed_size=None, is_fixed=None,
                        background=None):
        """Worksheet zone — references a sheet by name."""
        z = etree.Element("zone")
        z.set("h", str(h))
        z.set("id", zid)
        z.set("name", name)
        z.set("w", str(w))
        z.set("x", str(x))
        z.set("y", str(y))
        if fixed_size is not None:
            z.set("fixed-size", str(fixed_size))
        if is_fixed is not None:
            z.set("is-fixed", str(is_fixed))
        z.append(zone_style(background=background, padding="4"))
        return z

    def make_title_zone(zid, x, y, w, h):
        z = etree.Element("zone")
        z.set("h", str(h))
        z.set("id", zid)
        z.set("type-v2", "title")
        z.set("w", str(w))
        z.set("x", str(x))
        z.set("y", str(y))
        z.append(zone_style())
        return z

    # ── Layout ────────────────────────────────────────────────────────────
    # Pixel layout:
    #   Total: 1440 x 900
    #   Content area: 1176px wide (left), Filter panel: 240px wide (right), 24px gap
    #   Rows (top→bottom): Title 60px | gap 16px | KPI 140px | gap 16px | Sankey 336px | gap 16px | Bottom 256px | gap 16px | Footer 44px = 900px

    content_w = px_w(1176)   # ≈ 81666
    filter_w  = px_w(240)    # ≈ 16666
    gap_w     = px_w(24)     # ≈ 1666
    full_h    = H            # 100000

    # Heights in units
    title_h   = px_h(60)    # ≈ 6666
    kpi_h     = px_h(140)   # ≈ 15555
    kpi_num_h = px_h(100)   # ≈ 11111
    kpi_lbl_h = px_h(40)    # ≈ 4444
    sankey_h  = px_h(336)   # ≈ 37333
    bottom_h  = px_h(256)   # ≈ 28444
    gap_h     = px_h(16)    # ≈ 1777

    # Y positions (cumulative)
    y_title   = 0
    y_kpi     = title_h + gap_h
    y_sankey  = y_kpi + kpi_h + gap_h
    y_bottom  = y_sankey + sankey_h + gap_h

    # X positions for filter panel
    x_filter  = content_w + gap_w

    # KPI tile widths (3 tiles across content_w, with small gaps)
    kpi_tile_w = px_w(275)   # ≈ 19097
    kpi_gap_w  = px_w(16)    # ≈ 1111

    # Bottom chart widths
    v2_bar_w  = px_w(376)   # ≈ 26111
    v6_w      = px_w(392)   # ≈ 27222
    v5_bar_w  = px_w(376)   # ≈ 26111
    chart_gap = px_w(16)    # ≈ 1111

    # ── Root zone ─────────────────────────────────────────────────────────
    zones = etree.SubElement(dash, "zones")

    # Outer layout-basic (full canvas)
    root = make_layout_zone("layout-basic", "", next_id(),
                             0, 0, W, H)
    zones.append(root)

    # ── Content area: vertical layout-flow ────────────────────────────────
    content = make_layout_zone("layout-flow", "vert", next_id(),
                                0, 0, content_w, full_h)
    root.append(content)

    # Title
    title_z = make_title_zone(next_id(), 0, y_title, content_w, title_h)
    content.append(title_z)

    # KPI row: horizontal layout-flow
    kpi_row = make_layout_zone("layout-flow", "horz", next_id(),
                                0, y_kpi, content_w, kpi_h)
    content.append(kpi_row)

    # V1 KPI tile: vertical layout-flow
    v1_x = 0
    v1_container = make_layout_zone("layout-flow", "vert", next_id(),
                                     v1_x, y_kpi, kpi_tile_w, kpi_h)
    kpi_row.append(v1_container)
    v1_num = make_sheet_zone("V1 Leakage Rate", next_id(),
                              v1_x, y_kpi, kpi_tile_w, kpi_num_h,
                              background="#FFFFFF")
    v1_lbl = make_sheet_zone("V1 Leakage Label", next_id(),
                              v1_x, y_kpi + kpi_num_h, kpi_tile_w, kpi_lbl_h,
                              background="#FFFFFF")
    v1_container.append(v1_num)
    v1_container.append(v1_lbl)

    # V2 KPI tile
    v2_x = kpi_tile_w + kpi_gap_w
    v2_container = make_layout_zone("layout-flow", "vert", next_id(),
                                     v2_x, y_kpi, kpi_tile_w, kpi_h)
    kpi_row.append(v2_container)
    v2_num = make_sheet_zone("V2 Redemption Rate KPI", next_id(),
                              v2_x, y_kpi, kpi_tile_w, kpi_num_h,
                              background="#FFFFFF")
    v2_lbl = make_sheet_zone("V2 Redemption Label", next_id(),
                              v2_x, y_kpi + kpi_num_h, kpi_tile_w, kpi_lbl_h,
                              background="#FFFFFF")
    v2_container.append(v2_num)
    v2_container.append(v2_lbl)

    # V4 KPI tile
    v4_x = 2 * (kpi_tile_w + kpi_gap_w)
    v4_container = make_layout_zone("layout-flow", "vert", next_id(),
                                     v4_x, y_kpi, kpi_tile_w, kpi_h)
    kpi_row.append(v4_container)
    v4_num = make_sheet_zone("V4 Utilization KPI", next_id(),
                              v4_x, y_kpi, kpi_tile_w, kpi_num_h,
                              background="#FFFFFF")
    v4_lbl = make_sheet_zone("V4 Utilization Label", next_id(),
                              v4_x, y_kpi + kpi_num_h, kpi_tile_w, kpi_lbl_h,
                              background="#FFFFFF")
    v4_container.append(v4_num)
    v4_container.append(v4_lbl)

    # Sankey zone
    sankey_z = make_sheet_zone("V3 Voucher Flow Sankey", next_id(),
                                0, y_sankey, content_w, sankey_h,
                                background="#FFFFFF")
    content.append(sankey_z)

    # Bottom row: horizontal layout-flow
    bottom_row = make_layout_zone("layout-flow", "horz", next_id(),
                                   0, y_bottom, content_w, bottom_h)
    content.append(bottom_row)

    v2_bar_z = make_sheet_zone("V2 Redemption by Definition", next_id(),
                                0, y_bottom, v2_bar_w, bottom_h,
                                background="#FFFFFF")
    v6_x = v2_bar_w + chart_gap
    v6_z = make_sheet_zone("V6 Expiry Trend", next_id(),
                            v6_x, y_bottom, v6_w, bottom_h,
                            background="#FFFFFF")
    v5_x = v6_x + v6_w + chart_gap
    v5_z = make_sheet_zone("V5 ROI by Voucher Type", next_id(),
                            v5_x, y_bottom, v5_bar_w, bottom_h,
                            background="#FFFFFF")
    bottom_row.append(v2_bar_z)
    bottom_row.append(v6_z)
    bottom_row.append(v5_z)

    # ── Filter panel (right side) ─────────────────────────────────────────
    filter_panel = make_layout_zone("layout-flow", "vert", next_id(),
                                     x_filter, 0, filter_w, full_h,
                                     background="#F7F8FB")
    root.append(filter_panel)

    # Param controls in filter panel
    for param_ref, ctrl_id in [
        ("[Parameters].[Parameter 3]", next_id()),    # Loyalty Program
        ("[Parameters].[Parameter 11]", next_id()),   # Start Date
        ("[Parameters].[Parameter 12]", next_id()),   # End Date
    ]:
        ctrl_h = px_h(50)
        pctrl = etree.Element("zone")
        pctrl.set("h", str(ctrl_h))
        pctrl.set("id", ctrl_id)
        pctrl.set("mode", "compact")
        pctrl.set("param", param_ref)
        pctrl.set("type-v2", "paramctrl")
        pctrl.set("w", str(filter_w))
        pctrl.set("x", str(x_filter))
        pctrl.set("y", "0")
        pctrl.append(zone_style())
        filter_panel.append(pctrl)

    # ── Dashboard style ───────────────────────────────────────────────────
    style = etree.SubElement(dash, "style")
    sr = etree.SubElement(style, "style-rule")
    sr.set("element", "dashboard")
    fmt_bg = etree.SubElement(sr, "format")
    fmt_bg.set("attr", "background-color")
    fmt_bg.set("value", "#FAFAFB")

    sid = etree.SubElement(dash, "simple-id")
    sid.set("uuid", "{A0000001-DASH-DASH-DASH-000000000001}")

    print("  Dashboard built.")
    return dash


# ── Inject worksheets & dashboard into tree ────────────────────────────────────
def inject_content(tree, all_worksheets, dashboard):
    print("[Build] Injecting worksheets and dashboard into workbook tree...")

    # Find </datasources> position — need to insert <worksheets> after it
    # In lxml, we work with elements directly
    workbook = tree  # tree IS the root <workbook> element

    # Find datasources element
    datasources_el = workbook.find("datasources")
    assert datasources_el is not None, "No <datasources> element found"

    ds_index = list(workbook).index(datasources_el)
    print(f"  datasources is child index {ds_index}")

    # Build <worksheets> container
    worksheets_el = etree.Element("worksheets")
    for ws in all_worksheets:
        worksheets_el.append(ws)

    # Build <dashboards> container
    dashboards_el = etree.Element("dashboards")
    dashboards_el.append(dashboard)

    # Insert after datasources
    workbook.insert(ds_index + 1, worksheets_el)
    workbook.insert(ds_index + 2, dashboards_el)

    print(f"  Injected {len(all_worksheets)} worksheets + 1 dashboard")
    return tree


# ── Repackage as TWBX ──────────────────────────────────────────────────────────
def repackage_twbx(twb_path, output_path):
    print(f"[Repackage] Creating {output_path}...")
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add the TWB file
        zf.write(twb_path, os.path.basename(twb_path))
        # Add Image folder if it exists
        image_dir = twb_path.parent / "Image"
        if image_dir.exists():
            for img_file in image_dir.rglob("*"):
                if img_file.is_file():
                    rel_path = img_file.relative_to(twb_path.parent)
                    zf.write(img_file, str(rel_path))
                    print(f"  + Image: {rel_path}")
    size = os.path.getsize(output_path)
    print(f"  Output: {output_path} ({size:,} bytes)")
    return output_path


# ── Validate ───────────────────────────────────────────────────────────────────
def validate_twbx(path):
    print(f"[Validate] Checking {path}...")
    # Test ZIP integrity
    with zipfile.ZipFile(path, 'r') as zf:
        bad = zf.testzip()
        if bad:
            print(f"  ERROR: bad file in ZIP: {bad}")
            return False
        names = zf.namelist()
        print(f"  ZIP files: {names}")
        twb_name = next((n for n in names if n.endswith('.twb')), None)
        if not twb_name:
            print("  ERROR: no .twb file in ZIP")
            return False
        # Parse XML
        twb_bytes = zf.read(twb_name)
    parser = etree.XMLParser(recover=True)
    try:
        root = etree.fromstring(twb_bytes, parser)
        ws_count = len(root.findall(".//worksheet"))
        dash_count = len(root.findall(".//dashboard"))
        print(f"  XML OK: {ws_count} worksheets, {dash_count} dashboards")
        return True
    except Exception as e:
        print(f"  ERROR parsing XML: {e}")
        return False


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tier", type=int, default=5,
                        help="Run through this tier (0=unzip only, 5=full build)")
    args = parser.parse_args()

    print(f"=== Build D1 Voucher Intelligence (through tier {args.tier}) ===\n")

    # T0: Unzip
    twb_path = t0_unzip()
    if args.tier == 0:
        # Just repackage unchanged
        out = repackage_twbx(twb_path, OUTPUT_TWBX)
        validate_twbx(out)
        return

    # Parse TWB
    print("\n[Parse] Reading TWB XML...")
    tree = parse_twb(twb_path)
    print("  Parse OK")

    # T1: Add calc fields
    if args.tier >= 1:
        tree = t1_add_calcs(tree)

    # Build worksheet list
    all_worksheets = []

    # T2: Sankey worksheet
    if args.tier >= 2:
        sankey_ws = t2_build_sankey_worksheet()
        all_worksheets.append(sankey_ws)

    # T3: KPI worksheets
    if args.tier >= 3:
        kpi_worksheets = t3_build_kpi_worksheets()
        all_worksheets.extend(kpi_worksheets)

    # T4: Chart worksheets
    if args.tier >= 4:
        chart_worksheets = t4_build_chart_worksheets()
        all_worksheets.extend(chart_worksheets)

    # T5: Dashboard
    dashboard = None
    if args.tier >= 5:
        dashboard = t5_build_dashboard()

    # Inject into tree
    if all_worksheets or dashboard:
        inject_content(tree, all_worksheets, dashboard if dashboard else etree.Element("placeholder"))

    # Serialize
    output_twb = twb_path.parent / "Loyalty-D1-Voucher-Intelligence.twb"
    serialize_twb(tree, output_twb)

    # Repackage
    out_twbx = repackage_twbx(output_twb, OUTPUT_TWBX)

    # Validate
    valid = validate_twbx(out_twbx)

    print(f"\n{'SUCCESS' if valid else 'FAILED'}: {out_twbx}")
    print("\n⚠ Manual finish items in Tableau Desktop:")
    print("  1. Verify Sankey loads (may need VizExtension allowlist)")
    print("  2. Adjust KPI tile font sizes and colors")
    print("  3. Add date range filter action: Parameters > Start/End Date")
    print("  4. Add Program filter chip (Parameters > Parameter 3)")
    print("  5. Fix V6 dual-axis — enable in Desktop: right-click second axis > Dual Axis")
    print("  6. Format all axes, remove gridlines, set backgrounds to Transparent")
    print("  7. Apply color encoding to Sankey nodes")
    print("  8. Dashboard layout may need spacing adjustments")


if __name__ == "__main__":
    main()
