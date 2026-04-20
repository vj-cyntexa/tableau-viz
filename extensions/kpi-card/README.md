# KPI Card — Tableau Viz Extension

A Tableau Viz Extension that renders a clean KPI metric card with four selectable display modes.

**Production URL:** `https://vj-cyntexa.github.io/tableau-viz/extensions/kpi-card/index.html`

---

## Display Modes

| Mode | Description |
|---|---|
| Simple | Large primary value with label |
| Comparison | Current value vs previous/target with delta % |
| Trend | Value + up/down arrow + green/red background |
| Sparkline | Value + mini line chart (D3) from history data |

Switch modes with the pill buttons in the top-right corner of the card. The selected mode persists across data refreshes.

---

## Encoding Slots

| Slot | Type | Required | Description |
|---|---|---|---|
| `value` | Continuous measure | Yes | Primary KPI value displayed large |
| `label` | Discrete dimension | No | Card title/label; falls back to field name if absent |
| `comparison` | Continuous measure | No | Secondary value for delta % (Comparison and Trend modes) |
| `history` | Continuous measure | No | Measure values for the sparkline series (Sparkline mode) |
| `date` | Discrete dimension | No | Date dimension for sparkline X axis; also used to identify the most-recent row |

If an optional encoding is absent and a mode that requires it is selected, the card falls back to Simple mode with an inline hint.

---

## Tech Stack

- **D3.js v7** — sparkline rendering and number formatting
- **Tableau Extensions API 2.x** — encoding slot access and live data
- **Vanilla JS / HTML / CSS** — no build step

---

## Dev Workflow

1. Serve the repo root locally:
   ```bash
   python3 -m http.server 8080
   ```
2. Open the test page in your browser (no Tableau required):
   ```
   http://localhost:8080/extensions/kpi-card/test.html
   ```
3. To load inside Tableau Desktop:
   - Marks card → **Viz Extensions** → **Access Local Extension**
   - Select `extensions/kpi-card/kpi-card-local.trex`

---

## Adding to Tableau

1. Drag a sheet into a dashboard or open a worksheet.
2. On the Marks card choose **Viz Extension**.
3. Click **Add an Extension** → choose the `.trex` file:
   - Local dev: `kpi-card-local.trex` (requires local server on port 8080)
   - Production: `kpi-card.trex` (served from GitHub Pages)
4. Drag fields into the encoding slots:
   - At minimum, drag a numeric measure onto **Value**.
   - Optionally drag a dimension onto **Label**, another measure onto **Comparison**, a measure onto **History**, and a date onto **Date**.

---

## Author

Cyntexa — vishwajeet@cyntexa.com
