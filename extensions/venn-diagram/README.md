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
