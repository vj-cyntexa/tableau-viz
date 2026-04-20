'use strict';

// ─── Layout constants ─────────────────────────────────────────────────────────
const MARGIN = { top: 30, right: 160, bottom: 70, left: 75 };
const COLORS = d3.schemeTableau10;
const TRANSITION_MS = 300;

// ─── Application state ────────────────────────────────────────────────────────
let mode = 'stacked'; // 'stacked' | 'grouped'

// ─── Bootstrap ───────────────────────────────────────────────────────────────
tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;

  // Wire toggle button
  const btn = document.getElementById('toggle-btn');
  btn.addEventListener('click', () => {
    mode = (mode === 'stacked') ? 'grouped' : 'stacked';
    btn.textContent = (mode === 'stacked') ? 'Switch to Grouped' : 'Switch to Stacked';
    render(ws);
  });

  // Listen for data changes
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
    const parsed = parseTableauData(dataTable, vizSpec);
    drawChart(parsed);
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
// Returns:
//   {
//     xKeys:     string[]          — ordered x-axis category labels
//     colorKeys: string[]          — ordered color/group keys
//     wideData:  Array<{ x, <colorKey>: number, ... }>  — one obj per x-category
//   }
function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(encodingId) {
    const enc = encodings.find(e => e.id === encodingId);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const xField     = fieldName('x');
  const yField     = fieldName('y');
  const colorField = fieldName('color');

  const colIndex = Object.fromEntries(
    dataTable.columns.map(c => [c.fieldName, c.index])
  );

  if (!xField || !(xField in colIndex)) {
    throw new Error('Drag a categorical dimension onto the "Category (X Axis)" encoding slot.');
  }
  if (!yField || !(yField in colIndex)) {
    throw new Error('Drag a numeric measure onto the "Value (Y Axis)" encoding slot.');
  }
  if (!colorField || !(colorField in colIndex)) {
    throw new Error('Drag a categorical dimension onto the "Group / Stack" encoding slot.');
  }

  const xi = colIndex[xField];
  const yi = colIndex[yField];
  const ci = colIndex[colorField];

  // Aggregate: sum y by (x, color) in case of duplicate rows
  const agg = d3.rollup(
    dataTable.data,
    rows => d3.sum(rows, row => +row[yi].value || 0),
    row  => String(row[xi].value),
    row  => String(row[ci].value)
  );

  if (!agg.size) throw new Error('No valid rows found. Check field types on the encoding slots.');

  // Determine ordered keys (preserve insertion order from source data)
  const xKeys     = [...agg.keys()];
  const colorKeys = [...new Set(dataTable.data.map(row => String(row[ci].value)))];

  // Build wide format: [{ x: 'Cat A', 'Group1': 100, 'Group2': 200, ... }, ...]
  const wideData = xKeys.map(x => {
    const obj = { x };
    colorKeys.forEach(ck => {
      obj[ck] = agg.get(x)?.get(ck) ?? 0;
    });
    return obj;
  });

  return { xKeys, colorKeys, wideData };
}

// ─── Drawing ─────────────────────────────────────────────────────────────────
function drawChart({ xKeys, colorKeys, wideData }) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top - MARGIN.bottom;

  // ── Color scale (stable across mode switches) ───────────────────────────
  const colorScale = d3.scaleOrdinal()
    .domain(colorKeys)
    .range(COLORS);

  // ── X scale (outer band) ────────────────────────────────────────────────
  const xScale = d3.scaleBand()
    .domain(xKeys)
    .range([0, w])
    .padding(0.25);

  // ── Inner scale for grouped mode ────────────────────────────────────────
  const xInner = d3.scaleBand()
    .domain(colorKeys)
    .range([0, xScale.bandwidth()])
    .padding(0.08);

  // ── Y scales (different for each mode) ─────────────────────────────────
  // Stacked: max = greatest sum of all colors per x category
  const stackedMax = d3.max(wideData, d =>
    d3.sum(colorKeys, ck => d[ck])
  );

  // Grouped: max = greatest individual value
  const groupedMax = d3.max(wideData, d =>
    d3.max(colorKeys, ck => d[ck])
  );

  const yMax = (mode === 'stacked') ? stackedMax : groupedMax;

  const yScale = d3.scaleLinear()
    .domain([0, yMax * 1.1])
    .nice()
    .range([h, 0]);

  // ── Stacked layout ──────────────────────────────────────────────────────
  const stack = d3.stack().keys(colorKeys);
  const stackedSeries = stack(wideData);

  // ── Build or update SVG ─────────────────────────────────────────────────
  const svgId = 'bar-chart-svg';
  let svg = d3.select(container).select(`#${svgId}`);
  let isNew = false;

  if (svg.empty()) {
    isNew = true;
    svg = d3.select(container)
      .append('svg')
      .attr('id', svgId)
      .attr('width', W)
      .attr('height', H);
  } else {
    svg.attr('width', W).attr('height', H);
  }

  // Root group
  let g = svg.select('.root-g');
  if (g.empty()) {
    g = svg.append('g')
      .attr('class', 'root-g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
  }

  // ── Grid lines ──────────────────────────────────────────────────────────
  let gridG = g.select('.grid');
  if (gridG.empty()) {
    gridG = g.append('g').attr('class', 'grid');
  }
  gridG.transition().duration(TRANSITION_MS)
    .call(d3.axisLeft(yScale).tickSize(-w).tickFormat(''))
    .call(grp => grp.select('.domain').remove());

  // ── X axis ──────────────────────────────────────────────────────────────
  let xAxisG = g.select('.x-axis');
  if (xAxisG.empty()) {
    xAxisG = g.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${h})`);
  }
  xAxisG.call(d3.axisBottom(xScale).tickSizeOuter(0))
    .selectAll('text')
    .attr('dy', '1.2em');

  // ── Y axis ──────────────────────────────────────────────────────────────
  let yAxisG = g.select('.y-axis');
  if (yAxisG.empty()) {
    yAxisG = g.append('g').attr('class', 'axis y-axis');
  }
  yAxisG.transition().duration(TRANSITION_MS)
    .call(d3.axisLeft(yScale).ticks(6).tickSizeOuter(0).tickFormat(d3.format('~s')));

  // ── Tooltip ──────────────────────────────────────────────────────────────
  let tooltip = d3.select(container).select('.tooltip');
  if (tooltip.empty()) {
    tooltip = d3.select(container)
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute');
  }

  const fmtNum = d3.format(',~f');

  function showTooltip(event, xCat, colorKey, value) {
    tooltip
      .style('opacity', 1)
      .style('left', `${event.offsetX + 14}px`)
      .style('top',  `${event.offsetY - 10}px`)
      .html(
        `<div class="tt-cat">${xCat}</div>` +
        `<span style="color:${colorScale(colorKey)}">&#9679;</span>&nbsp;` +
        `${colorKey}: <b>${fmtNum(value)}</b>`
      );
  }

  function hideTooltip() {
    tooltip.style('opacity', 0);
  }

  // ── Bar groups ──────────────────────────────────────────────────────────
  // We key each rect by "xCat|colorKey" so D3 can transition without teardown.
  // Each colored layer (stacked series) corresponds to one colorKey.

  const layerSel = g.selectAll('.bar-layer')
    .data(stackedSeries, d => d.key);

  const layerEnter = layerSel.enter()
    .append('g')
    .attr('class', 'bar-layer')
    .attr('fill', d => colorScale(d.key));

  const layerMerge = layerEnter.merge(layerSel);

  // For each layer, bind rects (one per x-category)
  layerMerge.each(function(layerData) {
    const colorKey = layerData.key;
    const colorIdx = colorKeys.indexOf(colorKey);
    const layer = d3.select(this);

    const rectSel = layer.selectAll('.bar-rect')
      .data(layerData, d => d.data.x);

    const rectEnter = rectSel.enter()
      .append('rect')
      .attr('class', 'bar-rect')
      .attr('rx', 2);

    // Initial position for entering rects: at the bottom (height 0)
    if (isNew) {
      rectEnter
        .attr('x',      d => computeX(d.data.x, colorIdx))
        .attr('y',      h)
        .attr('width',  computeWidth(colorIdx))
        .attr('height', 0);
    } else {
      rectEnter
        .attr('x',      d => computeX(d.data.x, colorIdx))
        .attr('y',      h)
        .attr('width',  computeWidth(colorIdx))
        .attr('height', 0);
    }

    rectEnter.merge(rectSel)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.8);
        const val = mode === 'stacked'
          ? d[1] - d[0]
          : d.data[colorKey];
        showTooltip(event, d.data.x, colorKey, val);
      })
      .on('mousemove', function(event, d) {
        tooltip
          .style('left', `${event.offsetX + 14}px`)
          .style('top',  `${event.offsetY - 10}px`);
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 1);
        hideTooltip();
      })
      .transition()
      .duration(TRANSITION_MS)
      .attr('x',      d => computeX(d.data.x, colorIdx))
      .attr('y',      d => computeY(d, colorKey))
      .attr('width',  computeWidth(colorIdx))
      .attr('height', d => computeHeight(d, colorKey));

    rectSel.exit()
      .transition().duration(TRANSITION_MS)
      .attr('y', h).attr('height', 0)
      .remove();
  });

  layerSel.exit().remove();

  // ── Legend ───────────────────────────────────────────────────────────────
  let legendG = g.select('.legend');
  if (legendG.empty()) {
    legendG = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${w + 18}, 0)`);
  }

  const legendItems = legendG.selectAll('.legend-item')
    .data(colorKeys, d => d);

  const legendEnter = legendItems.enter()
    .append('g')
    .attr('class', 'legend-item');

  legendEnter.append('rect')
    .attr('width', 14)
    .attr('height', 14)
    .attr('rx', 2)
    .attr('y', -1);

  legendEnter.append('text')
    .attr('x', 20)
    .attr('y', 11);

  const legendMerge = legendEnter.merge(legendItems);

  legendMerge
    .attr('transform', (d, i) => `translate(0,${i * 22})`)
    .select('rect')
      .attr('fill', d => colorScale(d));

  legendMerge
    .select('text')
      .text(d => d);

  legendItems.exit().remove();

  // ── Layout helpers ────────────────────────────────────────────────────────
  // These are called during transitions so must close over current mode/scales.

  function computeX(xCat, colorIdx) {
    if (mode === 'stacked') {
      return xScale(xCat);
    } else {
      return xScale(xCat) + xInner(colorKeys[colorIdx]);
    }
  }

  function computeWidth(colorIdx) {
    if (mode === 'stacked') {
      return xScale.bandwidth();
    } else {
      return xInner.bandwidth();
    }
  }

  function computeY(d, colorKey) {
    if (mode === 'stacked') {
      return yScale(d[1]);
    } else {
      return yScale(d.data[colorKey]);
    }
  }

  function computeHeight(d, colorKey) {
    if (mode === 'stacked') {
      return Math.max(0, yScale(d[0]) - yScale(d[1]));
    } else {
      return Math.max(0, h - yScale(d.data[colorKey]));
    }
  }
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
