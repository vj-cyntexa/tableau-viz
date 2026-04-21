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
  const marksSpec = vizSpec.marksSpecificationCollection?.[0];
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

  const ri_default = colIndex[rowField];
  const ci_default = colIndex[colField];

  let ri = ri_default;
  let ci = ci_default;

  if (rowField === colField) {
    // Two columns have the same fieldName (e.g. self-join in Tableau).
    // Object.fromEntries only keeps the last — find both by scanning columns array.
    const matchingIndices = dataTable.columns
      .filter(c => c.fieldName === rowField)
      .map(c => c.index);
    if (matchingIndices.length >= 2) {
      ri = matchingIndices[0];
      ci = matchingIndices[1];
    }
  }

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
