# Tableau Viz Extensions

A collection of custom D3-powered Tableau Viz Extensions for loyalty and marketing analytics, built with the Tableau Extensions API.

[View the full extension gallery →](gallery.html)

## Getting Started / Local Dev

```bash
python3 -m http.server 8080
# then open http://localhost:8080/extensions/<name>/test.html
```

## Extensions

| Extension | Category | Priority | Test Page |
|---|---|---|---|
| [multi-line-chart](extensions/multi-line-chart/) | Core | — | [test.html](extensions/multi-line-chart/test.html) |
| [bar-line-combo](extensions/bar-line-combo/) | Core | — | [test.html](extensions/bar-line-combo/test.html) |
| [bar-chart](extensions/bar-chart/) | Core | — | [test.html](extensions/bar-chart/test.html) |
| [donut-chart](extensions/donut-chart/) | Core | — | [test.html](extensions/donut-chart/test.html) |
| [kpi-card](extensions/kpi-card/) | Core | — | [test.html](extensions/kpi-card/test.html) |
| [relationship-table](extensions/relationship-table/) | Core | — | [test.html](extensions/relationship-table/test.html) |
| [affinity-matrix](extensions/affinity-matrix/) | Core | — | [test.html](extensions/affinity-matrix/test.html) |
| [venn-diagram](extensions/venn-diagram/) | Core | — | [test.html](extensions/venn-diagram/test.html) |
| [cohort-retention-heatmap](extensions/cohort-retention-heatmap/) | Loyalty Analytics | High | [test.html](extensions/cohort-retention-heatmap/test.html) |
| [funnel-chart](extensions/funnel-chart/) | Loyalty Analytics | High | [test.html](extensions/funnel-chart/test.html) |
| [sankey-diagram](extensions/sankey-diagram/) | Loyalty Analytics | High | [test.html](extensions/sankey-diagram/test.html) |
| [rfm-scatter](extensions/rfm-scatter/) | Loyalty Analytics | High | [test.html](extensions/rfm-scatter/test.html) |
| [treemap](extensions/treemap/) | Loyalty Analytics | High | [test.html](extensions/treemap/test.html) |
| [waterfall-chart](extensions/waterfall-chart/) | Loyalty Analytics | High | [test.html](extensions/waterfall-chart/test.html) |
| [survival-curve](extensions/survival-curve/) | Loyalty Analytics | High | [test.html](extensions/survival-curve/test.html) |
| [bubble-chart](extensions/bubble-chart/) | Marketing Analytics | Medium | [test.html](extensions/bubble-chart/test.html) |
| [network-graph](extensions/network-graph/) | Marketing Analytics | Medium | [test.html](extensions/network-graph/test.html) |
| [gauge-chart](extensions/gauge-chart/) | Marketing Analytics | Medium | [test.html](extensions/gauge-chart/test.html) |
| [histogram](extensions/histogram/) | Marketing Analytics | Medium | [test.html](extensions/histogram/test.html) |
| [stacked-area-chart](extensions/stacked-area-chart/) | Marketing Analytics | Medium | [test.html](extensions/stacked-area-chart/test.html) |
| [clv-churn-quadrant](extensions/clv-churn-quadrant/) | Marketing Analytics | Medium | [test.html](extensions/clv-churn-quadrant/test.html) |
| [lollipop-chart](extensions/lollipop-chart/) | Marketing Analytics | Medium | [test.html](extensions/lollipop-chart/test.html) |

## Tech Stack

- D3.js v7
- Tableau Extensions API 2.x
- Vanilla JS ES2020
- GitHub Pages

## Folder Structure

```
extensions/<name>/     ← HTML, JS, TREX files per extension
docs/superpowers/plans/ ← Implementation plans
gallery.html           ← Extension gallery index
```
