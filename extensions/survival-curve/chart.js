'use strict';

const MARGIN = { top: 30, right: 160, bottom: 55, left: 65 };
const COLORS = d3.schemeTableau10;

window.SURV_STATE = {
  showCI: true,
  curveStyle: 'smooth',    // 'smooth' | 'step'
  showMedian: true,
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
    window.SURV_STATE.lastData = parsed;
    drawChart(parsed);
  } catch (err) {
    setError(err.message || String(err));
  }
}

function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');
  const encodings = marksSpec.encodingCollection;

  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const periodField   = fieldName('period');
  const survivalField = fieldName('survival');
  const segmentField  = fieldName('segment');
  const ciLowerField  = fieldName('ci_lower');
  const ciUpperField  = fieldName('ci_upper');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!periodField   || !(periodField in colIndex))   throw new Error('Drag a measure onto "Period" encoding slot.');
  if (!survivalField || !(survivalField in colIndex)) throw new Error('Drag a measure onto "Survival Probability" encoding slot.');

  const pi   = colIndex[periodField];
  const si   = colIndex[survivalField];
  const segi = segmentField  && (segmentField  in colIndex) ? colIndex[segmentField]  : null;
  const cli  = ciLowerField  && (ciLowerField  in colIndex) ? colIndex[ciLowerField]  : null;
  const cui  = ciUpperField  && (ciUpperField  in colIndex) ? colIndex[ciUpperField]  : null;

  const rows = dataTable.data
    .map(row => ({
      period:   Number(row[pi].value),
      survival: Number(row[si].value),
      segment:  segi !== null ? String(row[segi].value) : '__all__',
      ciLower:  cli !== null ? Number(row[cli].value) : null,
      ciUpper:  cui !== null ? Number(row[cui].value) : null,
    }))
    .filter(r => !Number.isNaN(r.period) && !Number.isNaN(r.survival));

  if (!rows.length) throw new Error('No valid rows. Check field types on encoding slots.');

  // Group by segment
  const grouped = d3.group(rows, d => d.segment);
  const series = Array.from(grouped, ([name, values]) => {
    const sorted = values.slice().sort((a, b) => a.period - b.period);
    // CI band is valid for this series only if ALL rows have both ci_lower and ci_upper
    const hasCI = cli !== null && cui !== null
      && sorted.every(r => r.ciLower !== null && !Number.isNaN(r.ciLower)
                        && r.ciUpper !== null && !Number.isNaN(r.ciUpper));
    return { name, values: sorted, hasCI };
  });

  const segments = series.map(s => s.name);
  return { series, segments };
}

function findMedianPeriod(values) {
  // Find x where survival crosses 0.5 using linear interpolation
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const curr = values[i];
    if (prev.survival >= 0.5 && curr.survival <= 0.5) {
      if (prev.survival === curr.survival) return prev.period;
      // Linear interpolation: x = x0 + (0.5 - y0) * (x1 - x0) / (y1 - y0)
      const t = (0.5 - prev.survival) / (curr.survival - prev.survival);
      return prev.period + t * (curr.period - prev.period);
    }
    if (curr.survival === 0.5) return curr.period;
  }
  return null; // never crosses 0.5
}

function drawChart({ series, segments }) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top - MARGIN.bottom;

  d3.select(container).selectAll('*').remove();

  const { showCI, curveStyle, showMedian } = window.SURV_STATE;

  const allPeriods  = series.flatMap(s => s.values.map(d => d.period));
  const periodMax   = d3.max(allPeriods) ?? 24;

  const x = d3.scaleLinear()
    .domain([0, periodMax])
    .range([0, w])
    .nice();

  // Y axis: always 0–100%
  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([h, 0]);

  const color = d3.scaleOrdinal()
    .domain(segments)
    .range(COLORS);

  const curveFn = curveStyle === 'step' ? d3.curveStepAfter : d3.curveMonotoneX;

  const lineGen = d3.line()
    .x(d => x(d.period))
    .y(d => y(d.survival))
    .curve(curveFn);

  const areaGen = d3.area()
    .x(d => x(d.period))
    .y0(d => y(d.ciLower))
    .y1(d => y(d.ciUpper))
    .curve(curveFn);

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

  // 50% reference line
  g.append('line')
    .attr('class', 'fifty-line')
    .attr('x1', 0).attr('x2', w)
    .attr('y1', y(0.5)).attr('y2', y(0.5));

  // Axes
  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(w / 60))).tickSizeOuter(0));

  g.append('g')
    .attr('class', 'axis y-axis')
    .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0).tickFormat(d3.format('.0%')));

  // Axis labels
  g.append('text')
    .attr('x', w / 2).attr('y', h + 42)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px').attr('fill', '#555')
    .text('Months Since Acquisition');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -50)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px').attr('fill', '#555')
    .text('Survival Probability');

  // CI bands (rendered before lines so lines appear on top)
  if (showCI) {
    series.forEach(s => {
      if (!s.hasCI) return; // skip this series if CI data is absent/incomplete
      g.append('path')
        .datum(s.values)
        .attr('class', 'ci-band')
        .attr('fill', color(s.name))
        .attr('opacity', 0.15)
        .attr('d', areaGen);
    });
  }

  // Series lines
  series.forEach(s => {
    g.append('path')
      .datum(s.values)
      .attr('class', 'series-line')
      .attr('stroke', color(s.name))
      .attr('d', lineGen);
  });

  // Median survival markers (vertical dashed lines at 50% crossing)
  if (showMedian) {
    series.forEach(s => {
      const medianPeriod = findMedianPeriod(s.values);
      if (medianPeriod === null) return;
      const mx = x(medianPeriod);
      g.append('line')
        .attr('class', 'median-line')
        .attr('stroke', color(s.name))
        .attr('x1', mx).attr('x2', mx)
        .attr('y1', y(0.5))
        .attr('y2', h);
      g.append('text')
        .attr('class', 'median-label')
        .attr('x', mx + 3)
        .attr('y', h - 4)
        .attr('fill', color(s.name))
        .attr('font-size', '10px')
        .text(`${s.name}: mo ${medianPeriod.toFixed(1)}`);
    });
  }

  // Tooltip — hover overlay
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  const fmtPct = d3.format('.1%');
  const bisect = d3.bisector(d => d.period).left;

  const dots = series.map(s =>
    g.append('circle')
      .attr('class', 'dot')
      .attr('fill', color(s.name))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('display', 'none')
  );

  g.append('rect')
    .attr('width', w)
    .attr('height', h)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .on('mousemove', function (event) {
      const [mx] = d3.pointer(event);
      const hoverPeriod = x.invert(mx);

      const lines = series.map((s, i) => {
        const idx = bisect(s.values, hoverPeriod, 1);
        const a = s.values[idx - 1];
        const b = s.values[idx];
        const pt = b && Math.abs(hoverPeriod - b.period) < Math.abs(hoverPeriod - a.period) ? b : a;
        if (pt) {
          dots[i]
            .style('display', null)
            .attr('cx', x(pt.period))
            .attr('cy', y(pt.survival));
          return `<span style="color:${color(s.name)}">&#9679;</span>&nbsp;${s.name}: <b>${fmtPct(pt.survival)}</b>${pt.ciLower !== null && pt.ciUpper !== null ? ` <span style="color:#aaa">[${fmtPct(pt.ciLower)}–${fmtPct(pt.ciUpper)}]</span>` : ''}`;
        }
        return null;
      }).filter(Boolean);

      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${event.offsetY - 10}px`)
        .html(`<div class="tt-title">Month ${Math.round(hoverPeriod)}</div>${lines.join('<br>')}`);
    })
    .on('mouseleave', () => {
      tooltip.style('opacity', 0);
      dots.forEach(dot => dot.style('display', 'none'));
    });

  // Legend
  const legend = g.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${w + 18}, 0)`);

  series.forEach((s, i) => {
    const row = legend.append('g').attr('transform', `translate(0,${i * 22})`);
    row.append('line')
      .attr('x1', 0).attr('x2', 18).attr('y1', 7).attr('y2', 7)
      .attr('stroke', color(s.name))
      .attr('stroke-width', 2.5);
    row.append('text')
      .attr('x', 24).attr('y', 11)
      .text(s.name === '__all__' ? 'All' : s.name);
  });
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.SURV_STATE.lastData) drawChart(window.SURV_STATE.lastData);
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
