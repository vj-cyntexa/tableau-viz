'use strict';

const COLORS = d3.schemeTableau10;

window.TREEMAP_STATE = {
  tiling: 'squarify',
  colorMode: 'category',
  showParentLabels: true,
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
    window.TREEMAP_STATE.lastData = parsed;
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

  const labelField  = fieldName('label');
  const parentField = fieldName('parent');
  const sizeField   = fieldName('size');
  const colorField  = fieldName('color');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!labelField || !(labelField in colIndex))
    throw new Error('Drag a dimension onto the "Leaf Label" encoding slot.');
  if (!sizeField || !(sizeField in colIndex))
    throw new Error('Drag a measure onto the "Size" encoding slot.');

  const li = colIndex[labelField];
  const pi = parentField && (parentField in colIndex) ? colIndex[parentField] : null;
  const si = colIndex[sizeField];
  const ci = colorField && (colorField in colIndex) ? colIndex[colorField] : null;

  const leaves = dataTable.data
    .map(row => ({
      label:  String(row[li].value),
      parent: pi !== null ? String(row[pi].value) : '__root__',
      size:   Math.max(0, Number(row[si].value) || 0),
      color:  ci !== null ? row[ci].value : null,
    }))
    .filter(r => r.label && r.size > 0);

  if (!leaves.length) throw new Error('No valid rows found. Check field types on encoding slots.');

  const hasParent = pi !== null;
  const parents = hasParent ? Array.from(new Set(leaves.map(l => l.parent))) : ['__root__'];

  // Determine color encoding type: if color values are all numeric, treat as measure
  const colorIsNumeric = ci !== null && leaves.every(l => l.color !== null && !Number.isNaN(Number(l.color)));

  return { leaves, parents, hasParent, colorIsNumeric };
}

function getTileFn(tiling) {
  const map = {
    squarify: d3.treemapSquarify,
    slice:    d3.treemapSlice,
    dice:     d3.treemapDice,
    sliceDice: d3.treemapSliceDice,
  };
  return map[tiling] || d3.treemapSquarify;
}

function relativeLuminance(r, g, b) {
  // sRGB to linear
  const toLinear = c => (c / 255) <= 0.03928 ? (c / 255) / 12.92 : Math.pow(((c / 255) + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function textColorForBackground(hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const lum = relativeLuminance(r, g, b);
  return lum < 0.35 ? '#ffffff' : '#222222';
}

function drawChart({ leaves, parents, hasParent, colorIsNumeric }) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;

  d3.select(container).selectAll('*').remove();

  const { tiling, colorMode, showParentLabels } = window.TREEMAP_STATE;

  // Build hierarchy data
  const hierarchyData = {
    name: '__root__',
    children: hasParent
      ? parents.map(p => ({
          name: p,
          children: leaves.filter(l => l.parent === p),
        }))
      : leaves.map(l => ({ ...l })),
  };

  const root = d3.hierarchy(hierarchyData)
    .sum(d => d.size || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  d3.treemap()
    .tile(getTileFn(tiling))
    .size([W, H])
    .padding(hasParent ? 20 : 2)
    .paddingInner(2)
    .round(true)(root);

  // Color scales
  const parentNames = hasParent ? parents : ['__root__'];
  const categoryColor = d3.scaleOrdinal()
    .domain(parentNames)
    .range(COLORS);

  // Sequential color for value mode: use the color field if available, else use size
  const allColorVals = colorIsNumeric
    ? leaves.map(l => Number(l.color))
    : leaves.map(l => l.size);
  const colorExtent = d3.extent(allColorVals);
  const seqColor = d3.scaleSequential(d3.interpolateBlues)
    .domain(colorExtent);

  function leafFill(d) {
    if (colorMode === 'value') {
      const val = colorIsNumeric ? Number(d.data.color ?? d.data.size) : d.data.size;
      return seqColor(val);
    }
    // category mode: color by parent
    const parentName = hasParent ? d.parent?.data?.name : d.data.label;
    return categoryColor(parentName || d.data.label);
  }

  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H);

  // Tooltip
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  const fmtNum = d3.format(',~r');

  // Draw leaf nodes
  const leafNodes = root.leaves();

  const cells = svg.selectAll('g.node')
    .data(leafNodes)
    .join('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  cells.append('rect')
    .attr('class', 'node-rect')
    .attr('width', d => Math.max(0, d.x1 - d.x0))
    .attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('fill', d => leafFill(d))
    .on('mouseenter', function (event, d) {
      const path = hasParent
        ? `${d.parent?.data?.name ?? ''} → ${d.data.label}`
        : d.data.label;
      const colorVal = d.data.color !== null && colorIsNumeric ? Number(d.data.color) : null;
      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${event.offsetY - 10}px`)
        .html(`<div class="tt-title">${path}</div>
               Size: <b>${fmtNum(d.data.size)}</b>${colorVal !== null ? `<br>Color value: <b>${fmtNum(colorVal)}</b>` : ''}`);
    })
    .on('mousemove', function (event) {
      tooltip
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${event.offsetY - 10}px`);
    })
    .on('mouseleave', () => tooltip.style('opacity', 0));

  // Leaf labels (only if rect is wide enough)
  cells.each(function (d) {
    const rectW = d.x1 - d.x0;
    const rectH = d.y1 - d.y0;
    if (rectW < 40 || rectH < 16) return;

    const fillColor = leafFill(d);
    // approximate hex from d3 color
    const fillHex = d3.color(fillColor)?.formatHex() ?? '#4e79a7';
    const textFill = textColorForBackground(fillHex);

    const g = d3.select(this);
    const labelY = rectH / 2;

    g.append('text')
      .attr('class', 'node-label')
      .attr('x', 5)
      .attr('y', labelY - (rectH > 32 ? 7 : 0))
      .attr('fill', textFill)
      .attr('font-size', Math.min(12, rectW / 5) + 'px')
      .text(() => {
        const label = d.data.label;
        const maxChars = Math.floor(rectW / 7);
        return label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;
      });

    if (rectH > 32) {
      g.append('text')
        .attr('class', 'node-label')
        .attr('x', 5)
        .attr('y', labelY + 8)
        .attr('fill', textFill)
        .attr('font-size', '10px')
        .text(fmtNum(d.data.size));
    }
  });

  // Parent group borders + labels
  if (hasParent && showParentLabels) {
    const parentNodes = root.children || [];
    svg.selectAll('g.parent-group')
      .data(parentNodes)
      .join('g')
      .attr('class', 'parent-group')
      .each(function (d) {
        const g = d3.select(this);
        // Parent border rect
        g.append('rect')
          .attr('x', d.x0)
          .attr('y', d.y0)
          .attr('width', d.x1 - d.x0)
          .attr('height', d.y1 - d.y0)
          .attr('fill', 'none')
          .attr('stroke', categoryColor(d.data.name))
          .attr('stroke-width', 2)
          .attr('rx', 2)
          .attr('pointer-events', 'none');

        // Parent label in top-left corner
        const pw = d.x1 - d.x0;
        if (pw > 60 && d.y1 - d.y0 > 20) {
          g.append('text')
            .attr('class', 'parent-label')
            .attr('x', d.x0 + 5)
            .attr('y', d.y0 + 14)
            .text(() => {
              const maxChars = Math.floor(pw / 8);
              const name = d.data.name;
              return name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;
            });
        }
      });
  }
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.TREEMAP_STATE.lastData) drawChart(window.TREEMAP_STATE.lastData);
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
