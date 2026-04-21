'use strict';

/* ─────────────────────────────────────────
   Constants
───────────────────────────────────────── */
const COLORS          = d3.schemeTableau10;
const TRANSITION_MS   = 300;
const LEGEND_WIDTH    = 170;    // px reserved on the right
const EXPLODE_OFFSET  = 8;      // px a segment shifts outward on hover/click
const INNER_R_RATIO   = 0.60;   // inner radius = 60 % of outer for standard & exploded
const MULTI_OUTER_R   = 1.00;   // outer ring uses full outer radius
const MULTI_INNER_R   = 0.60;   // inner ring outer boundary
const MULTI_INNER_R2  = 0.35;   // inner ring inner boundary (hole)

/* ─────────────────────────────────────────
   State
───────────────────────────────────────── */
let currentMode   = 'standard'; // 'standard' | 'exploded' | 'multi-ring'
let clickedIndex  = null;       // which segment is pinned-exploded
let chartData     = null;       // { rows: [{category, value, innerValue}], totals }

/* ─────────────────────────────────────────
   Tableau init
───────────────────────────────────────── */
tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => setError(err.message || String(err)));

/* ─────────────────────────────────────────
   Mode toggle wiring
───────────────────────────────────────── */
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode  = btn.dataset.mode;
    clickedIndex = null;
    if (chartData) drawChart(chartData);
  });
});

/* ─────────────────────────────────────────
   Render pipeline
───────────────────────────────────────── */
async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    chartData = parseTableauData(dataTable, vizSpec);
    drawChart(chartData);
  } catch (err) {
    setError(err.message || String(err));
  }
}

async function fetchData(worksheet) {
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
  try {
    return await reader.getAllPagesAsync();
  } finally {
    await reader.releaseAsync();
  }
}

/* ─────────────────────────────────────────
   Parse Tableau data
───────────────────────────────────────── */
function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection?.[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const catField        = fieldName('category');
  const valField        = fieldName('value');
  const innerValField   = fieldName('inner-value');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!catField || !(catField in colIndex)) {
    throw new Error('Drag a dimension onto the "Category" encoding slot.');
  }
  if (!valField || !(valField in colIndex)) {
    throw new Error('Drag a measure onto the "Value" encoding slot.');
  }

  const ci  = colIndex[catField];
  const vi  = colIndex[valField];
  const ivi = (innerValField && innerValField in colIndex) ? colIndex[innerValField] : null;

  const rows = dataTable.data
    .map(row => ({
      category:   String(row[ci].value),
      value:      Math.abs(Number(row[vi].value)),
      innerValue: ivi !== null ? Math.abs(Number(row[ivi].value)) : 0,
    }))
    .filter(r => !Number.isNaN(r.value) && r.value > 0);

  if (rows.length === 0) throw new Error('No positive numeric data found.');

  const total      = d3.sum(rows, r => r.value);
  const innerTotal = d3.sum(rows, r => r.innerValue);

  return { rows, total, innerTotal };
}

/* ─────────────────────────────────────────
   Draw
───────────────────────────────────────── */
function drawChart(data) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;

  // Clear previous SVG
  d3.select(container).select('svg').remove();

  const svg = d3.select(container).append('svg')
    .attr('width', W)
    .attr('height', H);

  const chartW  = W - LEGEND_WIDTH;
  const cx      = chartW / 2;
  const cy      = H / 2;
  const outerR  = Math.min(chartW, H) / 2 - 16;

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  const color = d3.scaleOrdinal(COLORS).domain(data.rows.map(r => r.category));

  if (currentMode === 'standard') {
    drawStandard(g, data, outerR, color);
  } else if (currentMode === 'exploded') {
    drawExploded(g, data, outerR, color);
  } else {
    drawMultiRing(g, data, outerR, color);
  }

  drawLegend(svg, data, color, W, H);
}

/* ── Standard donut ── */
function drawStandard(g, data, outerR, color) {
  const innerR = outerR * INNER_R_RATIO;

  const pie = d3.pie().value(d => d.value).sort(null);
  const arc = d3.arc().innerRadius(innerR).outerRadius(outerR).padAngle(0.02).cornerRadius(3);

  const arcs = pie(data.rows);

  g.selectAll('path.slice')
    .data(arcs)
    .join('path')
      .attr('class', 'slice')
      .attr('fill', d => color(d.data.category))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .transition().duration(TRANSITION_MS)
      .attrTween('d', function(d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return t => arc(i(t));
      });

  // Hover tooltip on slices (add after transition via selection, not transition chain)
  g.selectAll('path.slice')
    .on('mouseover', (event, d) => showTooltip(event, d.data, data.total))
    .on('mousemove', moveTooltip)
    .on('mouseout', hideTooltip);

  drawCenterLabel(g, data.total);
}

/* ── Exploded donut ── */
function drawExploded(g, data, outerR, color) {
  const innerR = outerR * INNER_R_RATIO;

  const pie = d3.pie().value(d => d.value).sort(null);
  const arc = d3.arc().innerRadius(innerR).outerRadius(outerR).padAngle(0.02).cornerRadius(3);

  const arcs = pie(data.rows);

  function explodeTransform(d, i) {
    const isExploded = (i === clickedIndex);
    if (!isExploded) return 'translate(0,0)';
    const mid = (d.startAngle + d.endAngle) / 2;
    return `translate(${Math.sin(mid) * EXPLODE_OFFSET},${-Math.cos(mid) * EXPLODE_OFFSET})`;
  }

  const slices = g.selectAll('path.slice')
    .data(arcs)
    .join('path')
      .attr('class', 'slice')
      .attr('fill', d => color(d.data.category))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('transform', (d, i) => explodeTransform(d, i))
      .transition().duration(TRANSITION_MS)
      .attrTween('d', function(d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return t => arc(i(t));
      });

  g.selectAll('path.slice')
    .on('mouseover', function(event, d) {
      const i = arcs.indexOf(d);
      if (i !== clickedIndex) {
        const mid = (d.startAngle + d.endAngle) / 2;
        d3.select(this)
          .transition().duration(150)
          .attr('transform', `translate(${Math.sin(mid) * EXPLODE_OFFSET},${-Math.cos(mid) * EXPLODE_OFFSET})`);
      }
      showTooltip(event, d.data, data.total);
    })
    .on('mousemove', moveTooltip)
    .on('mouseout', function(event, d) {
      const i = arcs.indexOf(d);
      if (i !== clickedIndex) {
        d3.select(this)
          .transition().duration(150)
          .attr('transform', 'translate(0,0)');
      }
      hideTooltip();
    })
    .on('click', function(event, d) {
      const i = arcs.indexOf(d);
      clickedIndex = (clickedIndex === i) ? null : i;
      g.selectAll('path.slice')
        .transition().duration(TRANSITION_MS)
        .attr('transform', (dd, ii) => explodeTransform(dd, ii));
    });

  drawCenterLabel(g, data.total);
}

/* ── Multi-ring donut ── */
function drawMultiRing(g, data, outerR, color) {
  // Outer ring: value
  const outerArcGen = d3.arc()
    .innerRadius(outerR * MULTI_INNER_R)
    .outerRadius(outerR * MULTI_OUTER_R)
    .padAngle(0.02)
    .cornerRadius(3);

  // Inner ring: innerValue (only if data exists)
  const innerArcGen = d3.arc()
    .innerRadius(outerR * MULTI_INNER_R2)
    .outerRadius(outerR * MULTI_INNER_R - 4)
    .padAngle(0.02)
    .cornerRadius(3);

  const pie = d3.pie().value(d => d.value).sort(null);
  const outerArcs = pie(data.rows);

  // Outer ring
  g.selectAll('path.outer-slice')
    .data(outerArcs)
    .join('path')
      .attr('class', 'outer-slice')
      .attr('fill', d => color(d.data.category))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .transition().duration(TRANSITION_MS)
      .attrTween('d', function(d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return t => outerArcGen(i(t));
      });

  g.selectAll('path.outer-slice')
    .on('mouseover', (event, d) => showTooltip(event, d.data, data.total, 'value'))
    .on('mousemove', moveTooltip)
    .on('mouseout', hideTooltip);

  // Inner ring (only if innerValue data is present)
  const hasInner = data.rows.some(r => r.innerValue > 0);

  if (hasInner) {
    const piePct = d3.pie().value(d => d.innerValue).sort(null);
    const innerArcs = piePct(data.rows);

    g.selectAll('path.inner-slice')
      .data(innerArcs)
      .join('path')
        .attr('class', 'inner-slice')
        .attr('fill', d => color(d.data.category))
        .attr('opacity', 0.65)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .transition().duration(TRANSITION_MS)
        .attrTween('d', function(d) {
          const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
          return t => innerArcGen(i(t));
        });

    g.selectAll('path.inner-slice')
      .on('mouseover', (event, d) => showTooltip(event, d.data, data.innerTotal, 'innerValue'))
      .on('mousemove', moveTooltip)
      .on('mouseout', hideTooltip);
  }

  // Ring labels
  const ringLabelR = outerR * MULTI_INNER_R - 10;
  g.append('text')
    .attr('class', 'center-sub')
    .attr('y', -ringLabelR - 6)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('fill', '#aaa')
    .text('outer');

  if (hasInner) {
    g.append('text')
      .attr('class', 'center-sub')
      .attr('y', -(outerR * MULTI_INNER_R2) + 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#aaa')
      .text('inner');
  }

  drawCenterLabel(g, data.total);
}

/* ─────────────────────────────────────────
   Center label
───────────────────────────────────────── */
function drawCenterLabel(g, total) {
  g.append('text')
    .attr('class', 'center-total')
    .attr('y', -6)
    .text(formatValue(total));

  g.append('text')
    .attr('class', 'center-sub')
    .attr('y', 14)
    .text('Total');
}

/* ─────────────────────────────────────────
   Legend
───────────────────────────────────────── */
function drawLegend(svg, data, color, W, H) {
  const total   = data.total;
  const lx      = W - LEGEND_WIDTH + 10;
  const squareS = 12;
  const rowH    = 22;
  const startY  = Math.max(16, (H - data.rows.length * rowH) / 2);

  const lg = svg.append('g').attr('class', 'legend').attr('transform', `translate(${lx},${startY})`);

  data.rows.forEach((row, i) => {
    const pct = total > 0 ? ((row.value / total) * 100).toFixed(1) : '0.0';
    const y   = i * rowH;

    lg.append('rect')
      .attr('x', 0).attr('y', y)
      .attr('width', squareS).attr('height', squareS)
      .attr('rx', 2)
      .attr('fill', color(row.category));

    lg.append('text')
      .attr('x', squareS + 7)
      .attr('y', y + squareS - 1)
      .style('font-size', '12px')
      .style('fill', '#333')
      .text(`${truncate(row.category, 14)}  ${pct}%`);
  });
}

/* ─────────────────────────────────────────
   Tooltip helpers
───────────────────────────────────────── */
function showTooltip(event, rowData, total, valueKey = 'value') {
  const tip   = document.getElementById('tooltip');
  const val   = rowData[valueKey];
  const pct   = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
  tip.innerHTML = `
    <div class="tt-label">${escHtml(rowData.category)}</div>
    <div class="tt-value">${formatValue(val)}</div>
    <div class="tt-pct">${pct}% of total</div>`;
  tip.style.display = 'block';
  positionTooltip(event);
}

function moveTooltip(event) { positionTooltip(event); }
function hideTooltip()       { document.getElementById('tooltip').style.display = 'none'; }

function positionTooltip(event) {
  const tip     = document.getElementById('tooltip');
  const chart   = document.getElementById('chart');
  const rect    = chart.getBoundingClientRect();
  const x       = event.clientX - rect.left + 12;
  const y       = event.clientY - rect.top  - 10;
  const tipW    = tip.offsetWidth;
  const tipH    = tip.offsetHeight;
  tip.style.left = (x + tipW > rect.width ? x - tipW - 20 : x) + 'px';
  tip.style.top  = (y + tipH > rect.height ? y - tipH : y)      + 'px';
}

/* ─────────────────────────────────────────
   Utilities
───────────────────────────────────────── */
function formatValue(v) {
  if (v >= 1e9)  return (v / 1e9).toFixed(2)  + 'B';
  if (v >= 1e6)  return (v / 1e6).toFixed(2)  + 'M';
  if (v >= 1e3)  return (v / 1e3).toFixed(1)  + 'K';
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setError(msg) {
  const el = document.getElementById('error');
  if (el) el.textContent = msg;
}

function clearError() {
  const el = document.getElementById('error');
  if (el) el.textContent = '';
}
