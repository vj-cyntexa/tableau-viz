'use strict';

// ─── Layout constants ─────────────────────────────────────────────────────────
const MARGIN_H = { top: 20, right: 120, bottom: 40, left: 150 }; // horizontal mode
const MARGIN_V = { top: 40, right: 30,  bottom: 100, left: 60  }; // vertical mode
const DOT_RADIUS = 6;
const STEM_COLOR_DEFAULT = '#1f77b4';
const DOT_COLOR_DEFAULT  = '#1f77b4';

// ─── Module-level state ───────────────────────────────────────────────────────
let _lastParsed = null;  // cache so resize can redraw without re-fetching

// ─── Toolbar state helpers ────────────────────────────────────────────────────
function getSort()        { return document.querySelector('#sort-group button.active')?.dataset.sort   ?? 'desc'; }
function getOrient()      { return document.querySelector('#orient-group button.active')?.dataset.orient ?? 'horizontal'; }
function showBenchmark()  { return document.getElementById('benchmark-toggle')?.checked ?? true; }
function showLabels()     { return document.getElementById('labels-toggle')?.checked ?? true; }

// ─── Bootstrap ───────────────────────────────────────────────────────────────
tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => {
  setError(err.message || String(err));
});

// ─── Toolbar wiring (after DOM ready) ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Sort buttons
  document.getElementById('sort-group').addEventListener('click', e => {
    const btn = e.target.closest('button[data-sort]');
    if (!btn) return;
    document.querySelectorAll('#sort-group button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (_lastParsed) drawChart(_lastParsed);
  });

  // Orientation buttons
  document.getElementById('orient-group').addEventListener('click', e => {
    const btn = e.target.closest('button[data-orient]');
    if (!btn) return;
    document.querySelectorAll('#orient-group button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (_lastParsed) drawChart(_lastParsed);
  });

  // Checkboxes
  document.getElementById('benchmark-toggle').addEventListener('change', () => {
    if (_lastParsed) drawChart(_lastParsed);
  });
  document.getElementById('labels-toggle').addEventListener('change', () => {
    if (_lastParsed) drawChart(_lastParsed);
  });
});

// ─── Window resize ────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  if (_lastParsed) drawChart(_lastParsed);
});

// ─── Render pipeline ─────────────────────────────────────────────────────────
async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    _lastParsed = parseTableauData(dataTable, vizSpec);
    drawChart(_lastParsed);
  } catch (err) {
    setError(err.message || String(err));
  }
}

async function fetchData(worksheet) {
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, {
    ignoreSelection: true,
  });
  try {
    return await reader.getAllPagesAsync();
  } finally {
    await reader.releaseAsync();
  }
}

// ─── Data parsing ─────────────────────────────────────────────────────────────
// Returns:
// {
//   rows:            { category, value, benchmark, group }[],  // all rows, data-order
//   categoryField:   string,
//   valueField:      string,
//   benchmarkField:  string | null,
//   colorField:      string | null,
//   hasBenchmark:    boolean,
//   hasColor:        boolean,
//   colorGroups:     string[],                                  // sorted unique groups
// }
function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection?.[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const categoryField  = fieldName('category');
  const valueField     = fieldName('value');
  const benchmarkField = fieldName('benchmark');
  const colorField     = fieldName('color');

  const colIndex = Object.fromEntries(
    dataTable.columns.map(c => [c.fieldName, c.index])
  );

  if (!categoryField || !(categoryField in colIndex)) {
    throw new Error('Drag a dimension onto the "Category" encoding slot.');
  }
  if (!valueField || !(valueField in colIndex)) {
    throw new Error('Drag a numeric measure onto the "Value" encoding slot.');
  }

  const ci  = colIndex[categoryField];
  const vi  = colIndex[valueField];
  const bi  = (benchmarkField && benchmarkField in colIndex) ? colIndex[benchmarkField] : null;
  const gi  = (colorField && colorField in colIndex) ? colIndex[colorField] : null;

  const hasBenchmark = bi !== null;
  const hasColor     = gi !== null;

  const rows = dataTable.data.map(row => ({
    category:  String(row[ci].value),
    value:     Number(row[vi].value),
    benchmark: hasBenchmark ? Number(row[bi].value) : null,
    group:     hasColor ? String(row[gi].value) : null,
  })).filter(r => !Number.isNaN(r.value));

  if (!rows.length) throw new Error('No valid rows found. Check field types on the encoding slots.');

  const colorGroups = hasColor
    ? [...new Set(rows.map(r => r.group))].sort()
    : [];

  return {
    rows,
    categoryField,
    valueField,
    benchmarkField,
    colorField,
    hasBenchmark,
    hasColor,
    colorGroups,
  };
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawChart(parsed) {
  const {
    rows, valueField, benchmarkField, colorField,
    hasBenchmark, hasColor, colorGroups,
  } = parsed;

  // Read current toolbar state
  const sortMode      = getSort();
  const orientation   = getOrient();
  const doBenchmark   = hasBenchmark && showBenchmark();
  const doLabels      = showLabels();

  // Update benchmark checkbox disabled state
  const benchmarkCb = document.getElementById('benchmark-toggle');
  if (benchmarkCb) benchmarkCb.disabled = !hasBenchmark;

  // ── Sort data ──────────────────────────────────────────────────────────────
  let sortedRows;
  if (sortMode === 'desc') {
    sortedRows = [...rows].sort((a, b) => b.value - a.value);
  } else if (sortMode === 'asc') {
    sortedRows = [...rows].sort((a, b) => a.value - b.value);
  } else {
    sortedRows = [...rows]; // data order (preserve API order)
  }

  const categories = sortedRows.map(r => r.category);

  // ── Value format — auto-detect percent vs integer ──────────────────────────
  const maxValue = d3.max(sortedRows, r => r.value) ?? 0;
  const valueFmt = maxValue < 2
    ? d3.format('.1%')
    : d3.format(',.0f');

  // ── Color scale ────────────────────────────────────────────────────────────
  const colorScale = hasColor
    ? d3.scaleOrdinal(d3.schemeTableau10).domain(colorGroups)
    : null;

  const getColor = d => colorScale ? colorScale(d.group) : STEM_COLOR_DEFAULT;

  // ── Container dimensions ───────────────────────────────────────────────────
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;

  d3.select(container).selectAll('*').remove();

  if (!sortedRows.length) { container.textContent = 'No data.'; return; }

  // ── Benchmark value — use first row's benchmark (repeated constant) ─────────
  const benchmarkValue = hasBenchmark ? sortedRows[0].benchmark : null;
  const benchmarkLabel = benchmarkField
    ? `${benchmarkField}: ${valueFmt(benchmarkValue)}`
    : `Avg: ${valueFmt(benchmarkValue)}`;

  if (orientation === 'horizontal') {
    drawHorizontal({
      container, W, H, sortedRows, categories, valueFmt, getColor,
      colorGroups, hasColor, colorField, valueField, colorScale,
      doBenchmark, doLabels, benchmarkValue, benchmarkLabel,
    });
  } else {
    drawVertical({
      container, W, H, sortedRows, categories, valueFmt, getColor,
      colorGroups, hasColor, colorField, valueField, colorScale,
      doBenchmark, doLabels, benchmarkValue, benchmarkLabel,
    });
  }
}

// ─── Horizontal lollipop ──────────────────────────────────────────────────────
// Y axis = categories (scaleBand), X axis = values (scaleLinear)
// Stems go from x=0 to x=value; dots at x=value
function drawHorizontal({
  container, W, H, sortedRows, categories, valueFmt, getColor,
  colorGroups, hasColor, colorField, valueField, colorScale,
  doBenchmark, doLabels, benchmarkValue, benchmarkLabel,
}) {
  const M = MARGIN_H;
  const w = W - M.left - M.right;
  const h = H - M.top  - M.bottom;

  // ── Scales ─────────────────────────────────────────────────────────────────
  const yScale = d3.scaleBand()
    .domain(categories)
    .range([0, h])
    .padding(0.35);

  const xMax = d3.max(sortedRows, r => r.value) ?? 0;
  const xDomainMax = doBenchmark && benchmarkValue != null
    ? Math.max(xMax, benchmarkValue) * 1.05
    : xMax * 1.08;

  const xScale = d3.scaleLinear()
    .domain([0, xDomainMax])
    .nice()
    .range([0, w]);

  // ── SVG ────────────────────────────────────────────────────────────────────
  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H);

  const g = svg.append('g')
    .attr('transform', `translate(${M.left},${M.top})`);

  // ── Grid lines (vertical, from X axis) ─────────────────────────────────────
  g.append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xScale).tickSize(-h).tickFormat(''))
    .call(grp => grp.select('.domain').remove());

  // ── Axes ───────────────────────────────────────────────────────────────────
  // Y axis (categories)
  g.append('g')
    .attr('class', 'axis y-axis')
    .call(d3.axisLeft(yScale).tickSizeOuter(0))
    .call(grp => grp.select('.domain').remove());

  // X axis (values)
  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(
      d3.axisBottom(xScale)
        .ticks(6)
        .tickSizeOuter(0)
        .tickFormat(valueFmt)
    );

  // X axis label
  g.append('text')
    .attr('x', w / 2)
    .attr('y', h + M.bottom - 4)
    .attr('text-anchor', 'middle')
    .attr('font-size', '11px')
    .attr('fill', '#888')
    .text(valueField);

  // ── Lollipop stems ─────────────────────────────────────────────────────────
  g.selectAll('.stem')
    .data(sortedRows)
    .join('line')
      .attr('class', 'stem')
      .attr('x1', 0)
      .attr('y1', d => yScale(d.category) + yScale.bandwidth() / 2)
      .attr('x2', d => xScale(d.value))
      .attr('y2', d => yScale(d.category) + yScale.bandwidth() / 2)
      .attr('stroke', d => getColor(d))
      .attr('opacity', 0.6);

  // ── Lollipop dots ──────────────────────────────────────────────────────────
  g.selectAll('.dot')
    .data(sortedRows)
    .join('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.value))
      .attr('cy', d => yScale(d.category) + yScale.bandwidth() / 2)
      .attr('r', DOT_RADIUS)
      .attr('fill', d => getColor(d));

  // ── Value labels ───────────────────────────────────────────────────────────
  if (doLabels) {
    g.selectAll('.value-label')
      .data(sortedRows)
      .join('text')
        .attr('class', 'value-label')
        .attr('x', d => xScale(d.value) + DOT_RADIUS + 5)
        .attr('y', d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr('dominant-baseline', 'middle')
        .text(d => valueFmt(d.value));
  }

  // ── Benchmark line (vertical dashed line in horizontal mode) ───────────────
  if (doBenchmark && benchmarkValue != null) {
    const bx = xScale(benchmarkValue);

    g.append('line')
      .attr('class', 'benchmark-line')
      .attr('x1', bx).attr('x2', bx)
      .attr('y1', 0) .attr('y2', h);

    g.append('text')
      .attr('class', 'benchmark-label')
      .attr('x', bx + 4)
      .attr('y', 10)
      .text(benchmarkLabel);
  }

  // ── Legend (when color encoding is active) ─────────────────────────────────
  if (hasColor && colorGroups.length > 0) {
    const legendX = w + 12;
    const legend = g.append('g').attr('class', 'legend')
      .attr('transform', `translate(${legendX}, 0)`);

    legend.append('text')
      .attr('x', 0).attr('y', -6)
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .attr('fill', '#666')
      .text(colorField ?? 'Group');

    colorGroups.forEach((grp, i) => {
      const row = legend.append('g')
        .attr('transform', `translate(0, ${i * 20})`);
      row.append('circle')
        .attr('cx', 5).attr('cy', 5).attr('r', 5)
        .attr('fill', colorScale(grp));
      row.append('text')
        .attr('x', 15).attr('y', 9)
        .text(grp);
    });
  }

  // ── Tooltip ────────────────────────────────────────────────────────────────
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0)
    .style('position', 'absolute');

  g.selectAll('.dot')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', DOT_RADIUS + 2);
      let html = `<div class="tt-label">${d.category}</div>`;
      html += `<span style="color:${getColor(d)}">&#9679;</span>&nbsp;${valueField}: <b>${valueFmt(d.value)}</b>`;
      if (hasColor) html += `<br>Group: <b>${d.group}</b>`;
      if (doBenchmark && d.benchmark != null) {
        const diff = d.value - d.benchmark;
        const sign = diff >= 0 ? '+' : '';
        html += `<br>vs Benchmark: <b>${sign}${valueFmt(diff)}</b>`;
      }
      tooltip.style('opacity', 1)
        .style('left', `${event.offsetX + M.left + 14}px`)
        .style('top',  `${event.offsetY + M.top - 10}px`)
        .html(html);
    })
    .on('mousemove', function(event) {
      tooltip
        .style('left', `${event.offsetX + M.left + 14}px`)
        .style('top',  `${event.offsetY + M.top - 10}px`);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('r', DOT_RADIUS);
      tooltip.style('opacity', 0);
    });
}

// ─── Vertical lollipop ────────────────────────────────────────────────────────
// X axis = categories (scaleBand), Y axis = values (scaleLinear)
// Stems go from y=0 to y=value; dots at y=value; labels above dot
function drawVertical({
  container, W, H, sortedRows, categories, valueFmt, getColor,
  colorGroups, hasColor, colorField, valueField, colorScale,
  doBenchmark, doLabels, benchmarkValue, benchmarkLabel,
}) {
  const M = MARGIN_V;
  const w = W - M.left - M.right;
  const h = H - M.top  - M.bottom;

  // ── Scales ─────────────────────────────────────────────────────────────────
  const xScale = d3.scaleBand()
    .domain(categories)
    .range([0, w])
    .padding(0.35);

  const yMax = d3.max(sortedRows, r => r.value) ?? 0;
  const yDomainMax = doBenchmark && benchmarkValue != null
    ? Math.max(yMax, benchmarkValue) * 1.1
    : yMax * 1.12;

  const yScale = d3.scaleLinear()
    .domain([0, yDomainMax])
    .nice()
    .range([h, 0]);

  // ── SVG ────────────────────────────────────────────────────────────────────
  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H);

  const g = svg.append('g')
    .attr('transform', `translate(${M.left},${M.top})`);

  // ── Grid lines (horizontal) ────────────────────────────────────────────────
  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yScale).tickSize(-w).tickFormat(''))
    .call(grp => grp.select('.domain').remove());

  // ── Axes ───────────────────────────────────────────────────────────────────
  // Y axis (values)
  g.append('g')
    .attr('class', 'axis y-axis')
    .call(
      d3.axisLeft(yScale)
        .ticks(6)
        .tickSizeOuter(0)
        .tickFormat(valueFmt)
    );

  // Y axis label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2)
    .attr('y', -M.left + 14)
    .attr('text-anchor', 'middle')
    .attr('font-size', '11px')
    .attr('fill', '#888')
    .text(valueField);

  // X axis (categories) — rotate labels
  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xScale).tickSizeOuter(0))
    .selectAll('text')
      .attr('transform', 'rotate(-35)')
      .style('text-anchor', 'end')
      .attr('dy', '0.35em')
      .attr('dx', '-0.5em');

  // ── Lollipop stems ─────────────────────────────────────────────────────────
  g.selectAll('.stem')
    .data(sortedRows)
    .join('line')
      .attr('class', 'stem')
      .attr('x1', d => xScale(d.category) + xScale.bandwidth() / 2)
      .attr('y1', yScale(0))
      .attr('x2', d => xScale(d.category) + xScale.bandwidth() / 2)
      .attr('y2', d => yScale(d.value))
      .attr('stroke', d => getColor(d))
      .attr('opacity', 0.6);

  // ── Lollipop dots ──────────────────────────────────────────────────────────
  g.selectAll('.dot')
    .data(sortedRows)
    .join('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.category) + xScale.bandwidth() / 2)
      .attr('cy', d => yScale(d.value))
      .attr('r', DOT_RADIUS)
      .attr('fill', d => getColor(d));

  // ── Value labels (above dots) ──────────────────────────────────────────────
  if (doLabels) {
    g.selectAll('.value-label')
      .data(sortedRows)
      .join('text')
        .attr('class', 'value-label')
        .attr('x', d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.value) - DOT_RADIUS - 4)
        .attr('text-anchor', 'middle')
        .text(d => valueFmt(d.value));
  }

  // ── Benchmark line (horizontal dashed line in vertical mode) ───────────────
  if (doBenchmark && benchmarkValue != null) {
    const by = yScale(benchmarkValue);

    g.append('line')
      .attr('class', 'benchmark-line')
      .attr('x1', 0)   .attr('x2', w)
      .attr('y1', by)   .attr('y2', by);

    g.append('text')
      .attr('class', 'benchmark-label')
      .attr('x', w + 4)
      .attr('y', by + 4)
      .text(benchmarkLabel);
  }

  // ── Legend ─────────────────────────────────────────────────────────────────
  if (hasColor && colorGroups.length > 0) {
    const legend = g.append('g').attr('class', 'legend')
      .attr('transform', `translate(0, ${-M.top + 4})`);

    legend.append('text')
      .attr('x', 0).attr('y', 0)
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .attr('fill', '#666')
      .text(colorField ?? 'Group');

    colorGroups.forEach((grp, i) => {
      const row = legend.append('g')
        .attr('transform', `translate(${i * 100}, 16)`);
      row.append('circle')
        .attr('cx', 5).attr('cy', 5).attr('r', 5)
        .attr('fill', colorScale(grp));
      row.append('text')
        .attr('x', 15).attr('y', 9)
        .text(grp);
    });
  }

  // ── Tooltip ────────────────────────────────────────────────────────────────
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0)
    .style('position', 'absolute');

  g.selectAll('.dot')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', DOT_RADIUS + 2);
      let html = `<div class="tt-label">${d.category}</div>`;
      html += `<span style="color:${getColor(d)}">&#9679;</span>&nbsp;${valueField}: <b>${valueFmt(d.value)}</b>`;
      if (hasColor) html += `<br>Group: <b>${d.group}</b>`;
      if (doBenchmark && d.benchmark != null) {
        const diff = d.value - d.benchmark;
        const sign = diff >= 0 ? '+' : '';
        html += `<br>vs Benchmark: <b>${sign}${valueFmt(diff)}</b>`;
      }
      tooltip.style('opacity', 1)
        .style('left', `${event.offsetX + M.left + 14}px`)
        .style('top',  `${event.offsetY + M.top - 10}px`)
        .html(html);
    })
    .on('mousemove', function(event) {
      tooltip
        .style('left', `${event.offsetX + M.left + 14}px`)
        .style('top',  `${event.offsetY + M.top - 10}px`);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('r', DOT_RADIUS);
      tooltip.style('opacity', 0);
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
