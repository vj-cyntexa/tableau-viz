'use strict';

// ─── Layout constants ─────────────────────────────────────────────────────────
const MARGIN = { top: 30, right: 170, bottom: 60, left: 75 };
const COLORS = d3.schemeTableau10;

// ─── Toolbar state ────────────────────────────────────────────────────────────
// Bin count precedence: slider (interactive) > bin_count encoding first-row value > Sturges auto
let sliderBins   = null;  // set when user moves slider; null = "use encoding or auto"
let yMode        = 'count';   // 'count' | 'density' | 'percent'
let showKde      = false;
let logX         = false;

// ─── Bootstrap ───────────────────────────────────────────────────────────────
tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;

  // Bin slider
  const slider    = document.getElementById('bin-slider');
  const sliderLbl = document.getElementById('bin-value-label');
  slider.addEventListener('input', () => {
    sliderBins = parseInt(slider.value, 10);
    sliderLbl.textContent = sliderBins;
    render(ws);
  });

  // Y-mode buttons
  document.querySelectorAll('.mode-btn[data-ymode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn[data-ymode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      yMode = btn.dataset.ymode;
      render(ws);
    });
  });

  // KDE checkbox
  document.getElementById('kde-toggle').addEventListener('change', e => {
    showKde = e.target.checked;
    render(ws);
  });

  // Log X checkbox
  document.getElementById('log-toggle').addEventListener('change', e => {
    logX = e.target.checked;
    render(ws);
  });

  // Live data listener
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));

  render(ws);
}).catch(err => setError(err.message || String(err)));

// ─── Render pipeline ─────────────────────────────────────────────────────────
async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    drawChart(parseTableauData(dataTable, vizSpec));
  } catch (err) {
    setError(err.message || String(err));
  }
}

async function fetchData(worksheet) {
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
  try {
    return await reader.getAllPagesAsync();
  } finally {
    await reader.releaseAsync();
  }
}

// ─── Data parsing ─────────────────────────────────────────────────────────────
// Returns { segments: Map<string, number[]>, allValues: number[], encodingBinCount: number|null }
function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const valueField    = fieldName('value');
  const segmentField  = fieldName('segment');
  const binCountField = fieldName('bin_count');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!valueField || !(valueField in colIndex)) {
    throw new Error('Drag a continuous measure onto the "Value (distribution measure)" encoding slot.');
  }

  const vi = colIndex[valueField];
  const si = (segmentField && segmentField in colIndex) ? colIndex[segmentField] : null;
  const bi = (binCountField && binCountField in colIndex) ? colIndex[binCountField] : null;

  // Read encoding bin_count from first data row (it's a measure, single value)
  let encodingBinCount = null;
  if (bi !== null && dataTable.data.length > 0) {
    const v = Number(dataTable.data[0][bi].value);
    if (!isNaN(v) && v >= 2) encodingBinCount = Math.round(v);
  }

  // Build segments map
  const segments = new Map();
  const allValues = [];

  for (const row of dataTable.data) {
    const val = Number(row[vi].value);
    if (isNaN(val)) continue;
    allValues.push(val);
    const seg = si !== null ? String(row[si].value) : '__all__';
    if (!segments.has(seg)) segments.set(seg, []);
    segments.get(seg).push(val);
  }

  if (allValues.length === 0) throw new Error('No valid numeric values found in the "Value" encoding slot.');

  return { segments, allValues, encodingBinCount };
}

// ─── Drawing ─────────────────────────────────────────────────────────────────
function drawChart({ segments, allValues, encodingBinCount }) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top - MARGIN.bottom;

  // ── Determine bin count (precedence: slider > encoding > Sturges auto) ────
  const stuBins    = Math.ceil(Math.log2(allValues.length) + 1);
  const activeBins = sliderBins ?? encodingBinCount ?? stuBins;

  // Keep slider UI in sync when controlled by encoding/auto
  const slider = document.getElementById('bin-slider');
  const sliderLbl = document.getElementById('bin-value-label');
  if (sliderBins === null) {
    slider.value = activeBins;
    sliderLbl.textContent = activeBins;
  }

  // ── X domain (shared across all segments) ─────────────────────────────────
  const xMin = d3.min(allValues);
  const xMax = d3.max(allValues);
  const xPad = (xMax - xMin) * 0.02;

  // ── X scale ───────────────────────────────────────────────────────────────
  let xScale;
  if (logX) {
    const safeMin = xMin > 0 ? xMin : 1;
    xScale = d3.scaleLog()
      .domain([safeMin * 0.9, xMax * 1.05])
      .range([0, w])
      .nice();
  } else {
    xScale = d3.scaleLinear()
      .domain([xMin - xPad, xMax + xPad])
      .range([0, w])
      .nice();
  }

  // ── Binning (same thresholds for all segments) ────────────────────────────
  const [domainMin, domainMax] = xScale.domain();
  const step = (domainMax - domainMin) / activeBins;
  const thresholds = d3.range(domainMin, domainMax, step);
  const binner = d3.bin()
    .domain(xScale.domain())
    .thresholds(thresholds);

  // ── Bin each segment ──────────────────────────────────────────────────────
  const segKeys = [...segments.keys()];
  const isSingleSeg = segKeys.length === 1 && segKeys[0] === '__all__';
  const colors = d3.scaleOrdinal().domain(segKeys).range(COLORS);
  const n = allValues.length;

  const segBins = new Map();
  for (const [key, vals] of segments) {
    segBins.set(key, binner(vals));
  }

  // ── Y accessor by mode ────────────────────────────────────────────────────
  function yValue(bin, segValues) {
    const binWidth = bin.x1 - bin.x0;
    switch (yMode) {
      case 'density': return binWidth > 0 ? bin.length / (n * binWidth) : 0;
      case 'percent': return bin.length / n;
      default:        return bin.length; // 'count'
    }
  }

  // ── Y domain (max across all segments and all bins) ───────────────────────
  let yMaxVal = 0;
  for (const [key, bins] of segBins) {
    const segVals = segments.get(key);
    for (const bin of bins) {
      yMaxVal = Math.max(yMaxVal, yValue(bin, segVals));
    }
  }

  const yScale = d3.scaleLinear()
    .domain([0, yMaxVal * 1.1])
    .nice()
    .range([h, 0]);

  // ── Y axis formatter ──────────────────────────────────────────────────────
  const yFormat = yMode === 'percent'
    ? d3.format('.0%')
    : yMode === 'density'
      ? d3.format('.4f')
      : d3.format('~s');

  // ── Build/update SVG ──────────────────────────────────────────────────────
  let svg = d3.select(container).select('#histogram-svg');
  if (svg.empty()) {
    svg = d3.select(container)
      .append('svg')
      .attr('id', 'histogram-svg');
  }
  svg.attr('width', W).attr('height', H);

  let g = svg.select('.root-g');
  if (g.empty()) {
    g = svg.append('g').attr('class', 'root-g');
  }
  g.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // ── Grid ──────────────────────────────────────────────────────────────────
  let gridG = g.select('.grid');
  if (gridG.empty()) gridG = g.append('g').attr('class', 'grid');
  gridG.call(d3.axisLeft(yScale).tickSize(-w).tickFormat(''))
    .call(grp => grp.select('.domain').remove());

  // ── X axis ────────────────────────────────────────────────────────────────
  let xAxisG = g.select('.x-axis');
  if (xAxisG.empty()) {
    xAxisG = g.append('g').attr('class', 'axis x-axis').attr('transform', `translate(0,${h})`);
  }
  const xAxisFn = logX
    ? d3.axisBottom(xScale).ticks(6, '~s').tickSizeOuter(0)
    : d3.axisBottom(xScale).ticks(6).tickSizeOuter(0).tickFormat(d3.format('~s'));
  xAxisG.call(xAxisFn)
    .selectAll('text')
    .attr('dy', '1.2em');

  // X axis label
  let xLbl = g.select('.x-label');
  if (xLbl.empty()) {
    xLbl = g.append('text').attr('class', 'x-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#555');
  }
  xLbl.attr('x', w / 2).attr('y', h + 48).text('Value');

  // ── Y axis ────────────────────────────────────────────────────────────────
  let yAxisG = g.select('.y-axis');
  if (yAxisG.empty()) yAxisG = g.append('g').attr('class', 'axis y-axis');
  yAxisG.call(d3.axisLeft(yScale).ticks(6).tickSizeOuter(0).tickFormat(yFormat));

  // Y axis label
  let yLbl = g.select('.y-label');
  if (yLbl.empty()) {
    yLbl = g.append('text').attr('class', 'y-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#555')
      .attr('transform', 'rotate(-90)');
  }
  const yLabelText = yMode === 'count' ? 'Count' : yMode === 'density' ? 'Density' : 'Percent';
  yLbl.attr('x', -h / 2).attr('y', -58).text(yLabelText);

  // ── Tooltip ───────────────────────────────────────────────────────────────
  let tooltip = d3.select(container).select('.tooltip');
  if (tooltip.empty()) {
    tooltip = d3.select(container)
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute');
  }

  // ── Render bars for each segment ──────────────────────────────────────────
  // Remove old bar groups before redrawing (bins change count on every redraw)
  g.selectAll('.seg-bars').remove();
  g.selectAll('.kde-path').remove();

  for (const [key, bins] of segBins) {
    const segVals  = segments.get(key);
    const fillColor = colors(key);
    const opacity   = isSingleSeg ? 0.75 : 0.5;

    const barGroup = g.append('g')
      .attr('class', 'seg-bars')
      .attr('fill', fillColor)
      .attr('opacity', opacity);

    barGroup.selectAll('rect')
      .data(bins)
      .join('rect')
        .attr('x', d => {
          const x0 = logX ? Math.max(d.x0, xScale.domain()[0]) : d.x0;
          return xScale(x0) + 1;
        })
        .attr('width', d => {
          const x0 = logX ? Math.max(d.x0, xScale.domain()[0]) : d.x0;
          const x1 = logX ? Math.min(d.x1, xScale.domain()[1]) : d.x1;
          return Math.max(0, xScale(x1) - xScale(x0) - 2);
        })
        .attr('y', d => yScale(yValue(d, segVals)))
        .attr('height', d => Math.max(0, h - yScale(yValue(d, segVals))))
        .on('mouseover', function(event, d) {
          d3.select(this).attr('opacity', 1);
          const yv = yValue(d, segVals);
          const label = isSingleSeg ? '' : `<b style="color:${fillColor}">${key}</b><br>`;
          tooltip
            .style('opacity', 1)
            .style('left', `${event.offsetX + 14}px`)
            .style('top',  `${event.offsetY - 10}px`)
            .html(
              `${label}` +
              `Range: ${d3.format(',.1f')(d.x0)} – ${d3.format(',.1f')(d.x1)}<br>` +
              `${yLabelText}: <b>${yFormat(yv)}</b>`
            );
        })
        .on('mousemove', function(event) {
          tooltip
            .style('left', `${event.offsetX + 14}px`)
            .style('top',  `${event.offsetY - 10}px`);
        })
        .on('mouseout', function() {
          d3.select(this).attr('opacity', opacity);
          tooltip.style('opacity', 0);
        });

    // ── KDE overlay per segment ───────────────────────────────────────────
    if (showKde) {
      const kde = buildKde(xScale.ticks(200), segVals);
      const lineGen = d3.line()
        .x(d => xScale(d[0]))
        .y(d => {
          if (yMode === 'count') {
            // scale density to counts: multiply by n * binWidth
            const binWidth = (xScale.domain()[1] - xScale.domain()[0]) / activeBins;
            return yScale(d[1] * n * binWidth);
          } else if (yMode === 'percent') {
            const binWidth = (xScale.domain()[1] - xScale.domain()[0]) / activeBins;
            return yScale(d[1] * binWidth);
          }
          return yScale(d[1]); // density
        })
        .curve(d3.curveBasis)
        .defined(d => d[0] >= xScale.domain()[0] && d[0] <= xScale.domain()[1]);

      g.append('path')
        .attr('class', 'kde-path')
        .datum(kde)
        .attr('fill', 'none')
        .attr('stroke', fillColor)
        .attr('stroke-width', 2.5)
        .attr('opacity', 0.9)
        .attr('d', lineGen);
    }
  }

  // ── Legend (hidden when single segment) ──────────────────────────────────
  let legendG = g.select('.legend');
  if (legendG.empty()) {
    legendG = g.append('g').attr('class', 'legend')
      .attr('transform', `translate(${w + 18}, 0)`);
  }
  legendG.selectAll('*').remove();

  if (!isSingleSeg) {
    segKeys.forEach((key, i) => {
      const item = legendG.append('g')
        .attr('transform', `translate(0,${i * 22})`);
      item.append('rect')
        .attr('width', 14).attr('height', 14).attr('rx', 2).attr('y', -1)
        .attr('fill', colors(key)).attr('opacity', 0.75);
      item.append('text')
        .attr('x', 20).attr('y', 11)
        .attr('font-size', 12).attr('fill', '#444')
        .text(key);
    });
  }
}

// ─── KDE helper ───────────────────────────────────────────────────────────────
// Gaussian kernel density estimator using Scott's bandwidth rule.
// Returns array of [x, density] pairs evaluated at each point in `evalPoints`.
function buildKde(evalPoints, values) {
  const n = values.length;
  if (n < 2) return evalPoints.map(x => [x, 0]);
  const bw = 1.06 * d3.deviation(values) * Math.pow(n, -0.2);
  if (!bw || bw <= 0) return evalPoints.map(x => [x, 0]);
  const kernel = xi => {
    return values.reduce((sum, v) => {
      const u = (xi - v) / bw;
      return sum + Math.exp(-0.5 * u * u) / (bw * Math.sqrt(2 * Math.PI));
    }, 0) / n;
  };
  return evalPoints.map(x => [x, kernel(x)]);
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

// ─── Debounced resize ────────────────────────────────────────────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // Re-trigger a render using last known worksheet — not available in test mode.
    // In Tableau context, SummaryDataChanged fires on resize; here we redraw manually.
    const evt = new Event('resize-redraw');
    document.dispatchEvent(evt);
  }, 150);
});
