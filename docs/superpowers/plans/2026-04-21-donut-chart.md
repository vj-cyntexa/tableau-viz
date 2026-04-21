# Donut Chart Viz Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` syntax. Update to `- [x]` as each step completes.

**Goal:** Build and deploy a Tableau Viz Extension that renders a D3.js donut chart with three selectable variations (standard, exploded, multi-ring), published to GitHub Pages and loadable in Tableau Desktop via a `.trex` manifest.

**Architecture:** A pure HTML/JS extension (no build step) served from GitHub Pages. The `.trex` manifest registers three encoding slots (`category`, `value`, `inner-value`); `index.html` hosts toggle buttons for switching modes and delegates all D3 rendering to `chart.js`. A `test.html` page mocks the Tableau API so the chart runs in any browser without Tableau Desktop.

**Tech Stack:** D3.js v7, Tableau Extensions API 2.x, vanilla JS, GitHub Pages

---

## Progress Tracker
- [x] Task 1: TREX manifests
- [x] Task 2: index.html
- [x] Task 3: chart.js
- [x] Task 4: test.html
- [x] Task 5: README.md
- [x] Task 6: Push all

---

## Task 1: TREX Manifests

**Files:**
- `extensions/donut-chart/donut-chart.trex`
- `extensions/donut-chart/donut-chart-local.trex`

- [x] **Step 1.1: Create production manifest**

Create `extensions/donut-chart/donut-chart.trex`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.donutchart" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Donut chart with standard, exploded, and multi-ring modes built with D3.js</description>
    <author name="Cyntexa" organization="Cyntexa" website="https://cyntexa.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>https://vj-cyntexa.github.io/tableau-viz/extensions/donut-chart/index.html</url>
    </source-location>
    <icon/>
    <encoding id="category">
      <display-name resource-id="category_label">Category</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="value">
      <display-name resource-id="value_label">Value</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="inner-value">
      <display-name resource-id="inner_value_label">Inner Value (Multi-Ring)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="0" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Donut Chart</text></resource>
    <resource id="category_label"><text locale="en_US">Category</text></resource>
    <resource id="value_label"><text locale="en_US">Value</text></resource>
    <resource id="inner_value_label"><text locale="en_US">Inner Value (Multi-Ring)</text></resource>
  </resources>
</manifest>
```

- [x] **Step 1.2: Create local dev manifest**

Create `extensions/donut-chart/donut-chart-local.trex`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.donutchart.local" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Donut chart with standard, exploded, and multi-ring modes built with D3.js (local dev)</description>
    <author name="Cyntexa" organization="Cyntexa" website="https://cyntexa.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>http://localhost:8080/extensions/donut-chart/index.html</url>
    </source-location>
    <icon/>
    <encoding id="category">
      <display-name resource-id="category_label">Category</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="value">
      <display-name resource-id="value_label">Value</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="inner-value">
      <display-name resource-id="inner_value_label">Inner Value (Multi-Ring)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="0" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Donut Chart (local)</text></resource>
    <resource id="category_label"><text locale="en_US">Category</text></resource>
    <resource id="value_label"><text locale="en_US">Value</text></resource>
    <resource id="inner_value_label"><text locale="en_US">Inner Value (Multi-Ring)</text></resource>
  </resources>
</manifest>
```

---

## Task 2: index.html

**File:** `extensions/donut-chart/index.html`

- [x] **Step 2.1: Create index.html**

Create `extensions/donut-chart/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Donut Chart</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://extensions.tableau.com/lib/tableau.extensions.2.latest.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #ffffff;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* ── Toggle bar ── */
    #controls {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: #f8f8f8;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }

    #controls span {
      font-size: 12px;
      color: #666;
      margin-right: 4px;
    }

    .mode-btn {
      padding: 4px 12px;
      font-size: 12px;
      font-family: inherit;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #fff;
      color: #444;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .mode-btn:hover {
      background: #eef2ff;
      border-color: #7b8cde;
      color: #2d3a8c;
    }

    .mode-btn.active {
      background: #4e5ba6;
      border-color: #4e5ba6;
      color: #fff;
    }

    /* ── Chart area ── */
    #chart {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    /* ── Tooltip ── */
    .tooltip {
      position: absolute;
      background: rgba(255, 255, 255, 0.97);
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 9px 13px;
      font-size: 12px;
      line-height: 1.7;
      pointer-events: none;
      box-shadow: 0 3px 10px rgba(0,0,0,0.10);
      max-width: 220px;
      z-index: 10;
      display: none;
    }

    .tooltip .tt-label {
      font-weight: 600;
      font-size: 13px;
      color: #222;
      margin-bottom: 3px;
    }

    .tooltip .tt-value { color: #333; }
    .tooltip .tt-pct   { color: #888; font-size: 11px; }

    /* ── Legend ── */
    .legend text {
      font-size: 12px;
      fill: #444;
    }

    /* ── Center label ── */
    .center-total {
      font-size: 22px;
      font-weight: 700;
      fill: #222;
      text-anchor: middle;
    }

    .center-sub {
      font-size: 11px;
      fill: #888;
      text-anchor: middle;
    }

    /* ── Error banner ── */
    #error {
      display: none;
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #fff0f0;
      color: #c0392b;
      border: 1px solid #f5c6c6;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 13px;
      z-index: 100;
      max-width: 80vw;
      text-align: center;
    }
    #error:not(:empty) { display: block; }
  </style>
</head>
<body>
  <div id="controls">
    <span>Mode:</span>
    <button class="mode-btn active" data-mode="standard">Standard</button>
    <button class="mode-btn"        data-mode="exploded">Exploded</button>
    <button class="mode-btn"        data-mode="multi-ring">Multi-Ring</button>
  </div>
  <div id="chart"></div>
  <div class="tooltip" id="tooltip"></div>
  <div id="error"></div>
  <script src="chart.js"></script>
</body>
</html>
```

---

## Task 3: chart.js

**File:** `extensions/donut-chart/chart.js`

- [x] **Step 3.1: Create chart.js**

Create `extensions/donut-chart/chart.js`:

```js
'use strict';

/* ─────────────────────────────────────────
   Constants
───────────────────────────────────────── */
const COLORS          = d3.schemeTableau10;
const TRANSITION_MS   = 300;
const LEGEND_WIDTH    = 170;    // px reserved on the right
const EXPLODE_OFFSET  = 8;      // px a segment shifts outward on hover/click
const INNER_R_RATIO   = 0.60;   // inner radius = 60 % of outer for standard & exploded
const MULTI_OUTER_R   = 1.00;   // outer ring uses full outer radius
const MULTI_INNER_R   = 0.60;   // inner ring outer boundary
const MULTI_INNER_R2  = 0.35;   // inner ring inner boundary (hole)

/* ─────────────────────────────────────────
   State
───────────────────────────────────────── */
let currentMode   = 'standard'; // 'standard' | 'exploded' | 'multi-ring'
let clickedIndex  = null;       // which segment is pinned-exploded
let chartData     = null;       // { rows: [{category, value, innerValue}], totals }

/* ─────────────────────────────────────────
   Tableau init
───────────────────────────────────────── */
tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => setError(err.message || String(err)));

/* ─────────────────────────────────────────
   Mode toggle wiring
───────────────────────────────────────── */
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode  = btn.dataset.mode;
    clickedIndex = null;
    if (chartData) drawChart(chartData);
  });
});

/* ─────────────────────────────────────────
   Render pipeline
───────────────────────────────────────── */
async function render(worksheet) {
  clearError();
  try {
    const [vizSpec, dataTable] = await Promise.all([
      worksheet.getVisualSpecificationAsync(),
      fetchData(worksheet),
    ]);
    chartData = parseTableauData(dataTable, vizSpec);
    drawChart(chartData);
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

/* ─────────────────────────────────────────
   Parse Tableau data
───────────────────────────────────────── */
function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(id) {
    const enc = encodings.find(e => e.id === id);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const catField        = fieldName('category');
  const valField        = fieldName('value');
  const innerValField   = fieldName('inner-value');

  const colIndex = Object.fromEntries(dataTable.columns.map(c => [c.fieldName, c.index]));

  if (!catField || !(catField in colIndex)) {
    throw new Error('Drag a dimension onto the "Category" encoding slot.');
  }
  if (!valField || !(valField in colIndex)) {
    throw new Error('Drag a measure onto the "Value" encoding slot.');
  }

  const ci  = colIndex[catField];
  const vi  = colIndex[valField];
  const ivi = (innerValField && innerValField in colIndex) ? colIndex[innerValField] : null;

  const rows = dataTable.data
    .map(row => ({
      category:   String(row[ci].value),
      value:      Math.abs(Number(row[vi].value)),
      innerValue: ivi !== null ? Math.abs(Number(row[ivi].value)) : 0,
    }))
    .filter(r => !Number.isNaN(r.value) && r.value > 0);

  if (rows.length === 0) throw new Error('No positive numeric data found.');

  const total      = d3.sum(rows, r => r.value);
  const innerTotal = d3.sum(rows, r => r.innerValue);

  return { rows, total, innerTotal };
}

/* ─────────────────────────────────────────
   Draw
───────────────────────────────────────── */
function drawChart(data) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;

  // Clear previous SVG
  d3.select(container).select('svg').remove();

  const svg = d3.select(container).append('svg')
    .attr('width', W)
    .attr('height', H);

  const chartW  = W - LEGEND_WIDTH;
  const cx      = chartW / 2;
  const cy      = H / 2;
  const outerR  = Math.min(chartW, H) / 2 - 16;

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  const color = d3.scaleOrdinal(COLORS).domain(data.rows.map(r => r.category));

  if (currentMode === 'standard') {
    drawStandard(g, data, outerR, color);
  } else if (currentMode === 'exploded') {
    drawExploded(g, data, outerR, color);
  } else {
    drawMultiRing(g, data, outerR, color);
  }

  drawLegend(svg, data, color, W, H);
}

/* ── Standard donut ── */
function drawStandard(g, data, outerR, color) {
  const innerR = outerR * INNER_R_RATIO;

  const pie = d3.pie().value(d => d.value).sort(null);
  const arc = d3.arc().innerRadius(innerR).outerRadius(outerR).padAngle(0.02).cornerRadius(3);

  const arcs = pie(data.rows);

  g.selectAll('path.slice')
    .data(arcs)
    .join('path')
      .attr('class', 'slice')
      .attr('fill', d => color(d.data.category))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .transition().duration(TRANSITION_MS)
      .attrTween('d', function(d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return t => arc(i(t));
      });

  // Hover tooltip on slices (add after transition via selection, not transition chain)
  g.selectAll('path.slice')
    .on('mouseover', (event, d) => showTooltip(event, d.data, data.total))
    .on('mousemove', moveTooltip)
    .on('mouseout', hideTooltip);

  drawCenterLabel(g, data.total);
}

/* ── Exploded donut ── */
function drawExploded(g, data, outerR, color) {
  const innerR = outerR * INNER_R_RATIO;

  const pie = d3.pie().value(d => d.value).sort(null);
  const arc = d3.arc().innerRadius(innerR).outerRadius(outerR).padAngle(0.02).cornerRadius(3);

  const arcs = pie(data.rows);

  function explodeTransform(d, i) {
    const isExploded = (i === clickedIndex);
    if (!isExploded) return 'translate(0,0)';
    const mid = (d.startAngle + d.endAngle) / 2;
    return `translate(${Math.sin(mid) * EXPLODE_OFFSET},${-Math.cos(mid) * EXPLODE_OFFSET})`;
  }

  const slices = g.selectAll('path.slice')
    .data(arcs)
    .join('path')
      .attr('class', 'slice')
      .attr('fill', d => color(d.data.category))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('transform', (d, i) => explodeTransform(d, i))
      .transition().duration(TRANSITION_MS)
      .attrTween('d', function(d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return t => arc(i(t));
      });

  g.selectAll('path.slice')
    .on('mouseover', function(event, d) {
      const i = arcs.indexOf(d);
      if (i !== clickedIndex) {
        const mid = (d.startAngle + d.endAngle) / 2;
        d3.select(this)
          .transition().duration(150)
          .attr('transform', `translate(${Math.sin(mid) * EXPLODE_OFFSET},${-Math.cos(mid) * EXPLODE_OFFSET})`);
      }
      showTooltip(event, d.data, data.total);
    })
    .on('mousemove', moveTooltip)
    .on('mouseout', function(event, d) {
      const i = arcs.indexOf(d);
      if (i !== clickedIndex) {
        d3.select(this)
          .transition().duration(150)
          .attr('transform', 'translate(0,0)');
      }
      hideTooltip();
    })
    .on('click', function(event, d) {
      const i = arcs.indexOf(d);
      clickedIndex = (clickedIndex === i) ? null : i;
      g.selectAll('path.slice')
        .transition().duration(TRANSITION_MS)
        .attr('transform', (dd, ii) => explodeTransform(dd, ii));
    });

  drawCenterLabel(g, data.total);
}

/* ── Multi-ring donut ── */
function drawMultiRing(g, data, outerR, color) {
  // Outer ring: value
  const outerArcGen = d3.arc()
    .innerRadius(outerR * MULTI_INNER_R)
    .outerRadius(outerR * MULTI_OUTER_R)
    .padAngle(0.02)
    .cornerRadius(3);

  // Inner ring: innerValue (only if data exists)
  const innerArcGen = d3.arc()
    .innerRadius(outerR * MULTI_INNER_R2)
    .outerRadius(outerR * MULTI_INNER_R - 4)
    .padAngle(0.02)
    .cornerRadius(3);

  const pie = d3.pie().value(d => d.value).sort(null);
  const outerArcs = pie(data.rows);

  // Outer ring
  g.selectAll('path.outer-slice')
    .data(outerArcs)
    .join('path')
      .attr('class', 'outer-slice')
      .attr('fill', d => color(d.data.category))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .transition().duration(TRANSITION_MS)
      .attrTween('d', function(d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return t => outerArcGen(i(t));
      });

  g.selectAll('path.outer-slice')
    .on('mouseover', (event, d) => showTooltip(event, d.data, data.total, 'value'))
    .on('mousemove', moveTooltip)
    .on('mouseout', hideTooltip);

  // Inner ring (only if innerValue data is present)
  const hasInner = data.rows.some(r => r.innerValue > 0);

  if (hasInner) {
    const piePct = d3.pie().value(d => d.innerValue).sort(null);
    const innerArcs = piePct(data.rows);

    g.selectAll('path.inner-slice')
      .data(innerArcs)
      .join('path')
        .attr('class', 'inner-slice')
        .attr('fill', d => color(d.data.category))
        .attr('opacity', 0.65)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .transition().duration(TRANSITION_MS)
        .attrTween('d', function(d) {
          const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
          return t => innerArcGen(i(t));
        });

    g.selectAll('path.inner-slice')
      .on('mouseover', (event, d) => showTooltip(event, d.data, data.innerTotal, 'innerValue'))
      .on('mousemove', moveTooltip)
      .on('mouseout', hideTooltip);
  }

  // Ring labels
  const ringLabelR = outerR * MULTI_INNER_R - 10;
  g.append('text')
    .attr('class', 'center-sub')
    .attr('y', -ringLabelR - 6)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('fill', '#aaa')
    .text('outer');

  if (hasInner) {
    g.append('text')
      .attr('class', 'center-sub')
      .attr('y', -(outerR * MULTI_INNER_R2) + 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#aaa')
      .text('inner');
  }

  drawCenterLabel(g, data.total);
}

/* ─────────────────────────────────────────
   Center label
───────────────────────────────────────── */
function drawCenterLabel(g, total) {
  g.append('text')
    .attr('class', 'center-total')
    .attr('y', -6)
    .text(formatValue(total));

  g.append('text')
    .attr('class', 'center-sub')
    .attr('y', 14)
    .text('Total');
}

/* ─────────────────────────────────────────
   Legend
───────────────────────────────────────── */
function drawLegend(svg, data, color, W, H) {
  const total   = data.total;
  const lx      = W - LEGEND_WIDTH + 10;
  const squareS = 12;
  const rowH    = 22;
  const startY  = Math.max(16, (H - data.rows.length * rowH) / 2);

  const lg = svg.append('g').attr('class', 'legend').attr('transform', `translate(${lx},${startY})`);

  data.rows.forEach((row, i) => {
    const pct = total > 0 ? ((row.value / total) * 100).toFixed(1) : '0.0';
    const y   = i * rowH;

    lg.append('rect')
      .attr('x', 0).attr('y', y)
      .attr('width', squareS).attr('height', squareS)
      .attr('rx', 2)
      .attr('fill', color(row.category));

    lg.append('text')
      .attr('x', squareS + 7)
      .attr('y', y + squareS - 1)
      .style('font-size', '12px')
      .style('fill', '#333')
      .text(`${truncate(row.category, 14)}  ${pct}%`);
  });
}

/* ─────────────────────────────────────────
   Tooltip helpers
───────────────────────────────────────── */
function showTooltip(event, rowData, total, valueKey = 'value') {
  const tip   = document.getElementById('tooltip');
  const val   = rowData[valueKey];
  const pct   = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
  tip.innerHTML = `
    <div class="tt-label">${escHtml(rowData.category)}</div>
    <div class="tt-value">${formatValue(val)}</div>
    <div class="tt-pct">${pct}% of total</div>`;
  tip.style.display = 'block';
  positionTooltip(event);
}

function moveTooltip(event) { positionTooltip(event); }
function hideTooltip()       { document.getElementById('tooltip').style.display = 'none'; }

function positionTooltip(event) {
  const tip     = document.getElementById('tooltip');
  const chart   = document.getElementById('chart');
  const rect    = chart.getBoundingClientRect();
  const x       = event.clientX - rect.left + 12;
  const y       = event.clientY - rect.top  - 10;
  const tipW    = tip.offsetWidth;
  const tipH    = tip.offsetHeight;
  tip.style.left = (x + tipW > rect.width ? x - tipW - 20 : x) + 'px';
  tip.style.top  = (y + tipH > rect.height ? y - tipH : y)      + 'px';
}

/* ─────────────────────────────────────────
   Utilities
───────────────────────────────────────── */
function formatValue(v) {
  if (v >= 1e9)  return (v / 1e9).toFixed(2)  + 'B';
  if (v >= 1e6)  return (v / 1e6).toFixed(2)  + 'M';
  if (v >= 1e3)  return (v / 1e3).toFixed(1)  + 'K';
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setError(msg) {
  const el = document.getElementById('error');
  if (el) el.textContent = msg;
}

function clearError() {
  const el = document.getElementById('error');
  if (el) el.textContent = '';
}
```

---

## Task 4: test.html

**File:** `extensions/donut-chart/test.html`

- [x] **Step 4.1: Create test.html**

Create `extensions/donut-chart/test.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Donut Chart — Browser Test</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      min-height: 100vh;
    }

    h2 {
      font-size: 15px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
    }

    #chart-wrapper {
      width: 100%;
      height: calc(100vh - 80px);
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Toggle bar ── */
    #controls {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: #f8f8f8;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }

    #controls span { font-size: 12px; color: #666; margin-right: 4px; }

    .mode-btn {
      padding: 4px 12px;
      font-size: 12px;
      font-family: inherit;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #fff;
      color: #444;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .mode-btn:hover  { background: #eef2ff; border-color: #7b8cde; color: #2d3a8c; }
    .mode-btn.active { background: #4e5ba6; border-color: #4e5ba6; color: #fff; }

    #chart {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    .tooltip {
      position: absolute;
      background: rgba(255,255,255,0.97);
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 9px 13px;
      font-size: 12px;
      line-height: 1.7;
      pointer-events: none;
      box-shadow: 0 3px 10px rgba(0,0,0,0.10);
      max-width: 220px;
      z-index: 10;
      display: none;
    }

    .tooltip .tt-label { font-weight: 600; font-size: 13px; color: #222; margin-bottom: 3px; }
    .tooltip .tt-value { color: #333; }
    .tooltip .tt-pct   { color: #888; font-size: 11px; }

    .legend text { font-size: 12px; fill: #444; }
    .center-total { font-size: 22px; font-weight: 700; fill: #222; text-anchor: middle; }
    .center-sub   { font-size: 11px; fill: #888; text-anchor: middle; }

    #error {
      display: none;
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #fff0f0;
      color: #c0392b;
      border: 1px solid #f5c6c6;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 13px;
      z-index: 100;
      max-width: 80vw;
      text-align: center;
    }
    #error:not(:empty) { display: block; }
  </style>
</head>
<body>
  <h2>Donut Chart — Browser Test (mock data: market share)</h2>

  <div id="chart-wrapper">
    <div id="controls">
      <span>Mode:</span>
      <button class="mode-btn active" data-mode="standard">Standard</button>
      <button class="mode-btn"        data-mode="exploded">Exploded</button>
      <button class="mode-btn"        data-mode="multi-ring">Multi-Ring</button>
    </div>
    <div id="chart"></div>
    <div class="tooltip" id="tooltip"></div>
  </div>

  <div id="error"></div>

  <script>
  'use strict';

  /* ── Mock data: global smartphone market share Q4 2025 (realistic %) ── */
  const MOCK_ROWS = [
    { category: 'Samsung',  value: 20.1, innerValue: 18.4 },
    { category: 'Apple',    value: 17.3, innerValue: 22.1 },
    { category: 'Xiaomi',   value: 12.9, innerValue: 11.7 },
    { category: 'OPPO',     value:  8.7, innerValue:  9.2 },
    { category: 'Others',   value: 41.0, innerValue: 38.6 },
  ];

  /* ── Minimal Tableau API mock ── */
  const tableau = {
    extensions: {
      initializeAsync: () => Promise.resolve(),
      worksheetContent: {
        worksheet: {
          addEventListener: () => {},
          getVisualSpecificationAsync: () => Promise.resolve({
            marksSpecificationCollection: [{
              encodingCollection: [
                {
                  id: 'category',
                  fieldCollection: [{ fieldName: 'Category' }],
                },
                {
                  id: 'value',
                  fieldCollection: [{ fieldName: 'Value' }],
                },
                {
                  id: 'inner-value',
                  fieldCollection: [{ fieldName: 'InnerValue' }],
                },
              ],
            }],
          }),
          getSummaryDataReaderAsync: () => Promise.resolve({
            getAllPagesAsync: () => Promise.resolve({
              columns: [
                { fieldName: 'Category',   index: 0 },
                { fieldName: 'Value',      index: 1 },
                { fieldName: 'InnerValue', index: 2 },
              ],
              data: MOCK_ROWS.map(r => [
                { value: r.category  },
                { value: r.value     },
                { value: r.innerValue},
              ]),
            }),
            releaseAsync: () => Promise.resolve(),
          }),
          TableauEventType: {},
        },
      },
    },
    TableauEventType: { SummaryDataChanged: 'summaryDataChanged' },
  };

  /* Patch global so chart.js can call tableau.extensions.initializeAsync */
  window.tableau = tableau;
  </script>

  <!-- Load the real chart module (it picks up the mocked window.tableau) -->
  <script src="chart.js"></script>
</body>
</html>
```

---

## Task 5: README.md

**File:** `extensions/donut-chart/README.md`

- [x] **Step 5.1: Create README.md**

Create `extensions/donut-chart/README.md`:

```markdown
# Donut Chart — Tableau Viz Extension

A D3.js v7 Tableau Viz Extension that renders a donut chart with three switchable variations.

## Variations

| Mode | Description |
|---|---|
| **Standard** | Segmented donut with center label showing formatted total |
| **Exploded** | Hover pulls a segment outward by 8 px; click pins the explode |
| **Multi-Ring** | Outer ring = `value`, inner ring = `inner-value` (concentric) |

## Encoding Slots

| Slot | Role | Required |
|---|---|---|
| `category` | Discrete dimension — labels each slice | Yes |
| `value` | Continuous measure — drives outer arc sizes | Yes |
| `inner-value` | Continuous measure — drives inner ring in multi-ring mode | No |

## Live URL

```
https://vj-cyntexa.github.io/tableau-viz/extensions/donut-chart/index.html
```

## TREX Manifests

| File | Use |
|---|---|
| `donut-chart.trex` | Production (GitHub Pages) |
| `donut-chart-local.trex` | Local dev (`http://localhost:8080/…`) |

## Local Development

```bash
# From the repo root:
npx serve . -p 8080
# Then open http://localhost:8080/extensions/donut-chart/test.html
```

Load `donut-chart-local.trex` in Tableau Desktop (Extensions → My Extensions).

## Author

Cyntexa
```

---

## Task 6: Push all files

- [x] **Step 6.1: Stage and commit**

```bash
git add extensions/donut-chart/
git commit -m "feat: donut-chart viz extension (standard, exploded, multi-ring)"
```

- [x] **Step 6.2: Push**

```bash
git pull --rebase origin master && git push origin master
```
