'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

const MARGIN = { top: 24, right: 24, bottom: 48, left: 60 };

// Four quadrant definitions: which corner they occupy and their display properties.
// Axes: X = CLV (right = higher), Y = churn risk (up = higher).
const QUADRANTS = [
  {
    id: 'protect',
    xSide: 'right',   // CLV >= clvThreshold
    ySide: 'bottom',  // churn < churnThreshold
    label: 'Protect & Grow',
    color: '#27ae60',
    anchorX: 'end',
    anchorY: 'bottom',
  },
  {
    id: 'urgent',
    xSide: 'right',   // CLV >= clvThreshold
    ySide: 'top',     // churn >= churnThreshold
    label: 'Urgent Retention',
    color: '#c0392b',
    anchorX: 'end',
    anchorY: 'top',
  },
  {
    id: 'nurture',
    xSide: 'left',    // CLV < clvThreshold
    ySide: 'bottom',  // churn < churnThreshold
    label: 'Nurture',
    color: '#2980b9',
    anchorX: 'start',
    anchorY: 'bottom',
  },
  {
    id: 'deprioritize',
    xSide: 'left',    // CLV < clvThreshold
    ySide: 'top',     // churn >= churnThreshold
    label: 'Deprioritize',
    color: '#999999',
    anchorX: 'start',
    anchorY: 'top',
  },
];

// ── Module-scope state ────────────────────────────────────────────────────────

window.CLV_STATE = {
  clvThreshold:   null,   // null = compute from median of data at parse time
  churnThreshold: 0.5,
  showQuadLabels: true,
  showSegLabels:  false,
  lastData:       null,
  redraw() {
    if (this.lastData) drawChart(this.lastData);
  },
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────

tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => setError(err.message || String(err)));

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchData(worksheet) {
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
  try {
    return await reader.getAllPagesAsync();
  } finally {
    await reader.releaseAsync();
  }
}

// ── Render orchestrator ───────────────────────────────────────────────────────

async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    const parsed = parseTableauData(dataTable, vizSpec);
    window.CLV_STATE.lastData = parsed;

    // Seed clvThreshold from data median on first load (null = auto).
    // Only set if user hasn't typed a custom value.
    if (window.CLV_STATE.clvThreshold === null) {
      const input = document.getElementById('clv-threshold');
      if (input && input.value === '') {
        window.CLV_STATE.clvThreshold = null; // let drawChart compute each time
      }
    }

    drawChart(parsed);
  } catch (err) {
    setError(err.message || String(err));
  }
}

// ── Parse ─────────────────────────────────────────────────────────────────────

function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection?.[0];
  if (!marksSpec) throw new Error('No marks specification found in vizSpec.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const clvField     = fieldName('clv');
  const churnField   = fieldName('churn_risk');
  const segmentField = fieldName('segment');
  const sizeField    = fieldName('size');    // optional
  const labelField   = fieldName('label');   // optional

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!clvField     || !(clvField in colIndex))     throw new Error('Drag a measure onto "Customer Lifetime Value (X axis)" encoding slot.');
  if (!churnField   || !(churnField in colIndex))   throw new Error('Drag a measure onto "Churn Risk 0.0–1.0 (Y axis)" encoding slot.');
  if (!segmentField || !(segmentField in colIndex)) throw new Error('Drag a dimension onto "Segment (color)" encoding slot.');

  const ci  = colIndex[clvField];
  const chi = colIndex[churnField];
  const si  = colIndex[segmentField];
  const szi = sizeField  && (sizeField  in colIndex) ? colIndex[sizeField]  : null;
  const li  = labelField && (labelField in colIndex) ? colIndex[labelField] : null;

  const points = dataTable.data
    .map(row => ({
      clv:      Number(row[ci].value),
      churn:    Number(row[chi].value),
      segment:  String(row[si].value),
      size:     szi !== null ? Number(row[szi].value) : null,
      label:    li  !== null ? String(row[li].value)  : null,
    }))
    .filter(r => !Number.isNaN(r.clv) && !Number.isNaN(r.churn));

  if (!points.length) throw new Error('No valid rows after parsing. Check field types on encoding slots.');

  const segments = Array.from(new Set(points.map(p => p.segment)));
  const hasSizeEncoding = szi !== null;

  return { points, segments, hasSizeEncoding };
}

// ── Draw ─────────────────────────────────────────────────────────────────────

function drawChart({ points, segments, hasSizeEncoding }) {
  const container = document.getElementById('chart');
  const W = container.clientWidth  || window.innerWidth;
  const H = container.clientHeight || (window.innerHeight - 42);
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top  - MARGIN.bottom;

  // Remove previous render
  d3.select(container).selectAll('*').remove();

  const { showQuadLabels, showSegLabels } = window.CLV_STATE;

  // ── Threshold resolution ──────────────────────────────────────────────────
  const clvValues = points.map(p => p.clv);
  const clvThreshold = (window.CLV_STATE.clvThreshold !== null)
    ? window.CLV_STATE.clvThreshold
    : d3.median(clvValues);   // default = median

  const churnThreshold = window.CLV_STATE.churnThreshold;

  // ── Scales ────────────────────────────────────────────────────────────────
  const clvExtent   = d3.extent(clvValues);
  const clvPad      = (clvExtent[1] - clvExtent[0]) * 0.08 || 100;
  const churnExtent = d3.extent(points, p => p.churn);

  const x = d3.scaleLinear()
    .domain([Math.max(0, clvExtent[0] - clvPad), clvExtent[1] + clvPad])
    .range([0, w])
    .nice();

  // Y: 0 at bottom, 1 at top (higher churn = higher on chart = more urgent)
  const churnMin = Math.max(0, churnExtent[0] - 0.05);
  const churnMax = Math.min(1, churnExtent[1] + 0.05);
  const y = d3.scaleLinear()
    .domain([churnMin, churnMax])
    .range([h, 0])
    .nice();

  // Size scale: scaleSqrt for area-proportional bubbles when size encoding present
  let sizeScale;
  if (hasSizeEncoding) {
    const sizeValues = points.map(p => p.size).filter(v => v !== null && !Number.isNaN(v));
    const [sMin, sMax] = d3.extent(sizeValues);
    sizeScale = d3.scaleSqrt()
      .domain([Math.max(0, sMin), sMax])
      .range([6, 30]);
  }

  // Color: Tableau10 palette by segment
  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(segments);

  // ── SVG scaffold ──────────────────────────────────────────────────────────
  const svg = d3.select(container)
    .append('svg')
    .attr('width',  W)
    .attr('height', H);

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // ── Grid ──────────────────────────────────────────────────────────────────
  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-w).tickFormat(''))
    .call(grp => grp.select('.domain').remove());

  g.append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickSize(-h).tickFormat(''))
    .call(grp => grp.select('.domain').remove());

  // ── Axes ──────────────────────────────────────────────────────────────────
  const fmtDollar  = d3.format('$,.0f');
  const fmtPercent = d3.format('.0%');

  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6).tickSizeOuter(0).tickFormat(fmtDollar));

  g.append('g')
    .attr('class', 'axis y-axis')
    .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0).tickFormat(fmtPercent));

  // ── Axis labels ───────────────────────────────────────────────────────────
  g.append('text')
    .attr('x', w / 2)
    .attr('y', h + 42)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px')
    .attr('fill', '#555')
    .text('Customer Lifetime Value');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2)
    .attr('y', -48)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px')
    .attr('fill', '#555')
    .text('Churn Risk');

  // ── Quadrant threshold lines ──────────────────────────────────────────────
  const qxPx = x(clvThreshold);
  const qyPx = y(churnThreshold);

  // Vertical line at clvThreshold
  g.append('line')
    .attr('x1', qxPx).attr('x2', qxPx)
    .attr('y1', 0).attr('y2', h)
    .attr('stroke', '#aaa')
    .attr('stroke-dasharray', '6 3')
    .attr('stroke-width', 1.5);

  // Horizontal line at churnThreshold
  g.append('line')
    .attr('x1', 0).attr('x2', w)
    .attr('y1', qyPx).attr('y2', qyPx)
    .attr('stroke', '#aaa')
    .attr('stroke-dasharray', '6 3')
    .attr('stroke-width', 1.5);

  // ── Quadrant labels ───────────────────────────────────────────────────────
  if (showQuadLabels) {
    const INSET = 12; // px from corner

    QUADRANTS.forEach(q => {
      // Compute pixel position for each quadrant label corner
      const lx = q.anchorX === 'end'
        ? w - INSET   // right side
        : INSET;      // left side

      const ly = q.anchorY === 'top'
        ? INSET + 11  // near top
        : h - INSET;  // near bottom

      g.append('text')
        .attr('x', lx)
        .attr('y', ly)
        .attr('text-anchor', q.anchorX === 'end' ? 'end' : 'start')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', q.color)
        .attr('opacity', 0.85)
        .text(q.label);
    });
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0)
    .style('pointer-events', 'none');

  const fmtDollarTooltip  = d3.format('$,.0f');
  const fmtPercentTooltip = d3.format('.1%');
  const fmtCount          = d3.format(',');

  // ── Bubbles ───────────────────────────────────────────────────────────────
  // Sort largest-first so smaller bubbles render on top and remain clickable
  const sortedPoints = hasSizeEncoding
    ? [...points].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
    : points;

  const bubbleGroup = g.append('g').attr('class', 'bubbles');

  bubbleGroup.selectAll('circle.bubble')
    .data(sortedPoints)
    .join('circle')
    .attr('class', 'bubble')
    .attr('cx', d => x(d.clv))
    .attr('cy', d => y(d.churn))
    .attr('r', d => {
      if (hasSizeEncoding && d.size !== null && !Number.isNaN(d.size)) {
        return sizeScale(d.size);
      }
      return 10; // fixed radius when size encoding absent
    })
    .attr('fill', d => color(d.segment))
    .on('mouseenter', function (event, d) {
      const r = hasSizeEncoding && d.size !== null
        ? sizeScale(d.size)
        : 10;
      const ttLines = [
        `<div class="tt-title">${d.label ?? d.segment}</div>`,
        `Segment: <b>${d.segment}</b>`,
        `CLV: <b>${fmtDollarTooltip(d.clv)}</b>`,
        `Churn Risk: <b>${fmtPercentTooltip(d.churn)}</b>`,
      ];
      if (hasSizeEncoding && d.size !== null) {
        ttLines.push(`Customers: <b>${fmtCount(d.size)}</b>`);
      }
      // Determine which quadrant this point is in
      const qLabel = getQuadrantLabel(d.clv, d.churn, clvThreshold, churnThreshold);
      ttLines.push(`Quadrant: <b>${qLabel}</b>`);

      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${Math.max(0, event.offsetY - 10)}px`)
        .html(ttLines.join('<br>'));
    })
    .on('mousemove', function (event) {
      tooltip
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${Math.max(0, event.offsetY - 10)}px`);
    })
    .on('mouseleave', () => tooltip.style('opacity', 0));

  // ── Segment labels on bubbles ─────────────────────────────────────────────
  if (showSegLabels) {
    bubbleGroup.selectAll('text.seg-label')
      .data(sortedPoints)
      .join('text')
      .attr('class', 'seg-label')
      .attr('x', d => x(d.clv))
      .attr('y', d => y(d.churn))
      .attr('font-size', '9px')
      .attr('font-weight', '600')
      .attr('fill', '#fff')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('pointer-events', 'none')
      .each(function (d) {
        const r = hasSizeEncoding && d.size !== null ? sizeScale(d.size) : 10;
        const txt = d.label ?? d.segment;
        // Only render label if bubble is large enough to fit text legibly
        d3.select(this).text(r >= 14 ? txt : '');
      });
  }

  // ── Legend ────────────────────────────────────────────────────────────────
  // Place legend below chart area so it doesn't fight with right margin
  // (No right-side space since MARGIN.right is small at 24px)
  // Instead use a compact horizontal legend above the bottom axis label
  const legendY = h + MARGIN.top + 6;
  const legendG = svg.append('g')
    .attr('transform', `translate(${MARGIN.left}, ${legendY})`);

  // Compute each segment's x offset for inline horizontal legend
  let legendX = 0;
  segments.forEach(seg => {
    const entry = legendG.append('g').attr('transform', `translate(${legendX}, 0)`);
    entry.append('circle')
      .attr('cx', 5).attr('cy', 5).attr('r', 5)
      .attr('fill', color(seg));
    const label = entry.append('text')
      .attr('x', 14).attr('y', 9)
      .attr('font-size', '10px')
      .attr('fill', '#444')
      .text(seg);
    // Measure text width to advance x offset (approximate at 6.5px per char + 24px padding)
    legendX += seg.length * 6.5 + 30;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getQuadrantLabel(clv, churn, clvThreshold, churnThreshold) {
  const highCLV   = clv   >= clvThreshold;
  const highChurn = churn >= churnThreshold;
  if  (highCLV && !highChurn) return 'Protect & Grow';
  if  (highCLV &&  highChurn) return 'Urgent Retention';
  if (!highCLV && !highChurn) return 'Nurture';
  return 'Deprioritize';
}

function setError(msg) {
  const el = document.getElementById('error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearError() {
  const el = document.getElementById('error');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

// Debounced resize handler
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (window.CLV_STATE.lastData) drawChart(window.CLV_STATE.lastData);
  }, 150);
});
