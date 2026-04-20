# Relationship Table Viz Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` syntax. Update to `- [x]` as each step completes.

**Goal:** Build and deploy a Tableau Viz Extension that renders a D3.js v7 relationship matrix table — a scrollable HTML grid where rows are one dimension, columns are another, and cells show a numeric measure with heatmap or ranked-text coloring.

**Architecture:** A pure HTML/JS extension (no build step) served from GitHub Pages. The extension registers three encoding slots (`row`, `column`, `value`) in its `.trex` manifest, reads live data from Tableau's Extensions API, pivots it into a 2D matrix in JavaScript, and renders it as an HTML `<table>` with D3 color scales. A `test.html` page mocks the full Tableau API (customer segment × product category, 4 × 5, realistic revenue values) so the table can be developed and verified in any browser without Tableau Desktop. Two display modes — **Heatmap** and **Table** — are toggled by buttons in the toolbar.

**Tech Stack:** D3.js v7, Tableau Extensions API 2.x, vanilla JS, GitHub Pages

---

## File Map

| Path | Role |
|---|---|
| `extensions/relationship-table/relationship-table.trex` | Production manifest (GitHub Pages URL) |
| `extensions/relationship-table/relationship-table-local.trex` | Dev manifest (localhost:8080 URL) |
| `extensions/relationship-table/index.html` | Extension shell loaded by Tableau in an iframe |
| `extensions/relationship-table/chart.js` | All D3 rendering + Tableau API integration |
| `extensions/relationship-table/test.html` | Standalone browser test — mocks Tableau API with 4 segments × 5 categories |
| `extensions/relationship-table/README.md` | Extension docs |

---

## Progress Tracker

- [x] Task 1 — TREX Manifests
- [x] Task 2 — HTML Shell (`index.html`)
- [x] Task 3 — Chart Logic (`chart.js`)
- [x] Task 4 — Test Page (`test.html`)
- [ ] Task 5 — README
- [ ] Task 6 — Push and verify

---

## Task 1: TREX Manifests

**Files:**
- Create: `extensions/relationship-table/relationship-table.trex`
- Create: `extensions/relationship-table/relationship-table-local.trex`

- [x] **Step 1.1: Create production manifest**

Create `extensions/relationship-table/relationship-table.trex`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.relationshiptable" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Relationship matrix table with heatmap coloring built with D3.js</description>
    <author name="Cyntexa" email="vishwajeet@cyntexa.com" organization="Cyntexa" website="https://cyntexa.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>https://vj-cyntexa.github.io/tableau-viz/extensions/relationship-table/index.html</url>
    </source-location>
    <icon/>
    <encoding id="row">
      <display-name resource-id="row_label">Row Dimension</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="column">
      <display-name resource-id="col_label">Column Dimension</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="value">
      <display-name resource-id="val_label">Value (Measure)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Relationship Table</text></resource>
    <resource id="row_label"><text locale="en_US">Row Dimension</text></resource>
    <resource id="col_label"><text locale="en_US">Column Dimension</text></resource>
    <resource id="val_label"><text locale="en_US">Value (Measure)</text></resource>
  </resources>
</manifest>
```

- [x] **Step 1.2: Create local dev manifest**

Create `extensions/relationship-table/relationship-table-local.trex` — identical to above except the `<worksheet-extension id>` and `<url>`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.relationshiptable.local" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Relationship matrix table with heatmap coloring built with D3.js (local dev)</description>
    <author name="Cyntexa" email="vishwajeet@cyntexa.com" organization="Cyntexa" website="https://cyntexa.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>http://localhost:8080/extensions/relationship-table/index.html</url>
    </source-location>
    <icon/>
    <encoding id="row">
      <display-name resource-id="row_label">Row Dimension</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="column">
      <display-name resource-id="col_label">Column Dimension</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="value">
      <display-name resource-id="val_label">Value (Measure)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Relationship Table (local)</text></resource>
    <resource id="row_label"><text locale="en_US">Row Dimension</text></resource>
    <resource id="col_label"><text locale="en_US">Column Dimension</text></resource>
    <resource id="val_label"><text locale="en_US">Value (Measure)</text></resource>
  </resources>
</manifest>
```

- [x] **Step 1.3: Commit**

```bash
git add extensions/relationship-table/relationship-table.trex extensions/relationship-table/relationship-table-local.trex
git commit -m "feat: add .trex manifests for relationship-table viz extension"
```

---

## Task 2: HTML Shell (`index.html`)

**Files:**
- Create: `extensions/relationship-table/index.html`

- [x] **Step 2.1: Write index.html**

Create `extensions/relationship-table/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Relationship Table</title>
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
    }

    #toolbar span {
      font-size: 12px;
      color: #666;
      margin-right: 4px;
    }

    .mode-btn {
      padding: 4px 14px;
      border: 1px solid #bbb;
      border-radius: 4px;
      background: #fff;
      color: #333;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .mode-btn.active {
      background: #1f77b4;
      border-color: #1f77b4;
      color: #fff;
      font-weight: 600;
    }

    .mode-btn:hover:not(.active) {
      background: #f0f4fa;
      border-color: #1f77b4;
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
      min-width: 80px;
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

    /* Column header row (first row) */
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

    /* Top-left corner header: sticky on both axes */
    #matrix-table thead th.row-header {
      z-index: 4;
      text-align: left;
      cursor: default;
    }

    /* Sort indicator */
    #matrix-table thead th .sort-arrow {
      display: inline-block;
      margin-left: 4px;
      opacity: 0.4;
      font-size: 10px;
    }

    #matrix-table thead th.sorted-asc .sort-arrow::after  { content: '▲'; opacity: 1; }
    #matrix-table thead th.sorted-desc .sort-arrow::after { content: '▼'; opacity: 1; }
    #matrix-table thead th:not(.sorted-asc):not(.sorted-desc) .sort-arrow::after { content: '⬍'; }

    /* Data cells */
    #matrix-table td.data-cell {
      font-variant-numeric: tabular-nums;
      transition: opacity 0.15s;
      cursor: default;
    }

    #matrix-table td.data-cell:hover {
      outline: 2px solid #1f77b4;
      outline-offset: -2px;
    }

    /* Total cells */
    #matrix-table td.total-cell,
    #matrix-table th.total-header {
      font-weight: 700;
      background: #eef2f7 !important;
      color: #1a3a5c !important;
      border-left: 2px solid #d0d0d0;
    }

    /* Totals row */
    #matrix-table tfoot tr {
      border-top: 2px solid #d0d0d0;
    }

    #matrix-table tfoot td {
      font-weight: 700;
      background: #eef2f7;
      color: #1a3a5c;
    }

    /* ── Heatmap mode: cell color set via inline style ── */
    /* ── Table mode: white background, colored text ── */
    body.mode-table #matrix-table td.data-cell {
      background: #ffffff !important;
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
      max-width: 260px;
      z-index: 100;
      display: none;
    }

    #tooltip .tt-title {
      font-weight: 700;
      font-size: 13px;
      color: #111;
      margin-bottom: 4px;
    }

    #tooltip .tt-row  { color: #555; }
    #tooltip .tt-col  { color: #555; }
    #tooltip .tt-val  { color: #1f77b4; font-weight: 600; font-size: 14px; }

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
<body class="mode-heatmap">
  <div id="toolbar">
    <span>Display mode:</span>
    <button class="mode-btn active" data-mode="heatmap">Heatmap</button>
    <button class="mode-btn" data-mode="table">Table</button>
  </div>
  <div id="error"></div>
  <div id="table-wrapper">
    <table id="matrix-table"></table>
  </div>
  <div id="empty-state">
    Drag a dimension onto <strong>Row</strong>, another onto <strong>Column</strong>,<br>
    and a measure onto <strong>Value</strong> to see the matrix.
  </div>
  <div id="tooltip"></div>
  <script src="chart.js"></script>
</body>
</html>
```

- [x] **Step 2.2: Commit**

```bash
git add extensions/relationship-table/index.html
git commit -m "feat: add html shell for relationship-table extension"
```

---

## Task 3: Chart Logic (`chart.js`)

**Files:**
- Create: `extensions/relationship-table/chart.js`

- [x] **Step 3.1: Write chart.js**

Create `extensions/relationship-table/chart.js`:

```javascript
'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
let currentMode = 'heatmap';   // 'heatmap' | 'table'
let sortState   = { col: null, dir: 'desc' };  // col = column key or 'total'
let lastMatrix  = null;  // { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal, maxVal, rowField, colField, valField }

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtCell  = d3.format(',.0f');
const fmtTotal = d3.format('~s');

// ─── Bootstrap ────────────────────────────────────────────────────────────────
tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => setError(err.message || String(err)));

// ─── Mode toggle ─────────────────────────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentMode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.body.className = `mode-${currentMode}`;
    if (lastMatrix) applyColors(lastMatrix);
  });
});

// ─── Render pipeline ─────────────────────────────────────────────────────────
async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    const matrix = buildMatrix(dataTable, vizSpec);
    lastMatrix = matrix;
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

// ─── Data: parse + pivot ──────────────────────────────────────────────────────
// Returns matrix object:
// {
//   rowKeys:    string[]          — ordered unique row dimension values
//   colKeys:    string[]          — ordered unique column dimension values
//   matrix:     Map<rowKey, Map<colKey, number>>
//   rowTotals:  Map<rowKey, number>
//   colTotals:  Map<colKey, number>
//   grandTotal: number
//   maxVal:     number            — max cell value (for color scale domain)
//   rowField:   string
//   colField:   string
//   valField:   string
// }
function buildMatrix(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(encId) {
    const enc = encodings.find(e => e.id === encId);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const rowField = fieldName('row');
  const colField = fieldName('column');
  const valField = fieldName('value');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!rowField || !(rowField in colIndex))
    throw new Error('Drag a dimension onto the "Row Dimension" encoding slot.');
  if (!colField || !(colField in colIndex))
    throw new Error('Drag a dimension onto the "Column Dimension" encoding slot.');
  if (!valField || !(valField in colIndex))
    throw new Error('Drag a numeric measure onto the "Value (Measure)" encoding slot.');

  const ri = colIndex[rowField];
  const ci = colIndex[colField];
  const vi = colIndex[valField];

  // Accumulate into nested map (handles duplicate row+col pairs by summing)
  const matrix    = new Map();  // rowKey → Map<colKey, number>
  const rowTotals = new Map();
  const colTotals = new Map();
  let grandTotal  = 0;
  let maxVal      = 0;

  for (const row of dataTable.data) {
    const rk  = String(row[ri].value ?? '');
    const ck  = String(row[ci].value ?? '');
    const val = Number(row[vi].value);
    if (Number.isNaN(val)) continue;

    if (!matrix.has(rk)) matrix.set(rk, new Map());
    const prev = matrix.get(rk).get(ck) ?? 0;
    matrix.get(rk).set(ck, prev + val);

    rowTotals.set(rk, (rowTotals.get(rk) ?? 0) + val);
    colTotals.set(ck, (colTotals.get(ck) ?? 0) + val);
    grandTotal += val;
  }

  if (!matrix.size) throw new Error('No valid data rows found. Check field types on the encoding slots.');

  // Compute maxVal across all cells
  for (const [, colMap] of matrix)
    for (const v of colMap.values())
      if (v > maxVal) maxVal = v;

  const rowKeys = [...matrix.keys()].sort();
  const colKeys = [...new Set([...matrix.values()].flatMap(m => [...m.keys()]))].sort();

  return { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal, maxVal, rowField, colField, valField };
}

// ─── Sorting ──────────────────────────────────────────────────────────────────
// Returns rowKeys sorted by the given column (or 'total')
function sortedRowKeys(matrix, col, dir) {
  const { rowKeys, matrix: m, rowTotals } = matrix;
  return [...rowKeys].sort((a, b) => {
    const va = col === 'total' ? (rowTotals.get(a) ?? 0) : (m.get(a)?.get(col) ?? 0);
    const vb = col === 'total' ? (rowTotals.get(b) ?? 0) : (m.get(b)?.get(col) ?? 0);
    return dir === 'asc' ? va - vb : vb - va;
  });
}

// ─── Color helpers ────────────────────────────────────────────────────────────
// Heatmap: sequential blues scale
function makeHeatmapScale(maxVal) {
  return d3.scaleSequential(d3.interpolateBlues).domain([0, maxVal || 1]);
}

// Relative luminance (sRGB) — used to decide text colour on heatmap cells
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

// Table mode: colour text by value rank within each column
// Returns a Map<colKey, d3.scaleSequential> — domain [0, colMax]
function makeTableScales(matrix) {
  const { colKeys, matrix: m } = matrix;
  const scales = new Map();
  for (const ck of colKeys) {
    const vals = [...m.values()].map(row => row.get(ck) ?? 0);
    const mx = d3.max(vals) || 1;
    scales.set(ck, d3.scaleSequential(d3.interpolateBlues).domain([0, mx]));
  }
  return scales;
}

// ─── Draw table ───────────────────────────────────────────────────────────────
function drawTable(matrix) {
  const { colKeys, rowTotals, colTotals, grandTotal, rowField, colField, valField } = matrix;

  showEmptyState(false);
  const table = document.getElementById('matrix-table');
  table.innerHTML = '';

  // ── thead ────────────────────────────────────────────────────────────────────
  const thead = table.createTHead();
  const headRow = thead.insertRow();

  // Top-left corner
  const cornerTh = document.createElement('th');
  cornerTh.className = 'row-header';
  cornerTh.textContent = `${rowField} \\ ${colField}`;
  headRow.appendChild(cornerTh);

  // Column headers
  for (const ck of colKeys) {
    const th = document.createElement('th');
    th.dataset.col = ck;
    const arrow = document.createElement('span');
    arrow.className = 'sort-arrow';
    th.textContent = ck;
    th.appendChild(arrow);
    if (sortState.col === ck) th.classList.add(`sorted-${sortState.dir}`);
    th.addEventListener('click', () => onSortClick(matrix, ck));
    headRow.appendChild(th);
  }

  // "Total" column header
  const totalTh = document.createElement('th');
  totalTh.className = 'total-header';
  totalTh.dataset.col = 'total';
  const totalArrow = document.createElement('span');
  totalArrow.className = 'sort-arrow';
  totalTh.textContent = 'Row Total';
  totalTh.appendChild(totalArrow);
  if (sortState.col === 'total') totalTh.classList.add(`sorted-${sortState.dir}`);
  totalTh.addEventListener('click', () => onSortClick(matrix, 'total'));
  headRow.appendChild(totalTh);

  // ── tbody ────────────────────────────────────────────────────────────────────
  const tbody = table.createTBody();

  // Determine row order (respect current sort)
  const displayRows = sortState.col
    ? sortedRowKeys(matrix, sortState.col, sortState.dir)
    : matrix.rowKeys;

  // Prepare color scales
  const heatScale   = makeHeatmapScale(matrix.maxVal);
  const tableScales = makeTableScales(matrix);

  for (const rk of displayRows) {
    const tr = tbody.insertRow();

    // Row header
    const rowTh = document.createElement('td');
    rowTh.className = 'row-header';
    rowTh.textContent = rk;
    tr.appendChild(rowTh);

    // Data cells
    for (const ck of colKeys) {
      const val = matrix.matrix.get(rk)?.get(ck) ?? 0;
      const td  = tr.insertCell();
      td.className = 'data-cell';
      td.dataset.row = rk;
      td.dataset.col = ck;
      td.dataset.val = val;
      td.textContent = fmtCell(val);
      colorCell(td, val, ck, heatScale, tableScales);
      attachTooltip(td, rk, ck, val, rowField, colField, valField);
      tr.appendChild(td);
    }

    // Row total
    const rowTotal = rowTotals.get(rk) ?? 0;
    const totalTd  = tr.insertCell();
    totalTd.className = 'total-cell';
    totalTd.textContent = fmtTotal(rowTotal);
    tr.appendChild(totalTd);
  }

  // ── tfoot (column totals) ──────────────────────────────────────────────────
  const tfoot   = table.createTFoot();
  const footRow = tfoot.insertRow();

  const footLabel = document.createElement('td');
  footLabel.className = 'row-header';
  footLabel.textContent = 'Column Total';
  footLabel.style.fontWeight = '700';
  footRow.appendChild(footLabel);

  for (const ck of colKeys) {
    const ct  = colTotals.get(ck) ?? 0;
    const ftd = footRow.insertCell();
    ftd.className = 'total-cell';
    ftd.textContent = fmtTotal(ct);
    footRow.appendChild(ftd);
  }

  // Grand total
  const grandTd = footRow.insertCell();
  grandTd.className = 'total-cell';
  grandTd.textContent = fmtTotal(grandTotal);
  grandTd.style.fontWeight = '800';
  footRow.appendChild(grandTd);
}

// ─── Color a single cell ──────────────────────────────────────────────────────
function colorCell(td, val, ck, heatScale, tableScales) {
  if (currentMode === 'heatmap') {
    const bg = heatScale(val);
    td.style.backgroundColor = bg;
    td.style.color = luminance(bg) > 0.35 ? '#111' : '#ffffff';
  } else {
    td.style.backgroundColor = '';
    const colScale = tableScales.get(ck);
    const textColor = colScale ? colScale(val) : '#111';
    // Make text dark blue for high values (blues interpolator returns light-to-dark)
    td.style.color = textColor;
    // Override: use luminance to keep high-value text readable in white cells
    // Blues scale: high values → dark blue; low values → near-white. Invert for text.
    // We use the color as-is since dark blue on white is readable; very low values → use grey.
    td.style.color = luminance(textColor) > 0.7 ? '#bbb' : textColor;
  }
}

// ─── Re-apply colors without full redraw ──────────────────────────────────────
function applyColors(matrix) {
  const heatScale   = makeHeatmapScale(matrix.maxVal);
  const tableScales = makeTableScales(matrix);

  document.querySelectorAll('#matrix-table td.data-cell').forEach(td => {
    const val = Number(td.dataset.val);
    const ck  = td.dataset.col;
    colorCell(td, val, ck, heatScale, tableScales);
  });
}

// ─── Sort handler ──────────────────────────────────────────────────────────────
function onSortClick(matrix, col) {
  if (sortState.col === col) {
    sortState.dir = sortState.dir === 'desc' ? 'asc' : 'desc';
  } else {
    sortState.col = col;
    sortState.dir = 'desc';
  }
  drawTable(matrix);
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function attachTooltip(td, rk, ck, val, rowField, colField, valField) {
  const tooltip = document.getElementById('tooltip');

  td.addEventListener('mouseenter', evt => {
    tooltip.innerHTML = `
      <div class="tt-title">${fmtCell(val)}</div>
      <div class="tt-row"><b>${rowField}:</b> ${rk}</div>
      <div class="tt-col"><b>${colField}:</b> ${ck}</div>
      <div class="tt-val">${valField}: ${fmtCell(val)}</div>
    `;
    tooltip.style.display = 'block';
    positionTooltip(evt);
  });

  td.addEventListener('mousemove', positionTooltip);

  td.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });
}

function positionTooltip(evt) {
  const tooltip = document.getElementById('tooltip');
  const margin  = 12;
  let x = evt.clientX + margin;
  let y = evt.clientY + margin;
  // Keep within viewport
  if (x + 270 > window.innerWidth)  x = evt.clientX - 270 - margin;
  if (y + 140 > window.innerHeight) y = evt.clientY - 140 - margin;
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

- [x] **Step 3.2: Commit**

```bash
git add extensions/relationship-table/chart.js
git commit -m "feat: add D3 relationship matrix rendering logic with heatmap and table modes"
```

---

## Task 4: Standalone Test Page (`test.html`)

The `test.html` mocks the full Tableau Extensions API — customer segment × product category (4 × 5) with realistic revenue values — so the chart can be verified in any browser without Tableau Desktop.

**Files:**
- Create: `extensions/relationship-table/test.html`

- [x] **Step 4.1: Write test.html**

Create `extensions/relationship-table/test.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Relationship Table — Browser Test</title>
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
    /* Inline styles from index.html — replicated so test.html is self-contained */
    *, *::before, *::after { box-sizing: border-box; }
    #toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid #e0e0e0;
      background: #fafafa;
      flex-shrink: 0;
    }
    #toolbar span { font-size: 12px; color: #666; margin-right: 4px; }
    .mode-btn {
      padding: 4px 14px;
      border: 1px solid #bbb;
      border-radius: 4px;
      background: #fff;
      color: #333;
      font-size: 12px;
      cursor: pointer;
      transition: background .15s, color .15s, border-color .15s;
    }
    .mode-btn.active { background: #1f77b4; border-color: #1f77b4; color: #fff; font-weight: 600; }
    .mode-btn:hover:not(.active) { background: #f0f4fa; border-color: #1f77b4; }
    #table-wrapper { flex: 1; overflow: auto; position: relative; }
    #matrix-table { border-collapse: collapse; min-width: 100%; font-size: 13px; }
    #matrix-table th, #matrix-table td {
      border: 1px solid #e0e0e0;
      padding: 6px 10px;
      white-space: nowrap;
      text-align: right;
      min-width: 80px;
    }
    #matrix-table th.row-header, #matrix-table td.row-header {
      text-align: left;
      font-weight: 600;
      color: #222;
      background: #f5f5f5;
      position: sticky;
      left: 0;
      z-index: 2;
      min-width: 160px;
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
    #matrix-table td.data-cell:hover { outline: 2px solid #1f77b4; outline-offset: -2px; }
    #matrix-table td.total-cell, #matrix-table th.total-header {
      font-weight: 700;
      background: #eef2f7 !important;
      color: #1a3a5c !important;
      border-left: 2px solid #d0d0d0;
    }
    #matrix-table tfoot tr { border-top: 2px solid #d0d0d0; }
    #matrix-table tfoot td { font-weight: 700; background: #eef2f7; color: #1a3a5c; }
    body.mode-table #matrix-table td.data-cell { background: #ffffff !important; }
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
      max-width: 260px;
      z-index: 100;
      display: none;
    }
    #tooltip .tt-title { font-weight: 700; font-size: 13px; color: #111; margin-bottom: 4px; }
    #tooltip .tt-row, #tooltip .tt-col { color: #555; }
    #tooltip .tt-val { color: #1f77b4; font-weight: 600; font-size: 14px; }
    #error { display: none; padding: 10px 16px; background: #fff0f0; color: #c0392b; font-size: 13px; }
    #error:not(:empty) { display: block; }
    #empty-state { display: none; }
  </style>
</head>
<body class="mode-heatmap">
  <h2>Relationship Table — Browser Test (no Tableau required)</h2>
  <div id="frame-wrapper">
    <div id="toolbar">
      <span>Display mode:</span>
      <button class="mode-btn active" data-mode="heatmap">Heatmap</button>
      <button class="mode-btn" data-mode="table">Table</button>
    </div>
    <div id="error"></div>
    <div id="table-wrapper">
      <table id="matrix-table"></table>
    </div>
    <div id="empty-state"></div>
  </div>
  <div id="tooltip"></div>

  <script>
  // ─── Mock data: Customer Segment × Product Category (4 × 5) ─────────────────
  //
  //                 Tech      Furniture  Office    Apparel   Food
  // Consumer        312,450   187,230     95,670   143,890   76,540
  // Corporate       541,320   263,100    218,450    89,330  154,210
  // Home Office     198,760   112,540    134,220    56,780   43,890
  // Small Business  424,680   198,320    176,950   112,430   89,650

  const MOCK_ROWS = [
    ['Consumer',       'Technology',  312450],
    ['Consumer',       'Furniture',   187230],
    ['Consumer',       'Office',       95670],
    ['Consumer',       'Apparel',     143890],
    ['Consumer',       'Food',         76540],
    ['Corporate',      'Technology',  541320],
    ['Corporate',      'Furniture',   263100],
    ['Corporate',      'Office',      218450],
    ['Corporate',      'Apparel',      89330],
    ['Corporate',      'Food',        154210],
    ['Home Office',    'Technology',  198760],
    ['Home Office',    'Furniture',   112540],
    ['Home Office',    'Office',      134220],
    ['Home Office',    'Apparel',      56780],
    ['Home Office',    'Food',         43890],
    ['Small Business', 'Technology',  424680],
    ['Small Business', 'Furniture',   198320],
    ['Small Business', 'Office',      176950],
    ['Small Business', 'Apparel',     112430],
    ['Small Business', 'Food',         89650],
  ];

  const MOCK_DATA_TABLE = {
    columns: [
      { fieldName: 'Customer Segment', index: 0, dataType: 'string' },
      { fieldName: 'Product Category', index: 1, dataType: 'string' },
      { fieldName: 'Revenue',          index: 2, dataType: 'float'  },
    ],
    data: MOCK_ROWS.map(([seg, cat, rev]) => [
      { value: seg },
      { value: cat },
      { value: String(rev) },
    ]),
  };

  const MOCK_VIZ_SPEC = {
    marksSpecificationCollection: [{
      encodingCollection: [
        { id: 'row',    fieldCollection: [{ fieldName: 'Customer Segment' }] },
        { id: 'column', fieldCollection: [{ fieldName: 'Product Category' }] },
        { id: 'value',  fieldCollection: [{ fieldName: 'Revenue' }] },
      ],
    }],
  };

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

- [x] **Step 4.2: Open test.html in a browser and verify**

Run a local server from the repo root:
```bash
python3 -m http.server 8080
```

Open: `http://localhost:8080/extensions/relationship-table/test.html`

Expected results:
- 4 × 5 matrix (Customer Segment rows × Product Category columns) plus Row Total column and Column Total footer row
- Grand total in bottom-right corner
- **Heatmap mode** (default): cells shaded from light to dark blue by value; Technology/Corporate cell darkest (~541K); text is white on dark cells, black on light cells
- **Table mode** (after clicking button): white cell backgrounds; cell text is dark-blue for high values, grey for low values
- Clicking any column header sorts rows by that column; click again to reverse; "Row Total" column is also sortable
- Hovering a cell shows tooltip with exact value, row name, column name, and field names
- Row headers and column headers sticky when scrolling

- [x] **Step 4.3: Commit**

```bash
git add extensions/relationship-table/test.html
git commit -m "feat: add browser test page for relationship-table with mock Tableau API"
```

---

## Task 5: README

**Files:**
- Create: `extensions/relationship-table/README.md`

- [ ] **Step 5.1: Write README.md**

Create `extensions/relationship-table/README.md`:

```markdown
# Relationship Table — Tableau Viz Extension

A D3 v7 Tableau Viz Extension that renders a relationship matrix table. Rows are one dimension, columns are another dimension, and cells show a numeric measure. Cells are color-coded by value intensity.

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `row` | Discrete dimension | Yes | Values become row labels |
| `column` | Discrete dimension | Yes | Values become column headers |
| `value` | Continuous measure | Yes | Numeric value shown in each cell |

## Display Modes

Toggle between two modes using the toolbar buttons:

- **Heatmap** (default) — cells are colored by value intensity using a sequential Blues scale. High values are dark blue; low values are light blue. Text is white or black depending on background luminance.
- **Table** — cell backgrounds are white; text is colored by value rank within each column (dark blue = high, grey = low).

## Features

- Sticky row headers and column headers for large matrices
- Click any column header to sort rows by that column's value (click again to reverse)
- "Row Total" column (sortable) and "Column Total" footer row
- Grand total in the bottom-right corner
- Hover tooltip showing exact value, row name, and column name
- Number formatting: `,.0f` for cell values, `~s` (SI prefix) for totals

## Live URL

`https://vj-cyntexa.github.io/tableau-viz/extensions/relationship-table/index.html`

## Dev Workflow

```bash
# 1. Start local server from repo root
python3 -m http.server 8080

# 2. Open test page (no Tableau required)
open http://localhost:8080/extensions/relationship-table/test.html

# 3. Load in Tableau Desktop
# Marks card → Viz Extensions → Access Local Extensions → relationship-table-local.trex
```

## TREX Files

| File | URL |
|---|---|
| `relationship-table.trex` | `https://vj-cyntexa.github.io/tableau-viz/...` |
| `relationship-table-local.trex` | `http://localhost:8080/...` |

## Author

Cyntexa — vishwajeet@cyntexa.com
```

- [ ] **Step 5.2: Commit**

```bash
git add extensions/relationship-table/README.md
git commit -m "docs: add README for relationship-table extension"
```

---

## Task 6: Push and Verify

- [ ] **Step 6.1: Push to remote**

```bash
git pull --rebase origin master && git push origin master
```

- [ ] **Step 6.2: Confirm GitHub Pages URL is live**

Wait 60–90 seconds after pushing, then verify:

```bash
curl -sI "https://vj-cyntexa.github.io/tableau-viz/extensions/relationship-table/test.html" | head -5
```

Expected: `HTTP/2 200` (or `301` redirect to HTTPS). If you get `404`, wait another minute and retry.

- [ ] **Step 6.3: Smoke-test in browser**

Open: `https://vj-cyntexa.github.io/tableau-viz/extensions/relationship-table/test.html`

Expected: Identical to local test — 4 × 5 heatmap matrix, mode toggle, sort, tooltips.

---

## Self-Review Checklist

- [ ] `.trex` manifests define all 3 encodings (`row`, `column`, `value`) with correct role types and `min-count="1" max-count="1"`
- [ ] Production manifest URL matches actual GitHub Pages path
- [ ] Local manifest uses `http://localhost:8080` URL
- [ ] `chart.js` handles missing encoding slots with descriptive user-facing error messages
- [ ] `chart.js` handles empty data (no valid rows) gracefully
- [ ] `chart.js` handles duplicate row+col pairs by summing values
- [ ] Heatmap mode: luminance check drives white/black text on colored cells
- [ ] Table mode: text color derived from per-column scale; very low values get grey text
- [ ] Mode toggle re-colors cells without full table redraw
- [ ] Sort state persists across re-renders (when Tableau data changes)
- [ ] Row totals use `~s` SI format; cell values use `,.0f` format
- [ ] Sticky headers work correctly (row header `left: 0; z-index: 2`, column headers `top: 0; z-index: 3`, corner `z-index: 4`)
- [ ] Tooltip positions within viewport (avoids clipping at edges)
- [ ] `test.html` mocks all API methods called by `chart.js` (`initializeAsync`, `getVisualSpecificationAsync`, `getSummaryDataReaderAsync`, `getAllPagesAsync`, `releaseAsync`, `addEventListener`)
- [ ] Mock data: 4 segments × 5 categories = 20 rows with realistic revenue values
- [ ] All files committed before push
- [ ] GitHub Pages test URL returns HTTP 200
