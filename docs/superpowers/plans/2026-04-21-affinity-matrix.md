# Affinity Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use `- [ ]` checkbox syntax.

**Goal:** Build a product affinity / co-occurrence matrix Tableau Viz Extension that shows which products are bought together. Features: metric toggle (Count / Lift / Support), diverging color scale for Lift, diagonal highlighting (grey), symmetric sort (clicking a header reorders both axes), and hover tooltips with all three metric values.

**Architecture:** A pure HTML/JS extension (no build step) served from GitHub Pages. Encodes six slots in the `.trex` manifest: `row`, `col`, `count`, `row_total`, `col_total`, and `grand_total` (optional). Reads flat summary data from Tableau's Extensions API — each row is one (row_product, col_product) pair with pre-aggregated totals. A `test.html` page mocks the full Tableau API with 5 coffee-shop products × 5 products (25 pairs), realistic co-purchase counts, so the chart can be developed and verified in any browser without Tableau Desktop. Three display metrics are toggled by toolbar buttons.

**Tech Stack:** D3.js v7, Tableau Extensions API 2.x, vanilla JS ES2020, GitHub Pages

---

## File Map

| Path | Role |
|---|---|
| `extensions/affinity-matrix/affinity-matrix.trex` | Production manifest (GitHub Pages URL) |
| `extensions/affinity-matrix/affinity-matrix-local.trex` | Dev manifest (localhost:8080 URL) |
| `extensions/affinity-matrix/index.html` | Extension shell loaded by Tableau in an iframe |
| `extensions/affinity-matrix/chart.js` | All D3 rendering + Tableau API integration |
| `extensions/affinity-matrix/test.html` | Standalone browser test — mocks Tableau API with 5×5 coffee-shop products |
| `extensions/affinity-matrix/README.md` | Extension documentation |

---

## Progress Tracker

- [ ] Task 1 — TREX Manifests
- [ ] Task 2 — HTML Shell (`index.html`)
- [ ] Task 3 — Chart Logic (`chart.js`)
- [ ] Task 4 — Test Page (`test.html`)
- [ ] Task 5 — README
- [ ] Task 6 — Push and verify

---

## Critical Design Notes (read before implementing)

### Data shape from Tableau

Tableau hands you one flat row per (row_product, col_product) pair. The `row_total`, `col_total`, and `grand_total` columns are LOD calculations that **repeat the same value** for every row that shares the same dimension value. Do NOT accumulate (sum) them. Instead:

```javascript
// CORRECT — set on first encounter only:
if (!rowTotals.has(rk)) rowTotals.set(rk, Number(row[rti].value));
if (!colTotals.has(ck)) colTotals.set(ck, Number(row[cti].value));
if (grandTotal === null) grandTotal = Number(row[gti].value);

// WRONG — do not do this (double-counts):
// rowTotals.set(rk, (rowTotals.get(rk) ?? 0) + val);
```

### Symmetric vs. asymmetric mode

The extension supports two modes, detected automatically at render time:

- **Symmetric mode**: `rowField === colField` — same product dimension on both axes. Clicking any header sorts BOTH rows AND columns in the same order (so the diagonal stays on the diagonal).
- **Asymmetric mode**: `rowField !== colField` — different fields (e.g., Category × Product). Clicking a column header sorts rows only. Sort state tracks differently.

### Diagonal detection

Apply the grey `#e8e8e8` override only when BOTH conditions are true:
1. Symmetric mode is active (`rowField === colField`)
2. `rowKey === colKey` (string equality)

### grand_total is optional

When the `grand_total` encoding is empty, disable the Lift and Support toolbar buttons (grey them out, `disabled` attribute, cursor not-allowed). Count always works. Do not try to compute grand_total from row_total sums — that gives wrong answers for non-exhaustive co-purchase data.

### Lift value clamping for color

`d3.scaleDiverging(d3.interpolatePuOr).domain([0, 1, 2])` — both extremes are dark, midpoint (1.0 = no affinity) is near-white/neutral. Clamp the input to the color scale: `Math.min(liftVal, 2)`. Show the true (unclamped) lift in cell text and tooltip.

### Metric formatters

- Count: `d3.format(',.0f')` — e.g., `1,800`
- Support: `d3.format('.2%')` — e.g., `18.00%`
- Lift: `d3.format('.2f')` — e.g., `1.13`

### Diagonal value in mock data

When `rowKey === colKey`, set `count = row_total` (= col_total for that product) — represents "this product appears in its own transactions". The cell renders grey regardless, but the tooltip still shows a value.

---

## Task 1: TREX Manifests

**Files:**
- Create: `extensions/affinity-matrix/affinity-matrix.trex`
- Create: `extensions/affinity-matrix/affinity-matrix-local.trex`

- [ ] **Step 1.1: Create production manifest**

Create `extensions/affinity-matrix/affinity-matrix.trex`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.affinitymatrix" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Product affinity / co-occurrence matrix with metric toggle (Count / Lift / Support) and diverging color scale, built with D3.js</description>
    <author name="Cyntexa" email="vishwajeet@cyntexa.com" organization="Cyntexa" website="https://cyntexa.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>https://vj-cyntexa.github.io/tableau-viz/extensions/affinity-matrix/index.html</url>
    </source-location>
    <icon/>
    <encoding id="row">
      <display-name resource-id="row_label">Row Product</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="col">
      <display-name resource-id="col_label">Column Product</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="count">
      <display-name resource-id="count_label">Co-purchase Count</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="row_total">
      <display-name resource-id="row_total_label">Row Product Total Purchases</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="col_total">
      <display-name resource-id="col_total_label">Column Product Total Purchases</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="grand_total">
      <display-name resource-id="grand_total_label">Grand Total Transactions (optional)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="0" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Affinity Matrix</text></resource>
    <resource id="row_label"><text locale="en_US">Row Product</text></resource>
    <resource id="col_label"><text locale="en_US">Column Product</text></resource>
    <resource id="count_label"><text locale="en_US">Co-purchase Count</text></resource>
    <resource id="row_total_label"><text locale="en_US">Row Product Total Purchases</text></resource>
    <resource id="col_total_label"><text locale="en_US">Column Product Total Purchases</text></resource>
    <resource id="grand_total_label"><text locale="en_US">Grand Total Transactions (optional)</text></resource>
  </resources>
</manifest>
```

- [ ] **Step 1.2: Create local dev manifest**

Create `extensions/affinity-matrix/affinity-matrix-local.trex`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.affinitymatrix.local" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Product affinity / co-occurrence matrix with metric toggle (Count / Lift / Support) and diverging color scale, built with D3.js (local dev)</description>
    <author name="Cyntexa" email="vishwajeet@cyntexa.com" organization="Cyntexa" website="https://cyntexa.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>http://localhost:8080/extensions/affinity-matrix/index.html</url>
    </source-location>
    <icon/>
    <encoding id="row">
      <display-name resource-id="row_label">Row Product</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="col">
      <display-name resource-id="col_label">Column Product</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="count">
      <display-name resource-id="count_label">Co-purchase Count</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="row_total">
      <display-name resource-id="row_total_label">Row Product Total Purchases</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="col_total">
      <display-name resource-id="col_total_label">Column Product Total Purchases</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="grand_total">
      <display-name resource-id="grand_total_label">Grand Total Transactions (optional)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="0" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Affinity Matrix (local)</text></resource>
    <resource id="row_label"><text locale="en_US">Row Product</text></resource>
    <resource id="col_label"><text locale="en_US">Column Product</text></resource>
    <resource id="count_label"><text locale="en_US">Co-purchase Count</text></resource>
    <resource id="row_total_label"><text locale="en_US">Row Product Total Purchases</text></resource>
    <resource id="col_total_label"><text locale="en_US">Column Product Total Purchases</text></resource>
    <resource id="grand_total_label"><text locale="en_US">Grand Total Transactions (optional)</text></resource>
  </resources>
</manifest>
```

---

## Task 2: HTML Shell (`index.html`)

**File:** Create `extensions/affinity-matrix/index.html`

- [ ] **Step 2.1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Affinity Matrix</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://extensions.tableau.com/lib/tableau.extensions.2.latest.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 13px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Toolbar ── */
    #toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid #e0e0e0;
      background: #fafafa;
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    #toolbar .label {
      font-size: 12px;
      color: #666;
      margin-right: 4px;
    }

    .metric-btn {
      padding: 4px 14px;
      border: 1px solid #bbb;
      border-radius: 4px;
      background: #fff;
      color: #333;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .metric-btn.active {
      background: #1f77b4;
      border-color: #1f77b4;
      color: #fff;
      font-weight: 600;
    }

    .metric-btn:hover:not(.active):not(:disabled) {
      background: #f0f4fa;
      border-color: #1f77b4;
    }

    .metric-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      border-color: #ddd;
      background: #f9f9f9;
      color: #aaa;
    }

    /* ── Table scroll wrapper ── */
    #table-wrapper {
      flex: 1;
      overflow: auto;
      position: relative;
    }

    /* ── Matrix table ── */
    #matrix-table {
      border-collapse: collapse;
      min-width: 100%;
    }

    #matrix-table th,
    #matrix-table td {
      border: 1px solid #e0e0e0;
      padding: 6px 10px;
      white-space: nowrap;
      text-align: right;
      min-width: 88px;
    }

    /* Row header cells (first column) */
    #matrix-table th.row-header,
    #matrix-table td.row-header {
      text-align: left;
      font-weight: 600;
      color: #222;
      background: #f5f5f5;
      position: sticky;
      left: 0;
      z-index: 2;
      min-width: 140px;
      border-right: 2px solid #d0d0d0;
    }

    /* Column header row */
    #matrix-table thead th {
      position: sticky;
      top: 0;
      z-index: 3;
      background: #f5f5f5;
      font-weight: 600;
      color: #222;
      text-align: center;
      border-bottom: 2px solid #d0d0d0;
      cursor: pointer;
      user-select: none;
    }

    /* Top-left corner: sticky on both axes */
    #matrix-table thead th.row-header {
      z-index: 4;
      text-align: left;
      cursor: default;
    }

    /* Sort arrows */
    #matrix-table thead th .sort-arrow {
      display: inline-block;
      margin-left: 4px;
      opacity: 0.4;
      font-size: 10px;
    }

    #matrix-table thead th.sorted-asc  .sort-arrow::after { content: '▲'; opacity: 1; }
    #matrix-table thead th.sorted-desc .sort-arrow::after { content: '▼'; opacity: 1; }
    #matrix-table thead th:not(.sorted-asc):not(.sorted-desc) .sort-arrow::after { content: '⬍'; }

    /* Data cells */
    #matrix-table td.data-cell {
      font-variant-numeric: tabular-nums;
      transition: opacity 0.15s;
      cursor: default;
    }

    #matrix-table td.data-cell:hover {
      outline: 2px solid rgba(0, 0, 0, 0.3);
      outline-offset: -2px;
    }

    /* Diagonal cells */
    #matrix-table td.diagonal-cell {
      background: #e8e8e8 !important;
      color: #888 !important;
      font-style: italic;
    }

    /* ── Tooltip ── */
    #tooltip {
      position: fixed;
      background: rgba(255, 255, 255, 0.97);
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 12px;
      line-height: 1.8;
      pointer-events: none;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
      max-width: 280px;
      z-index: 100;
      display: none;
    }

    #tooltip .tt-title   { font-weight: 700; font-size: 13px; color: #111; margin-bottom: 4px; }
    #tooltip .tt-pair    { color: #555; }
    #tooltip .tt-count   { color: #333; }
    #tooltip .tt-support { color: #6a3d9a; font-weight: 600; }
    #tooltip .tt-lift    { color: #e08214; font-weight: 600; }
    #tooltip .tt-diag    { color: #888; font-style: italic; }

    /* ── Error banner ── */
    #error {
      display: none;
      padding: 10px 16px;
      background: #fff0f0;
      color: #c0392b;
      border-bottom: 1px solid #f5c6c6;
      font-size: 13px;
      flex-shrink: 0;
    }

    #error:not(:empty) { display: block; }

    /* ── Empty state ── */
    #empty-state {
      display: none;
      flex: 1;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 14px;
      text-align: center;
      padding: 40px;
      line-height: 1.8;
    }

    #empty-state.visible { display: flex; }
  </style>
</head>
<body>
  <div id="toolbar">
    <span class="label">Metric:</span>
    <button class="metric-btn active" data-metric="count">Count</button>
    <button class="metric-btn" data-metric="lift">Lift</button>
    <button class="metric-btn" data-metric="support">Support</button>
  </div>
  <div id="error"></div>
  <div id="table-wrapper">
    <table id="matrix-table"></table>
  </div>
  <div id="empty-state">
    Drag a product dimension onto <strong>Row Product</strong> and <strong>Column Product</strong>,<br>
    a co-purchase count onto <strong>Co-purchase Count</strong>,<br>
    and totals onto <strong>Row Product Total Purchases</strong> and <strong>Column Product Total Purchases</strong>.
  </div>
  <div id="tooltip"></div>
  <script src="chart.js"></script>
</body>
</html>
```

---

## Task 3: Chart Logic (`chart.js`)

**File:** Create `extensions/affinity-matrix/chart.js`

This is the full implementation. Read the Critical Design Notes section before editing any part of this file.

- [ ] **Step 3.1: Create chart.js**

```javascript
'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
let currentMetric = 'count';    // 'count' | 'lift' | 'support'
let sortState = { key: null, dir: 'desc' };
// sortState.key: a product name (for symmetric or column-sort), or null
let lastMatrix = null;
// lastMatrix shape defined in buildMatrix() doc comment

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtCount   = d3.format(',.0f');
const fmtSupport = d3.format('.2%');
const fmtLift    = d3.format('.2f');

function formatMetric(value, metric) {
  if (metric === 'count')   return fmtCount(value);
  if (metric === 'support') return fmtSupport(value);
  if (metric === 'lift')    return fmtLift(value);
  return String(value);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => setError(err.message || String(err)));

// ─── Metric toggle ────────────────────────────────────────────────────────────
document.querySelectorAll('.metric-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    currentMetric = btn.dataset.metric;
    document.querySelectorAll('.metric-btn').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    if (lastMatrix) drawTable(lastMatrix);
  });
});

// ─── Render pipeline ──────────────────────────────────────────────────────────
async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    const matrix = buildMatrix(dataTable, vizSpec);
    lastMatrix = matrix;
    updateToolbarState(matrix.hasGrandTotal);
    drawTable(matrix);
  } catch (err) {
    setError(err.message || String(err));
  }
}

async function fetchData(worksheet) {
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
  const table  = await reader.getAllPagesAsync();
  await reader.releaseAsync();
  return table;
}

// ─── Toolbar state: disable Lift/Support when grand_total is missing ──────────
function updateToolbarState(hasGrandTotal) {
  document.querySelectorAll('.metric-btn').forEach(btn => {
    const metric = btn.dataset.metric;
    if (metric === 'count') {
      btn.disabled = false;
      btn.title = '';
    } else {
      btn.disabled = !hasGrandTotal;
      btn.title = hasGrandTotal
        ? ''
        : 'Drag a Grand Total Transactions measure onto the encoding slot to enable this metric';
    }
  });
  // If current metric is disabled, fall back to count
  if (!hasGrandTotal && (currentMetric === 'lift' || currentMetric === 'support')) {
    currentMetric = 'count';
    document.querySelectorAll('.metric-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.metric === 'count')
    );
  }
}

// ─── Data: parse ──────────────────────────────────────────────────────────────
// Returns matrix object:
// {
//   products:     string[]               — union of all row and col keys, sorted
//   rowKeys:      string[]               — unique row dimension values (sorted initially)
//   colKeys:      string[]               — unique col dimension values (sorted initially)
//   matrix:       Map<rowKey, Map<colKey, { count, rowTotal, colTotal }>>
//   rowTotals:    Map<rowKey, number>    — total purchases of each row product
//   colTotals:    Map<colKey, number>    — total purchases of each col product
//   grandTotal:   number | null          — null if encoding not populated
//   hasGrandTotal: boolean
//   maxCount:     number
//   isSymmetric:  boolean               — rowField === colField
//   rowField:     string
//   colField:     string
// }
function buildMatrix(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(encId) {
    const enc = encodings.find(e => e.id === encId);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const rowField        = fieldName('row');
  const colField        = fieldName('col');
  const countField      = fieldName('count');
  const rowTotalField   = fieldName('row_total');
  const colTotalField   = fieldName('col_total');
  const grandTotalField = fieldName('grand_total');  // may be null

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!rowField || !(rowField in colIndex))
    throw new Error('Drag a product dimension onto the "Row Product" encoding slot.');
  if (!colField || !(colField in colIndex))
    throw new Error('Drag a product dimension onto the "Column Product" encoding slot.');
  if (!countField || !(countField in colIndex))
    throw new Error('Drag a co-purchase count measure onto the "Co-purchase Count" encoding slot.');
  if (!rowTotalField || !(rowTotalField in colIndex))
    throw new Error('Drag a measure onto the "Row Product Total Purchases" encoding slot.');
  if (!colTotalField || !(colTotalField in colIndex))
    throw new Error('Drag a measure onto the "Column Product Total Purchases" encoding slot.');

  const ri  = colIndex[rowField];
  const ci  = colIndex[colField];
  const cni = colIndex[countField];
  const rti = colIndex[rowTotalField];
  const cti = colIndex[colTotalField];
  const gti = grandTotalField && (grandTotalField in colIndex)
    ? colIndex[grandTotalField]
    : null;

  const matrix    = new Map();  // rowKey → Map<colKey, { count, rowTotal, colTotal }>
  const rowTotals = new Map();
  const colTotals = new Map();
  let grandTotal  = null;
  let maxCount    = 0;

  for (const row of dataTable.data) {
    const rk    = String(row[ri].value ?? '');
    const ck    = String(row[ci].value ?? '');
    const count = Number(row[cni].value);
    if (Number.isNaN(count)) continue;

    // Set row/col totals on FIRST encounter (they repeat for every row, not cumulative)
    if (!rowTotals.has(rk)) rowTotals.set(rk, Number(row[rti].value));
    if (!colTotals.has(ck)) colTotals.set(ck, Number(row[cti].value));
    if (grandTotal === null && gti !== null) grandTotal = Number(row[gti].value);

    if (!matrix.has(rk)) matrix.set(rk, new Map());
    matrix.get(rk).set(ck, {
      count,
      rowTotal: Number(row[rti].value),
      colTotal: Number(row[cti].value),
    });

    if (count > maxCount) maxCount = count;
  }

  if (!matrix.size) throw new Error('No valid data rows found. Check field types on the encoding slots.');

  const rowKeys = [...matrix.keys()].sort();
  const colKeys = [...new Set([...matrix.values()].flatMap(m => [...m.keys()]))].sort();

  const isSymmetric = rowField === colField;

  return {
    rowKeys,
    colKeys,
    matrix,
    rowTotals,
    colTotals,
    grandTotal,
    hasGrandTotal: grandTotal !== null,
    maxCount,
    isSymmetric,
    rowField,
    colField,
  };
}

// ─── Metric calculation ───────────────────────────────────────────────────────
function computeMetricValue(cell, grandTotal, metric) {
  // cell: { count, rowTotal, colTotal }
  if (!cell) return 0;
  const { count, rowTotal, colTotal } = cell;

  if (metric === 'count') return count;

  if (metric === 'support') {
    if (!grandTotal) return 0;
    return count / grandTotal;
  }

  if (metric === 'lift') {
    if (!grandTotal || !rowTotal || !colTotal) return 0;
    // lift = (count / grand) / ((rowTotal / grand) * (colTotal / grand))
    //      = count * grand / (rowTotal * colTotal)
    return (count * grandTotal) / (rowTotal * colTotal);
  }

  return 0;
}

// ─── Color scales ─────────────────────────────────────────────────────────────
// Count/Support: sequential Blues — 0 to max
function makeCountScale(maxVal) {
  return d3.scaleSequential(d3.interpolateBlues).domain([0, maxVal || 1]);
}

function makeSupportScale(grandTotal) {
  return d3.scaleSequential(d3.interpolateBlues).domain([0, grandTotal ? 1 : 1]);
}

// Lift: diverging PuOr — 0 (purple/avoidance) → 1 (neutral/white) → 2+ (orange/affinity)
function makeLiftScale() {
  return d3.scaleDiverging(d3.interpolatePuOr).domain([0, 1, 2]);
}

// Relative luminance (sRGB) — used to decide text colour
function luminance(hexOrRgb) {
  const c = d3.color(hexOrRgb);
  if (!c) return 1;
  const { r, g, b } = c.rgb();
  const toLinear = v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// ─── Sorting ──────────────────────────────────────────────────────────────────
// For symmetric mode: sort both axes by affinity with the clicked product.
// For asymmetric mode: sort rowKeys by clicked colKey.
function sortedKeys(matrix, sortKey, dir) {
  const { rowKeys, colKeys, matrix: m, rowTotals, grandTotal } = matrix;

  function metricFor(rk, ck) {
    const cell = m.get(rk)?.get(ck);
    return computeMetricValue(cell, grandTotal, currentMetric);
  }

  const sortedRows = [...rowKeys].sort((a, b) => {
    const va = metricFor(a, sortKey);
    const vb = metricFor(b, sortKey);
    return dir === 'asc' ? va - vb : vb - va;
  });

  if (matrix.isSymmetric) {
    // Sort colKeys in the same order as rows so the diagonal stays diagonal
    const orderMap = new Map(sortedRows.map((k, i) => [k, i]));
    const sortedCols = [...colKeys].sort((a, b) => {
      const ia = orderMap.has(a) ? orderMap.get(a) : Infinity;
      const ib = orderMap.has(b) ? orderMap.get(b) : Infinity;
      return ia - ib;
    });
    return { sortedRows, sortedCols };
  }

  return { sortedRows, sortedCols: colKeys };
}

// ─── Draw table ───────────────────────────────────────────────────────────────
function drawTable(matrix) {
  const { rowTotals, colTotals, grandTotal, rowField, colField, maxCount, isSymmetric } = matrix;

  showEmptyState(false);
  const table = document.getElementById('matrix-table');
  table.innerHTML = '';

  // Determine row/col order
  let displayRows = matrix.rowKeys;
  let displayCols = matrix.colKeys;

  if (sortState.key) {
    const { sortedRows, sortedCols } = sortedKeys(matrix, sortState.key, sortState.dir);
    displayRows = sortedRows;
    displayCols = sortedCols;
  }

  // Build color scales for this render
  const maxMetricVal = computeMaxMetricVal(matrix, displayRows, displayCols);
  const colorScale = buildColorScale(maxMetricVal, grandTotal);

  // ── thead ─────────────────────────────────────────────────────────────────
  const thead   = table.createTHead();
  const headRow = thead.insertRow();

  // Corner
  const cornerTh = document.createElement('th');
  cornerTh.className = 'row-header';
  cornerTh.textContent = isSymmetric
    ? rowField
    : `${rowField} \\ ${colField}`;
  headRow.appendChild(cornerTh);

  // Column headers
  for (const ck of displayCols) {
    const th = document.createElement('th');
    th.dataset.col = ck;

    const arrow = document.createElement('span');
    arrow.className = 'sort-arrow';
    th.textContent = ck;
    th.appendChild(arrow);

    if (sortState.key === ck) th.classList.add(`sorted-${sortState.dir}`);

    th.addEventListener('click', () => onSortClick(matrix, ck));
    headRow.appendChild(th);
  }

  // ── tbody ─────────────────────────────────────────────────────────────────
  const tbody = table.createTBody();

  for (const rk of displayRows) {
    const tr = tbody.insertRow();

    // Row header
    const rowTh = document.createElement('td');
    rowTh.className = 'row-header';
    rowTh.textContent = rk;
    tr.appendChild(rowTh);

    // Data cells
    for (const ck of displayCols) {
      const cell    = matrix.matrix.get(rk)?.get(ck);
      const val     = computeMetricValue(cell, grandTotal, currentMetric);
      const isDiag  = isSymmetric && rk === ck;
      const td      = tr.insertCell();

      td.className = 'data-cell';
      if (isDiag) td.classList.add('diagonal-cell');

      td.dataset.row = rk;
      td.dataset.col = ck;

      if (!isDiag) {
        const bg = colorScale(currentMetric === 'lift'
          ? Math.min(val, 2)   // clamp lift to [0, 2] for color
          : val
        );
        td.style.backgroundColor = bg;
        td.style.color = luminance(bg) > 0.35 ? '#111' : '#ffffff';
        td.textContent = cell ? formatMetric(val, currentMetric) : '—';
      } else {
        td.textContent = cell ? fmtCount(cell.count) : '—';
        // diagonal-cell CSS handles grey/italic
      }

      attachTooltip(td, rk, ck, cell, grandTotal, isDiag);
    }
  }
}

// ─── Max metric value (for color domain) ─────────────────────────────────────
function computeMaxMetricVal(matrix, displayRows, displayCols) {
  const { matrix: m, grandTotal, isSymmetric } = matrix;
  let max = 0;
  for (const rk of displayRows) {
    for (const ck of displayCols) {
      if (isSymmetric && rk === ck) continue;  // skip diagonal for scale
      const cell = m.get(rk)?.get(ck);
      if (!cell) continue;
      const val = computeMetricValue(cell, grandTotal, currentMetric);
      if (val > max) max = val;
    }
  }
  return max || 1;
}

// ─── Build color scale for current metric ─────────────────────────────────────
function buildColorScale(maxVal, grandTotal) {
  if (currentMetric === 'lift') {
    return makeLiftScale();  // domain is fixed [0, 1, 2]
  }
  if (currentMetric === 'support') {
    return makeCountScale(maxVal);  // support is already a fraction 0-1
  }
  return makeCountScale(maxVal);  // count
}

// ─── Sort handler ─────────────────────────────────────────────────────────────
function onSortClick(matrix, col) {
  if (sortState.key === col) {
    sortState.dir = sortState.dir === 'desc' ? 'asc' : 'desc';
  } else {
    sortState.key = col;
    sortState.dir = 'desc';
  }
  drawTable(matrix);
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function attachTooltip(td, rk, ck, cell, grandTotal, isDiag) {
  const tooltip = document.getElementById('tooltip');

  td.addEventListener('mouseenter', evt => {
    if (isDiag) {
      tooltip.innerHTML = `
        <div class="tt-title">${rk}</div>
        <div class="tt-diag">Self-affinity (diagonal)</div>
        ${cell ? `<div class="tt-count">Total purchases: ${fmtCount(cell.count)}</div>` : ''}
      `;
    } else if (cell) {
      const supportStr = grandTotal
        ? `<div class="tt-support">Support: ${fmtSupport(cell.count / grandTotal)}</div>`
        : '<div class="tt-support">Support: n/a (no grand total)</div>';

      const liftVal = (grandTotal && cell.rowTotal && cell.colTotal)
        ? (cell.count * grandTotal) / (cell.rowTotal * cell.colTotal)
        : null;
      const liftStr = liftVal !== null
        ? `<div class="tt-lift">Lift: ${fmtLift(liftVal)}</div>`
        : '<div class="tt-lift">Lift: n/a (no grand total)</div>';

      tooltip.innerHTML = `
        <div class="tt-title">${rk} + ${ck}</div>
        <div class="tt-pair">Co-purchases: ${fmtCount(cell.count)}</div>
        ${supportStr}
        ${liftStr}
      `;
    } else {
      tooltip.innerHTML = `
        <div class="tt-title">${rk} + ${ck}</div>
        <div class="tt-pair">No data</div>
      `;
    }
    tooltip.style.display = 'block';
    positionTooltip(evt);
  });

  td.addEventListener('mousemove', positionTooltip);
  td.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
}

function positionTooltip(evt) {
  const tooltip = document.getElementById('tooltip');
  const margin  = 12;
  let x = evt.clientX + margin;
  let y = evt.clientY + margin;
  if (x + 290 > window.innerWidth)  x = evt.clientX - 290 - margin;
  if (y + 160 > window.innerHeight) y = evt.clientY - 160 - margin;
  tooltip.style.left = `${x}px`;
  tooltip.style.top  = `${y}px`;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showEmptyState(visible) {
  const el = document.getElementById('empty-state');
  if (el) el.classList.toggle('visible', visible);
  const tw = document.getElementById('table-wrapper');
  if (tw) tw.style.display = visible ? 'none' : '';
}

function setError(msg) {
  const el = document.getElementById('error');
  if (el) el.textContent = msg;
  showEmptyState(false);
}

function clearError() {
  const el = document.getElementById('error');
  if (el) el.textContent = '';
}
```

---

## Task 4: Test Page (`test.html`)

**File:** Create `extensions/affinity-matrix/test.html`

The mock data represents a symmetric 5×5 co-purchase matrix for coffee-shop products. All 25 ordered pairs are present (including diagonals). Each row includes `row_total`, `col_total`, and `grand_total` — matching what a real Tableau LOD calculation would produce.

Products: Espresso, Latte, Muffin, Croissant, Sandwich
- Total transactions: 10,000
- Product totals: Espresso=4200, Latte=3800, Muffin=2100, Croissant=1800, Sandwich=1500
- Co-purchase counts (symmetric): see MOCK_PAIRS below

For diagonal cells, `count = row_total` (product appears in its own transactions).

- [ ] **Step 4.1: Create test.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Affinity Matrix — Browser Test</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      padding: 16px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    h2 {
      font-size: 13px;
      color: #666;
      flex-shrink: 0;
    }
    #frame-wrapper {
      flex: 1;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    /* ── Replicate index.html styles inline ── */
    #toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid #e0e0e0;
      background: #fafafa;
      flex-shrink: 0;
    }
    #toolbar .label { font-size: 12px; color: #666; margin-right: 4px; }
    .metric-btn {
      padding: 4px 14px;
      border: 1px solid #bbb;
      border-radius: 4px;
      background: #fff;
      color: #333;
      font-size: 12px;
      cursor: pointer;
      transition: background .15s, color .15s, border-color .15s;
    }
    .metric-btn.active { background: #1f77b4; border-color: #1f77b4; color: #fff; font-weight: 600; }
    .metric-btn:hover:not(.active):not(:disabled) { background: #f0f4fa; border-color: #1f77b4; }
    .metric-btn:disabled { opacity: .4; cursor: not-allowed; border-color: #ddd; background: #f9f9f9; color: #aaa; }
    #table-wrapper { flex: 1; overflow: auto; position: relative; }
    #matrix-table { border-collapse: collapse; min-width: 100%; font-size: 13px; }
    #matrix-table th, #matrix-table td {
      border: 1px solid #e0e0e0;
      padding: 6px 10px;
      white-space: nowrap;
      text-align: right;
      min-width: 88px;
    }
    #matrix-table th.row-header, #matrix-table td.row-header {
      text-align: left;
      font-weight: 600;
      color: #222;
      background: #f5f5f5;
      position: sticky;
      left: 0;
      z-index: 2;
      min-width: 140px;
      border-right: 2px solid #d0d0d0;
    }
    #matrix-table thead th {
      position: sticky;
      top: 0;
      z-index: 3;
      background: #f5f5f5;
      font-weight: 600;
      color: #222;
      text-align: center;
      border-bottom: 2px solid #d0d0d0;
      cursor: pointer;
      user-select: none;
    }
    #matrix-table thead th.row-header { z-index: 4; text-align: left; cursor: default; }
    .sort-arrow { display: inline-block; margin-left: 4px; opacity: .4; font-size: 10px; }
    th.sorted-asc .sort-arrow::after  { content: '▲'; opacity: 1; }
    th.sorted-desc .sort-arrow::after { content: '▼'; opacity: 1; }
    th:not(.sorted-asc):not(.sorted-desc) .sort-arrow::after { content: '⬍'; }
    #matrix-table td.data-cell { font-variant-numeric: tabular-nums; cursor: default; }
    #matrix-table td.data-cell:hover { outline: 2px solid rgba(0,0,0,.3); outline-offset: -2px; }
    #matrix-table td.diagonal-cell { background: #e8e8e8 !important; color: #888 !important; font-style: italic; }
    #tooltip {
      position: fixed;
      background: rgba(255,255,255,.97);
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 12px;
      line-height: 1.8;
      pointer-events: none;
      box-shadow: 0 4px 14px rgba(0,0,0,.12);
      max-width: 280px;
      z-index: 100;
      display: none;
    }
    #tooltip .tt-title   { font-weight: 700; font-size: 13px; color: #111; margin-bottom: 4px; }
    #tooltip .tt-pair    { color: #555; }
    #tooltip .tt-count   { color: #333; }
    #tooltip .tt-support { color: #6a3d9a; font-weight: 600; }
    #tooltip .tt-lift    { color: #e08214; font-weight: 600; }
    #tooltip .tt-diag    { color: #888; font-style: italic; }
    #error { display: none; padding: 10px 16px; background: #fff0f0; color: #c0392b; font-size: 13px; }
    #error:not(:empty) { display: block; }
    #empty-state { display: none; }
  </style>
</head>
<body>
  <h2>Affinity Matrix — Browser Test (no Tableau required) | Products: Espresso, Latte, Muffin, Croissant, Sandwich | 10,000 transactions</h2>
  <div id="frame-wrapper">
    <div id="toolbar">
      <span class="label">Metric:</span>
      <button class="metric-btn active" data-metric="count">Count</button>
      <button class="metric-btn" data-metric="lift">Lift</button>
      <button class="metric-btn" data-metric="support">Support</button>
    </div>
    <div id="error"></div>
    <div id="table-wrapper">
      <table id="matrix-table"></table>
    </div>
    <div id="empty-state"></div>
  </div>
  <div id="tooltip"></div>

  <script>
  // ─── Mock data: 5 coffee-shop products, symmetric co-purchase matrix ─────────
  //
  // Products and their total purchase counts (out of 10,000 transactions):
  //   Espresso:  4,200
  //   Latte:     3,800
  //   Muffin:    2,100
  //   Croissant: 1,800
  //   Sandwich:  1,500
  //
  // Co-purchase counts (A+B appears in the same transaction):
  //   Espresso + Latte:     1,800  (high affinity)
  //   Espresso + Muffin:      950
  //   Espresso + Croissant:   600
  //   Espresso + Sandwich:    380
  //   Latte + Muffin:       1,100  (high affinity)
  //   Latte + Croissant:      720
  //   Latte + Sandwich:       290
  //   Muffin + Croissant:     680
  //   Muffin + Sandwich:      210
  //   Croissant + Sandwich:   180
  //
  // Diagonal (A + A) = rowTotal for that product (shown grey in chart)

  const PRODUCTS = ['Espresso', 'Latte', 'Muffin', 'Croissant', 'Sandwich'];
  const TOTALS = {
    Espresso:  4200,
    Latte:     3800,
    Muffin:    2100,
    Croissant: 1800,
    Sandwich:  1500,
  };
  const GRAND_TOTAL = 10000;

  // Symmetric co-purchase counts (off-diagonal only)
  const PAIRS = {
    'Espresso:Latte':      1800,
    'Espresso:Muffin':      950,
    'Espresso:Croissant':   600,
    'Espresso:Sandwich':    380,
    'Latte:Muffin':        1100,
    'Latte:Croissant':      720,
    'Latte:Sandwich':       290,
    'Muffin:Croissant':     680,
    'Muffin:Sandwich':      210,
    'Croissant:Sandwich':   180,
  };

  function getPairCount(a, b) {
    if (a === b) return TOTALS[a];  // diagonal = self-total
    const key = PAIRS[`${a}:${b}`] !== undefined ? `${a}:${b}` : `${b}:${a}`;
    return PAIRS[key] ?? 0;
  }

  // Build flat rows: one per (row_product, col_product) ordered pair
  // Columns: Product (row), Product (col), Co-purchase Count, Row Total, Col Total, Grand Total
  const MOCK_ROWS = [];
  for (const rowProd of PRODUCTS) {
    for (const colProd of PRODUCTS) {
      MOCK_ROWS.push([
        rowProd,
        colProd,
        getPairCount(rowProd, colProd),
        TOTALS[rowProd],
        TOTALS[colProd],
        GRAND_TOTAL,
      ]);
    }
  }

  // Tableau DataTable shape
  const MOCK_DATA_TABLE = {
    columns: [
      { fieldName: 'Product',       index: 0 },
      { fieldName: 'Product (col)', index: 1 },
      { fieldName: 'Co-purchases',  index: 2 },
      { fieldName: 'Row Total',     index: 3 },
      { fieldName: 'Col Total',     index: 4 },
      { fieldName: 'Grand Total',   index: 5 },
    ],
    data: MOCK_ROWS.map(r => r.map(v => ({ value: v }))),
  };

  // VizSpec: both row and col use the same field name ("Product") — this triggers isSymmetric = true
  const MOCK_VIZ_SPEC = {
    marksSpecificationCollection: [{
      encodingCollection: [
        { id: 'row',         fieldCollection: [{ fieldName: 'Product' }] },
        { id: 'col',         fieldCollection: [{ fieldName: 'Product' }] },
        { id: 'count',       fieldCollection: [{ fieldName: 'Co-purchases' }] },
        { id: 'row_total',   fieldCollection: [{ fieldName: 'Row Total' }] },
        { id: 'col_total',   fieldCollection: [{ fieldName: 'Col Total' }] },
        { id: 'grand_total', fieldCollection: [{ fieldName: 'Grand Total' }] },
      ],
    }],
  };

  // Mock Tableau Extensions API
  window.tableau = {
    TableauEventType: { SummaryDataChanged: 'summary-data-changed' },
    extensions: {
      initializeAsync: async () => {},
      worksheetContent: {
        worksheet: {
          addEventListener: () => {},
          getVisualSpecificationAsync: async () => MOCK_VIZ_SPEC,
          getSummaryDataReaderAsync: async () => ({
            getAllPagesAsync: async () => MOCK_DATA_TABLE,
            releaseAsync: async () => {},
          }),
        },
      },
    },
  };
  </script>

  <!-- Load chart logic after mock is defined -->
  <script src="chart.js"></script>
</body>
</html>
```

---

## Task 5: README

**File:** Create `extensions/affinity-matrix/README.md`

- [ ] **Step 5.1: Create README.md**

```markdown
# Affinity Matrix — Tableau Viz Extension

A D3 v7 Tableau Viz Extension that renders a product affinity / co-occurrence matrix. Shows which products are bought together, with metric toggle (Count / Lift / Support), a diverging color scale for Lift, diagonal highlighting, and sortable axes.

## Live URLs

| File | URL |
|---|---|
| Extension | `https://vj-cyntexa.github.io/tableau-viz/extensions/affinity-matrix/index.html` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/affinity-matrix/test.html` |

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `row` | Discrete dimension | Yes | Product field for row labels |
| `col` | Discrete dimension | Yes | Product field for column headers. Use the same field as `row` for a symmetric matrix |
| `count` | Continuous measure | Yes | Co-purchase count: how many transactions contain both products |
| `row_total` | Continuous measure | Yes | LOD calc: total purchases of the row product |
| `col_total` | Continuous measure | Yes | LOD calc: total purchases of the column product |
| `grand_total` | Continuous measure | No | LOD calc: total transactions. Required for Lift and Support metrics |

## Metrics

| Metric | Formula | Color Scale |
|---|---|---|
| Count | Raw co-purchase count | Sequential Blues (0 → max) |
| Support | `count / grand_total` | Sequential Blues (0 → max) |
| Lift | `count × grand_total / (row_total × col_total)` | Diverging PuOr: purple (<1 = avoidance), white (=1 = neutral), orange (>1 = affinity) |

**Lift interpretation:**
- `< 1` — products are bought together less often than chance (avoidance)
- `= 1` — no association
- `> 1` — products are bought together more often than chance (affinity)
- Color scale clamps at 2.0; true value still shown in cell and tooltip

## Features

- Symmetric mode auto-detected when row and col use the same field
- Click a column header to sort both axes by affinity with that product (symmetric mode keeps diagonal on diagonal)
- Grey diagonal cells with italic self-total
- Tooltip shows Count, Support, and Lift for every non-diagonal cell
- Lift and Support buttons disabled when `grand_total` encoding is empty, with explanatory tooltip
- Sticky row headers and column headers for large matrices

## What is NOT configurable from Tableau's UI

- Color palette (hardcoded: Blues for Count/Support, PuOr for Lift)
- Cell text format (auto-selected per metric)
- Lift color domain (fixed 0–1–2)

## File Descriptions

| File | Description |
|---|---|
| `affinity-matrix.trex` | Production manifest pointing to GitHub Pages |
| `affinity-matrix-local.trex` | Dev manifest pointing to localhost:8080 |
| `index.html` | Extension shell with toolbar, styles, and empty state |
| `chart.js` | All D3 rendering, Tableau API integration, metric logic |
| `test.html` | Standalone browser test — 5×5 coffee-shop products, no Tableau required |

## Dev Workflow

```bash
# 1. Start local server from repo root
python3 -m http.server 8080

# 2. Open test page (no Tableau required)
open http://localhost:8080/extensions/affinity-matrix/test.html

# 3. Load in Tableau Desktop
# Marks card → Viz Extensions → Access Local Extensions → affinity-matrix-local.trex
```

## Tableau Cloud Allowlist

Add `https://vj-cyntexa.github.io` to the site's allowlist under Settings → Extensions.

## Setting Up the Data in Tableau

Create a calculated field datasource with these LOD expressions:

```
// Co-purchase count (row A, col B — from a flat transactions table):
{ FIXED [Row Product], [Col Product] : COUNT([Transaction ID]) }

// Row product total:
{ FIXED [Row Product] : COUNT(DISTINCT [Transaction ID]) }

// Col product total:
{ FIXED [Col Product] : COUNT(DISTINCT [Transaction ID]) }

// Grand total:
{ FIXED : COUNT(DISTINCT [Transaction ID]) }
```

Drag each to its respective encoding slot. The extension handles all metric calculation internally.

## Author

Cyntexa — vishwajeet@cyntexa.com
```

---

## Task 6: Push and Verify

- [ ] **Step 6.1: Stage and commit all new files**

```bash
cd /Users/vj/Office/Projects/vj-random-research-and-task/tableau-viz
git config core.sshCommand "ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes"
git add extensions/affinity-matrix/affinity-matrix.trex \
        extensions/affinity-matrix/affinity-matrix-local.trex \
        extensions/affinity-matrix/index.html \
        extensions/affinity-matrix/chart.js \
        extensions/affinity-matrix/test.html \
        extensions/affinity-matrix/README.md \
        CLAUDE.md \
        docs/superpowers/plans/2026-04-21-affinity-matrix.md
git commit -m "feat(affinity-matrix): add product affinity / co-occurrence matrix viz extension"
```

- [ ] **Step 6.2: Pull and push**

```bash
git pull --rebase origin master && git push origin master
```

- [ ] **Step 6.3: Verify GitHub Pages deployment**

Open in browser (GitHub Pages deploys within ~60 seconds of push):

```
https://vj-cyntexa.github.io/tableau-viz/extensions/affinity-matrix/test.html
```

Expected: 5×5 matrix loads immediately with Count metric active. Lift/Support buttons work. Clicking any column header sorts both axes. Diagonal cells are grey/italic.

- [ ] **Step 6.4: Verify in Tableau Desktop (optional, requires Tableau Desktop)**

1. Open Tableau Desktop, open any workbook with product transaction data
2. Add a calculated sheet with the LOD expressions from the README
3. Marks card → Viz Extensions → Access Local Extensions → `extensions/affinity-matrix/affinity-matrix-local.trex`
4. Drag fields to encoding slots
5. Verify all three metrics render correctly
```
