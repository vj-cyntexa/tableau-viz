'use strict';

// ─── Layout constants ─────────────────────────────────────────────────────────
const COLORS = d3.schemeTableau10;
const TRANSITION_MS = 300;

// ─── Application state ────────────────────────────────────────────────────────
let layout = 'stacked';       // 'stacked' | 'grouped' | 'pct'
let orientation = 'vertical'; // 'vertical' | 'horizontal'
let lastSeries = null;
let showAvgLine = false;
let avgLineColor = '#e74c3c';

// ─── Bootstrap ───────────────────────────────────────────────────────────────
tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;

  // Wire layout buttons
  document.querySelectorAll('[data-layout]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!lastSeries) return;
      layout = btn.dataset.layout;
      if (layout === 'pct') {
        orientation = 'vertical';
        // Sync orient buttons to show Vertical as active
        document.querySelectorAll('[data-orient]').forEach(b => {
          b.classList.toggle('active', b.dataset.orient === 'vertical');
        });
      }
      document.querySelectorAll('[data-layout]').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('orient-group').style.opacity = layout === 'pct' ? '0.4' : '1';
      drawChart(lastSeries);
    });
  });

  // Wire orientation buttons
  document.querySelectorAll('[data-orient]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!lastSeries) return;
      if (layout === 'pct') return;
      orientation = btn.dataset.orient;
      document.querySelectorAll('[data-orient]').forEach(b => b.classList.toggle('active', b === btn));
      drawChart(lastSeries);
    });
  });

  // Wire avg line controls
  const avgToggle = document.getElementById('avg-toggle');
  const avgColorPicker = document.getElementById('avg-color');

  avgToggle.addEventListener('change', () => {
    showAvgLine = avgToggle.checked;
    if (lastSeries) drawChart(lastSeries);
  });
  avgColorPicker.addEventListener('input', () => {
    avgLineColor = avgColorPicker.value;
    if (showAvgLine && lastSeries) drawChart(lastSeries);
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
    lastSeries = parsed;
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
  const marksSpec = vizSpec.marksSpecificationCollection?.[0];
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

  // Dynamic margin based on orientation
  const MARGIN = orientation === 'horizontal'
    ? { top: 20, right: 160, bottom: 50, left: 120 }
    : { top: 30, right: 160, bottom: 60, left: 75 };

  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top - MARGIN.bottom;

  // ── Color scale (stable across mode switches) ───────────────────────────
  const colorScale = d3.scaleOrdinal()
    .domain(colorKeys)
    .range(COLORS);

  // ── Normalize data for pct mode ─────────────────────────────────────────
  const pctData = wideData.map(d => {
    const total = d3.sum(colorKeys, ck => d[ck]);
    const obj = { x: d.x };
    colorKeys.forEach(ck => {
      obj[ck] = total > 0 ? d[ck] / total : 0;
    });
    return obj;
  });

  // ── Stack layout ────────────────────────────────────────────────────────
  const stack = d3.stack().keys(colorKeys);
  const stackedSeries   = stack(wideData);
  const pctSeries       = stack(pctData);

  // ── Build or update SVG ─────────────────────────────────────────────────
  const svgId = 'bar-chart-svg';
  let svg = d3.select(container).select(`#${svgId}`);

  if (svg.empty()) {
    svg = d3.select(container)
      .append('svg')
      .attr('id', svgId)
      .attr('width', W)
      .attr('height', H);
  } else {
    svg.attr('width', W).attr('height', H);
  }

  // Root group — recreate on each render to reset transform cleanly
  svg.selectAll('.root-g').remove();
  const g = svg.append('g')
    .attr('class', 'root-g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // ── Tooltip ──────────────────────────────────────────────────────────────
  d3.select(container).selectAll('.tooltip').remove();
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0)
    .style('position', 'absolute');

  const fmtNum = d3.format(',~f');
  const fmtPct = d3.format('.1%');

  function showTooltip(event, xCat, colorKey, value) {
    const displayVal = layout === 'pct' ? fmtPct(value) : fmtNum(value);
    tooltip
      .style('opacity', 1)
      .style('left', `${event.offsetX + 14}px`)
      .style('top',  `${event.offsetY - 10}px`)
      .html(
        `<div class="tt-cat">${xCat}</div>` +
        `<span style="color:${colorScale(colorKey)}">&#9679;</span>&nbsp;` +
        `${colorKey}: <b>${displayVal}</b>`
      );
  }

  function hideTooltip() {
    tooltip.style('opacity', 0);
  }

  // ── Branch by orientation ────────────────────────────────────────────────
  if (orientation === 'vertical') {
    drawVertical();
  } else {
    drawHorizontal();
  }

  // ── Legend (shared) ──────────────────────────────────────────────────────
  const legendG = g.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${w + 18}, 0)`);

  colorKeys.forEach((ck, i) => {
    const item = legendG.append('g')
      .attr('class', 'legend-item')
      .attr('transform', `translate(0,${i * 22})`);

    item.append('rect')
      .attr('width', 14)
      .attr('height', 14)
      .attr('rx', 2)
      .attr('y', -1)
      .attr('fill', colorScale(ck));

    item.append('text')
      .attr('class', 'legend text')
      .attr('x', 20)
      .attr('y', 11)
      .text(ck);
  });

  // ════════════════════════════════════════════════════════════════════════
  // VERTICAL drawing (layout = stacked | grouped | pct)
  // ════════════════════════════════════════════════════════════════════════
  function drawVertical() {
    // X scale (outer band)
    const xScale = d3.scaleBand()
      .domain(xKeys)
      .range([0, w])
      .padding(0.25);

    // Inner scale for grouped mode
    const xInner = d3.scaleBand()
      .domain(colorKeys)
      .range([0, xScale.bandwidth()])
      .padding(0.08);

    // Y scale
    let yMax, yDomain, yFmt;
    if (layout === 'pct') {
      yDomain = [0, 1];
      yFmt    = d3.format('.0%');
    } else if (layout === 'stacked') {
      yMax    = d3.max(wideData, d => d3.sum(colorKeys, ck => d[ck]));
      yDomain = [0, yMax * 1.1];
      yFmt    = d3.format('~s');
    } else {
      // grouped
      yMax    = d3.max(wideData, d => d3.max(colorKeys, ck => d[ck]));
      yDomain = [0, yMax * 1.1];
      yFmt    = d3.format('~s');
    }

    const yScale = d3.scaleLinear()
      .domain(yDomain)
      .range([h, 0]);

    if (layout !== 'pct') yScale.nice();

    // Grid
    const gridG = g.append('g').attr('class', 'grid');
    gridG.call(
      d3.axisLeft(yScale).tickSize(-w).tickFormat('')
    ).call(grp => grp.select('.domain').remove());

    // X axis
    g.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(xScale).tickSizeOuter(0))
      .selectAll('text')
        .attr('dy', '1.2em');

    // Y axis
    g.append('g')
      .attr('class', 'axis y-axis')
      .call(d3.axisLeft(yScale).ticks(6).tickSizeOuter(0).tickFormat(yFmt));

    // Bars
    const activeSeries = layout === 'pct' ? pctSeries : stackedSeries;

    activeSeries.forEach(layerData => {
      const colorKey = layerData.key;
      const colorIdx = colorKeys.indexOf(colorKey);

      const layer = g.append('g')
        .attr('class', 'bar-layer')
        .attr('fill', colorScale(colorKey));

      layer.selectAll('.bar-rect')
        .data(layerData, d => d.data.x)
        .join(
          enter => enter.append('rect')
            .attr('class', 'bar-rect')
            .attr('rx', 2)
            .attr('x',      d => vComputeX(d.data.x, colorIdx, xScale, xInner))
            .attr('y',      h)
            .attr('width',  vComputeWidth(colorIdx, xScale, xInner))
            .attr('height', 0)
            .call(sel => sel.transition().duration(TRANSITION_MS)
              .attr('y',      d => vComputeY(d, colorKey, yScale))
              .attr('height', d => vComputeHeight(d, colorKey, h, yScale))
            ),
          update => update
            .call(sel => sel.transition().duration(TRANSITION_MS)
              .attr('x',      d => vComputeX(d.data.x, colorIdx, xScale, xInner))
              .attr('y',      d => vComputeY(d, colorKey, yScale))
              .attr('width',  vComputeWidth(colorIdx, xScale, xInner))
              .attr('height', d => vComputeHeight(d, colorKey, h, yScale))
            ),
          exit => exit.transition().duration(TRANSITION_MS)
            .attr('y', h).attr('height', 0).remove()
        )
        .on('mouseover', function(event, d) {
          d3.select(this).attr('opacity', 0.8);
          const val = (layout === 'stacked' || layout === 'pct')
            ? d[1] - d[0]
            : d.data[colorKey];
          showTooltip(event, d.data.x, colorKey, val);
        })
        .on('mousemove', function(event) {
          tooltip
            .style('left', `${event.offsetX + 14}px`)
            .style('top',  `${event.offsetY - 10}px`);
        })
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 1);
          hideTooltip();
        });
    });

    // ── Average reference line ──────────────────────────────────────────────
    if (showAvgLine && layout !== 'pct') {
      const allValues = wideData.flatMap(d => colorKeys.map(ck => d[ck]));
      const avg = d3.mean(allValues);
      const yAvg = yScale(avg);

      g.append('line')
        .attr('class', 'avg-line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', yAvg).attr('y2', yAvg)
        .attr('stroke', avgLineColor)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6 4')
        .attr('opacity', 0.85);

      g.append('text')
        .attr('class', 'avg-label-text')
        .attr('x', w + 4)
        .attr('y', yAvg + 4)
        .attr('fill', avgLineColor)
        .attr('font-size', '11px')
        .text(`Avg: ${d3.format(',.0f')(avg)}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // HORIZONTAL drawing (layout = stacked | grouped only; pct forces vertical)
  // ════════════════════════════════════════════════════════════════════════
  function drawHorizontal() {
    // Y scale (band — categories)
    const yScale = d3.scaleBand()
      .domain(xKeys)
      .range([0, h])
      .padding(0.25);

    // Inner scale for grouped mode
    const yInner = d3.scaleBand()
      .domain(colorKeys)
      .range([0, yScale.bandwidth()])
      .padding(0.08);

    // X scale (linear — values)
    let xMax;
    if (layout === 'stacked') {
      xMax = d3.max(wideData, d => d3.sum(colorKeys, ck => d[ck]));
    } else {
      xMax = d3.max(wideData, d => d3.max(colorKeys, ck => d[ck]));
    }

    const xScale = d3.scaleLinear()
      .domain([0, xMax * 1.1])
      .nice()
      .range([0, w]);

    // Grid — translated to bottom (y=h), ticks go upward (-h)
    const gridG = g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${h})`);
    gridG.call(
      d3.axisBottom(xScale).tickSize(-h).tickFormat('')
    ).call(grp => grp.select('.domain').remove());

    // X axis (bottom, numeric)
    g.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(xScale).ticks(6).tickSizeOuter(0).tickFormat(d3.format('~s')));

    // Y axis (left, categorical)
    g.append('g')
      .attr('class', 'axis y-axis')
      .call(d3.axisLeft(yScale).tickSizeOuter(0));

    // Bars
    stackedSeries.forEach(layerData => {
      const colorKey = layerData.key;
      const colorIdx = colorKeys.indexOf(colorKey);

      const layer = g.append('g')
        .attr('class', 'bar-layer')
        .attr('fill', colorScale(colorKey));

      layer.selectAll('.bar-rect')
        .data(layerData, d => d.data.x)
        .join(
          enter => enter.append('rect')
            .attr('class', 'bar-rect')
            .attr('rx', 2)
            .attr('x',      0)
            .attr('y',      d => hComputeY(d.data.x, colorIdx, yScale, yInner))
            .attr('width',  0)
            .attr('height', hComputeHeight(colorIdx, yScale, yInner))
            .call(sel => sel.transition().duration(TRANSITION_MS)
              .attr('x',     d => hComputeX(d, colorKey, xScale))
              .attr('width', d => hComputeWidth(d, colorKey, xScale))
            ),
          update => update
            .call(sel => sel.transition().duration(TRANSITION_MS)
              .attr('x',      d => hComputeX(d, colorKey, xScale))
              .attr('y',      d => hComputeY(d.data.x, colorIdx, yScale, yInner))
              .attr('width',  d => hComputeWidth(d, colorKey, xScale))
              .attr('height', hComputeHeight(colorIdx, yScale, yInner))
            ),
          exit => exit.transition().duration(TRANSITION_MS)
            .attr('width', 0).remove()
        )
        .on('mouseover', function(event, d) {
          d3.select(this).attr('opacity', 0.8);
          const val = layout === 'stacked'
            ? d[1] - d[0]
            : d.data[colorKey];
          showTooltip(event, d.data.x, colorKey, val);
        })
        .on('mousemove', function(event) {
          tooltip
            .style('left', `${event.offsetX + 14}px`)
            .style('top',  `${event.offsetY - 10}px`);
        })
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 1);
          hideTooltip();
        });
    });

    // ── Average reference line ──────────────────────────────────────────────
    if (showAvgLine) {
      const allValues = wideData.flatMap(d => colorKeys.map(ck => d[ck]));
      const avg = d3.mean(allValues);
      const xAvg = xScale(avg);

      g.append('line')
        .attr('class', 'avg-line')
        .attr('x1', xAvg).attr('x2', xAvg)
        .attr('y1', 0).attr('y2', h)
        .attr('stroke', avgLineColor)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6 4')
        .attr('opacity', 0.85);

      g.append('text')
        .attr('class', 'avg-label-text')
        .attr('x', xAvg + 4)
        .attr('y', -6)
        .attr('fill', avgLineColor)
        .attr('font-size', '11px')
        .text(`Avg: ${d3.format(',.0f')(avg)}`);
    }
  }

  // ── Vertical helpers ──────────────────────────────────────────────────────
  function vComputeX(xCat, colorIdx, xScale, xInner) {
    if (layout === 'stacked' || layout === 'pct') {
      return xScale(xCat);
    } else {
      return xScale(xCat) + xInner(colorKeys[colorIdx]);
    }
  }

  function vComputeWidth(colorIdx, xScale, xInner) {
    if (layout === 'stacked' || layout === 'pct') {
      return xScale.bandwidth();
    } else {
      return xInner.bandwidth();
    }
  }

  function vComputeY(d, colorKey, yScale) {
    if (layout === 'stacked' || layout === 'pct') {
      return yScale(d[1]);
    } else {
      return yScale(d.data[colorKey]);
    }
  }

  function vComputeHeight(d, colorKey, h, yScale) {
    if (layout === 'stacked' || layout === 'pct') {
      return Math.max(0, yScale(d[0]) - yScale(d[1]));
    } else {
      return Math.max(0, h - yScale(d.data[colorKey]));
    }
  }

  // ── Horizontal helpers ────────────────────────────────────────────────────
  function hComputeX(d, colorKey, xScale) {
    if (layout === 'stacked') {
      return xScale(d[0]);
    } else {
      return 0;
    }
  }

  function hComputeWidth(d, colorKey, xScale) {
    if (layout === 'stacked') {
      return Math.max(0, xScale(d[1]) - xScale(d[0]));
    } else {
      return Math.max(0, xScale(d.data[colorKey]));
    }
  }

  function hComputeY(xCat, colorIdx, yScale, yInner) {
    if (layout === 'stacked') {
      return yScale(xCat);
    } else {
      return yScale(xCat) + yInner(colorKeys[colorIdx]);
    }
  }

  function hComputeHeight(colorIdx, yScale, yInner) {
    if (layout === 'stacked') {
      return yScale.bandwidth();
    } else {
      return yInner.bandwidth();
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
