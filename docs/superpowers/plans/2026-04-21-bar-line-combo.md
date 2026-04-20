# Bar-Line Combo Viz Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` syntax. Update to `- [x]` as each step completes.

**Goal:** Build and deploy a Tableau Viz Extension that renders a D3.js combo chart with bars on a left Y axis (primary measure) and a line overlaid on a right Y axis (secondary measure), published to GitHub Pages and loadable in Tableau Desktop via a `.trex` manifest.

**Architecture:** A pure HTML/JS extension (no build step) served from GitHub Pages. The extension registers four encoding slots (`x`, `bar`, `line`, `color`) in its `.trex` manifest, reads live data from Tableau's Extensions API, and renders with D3 v7 using `d3.scaleBand()` for bars and `d3.line()` for the overlay. A `test.html` page mocks the entire Tableau API so the chart can be developed and verified in any browser without Tableau Desktop.

**Tech Stack:** D3.js v7, Tableau Extensions API 2.x, vanilla JS, GitHub Pages

---

## File Map

| Path | Role |
|---|---|
| `extensions/bar-line-combo/bar-line-combo.trex` | Production manifest (GitHub Pages URL) |
| `extensions/bar-line-combo/bar-line-combo-local.trex` | Dev manifest (localhost:8080 URL) |
| `extensions/bar-line-combo/index.html` | Extension shell loaded by Tableau in an iframe |
| `extensions/bar-line-combo/chart.js` | All D3 rendering + Tableau API integration |
| `extensions/bar-line-combo/test.html` | Standalone browser test — mocks Tableau API with monthly revenue + growth rate |
| `extensions/bar-line-combo/README.md` | Extension documentation |

---

## Progress Tracker

- [x] Task 1 — Folder and TREX manifests
- [x] Task 2 — HTML shell (`index.html`)
- [x] Task 3 — D3 chart logic (`chart.js`)
- [x] Task 4 — Standalone test page (`test.html`)
- [x] Task 5 — README (`README.md`)
- [ ] Task 6 — GitHub Pages, CLAUDE.md update, final push

---

## Task 1: Folder and TREX Manifests

**Files:**
- Create: `extensions/bar-line-combo/bar-line-combo.trex`
- Create: `extensions/bar-line-combo/bar-line-combo-local.trex`

- [x] **Step 1.1: Create production manifest**

Create `extensions/bar-line-combo/bar-line-combo.trex`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.barlinecombo" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Dual-axis combo chart: bars for primary measure, line for secondary measure, built with D3.js</description>
    <author name="Cyntexa" email="vishwajeet@cyntexa.com" organization="Cyntexa" website="https://cyntexa.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>https://vj-cyntexa.github.io/tableau-viz/extensions/bar-line-combo/index.html</url>
    </source-location>
    <icon/>
    <encoding id="x">
      <display-name resource-id="x_label">X Axis (Date or Category)</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="bar">
      <display-name resource-id="bar_label">Bar Measure (left Y axis)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="line">
      <display-name resource-id="line_label">Line Measure (right Y axis)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="color">
      <display-name resource-id="color_label">Group (stacked bars)</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="0" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Bar-Line Combo Chart</text></resource>
    <resource id="x_label"><text locale="en_US">X Axis (Date or Category)</text></resource>
    <resource id="bar_label"><text locale="en_US">Bar Measure (left Y axis)</text></resource>
    <resource id="line_label"><text locale="en_US">Line Measure (right Y axis)</text></resource>
    <resource id="color_label"><text locale="en_US">Group (stacked bars)</text></resource>
  </resources>
</manifest>
```

- [x] **Step 1.2: Create local dev manifest**

Create `extensions/bar-line-combo/bar-line-combo-local.trex` — identical to above except `id` and `<url>`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.barlinecombo.local" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Dual-axis combo chart: bars for primary measure, line for secondary measure, built with D3.js (local dev)</description>
    <author name="Cyntexa" email="vishwajeet@cyntexa.com" organization="Cyntexa" website="https://cyntexa.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>http://localhost:8080/extensions/bar-line-combo/index.html</url>
    </source-location>
    <icon/>
    <encoding id="x">
      <display-name resource-id="x_label">X Axis (Date or Category)</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="bar">
      <display-name resource-id="bar_label">Bar Measure (left Y axis)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="line">
      <display-name resource-id="line_label">Line Measure (right Y axis)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="color">
      <display-name resource-id="color_label">Group (stacked bars)</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="0" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Bar-Line Combo Chart (local)</text></resource>
    <resource id="x_label"><text locale="en_US">X Axis (Date or Category)</text></resource>
    <resource id="bar_label"><text locale="en_US">Bar Measure (left Y axis)</text></resource>
    <resource id="line_label"><text locale="en_US">Line Measure (right Y axis)</text></resource>
    <resource id="color_label"><text locale="en_US">Group (stacked bars)</text></resource>
  </resources>
</manifest>
```

- [x] **Step 1.3: Commit**

```bash
git add extensions/bar-line-combo/
git commit -m "feat: add .trex manifests for bar-line-combo viz extension"
```

---

## Task 2: HTML Shell (`index.html`)

**Files:**
- Create: `extensions/bar-line-combo/index.html`

- [x] **Step 2.1: Write index.html**

Create `extensions/bar-line-combo/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bar-Line Combo Chart</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://extensions.tableau.com/lib/tableau.extensions.2.latest.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #ffffff;
      overflow: hidden;
    }

    #chart {
      width: 100vw;
      height: 100vh;
      position: relative;
    }

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

    /* Grid */
    .grid line {
      stroke: #ebebeb;
      stroke-dasharray: 3 3;
    }
    .grid .domain { display: none; }

    /* Axes */
    .axis text {
      font-size: 11px;
      fill: #555;
    }
    .axis .domain { stroke: #ccc; }
    .axis .tick line { stroke: #ccc; }

    /* Right axis — style separately so color can differentiate */
    .axis-right text { fill: #e67e22; }
    .axis-right .domain { stroke: #e67e22; opacity: 0.5; }
    .axis-right .tick line { stroke: #e67e22; opacity: 0.4; }

    /* Bars */
    .bar {
      shape-rendering: crispEdges;
    }

    /* Line overlay */
    .combo-line {
      fill: none;
      stroke: #e67e22;
      stroke-width: 2.5px;
    }

    /* Crosshair */
    .crosshair {
      stroke: #999;
      stroke-width: 1px;
      stroke-dasharray: 4 3;
      pointer-events: none;
    }

    /* Tooltip */
    .tooltip {
      position: absolute;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 9px 13px;
      font-size: 12px;
      line-height: 1.7;
      pointer-events: none;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.10);
      max-width: 240px;
    }
    .tooltip .tt-label {
      font-weight: 600;
      font-size: 13px;
      color: #222;
      margin-bottom: 4px;
    }

    /* Legend */
    .legend text {
      font-size: 12px;
      fill: #444;
    }
  </style>
</head>
<body>
  <div id="chart"></div>
  <div id="error"></div>
  <script src="chart.js"></script>
</body>
</html>
```

- [x] **Step 2.2: Verify the file is valid HTML**

Open `extensions/bar-line-combo/index.html` in a browser. You should see a blank white page with no console errors (the Tableau Extensions API will throw a benign init error outside Tableau — expected).

- [x] **Step 2.3: Commit**

```bash
git add extensions/bar-line-combo/index.html
git commit -m "feat: add html shell for bar-line-combo extension"
```

---

## Task 3: D3 Chart Logic (`chart.js`)

**Files:**
- Create: `extensions/bar-line-combo/chart.js`

### Design decisions encoded in this file

- **X scale:** Always `d3.scaleBand()` — bars require bandwidth. Date detection is used only for tick label formatting: if all X values parse as `new Date(v)`, labels are formatted with `d3.timeFormat('%b %Y')`; otherwise raw strings are shown as-is.
- **Bar stacking:** When `color` encoding is present, bars are stacked using `d3.stack()`. When absent, a single bar series is drawn per X value. Stacked bars are the correct default for a combo chart — the total bar height per X category aligns with the single overlaid line, which represents a summary measure for the same category.
- **Left Y axis:** Linear scale starting at `0`, domain `[0, d3.max(stackedMaxValues) * 1.1]`, formatted with `d3.format('~s')`.
- **Right Y axis:** Linear scale auto-ranged with `d3.extent(lineValues).nice()` — does NOT force 0 since the line measure (e.g., growth rate %) can be negative.
- **Gridlines:** Rendered only from the left Y axis to avoid a double grid from dual axes.
- **Crosshair tooltip:** An invisible overlay `<rect>` captures mousemove. Since `scaleBand` has no `.invert()`, the nearest band is computed as `Math.floor((mx / bandStep))`, clamped to `[0, bands.length - 1]`. A vertical crosshair line is drawn at the band center. The tooltip box shows: X label, bar total (or stacked breakdown), line value.

- [x] **Step 3.1: Write chart.js**

Create `extensions/bar-line-combo/chart.js`:

```javascript
'use strict';

// ─── Layout constants ─────────────────────────────────────────────────────────
const MARGIN = { top: 30, right: 90, bottom: 65, left: 75 };
const BAR_COLOR    = '#3498db';   // steel blue — single-series bars
const LINE_COLOR   = '#e67e22';   // orange — line overlay
const STACK_COLORS = d3.schemeTableau10;

// ─── Bootstrap ───────────────────────────────────────────────────────────────
tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => {
  setError(err.message || String(err));
});

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
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, {
    ignoreSelection: true,
  });
  const table = await reader.getAllPagesAsync();
  await reader.releaseAsync();
  return table;
}

// ─── Data parsing ─────────────────────────────────────────────────────────────
// Returns:
//   {
//     xLabels:      string[],           // ordered domain labels for scaleBand
//     xIsDate:      boolean,            // whether x values parse as dates
//     stacked:      boolean,            // true when color encoding is present
//     groups:       string[],           // stack group keys (empty when !stacked)
//     stackData:    d3.SeriesPoint[][],  // result of d3.stack() (empty when !stacked)
//     barData:      { x: string, value: number }[], // used when !stacked
//     lineData:     { x: string, value: number }[], // one point per x label
//     barFieldName: string,
//     lineFieldName: string,
//   }
function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(encodingId) {
    const enc = encodings.find(e => e.id === encodingId);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const xField     = fieldName('x');
  const barField   = fieldName('bar');
  const lineField  = fieldName('line');
  const colorField = fieldName('color');

  const colIndex = Object.fromEntries(
    dataTable.columns.map(c => [c.fieldName, c.index])
  );

  if (!xField || !(xField in colIndex)) {
    throw new Error('Drag a dimension onto the "X Axis" encoding slot.');
  }
  if (!barField || !(barField in colIndex)) {
    throw new Error('Drag a numeric measure onto the "Bar Measure" encoding slot.');
  }
  if (!lineField || !(lineField in colIndex)) {
    throw new Error('Drag a numeric measure onto the "Line Measure" encoding slot.');
  }

  const xi  = colIndex[xField];
  const bi  = colIndex[barField];
  const li  = colIndex[lineField];
  const ci  = (colorField && colorField in colIndex) ? colIndex[colorField] : null;
  const stacked = ci !== null;

  // Parse raw rows
  const rawRows = dataTable.data.map(row => ({
    x:     String(row[xi].value),
    bar:   Number(row[bi].value),
    line:  Number(row[li].value),
    group: stacked ? String(row[ci].value) : null,
  })).filter(r => !Number.isNaN(r.bar) && !Number.isNaN(r.line));

  if (!rawRows.length) throw new Error('No valid rows found. Check field types on the encoding slots.');

  // Determine ordered x labels (preserve source order, deduplicate)
  const xLabelsSeen = new Set();
  const xLabels = [];
  rawRows.forEach(r => {
    if (!xLabelsSeen.has(r.x)) { xLabelsSeen.add(r.x); xLabels.push(r.x); }
  });

  // Detect whether x values are dates for tick label formatting
  const xIsDate = xLabels.every(v => {
    const d = new Date(v);
    return !isNaN(d.getTime());
  });

  // ── Stacked bar data ──────────────────────────────────────────────────────
  let stackData = [];
  let groups = [];

  if (stacked) {
    groups = [...new Set(rawRows.map(r => r.group))].sort();

    // Build a map: x → { [group]: barValue }
    const byX = Object.fromEntries(xLabels.map(x => [x, {}]));
    rawRows.forEach(r => {
      if (!byX[r.x]) byX[r.x] = {};
      byX[r.x][r.group] = (byX[r.x][r.group] || 0) + r.bar;
    });

    // d3.stack() needs an array of objects: { x, group1, group2, ... }
    const tableData = xLabels.map(x => {
      const obj = { x };
      groups.forEach(g => { obj[g] = byX[x][g] ?? 0; });
      return obj;
    });

    stackData = d3.stack().keys(groups)(tableData);
  }

  // ── Single-series bar data ────────────────────────────────────────────────
  let barData = [];
  if (!stacked) {
    const barByX = {};
    rawRows.forEach(r => { barByX[r.x] = (barByX[r.x] || 0) + r.bar; });
    barData = xLabels.map(x => ({ x, value: barByX[x] ?? 0 }));
  }

  // ── Line data — one point per x label ────────────────────────────────────
  // When multiple rows share the same x (stacked case), average the line values.
  const lineSums = {};
  const lineCounts = {};
  rawRows.forEach(r => {
    lineSums[r.x]   = (lineSums[r.x]   || 0) + r.line;
    lineCounts[r.x] = (lineCounts[r.x] || 0) + 1;
  });
  const lineData = xLabels.map(x => ({
    x,
    value: lineSums[x] / lineCounts[x],
  }));

  return {
    xLabels, xIsDate, stacked, groups, stackData, barData, lineData,
    barFieldName: barField, lineFieldName: lineField,
  };
}

// ─── Drawing ─────────────────────────────────────────────────────────────────
function drawChart(parsed) {
  const { xLabels, xIsDate, stacked, groups, stackData, barData, lineData,
          barFieldName, lineFieldName } = parsed;

  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top  - MARGIN.bottom;

  d3.select(container).selectAll('*').remove();

  if (!xLabels.length) { container.textContent = 'No data.'; return; }

  // ── X scale (scaleBand — always, bars require bandwidth) ──────────────────
  const xScale = d3.scaleBand()
    .domain(xLabels)
    .range([0, w])
    .padding(0.3);

  // ── Left Y scale — bars, starts at 0 ─────────────────────────────────────
  let barMax;
  if (stacked) {
    // Max of the top of each stack
    barMax = d3.max(stackData[stackData.length - 1], d => d[1]);
  } else {
    barMax = d3.max(barData, d => d.value);
  }
  const yLeft = d3.scaleLinear()
    .domain([0, (barMax || 0) * 1.1])
    .nice()
    .range([h, 0]);

  // ── Right Y scale — line, auto-ranged (can be negative) ──────────────────
  const lineExtent = d3.extent(lineData, d => d.value);
  const yRight = d3.scaleLinear()
    .domain(lineExtent)
    .nice()
    .range([h, 0]);

  // ── Color scale for stacked bars ──────────────────────────────────────────
  const stackColor = d3.scaleOrdinal()
    .domain(groups)
    .range(STACK_COLORS);

  // ── SVG root ──────────────────────────────────────────────────────────────
  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H);

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // ── Gridlines — left axis only (avoid double grid from dual axes) ─────────
  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yLeft).tickSize(-w).tickFormat(''))
    .call(grp => grp.select('.domain').remove());

  // ── X Axis ────────────────────────────────────────────────────────────────
  const xFmt = xIsDate
    ? label => d3.timeFormat('%b %Y')(new Date(label))
    : label => label;

  const maxTicks = Math.max(2, Math.floor(w / 60));
  const tickStep = Math.ceil(xLabels.length / maxTicks);
  const tickValues = xLabels.filter((_, i) => i % tickStep === 0);

  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(
      d3.axisBottom(xScale)
        .tickValues(tickValues)
        .tickFormat(xFmt)
        .tickSizeOuter(0)
    )
    .selectAll('text')
      .attr('transform', 'rotate(-35)')
      .style('text-anchor', 'end')
      .attr('dy', '0.35em')
      .attr('dx', '-0.5em');

  // ── Left Y Axis ───────────────────────────────────────────────────────────
  g.append('g')
    .attr('class', 'axis y-axis-left')
    .call(
      d3.axisLeft(yLeft)
        .ticks(6)
        .tickSizeOuter(0)
        .tickFormat(d3.format('~s'))
    );

  // ── Right Y Axis ──────────────────────────────────────────────────────────
  g.append('g')
    .attr('class', 'axis axis-right y-axis-right')
    .attr('transform', `translate(${w},0)`)
    .call(
      d3.axisRight(yRight)
        .ticks(6)
        .tickSizeOuter(0)
        .tickFormat(d3.format('~s'))
    );

  // ── Bars ──────────────────────────────────────────────────────────────────
  if (stacked) {
    // Stacked layers
    stackData.forEach((layer, i) => {
      g.selectAll(`.bar-layer-${i}`)
        .data(layer)
        .join('rect')
          .attr('class', 'bar')
          .attr('x', d => xScale(d.data.x))
          .attr('y', d => yLeft(d[1]))
          .attr('width', xScale.bandwidth())
          .attr('height', d => Math.max(0, yLeft(d[0]) - yLeft(d[1])))
          .attr('fill', stackColor(groups[i]));
    });
  } else {
    g.selectAll('.bar')
      .data(barData)
      .join('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.x))
        .attr('y', d => yLeft(d.value))
        .attr('width', xScale.bandwidth())
        .attr('height', d => Math.max(0, h - yLeft(d.value)))
        .attr('fill', BAR_COLOR);
  }

  // ── Line overlay ──────────────────────────────────────────────────────────
  const lineGen = d3.line()
    .x(d => xScale(d.x) + xScale.bandwidth() / 2)
    .y(d => yRight(d.value))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(lineData)
    .attr('class', 'combo-line')
    .attr('d', lineGen);

  // Dots on the line
  g.selectAll('.line-dot')
    .data(lineData)
    .join('circle')
      .attr('class', 'line-dot')
      .attr('cx', d => xScale(d.x) + xScale.bandwidth() / 2)
      .attr('cy', d => yRight(d.value))
      .attr('r', 3)
      .attr('fill', LINE_COLOR)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

  // ── Legend ────────────────────────────────────────────────────────────────
  const legendX = w + 10;
  const legend = g.append('g').attr('class', 'legend').attr('transform', `translate(${legendX}, 0)`);

  // Bar legend entry — rect icon
  const barLabel = stacked ? barFieldName : barFieldName;
  const barLegendRow = legend.append('g').attr('transform', 'translate(0, 0)');
  barLegendRow.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', 14).attr('height', 10)
    .attr('fill', stacked ? STACK_COLORS[0] : BAR_COLOR);
  barLegendRow.append('text')
    .attr('x', 20).attr('y', 9)
    .text(`${barLabel} (bars)`);

  // Line legend entry — line icon
  const lineLabel = lineFieldName;
  const lineLegendRow = legend.append('g').attr('transform', 'translate(0, 22)');
  lineLegendRow.append('line')
    .attr('x1', 0).attr('x2', 14)
    .attr('y1', 5).attr('y2', 5)
    .attr('stroke', LINE_COLOR)
    .attr('stroke-width', 2.5);
  lineLegendRow.append('circle')
    .attr('cx', 7).attr('cy', 5).attr('r', 3)
    .attr('fill', LINE_COLOR)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1);
  lineLegendRow.append('text')
    .attr('x', 20).attr('y', 9)
    .text(`${lineLabel} (line)`);

  // Stack group legend entries (when stacked, show all groups)
  if (stacked) {
    groups.forEach((grp, i) => {
      const row = legend.append('g').attr('transform', `translate(0, ${44 + i * 20})`);
      row.append('rect')
        .attr('x', 0).attr('y', 0)
        .attr('width', 14).attr('height', 10)
        .attr('fill', stackColor(grp));
      row.append('text')
        .attr('x', 20).attr('y', 9)
        .text(grp);
    });
  }

  // ── Crosshair + Tooltip ───────────────────────────────────────────────────
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0)
    .style('position', 'absolute')
    .style('left', '0px')
    .style('top', '0px');

  const crosshair = g.append('line')
    .attr('class', 'crosshair')
    .attr('y1', 0)
    .attr('y2', h)
    .style('display', 'none');

  const fmtNum = d3.format(',~f');
  const bandStep = xScale.step();

  g.append('rect')
    .attr('width', w)
    .attr('height', h)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .on('mousemove', function (event) {
      const [mx] = d3.pointer(event);

      // Nearest band — scaleBand has no .invert(), compute manually
      const bandIdx = Math.max(0, Math.min(
        xLabels.length - 1,
        Math.floor(mx / bandStep)
      ));
      const xLabel = xLabels[bandIdx];
      const cx = xScale(xLabel) + xScale.bandwidth() / 2;

      // Position crosshair
      crosshair
        .style('display', null)
        .attr('x1', cx)
        .attr('x2', cx);

      // Gather values
      const linePt = lineData.find(d => d.x === xLabel);
      const lineVal = linePt ? fmtNum(linePt.value) : 'N/A';

      let barHtml;
      if (stacked) {
        const breakdown = groups.map(grp => {
          const layer = stackData.find((_, i) => groups[i] === grp);
          const pt = layer ? layer.find(d => d.data.x === xLabel) : null;
          const val = pt ? fmtNum(pt[1] - pt[0]) : '0';
          return `<span style="color:${stackColor(grp)}">&#9632;</span>&nbsp;${grp}: <b>${val}</b>`;
        });
        barHtml = breakdown.join('<br>');
      } else {
        const barPt = barData.find(d => d.x === xLabel);
        const barVal = barPt ? fmtNum(barPt.value) : 'N/A';
        barHtml = `<span style="color:${BAR_COLOR}">&#9632;</span>&nbsp;${barFieldName}: <b>${barVal}</b>`;
      }

      const xDisplay = xIsDate
        ? d3.timeFormat('%b %Y')(new Date(xLabel))
        : xLabel;

      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${event.offsetY - 10}px`)
        .html(
          `<div class="tt-label">${xDisplay}</div>` +
          barHtml +
          `<br><span style="color:${LINE_COLOR}">&#9679;</span>&nbsp;` +
          `${lineFieldName}: <b>${lineVal}</b>`
        );
    })
    .on('mouseleave', () => {
      tooltip.style('opacity', 0);
      crosshair.style('display', 'none');
    });
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
```

- [x] **Step 3.2: Commit**

```bash
git add extensions/bar-line-combo/chart.js
git commit -m "feat: add D3 bar-line combo chart rendering logic with dual axes"
```

---

## Task 4: Standalone Test Page (`test.html`)

The `test.html` mocks the full Tableau Extensions API so you can verify the chart renders correctly in any browser without Tableau Desktop.

Mock data: 12 months of monthly revenue (bars, ~$80k–$200k) + growth rate % (line, ranges -5% to +20%, can be negative) — no `color` field in default mock (single-series bars).

**Files:**
- Create: `extensions/bar-line-combo/test.html`

- [x] **Step 4.1: Write test.html**

Create `extensions/bar-line-combo/test.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Bar-Line Combo — Browser Test</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      padding: 16px;
    }
    h2 {
      font-size: 14px;
      color: #555;
      margin-bottom: 12px;
    }
    #chart-wrapper {
      width: 100%;
      height: calc(100vh - 60px);
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
    }
    #chart { width: 100%; height: 100%; }
    #error { display: none; }
    #error:not(:empty) {
      display: block;
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #fff0f0;
      color: #c0392b;
      border: 1px solid #f5c6c6;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 13px;
    }
    /* Duplicate chart CSS from index.html */
    .grid line { stroke: #ebebeb; stroke-dasharray: 3 3; }
    .grid .domain { display: none; }
    .axis text { font-size: 11px; fill: #555; }
    .axis .domain { stroke: #ccc; }
    .axis .tick line { stroke: #ccc; }
    .axis-right text { fill: #e67e22; }
    .axis-right .domain { stroke: #e67e22; opacity: 0.5; }
    .axis-right .tick line { stroke: #e67e22; opacity: 0.4; }
    .bar { shape-rendering: crispEdges; }
    .combo-line { fill: none; stroke: #e67e22; stroke-width: 2.5px; }
    .crosshair { stroke: #999; stroke-width: 1px; stroke-dasharray: 4 3; pointer-events: none; }
    .tooltip {
      position: absolute;
      background: rgba(255,255,255,.96);
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 9px 13px;
      font-size: 12px;
      line-height: 1.7;
      pointer-events: none;
      box-shadow: 0 3px 10px rgba(0,0,0,.10);
      max-width: 240px;
    }
    .tooltip .tt-label { font-weight: 600; font-size: 13px; color: #222; margin-bottom: 4px; }
    .legend text { font-size: 12px; fill: #444; }
  </style>
</head>
<body>
  <h2>Bar-Line Combo Chart — Browser Test (no Tableau required)</h2>
  <div id="chart-wrapper">
    <div id="chart"></div>
    <div id="error"></div>
  </div>

  <script>
  // ─── Mock data: 12 months, Revenue (bars) + Growth Rate % (line) ──────────
  function generateMockData() {
    const months = [
      '2024-01-01','2024-02-01','2024-03-01','2024-04-01',
      '2024-05-01','2024-06-01','2024-07-01','2024-08-01',
      '2024-09-01','2024-10-01','2024-11-01','2024-12-01',
    ];

    // Simulate revenue with seasonal variation ($80k–$200k)
    const revenues = [
      98000, 112000, 134000, 145000,
      162000, 180000, 175000, 168000,
      155000, 143000, 158000, 195000,
    ];

    // Growth rate % vs prior month (can be negative)
    // First month has no prior — set to 0
    const growthRates = revenues.map((rev, i) => {
      if (i === 0) return 0;
      return +((rev - revenues[i - 1]) / revenues[i - 1] * 100).toFixed(1);
    });
    // growthRates: [0, 14.3, 19.6, 8.2, 11.7, 11.1, -2.8, -4.0, -7.7, -7.7, 10.5, 23.4]

    const rows = months.map((m, i) => [
      { value: m },
      { value: String(revenues[i]) },
      { value: String(growthRates[i]) },
    ]);
    return rows;
  }

  // ─── Mock Tableau Extensions API ──────────────────────────────────────────
  window.tableau = {
    TableauEventType: { SummaryDataChanged: 'summary-data-changed' },
    extensions: {
      initializeAsync: async () => {},
      worksheetContent: {
        worksheet: {
          addEventListener: () => {},
          getVisualSpecificationAsync: async () => ({
            marksSpecificationCollection: [{
              encodingCollection: [
                { id: 'x',    fieldCollection: [{ fieldName: 'Month' }] },
                { id: 'bar',  fieldCollection: [{ fieldName: 'Revenue' }] },
                { id: 'line', fieldCollection: [{ fieldName: 'Growth Rate %' }] },
                // color encoding intentionally absent — tests single-series bar path
              ]
            }]
          }),
          getSummaryDataReaderAsync: async () => ({
            getAllPagesAsync: async () => ({
              columns: [
                { fieldName: 'Month',          index: 0, dataType: 'date'  },
                { fieldName: 'Revenue',        index: 1, dataType: 'float' },
                { fieldName: 'Growth Rate %',  index: 2, dataType: 'float' },
              ],
              data: generateMockData(),
            }),
            releaseAsync: async () => {},
          }),
        }
      }
    }
  };
  </script>

  <!-- Load chart logic after mock is defined -->
  <script src="chart.js"></script>
</body>
</html>
```

- [x] **Step 4.2: Open test.html in a browser and verify**

Run a local server from the repo root:
```bash
python3 -m http.server 8080
```

Open: `http://localhost:8080/extensions/bar-line-combo/test.html`

Expected: 12 monthly bars (steel blue, taller for high-revenue months) with an orange line overlay showing growth rate %, which dips below zero for months with negative growth. Crosshair and tooltip appear on hover. Legend shows "Revenue (bars)" with a blue rect and "Growth Rate % (line)" with an orange line icon. Right Y axis labels are orange.

- [x] **Step 4.3: Commit**

```bash
git add extensions/bar-line-combo/test.html
git commit -m "feat: add browser test page with monthly revenue + growth rate mock data"
```

---

## Task 5: README (`README.md`)

**Files:**
- Create: `extensions/bar-line-combo/README.md`

- [x] **Step 5.1: Write README.md**

Create `extensions/bar-line-combo/README.md`:

```markdown
# Bar-Line Combo Chart — Tableau Viz Extension

A D3 v7 Tableau Viz Extension that renders a dual-axis combo chart: bars for a primary measure on the left Y axis and a line overlay for a secondary measure on the right Y axis.

## Live URLs

| Resource | URL |
|---|---|
| Extension page | `https://vj-cyntexa.github.io/tableau-viz/extensions/bar-line-combo/index.html` |
| Browser test | `https://vj-cyntexa.github.io/tableau-viz/extensions/bar-line-combo/test.html` |
| Production TREX | `extensions/bar-line-combo/bar-line-combo.trex` |
| Local dev TREX | `extensions/bar-line-combo/bar-line-combo-local.trex` |

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `x` | discrete-dimension | Yes | Date or categorical field for the X axis |
| `bar` | continuous-measure | Yes | Numeric measure rendered as bars (left Y axis) |
| `line` | continuous-measure | Yes | Numeric measure rendered as a line overlay (right Y axis) |
| `color` | discrete-dimension | No | If set, bars are stacked by this dimension |

## What Is and Isn't Configurable from Tableau's UI

**Configurable via encoding slots:**
- Which field drives X, bars, line, and stack grouping

**Not configurable (hardcoded):**
- Bar color: steel blue `#3498db` (single-series) or `d3.schemeTableau10` (stacked)
- Line color: orange `#e67e22`
- Bar opacity: 100%
- Line stroke width: 2.5px
- Stacking mode: always stacked when `color` is set (no grouped mode)
- Gridlines: left Y axis only

## File Descriptions

| File | Role |
|---|---|
| `index.html` | Extension shell loaded by Tableau in an iframe. Contains all CSS. |
| `chart.js` | All D3 rendering and Tableau API integration. No dependencies beyond D3 and the Extensions API. |
| `bar-line-combo.trex` | Production manifest pointing to GitHub Pages URL. |
| `bar-line-combo-local.trex` | Local dev manifest pointing to `localhost:8080`. |
| `test.html` | Standalone browser test with a mock Tableau API. 12 months of monthly revenue + growth rate %. No Tableau Desktop required. |

## Local Development

```bash
# From the repo root:
python3 -m http.server 8080

# Then open:
# http://localhost:8080/extensions/bar-line-combo/test.html
```

To load in Tableau Desktop:
1. Marks card → Viz Extensions → Access Local Extension
2. Select `extensions/bar-line-combo/bar-line-combo-local.trex`
3. Drag fields onto the encoding slots: X Axis, Bar Measure, Line Measure (Color is optional)

## Tableau Cloud Allowlist

To use the production extension on Tableau Cloud, add the GitHub Pages URL to the site's allowlist:

1. Tableau Cloud → Site Settings → Extensions
2. Add: `https://vj-cyntexa.github.io/tableau-viz/extensions/bar-line-combo/index.html`

## Notes

- **X axis date detection:** If all X values parse as valid `Date` objects, tick labels are formatted as `%b %Y` (e.g., `Jan 2024`). Otherwise, raw string values are shown.
- **Right Y axis range:** Auto-ranged with `d3.extent().nice()` — does not force 0, so negative line values (e.g., growth rate %) are displayed correctly.
- **Line aggregation when stacked:** When multiple rows share the same X value (due to the `color` grouping), line values are averaged per X category.
```

- [x] **Step 5.2: Commit**

```bash
git add extensions/bar-line-combo/README.md
git commit -m "docs: add README for bar-line-combo extension"
```

---

## Task 6: GitHub Pages, CLAUDE.md Update, Final Push

- [ ] **Step 6.1: Push all commits to remote**

```bash
git pull --rebase origin master && git push origin master
```

- [ ] **Step 6.2: Confirm GitHub Pages is enabled**

```bash
gh api repos/vj-cyntexa/tableau-viz/pages \
  -H "Accept: application/vnd.github+json" \
  | python3 -c "import sys,json; p=json.load(sys.stdin); print(p.get('html_url','NOT FOUND'))"
```

Expected output: `https://vj-cyntexa.github.io/tableau-viz`

If Pages is not yet enabled:
```bash
gh api repos/vj-cyntexa/tableau-viz/pages \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -f "source[branch]=master" \
  -f "source[path]=/"
```

- [ ] **Step 6.3: Verify Pages URL after build**

Wait 30–90 seconds for Pages to build, then open:

`https://vj-cyntexa.github.io/tableau-viz/extensions/bar-line-combo/test.html`

Expected: Same chart as the local test. If you see a 404, wait another minute and refresh.

- [ ] **Step 6.4: Add bar-line-combo section to CLAUDE.md**

Add the following block at the end of the `## Extensions` section in `CLAUDE.md`:

```markdown
### bar-line-combo

| Item | Value |
|---|---|
| Folder | `extensions/bar-line-combo/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/bar-line-combo/index.html` |
| Production TREX | `extensions/bar-line-combo/bar-line-combo.trex` |
| Local dev TREX | `extensions/bar-line-combo/bar-line-combo-local.trex` |
| Test page | `https://vj-cyntexa.github.io/tableau-viz/extensions/bar-line-combo/test.html` |
| README | `extensions/bar-line-combo/README.md` |

**Encodings:**
- `x` — Date or categorical dimension (1 field, required)
- `bar` — Primary numeric measure for bars, left Y axis (1 field, required)
- `line` — Secondary numeric measure for line overlay, right Y axis (1 field, required)
- `color` — Optional dimension for stacked bar grouping (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/bar-line-combo/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `bar-line-combo-local.trex`
```

- [ ] **Step 6.5: Commit and push CLAUDE.md update**

```bash
git add CLAUDE.md
git commit -m "docs: add bar-line-combo extension info to CLAUDE.md"
git pull --rebase origin master && git push origin master
```

---

## Self-Review Checklist

- [ ] `.trex` manifest defines all 4 encodings (`x`, `bar`, `line`, `color`) with correct role types
- [ ] `color` encoding has `min-count="0"` (optional); all others have `min-count="1" max-count="1"`
- [ ] `chart.js` always uses `d3.scaleBand()` for X — bars require bandwidth
- [ ] `chart.js` detects dates for tick label formatting, falls back to raw strings
- [ ] `chart.js` uses stacked bars when `color` is present, single bars otherwise
- [ ] Left Y axis starts at 0; right Y axis is auto-ranged (allows negatives)
- [ ] Gridlines rendered from left Y axis only — no double grid from dual axes
- [ ] Line values are averaged per X when multiple rows share the same X (stacked case)
- [ ] Legend: blue `<rect>` icon for bars, orange `<line>` icon for line
- [ ] Tooltip: crosshair line + X label + bar value(s) + line value
- [ ] `test.html` mocks all API methods used by `chart.js`
- [ ] Mock data: 12 months, revenue ($80k–$200k) + growth rate % (includes negatives)
- [ ] No `color` field in default mock — exercises single-series bar code path
- [ ] GitHub Pages URL in `bar-line-combo.trex` matches actual Pages URL
- [ ] `README.md` documents live URLs, encoding slots, configurable vs. hardcoded items, dev steps, Tableau Cloud allowlist instructions
- [ ] `CLAUDE.md` updated with extension details for future sessions
- [ ] All files committed before push
