# Venn Diagram Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use `- [ ]` syntax. Update to `- [x]` as each step completes.

**Goal:** Extend the existing venn-diagram Tableau Viz Extension with: (1) a `group` encoding slot that tiles multiple Venn diagrams in a responsive panel grid; (2) a dynamic color-picker toolbar that lets the user customize each circle's fill; (3) improved label sizing and panel typography; and (4) updated test.html mock showing 2 loyalty programmes × 3 tiers each with full intersection data.

**Architecture:** Same no-build-step GitHub Pages architecture. `chart.js` owns all state. On each full render cycle it parses rows, groups them by the `group` field (or into a single `__all__` sentinel group when the field is absent), builds a `Map<groupName, vennData[]>`, stores it in module-level `cachedGroups`, then calls `drawAll(cachedGroups)`. `drawAll` injects color pickers into `#toolbar` (preserving prior user color choices), clears `#panels`, and calls `renderPanel(groupName, vennData, containerDiv, colorMap)` for each group. Color picker `input` events update module-level `colorState` and call `drawAll(cachedGroups)` without re-fetching from Tableau. A single debounced `resize` listener (registered once at module scope) also calls `drawAll(cachedGroups)`.

**Tech Stack:** D3.js v7, venn.js 0.2.20, Tableau Extensions API 2.x, vanilla JS (ES2020), GitHub Pages

---

## Progress Tracker
- [ ] Task 1: TREX manifests (add `group` encoding slot)
- [ ] Task 2: index.html (add `#toolbar` and `#panels` divs, new CSS)
- [ ] Task 3: test.html (richer mock data, add `#toolbar` and `#panels`, group encoding)
- [ ] Task 4: chart.js (full rewrite — grouped panels, color toolbar, module-level state)
- [ ] Task 5: README.md (document new encoding slot and color controls)
- [ ] Task 6: Commit and push

---

## File Map

| Path | Role |
|---|---|
| `extensions/venn-diagram/venn-diagram.trex` | Production manifest — GitHub Pages URL, 4 encoding slots |
| `extensions/venn-diagram/venn-diagram-local.trex` | Local dev manifest — localhost:8080, 4 encoding slots |
| `extensions/venn-diagram/index.html` | Extension shell — adds `#toolbar` and `#panels` divs |
| `extensions/venn-diagram/test.html` | Standalone test — 2 programmes × 3 tiers, mock `group` encoding |
| `extensions/venn-diagram/chart.js` | Full rewrite — multi-panel, color toolbar, module-level state |
| `extensions/venn-diagram/README.md` | Updated docs — new encoding slot and color controls |

---

## Task 1: TREX Manifests

**Files:**
- Overwrite: `extensions/venn-diagram/venn-diagram.trex`
- Overwrite: `extensions/venn-diagram/venn-diagram-local.trex`

Add a new `group` encoding slot (optional discrete dimension, 0–1 fields) after the existing `label` slot in both manifests. Bump `extension-version` to `1.1.0`.

- [ ] **Step 1.1: Overwrite production manifest**

Overwrite `extensions/venn-diagram/venn-diagram.trex` with the complete file below:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.venndiagram" extension-version="1.1.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Venn diagram showing customer overlap between loyalty tiers, built with D3.js and venn.js. Supports multi-panel grouped view and per-circle color controls.</description>
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
    <encoding id="group">
      <display-name resource-id="group_label">Group (optional — each value gets its own panel)</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="0" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Venn Diagram</text></resource>
    <resource id="sets_label"><text locale="en_US">Sets (comma-separated for intersections)</text></resource>
    <resource id="value_label"><text locale="en_US">Value (Count / Size)</text></resource>
    <resource id="label_label"><text locale="en_US">Label (optional, falls back to Sets)</text></resource>
    <resource id="group_label"><text locale="en_US">Group (optional — each value gets its own panel)</text></resource>
  </resources>
</manifest>
```

- [ ] **Step 1.2: Overwrite local dev manifest**

Overwrite `extensions/venn-diagram/venn-diagram-local.trex` with the complete file below (only the `id` and `<url>` differ):

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.cyntexa.venndiagram.local" extension-version="1.1.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>Venn diagram showing customer overlap between loyalty tiers, built with D3.js and venn.js. Supports multi-panel grouped view and per-circle color controls.</description>
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
    <encoding id="group">
      <display-name resource-id="group_label">Group (optional — each value gets its own panel)</display-name>
      <role-spec><role-type>discrete-dimension</role-type></role-spec>
      <fields min-count="0" max-count="1"/>
    </encoding>
  </worksheet-extension>
  <resources>
    <resource id="name"><text locale="en_US">Venn Diagram (local)</text></resource>
    <resource id="sets_label"><text locale="en_US">Sets (comma-separated for intersections)</text></resource>
    <resource id="value_label"><text locale="en_US">Value (Count / Size)</text></resource>
    <resource id="label_label"><text locale="en_US">Label (optional, falls back to Sets)</text></resource>
    <resource id="group_label"><text locale="en_US">Group (optional — each value gets its own panel)</text></resource>
  </resources>
</manifest>
```

---

## Task 2: index.html

**File:** `extensions/venn-diagram/index.html`

Add a `#toolbar` div above a `#panels` div. Remove the old `#chart` div (chart.js no longer uses it). Add CSS for the toolbar, panels grid, panel cards, and updated venn labels.

- [ ] **Step 2.1: Overwrite index.html**

Overwrite `extensions/venn-diagram/index.html` with the complete file below:

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
      background: #f8f9fa;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Toolbar ─────────────────────────────────────────────────────────── */
    #toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 18px;
      padding: 8px 16px;
      background: #ffffff;
      border-bottom: 1px solid #e0e0e0;
      min-height: 44px;
      flex-shrink: 0;
    }

    #toolbar:empty {
      display: none;
    }

    #toolbar label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: #444;
      cursor: pointer;
      white-space: nowrap;
    }

    #toolbar input[type="color"] {
      width: 26px;
      height: 26px;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 1px;
      cursor: pointer;
      background: none;
    }

    /* ── Panels grid ─────────────────────────────────────────────────────── */
    #panels {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
      padding: 16px;
      overflow-y: auto;
      align-content: start;
    }

    .venn-panel {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      min-height: 360px;
      overflow: hidden;
    }

    .panel-title {
      font-size: 13px;
      font-weight: 600;
      color: #333;
      padding: 10px 14px 0 14px;
      flex-shrink: 0;
      letter-spacing: 0.01em;
    }

    .panel-title:empty {
      display: none;
    }

    .panel-chart {
      flex: 1;
      position: relative;
      min-height: 300px;
    }

    /* ── Venn region styles ───────────────────────────────────────────────── */
    .panel-chart svg .venn-circle path {
      fill-opacity: 0.22;
      stroke-width: 2.5;
    }

    .panel-chart svg .venn-circle path:hover,
    .panel-chart svg .venn-circle.hover path {
      fill-opacity: 0.42;
      cursor: pointer;
    }

    .panel-chart svg .venn-intersection path {
      fill-opacity: 0;
    }

    .panel-chart svg .venn-intersection path:hover,
    .panel-chart svg .venn-intersection.hover path {
      fill-opacity: 0.18;
      cursor: pointer;
    }

    /* ── Labels ──────────────────────────────────────────────────────────── */
    .panel-chart svg .venn-label-name {
      font-size: 15px;
      font-weight: 700;
      fill: #222;
      pointer-events: none;
    }

    .panel-chart svg .venn-label-count {
      font-size: 13px;
      fill: #555;
      pointer-events: none;
    }

    /* ── Tooltip ─────────────────────────────────────────────────────────── */
    .tooltip {
      position: fixed;
      background: rgba(255, 255, 255, 0.97);
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 9px 13px;
      font-size: 13px;
      line-height: 1.6;
      pointer-events: none;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.12);
      max-width: 240px;
      display: none;
      z-index: 999;
    }

    .tooltip .tt-title {
      font-weight: 600;
      font-size: 14px;
      color: #222;
      margin-bottom: 3px;
    }

    /* ── Error banner ─────────────────────────────────────────────────────── */
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
  <div id="toolbar"></div>
  <div id="panels"></div>
  <div class="tooltip" id="tooltip"></div>
  <div id="error"></div>
  <script src="chart.js"></script>
</body>
</html>
```

---

## Task 3: test.html

**File:** `extensions/venn-diagram/test.html`

Replace with two loyalty programmes (Programme A and Programme B), each with Gold/Silver/Platinum tiers, 7 rows per programme (3 singletons + 3 pairs + 1 triple). The mock `vizSpec` exposes the `group` encoding. Add `#toolbar` and `#panels` divs. Mirror the CSS from the updated `index.html`.

- [ ] **Step 3.1: Overwrite test.html**

Overwrite `extensions/venn-diagram/test.html` with the complete file below:

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
      background: #f8f9fa;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Page header ──────────────────────────────────────────────────────── */
    .page-header {
      font-size: 13px;
      font-weight: 600;
      color: #666;
      padding: 8px 16px 0 16px;
      flex-shrink: 0;
    }

    /* ── Toolbar ─────────────────────────────────────────────────────────── */
    #toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 18px;
      padding: 8px 16px;
      background: #ffffff;
      border-bottom: 1px solid #e0e0e0;
      min-height: 44px;
      flex-shrink: 0;
    }

    #toolbar:empty {
      display: none;
    }

    #toolbar label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: #444;
      cursor: pointer;
      white-space: nowrap;
    }

    #toolbar input[type="color"] {
      width: 26px;
      height: 26px;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 1px;
      cursor: pointer;
      background: none;
    }

    /* ── Panels grid ─────────────────────────────────────────────────────── */
    #panels {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
      padding: 16px;
      overflow-y: auto;
      align-content: start;
    }

    .venn-panel {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      min-height: 360px;
      overflow: hidden;
    }

    .panel-title {
      font-size: 13px;
      font-weight: 600;
      color: #333;
      padding: 10px 14px 0 14px;
      flex-shrink: 0;
      letter-spacing: 0.01em;
    }

    .panel-title:empty {
      display: none;
    }

    .panel-chart {
      flex: 1;
      position: relative;
      min-height: 300px;
    }

    /* ── Venn region styles ───────────────────────────────────────────────── */
    .panel-chart svg .venn-circle path {
      fill-opacity: 0.22;
      stroke-width: 2.5;
    }

    .panel-chart svg .venn-circle path:hover,
    .panel-chart svg .venn-circle.hover path {
      fill-opacity: 0.42;
      cursor: pointer;
    }

    .panel-chart svg .venn-intersection path {
      fill-opacity: 0;
    }

    .panel-chart svg .venn-intersection path:hover,
    .panel-chart svg .venn-intersection.hover path {
      fill-opacity: 0.18;
      cursor: pointer;
    }

    /* ── Labels ──────────────────────────────────────────────────────────── */
    .panel-chart svg .venn-label-name {
      font-size: 15px;
      font-weight: 700;
      fill: #222;
      pointer-events: none;
    }

    .panel-chart svg .venn-label-count {
      font-size: 13px;
      fill: #555;
      pointer-events: none;
    }

    /* ── Tooltip ─────────────────────────────────────────────────────────── */
    .tooltip {
      position: fixed;
      background: rgba(255, 255, 255, 0.97);
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 9px 13px;
      font-size: 13px;
      line-height: 1.6;
      pointer-events: none;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.12);
      max-width: 240px;
      display: none;
      z-index: 999;
    }

    .tooltip .tt-title {
      font-weight: 600;
      font-size: 14px;
      color: #222;
      margin-bottom: 3px;
    }

    /* ── Error banner ─────────────────────────────────────────────────────── */
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
  <div class="page-header">Venn Diagram — Browser Test (no Tableau required)</div>
  <div id="toolbar"></div>
  <div id="panels"></div>
  <div class="tooltip" id="tooltip"></div>
  <div id="error"></div>

  <script>
    /* ── Mock data: 2 Loyalty Programmes × 3 Tiers (Gold, Silver, Platinum) ──
     *
     * Both programmes use the same tier names so the toolbar shows 3 color
     * pickers (Gold, Silver, Platinum) that simultaneously affect both panels.
     *
     * Each programme has 7 rows:
     *   3 singletons  + 3 pairwise intersections + 1 triple intersection
     *
     * Programme A (larger membership base):
     *   Gold=600, Silver=950, Platinum=380
     *   Gold∩Silver=230, Gold∩Platinum=120, Silver∩Platinum=180, G∩S∩P=60
     *
     * Programme B (smaller / newer programme):
     *   Gold=310, Silver=520, Platinum=195
     *   Gold∩Silver=110, Gold∩Platinum=55, Silver∩Platinum=90, G∩S∩P=28
     */
    (function () {
      const columns = [
        { fieldName: 'Programme',       index: 0, dataType: 'string'  },
        { fieldName: 'Loyalty Segment', index: 1, dataType: 'string'  },
        { fieldName: 'Customer Count',  index: 2, dataType: 'integer' },
      ];

      const rows = [
        // Programme A
        [{ value: 'Programme A' }, { value: 'Gold'                 }, { value: '600'  }],
        [{ value: 'Programme A' }, { value: 'Silver'               }, { value: '950'  }],
        [{ value: 'Programme A' }, { value: 'Platinum'             }, { value: '380'  }],
        [{ value: 'Programme A' }, { value: 'Gold,Silver'          }, { value: '230'  }],
        [{ value: 'Programme A' }, { value: 'Gold,Platinum'        }, { value: '120'  }],
        [{ value: 'Programme A' }, { value: 'Silver,Platinum'      }, { value: '180'  }],
        [{ value: 'Programme A' }, { value: 'Gold,Silver,Platinum' }, { value: '60'   }],
        // Programme B
        [{ value: 'Programme B' }, { value: 'Gold'                 }, { value: '310'  }],
        [{ value: 'Programme B' }, { value: 'Silver'               }, { value: '520'  }],
        [{ value: 'Programme B' }, { value: 'Platinum'             }, { value: '195'  }],
        [{ value: 'Programme B' }, { value: 'Gold,Silver'          }, { value: '110'  }],
        [{ value: 'Programme B' }, { value: 'Gold,Platinum'        }, { value: '55'   }],
        [{ value: 'Programme B' }, { value: 'Silver,Platinum'      }, { value: '90'   }],
        [{ value: 'Programme B' }, { value: 'Gold,Silver,Platinum' }, { value: '28'   }],
      ];

      const dataTable = { columns, data: rows };

      const vizSpec = {
        marksSpecificationCollection: [
          {
            encodingCollection: [
              { id: 'group', fieldCollection: [{ fieldName: 'Programme'       }] },
              { id: 'sets',  fieldCollection: [{ fieldName: 'Loyalty Segment' }] },
              { id: 'value', fieldCollection: [{ fieldName: 'Customer Count'  }] },
            ],
          },
        ],
      };

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
              addEventListener(type, cb) {},
              getVisualSpecificationAsync() {
                return Promise.resolve(vizSpec);
              },
              getSummaryDataReaderAsync() {
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

## Task 4: chart.js

**File:** `extensions/venn-diagram/chart.js`

Complete rewrite. Key design decisions:
- Module-level `cachedGroups` (Map) and `colorState` (Map) persist across renders.
- Color picker `input` handler only redraws — never re-fetches.
- Single `resize` listener registered at module scope (never duplicated).
- `allSetNames` collected via `flatMap(d => d.sets)` across all groups — covers sets that only appear in intersection rows.
- `renderPanel` receives the `colorMap` and reads `.panel-chart` dimensions after DOM insertion.
- Tooltip uses `position: fixed` with `event.clientX / event.clientY` so it works across the scrollable grid.
- When `groupName === '__all__'`, the `.panel-title` is left empty (hidden via CSS `:empty` rule).

- [ ] **Step 4.1: Overwrite chart.js**

Overwrite `extensions/venn-diagram/chart.js` with the complete file below:

```javascript
'use strict';

// ── D3 Tableau10 color palette ────────────────────────────────────────────────
const PALETTE = d3.schemeTableau10;

// ── Module-level state ────────────────────────────────────────────────────────
let cachedGroups = null;
const colorState = new Map();

// ── One-time resize listener (debounced) ──────────────────────────────────────
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (cachedGroups) drawAll(cachedGroups);
  }, 150);
});

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
    cachedGroups = parseTableauData(dataTable, vizSpec);
    drawAll(cachedGroups);
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
// Returns Map<groupName, vennRow[]>
// vennRow: { sets: string[], size: number, label: string }
// If `group` encoding absent, all rows go into '__all__'.

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
      : setNames.join(' \u2229 ');

    const groupName = gi !== null ? String(row[gi].value).trim() : '__all__';

    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push({ sets: setNames, size, label });
  }

  if (!groups.size) {
    throw new Error('No valid rows found. Check field types on the encoding slots.');
  }

  return groups;
}

// ── Draw all panels ────────────────────────────────────────────────────────────

function drawAll(groups) {
  // Collect all unique set names across all groups
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

  // Reconcile colorState: keep user choices, assign defaults for new sets
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

  // Rebuild toolbar
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

  // Clear panels and render one per group
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

// ── Render a single Venn panel ─────────────────────────────────────────────────

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

  // Apply colors to circle paths
  vennGroup.selectAll('g.venn-circle')
    .each(function (d) {
      const color = colorMap.get(d.sets[0]) || '#888888';
      d3.select(this).select('path')
        .style('fill', color)
        .style('stroke', color);
    });

  // Intersection fills: average RGB of constituent sets
  vennGroup.selectAll('g.venn-intersection')
    .each(function (d) {
      const colors = d.sets.map(name => d3.color(colorMap.get(name) || '#888888'));
      const blended = blendColors(colors);
      d3.select(this).select('path')
        .style('fill', blended)
        .style('stroke', 'none');
    });

  // Replace venn.js labels with name + count tspans
  vennGroup.selectAll('g.venn-circle, g.venn-intersection')
    .each(function (d) {
      const g = d3.select(this);
      g.select('text').remove();

      const pathNode = g.select('path').node();
      if (!pathNode) return;
      const bbox = pathNode.getBBox();
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;

      const displayName = d.label || d.sets.join(' \u2229 ');
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

  // Tooltip (fixed position — works across scrollable grid)
  const tooltip = d3.select('#tooltip');
  const fmtNum = d3.format(',');

  vennGroup.selectAll('g.venn-circle, g.venn-intersection')
    .on('mouseover', function (event, d) {
      d3.select(this).classed('hover', true);
      const displayName = d.label || d.sets.join(' \u2229 ');
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

// ── Color blending helper ──────────────────────────────────────────────────────

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

## Task 5: README.md

**File:** `extensions/venn-diagram/README.md`

Add the new `Group` encoding slot to the table, add a "Color Controls" section, and update the data format table to show the multi-group layout.

- [ ] **Step 5.1: Overwrite README.md**

Overwrite `extensions/venn-diagram/README.md` with the complete file below:

```markdown
# Venn Diagram — Tableau Viz Extension

A D3 v7 + venn.js Tableau Viz Extension that renders Venn diagrams showing customer overlap between loyalty tiers. Supports multi-panel grouped view and per-circle color customization via a toolbar.

**Live URL:** https://vj-cyntexa.github.io/tableau-viz/extensions/venn-diagram/index.html

---

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `Sets` | Discrete dimension | Yes | Set name(s). Use comma-separated values for intersections (e.g. `Gold,Silver`) |
| `Value` | Continuous measure | Yes | Count or size for each segment |
| `Label` | Discrete dimension | No | Display label inside the region; falls back to Sets field |
| `Group` | Discrete dimension | No | When present, each unique value renders as its own Venn diagram panel in a responsive grid |

---

## Data Format

### Single diagram (no Group field)

| Loyalty Segment (Sets) | Customer Count (Value) |
|---|---|
| Gold | 500 |
| Silver | 800 |
| Platinum | 300 |
| Gold,Silver | 200 |
| Gold,Platinum | 100 |
| Silver,Platinum | 150 |
| Gold,Silver,Platinum | 50 |

### Multi-panel (with Group field)

| Programme (Group) | Loyalty Segment (Sets) | Customer Count (Value) |
|---|---|---|
| Programme A | Gold | 600 |
| Programme A | Silver | 950 |
| Programme A | Gold,Silver | 230 |
| … | … | … |
| Programme B | Gold | 310 |
| Programme B | Silver | 520 |
| Programme B | Gold,Silver | 110 |
| … | … | … |

---

## Color Controls

After data loads, the extension renders a toolbar above the panels. Each unique set name discovered in the data gets a color picker. Changing any color immediately redraws all panels without re-fetching from Tableau. User color choices persist across data refreshes.

---

## Usage in Tableau Desktop

1. Open a Tableau workbook and switch to a sheet.
2. Set up a calculated field or use an existing dimension that has set labels (e.g. `Gold`, `Gold,Silver`).
3. Add a **Viz Extension** object to the dashboard or use the **Worksheet > Insert > Extension** menu.
4. Load `venn-diagram.trex` (production) or `venn-diagram-local.trex` (local dev at `localhost:8080`).
5. Drag the sets dimension onto the **Sets** slot, a count measure onto the **Value** slot.
6. Optionally drag a label dimension onto **Label**, and a grouping dimension onto **Group** to enable the multi-panel view.

---

## Local Development

```bash
# Serve from repo root
python3 -m http.server 8080

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
| `index.html` | Extension shell — toolbar + panel grid + tooltip + error banner |
| `chart.js` | Data parsing, multi-panel rendering, color toolbar, resize handling |
| `test.html` | Standalone browser test — 2 programmes × 3 tiers, no Tableau needed |
| `README.md` | This file |

---

## Tech Stack

- [D3.js v7](https://d3js.org/)
- [venn.js 0.2.20](https://github.com/benfred/venn.js)
- [Tableau Extensions API 2.x](https://tableau.github.io/extensions-api/)
- Vanilla JS (ES2020), no build step
- GitHub Pages

---

## Author

**Cyntexa** — vishwajeet@cyntexa.com
```

---

## Task 6: Commit and Push

- [ ] **Step 6.1: Stage all changed files**

```bash
git add extensions/venn-diagram/venn-diagram.trex \
        extensions/venn-diagram/venn-diagram-local.trex \
        extensions/venn-diagram/index.html \
        extensions/venn-diagram/test.html \
        extensions/venn-diagram/chart.js \
        extensions/venn-diagram/README.md
```

- [ ] **Step 6.2: Commit**

```bash
git commit -m "feat: venn-diagram redesign — multi-panel groups, color toolbar, improved labels"
```

- [ ] **Step 6.3: Pull and push**

```bash
git config core.sshCommand "ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes"
git pull --rebase origin master && git push origin master
```

- [ ] **Step 6.4: Verify**

After GitHub Pages finishes building (30–90 seconds), open:
`https://vj-cyntexa.github.io/tableau-viz/extensions/venn-diagram/test.html`

Expected: two Venn diagram panels side-by-side (Programme A and Programme B), each showing Gold/Silver/Platinum circles with intersections. A toolbar above shows three color pickers. Changing a color picker immediately redraws both panels.

---

## Implementation Notes

**Why `position: fixed` on tooltip:** Panels are inside a scrollable CSS grid. `event.clientX / event.clientY` + `position: fixed` avoids clipping.

**Why module-level `colorState`:** Color picker changes must not trigger a Tableau data re-fetch. Storing colors at module scope means `drawAll` can be called synchronously.

**Why all-set-name collection via `flatMap(d => d.sets)`:** A set name could only appear in intersection rows (e.g., no standalone `Gold` row). The old `d.sets.length === 1` approach would miss those names.

**Resize listener registered once at module scope:** The old code registered a new listener inside `drawChart` on every render, accumulating listeners. One listener + debounce at module scope fixes this.

**`__all__` sentinel:** When `group` encoding is absent, all rows go into `'__all__'`. `renderPanel` skips the title for this sentinel; CSS `:empty` hides the empty `.panel-title`.
