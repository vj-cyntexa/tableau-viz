# Tableau Extensions: Build, Deploy & Use

## What Are Tableau Extensions?

Tableau extensions are web applications that communicate with Tableau via the **Extensions API** (a JavaScript library). There are two distinct types — each lives in a different part of Tableau and serves a different purpose.

---

## Type 1: Viz Extensions

**What they are:** Custom chart types that replace Tableau's native mark types inside a **Worksheet**. Users access them from the Marks card dropdown.

**When to use:** You need a chart type Tableau doesn't natively support — Sankey, Network diagram, Chord, Radial bar, Beeswarm, custom KPI cards, etc.

**How they work:**
- Tableau renders an `<iframe>` inside the worksheet canvas
- Your web app receives data and encoding from Tableau via the API
- Your JS code (D3, SVG, Canvas, ECharts, etc.) renders the visual

**Available since:** Tableau 2024.2 (GA)

### Core Components

| Component | Purpose |
|---|---|
| `.trex` manifest (XML) | Registers the extension with Tableau; defines the URL and custom Marks card encodings |
| `HTML` page | The shell Tableau loads inside the iframe |
| `JavaScript` file(s) | Your rendering logic — pulls data from worksheet, draws the chart |
| Web server | Hosts your HTML/JS (localhost for dev, HTTPS server for production) |

### Key API Methods

```javascript
// Initialize
tableau.extensions.initializeAsync()

// Get encoding (what fields the user dropped on Marks card)
worksheet.getVisualSpecificationAsync()

// Get data
worksheet.getSummaryDataReaderAsync()

// Listen for data changes
worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, callback)
```

### Minimal `.trex` Manifest

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.yourorg.myviz" extension-version="0.1.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>My Custom Viz</description>
    <author name="YourName" email="you@org.com" organization="YourOrg" website="https://yoursite.com"/>
    <min-api-version>1.1</min-api-version>
    <source-location>
      <url>http://localhost:8765/Samples/MyViz/MyViz.html</url>
    </source-location>
    <icon/>
    <encoding id="x">
      <display-name resource-id="x">X Axis</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields max-count="1"/>
    </encoding>
    <encoding id="y">
      <display-name resource-id="y">Y Axis</display-name>
      <role-spec><role-type>continuous-measure</role-type></role-spec>
      <fields max-count="1"/>
    </encoding>
  </worksheet-extension>
</manifest>
```

---

## Type 2: Dashboard Extensions

**What they are:** Custom web applications placed on a **Dashboard** canvas as an object. They interact with the dashboard — responding to filters, mark selections, parameters.

**When to use:** Write-back to databases, third-party API integrations, custom filter UIs, cross-sheet interactivity, external embeds within the dashboard.

**Available since:** Tableau 2018.2

### Key Differences from Viz Extensions

| | Viz Extension | Dashboard Extension |
|---|---|---|
| Lives in | Worksheet (Marks card) | Dashboard (as an object) |
| Purpose | New chart types | New dashboard features / integrations |
| Manifest element | `<worksheet-extension>` | `<dashboard-extension>` |
| Marks card access | Yes — custom encodings | No |
| Dashboard object access | No | Yes — filters, parameters, worksheets |

### Key API Methods (Dashboard)

```javascript
// Get dashboard
const dashboard = tableau.extensions.dashboardContent.dashboard

// Get all worksheets
dashboard.worksheets

// Listen for filter changes
worksheet.addEventListener(tableau.TableauEventType.FilterChanged, callback)

// Listen for mark selection
worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, callback)

// Apply a filter programmatically
worksheet.applyFilterAsync('fieldName', ['value1'], tableau.FilterUpdateType.Replace)
```

---

## Extension Security: Two Modes

| Mode | Hosted By | Network Access | Allowed By Default |
|---|---|---|---|
| **Sandboxed** | Tableau (their CDN) | None (no external calls) | Yes |
| **Network-Enabled** | You (your server) | Full web access | Requires safe list approval |

For internal or client-specific use, **Network-Enabled** is the practical choice. For publishing to Tableau Exchange, Sandboxed goes through Tableau's review.

---

## Local Development Setup

```bash
# Prerequisites: Node.js + npm

# Clone the official SDK
git clone https://github.com/tableau/extensions-api.git
cd extensions-api

# Install and build
npm install
npm run build

# Start local web server on port 8765
npm start
```

Then in Tableau Desktop:
`Worksheet → Marks card → Mark Type dropdown → Viz Extensions → Add Extension → Access Local Extensions → browse to your .trex file`

---

## Adding a Viz Extension in Tableau (End User Flow)

1. Open a Worksheet
2. On the Marks card, expand the **Mark Type** dropdown
3. Under **Viz Extensions**, click **Add Extension**
4. Choose:
   - **Browse Viz Extensions** → Tableau Exchange (free community extensions)
   - **Access Local Viz Extensions** → load your own `.trex` file
5. Drag fields onto the custom encoding tiles that appear on the Marks card

---

## Production Hosting

Your extension HTML/JS must be served over **HTTPS** in production (localhost HTTP is fine for dev).

| Option | Best For | Cost |
|---|---|---|
| **GitHub Pages** | Pure HTML/JS, no server logic | Free |
| **Azure Static Web Apps** | Teams already on Azure | Free tier available |
| **Vercel / Netlify** | Quick deploy from GitHub | Free tier available |
| **Your own server** | Existing infra with SSL cert | Your infra cost |

> Self-signed certificates are **not** accepted by Tableau. Must be a proper CA-signed cert.

---

## Tableau Cloud / Server: Safe List

For Network-Enabled extensions on Tableau Cloud or Server, a site admin must add the extension URL to the safe list before users can load it.

**Tableau Cloud:** `Site Settings → Extensions → Add to safe list`  
**Tableau Server:** `Manage All Sites → Settings → Extensions → Add to safe list`

Add a wildcard pattern to cover all your extensions at once:
```
https://your-extension-host.com/tableau-extensions/.*
```

---

## Publishing to Tableau Exchange (Optional)

If you want your extension available publicly:
1. Build and test as a Sandboxed Extension
2. Submit to Tableau via the [DataDev community portal](https://community.tableau.com/s/group/0F94T000000gQqoSAE/datadev)
3. Tableau reviews and hosts it on their CDN
4. It becomes available on [exchange.tableau.com](https://exchange.tableau.com/viz-extensions)

---

## Key References

| Resource | Link |
|---|---|
| Extensions API GitHub (SDK + samples) | https://github.com/tableau/extensions-api |
| Official Documentation | https://tableau.github.io/extensions-api/docs/ |
| Get Started: Viz Extensions | https://tableau.github.io/extensions-api/docs/vizext/trex_viz_getstarted/ |
| Hello World Viz Extension | https://tableau.github.io/extensions-api/docs/vizext/trex_viz_create/ |
| Viz Extension Manifest Reference | https://tableau.github.io/extensions-api/docs/vizext/trex_viz_manifest/ |
| Dashboard Extension Overview | https://tableau.github.io/extensions-api/docs/dashext/trex_overview/ |
| Viz Extension Samples | https://tableau.github.io/extensions-api/docs/vizext/trex_viz_examples/ |
| HTTPS & Hosting Guide | https://tableau.github.io/extensions-api/docs/security/trex_security/ |
| Tableau Exchange (Viz Extensions) | https://exchange.tableau.com/viz-extensions |
| Tableau Developer Program | https://www.tableau.com/developer |
| API Reference | https://tableau.github.io/extensions-api/docs/api/interfaces/extensions/ |
