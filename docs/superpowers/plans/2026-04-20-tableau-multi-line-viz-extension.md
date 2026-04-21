# Tableau Multi-Line Chart Viz Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a Tableau Viz Extension that renders a D3.js multi-line time-series chart, published to GitHub Pages, ready to load in Tableau Desktop via a `.trex` manifest.

**Architecture:** A pure HTML/JS extension (no build step) served from GitHub Pages. The extension registers three encoding slots in its `.trex` manifest (Date → X, Measure → Y, Dimension → Series/Color), reads live data from Tableau's Extensions API, and renders with D3 v7. A `test.html` page mocks the Tableau API so the chart can be developed and verified in any browser without Tableau Desktop.

**Tech Stack:** D3.js v7 (CDN), Tableau Extensions API 2.x (CDN), vanilla JS (ES2020), GitHub Pages

---

## File Map

| Path | Role |
|---|---|
| `extensions/multi-line-chart/index.html` | Extension shell loaded by Tableau in an iframe |
| `extensions/multi-line-chart/chart.js` | All D3 rendering + Tableau API integration |
| `extensions/multi-line-chart/multi-line-chart.trex` | Production manifest (GitHub Pages URL) |
| `extensions/multi-line-chart/multi-line-chart-local.trex` | Dev manifest (localhost:8080 URL) |
| `extensions/multi-line-chart/test.html` | Standalone browser test — mocks Tableau API with 3 series × 12 months |

---

## Task 1: Folder and TREX Manifests

**Files:**
- Create: `extensions/multi-line-chart/multi-line-chart.trex`
- Create: `extensions/multi-line-chart/multi-line-chart-local.trex`

- [ ] **Step 1.1: Create production manifest**

Create `extensions/multi-line-chart/multi-line-chart.trex`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.multilinechart" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Multi-line time-series chart built with D3.js</description>
    <author name="Cyntexa" organization="Cyntexa" website="https://cyntexa.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>https://vj-cyntexa.github.io/tableau-viz/extensions/multi-line-chart/index.html</url>
    </source-location>
    <icon/>
    <encoding id="x">
      <display-name resource-id="x_label">Date (X Axis)</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="y">
      <display-name resource-id="y_label">Value (Y Axis)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="color">
      <display-name resource-id="color_label">Series</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="0" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Multi-Line Chart</text></resource>
    <resource id="x_label"><text locale="en_US">Date (X Axis)</text></resource>
    <resource id="y_label"><text locale="en_US">Value (Y Axis)</text></resource>
    <resource id="color_label"><text locale="en_US">Series</text></resource>
  </resources>
</manifest>
```

- [ ] **Step 1.2: Create local dev manifest**

Create `extensions/multi-line-chart/multi-line-chart-local.trex` — identical to above except the `<url>`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.multilinechart.local" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Multi-line time-series chart built with D3.js (local dev)</description>
    <author name="Cyntexa" organization="Cyntexa" website="https://cyntexa.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>http://localhost:8080/extensions/multi-line-chart/index.html</url>
    </source-location>
    <icon/>
    <encoding id="x">
      <display-name resource-id="x_label">Date (X Axis)</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="y">
      <display-name resource-id="y_label">Value (Y Axis)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="color">
      <display-name resource-id="color_label">Series</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="0" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Multi-Line Chart (local)</text></resource>
    <resource id="x_label"><text locale="en_US">Date (X Axis)</text></resource>
    <resource id="y_label"><text locale="en_US">Value (Y Axis)</text></resource>
    <resource id="color_label"><text locale="en_US">Series</text></resource>
  </resources>
</manifest>
```

- [ ] **Step 1.3: Commit**

```bash
git add extensions/
git commit -m "feat: add .trex manifests for multi-line chart viz extension"
```

---

## Task 2: HTML Shell (`index.html`)

**Files:**
- Create: `extensions/multi-line-chart/index.html`

- [ ] **Step 2.1: Write index.html**

Create `extensions/multi-line-chart/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Multi-Line Chart</title>
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

    /* D3 chart styles */
    .grid line {
      stroke: #ebebeb;
      stroke-dasharray: 3 3;
    }
    .grid .domain { display: none; }

    .axis text {
      font-size: 11px;
      fill: #555;
    }
    .axis .domain { stroke: #ccc; }
    .axis .tick line { stroke: #ccc; }

    .series-line {
      fill: none;
      stroke-width: 2.5px;
    }

    .dot {
      r: 4;
    }

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
      max-width: 230px;
    }
    .tooltip .tt-date {
      font-weight: 600;
      font-size: 13px;
      color: #222;
      margin-bottom: 4px;
    }

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

- [ ] **Step 2.2: Verify the file is valid HTML**

Open `extensions/multi-line-chart/index.html` in a browser. You should see a blank white page with no console errors (the Tableau Extensions API will throw a benign init error since we're not inside Tableau — that's expected).

- [ ] **Step 2.3: Commit**

```bash
git add extensions/multi-line-chart/index.html
git commit -m "feat: add html shell for multi-line chart extension"
```

---

## Task 3: D3 Chart Logic (`chart.js`)

**Files:**
- Create: `extensions/multi-line-chart/chart.js`

- [ ] **Step 3.1: Write chart.js**

Create `extensions/multi-line-chart/chart.js`:

```javascript
'use strict';

// ─── Layout ───────────────────────────────────────────────────────────────────
const MARGIN = { top: 30, right: 160, bottom: 60, left: 75 };
const COLORS = d3.schemeTableau10;

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
// Returns: Array<{ name: string, values: Array<{ date: Date, value: number }> }>
function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  // Map encoding id → first field name
  function fieldName(encodingId) {
    const enc = encodings.find(e => e.id === encodingId);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const xField    = fieldName('x');
  const yField    = fieldName('y');
  const colorField = fieldName('color');

  // Build column index by field name
  const colIndex = Object.fromEntries(
    dataTable.columns.map(c => [c.fieldName, c.index])
  );

  if (!xField || !(xField in colIndex)) {
    throw new Error('Drag a Date dimension onto the "Date (X Axis)" encoding slot.');
  }
  if (!yField || !(yField in colIndex)) {
    throw new Error('Drag a numeric measure onto the "Value (Y Axis)" encoding slot.');
  }

  const xi = colIndex[xField];
  const yi = colIndex[yField];
  const ci = (colorField && colorField in colIndex) ? colIndex[colorField] : null;

  // Tableau date values: "2024-01-01" ISO string or full ISO datetime
  const parseDate = v => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const rows = dataTable.data
    .map(row => ({
      date:   parseDate(row[xi].value),
      value:  Number(row[yi].value),
      series: ci !== null ? String(row[ci].value) : 'Value',
    }))
    .filter(r => r.date !== null && !Number.isNaN(r.value));

  if (!rows.length) throw new Error('No valid rows found. Check field types on the encoding slots.');

  const grouped = d3.group(rows, d => d.series);
  return Array.from(grouped, ([name, values]) => ({
    name,
    values: values.sort((a, b) => a.date - b.date),
  }));
}

// ─── Drawing ─────────────────────────────────────────────────────────────────
function drawChart(series) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top - MARGIN.bottom;

  d3.select(container).selectAll('*').remove();

  if (!series.length) { container.textContent = 'No data.'; return; }

  // ── Scales ──────────────────────────────────────────────────────────────
  const allDates  = series.flatMap(s => s.values.map(d => d.date));
  const allValues = series.flatMap(s => s.values.map(d => d.value));

  const x = d3.scaleTime()
    .domain(d3.extent(allDates))
    .range([0, w]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(allValues) * 1.1])
    .nice()
    .range([h, 0]);

  const color = d3.scaleOrdinal()
    .domain(series.map(s => s.name))
    .range(COLORS);

  const lineGen = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.value))
    .curve(d3.curveMonotoneX);

  // ── SVG root ─────────────────────────────────────────────────────────────
  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H);

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // ── Gridlines ────────────────────────────────────────────────────────────
  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-w).tickFormat(''))
    .call(grp => grp.select('.domain').remove());

  // ── Axes ─────────────────────────────────────────────────────────────────
  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(
      d3.axisBottom(x)
        .ticks(Math.max(2, Math.floor(w / 80)))
        .tickSizeOuter(0)
    );

  g.append('g')
    .attr('class', 'axis y-axis')
    .call(
      d3.axisLeft(y)
        .ticks(6)
        .tickSizeOuter(0)
        .tickFormat(d3.format('~s'))
    );

  // ── Lines ─────────────────────────────────────────────────────────────────
  series.forEach(s => {
    g.append('path')
      .datum(s.values)
      .attr('class', 'series-line')
      .attr('stroke', color(s.name))
      .attr('d', lineGen);
  });

  // ── Legend ────────────────────────────────────────────────────────────────
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
      .text(s.name);
  });

  // ── Tooltip ───────────────────────────────────────────────────────────────
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0)
    .style('left', '0px')
    .style('top', '0px');

  const bisect  = d3.bisector(d => d.date).left;
  const fmtDate = d3.timeFormat('%b %d, %Y');
  const fmtNum  = d3.format(',~f');

  // Hover dots — one per series
  const dots = series.map(s =>
    g.append('circle')
      .attr('class', 'dot')
      .attr('fill', color(s.name))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('display', 'none')
  );

  // Invisible overlay to capture mouse events
  g.append('rect')
    .attr('width', w)
    .attr('height', h)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .on('mousemove', function (event) {
      const [mx] = d3.pointer(event);
      const hoverDate = x.invert(mx);

      // Closest data point per series
      const points = series.map((s, i) => {
        const idx = bisect(s.values, hoverDate, 1);
        const a = s.values[idx - 1];
        const b = s.values[idx];
        const pt = b && (hoverDate - a.date > b.date - hoverDate) ? b : a;
        if (pt) {
          dots[i]
            .style('display', null)
            .attr('cx', x(pt.date))
            .attr('cy', y(pt.value));
        }
        return { s, pt };
      });

      const lines = points
        .filter(({ pt }) => pt)
        .map(({ s, pt }) =>
          `<span style="color:${color(s.name)}">&#9679;</span>&nbsp;${s.name}: <b>${fmtNum(pt.value)}</b>`
        )
        .join('<br>');

      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 14}px`)
        .style('top',  `${event.offsetY - 10}px`)
        .html(`<div class="tt-date">${fmtDate(hoverDate)}</div>${lines}`);
    })
    .on('mouseleave', () => {
      tooltip.style('opacity', 0);
      dots.forEach(dot => dot.style('display', 'none'));
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

- [ ] **Step 3.2: Commit**

```bash
git add extensions/multi-line-chart/chart.js
git commit -m "feat: add D3 multi-line chart rendering logic"
```

---

## Task 4: Standalone Test Page (`test.html`)

The `test.html` mocks the full Tableau Extensions API so you can verify the chart renders correctly in any browser without Tableau Desktop.

**Files:**
- Create: `extensions/multi-line-chart/test.html`

- [ ] **Step 4.1: Write test.html**

Create `extensions/multi-line-chart/test.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Multi-Line Chart — Browser Test</title>
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
    /* Copy chart styles from index.html */
    .grid line { stroke: #ebebeb; stroke-dasharray: 3 3; }
    .grid .domain { display: none; }
    .axis text { font-size: 11px; fill: #555; }
    .axis .domain { stroke: #ccc; }
    .axis .tick line { stroke: #ccc; }
    .series-line { fill: none; stroke-width: 2.5px; }
    .dot { r: 4; }
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
      max-width: 230px;
    }
    .tooltip .tt-date { font-weight: 600; font-size: 13px; color: #222; margin-bottom: 4px; }
    .legend text { font-size: 12px; fill: #444; }
  </style>
</head>
<body>
  <h2>Multi-Line Chart — Browser Test (no Tableau required)</h2>
  <div id="chart-wrapper">
    <div id="chart"></div>
    <div id="error"></div>
  </div>

  <script>
  // ─── Mock Tableau Extensions API ──────────────────────────────────────────
  function generateMockData() {
    const series = [
      { name: 'APAC',     base: 42000, variance: 12000 },
      { name: 'EMEA',     base: 31000, variance: 9000  },
      { name: 'Americas', base: 55000, variance: 15000 },
    ];
    const rows = [];
    for (let m = 0; m < 24; m++) {
      const d = new Date(2024, m, 1);
      const dateStr = d.toISOString().split('T')[0];
      series.forEach(s => {
        const value = Math.round(s.base + (Math.random() - 0.4) * s.variance);
        rows.push([
          { value: dateStr },
          { value: String(value) },
          { value: s.name },
        ]);
      });
    }
    return rows;
  }

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
                { id: 'x',     fieldCollection: [{ fieldName: 'Order Date' }] },
                { id: 'y',     fieldCollection: [{ fieldName: 'Revenue'    }] },
                { id: 'color', fieldCollection: [{ fieldName: 'Region'     }] },
              ]
            }]
          }),
          getSummaryDataReaderAsync: async () => ({
            getAllPagesAsync: async () => ({
              columns: [
                { fieldName: 'Order Date', index: 0, dataType: 'date'   },
                { fieldName: 'Revenue',    index: 1, dataType: 'float'  },
                { fieldName: 'Region',     index: 2, dataType: 'string' },
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

- [ ] **Step 4.2: Open test.html in a browser and verify**

Run a local server from the repo root:
```bash
python3 -m http.server 8080
```

Open: `http://localhost:8080/extensions/multi-line-chart/test.html`

Expected: A multi-line D3 chart with 3 coloured lines (APAC, EMEA, Americas) over 24 months. Hovering shows a tooltip with date and values for all series. Legend visible on the right.

- [ ] **Step 4.3: Commit**

```bash
git add extensions/multi-line-chart/test.html
git commit -m "feat: add browser test page with mock Tableau API"
```

---

## Task 5: Enable GitHub Pages and Push

- [ ] **Step 5.1: Push all commits to remote**

```bash
git push origin master
```

- [ ] **Step 5.2: Enable GitHub Pages on the repo**

```bash
gh api repos/vj-cyntexa/tableau-viz/pages \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -f "source[branch]=master" \
  -f "source[path]=/"
```

Expected response contains `"status": "building"` and `"url": "https://vj-cyntexa.github.io/tableau-viz"`.

If Pages is already enabled this command returns `409 Conflict` — that's fine, skip to step 5.3.

- [ ] **Step 5.3: Confirm Pages URL**

```bash
gh api repos/vj-cyntexa/tableau-viz/pages \
  -H "Accept: application/vnd.github+json" \
  | python3 -c "import sys,json; p=json.load(sys.stdin); print(p.get('html_url',''))"
```

Expected output: `https://vj-cyntexa.github.io/tableau-viz`

- [ ] **Step 5.4: Wait for Pages build and verify**

GitHub Pages takes 30–90 seconds to build. After waiting, open:

`https://vj-cyntexa.github.io/tableau-viz/extensions/multi-line-chart/test.html`

Expected: The same chart you saw locally. If you see a 404, wait another minute and refresh.

---

## Task 6: Update CLAUDE.md with Extension Info

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 6.1: Add extension section to CLAUDE.md**

Add the following block at the end of `CLAUDE.md` under a new `## Extensions` heading:

```markdown
## Extensions

### multi-line-chart

| Item | Value |
|---|---|
| Folder | `extensions/multi-line-chart/` |
| Production URL | `https://vj-cyntexa.github.io/tableau-viz/extensions/multi-line-chart/index.html` |
| Production TREX | `extensions/multi-line-chart/multi-line-chart.trex` |
| Local dev TREX | `extensions/multi-line-chart/multi-line-chart-local.trex` |
| Test page | `extensions/multi-line-chart/test.html` |

**Encodings:**
- `x` — Date dimension (1 field, required)
- `y` — Numeric measure (1 field, required)
- `color` — Dimension for line grouping / series (1 field, optional)

**Dev workflow:**
1. `python3 -m http.server 8080` from repo root
2. Open `http://localhost:8080/extensions/multi-line-chart/test.html` to test in browser
3. In Tableau Desktop: Marks card → Viz Extensions → Access Local → `multi-line-chart-local.trex`

**To add a new extension:** copy the `multi-line-chart/` folder, update IDs in `.trex`, update the URL, and add it to this section.
```

- [ ] **Step 6.2: Commit and push**

```bash
git add CLAUDE.md
git commit -m "docs: add multi-line-chart extension info to CLAUDE.md"
git push origin master
```

---

## Self-Review Checklist

- [x] `.trex` manifest defines all 3 encodings (x, y, color) with correct role types
- [x] `chart.js` handles missing color encoding (falls back to single series "Value")
- [x] `chart.js` handles empty data rows with a user-facing error
- [x] `chart.js` handles missing encoding slots with descriptive error messages
- [x] `test.html` mocks all API methods used by `chart.js`
- [x] Mock data: 3 series × 24 months of realistic revenue figures
- [x] GitHub Pages URL in `multi-line-chart.trex` matches the actual Pages URL
- [x] `CLAUDE.md` updated with extension details for future sessions
- [x] All files committed before push
