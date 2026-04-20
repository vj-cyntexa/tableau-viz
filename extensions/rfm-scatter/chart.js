'use strict';

const MARGIN = { top: 30, right: 160, bottom: 55, left: 70 };
const COLORS = d3.schemeTableau10;

// RFM quadrant labels (top-right = champions, etc.)
const QUADRANT_LABELS = [
  { qx: 'right', qy: 'top',    text: 'Champions' },
  { qx: 'left',  qy: 'top',    text: 'Loyal / At Risk' },
  { qx: 'right', qy: 'bottom', text: 'Recent Low-Freq' },
  { qx: 'left',  qy: 'bottom', text: 'Lost / Hibernating' },
];

window.RFM_STATE = {
  showQuadrants: true,
  recThreshold: null,    // null = auto (median)
  freqThreshold: null,   // null = auto (median)
  maxRadius: 28,
  recentRight: true,     // true = lower recency value plots on right
  lastData: null,
  redraw() { if (this.lastData) drawChart(this.lastData); },
};

tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => setError(err.message || String(err)));

async function fetchData(worksheet) {
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
  try {
    return await reader.getAllPagesAsync();
  } finally {
    await reader.releaseAsync();
  }
}

async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    const parsed = parseTableauData(dataTable, vizSpec);
    window.RFM_STATE.lastData = parsed;
    drawChart(parsed);
  } catch (err) {
    setError(err.message || String(err));
  }
}

function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');
  const encodings = marksSpec.encodingCollection;

  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const recencyField   = fieldName('recency');
  const frequencyField = fieldName('frequency');
  const monetaryField  = fieldName('monetary');
  const segmentField   = fieldName('segment');
  const labelField     = fieldName('label');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!recencyField   || !(recencyField in colIndex))   throw new Error('Drag a measure onto "Recency" encoding slot.');
  if (!frequencyField || !(frequencyField in colIndex)) throw new Error('Drag a measure onto "Frequency" encoding slot.');
  if (!monetaryField  || !(monetaryField in colIndex))  throw new Error('Drag a measure onto "Monetary" encoding slot.');
  if (!segmentField   || !(segmentField in colIndex))   throw new Error('Drag a dimension onto "RFM Segment" encoding slot.');

  const ri = colIndex[recencyField];
  const fi = colIndex[frequencyField];
  const mi = colIndex[monetaryField];
  const si = colIndex[segmentField];
  const li = labelField && (labelField in colIndex) ? colIndex[labelField] : null;

  const points = dataTable.data
    .map(row => ({
      recency:   Number(row[ri].value),
      frequency: Number(row[fi].value),
      monetary:  Number(row[mi].value),
      segment:   String(row[si].value),
      label:     li !== null ? String(row[li].value) : '',
    }))
    .filter(r => !Number.isNaN(r.recency) && !Number.isNaN(r.frequency) && !Number.isNaN(r.monetary));

  if (!points.length) throw new Error('No valid rows. Check field types on encoding slots.');

  const segments = Array.from(new Set(points.map(p => p.segment)));
  return { points, segments };
}

function drawChart({ points, segments }) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top - MARGIN.bottom;

  d3.select(container).selectAll('*').remove();

  const { showQuadrants, recThreshold, freqThreshold, maxRadius, recentRight } = window.RFM_STATE;

  const recValues  = points.map(p => p.recency);
  const freqValues = points.map(p => p.frequency);
  const monValues  = points.map(p => p.monetary);

  const medRec  = recThreshold  !== null ? recThreshold  : d3.median(recValues);
  const medFreq = freqThreshold !== null ? freqThreshold : d3.median(freqValues);

  // X scale: recentRight = true means smaller recency → right side (reverse domain)
  const recExtent = d3.extent(recValues);
  const xDomain = recentRight
    ? [recExtent[1] * 1.05, Math.max(0, recExtent[0] * 0.9)]   // reversed: high on left, low on right
    : [Math.max(0, recExtent[0] * 0.9), recExtent[1] * 1.05];

  const x = d3.scaleLinear().domain(xDomain).range([0, w]).nice();
  const y = d3.scaleLinear().domain([0, d3.max(freqValues) * 1.1]).range([h, 0]).nice();

  const sizeScale = d3.scaleSqrt()
    .domain([0, d3.max(monValues)])
    .range([4, maxRadius]);

  const color = d3.scaleOrdinal().domain(segments).range(COLORS);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H);

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Grid
  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-w).tickFormat(''))
    .call(grp => grp.select('.domain').remove());

  // Axes
  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6).tickSizeOuter(0).tickFormat(d3.format('d')));

  g.append('g')
    .attr('class', 'axis y-axis')
    .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0).tickFormat(d3.format('d')));

  // Axis labels
  g.append('text')
    .attr('x', w / 2).attr('y', h + 42)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px').attr('fill', '#555')
    .text(recentRight ? 'Recency (days) — Recent →' : '← Recent — Recency (days)');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -52)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px').attr('fill', '#555')
    .text('Frequency (purchases)');

  // Quadrant lines
  if (showQuadrants) {
    const qx = x(medRec);
    const qy = y(medFreq);

    g.append('line')
      .attr('class', 'quadrant-line')
      .attr('x1', qx).attr('x2', qx)
      .attr('y1', 0).attr('y2', h);

    g.append('line')
      .attr('class', 'quadrant-line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', qy).attr('y2', qy);

    // Quadrant labels
    const padding = 6;
    QUADRANT_LABELS.forEach(ql => {
      const lx = ql.qx === 'right'
        ? (recentRight ? Math.max(padding, qx - 80) : qx + padding)
        : (recentRight ? qx + padding : Math.max(padding, qx - 80));
      const ly = ql.qy === 'top' ? qy - padding : qy + 14;
      g.append('text')
        .attr('class', 'quadrant-label')
        .attr('x', lx).attr('y', ly)
        .text(ql.text);
    });
  }

  // Tooltip
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  const fmtMoney = d3.format('$,.0f');
  const fmtNum   = d3.format(',d');

  // Bubbles — sort largest first so smaller bubbles render on top
  const sortedPoints = [...points].sort((a, b) => b.monetary - a.monetary);

  g.append('g')
    .attr('class', 'bubbles')
    .selectAll('circle')
    .data(sortedPoints)
    .join('circle')
    .attr('class', 'bubble')
    .attr('cx', d => x(d.recency))
    .attr('cy', d => y(d.frequency))
    .attr('r', d => sizeScale(d.monetary))
    .attr('fill', d => color(d.segment))
    .on('mouseenter', function (event, d) {
      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${event.offsetY - 10}px`)
        .html(`<div class="tt-title">${d.label || d.segment}</div>
               Segment: <b>${d.segment}</b><br>
               Recency: <b>${fmtNum(d.recency)} days</b><br>
               Frequency: <b>${fmtNum(d.frequency)} purchases</b><br>
               Monetary: <b>${fmtMoney(d.monetary)}</b>`);
    })
    .on('mousemove', function (event) {
      tooltip
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${event.offsetY - 10}px`);
    })
    .on('mouseleave', () => tooltip.style('opacity', 0));

  // Legend
  const legend = g.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${w + 18}, 0)`);

  segments.forEach((seg, i) => {
    const row = legend.append('g').attr('transform', `translate(0,${i * 20})`);
    row.append('circle')
      .attr('cx', 6).attr('cy', 6).attr('r', 5)
      .attr('fill', color(seg));
    row.append('text')
      .attr('x', 16).attr('y', 10)
      .text(seg);
  });
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.RFM_STATE.lastData) drawChart(window.RFM_STATE.lastData);
  }, 150);
});

function setError(msg) {
  const el = document.getElementById('error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearError() {
  const el = document.getElementById('error');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}
