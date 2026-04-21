'use strict';

const MARGIN = { top: 30, right: 160, bottom: 60, left: 75 };

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
    sizeMin:      Number(document.getElementById('sizeMin').value) || 6,
    sizeMax:      Number(document.getElementById('sizeMax').value) || 40,
    showLabels:   document.getElementById('btnLabels').classList.contains('active'),
    showQuadrants:document.getElementById('btnQuadrants').classList.contains('active'),
    xLabel:       document.getElementById('xLabel').value || 'X Axis',
    yLabel:       document.getElementById('yLabel').value || 'Y Axis',
  };
}

function redraw() {
  if (_cachedData) drawChart(_cachedData);
}

['sizeMin','sizeMax','xLabel','yLabel'].forEach(id => {
  document.getElementById(id).addEventListener('input', redraw);
});
['btnLabels','btnQuadrants'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    e.currentTarget.classList.toggle('active');
    redraw();
  });
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

  const xField     = fieldName('x');
  const yField     = fieldName('y');
  const sizeField  = fieldName('size');
  const colorField = fieldName('color');
  const labelField = fieldName('label');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!xField || !(xField in colIndex))     throw new Error('Drag a numeric measure onto the "X Axis Measure" encoding slot.');
  if (!yField || !(yField in colIndex))     throw new Error('Drag a numeric measure onto the "Y Axis Measure" encoding slot.');
  if (!sizeField || !(sizeField in colIndex)) throw new Error('Drag a numeric measure onto the "Bubble Size" encoding slot.');
  if (!colorField || !(colorField in colIndex)) throw new Error('Drag a dimension onto the "Segment (Color)" encoding slot.');

  const xi = colIndex[xField];
  const yi = colIndex[yField];
  const si = colIndex[sizeField];
  const ci = colIndex[colorField];
  const li = labelField && labelField in colIndex ? colIndex[labelField] : null;

  return dataTable.data
    .map(row => ({
      x:     Number(row[xi].value),
      y:     Number(row[yi].value),
      size:  Number(row[si].value),
      color: String(row[ci].value),
      label: li !== null ? String(row[li].value) : String(row[ci].value),
    }))
    .filter(r => !Number.isNaN(r.x) && !Number.isNaN(r.y) && !Number.isNaN(r.size));
}

// ─── Draw ────────────────────────────────────────────────────────────────────
function drawChart(data) {
  const cfg = getConfig();
  const container = document.getElementById('chart');
  const toolbar = document.getElementById('toolbar');
  const totalH = window.innerHeight - toolbar.offsetHeight;
  const W = container.clientWidth || window.innerWidth;
  const H = totalH;
  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;

  // Clear
  d3.select('#chart').selectAll('svg').remove();

  const svg = d3.select('#chart').append('svg')
    .attr('width', W)
    .attr('height', H);

  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Scales
  const xExt = d3.extent(data, d => d.x);
  const yExt = d3.extent(data, d => d.y);
  const xPad = (xExt[1] - xExt[0]) * 0.1 || 1;
  const yPad = (yExt[1] - yExt[0]) * 0.1 || 1;

  const xScale = d3.scaleLinear()
    .domain([xExt[0] - xPad, xExt[1] + xPad])
    .range([0, innerW])
    .nice();

  const yScale = d3.scaleLinear()
    .domain([yExt[0] - yPad, yExt[1] + yPad])
    .range([innerH, 0])
    .nice();

  const sizeScale = d3.scaleSqrt()
    .domain([0, d3.max(data, d => d.size)])
    .range([cfg.sizeMin, cfg.sizeMax]);

  const colorDomain = [...new Set(data.map(d => d.color))].sort();
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(colorDomain);

  // Grid
  g.append('g').attr('class', 'grid')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).tickSize(-innerH).tickFormat(''))
    .select('.domain').remove();

  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(''))
    .select('.domain').remove();

  d3.selectAll('.grid line').attr('stroke', '#ebebeb').attr('stroke-dasharray', '3 3');

  // Axes
  g.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(6).tickSizeOuter(0));

  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(6).tickSizeOuter(0));

  // Axis labels
  g.append('text')
    .attr('x', innerW / 2)
    .attr('y', innerH + 46)
    .attr('text-anchor', 'middle')
    .attr('font-size', 12)
    .attr('fill', '#555')
    .text(cfg.xLabel);

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -58)
    .attr('text-anchor', 'middle')
    .attr('font-size', 12)
    .attr('fill', '#555')
    .text(cfg.yLabel);

  // Quadrant lines at median X and median Y
  if (cfg.showQuadrants) {
    const medX = d3.median(data, d => d.x);
    const medY = d3.median(data, d => d.y);

    const qLineStyle = sel => sel
      .attr('stroke', '#bbb')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5 4');

    qLineStyle(g.append('line')
      .attr('x1', xScale(medX)).attr('x2', xScale(medX))
      .attr('y1', 0).attr('y2', innerH));

    qLineStyle(g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', yScale(medY)).attr('y2', yScale(medY)));

    // Quadrant corner labels
    const fmt = d3.format(',.0f');
    const qLabels = [
      { x: xScale(medX) + 6,  y: 14,         text: `Median X: ${fmt(medX)}`, anchor: 'start' },
      { x: innerW - 4,        y: yScale(medY) - 6, text: `Median Y: ${fmt(medY)}`, anchor: 'end' },
    ];
    qLabels.forEach(ql => {
      g.append('text')
        .attr('x', ql.x).attr('y', ql.y)
        .attr('text-anchor', ql.anchor)
        .attr('font-size', 10)
        .attr('fill', '#999')
        .text(ql.text);
    });
  }

  // Bubbles
  const tooltip = d3.select('#tooltip');
  const fmt = d3.format(',.1f');

  const bubbles = g.selectAll('.bubble')
    .data(data)
    .join('circle')
    .attr('class', 'bubble')
    .attr('cx', d => xScale(d.x))
    .attr('cy', d => yScale(d.y))
    .attr('r', d => sizeScale(d.size))
    .attr('fill', d => colorScale(d.color))
    .attr('fill-opacity', 0.75)
    .attr('stroke', d => d3.color(colorScale(d.color)).darker(0.4))
    .attr('stroke-width', 1.2);

  // Tooltip
  bubbles
    .on('mouseenter', (event, d) => {
      tooltip
        .style('display', 'block')
        .html(`<div class="tt-title">${d.color}</div>
               <div>X: ${fmt(d.x)}</div>
               <div>Y: ${fmt(d.y)}</div>
               <div>Size: ${fmt(d.size)}</div>
               ${d.label !== d.color ? `<div>Label: ${d.label}</div>` : ''}`);
    })
    .on('mousemove', event => {
      const box = document.getElementById('chart').getBoundingClientRect();
      tooltip
        .style('left', `${event.clientX - box.left + 12}px`)
        .style('top',  `${event.clientY - box.top  - 28}px`);
    })
    .on('mouseleave', () => tooltip.style('display', 'none'));

  // Bubble labels
  if (cfg.showLabels) {
    g.selectAll('.bubble-label')
      .data(data)
      .join('text')
      .attr('class', 'bubble-label')
      .attr('x', d => xScale(d.x))
      .attr('y', d => yScale(d.y) + 1)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', d => Math.min(10, sizeScale(d.size) * 0.55))
      .attr('fill', d => {
        const c = d3.hsl(colorScale(d.color));
        return c.l > 0.55 ? '#333' : '#fff';
      })
      .attr('pointer-events', 'none')
      .each(function(d) {
        const r = sizeScale(d.size);
        const maxChars = Math.floor(r / 3.5);
        const txt = d.label.length > maxChars && maxChars > 2
          ? d.label.slice(0, maxChars - 1) + '…'
          : d.label;
        d3.select(this).text(r > 12 ? txt : '');
      });
  }

  // Legend
  const legendG = svg.append('g')
    .attr('transform', `translate(${W - MARGIN.right + 16}, ${MARGIN.top})`);

  colorDomain.forEach((seg, i) => {
    const row = legendG.append('g').attr('transform', `translate(0,${i * 20})`);
    row.append('circle').attr('cx', 6).attr('cy', 6).attr('r', 6)
      .attr('fill', colorScale(seg)).attr('fill-opacity', 0.8);
    row.append('text').attr('x', 16).attr('y', 10)
      .attr('font-size', 11).attr('fill', '#444').text(seg);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function setError(msg) {
  document.getElementById('error').textContent = msg;
}
function clearError() {
  document.getElementById('error').textContent = '';
}

// Resize
window.addEventListener('resize', () => { if (_cachedData) drawChart(_cachedData); });
