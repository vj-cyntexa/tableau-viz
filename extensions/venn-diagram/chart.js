'use strict';

const COLORS = d3.schemeTableau10;

// ── Bootstrap ─────────────────────────────────────────────────────────────────

tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => {
  setError(err.message || String(err));
});

// ── Main render pipeline ───────────────────────────────────────────────────────

async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    const vennData = parseTableauData(dataTable, vizSpec);
    drawChart(vennData);
  } catch (err) {
    setError(err.message || String(err));
  }
}

// ── Data fetching ──────────────────────────────────────────────────────────────

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

// ── Data parsing ───────────────────────────────────────────────────────────────

function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(encodingId) {
    const enc = encodings.find(e => e.id === encodingId);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const setsField  = fieldName('sets');
  const valueField = fieldName('value');
  const labelField = fieldName('label');

  const colIndex = Object.fromEntries(
    dataTable.columns.map(c => [c.fieldName, c.index])
  );

  if (!setsField || !(setsField in colIndex)) {
    throw new Error('Drag a dimension containing set names onto the "Sets" encoding slot.');
  }
  if (!valueField || !(valueField in colIndex)) {
    throw new Error('Drag a numeric measure onto the "Value (Count / Size)" encoding slot.');
  }

  const si = colIndex[setsField];
  const vi = colIndex[valueField];
  const li = (labelField && labelField in colIndex) ? colIndex[labelField] : null;

  const result = dataTable.data
    .map(row => {
      const rawSets = String(row[si].value).trim();
      const setNames = rawSets.split(',').map(s => s.trim()).filter(Boolean);
      const size = Number(row[vi].value);
      // label: use the label field if available, otherwise join set names
      const label = li !== null
        ? String(row[li].value).trim()
        : setNames.join(' ∩ ');
      return { sets: setNames, size, label };
    })
    .filter(d => d.sets.length > 0 && !Number.isNaN(d.size));

  if (!result.length) {
    throw new Error('No valid rows found. Check field types on the encoding slots.');
  }

  return result;
}

// ── Chart rendering ────────────────────────────────────────────────────────────

function drawChart(vennData) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;

  // Clear previous render
  d3.select(container).selectAll('svg').remove();

  if (!vennData.length) {
    container.textContent = 'No data.';
    return;
  }

  // Collect unique singleton set names for color assignment
  const singletonNames = vennData
    .filter(d => d.sets.length === 1)
    .map(d => d.sets[0]);

  const colorScale = d3.scaleOrdinal()
    .domain(singletonNames)
    .range(COLORS);

  // Build the venn.js diagram
  const chart = venn.VennDiagram()
    .width(W)
    .height(H);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H);

  // venn.js needs a <g> or a selection to render into
  const vennGroup = svg.append('g');

  vennGroup.datum(vennData).call(chart);

  // ── Apply colors to circle paths ──────────────────────────────────────────

  vennGroup.selectAll('g.venn-circle')
    .each(function (d) {
      const setName = d.sets[0]; // singletons only
      const color = colorScale(setName);
      d3.select(this).select('path')
        .style('fill', color)
        .style('stroke', color);
    });

  // Intersection fills: blend the colors of the intersecting sets
  vennGroup.selectAll('g.venn-intersection')
    .each(function (d) {
      // Average the RGB components of each constituent set's color
      const colors = d.sets.map(name => d3.color(colorScale(name)));
      const blended = blendColors(colors);
      d3.select(this).select('path')
        .style('fill', blended)
        .style('stroke', 'none');
    });

  // ── Replace built-in labels with name + count labels ─────────────────────

  // venn.js renders a <text> inside each group. Remove it and add two tspans.
  vennGroup.selectAll('g.venn-circle, g.venn-intersection')
    .each(function (d) {
      const g = d3.select(this);
      // Remove the default venn.js text
      g.select('text').remove();

      // Find the centroid of the region from the existing path's bounding box
      // venn.js positions the text; we reposition after calling .call(chart)
      // by querying the SVG layout. Re-add our own text.
      const pathNode = g.select('path').node();
      if (!pathNode) return;
      const bbox = pathNode.getBBox();
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;

      const displayName = d.label || d.sets.join(' ∩ ');
      const count = d3.format(',')(d.size);

      const text = g.append('text')
        .attr('x', cx)
        .attr('y', cy - 6)
        .attr('text-anchor', 'middle')
        .style('pointer-events', 'none');

      text.append('tspan')
        .attr('class', 'venn-label-name')
        .attr('x', cx)
        .attr('dy', '0')
        .text(displayName);

      text.append('tspan')
        .attr('class', 'venn-label-count')
        .attr('x', cx)
        .attr('dy', '1.4em')
        .text(count);
    });

  // ── Tooltip ───────────────────────────────────────────────────────────────

  const tooltip = d3.select('#tooltip');
  const fmtNum = d3.format(',');

  vennGroup.selectAll('g.venn-circle, g.venn-intersection')
    .on('mouseover', function (event, d) {
      d3.select(this).classed('hover', true);
      const displayName = d.label || d.sets.join(' ∩ ');
      tooltip
        .style('display', 'block')
        .html(
          `<div class="tt-title">${displayName}</div>` +
          `Customers: <b>${fmtNum(d.size)}</b>`
        );
    })
    .on('mousemove', function (event) {
      const [mx, my] = d3.pointer(event, container);
      tooltip
        .style('left', `${mx + 14}px`)
        .style('top',  `${my - 10}px`);
    })
    .on('mouseout', function () {
      d3.select(this).classed('hover', false);
      tooltip.style('display', 'none');
    });

  // ── Resize handler ────────────────────────────────────────────────────────
  // Debounced to avoid excessive redraws
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawChart(vennData), 150);
  });
}

// ── Color blending helper ──────────────────────────────────────────────────────

/**
 * Blends an array of d3.color objects by averaging their RGB components.
 * Returns a CSS color string.
 */
function blendColors(colors) {
  const valid = colors.filter(Boolean);
  if (!valid.length) return '#cccccc';
  const rgb = valid.reduce(
    (acc, c) => {
      const r = d3.rgb(c);
      acc.r += r.r;
      acc.g += r.g;
      acc.b += r.b;
      return acc;
    },
    { r: 0, g: 0, b: 0 }
  );
  const n = valid.length;
  return d3.rgb(Math.round(rgb.r / n), Math.round(rgb.g / n), Math.round(rgb.b / n)).toString();
}

// ── Error helpers ──────────────────────────────────────────────────────────────

function setError(msg) {
  const el = document.getElementById('error');
  if (el) el.textContent = msg;
}

function clearError() {
  const el = document.getElementById('error');
  if (el) el.textContent = '';
}
