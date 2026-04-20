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
