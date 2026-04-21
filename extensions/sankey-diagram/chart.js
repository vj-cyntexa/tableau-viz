'use strict';

const COLORS = d3.schemeTableau10;
const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };

// Toolbar state shared with index.html toolbar wiring
window.SANKEY_STATE = {
  alignment: 'justify',
  colorMode: 'source',
  lastData: null,
  redraw() {
    if (this.lastData) drawChart(this.lastData);
  },
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
    window.SANKEY_STATE.lastData = parsed;
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

  const sourceField = fieldName('source');
  const targetField = fieldName('target');
  const valueField  = fieldName('value');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!sourceField || !(sourceField in colIndex))
    throw new Error('Drag a dimension onto the "Source Node" encoding slot.');
  if (!targetField || !(targetField in colIndex))
    throw new Error('Drag a dimension onto the "Target Node" encoding slot.');
  if (!valueField || !(valueField in colIndex))
    throw new Error('Drag a measure onto the "Flow Volume" encoding slot.');

  const si = colIndex[sourceField];
  const ti = colIndex[targetField];
  const vi = colIndex[valueField];

  const links = dataTable.data
    .map(row => ({
      source: String(row[si].value),
      target: String(row[ti].value),
      value:  Math.max(0, Number(row[vi].value) || 0),
    }))
    .filter(r => r.source && r.target && r.value > 0);

  if (!links.length) throw new Error('No valid flow rows found. Check field types on encoding slots.');

  // Build unique node set preserving first-seen order
  const nodeSet = new Set();
  links.forEach(l => { nodeSet.add(l.source); nodeSet.add(l.target); });
  const nodeNames = Array.from(nodeSet);

  return { nodeNames, links };
}

function getAlignFn(alignment) {
  const map = {
    justify: d3.sankeyJustify,
    left:    d3.sankeyLeft,
    right:   d3.sankeyRight,
    center:  d3.sankeyCenter,
  };
  return map[alignment] || d3.sankeyJustify;
}

function drawChart({ nodeNames, links }) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top - MARGIN.bottom;

  d3.select(container).selectAll('*').remove();

  const { alignment, colorMode } = window.SANKEY_STATE;

  // Build nodes array
  const nodes = nodeNames.map(name => ({ name }));

  // Map link source/target strings to node indices
  const nodeIdx = Object.fromEntries(nodeNames.map((n, i) => [n, i]));
  const sankeyLinks = links.map(l => ({
    source: nodeIdx[l.source],
    target: nodeIdx[l.target],
    value:  l.value,
    sourceName: l.source,
    targetName: l.target,
  }));

  const sankeyGen = d3.sankey()
    .nodeAlign(getAlignFn(alignment))
    .nodeWidth(20)
    .nodePadding(12)
    .size([w, h]);

  let graph;
  try {
    graph = sankeyGen({
      nodes: nodes.map(d => Object.assign({}, d)),
      links: sankeyLinks.map(d => Object.assign({}, d)),
    });
  } catch (e) {
    setError('Sankey layout error: ' + (e.message || String(e)));
    return;
  }

  const color = d3.scaleOrdinal()
    .domain(nodeNames)
    .range(COLORS);

  const linkColor = (link) => {
    if (colorMode === 'source') return color(link.source.name);
    if (colorMode === 'target') return color(link.target.name);
    return '#aaa';
  };

  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H);

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Tooltip div
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  // Links
  const linkPaths = g.append('g')
    .attr('class', 'links')
    .selectAll('path')
    .data(graph.links)
    .join('path')
    .attr('class', 'link')
    .attr('d', d3.sankeyLinkHorizontal())
    .attr('stroke', d => linkColor(d))
    .attr('stroke-width', d => Math.max(1, d.width))
    .on('mouseenter', function (event, d) {
      const sourceName = d.source.name;
      const targetName = d.target.name;
      const sourceTotal = d3.sum(graph.links.filter(l => l.source.name === sourceName), l => l.value);
      const pct = sourceTotal > 0 ? ((d.value / sourceTotal) * 100).toFixed(1) : '—';
      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${event.offsetY - 10}px`)
        .html(`<div class="tt-title">${sourceName} → ${targetName}</div>
               Volume: <b>${d3.format(',')(Math.round(d.value))}</b><br>
               % of source: <b>${pct}%</b>`);
    })
    .on('mousemove', function (event) {
      tooltip
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${event.offsetY - 10}px`);
    })
    .on('mouseleave', () => tooltip.style('opacity', 0));

  // Nodes
  const nodeGroups = g.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(graph.nodes)
    .join('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  nodeGroups.append('rect')
    .attr('width', d => d.x1 - d.x0)
    .attr('height', d => Math.max(1, d.y1 - d.y0))
    .attr('fill', d => color(d.name))
    .attr('rx', 2)
    .on('mouseenter', function (event, d) {
      const totalOut = d3.sum(graph.links.filter(l => l.source.name === d.name), l => l.value);
      const totalIn  = d3.sum(graph.links.filter(l => l.target.name === d.name), l => l.value);
      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 14 + d.x0}px`)
        .style('top',  `${event.offsetY - 10 + d.y0}px`)
        .html(`<div class="tt-title">${d.name}</div>
               Inflow: <b>${d3.format(',')(Math.round(totalIn))}</b><br>
               Outflow: <b>${d3.format(',')(Math.round(totalOut))}</b>`);
    })
    .on('mouseleave', () => tooltip.style('opacity', 0));

  // Node labels — right of node when node is left-ish, left when right-ish
  nodeGroups.append('text')
    .attr('x', d => {
      const midX = (d.x0 + d.x1) / 2;
      return midX < w / 2 ? (d.x1 - d.x0) + 6 : -6;
    })
    .attr('y', d => (d.y1 - d.y0) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', d => {
      const midX = (d.x0 + d.x1) / 2;
      return midX < w / 2 ? 'start' : 'end';
    })
    .text(d => d.name);
}

// Debounced resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.SANKEY_STATE.lastData) drawChart(window.SANKEY_STATE.lastData);
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
