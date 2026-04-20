'use strict';

// ─── Module state ─────────────────────────────────────────────────────────────
const state = {
  orientation: 'vertical',   // 'vertical' | 'horizontal'
  pctMode:     'first',      // 'first' | 'previous'
  labelPos:    'inside',     // 'inside' | 'outside'
};
let currentWs = null;

// ─── Toolbar handlers ────────────────────────────────────────────────────────
function setOrient(btn) {
  document.querySelectorAll('[data-orient]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.orientation = btn.dataset.orient;
  if (currentWs) render(currentWs);
}

function setPct(btn) {
  document.querySelectorAll('[data-pct]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.pctMode = btn.dataset.pct;
  if (currentWs) render(currentWs);
}

function setLabels(btn) {
  document.querySelectorAll('[data-labels]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.labelPos = btn.dataset.labels;
  if (currentWs) render(currentWs);
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
tableau.extensions.initializeAsync().then(() => {
  currentWs = tableau.extensions.worksheetContent.worksheet;
  currentWs.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(currentWs));
  render(currentWs);
}).catch(err => setError(err.message || String(err)));

// ─── Resize handling ──────────────────────────────────────────────────────────
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (currentWs) render(currentWs); }, 150);
});

// ─── Data fetch ───────────────────────────────────────────────────────────────
async function fetchData(worksheet) {
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
  try { return await reader.getAllPagesAsync(); }
  finally { await reader.releaseAsync(); }
}

// ─── Render pipeline ──────────────────────────────────────────────────────────
async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    drawChart(parseData(dataTable, vizSpec));
  } catch (err) {
    setError(err.message || String(err));
  }
}

// ─── Data parsing ─────────────────────────────────────────────────────────────
// IMPORTANT: Stage order is determined by DATA ROW ORDER in dataTable.data,
// not by alphabetical sort. Build an ordered Set as we iterate rows.
function parseData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;
  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const stageField = fieldName('stage');
  const valueField = fieldName('value');
  const colorField = fieldName('color');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!stageField || !(stageField in colIndex)) throw new Error('Drag a dimension onto the "Stage" encoding slot.');
  if (!valueField || !(valueField in colIndex)) throw new Error('Drag a measure onto the "Volume" encoding slot.');

  const si = colIndex[stageField];
  const vi = colIndex[valueField];
  const ci = (colorField && colorField in colIndex) ? colIndex[colorField] : null;

  // Preserve data row order using ordered Set
  const stagesSeen = new Set();
  const stageOrder = [];
  const stageValues = {};  // stage → total value (or Map<color, value> if grouped)

  dataTable.data.forEach(row => {
    const stage = String(row[si].value);
    const value = Number(row[vi].value);
    const color = ci !== null ? String(row[ci].value) : null;

    if (!stagesSeen.has(stage)) {
      stagesSeen.add(stage);
      stageOrder.push(stage);
      stageValues[stage] = 0;
    }
    if (!Number.isNaN(value)) stageValues[stage] += value;
  });

  if (!stageOrder.length) throw new Error('No valid rows. Check encoding slots.');

  const stages = stageOrder.map((name, i) => {
    const value = stageValues[name];
    const first = stageValues[stageOrder[0]];
    const prev  = i > 0 ? stageValues[stageOrder[i - 1]] : null;
    return {
      name,
      value,
      pctOfFirst:    first > 0 ? value / first : 0,
      pctOfPrevious: prev !== null && prev > 0 ? value / prev : null,
    };
  });

  // Collect segment colors (preserving order)
  const segmentsSeen = new Set();
  const segments = [];
  if (ci !== null) {
    dataTable.data.forEach(row => {
      const seg = String(row[ci].value);
      if (!segmentsSeen.has(seg)) { segmentsSeen.add(seg); segments.push(seg); }
    });
  }

  return { stages, segments, hasColor: ci !== null };
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawChart({ stages, segments, hasColor }) {
  const container = document.getElementById('chart');
  d3.select(container).selectAll('*').remove();

  if (!stages.length) { container.textContent = 'No data.'; return; }

  const W = container.clientWidth;
  const H = container.clientHeight;
  const isVertical = state.orientation === 'vertical';

  const PADDING  = 16;
  const LABEL_H  = 20;  // space for outside label
  const COLOR_PALETTE = d3.schemeTableau10;

  const colorScale = d3.scaleOrdinal()
    .domain(hasColor ? segments : stages.map(s => s.name))
    .range(COLOR_PALETTE);

  const fmtNum  = d3.format(',');
  const fmtPct  = d3.format('.1%');

  const tooltip = d3.select(document.body)
    .selectAll('.tooltip')
    .data([null])
    .join('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H);

  const n = stages.length;

  if (isVertical) {
    // ── Vertical funnel ──────────────────────────────────────────────────────
    const maxW    = W - PADDING * 2;
    const stageH  = (H - PADDING * 2 - LABEL_H * n) / n;
    const gapBetween = 4;

    stages.forEach((stage, i) => {
      const topW    = maxW * stage.pctOfFirst;
      const nextPct = i < n - 1 ? stages[i + 1].pctOfFirst : stage.pctOfFirst;
      const botW    = maxW * nextPct;
      const topX    = (W - topW) / 2;
      const botX    = (W - botW) / 2;
      const y       = PADDING + i * (stageH + LABEL_H + gapBetween);
      const midY    = y + stageH / 2;

      // Trapezoid polygon: top-left, top-right, bottom-right, bottom-left
      const points = [
        [topX,        y],
        [topX + topW, y],
        [botX + botW, y + stageH],
        [botX,        y + stageH],
      ].map(p => p.join(',')).join(' ');

      const fillColor = colorScale(stage.name);

      svg.append('polygon')
        .attr('points', points)
        .attr('fill', fillColor)
        .attr('opacity', 0.85)
        .on('mousemove', function(event) {
          let pctStr = '';
          if (state.pctMode === 'first') {
            pctStr = `% of first: <b>${fmtPct(stage.pctOfFirst)}</b>`;
          } else {
            pctStr = stage.pctOfPrevious !== null
              ? `% of previous: <b>${fmtPct(stage.pctOfPrevious)}</b>`
              : 'First stage';
          }
          tooltip
            .style('opacity', 1)
            .style('left', `${event.clientX + 14}px`)
            .style('top',  `${event.clientY - 10}px`)
            .html(`<strong>${stage.name}</strong><br>Volume: <b>${fmtNum(stage.value)}</b><br>${pctStr}`);
        })
        .on('mouseleave', () => tooltip.style('opacity', 0));

      // Labels
      const labelText  = `${stage.name}: ${fmtNum(stage.value)}`;
      const convText   = i > 0
        ? (state.pctMode === 'previous'
            ? (stage.pctOfPrevious !== null ? fmtPct(stage.pctOfPrevious) : '')
            : fmtPct(stage.pctOfFirst))
        : '';

      if (state.labelPos === 'inside') {
        svg.append('text')
          .attr('x', W / 2)
          .attr('y', midY + 5)
          .attr('text-anchor', 'middle')
          .attr('font-size', '12px')
          .attr('font-weight', '600')
          .attr('fill', '#fff')
          .attr('pointer-events', 'none')
          .text(labelText);
        if (convText) {
          svg.append('text')
            .attr('x', W / 2)
            .attr('y', midY + 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('fill', 'rgba(255,255,255,0.85)')
            .attr('pointer-events', 'none')
            .text(convText);
        }
      } else {
        // Outside labels: to the right
        svg.append('text')
          .attr('x', W / 2 + topW / 2 + 8)
          .attr('y', midY)
          .attr('text-anchor', 'start')
          .attr('font-size', '12px')
          .attr('fill', '#333')
          .attr('pointer-events', 'none')
          .text(labelText);
        if (convText) {
          svg.append('text')
            .attr('x', W / 2 + topW / 2 + 8)
            .attr('y', midY + 15)
            .attr('text-anchor', 'start')
            .attr('font-size', '11px')
            .attr('fill', '#777')
            .attr('pointer-events', 'none')
            .text(convText);
        }
      }
    });

  } else {
    // ── Horizontal funnel ────────────────────────────────────────────────────
    const maxH    = H - PADDING * 2;
    const stageW  = (W - PADDING * 2) / n;
    const gapBetween = 4;

    stages.forEach((stage, i) => {
      const topH    = maxH * stage.pctOfFirst;
      const nextPct = i < n - 1 ? stages[i + 1].pctOfFirst : stage.pctOfFirst;
      const botH    = maxH * nextPct;
      const x       = PADDING + i * stageW;
      const topY    = (H - topH) / 2;
      const botY    = (H - botH) / 2;
      const midX    = x + stageW / 2;

      // Horizontal trapezoid: left-top, right-top, right-bottom, left-bottom
      const rightX = x + stageW - gapBetween;
      const points = [
        [x,       topY],
        [rightX,  botY],
        [rightX,  botY + botH],
        [x,       topY + topH],
      ].map(p => p.join(',')).join(' ');

      const fillColor = colorScale(stage.name);

      svg.append('polygon')
        .attr('points', points)
        .attr('fill', fillColor)
        .attr('opacity', 0.85)
        .on('mousemove', function(event) {
          let pctStr = '';
          if (state.pctMode === 'first') {
            pctStr = `% of first: <b>${fmtPct(stage.pctOfFirst)}</b>`;
          } else {
            pctStr = stage.pctOfPrevious !== null
              ? `% of previous: <b>${fmtPct(stage.pctOfPrevious)}</b>`
              : 'First stage';
          }
          tooltip
            .style('opacity', 1)
            .style('left', `${event.clientX + 14}px`)
            .style('top',  `${event.clientY - 10}px`)
            .html(`<strong>${stage.name}</strong><br>Volume: <b>${fmtNum(stage.value)}</b><br>${pctStr}`);
        })
        .on('mouseleave', () => tooltip.style('opacity', 0));

      const labelText = stage.name;
      const valText   = fmtNum(stage.value);
      const convText  = i > 0
        ? (state.pctMode === 'previous'
            ? (stage.pctOfPrevious !== null ? fmtPct(stage.pctOfPrevious) : '')
            : fmtPct(stage.pctOfFirst))
        : '';

      if (state.labelPos === 'inside') {
        svg.append('text')
          .attr('x', midX)
          .attr('y', H / 2 - 8)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', '#fff')
          .attr('pointer-events', 'none')
          .text(labelText);
        svg.append('text')
          .attr('x', midX)
          .attr('y', H / 2 + 8)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('fill', 'rgba(255,255,255,0.9)')
          .attr('pointer-events', 'none')
          .text(valText);
        if (convText) {
          svg.append('text')
            .attr('x', midX)
            .attr('y', H / 2 + 22)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', 'rgba(255,255,255,0.75)')
            .attr('pointer-events', 'none')
            .text(convText);
        }
      } else {
        svg.append('text')
          .attr('x', midX)
          .attr('y', topY - 6)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('fill', '#333')
          .attr('pointer-events', 'none')
          .text(`${labelText}: ${valText}`);
        if (convText) {
          svg.append('text')
            .attr('x', midX)
            .attr('y', topY - 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#777')
            .attr('pointer-events', 'none')
            .text(convText);
        }
      }
    });
  }
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
