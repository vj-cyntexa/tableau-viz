'use strict';

// ─── Colors ──────────────────────────────────────────────────────────────────
const COLOR_SUCCESS = '#27ae60';
const COLOR_DANGER  = '#e74c3c';
const COLOR_NEUTRAL = '#3498db';

// ─── Format helpers ───────────────────────────────────────────────────────────
// d3.format(',.2s') produces e.g. "1.2M", "340k" — used as-is per spec.
const fmtBig   = d3.format(',.2s');
const fmtDelta = d3.format('+.1%');

// ─── Mode state (module-scope so it survives re-renders) ──────────────────────
let currentMode = 'simple';

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentMode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Re-render with the cached data if available.
    if (window._lastKpiData) renderCard(window._lastKpiData, currentMode);
  });
});

tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => {
  setError(err.message || String(err));
});

// ─── Render pipeline ─────────────────────────────────────────────────────────
async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    const kpiData = parseTableauData(dataTable, vizSpec);
    window._lastKpiData = kpiData;   // cache for mode-button re-renders
    renderCard(kpiData, currentMode);
  } catch (err) {
    setError(err.message || String(err));
  }
}

async function fetchData(worksheet) {
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, {
    ignoreSelection: true,
  });
  const table = await reader.getAllPagesAsync();
  await reader.releaseAsync();
  return table;
}

// ─── Data parsing ─────────────────────────────────────────────────────────────
// Returns a plain object:
// {
//   value:      number,           // primary KPI value (from most-recent row)
//   valueField: string,           // field name for fallback label
//   label:      string | null,    // from label encoding or null
//   comparison: number | null,    // from comparison encoding or null
//   history:    Array<{ date: Date|null, val: number }>,  // sparkline points
//   hasDate:    boolean,
//   hasComparison: boolean,
//   hasHistory:    boolean,
// }
function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(encodingId) {
    const enc = encodings.find(e => e.id === encodingId);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const valueField      = fieldName('value');
  const labelField      = fieldName('label');
  const comparisonField = fieldName('comparison');
  const historyField    = fieldName('history');
  const dateField       = fieldName('date');

  // Build column index by field name.
  const colIndex = Object.fromEntries(
    dataTable.columns.map(c => [c.fieldName, c.index])
  );

  if (!valueField || !(valueField in colIndex)) {
    throw new Error('Drag a numeric measure onto the "Value (Primary Measure)" encoding slot.');
  }

  const vi  = colIndex[valueField];
  const li  = labelField      && labelField      in colIndex ? colIndex[labelField]      : null;
  const ci  = comparisonField && comparisonField in colIndex ? colIndex[comparisonField] : null;
  const hi  = historyField    && historyField    in colIndex ? colIndex[historyField]    : null;
  const di  = dateField       && dateField       in colIndex ? colIndex[dateField]       : null;

  const parseDate = v => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  // Parse all rows.
  const rows = dataTable.data.map(row => ({
    value:      Number(row[vi].value),
    label:      li !== null ? String(row[li].value) : null,
    comparison: ci !== null ? Number(row[ci].value) : null,
    date:       di !== null ? parseDate(row[di].value) : null,
    history:    hi !== null ? Number(row[hi].value)    : null,
  }));

  if (!rows.length) throw new Error('No data rows found. Check that the encoding slots have valid fields.');

  // Determine the "current" row: last by date if date exists, otherwise the single aggregate row.
  let currentRow;
  if (di !== null) {
    const sorted = [...rows].sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return a.date - b.date;
    });
    currentRow = sorted[sorted.length - 1];
  } else {
    currentRow = rows[0];
  }

  // Build sparkline history array: all rows sorted by date ascending.
  const history = (hi !== null)
    ? [...rows]
        .sort((a, b) => {
          if (!a.date || !b.date) return 0;
          return a.date - b.date;
        })
        .map(r => ({ date: r.date, val: r.history }))
        .filter(p => !Number.isNaN(p.val))
    : [];

  return {
    value:         currentRow.value,
    valueField:    valueField,
    label:         currentRow.label,
    comparison:    currentRow.comparison,
    history:       history,
    hasDate:       di !== null,
    hasComparison: ci !== null,
    hasHistory:    hi !== null,
  };
}

// ─── Card rendering ──────────────────────────────────────────────────────────
function renderCard(data, mode) {
  const card = document.getElementById('kpi-card');
  const body = document.getElementById('card-body');

  // Reset trend background classes.
  card.classList.remove('trend-up', 'trend-down');

  const displayLabel = data.label ?? data.valueField ?? 'KPI';

  switch (mode) {
    case 'comparison': {
      if (!data.hasComparison || data.comparison === null) {
        body.innerHTML = buildSimpleHTML(displayLabel, data.value) +
          '<p class="kpi-hint">Add a field to the Comparison encoding slot to enable this mode.</p>';
      } else {
        body.innerHTML = buildComparisonHTML(displayLabel, data.value, data.comparison);
      }
      break;
    }
    case 'trend': {
      if (!data.hasComparison || data.comparison === null) {
        body.innerHTML = buildSimpleHTML(displayLabel, data.value) +
          '<p class="kpi-hint">Add a field to the Comparison encoding slot to enable Trend mode.</p>';
      } else {
        const up = data.value >= data.comparison;
        card.classList.add(up ? 'trend-up' : 'trend-down');
        body.innerHTML = buildTrendHTML(displayLabel, data.value, up);
      }
      break;
    }
    case 'sparkline': {
      if (!data.hasHistory || data.history.length === 0) {
        body.innerHTML = buildSimpleHTML(displayLabel, data.value) +
          '<p class="kpi-hint">Add fields to the History and Date encoding slots to enable Sparkline mode.</p>';
      } else {
        body.innerHTML = buildSparklineHTML(displayLabel, data.value, data.history);
      }
      break;
    }
    case 'simple':
    default: {
      body.innerHTML = buildSimpleHTML(displayLabel, data.value);
      break;
    }
  }
}

// ─── Mode HTML builders ───────────────────────────────────────────────────────

function buildSimpleHTML(label, value) {
  return `
    <p class="kpi-label">${escHtml(label)}</p>
    <p class="kpi-value">${fmtBig(value)}</p>
  `;
}

function buildComparisonHTML(label, value, comparison) {
  const delta = calcDelta(value, comparison);
  const deltaStr = delta === null ? 'N/A' : fmtDelta(delta);
  const deltaClass = delta === null ? 'neutral' : delta >= 0 ? 'positive' : 'negative';
  return `
    <p class="kpi-label">${escHtml(label)}</p>
    <p class="kpi-value">${fmtBig(value)}</p>
    <div class="kpi-comparison-row">
      <span class="kpi-prev-value">vs ${fmtBig(comparison)}</span>
      <span class="kpi-delta ${deltaClass}">${deltaStr}</span>
    </div>
  `;
}

function buildTrendHTML(label, value, up) {
  const arrow = up ? '▲' : '▼';
  const arrowClass = up ? 'up' : 'down';
  return `
    <p class="kpi-label">${escHtml(label)}</p>
    <p class="kpi-value">${fmtBig(value)}</p>
    <p class="kpi-trend-arrow ${arrowClass}">${arrow}</p>
  `;
}

function buildSparklineHTML(label, value, history) {
  const W = 120, H = 40, PAD = 2;
  const vals = history.map(p => p.val);
  const minV = d3.min(vals);
  const maxV = d3.max(vals);
  const xScale = d3.scaleLinear().domain([0, history.length - 1]).range([PAD, W - PAD]);
  const yScale = d3.scaleLinear()
    .domain([minV === maxV ? minV - 1 : minV, minV === maxV ? maxV + 1 : maxV])
    .range([H - PAD, PAD]);

  const lineGen = d3.line()
    .x((_, i) => xScale(i))
    .y(p => yScale(p.val))
    .curve(d3.curveCatmullRom.alpha(0.5));

  const pathD = lineGen(history);

  const svgMarkup = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <path d="${pathD}" fill="none" stroke="${COLOR_NEUTRAL}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  return `
    <p class="kpi-label">${escHtml(label)}</p>
    <p class="kpi-value">${fmtBig(value)}</p>
    <div class="kpi-sparkline">${svgMarkup}</div>
  `;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

// Returns the relative delta as a fraction (e.g. 0.143 for +14.3%), or null if comparison is 0.
function calcDelta(value, comparison) {
  if (comparison === 0) return null;
  return (value - comparison) / Math.abs(comparison);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setError(msg) {
  const el = document.getElementById('error');
  if (el) el.textContent = msg;
}

function clearError() {
  const el = document.getElementById('error');
  if (el) el.textContent = '';
}
