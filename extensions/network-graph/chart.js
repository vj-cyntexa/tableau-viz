'use strict';

// ─── Module-scope state ───────────────────────────────────────────────────────
let _rawEdges = null;
let _nodeSizeMap = null;
let _simulation = null;
let _frozen = false;

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
    const parsed = parseTableauData(dataTable, vizSpec);
    _rawEdges    = parsed.edges;
    _nodeSizeMap = parsed.nodeSizeMap;
    drawChart();
  } catch (err) { setError(err.message || String(err)); }
}

// ─── Toolbar controls ─────────────────────────────────────────────────────────
const thresholdSlider = document.getElementById('threshold');
const thresholdVal    = document.getElementById('thresholdVal');
const btnLabels       = document.getElementById('btnLabels');
const btnFreeze       = document.getElementById('btnFreeze');

thresholdSlider.addEventListener('input', () => {
  thresholdVal.textContent = thresholdSlider.value + '%';
  drawChart();
});

btnLabels.addEventListener('click', () => {
  btnLabels.classList.toggle('active');
  drawChart();
});

btnFreeze.addEventListener('click', () => {
  _frozen = !_frozen;
  btnFreeze.classList.toggle('active', _frozen);
  btnFreeze.textContent = _frozen ? 'Unfreeze' : 'Freeze';
  if (_simulation) {
    _frozen ? _simulation.stop() : _simulation.alpha(0.3).restart();
  }
});

// ─── Parse ────────────────────────────────────────────────────────────────────
function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;
  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const srcField      = fieldName('source');
  const tgtField      = fieldName('target');
  const weightField   = fieldName('weight');
  const nodeSzField   = fieldName('node_size');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!srcField    || !(srcField in colIndex))    throw new Error('Drag a dimension onto the "Source Node" encoding slot.');
  if (!tgtField    || !(tgtField in colIndex))    throw new Error('Drag a dimension onto the "Target Node" encoding slot.');
  if (!weightField || !(weightField in colIndex)) throw new Error('Drag a measure onto the "Relationship Strength" encoding slot.');

  const si = colIndex[srcField];
  const ti = colIndex[tgtField];
  const wi = colIndex[weightField];
  const ni = nodeSzField && nodeSzField in colIndex ? colIndex[nodeSzField] : null;

  const edges = [];
  const nodeSizeMap = new Map();

  dataTable.data.forEach(row => {
    const src    = String(row[si].value);
    const tgt    = String(row[ti].value);
    const weight = Number(row[wi].value);
    if (Number.isNaN(weight)) return;

    edges.push({ source: src, target: tgt, weight });

    if (ni !== null) {
      const ns = Number(row[ni].value);
      if (!Number.isNaN(ns)) {
        nodeSizeMap.set(src, Math.max(nodeSizeMap.get(src) || 0, ns));
        nodeSizeMap.set(tgt, Math.max(nodeSizeMap.get(tgt) || 0, ns));
      }
    }
  });

  return { edges, nodeSizeMap };
}

// ─── Draw ─────────────────────────────────────────────────────────────────────
function drawChart() {
  if (!_rawEdges) return;

  // Compute threshold value from percentile
  const pctSlider = Number(thresholdSlider.value) / 100;
  const weights   = _rawEdges.map(e => e.weight).sort((a, b) => a - b);
  const threshold = weights[Math.floor(pctSlider * (weights.length - 1))] ?? 0;

  // Filter edges BEFORE building simulation
  const filteredEdges = _rawEdges.filter(e => e.weight >= threshold);

  // Build node list from filtered edges
  const nodeSet = new Set();
  filteredEdges.forEach(e => { nodeSet.add(e.source); nodeSet.add(e.target); });
  const nodeIds = [...nodeSet];

  // Degree centrality fallback
  const degreeMap = new Map();
  filteredEdges.forEach(e => {
    degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
  });

  const hasNodeSize = _nodeSizeMap.size > 0;
  const maxSize  = hasNodeSize ? Math.max(..._nodeSizeMap.values()) : Math.max(...degreeMap.values(), 1);
  const sizeScale = d3.scaleSqrt()
    .domain([0, maxSize])
    .range([6, 28]);

  const weightValues = filteredEdges.map(e => e.weight);
  const wMin = d3.min(weightValues) ?? 0;
  const wMax = d3.max(weightValues) ?? 1;
  const strokeScale = d3.scaleLinear().domain([wMin, wMax]).range([1, 6]);
  const strokeOpacity = d3.scaleLinear().domain([wMin, wMax]).range([0.2, 0.7]);

  const showLabels = btnLabels.classList.contains('active');

  const container = document.getElementById('chart');
  const toolbar   = document.getElementById('toolbar');
  const W = window.innerWidth;
  const H = window.innerHeight - toolbar.offsetHeight;
  container.style.height = H + 'px';

  // Clear previous SVG and stop old simulation
  if (_simulation) _simulation.stop();
  d3.select('#chart').selectAll('svg').remove();

  const svg = d3.select('#chart').append('svg').attr('width', W).attr('height', H);

  // Arrow markers (optional decoration)
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20).attr('refY', 0)
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#aaa');

  const nodes = nodeIds.map(id => ({ id }));
  const links = filteredEdges.map(e => ({ ...e }));

  // Node color by cluster (simple hash)
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

  // Build simulation
  _simulation = d3.forceSimulation(nodes)
    .force('link',   d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collide',d3.forceCollide().radius(d => {
      const sz = hasNodeSize ? (_nodeSizeMap.get(d.id) || 0) : (degreeMap.get(d.id) || 1);
      return sizeScale(sz) + 4;
    }));

  if (_frozen) _simulation.stop();

  // Links
  const link = svg.append('g').attr('class', 'links')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', d => d3.interpolateGreys((d.weight - wMin) / (wMax - wMin + 0.001) * 0.6 + 0.2))
    .attr('stroke-width', d => strokeScale(d.weight))
    .attr('stroke-opacity', d => strokeOpacity(d.weight));

  // Node groups
  const tooltip = d3.select('#tooltip');
  const fmt = d3.format(',.2f');

  const node = svg.append('g').attr('class', 'nodes')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .call(d3.drag()
      .on('start', (event, d) => {
        if (!_frozen && !event.active) _simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!_frozen && !event.active) _simulation.alphaTarget(0);
        // Keep pinned after drag
      })
    );

  node.append('circle')
    .attr('r', d => {
      const sz = hasNodeSize ? (_nodeSizeMap.get(d.id) || 0) : (degreeMap.get(d.id) || 1);
      return sizeScale(sz);
    })
    .attr('fill', d => colorScale(d.id))
    .attr('fill-opacity', 0.8)
    .attr('stroke', d => d3.color(colorScale(d.id)).darker(0.5))
    .attr('stroke-width', 1.5)
    .on('mouseenter', (event, d) => {
      const degree = degreeMap.get(d.id) || 0;
      const sizeSrc = hasNodeSize ? _nodeSizeMap.get(d.id) : null;
      tooltip
        .style('display', 'block')
        .html(`<div class="tt-title">${d.id}</div>
               <div>Connections: ${degree}</div>
               ${sizeSrc != null ? `<div>Volume: ${fmt(sizeSrc)}</div>` : ''}`);
    })
    .on('mousemove', event => {
      const box = document.getElementById('chart').getBoundingClientRect();
      tooltip
        .style('left', `${event.clientX - box.left + 12}px`)
        .style('top',  `${event.clientY - box.top  - 28}px`);
    })
    .on('mouseleave', () => tooltip.style('display', 'none'));

  if (showLabels) {
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 10)
      .attr('fill', '#fff')
      .attr('pointer-events', 'none')
      .each(function(d) {
        const r = (() => {
          const sz = hasNodeSize ? (_nodeSizeMap.get(d.id) || 0) : (degreeMap.get(d.id) || 1);
          return sizeScale(sz);
        })();
        const maxChars = Math.floor(r / 3.5);
        const lbl = d.id.length > maxChars && maxChars > 2 ? d.id.slice(0, maxChars - 1) + '…' : d.id;
        d3.select(this).text(r > 10 ? lbl : '');
      });

    // External label below node
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => {
        const sz = hasNodeSize ? (_nodeSizeMap.get(d.id) || 0) : (degreeMap.get(d.id) || 1);
        return sizeScale(sz) + 12;
      })
      .attr('font-size', 10)
      .attr('fill', '#444')
      .attr('pointer-events', 'none')
      .text(d => d.id);
  }

  // Tick
  _simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function setError(msg) { document.getElementById('error').textContent = msg; }
function clearError()  { document.getElementById('error').textContent = ''; }

window.addEventListener('resize', drawChart);
