# Venn Diagram Viz Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` syntax. Update to `- [x]` as each step completes.

**Goal:** Build and deploy a Tableau Viz Extension that renders a D3 v7 + venn.js Venn diagram showing customer overlap between loyalty segments (Gold, Silver, Platinum), published to GitHub Pages and loadable in Tableau Desktop via a `.trex` manifest.

**Architecture:** A pure HTML/JS extension (no build step) served from GitHub Pages. The extension registers three encoding slots in its `.trex` manifest (`sets`, `value`, `label`), reads live summary data from Tableau's Extensions API, splits the comma-separated `sets` column to build the venn.js data array, and renders with venn.js (layered on D3 v7). A `test.html` page mocks the full Tableau API so the chart can be developed and verified in any browser without Tableau Desktop.

**Tech Stack:** D3.js v7, venn.js, Tableau Extensions API 2.x, vanilla JS, GitHub Pages

---

## Progress Tracker
- [x] Task 1: TREX manifests
- [ ] Task 2: index.html
- [ ] Task 3: chart.js
- [ ] Task 4: test.html
- [ ] Task 5: README.md
- [ ] Task 6: Push all

---

## File Map

| Path | Role |
|---|---|
| `extensions/venn-diagram/venn-diagram.trex` | Production manifest (GitHub Pages URL) |
| `extensions/venn-diagram/venn-diagram-local.trex` | Local dev manifest (localhost:8080 URL) |
| `extensions/venn-diagram/index.html` | Extension shell loaded by Tableau in an iframe |
| `extensions/venn-diagram/chart.js` | Data parsing, venn.js rendering, tooltips |
| `extensions/venn-diagram/test.html` | Standalone browser test — mocks Tableau API with loyalty data |
| `extensions/venn-diagram/README.md` | Extension documentation |

---

## Task 1: TREX Manifests

**Files:**
- Create: `extensions/venn-diagram/venn-diagram.trex`
- Create: `extensions/venn-diagram/venn-diagram-local.trex`

- [x] **Step 1.1: Create production manifest**

Create `extensions/venn-diagram/venn-diagram.trex`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.venndiagram" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Venn diagram showing customer overlap between loyalty tiers, built with D3.js and venn.js</description>
    <author name="Cyntexa" email="vishwajeet@cyntexa.com" organization="Cyntexa" website="https://cyntexa.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>https://vj-cyntexa.github.io/tableau-viz/extensions/venn-diagram/index.html</url>
    </source-location>
    <icon/>
    <encoding id="sets">
      <display-name resource-id="sets_label">Sets (comma-separated for intersections)</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="value">
      <display-name resource-id="value_label">Value (Count / Size)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="label">
      <display-name resource-id="label_label">Label (optional, falls back to Sets)</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="0" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Venn Diagram</text></resource>
    <resource id="sets_label"><text locale="en_US">Sets (comma-separated for intersections)</text></resource>
    <resource id="value_label"><text locale="en_US">Value (Count / Size)</text></resource>
    <resource id="label_label"><text locale="en_US">Label (optional, falls back to Sets)</text></resource>
  </resources>
</manifest>
```

- [x] **Step 1.2: Create local dev manifest**

Create `extensions/venn-diagram/venn-diagram-local.trex` — identical to above except the extension id and `<url>`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.venndiagram.local" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Venn diagram showing customer overlap between loyalty tiers, built with D3.js and venn.js</description>
    <author name="Cyntexa" email="vishwajeet@cyntexa.com" organization="Cyntexa" website="https://cyntexa.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>http://localhost:8080/extensions/venn-diagram/index.html</url>
    </source-location>
    <icon/>
    <encoding id="sets">
      <display-name resource-id="sets_label">Sets (comma-separated for intersections)</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="value">
      <display-name resource-id="value_label">Value (Count / Size)</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields min-count="1" max-count="1"/>
    </encoding>
    <encoding id="label">
      <display-name resource-id="label_label">Label (optional, falls back to Sets)</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="0" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Venn Diagram (local)</text></resource>
    <resource id="sets_label"><text locale="en_US">Sets (comma-separated for intersections)</text></resource>
    <resource id="value_label"><text locale="en_US">Value (Count / Size)</text></resource>
    <resource id="label_label"><text locale="en_US">Label (optional, falls back to Sets)</text></resource>
  </resources>
</manifest>
```

---

## Task 2: index.html

**File:** `extensions/venn-diagram/index.html`

- [ ] **Step 2.1: Create the extension shell HTML**

Create `extensions/venn-diagram/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Venn Diagram</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://cdn.jsdelivr.net/npm/venn.js@0.2.20/build/venn.js"></script>
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

    /* venn.js circle/intersection regions */
    #chart .venntooltip {
      display: none; /* we use our own tooltip */
    }

    /* Make venn.js circle paths semi-transparent */
    #chart svg .venn-circle path {
      fill-opacity: 0.20;
      stroke-width: 2;
    }

    #chart svg .venn-circle path:hover,
    #chart svg .venn-circle.hover path {
      fill-opacity: 0.40;
      cursor: pointer;
    }

    #chart svg .venn-intersection path {
      fill-opacity: 0;
    }

    #chart svg .venn-intersection path:hover,
    #chart svg .venn-intersection.hover path {
      fill-opacity: 0.15;
      cursor: pointer;
    }

    /* Labels inside each region */
    #chart svg text.venn-label-name {
      font-size: 14px;
      font-weight: 600;
      fill: #333;
      pointer-events: none;
    }

    #chart svg text.venn-label-count {
      font-size: 12px;
      fill: #555;
      pointer-events: none;
    }

    /* Tooltip */
    .tooltip {
      position: absolute;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 9px 13px;
      font-size: 13px;
      line-height: 1.6;
      pointer-events: none;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.10);
      max-width: 240px;
      display: none;
    }

    .tooltip .tt-title {
      font-weight: 600;
      font-size: 14px;
      color: #222;
      margin-bottom: 3px;
    }

    /* Error banner */
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
  <div id="chart"></div>
  <div class="tooltip" id="tooltip"></div>
  <div id="error"></div>
  <script src="chart.js"></script>
</body>
</html>
```

---

## Task 3: chart.js

**File:** `extensions/venn-diagram/chart.js`

- [ ] **Step 3.1: Create chart.js with full Tableau API integration and venn.js rendering**

Create `extensions/venn-diagram/chart.js`:

```javascript
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
```

---

## Task 4: test.html

**File:** `extensions/venn-diagram/test.html`

- [ ] **Step 4.1: Create standalone browser test page**

Create `extensions/venn-diagram/test.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Venn Diagram — Browser Test</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://cdn.jsdelivr.net/npm/venn.js@0.2.20/build/venn.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }

    h2 {
      font-size: 16px;
      font-weight: 600;
      color: #333;
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

    #chart {
      width: 100%;
      height: 100%;
      position: relative;
    }

    /* Mirror chart.js styles */
    #chart svg .venn-circle path {
      fill-opacity: 0.20;
      stroke-width: 2;
    }

    #chart svg .venn-circle path:hover,
    #chart svg .venn-circle.hover path {
      fill-opacity: 0.40;
      cursor: pointer;
    }

    #chart svg .venn-intersection path {
      fill-opacity: 0;
    }

    #chart svg .venn-intersection path:hover,
    #chart svg .venn-intersection.hover path {
      fill-opacity: 0.15;
      cursor: pointer;
    }

    #chart svg text.venn-label-name {
      font-size: 14px;
      font-weight: 600;
      fill: #333;
      pointer-events: none;
    }

    #chart svg text.venn-label-count {
      font-size: 12px;
      fill: #555;
      pointer-events: none;
    }

    .tooltip {
      position: absolute;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 9px 13px;
      font-size: 13px;
      line-height: 1.6;
      pointer-events: none;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.10);
      max-width: 240px;
      display: none;
    }

    .tooltip .tt-title {
      font-weight: 600;
      font-size: 14px;
      color: #222;
      margin-bottom: 3px;
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
  </style>
</head>
<body>
  <h2>Venn Diagram — Browser Test (no Tableau required)</h2>
  <div id="chart-wrapper">
    <div id="chart"></div>
    <div class="tooltip" id="tooltip"></div>
    <div id="error"></div>
  </div>
  <script>
    /* ── Loyalty customer mock data ─────────────────────────────────────────
     *
     * 7 regions covering a full 3-set Venn diagram:
     *   Singletons:   Gold=500, Silver=800, Platinum=300
     *   Pairwise:     Gold∩Silver=200, Gold∩Platinum=100, Silver∩Platinum=150
     *   Triple:       Gold∩Silver∩Platinum=50
     *
     * Constraints respected: pairwise ≤ min(singleton pair); triple ≤ min(pairwise).
     */
    (function () {
      const columns = [
        { fieldName: 'Loyalty Segment', index: 0, dataType: 'string' },
        { fieldName: 'Customer Count',  index: 1, dataType: 'integer' },
      ];

      const rows = [
        [{ value: 'Gold'                  }, { value: '500' }],
        [{ value: 'Silver'                }, { value: '800' }],
        [{ value: 'Platinum'              }, { value: '300' }],
        [{ value: 'Gold,Silver'           }, { value: '200' }],
        [{ value: 'Gold,Platinum'         }, { value: '100' }],
        [{ value: 'Silver,Platinum'       }, { value: '150' }],
        [{ value: 'Gold,Silver,Platinum'  }, { value: '50'  }],
      ];

      const dataTable = { columns, data: rows };

      /* ── vizSpec structure expected by chart.js ──────────────────────── */
      const vizSpec = {
        marksSpecificationCollection: [
          {
            encodingCollection: [
              { id: 'sets',  fieldCollection: [{ fieldName: 'Loyalty Segment' }] },
              { id: 'value', fieldCollection: [{ fieldName: 'Customer Count'  }] },
              // label encoding is optional; omit to let chart.js fall back to sets
            ],
          },
        ],
      };

      /* ── window.tableau mock ─────────────────────────────────────────── */
      window.tableau = {
        TableauEventType: {
          SummaryDataChanged: 'summary-data-changed',
        },

        extensions: {
          initializeAsync() {
            return Promise.resolve();
          },

          worksheetContent: {
            worksheet: {
              addEventListener(type, cb) {
                // no-op: no live Tableau session to subscribe to
              },

              getVisualSpecificationAsync() {
                return Promise.resolve(vizSpec);
              },

              getSummaryDataReaderAsync(/* _pageRowCount, _options */) {
                return Promise.resolve({
                  getAllPagesAsync() {
                    return Promise.resolve(dataTable);
                  },
                  releaseAsync() {
                    return Promise.resolve();
                  },
                });
              },
            },
          },
        },
      };
    })();
  </script>
  <script src="chart.js"></script>
</body>
</html>
```

---

## Task 5: README.md

**File:** `extensions/venn-diagram/README.md`

- [ ] **Step 5.1: Create README**

Create `extensions/venn-diagram/README.md`:

```markdown
# Venn Diagram — Tableau Viz Extension

A D3 v7 + venn.js Tableau Viz Extension that renders a Venn diagram showing customer overlap between loyalty tiers (Gold, Silver, Platinum). Customers can belong to multiple tiers simultaneously; the diagram visualizes how many are in each tier alone, how many overlap between pairs, and how many are in all three.

**Live URL:** https://vj-cyntexa.github.io/tableau-viz/extensions/venn-diagram/index.html

---

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `Sets` | Discrete dimension | Yes | Set name(s). Use comma-separated values for intersections (e.g. `Gold,Silver`) |
| `Value` | Continuous measure | Yes | Count or size for each segment |
| `Label` | Discrete dimension | No | Display label inside the region; falls back to the Sets field |

---

## Data Format

Each row in the Tableau data source represents one segment of the Venn diagram:

| Loyalty Segment (Sets) | Customer Count (Value) |
|---|---|
| Gold | 500 |
| Silver | 800 |
| Platinum | 300 |
| Gold,Silver | 200 |
| Gold,Platinum | 100 |
| Silver,Platinum | 150 |
| Gold,Silver,Platinum | 50 |

Intersection rows use a comma-separated string in the `Sets` field. The extension splits on commas and passes the resulting array to venn.js.

---

## Usage in Tableau Desktop

1. Open a Tableau workbook and switch to a sheet.
2. Set up a calculated field or use an existing dimension that has set labels (e.g. `Gold`, `Gold,Silver`).
3. Add a **Viz Extension** object to the dashboard or use the **Worksheet > Insert > Extension** menu.
4. Load `venn-diagram.trex` (production) or `venn-diagram-local.trex` (local dev at `localhost:8080`).
5. Drag the sets dimension onto the **Sets** slot, a count measure onto the **Value** slot, and optionally a label dimension onto the **Label** slot.

---

## Local Development

```bash
# Serve from repo root
npx serve . -p 8080

# Then open in browser (no Tableau needed):
open http://localhost:8080/extensions/venn-diagram/test.html

# Load in Tableau Desktop using:
# extensions/venn-diagram/venn-diagram-local.trex
```

---

## Files

| File | Description |
|---|---|
| `venn-diagram.trex` | Production manifest pointing to GitHub Pages |
| `venn-diagram-local.trex` | Local dev manifest pointing to localhost:8080 |
| `index.html` | Extension shell (loads D3, venn.js, Tableau Extensions API) |
| `chart.js` | Data parsing, venn.js rendering, tooltips, resize handling |
| `test.html` | Standalone browser test — full loyalty mock data, no Tableau needed |

---

## Tech Stack

- [D3.js v7](https://d3js.org/)
- [venn.js 0.2.20](https://github.com/benfred/venn.js) — circle layout and intersection positioning on top of D3
- [Tableau Extensions API 2.x](https://tableau.github.io/extensions-api/)
- Vanilla JS (ES2020), no build step
- GitHub Pages

---

## Author

**Cyntexa** — vishwajeet@cyntexa.com
```

---

## Task 6: Push All

- [ ] **Step 6.1: Create the extensions/venn-diagram directory and add all files**

```bash
mkdir -p extensions/venn-diagram
```

Then create all five files listed in the File Map above (Tasks 1–5).

- [ ] **Step 6.2: Stage and commit**

```bash
git add extensions/venn-diagram/venn-diagram.trex \
        extensions/venn-diagram/venn-diagram-local.trex \
        extensions/venn-diagram/index.html \
        extensions/venn-diagram/chart.js \
        extensions/venn-diagram/test.html \
        extensions/venn-diagram/README.md
git commit -m "feat: venn-diagram viz extension (loyalty customer overlap)"
```

- [ ] **Step 6.3: Push to origin master**

```bash
git pull --rebase origin master && git push origin master
```

---

## Notes for Implementers

**venn.js + D3 v7 compatibility:** venn.js@0.2.20 was written against D3 v4 but renders correctly with D3 v7 for `VennDiagram()` usage. Do not use deprecated D3 v3/v4 APIs (`d3.nest`, `d3.scale.linear`) in your own code — use D3 v7 APIs throughout.

**Label rendering:** venn.js renders a built-in `<text>` element with the set name. `chart.js` removes it and replaces it with two `<tspan>` elements — one for the name and one for the count — anchored to the path's bounding box centroid.

**Tooltip attachment:** Hover handlers are applied to `g.venn-circle` and `g.venn-intersection` groups after `.call(chart)` has rendered them into the DOM.

**Resize:** `chart.js` registers a debounced `window.resize` listener that calls `drawChart(vennData)` with the cached data. This re-creates the SVG at the new dimensions.

**Color intersections:** Intersection region fills are computed by averaging the RGB values of the constituent singleton set colors from `d3.schemeTableau10`.
