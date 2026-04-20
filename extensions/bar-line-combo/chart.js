'use strict';

// ─── Layout constants ─────────────────────────────────────────────────────────
const MARGIN = { top: 30, right: 90, bottom: 65, left: 75 };
const BAR_COLOR    = '#3498db';   // steel blue — single-series bars
const LINE_COLOR   = '#e67e22';   // orange — line overlay
const STACK_COLORS = d3.schemeTableau10;

// ─── Bootstrap ───────────────────────────────────────────────────────────────
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
    drawChart(parseTableauData(dataTable, vizSpec));
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
//     xLabels:      string[],           // ordered domain labels for scaleBand
//     xIsDate:      boolean,            // whether x values parse as dates
//     stacked:      boolean,            // true when color encoding is present
//     groups:       string[],           // stack group keys (empty when !stacked)
//     stackData:    d3.SeriesPoint[][],  // result of d3.stack() (empty when !stacked)
//     barData:      { x: string, value: number }[], // used when !stacked
//     lineData:     { x: string, value: number }[], // one point per x label
//     barFieldName: string,
//     lineFieldName: string,
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
  const barField   = fieldName('bar');
  const lineField  = fieldName('line');
  const colorField = fieldName('color');

  const colIndex = Object.fromEntries(
    dataTable.columns.map(c => [c.fieldName, c.index])
  );

  if (!xField || !(xField in colIndex)) {
    throw new Error('Drag a dimension onto the "X Axis" encoding slot.');
  }
  if (!barField || !(barField in colIndex)) {
    throw new Error('Drag a numeric measure onto the "Bar Measure" encoding slot.');
  }
  if (!lineField || !(lineField in colIndex)) {
    throw new Error('Drag a numeric measure onto the "Line Measure" encoding slot.');
  }

  const xi  = colIndex[xField];
  const bi  = colIndex[barField];
  const li  = colIndex[lineField];
  const ci  = (colorField && colorField in colIndex) ? colIndex[colorField] : null;
  const stacked = ci !== null;

  // Parse raw rows
  const rawRows = dataTable.data.map(row => ({
    x:     String(row[xi].value),
    bar:   Number(row[bi].value),
    line:  Number(row[li].value),
    group: stacked ? String(row[ci].value) : null,
  })).filter(r => !Number.isNaN(r.bar) && !Number.isNaN(r.line));

  if (!rawRows.length) throw new Error('No valid rows found. Check field types on the encoding slots.');

  // Determine ordered x labels (preserve source order, deduplicate)
  const xLabelsSeen = new Set();
  const xLabels = [];
  rawRows.forEach(r => {
    if (!xLabelsSeen.has(r.x)) { xLabelsSeen.add(r.x); xLabels.push(r.x); }
  });

  // Detect whether x values are dates for tick label formatting
  const xIsDate = xLabels.every(v => {
    const d = new Date(v);
    return !isNaN(d.getTime());
  });

  // ── Stacked bar data ──────────────────────────────────────────────────────
  let stackData = [];
  let groups = [];

  if (stacked) {
    groups = [...new Set(rawRows.map(r => r.group))].sort();

    // Build a map: x → { [group]: barValue }
    const byX = Object.fromEntries(xLabels.map(x => [x, {}]));
    rawRows.forEach(r => {
      if (!byX[r.x]) byX[r.x] = {};
      byX[r.x][r.group] = (byX[r.x][r.group] || 0) + r.bar;
    });

    // d3.stack() needs an array of objects: { x, group1, group2, ... }
    const tableData = xLabels.map(x => {
      const obj = { x };
      groups.forEach(g => { obj[g] = byX[x][g] ?? 0; });
      return obj;
    });

    stackData = d3.stack().keys(groups)(tableData);
  }

  // ── Single-series bar data ────────────────────────────────────────────────
  let barData = [];
  if (!stacked) {
    const barByX = {};
    rawRows.forEach(r => { barByX[r.x] = (barByX[r.x] || 0) + r.bar; });
    barData = xLabels.map(x => ({ x, value: barByX[x] ?? 0 }));
  }

  // ── Line data — one point per x label ────────────────────────────────────
  // When multiple rows share the same x (stacked case), average the line values.
  const lineSums = {};
  const lineCounts = {};
  rawRows.forEach(r => {
    lineSums[r.x]   = (lineSums[r.x]   || 0) + r.line;
    lineCounts[r.x] = (lineCounts[r.x] || 0) + 1;
  });
  const lineData = xLabels.map(x => ({
    x,
    value: lineSums[x] / lineCounts[x],
  }));

  return {
    xLabels, xIsDate, stacked, groups, stackData, barData, lineData,
    barFieldName: barField, lineFieldName: lineField,
  };
}

// ─── Drawing ─────────────────────────────────────────────────────────────────
function drawChart(parsed) {
  const { xLabels, xIsDate, stacked, groups, stackData, barData, lineData,
          barFieldName, lineFieldName } = parsed;

  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top  - MARGIN.bottom;

  d3.select(container).selectAll('*').remove();

  if (!xLabels.length) { container.textContent = 'No data.'; return; }

  // ── X scale (scaleBand — always, bars require bandwidth) ──────────────────
  const xScale = d3.scaleBand()
    .domain(xLabels)
    .range([0, w])
    .padding(0.3);

  // ── Left Y scale — bars, starts at 0 ─────────────────────────────────────
  let barMax;
  if (stacked) {
    // Max of the top of each stack
    barMax = d3.max(stackData[stackData.length - 1], d => d[1]);
  } else {
    barMax = d3.max(barData, d => d.value);
  }
  const yLeft = d3.scaleLinear()
    .domain([0, (barMax || 0) * 1.1])
    .nice()
    .range([h, 0]);

  // ── Right Y scale — line, auto-ranged (can be negative) ──────────────────
  const lineExtent = d3.extent(lineData, d => d.value);
  const yRight = d3.scaleLinear()
    .domain(lineExtent)
    .nice()
    .range([h, 0]);

  // ── Color scale for stacked bars ──────────────────────────────────────────
  const stackColor = d3.scaleOrdinal()
    .domain(groups)
    .range(STACK_COLORS);

  // ── SVG root ──────────────────────────────────────────────────────────────
  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H);

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // ── Gridlines — left axis only (avoid double grid from dual axes) ─────────
  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yLeft).tickSize(-w).tickFormat(''))
    .call(grp => grp.select('.domain').remove());

  // ── X Axis ────────────────────────────────────────────────────────────────
  const xFmt = xIsDate
    ? label => d3.timeFormat('%b %Y')(new Date(label))
    : label => label;

  const maxTicks = Math.max(2, Math.floor(w / 60));
  const tickStep = Math.ceil(xLabels.length / maxTicks);
  const tickValues = xLabels.filter((_, i) => i % tickStep === 0);

  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(
      d3.axisBottom(xScale)
        .tickValues(tickValues)
        .tickFormat(xFmt)
        .tickSizeOuter(0)
    )
    .selectAll('text')
      .attr('transform', 'rotate(-35)')
      .style('text-anchor', 'end')
      .attr('dy', '0.35em')
      .attr('dx', '-0.5em');

  // ── Left Y Axis ───────────────────────────────────────────────────────────
  g.append('g')
    .attr('class', 'axis y-axis-left')
    .call(
      d3.axisLeft(yLeft)
        .ticks(6)
        .tickSizeOuter(0)
        .tickFormat(d3.format('~s'))
    );

  // ── Right Y Axis ──────────────────────────────────────────────────────────
  g.append('g')
    .attr('class', 'axis axis-right y-axis-right')
    .attr('transform', `translate(${w},0)`)
    .call(
      d3.axisRight(yRight)
        .ticks(6)
        .tickSizeOuter(0)
        .tickFormat(d3.format('~s'))
    );

  // ── Bars ──────────────────────────────────────────────────────────────────
  if (stacked) {
    // Stacked layers
    stackData.forEach((layer, i) => {
      g.selectAll(`.bar-layer-${i}`)
        .data(layer)
        .join('rect')
          .attr('class', 'bar')
          .attr('x', d => xScale(d.data.x))
          .attr('y', d => yLeft(d[1]))
          .attr('width', xScale.bandwidth())
          .attr('height', d => Math.max(0, yLeft(d[0]) - yLeft(d[1])))
          .attr('fill', stackColor(groups[i]));
    });
  } else {
    g.selectAll('.bar')
      .data(barData)
      .join('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.x))
        .attr('y', d => yLeft(d.value))
        .attr('width', xScale.bandwidth())
        .attr('height', d => Math.max(0, h - yLeft(d.value)))
        .attr('fill', BAR_COLOR);
  }

  // ── Line overlay ──────────────────────────────────────────────────────────
  const lineGen = d3.line()
    .x(d => xScale(d.x) + xScale.bandwidth() / 2)
    .y(d => yRight(d.value))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(lineData)
    .attr('class', 'combo-line')
    .attr('d', lineGen);

  // Dots on the line
  g.selectAll('.line-dot')
    .data(lineData)
    .join('circle')
      .attr('class', 'line-dot')
      .attr('cx', d => xScale(d.x) + xScale.bandwidth() / 2)
      .attr('cy', d => yRight(d.value))
      .attr('r', 3)
      .attr('fill', LINE_COLOR)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

  // ── Legend ────────────────────────────────────────────────────────────────
  const legendX = w + 10;
  const legend = g.append('g').attr('class', 'legend').attr('transform', `translate(${legendX}, 0)`);

  // Bar legend entry — rect icon
  const barLabel = stacked ? barFieldName : barFieldName;
  const barLegendRow = legend.append('g').attr('transform', 'translate(0, 0)');
  barLegendRow.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', 14).attr('height', 10)
    .attr('fill', stacked ? STACK_COLORS[0] : BAR_COLOR);
  barLegendRow.append('text')
    .attr('x', 20).attr('y', 9)
    .text(`${barLabel} (bars)`);

  // Line legend entry — line icon
  const lineLabel = lineFieldName;
  const lineLegendRow = legend.append('g').attr('transform', 'translate(0, 22)');
  lineLegendRow.append('line')
    .attr('x1', 0).attr('x2', 14)
    .attr('y1', 5).attr('y2', 5)
    .attr('stroke', LINE_COLOR)
    .attr('stroke-width', 2.5);
  lineLegendRow.append('circle')
    .attr('cx', 7).attr('cy', 5).attr('r', 3)
    .attr('fill', LINE_COLOR)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1);
  lineLegendRow.append('text')
    .attr('x', 20).attr('y', 9)
    .text(`${lineLabel} (line)`);

  // Stack group legend entries (when stacked, show all groups)
  if (stacked) {
    groups.forEach((grp, i) => {
      const row = legend.append('g').attr('transform', `translate(0, ${44 + i * 20})`);
      row.append('rect')
        .attr('x', 0).attr('y', 0)
        .attr('width', 14).attr('height', 10)
        .attr('fill', stackColor(grp));
      row.append('text')
        .attr('x', 20).attr('y', 9)
        .text(grp);
    });
  }

  // ── Crosshair + Tooltip ───────────────────────────────────────────────────
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0)
    .style('position', 'absolute')
    .style('left', '0px')
    .style('top', '0px');

  const crosshair = g.append('line')
    .attr('class', 'crosshair')
    .attr('y1', 0)
    .attr('y2', h)
    .style('display', 'none');

  const fmtNum = d3.format(',~f');
  const bandStep = xScale.step();

  g.append('rect')
    .attr('width', w)
    .attr('height', h)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .on('mousemove', function (event) {
      const [mx] = d3.pointer(event);

      // Nearest band — scaleBand has no .invert(), compute manually
      const bandIdx = Math.max(0, Math.min(
        xLabels.length - 1,
        Math.floor(mx / bandStep)
      ));
      const xLabel = xLabels[bandIdx];
      const cx = xScale(xLabel) + xScale.bandwidth() / 2;

      // Position crosshair
      crosshair
        .style('display', null)
        .attr('x1', cx)
        .attr('x2', cx);

      // Gather values
      const linePt = lineData.find(d => d.x === xLabel);
      const lineVal = linePt ? fmtNum(linePt.value) : 'N/A';

      let barHtml;
      if (stacked) {
        const breakdown = groups.map(grp => {
          const layer = stackData.find((_, i) => groups[i] === grp);
          const pt = layer ? layer.find(d => d.data.x === xLabel) : null;
          const val = pt ? fmtNum(pt[1] - pt[0]) : '0';
          return `<span style="color:${stackColor(grp)}">&#9632;</span>&nbsp;${grp}: <b>${val}</b>`;
        });
        barHtml = breakdown.join('<br>');
      } else {
        const barPt = barData.find(d => d.x === xLabel);
        const barVal = barPt ? fmtNum(barPt.value) : 'N/A';
        barHtml = `<span style="color:${BAR_COLOR}">&#9632;</span>&nbsp;${barFieldName}: <b>${barVal}</b>`;
      }

      const xDisplay = xIsDate
        ? d3.timeFormat('%b %Y')(new Date(xLabel))
        : xLabel;

      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${event.offsetY - 10}px`)
        .html(
          `<div class="tt-label">${xDisplay}</div>` +
          barHtml +
          `<br><span style="color:${LINE_COLOR}">&#9679;</span>&nbsp;` +
          `${lineFieldName}: <b>${lineVal}</b>`
        );
    })
    .on('mouseleave', () => {
      tooltip.style('opacity', 0);
      crosshair.style('display', 'none');
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
