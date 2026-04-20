'use strict';

// ─── Module state ─────────────────────────────────────────────────────────────
const state = {
  scheme: 'Blues',   // 'Blues' | 'Greens' | 'Purples'
  showText: true,
};
let currentWs = null;

// ─── Color scheme map ─────────────────────────────────────────────────────────
const SCHEME_MAP = {
  Blues:   d3.interpolateBlues,
  Greens:  d3.interpolateGreens,
  Purples: d3.interpolatePurples,
};

// ─── Toolbar handlers (called from index.html onclick) ───────────────────────
function setScheme(btn) {
  document.querySelectorAll('[data-scheme]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.scheme = btn.dataset.scheme;
  if (currentWs) render(currentWs);
}

function toggleText(cb) {
  state.showText = cb.checked;
  if (currentWs) render(currentWs);
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
tableau.extensions.initializeAsync().then(() => {
  currentWs = tableau.extensions.worksheetContent.worksheet;
  currentWs.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(currentWs));
  render(currentWs);
}).catch(err => setError(err.message || String(err)));

// ─── Resize handling ──────────────────────────────────────────────────────────
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (currentWs) render(currentWs); }, 150);
});

// ─── Data fetch ───────────────────────────────────────────────────────────────
async function fetchData(worksheet) {
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
  try { return await reader.getAllPagesAsync(); }
  finally { await reader.releaseAsync(); }
}

// ─── Render pipeline ──────────────────────────────────────────────────────────
async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    drawChart(parseData(dataTable, vizSpec));
  } catch (err) {
    setError(err.message || String(err));
  }
}

// ─── Data parsing ─────────────────────────────────────────────────────────────
function parseData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;
  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const cohortField    = fieldName('cohort');
  const periodField    = fieldName('period');
  const retentionField = fieldName('retention');
  const sizeField      = fieldName('cohort_size');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!cohortField    || !(cohortField    in colIndex)) throw new Error('Drag a dimension onto the "Cohort" encoding slot.');
  if (!periodField    || !(periodField    in colIndex)) throw new Error('Drag a measure onto the "Period" encoding slot.');
  if (!retentionField || !(retentionField in colIndex)) throw new Error('Drag a measure onto the "Retention Rate" encoding slot.');

  const ci = colIndex[cohortField];
  const pi = colIndex[periodField];
  const ri = colIndex[retentionField];
  const si = (sizeField && sizeField in colIndex) ? colIndex[sizeField] : null;

  // Parse cohort label → Date using d3.timeParse('%b %Y') for "Jan 2023" format.
  // Fall back to lexicographic sort if parse fails.
  const parseMonth = d3.timeParse('%b %Y');

  const rows = dataTable.data.map(row => ({
    cohort:    String(row[ci].value),
    period:    Number(row[pi].value),
    retention: Number(row[ri].value),
    size:      si !== null ? Number(row[si].value) : null,
  })).filter(r => !Number.isNaN(r.period) && !Number.isNaN(r.retention));

  if (!rows.length) throw new Error('No valid rows. Check encoding slots.');

  // Build Map<cohortLabel, Map<period, {retention, size}>>
  const cohortMap = new Map();
  rows.forEach(r => {
    if (!cohortMap.has(r.cohort)) cohortMap.set(r.cohort, new Map());
    cohortMap.get(r.cohort).set(r.period, { retention: r.retention, size: r.size });
  });

  // Sort cohorts chronologically using d3.timeParse; fall back to locale sort
  const cohortLabels = [...cohortMap.keys()].sort((a, b) => {
    const da = parseMonth(a);
    const db = parseMonth(b);
    if (da && db) return da - db;
    return a.localeCompare(b);
  });

  // Collect all periods, sorted numerically ascending
  const periodSet = new Set();
  rows.forEach(r => periodSet.add(r.period));
  const periods = [...periodSet].sort((a, b) => a - b);

  return { cohortMap, cohortLabels, periods };
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawChart({ cohortMap, cohortLabels, periods }) {
  const container = document.getElementById('chart');
  d3.select(container).selectAll('*').remove();

  if (!cohortLabels.length) { container.textContent = 'No data.'; return; }

  const LABEL_COL_W = 90;  // px reserved for cohort label column
  const HEADER_H    = 36;  // px for period header row
  const CELL_H      = 38;
  const CELL_W      = Math.max(52, Math.floor((container.clientWidth - LABEL_COL_W) / Math.max(periods.length, 1)));

  const totalW = LABEL_COL_W + CELL_W * periods.length;
  const totalH = HEADER_H + CELL_H * cohortLabels.length;

  const colorInterp = SCHEME_MAP[state.scheme] || d3.interpolateBlues;
  const colorScale  = d3.scaleSequential(colorInterp).domain([0, 1]);

  const fmt = d3.format('.0%');

  const tooltip = d3.select(document.body)
    .selectAll('.tooltip')
    .data([null])
    .join('div')
    .attr('class', 'tooltip')
    .style('opacity', 0)
    .style('pointer-events', 'none');

  const svg = d3.select(container)
    .append('svg')
    .attr('width', totalW)
    .attr('height', totalH);

  // ── Header row (period labels) ─────────────────────────────────────────────
  const headerG = svg.append('g').attr('transform', `translate(${LABEL_COL_W}, 0)`);
  periods.forEach((p, j) => {
    headerG.append('text')
      .attr('x', j * CELL_W + CELL_W / 2)
      .attr('y', HEADER_H / 2 + 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#555')
      .text(`Period ${p}`);
  });

  // ── Cohort label column ────────────────────────────────────────────────────
  const labelG = svg.append('g').attr('transform', `translate(0, ${HEADER_H})`);
  cohortLabels.forEach((cohort, i) => {
    labelG.append('text')
      .attr('x', LABEL_COL_W - 8)
      .attr('y', i * CELL_H + CELL_H / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#333')
      .text(cohort);
  });

  // ── Cells ──────────────────────────────────────────────────────────────────
  const cellsG = svg.append('g').attr('transform', `translate(${LABEL_COL_W}, ${HEADER_H})`);

  cohortLabels.forEach((cohort, i) => {
    const periodData = cohortMap.get(cohort) || new Map();
    periods.forEach((p, j) => {
      const cell = periodData.get(p);
      const rate = cell ? cell.retention : null;
      const fillColor = rate !== null ? colorScale(rate) : '#f0f0f0';

      // Determine text color: white if luminance < 0.35, else dark
      let textColor = '#222';
      if (rate !== null) {
        // Approximate luminance from interpolated color
        const rgb = d3.color(fillColor);
        if (rgb) {
          const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          textColor = luminance < 0.35 ? '#ffffff' : '#222222';
        }
      }

      const cellG = cellsG.append('g')
        .attr('transform', `translate(${j * CELL_W}, ${i * CELL_H})`);

      cellG.append('rect')
        .attr('width', CELL_W - 1)
        .attr('height', CELL_H - 1)
        .attr('fill', fillColor)
        .attr('rx', 2)
        .style('cursor', rate !== null ? 'crosshair' : 'default')
        .on('mousemove', function(event) {
          if (rate === null) return;
          let html = `<strong>${cohort}</strong> — Period ${p}<br>`;
          html += `Retention: <b>${fmt(rate)}</b>`;
          if (cell.size !== null && !Number.isNaN(cell.size)) {
            html += `<br>Cohort size: <b>${d3.format(',')(cell.size)}</b>`;
          }
          tooltip
            .style('opacity', 1)
            .style('left', `${event.clientX + 14}px`)
            .style('top',  `${event.clientY - 10}px`)
            .html(html);
        })
        .on('mouseleave', () => tooltip.style('opacity', 0));

      if (state.showText && rate !== null) {
        cellG.append('text')
          .attr('class', 'cell-text')
          .attr('x', (CELL_W - 1) / 2)
          .attr('y', (CELL_H - 1) / 2)
          .attr('fill', textColor)
          .text(fmt(rate));
      }
    });
  });
}

// ─── Error helpers ────────────────────────────────────────────────────────────
function setError(msg) {
  const el = document.getElementById('error');
  if (el) el.textContent = msg;
}
function clearError() {
  const el = document.getElementById('error');
  if (el) el.textContent = '';
}
