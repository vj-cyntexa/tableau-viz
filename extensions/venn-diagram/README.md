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

After data loads, a toolbar appears above the panels with one color picker per unique set name. Changing a color immediately redraws all panels without re-fetching from Tableau. User color choices persist across data refreshes.

---

## Usage in Tableau Desktop

1. Open a Tableau workbook and switch to a sheet.
2. Load `venn-diagram.trex` (production) or `venn-diagram-local.trex` (local dev).
3. Drag sets dimension → **Sets** slot, count measure → **Value** slot.
4. Optionally drag a grouping dimension → **Group** to enable multi-panel view.

---

## Local Development

```bash
python3 -m http.server 8080
open http://localhost:8080/extensions/venn-diagram/test.html
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
- Vanilla JS (ES2020), no build step, GitHub Pages
