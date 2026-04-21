'use strict';

// ─── Gauge geometry constants ─────────────────────────────────────────────────
// 270° gauge: from -135° to +135° (measured in radians from 12 o'clock)
// In D3 arc terms (0 = 12 o'clock, clockwise):
// startAngle = -Math.PI * 0.75  (i.e. -135°)
// endAngle   = +Math.PI * 0.75  (i.e. +135°)
const GAUGE_START = -Math.PI * 0.75;
const GAUGE_END   = +Math.PI * 0.75;
const GAUGE_SPAN  = GAUGE_END - GAUGE_START; // 1.5π

// ─── Module-scope state ───────────────────────────────────────────────────────
let _cachedData = null;

// ─── Bootstrap ───────────────────────────────────────────────────────────────
tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => setError(err.message || String(err)));

async function fetchData(worksheet) {
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
  try { return await reader.getAllPagesAsync(); }
  finally { await reader.releaseAsync(); }
}

async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    _cachedData = parseTableauData(dataTable, vizSpec);
    drawChart(_cachedData);
  } catch (err) { setError(err.message || String(err)); }
}

// ─── Toolbar controls ────────────────────────────────────────────────────────
function getConfig() {
  return {
    colorScheme:    document.getElementById('colorScheme').value,
    thresh1:        Number(document.getElementById('thresh1').value) / 100 || 0.50,
    thresh2:        Number(document.getElementById('thresh2').value) / 100 || 0.80,
    showTargetLabel:document.getElementById('btnTargetLabel').classList.contains('active'),
    arcThickness:   Number(document.getElementById('arcThickness').value) || 0.20,
  };
}

function redraw() {
  if (_cachedData) drawChart(_cachedData);
}

['thresh1', 'thresh2'].forEach(id => {
  document.getElementById(id).addEventListener('input', redraw);
});
['colorScheme', 'arcThickness'].forEach(id => {
  document.getElementById(id).addEventListener('change', redraw);
});
document.getElementById('btnTargetLabel').addEventListener('click', e => {
  e.currentTarget.classList.toggle('active');
  redraw();
});

// ─── Parse ────────────────────────────────────────────────────────────────────
function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection?.[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;
  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const valueField  = fieldName('value');
  const targetField = fieldName('target');
  const labelField  = fieldName('label');
  const minField    = fieldName('min');
  const maxField    = fieldName('max');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!valueField  || !(valueField  in colIndex)) throw new Error('Drag a measure onto the "Current Value" encoding slot.');
  if (!targetField || !(targetField in colIndex)) throw new Error('Drag a measure onto the "Target / Goal" encoding slot.');

  const vi = colIndex[valueField];
  const ti = colIndex[targetField];
  const li = labelField && labelField in colIndex ? colIndex[labelField] : null;
  const mni = minField  && minField  in colIndex ? colIndex[minField]  : null;
  const mxi = maxField  && maxField  in colIndex ? colIndex[maxField]  : null;

  return dataTable.data.map(row => {
    const value  = Number(row[vi].value);
    const target = Number(row[ti].value);
    const label  = li  !== null ? String(row[li].value)  : 'KPI';
    const minVal = mni !== null ? Number(row[mni].value) : 0;
    const maxVal = mxi !== null ? Number(row[mxi].value) : target * 1.25;
    return { value, target, label, minVal, maxVal };
  }).filter(r => !Number.isNaN(r.value) && !Number.isNaN(r.target));
}

// ─── Color logic ─────────────────────────────────────────────────────────────
function gaugeColor(pct, cfg) {
  if (cfg.colorScheme === 'blue') {
    return d3.interpolateBlues(0.4 + pct * 0.5);
  }
  // Traffic light
  if (pct >= 1.0) return '#27ae60';       // over-target: darker green
  if (pct >= cfg.thresh2) return '#2ecc71'; // green
  if (pct >= cfg.thresh1) return '#f39c12'; // amber
  return '#e74c3c';                          // red
}

// ─── Draw ────────────────────────────────────────────────────────────────────
function drawChart(data) {
  const cfg = getConfig();
  const container = document.getElementById('chart');
  const toolbar   = document.getElementById('toolbar');
  const W = window.innerWidth;
  const H = window.innerHeight - toolbar.offsetHeight;

  d3.select('#chart').selectAll('svg').remove();

  // Tile gauges: up to 4 across
  const n = data.length;
  const cols = Math.min(n, 4);
  const cellW = W / cols;
  const cellH = H;
  const radius = Math.min(cellW, cellH * 1.2) * 0.38;
  const thickness = radius * cfg.arcThickness;

  const svg = d3.select('#chart').append('svg')
    .attr('width', W)
    .attr('height', H);

  const tooltip = d3.select('#tooltip');

  data.forEach((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = cellW * col + cellW / 2;
    const cy = cellH * row + cellH * 0.55;

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // Clamp value to [minVal, maxVal] for arc; allow over-target visually
    const scaleMin = d.minVal;
    const scaleMax = d.maxVal;
    const valueClamp = Math.max(scaleMin, Math.min(scaleMax, d.value));
    const pctOfRange = (valueClamp - scaleMin) / (scaleMax - scaleMin);
    const pctOfTarget = d.target > 0 ? d.value / d.target : 0;

    const valueAngle = GAUGE_START + GAUGE_SPAN * pctOfRange;
    const targetAngle = GAUGE_START + GAUGE_SPAN * ((d.target - scaleMin) / (scaleMax - scaleMin));
    const color = gaugeColor(pctOfTarget, cfg);

    // Background track arc
    const trackArc = d3.arc()
      .innerRadius(radius - thickness)
      .outerRadius(radius)
      .startAngle(GAUGE_START)
      .endAngle(GAUGE_END);

    g.append('path')
      .attr('d', trackArc())
      .attr('fill', '#e8e8e8');

    // Value arc
    const valueArc = d3.arc()
      .innerRadius(radius - thickness)
      .outerRadius(radius)
      .startAngle(GAUGE_START)
      .endAngle(valueAngle)
      .cornerRadius(2);

    g.append('path')
      .attr('d', valueArc())
      .attr('fill', color);

    // Target tick mark
    if (cfg.showTargetLabel) {
      const tickR1 = radius + 4;
      const tickR2 = radius - thickness - 4;
      const tx1 = tickR1 * Math.sin(targetAngle);
      const ty1 = -tickR1 * Math.cos(targetAngle);
      const tx2 = tickR2 * Math.sin(targetAngle);
      const ty2 = -tickR2 * Math.cos(targetAngle);

      g.append('line')
        .attr('x1', tx1).attr('y1', ty1)
        .attr('x2', tx2).attr('y2', ty2)
        .attr('stroke', '#555')
        .attr('stroke-width', 2);

      // Target label text
      const labelR = radius + 16;
      const lx = labelR * Math.sin(targetAngle);
      const ly = -labelR * Math.cos(targetAngle);
      g.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 9)
        .attr('fill', '#777')
        .text(`Target: ${fmtVal(d.target)}`);
    }

    // Needle: line from center to arc edge at value angle
    const needleLen = radius - thickness / 2;
    const nx = needleLen * Math.sin(valueAngle);
    const ny = -needleLen * Math.cos(valueAngle);

    g.append('line')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', nx).attr('y2', ny)
      .attr('stroke', '#444')
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round');

    // Needle hub
    g.append('circle')
      .attr('r', 5)
      .attr('fill', '#444');

    // Center text: large value
    const pctStr = `${Math.round(pctOfTarget * 100)}%`;
    g.append('text')
      .attr('y', -radius * 0.12)
      .attr('text-anchor', 'middle')
      .attr('font-size', radius * 0.28)
      .attr('font-weight', '600')
      .attr('fill', color)
      .text(fmtVal(d.value));

    // Percent of target below
    g.append('text')
      .attr('y', radius * 0.12)
      .attr('text-anchor', 'middle')
      .attr('font-size', radius * 0.14)
      .attr('fill', '#777')
      .text(`${pctStr} of target`);

    // Over-target indicator
    if (d.value > d.target) {
      g.append('text')
        .attr('y', radius * 0.28)
        .attr('text-anchor', 'middle')
        .attr('font-size', radius * 0.12)
        .attr('fill', '#27ae60')
        .attr('font-weight', '600')
        .text('▲ Over target');
    }

    // KPI label below gauge
    g.append('text')
      .attr('y', radius * 0.55)
      .attr('text-anchor', 'middle')
      .attr('font-size', Math.min(14, radius * 0.15))
      .attr('fill', '#333')
      .attr('font-weight', '500')
      .text(d.label);

    // Scale min/max labels at arc ends
    const minLabelR = radius + 10;
    const minLx = minLabelR * Math.sin(GAUGE_START);
    const minLy = -minLabelR * Math.cos(GAUGE_START);
    const maxLx = minLabelR * Math.sin(GAUGE_END);
    const maxLy = -minLabelR * Math.cos(GAUGE_END);

    g.append('text').attr('x', minLx).attr('y', minLy + 4)
      .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#aaa')
      .text(fmtVal(scaleMin));
    g.append('text').attr('x', maxLx).attr('y', maxLy + 4)
      .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#aaa')
      .text(fmtVal(scaleMax));

    // Hover tooltip
    const hitArea = d3.arc()
      .innerRadius(0)
      .outerRadius(radius + 20)
      .startAngle(GAUGE_START)
      .endAngle(GAUGE_END);

    g.append('path')
      .attr('d', hitArea())
      .attr('fill', 'transparent')
      .on('mouseenter', event => {
        tooltip
          .style('display', 'block')
          .html(`<div class="tt-title">${d.label}</div>
                 <div>Value: ${fmtVal(d.value)}</div>
                 <div>Target: ${fmtVal(d.target)}</div>
                 <div>% of Target: ${Math.round(pctOfTarget * 100)}%</div>
                 <div>Scale: ${fmtVal(scaleMin)} – ${fmtVal(scaleMax)}</div>`);
      })
      .on('mousemove', event => {
        tooltip
          .style('left', `${event.clientX + 14}px`)
          .style('top',  `${event.clientY - 28}px`);
      })
      .on('mouseleave', () => tooltip.style('display', 'none'));
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtVal(v) {
  if (Math.abs(v) >= 1000) return d3.format(',.0f')(v);
  if (Math.abs(v) < 1) return d3.format('.1%')(v);
  return d3.format(',.1f')(v);
}

function setError(msg) {
  document.getElementById('error').textContent = msg;
}
function clearError() {
  document.getElementById('error').textContent = '';
}

window.addEventListener('resize', () => { if (_cachedData) drawChart(_cachedData); });
