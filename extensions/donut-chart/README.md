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
