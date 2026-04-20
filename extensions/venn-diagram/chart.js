'use strict';

const PALETTE = d3.schemeTableau10;

let cachedGroups = null;
const colorState = new Map();

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (cachedGroups) drawAll(cachedGroups);
  }, 150);
});

tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => {
  setError(err.message || String(err));
});

async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    cachedGroups = parseTableauData(dataTable, vizSpec);
    drawAll(cachedGroups);
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
  const groupField = fieldName('group');

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
  const gi = (groupField && groupField in colIndex) ? colIndex[groupField] : null;

  const groups = new Map();

  for (const row of dataTable.data) {
    const rawSets = String(row[si].value).trim();
    const setNames = rawSets.split(',').map(s => s.trim()).filter(Boolean);
    const size = Number(row[vi].value);
    if (!setNames.length || Number.isNaN(size)) continue;

    const label = li !== null
      ? String(row[li].value).trim()
      : setNames.join(' ∩ ');

    const groupName = gi !== null ? String(row[gi].value).trim() : '__all__';

    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push({ sets: setNames, size, label });
  }

  if (!groups.size) {
    throw new Error('No valid rows found. Check field types on the encoding slots.');
  }

  return groups;
}

function drawAll(groups) {
  const allSetNames = [];
  const seen = new Set();
  for (const rows of groups.values()) {
    for (const row of rows) {
      for (const name of row.sets) {
        if (!seen.has(name)) {
          seen.add(name);
          allSetNames.push(name);
        }
      }
    }
  }

  let paletteIdx = 0;
  for (const name of allSetNames) {
    if (!colorState.has(name)) {
      colorState.set(name, PALETTE[paletteIdx % PALETTE.length]);
      paletteIdx++;
    }
  }
  for (const name of colorState.keys()) {
    if (!seen.has(name)) colorState.delete(name);
  }

  const toolbar = document.getElementById('toolbar');
  toolbar.innerHTML = '';

  for (const name of allSetNames) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'color';
    input.value = colorState.get(name);
    input.dataset.setName = name;

    input.addEventListener('input', (e) => {
      colorState.set(e.target.dataset.setName, e.target.value);
      if (cachedGroups) drawAll(cachedGroups);
    });

    label.appendChild(input);
    label.appendChild(document.createTextNode(name));
    toolbar.appendChild(label);
  }

  const colorMap = new Map(colorState);

  const panelsEl = document.getElementById('panels');
  panelsEl.innerHTML = '';

  for (const [groupName, vennData] of groups) {
    const panel = document.createElement('div');
    panel.className = 'venn-panel';

    const titleEl = document.createElement('div');
    titleEl.className = 'panel-title';
    if (groupName !== '__all__') {
      titleEl.textContent = groupName;
    }

    const chartEl = document.createElement('div');
    chartEl.className = 'panel-chart';

    panel.appendChild(titleEl);
    panel.appendChild(chartEl);
    panelsEl.appendChild(panel);

    renderPanel(groupName, vennData, chartEl, colorMap);
  }
}

function renderPanel(groupName, vennData, container, colorMap) {
  const W = container.clientWidth  || 400;
  const H = container.clientHeight || 300;

  d3.select(container).selectAll('svg').remove();

  if (!vennData.length) return;

  const vennChart = venn.VennDiagram()
    .width(W)
    .height(H);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H);

  const vennGroup = svg.append('g');
  vennGroup.datum(vennData).call(vennChart);

  vennGroup.selectAll('g.venn-circle')
    .each(function (d) {
      const color = colorMap.get(d.sets[0]) || '#888888';
      d3.select(this).select('path')
        .style('fill', color)
        .style('stroke', color);
    });

  vennGroup.selectAll('g.venn-intersection')
    .each(function (d) {
      const colors = d.sets.map(name => d3.color(colorMap.get(name) || '#888888'));
      const blended = blendColors(colors);
      d3.select(this).select('path')
        .style('fill', blended)
        .style('stroke', 'none');
    });

  vennGroup.selectAll('g.venn-circle, g.venn-intersection')
    .each(function (d) {
      const g = d3.select(this);
      g.select('text').remove();

      const pathNode = g.select('path').node();
      if (!pathNode) return;
      const bbox = pathNode.getBBox();
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;

      const displayName = d.label || d.sets.join(' ∩ ');
      const count = d3.format(',')(d.size);

      const text = g.append('text')
        .attr('x', cx)
        .attr('y', cy - 8)
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
        .attr('dy', '1.5em')
        .text(count);
    });

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
      tooltip
        .style('left', `${event.clientX + 14}px`)
        .style('top',  `${event.clientY - 10}px`);
    })
    .on('mouseout', function () {
      d3.select(this).classed('hover', false);
      tooltip.style('display', 'none');
    });
}

function blendColors(colors) {
  const valid = colors.filter(Boolean);
  if (!valid.length) return '#cccccc';
  const sum = valid.reduce(
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
  return d3.rgb(
    Math.round(sum.r / n),
    Math.round(sum.g / n),
    Math.round(sum.b / n)
  ).toString();
}

function setError(msg) {
  const el = document.getElementById('error');
  if (el) el.textContent = msg;
}

function clearError() {
  const el = document.getElementById('error');
  if (el) el.textContent = '';
}
