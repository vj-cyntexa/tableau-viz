'use strict';

const MARGIN = { top: 30, right: 30, bottom: 70, left: 75 };

// Color scheme definitions: [gain color, loss color, total color]
const COLOR_SCHEMES = {
  'blue-red':  { gain: '#4e79a7', loss: '#e15759', total: '#59a14f' },
  'green-red': { gain: '#59a14f', loss: '#e15759', total: '#4e79a7' },
  'single':    { gain: '#76b7b2', loss: '#76b7b2', total: '#76b7b2' },
};

window.WF_STATE = {
  colorScheme: 'blue-red',
  showConnectors: true,
  showRunningTotal: true,
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
    window.WF_STATE.lastData = parsed;
    drawChart(parsed);
  } catch (err) {
    setError(err.message || String(err));
  }
}

function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection?.[0];
  if (!marksSpec) throw new Error('No marks specification found.');
  const encodings = marksSpec.encodingCollection;

  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const labelField = fieldName('label');
  const valueField = fieldName('value');
  const typeField  = fieldName('type');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!labelField || !(labelField in colIndex))
    throw new Error('Drag a dimension onto the "Step Label" encoding slot.');
  if (!valueField || !(valueField in colIndex))
    throw new Error('Drag a measure onto the "Value" encoding slot.');

  const li = colIndex[labelField];
  const vi = colIndex[valueField];
  const ti = typeField && (typeField in colIndex) ? colIndex[typeField] : null;

  // CRITICAL: preserve data row order — do NOT sort
  const rawRows = dataTable.data.map((row, idx) => ({
    label: String(row[li].value),
    value: Number(row[vi].value) || 0,
    type:  ti !== null ? String(row[ti].value).toLowerCase().trim() : null,
    rowIdx: idx,
  }));

  if (!rawRows.length) throw new Error('No rows found. Check encoding slots.');

  // Resolve bar types:
  // When type encoding is absent: first row = "total", last row = "total", all others = "relative"
  // When type encoding is present: use as-is; unrecognized values → "relative"
  const steps = rawRows.map((r, i) => {
    let barType = r.type;
    if (barType === null) {
      barType = (i === 0 || i === rawRows.length - 1) ? 'total' : 'relative';
    }
    if (!['total', 'subtotal', 'relative'].includes(barType)) {
      barType = 'relative';
    }
    return { label: r.label, value: r.value, barType };
  });

  // Compute waterfall geometry: each step has { y0, y1 } in data units
  // "total" bar: spans from 0 to abs(value) (absolute, not floating)
  // "subtotal" bar: spans from 0 to running total at this point
  // "relative" bar: floats from previous running total to previous running total + value
  let runningTotal = 0;
  const computed = steps.map((step, i) => {
    let y0, y1;
    if (step.barType === 'total') {
      y0 = 0;
      y1 = step.value;
      // Running total is reset to this value
      runningTotal = step.value;
    } else if (step.barType === 'subtotal') {
      // Show current running total as absolute bar from 0
      y0 = 0;
      y1 = runningTotal;
      // Running total not changed by subtotal bars
    } else {
      // relative: float bar
      y0 = runningTotal;
      y1 = runningTotal + step.value;
      runningTotal = y1;
    }
    return {
      label:    step.label,
      value:    step.value,
      barType:  step.barType,
      y0:       Math.min(y0, y1),
      y1:       Math.max(y0, y1),
      runningTotal,
      isGain:   step.value >= 0,
    };
  });

  return computed;
}

function drawChart(steps) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top - MARGIN.bottom;

  d3.select(container).selectAll('*').remove();

  const { colorScheme, showConnectors, showRunningTotal } = window.WF_STATE;
  const scheme = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES['blue-red'];

  // Y domain: include 0 always, plus all y0/y1 values
  const allYVals = steps.flatMap(s => [s.y0, s.y1, 0]);
  const yMin = Math.min(...allYVals);
  const yMax = Math.max(...allYVals);
  const yPad = (yMax - yMin) * 0.1 || 1000;

  const x = d3.scaleBand()
    .domain(steps.map((_, i) => i))
    .range([0, w])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([yMin - yPad * 0.5, yMax + yPad])
    .nice()
    .range([h, 0]);

  const fmtVal = d3.format(',~r');
  const fmtSign = v => (v >= 0 ? '+' : '') + fmtVal(v);

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

  // Zero line
  if (y(0) >= 0 && y(0) <= h) {
    g.append('line')
      .attr('class', 'zero-line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', y(0)).attr('y2', y(0));
  }

  // X axis
  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x)
      .tickFormat(i => steps[i]?.label || '')
      .tickSizeOuter(0))
    .selectAll('text')
    .attr('transform', 'rotate(-35)')
    .attr('text-anchor', 'end')
    .attr('dy', '0.5em')
    .attr('dx', '-0.5em');

  // Y axis
  g.append('g')
    .attr('class', 'axis y-axis')
    .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0).tickFormat(d3.format('~s')));

  // Tooltip
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  // Connector lines between bars
  if (showConnectors) {
    for (let i = 0; i < steps.length - 1; i++) {
      const curr = steps[i];
      const next = steps[i + 1];
      // Connect top of current bar to top-left of next bar
      const connY = curr.barType === 'total' || curr.barType === 'subtotal'
        ? y(curr.y1)
        : (curr.isGain ? y(curr.y1) : y(curr.y0));
      const x1 = x(i) + x.bandwidth();
      const x2 = x(i + 1);
      g.append('line')
        .attr('class', 'connector')
        .attr('x1', x1).attr('x2', x2)
        .attr('y1', connY).attr('y2', connY);
    }
  }

  // Bars
  steps.forEach((step, i) => {
    const bx     = x(i);
    const bw     = x.bandwidth();
    const by     = y(step.y1);
    const bh     = Math.max(1, Math.abs(y(step.y0) - y(step.y1)));

    let fillColor;
    if (step.barType === 'total' || step.barType === 'subtotal') {
      fillColor = scheme.total;
    } else {
      fillColor = step.isGain ? scheme.gain : scheme.loss;
    }

    const bar = g.append('rect')
      .attr('x', bx)
      .attr('y', by)
      .attr('width', bw)
      .attr('height', bh)
      .attr('fill', fillColor)
      .attr('rx', 2)
      .style('cursor', 'pointer');

    bar.on('mouseenter', function (event) {
      const typeLabel = step.barType === 'total' ? 'Total' : step.barType === 'subtotal' ? 'Subtotal' : (step.isGain ? 'Gain' : 'Loss');
      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${event.offsetY - 10}px`)
        .html(`<div class="tt-title">${step.label}</div>
               Type: <b>${typeLabel}</b><br>
               Change: <b>${fmtSign(step.value)}</b><br>
               Running total: <b>${fmtVal(step.runningTotal)}</b>`);
    })
    .on('mousemove', function (event) {
      tooltip
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${event.offsetY - 10}px`);
    })
    .on('mouseleave', () => tooltip.style('opacity', 0));

    // Bar value label above bar
    const labelText = step.barType === 'total' || step.barType === 'subtotal'
      ? fmtVal(step.value)
      : fmtSign(step.value);

    g.append('text')
      .attr('class', 'bar-label')
      .attr('x', bx + bw / 2)
      .attr('y', by - 4)
      .attr('fill', fillColor)
      .attr('font-size', '11px')
      .text(labelText);

    // Running total label below bar (if enabled and not total/subtotal)
    if (showRunningTotal && step.barType === 'relative') {
      g.append('text')
        .attr('class', 'running-total')
        .attr('x', bx + bw / 2)
        .attr('y', y(step.y0) + (step.isGain ? 12 : -4))
        .text(fmtVal(step.runningTotal));
    }
  });
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.WF_STATE.lastData) drawChart(window.WF_STATE.lastData);
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
