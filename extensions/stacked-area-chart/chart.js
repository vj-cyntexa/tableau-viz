'use strict';

// ─── Layout constants ─────────────────────────────────────────────────────────
const MARGIN = { top: 30, right: 170, bottom: 60, left: 75 };
const COLORS = d3.schemeTableau10;

// ─── Toolbar state ────────────────────────────────────────────────────────────
let stackMode  = 'stacked';    // 'stacked' | 'normalized' | 'lines'
let areaFill   = true;
let sortOrder  = 'total';      // 'total' | 'alpha'

// ─── Bootstrap ───────────────────────────────────────────────────────────────
tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;

  // Stack mode buttons
  document.querySelectorAll('.mode-btn[data-stack]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn[data-stack]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      stackMode = btn.dataset.stack;
      render(ws);
    });
  });

  // Area fill checkbox
  document.getElementById('fill-toggle').addEventListener('change', e => {
    areaFill = e.target.checked;
    render(ws);
  });

  // Sort order buttons
  document.querySelectorAll('.mode-btn[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn[data-sort]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sortOrder = btn.dataset.sort;
      render(ws);
    });
  });

  // Live data
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));

  render(ws);
}).catch(err => setError(err.message || String(err)));

// ─── Render pipeline ─────────────────────────────────────────────────────────
async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    drawChart(parseTableauData(dataTable, vizSpec));
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

// ─── Data parsing ─────────────────────────────────────────────────────────────
// Returns:
//   dateLabels:  string[]    — ordered list of date/period strings (x axis labels)
//   segments:    string[]    — ordered list of segment names (after sort applied)
//   wideData:    Array<{ date: string, [seg]: number }>  — one entry per date
//   segTotals:   Map<string, number>   — total across all dates per segment (for sort)
function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection?.[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const dateField    = fieldName('date');
  const valueField   = fieldName('value');
  const segmentField = fieldName('segment');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!dateField    || !(dateField    in colIndex)) throw new Error('Drag a date/period dimension onto the "Date / Period" encoding slot.');
  if (!valueField   || !(valueField   in colIndex)) throw new Error('Drag a numeric measure onto the "Value" encoding slot.');
  if (!segmentField || !(segmentField in colIndex)) throw new Error('Drag a dimension onto the "Segment / Tier" encoding slot.');

  const di = colIndex[dateField];
  const vi = colIndex[valueField];
  const si = colIndex[segmentField];

  // Collect ordered date labels (preserve insertion order as the natural time order)
  const dateSet     = new Set();
  const segmentSet  = new Set();
  const cellMap     = new Map(); // "date|segment" -> number

  for (const row of dataTable.data) {
    const dateLabel = String(row[di].value);
    const segLabel  = String(row[si].value);
    const val       = Number(row[vi].value) || 0;
    dateSet.add(dateLabel);
    segmentSet.add(segLabel);
    const key = `${dateLabel}|||${segLabel}`;
    cellMap.set(key, (cellMap.get(key) ?? 0) + val);
  }

  const dateLabels   = [...dateSet];           // order from source data
  const rawSegments  = [...segmentSet];

  // Compute per-segment totals for "By Total" sort
  const segTotals = new Map();
  for (const seg of rawSegments) {
    let total = 0;
    for (const date of dateLabels) {
      total += cellMap.get(`${date}|||${seg}`) ?? 0;
    }
    segTotals.set(seg, total);
  }

  // Apply sort
  let segments;
  if (sortOrder === 'alpha') {
    segments = [...rawSegments].sort((a, b) => a.localeCompare(b));
  } else {
    // By Total: largest total on bottom in stacked chart (largest first in segment array)
    segments = [...rawSegments].sort((a, b) => (segTotals.get(b) ?? 0) - (segTotals.get(a) ?? 0));
  }

  // Build wide format: [{ date: 'Jan 2022', 'Bronze': 8200, 'Silver': 3100, ... }, ...]
  const wideData = dateLabels.map(date => {
    const obj = { date };
    for (const seg of segments) {
      obj[seg] = cellMap.get(`${date}|||${seg}`) ?? 0;
    }
    return obj;
  });

  return { dateLabels, segments, wideData, segTotals };
}

// ─── Drawing ─────────────────────────────────────────────────────────────────
function drawChart({ dateLabels, segments, wideData, segTotals }) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top - MARGIN.bottom;

  // ── Color scale (stable by segment name) ─────────────────────────────────
  const colors = d3.scaleOrdinal().domain(segments).range(COLORS);

  // ── X scale: point scale on string labels ─────────────────────────────────
  // We use scalePoint so each date label maps to an x pixel position.
  const xScale = d3.scalePoint()
    .domain(dateLabels)
    .range([0, w])
    .padding(0.05);

  // ── D3 stack ─────────────────────────────────────────────────────────────
  // Stacked and Normalized both use d3.stack; Lines bypasses it entirely.
  let series = null;
  let yScale;

  if (stackMode === 'stacked' || stackMode === 'normalized') {
    const stackLayout = d3.stack()
      .keys(segments)
      .order(d3.stackOrderNone); // segment order already set by sortOrder

    if (stackMode === 'normalized') {
      stackLayout.offset(d3.stackOffsetExpand); // each column sums to 1.0
    } else {
      stackLayout.offset(d3.stackOffsetNone);
    }

    series = stackLayout(wideData);

    if (stackMode === 'normalized') {
      yScale = d3.scaleLinear().domain([0, 1]).range([h, 0]);
    } else {
      const yMax = d3.max(series, layer => d3.max(layer, d => d[1]));
      yScale = d3.scaleLinear().domain([0, yMax * 1.05]).nice().range([h, 0]);
    }
  } else {
    // Lines mode: raw values per segment
    const rawMax = d3.max(wideData, d => d3.max(segments, seg => d[seg]));
    yScale = d3.scaleLinear().domain([0, rawMax * 1.05]).nice().range([h, 0]);
  }

  // ── Y axis formatter ──────────────────────────────────────────────────────
  const yFormat = stackMode === 'normalized'
    ? d3.format('.0%')
    : d3.format('~s');

  // ── Build/update SVG ──────────────────────────────────────────────────────
  let svg = d3.select(container).select('#stacked-area-svg');
  if (svg.empty()) {
    svg = d3.select(container).append('svg').attr('id', 'stacked-area-svg');
  }
  svg.attr('width', W).attr('height', H);

  let g = svg.select('.root-g');
  if (g.empty()) g = svg.append('g').attr('class', 'root-g');
  g.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // ── Grid ──────────────────────────────────────────────────────────────────
  let gridG = g.select('.grid');
  if (gridG.empty()) gridG = g.append('g').attr('class', 'grid');
  gridG.call(d3.axisLeft(yScale).tickSize(-w).tickFormat(''))
    .call(grp => grp.select('.domain').remove());

  // ── X axis ────────────────────────────────────────────────────────────────
  let xAxisG = g.select('.x-axis');
  if (xAxisG.empty()) {
    xAxisG = g.append('g').attr('class', 'axis x-axis').attr('transform', `translate(0,${h})`);
  }
  // Show a subset of ticks to avoid crowding — every 3rd or 4th label
  const tickEvery = dateLabels.length > 16 ? 4 : dateLabels.length > 8 ? 2 : 1;
  const filteredTicks = dateLabels.filter((_, i) => i % tickEvery === 0);
  xAxisG.call(
    d3.axisBottom(xScale)
      .tickValues(filteredTicks)
      .tickSizeOuter(0)
  )
    .selectAll('text')
    .attr('dy', '1.2em')
    .style('font-size', '10px');

  // ── Y axis ────────────────────────────────────────────────────────────────
  let yAxisG = g.select('.y-axis');
  if (yAxisG.empty()) yAxisG = g.append('g').attr('class', 'axis y-axis');
  yAxisG.call(d3.axisLeft(yScale).ticks(6).tickSizeOuter(0).tickFormat(yFormat));

  // Y axis label
  let yLbl = g.select('.y-label');
  if (yLbl.empty()) {
    yLbl = g.append('text').attr('class', 'y-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', 11).attr('fill', '#555')
      .attr('transform', 'rotate(-90)');
  }
  const yLabelText = stackMode === 'normalized' ? 'Share (%)' : 'Value';
  yLbl.attr('x', -h / 2).attr('y', -58).text(yLabelText);

  // ── Tooltip div ───────────────────────────────────────────────────────────
  let tooltip = d3.select(container).select('.tooltip');
  if (tooltip.empty()) {
    tooltip = d3.select(container)
      .append('div').attr('class', 'tooltip')
      .style('opacity', 0).style('position', 'absolute');
  }

  // ── Clear previous layer paths (full redraw on mode/sort change) ──────────
  g.selectAll('.area-layer').remove();
  g.selectAll('.line-layer').remove();
  g.selectAll('.crosshair').remove();
  g.selectAll('.hover-overlay').remove();

  // ── Render: Stacked or Normalized (area paths via d3.stack) ──────────────
  if (stackMode === 'stacked' || stackMode === 'normalized') {
    const areaGen = d3.area()
      .x(d => xScale(d.data.date))
      .y0(d => yScale(d[0]))
      .y1(d => yScale(d[1]))
      .curve(d3.curveMonotoneX);

    const lineGen = d3.line()
      .x(d => xScale(d.data.date))
      .y(d => yScale(d[1]))
      .curve(d3.curveMonotoneX);

    series.forEach(layer => {
      const seg = layer.key;
      const color = colors(seg);

      const layerG = g.append('g').attr('class', 'area-layer');

      if (areaFill) {
        layerG.append('path')
          .datum(layer)
          .attr('class', 'area-path')
          .attr('fill', color)
          .attr('fill-opacity', 0.75)
          .attr('stroke', 'none')
          .attr('d', areaGen);
      }

      // Always draw stroke on top of fill
      layerG.append('path')
        .datum(layer)
        .attr('class', 'area-path')
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', areaFill ? 1.5 : 2.5)
        .attr('d', lineGen);
    });
  }

  // ── Render: Lines mode (raw values, no stack) ─────────────────────────────
  if (stackMode === 'lines') {
    const lineGen = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    segments.forEach(seg => {
      const segData = wideData.map(d => ({ date: d.date, value: d[seg] }));
      const color = colors(seg);
      const layerG = g.append('g').attr('class', 'line-layer');

      if (areaFill) {
        const areaGen = d3.area()
          .x(d => xScale(d.date))
          .y0(h)
          .y1(d => yScale(d.value))
          .curve(d3.curveMonotoneX);

        layerG.append('path')
          .datum(segData)
          .attr('fill', color)
          .attr('fill-opacity', 0.15)
          .attr('stroke', 'none')
          .attr('d', areaGen);
      }

      layerG.append('path')
        .datum(segData)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2.5)
        .attr('d', lineGen);
    });
  }

  // ── Crosshair + hover overlay ─────────────────────────────────────────────
  // Vertical crosshair that snaps to the nearest date index on mouse move.
  const crosshair = g.append('line')
    .attr('class', 'crosshair')
    .attr('y1', 0).attr('y2', h)
    .style('display', 'none');

  const bisect = d3.bisector((d, x) => dateLabels.indexOf(d.date) - dateLabels.indexOf(x)).left;

  g.append('rect')
    .attr('class', 'hover-overlay')
    .attr('width', w).attr('height', h)
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .attr('cursor', 'crosshair')
    .on('mousemove', function(event) {
      const [mx] = d3.pointer(event);
      // Find nearest date index by x pixel distance
      let closestIdx = 0;
      let closestDist = Infinity;
      dateLabels.forEach((date, i) => {
        const dist = Math.abs(xScale(date) - mx);
        if (dist < closestDist) { closestDist = dist; closestIdx = i; }
      });

      const nearestDate = dateLabels[closestIdx];
      const nearestRow  = wideData[closestIdx];
      const cx = xScale(nearestDate);

      crosshair
        .style('display', null)
        .attr('x1', cx).attr('x2', cx);

      // Build tooltip: date header + value per segment
      const fmt = stackMode === 'normalized'
        ? d3.format('.1%')
        : d3.format(',~f');

      let rows = '';
      // For normalized mode, compute shares from wideData
      const dateTotal = segments.reduce((s, seg) => s + (nearestRow[seg] ?? 0), 0);
      segments.forEach(seg => {
        const rawVal = nearestRow[seg] ?? 0;
        let displayVal;
        if (stackMode === 'normalized') {
          displayVal = dateTotal > 0 ? d3.format('.1%')(rawVal / dateTotal) : '0%';
        } else {
          displayVal = d3.format(',~f')(rawVal);
        }
        rows += `<div>` +
          `<span style="color:${colors(seg)}">&#9679;</span> ` +
          `${seg}: <b>${displayVal}</b>` +
          `</div>`;
      });

      const tooltipX = event.offsetX + 16;
      const tooltipY = event.offsetY - 20;

      tooltip
        .style('opacity', 1)
        .style('left', `${tooltipX}px`)
        .style('top', `${tooltipY}px`)
        .html(`<div class="tt-date">${nearestDate}</div>${rows}`);
    })
    .on('mouseleave', () => {
      crosshair.style('display', 'none');
      tooltip.style('opacity', 0);
    });

  // ── Legend ────────────────────────────────────────────────────────────────
  let legendG = g.select('.legend');
  if (legendG.empty()) {
    legendG = g.append('g').attr('class', 'legend')
      .attr('transform', `translate(${w + 18}, 0)`);
  }
  legendG.selectAll('*').remove();

  segments.forEach((seg, i) => {
    const item = legendG.append('g').attr('transform', `translate(0,${i * 22})`);
    item.append('rect')
      .attr('width', 14).attr('height', 14).attr('rx', 2).attr('y', -1)
      .attr('fill', colors(seg)).attr('opacity', 0.80);
    item.append('text')
      .attr('x', 20).attr('y', 11)
      .attr('font-size', 12).attr('fill', '#444')
      .text(seg);
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

// ─── Debounced resize ─────────────────────────────────────────────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    document.dispatchEvent(new Event('resize-redraw'));
  }, 150);
});
