# AI-Assisted Local Tableau Development

## The Core Idea

You don't build Tableau workbooks manually. Instead, an AI coding tool (Claude Code or similar) generates all workbook XML, data pipelines, Viz Extension code, and publish scripts. You open the output in Tableau Desktop or Tableau Cloud, review it visually, approve or request changes, then deploy.

```
You describe requirements
        ↓
AI generates all files
        ↓
You preview in Tableau Desktop / Tableau Cloud (test project)
        ↓
Approve → deploy  |  Request changes → iterate
```

---

## What You Need Locally

| Tool | Purpose | Notes |
|---|---|---|
| **Tableau Desktop** | Visual preview of generated workbooks | Included with Creator license — sign in with your Tableau Cloud credentials |
| **Python 3.10+** | Data extraction, workbook packaging, publishing | `pip install tableauserverclient tableaudocumentapi simple-salesforce` |
| **Claude Code** | Generates all TWB XML, JS, Python scripts | Runs in your project terminal |
| **Node.js + npm** | Only if building custom Viz Extensions | Required for the extensions-api SDK |
| **VS Code** | Reviewing generated files before running | Optional but useful |

> If your Tableau subscription is **Creator**, Tableau Desktop is already included — download from [tableau.com/products/desktop/download](https://www.tableau.com/products/desktop/download) and sign in with your Tableau Cloud account.

---

## Project Folder Structure

Ask Claude Code to create and maintain this structure from day one:

```
/tableau-project/
  /data/
    raw/              ← exported CSVs / JSON from source systems
    extracts/         ← generated .hyper files
  /workbooks/
    templates/        ← Jinja2 TWB XML templates
    output/           ← generated .twb and .twbx files
  /extensions/        ← custom Viz Extension code (if needed)
    /my-chart/
      my-chart.html
      my-chart.js
      my-chart.trex
  /scripts/
    extract_data.py   ← pulls data from source (Salesforce, DB, etc.)
    build_workbook.py ← renders template → packages .twbx
    publish.py        ← pushes to Tableau Cloud via TSC
    refresh.py        ← triggers extract refresh on Tableau Cloud
  /config/
    datasources.yml   ← connection strings, credentials (gitignored)
    workbook_spec.yml ← what sheets/dashboards/KPIs to build
  requirements.txt
  README.md
```

---

## How Tableau Workbook Files Work (What AI Generates)

| File | What It Is | AI Can Generate? |
|---|---|---|
| `.twb` | Pure XML — workbook structure, sheets, dashboards, field definitions | Yes — fully |
| `.twbx` | ZIP archive: `.twb` + data extracts + images | Yes — Python zipfile module |
| `.hyper` | Tableau's columnar data extract format | Yes — Hyper API |
| `.trex` | Viz Extension manifest (XML) | Yes — fully |

A `.twbx` is just a renamed ZIP. Claude Code creates it like this:

```python
import zipfile, os

def package_twbx(twb_path, hyper_paths, output_path):
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(twb_path, os.path.basename(twb_path))
        for h in hyper_paths:
            zf.write(h, f"Data/Extracts/{os.path.basename(h)}")
```

---

## Step-by-Step Workflow

### Step 1: Define Requirements (You Do This Once)

Write a plain-English spec. This becomes `workbook_spec.yml` and is what you hand to Claude Code. Cover:

- KPIs needed at a glance (e.g. total active members, redemption rate)
- Time dimensions (daily / weekly / monthly trends)
- Dimensions to slice by (tier, region, campaign type, segment)
- Number of dashboards / tabs and navigation structure
- Any chart types specifically requested
- Data sources and key fields/objects

### Step 2: Extract Data Locally

**Option A — Export from source system (quickest)**  
Export CSVs from Salesforce Data Loader, a database, or an API. Drop in `/data/raw/`.

**Option B — Claude Code writes a pull script**  
For Salesforce:
```python
# Claude Code generates this
from simple_salesforce import Salesforce
import pandas as pd

sf = Salesforce(username='...', password='...', security_token='...')
result = sf.query_all("SELECT Id, Name, LoyaltyTier__c, PointBalance__c FROM Member__c")
df = pd.DataFrame(result['records']).drop('attributes', axis=1)
df.to_csv('data/raw/members.csv', index=False)
```

Then convert CSVs to `.hyper` for fast local Tableau reads:
```python
# Claude Code generates this using Tableau Hyper API
from tableauhyperapi import HyperProcess, Connection, Telemetry, TableDefinition, SqlType, Inserter

# Creates data/extracts/members.hyper
```

### Step 3: Generate the Workbook

Tell Claude Code what to build. Example prompt:

> "Build a TWB file with these sheets: (1) KPI summary card showing total members, active members, and avg points balance, (2) Members by loyalty tier horizontal bar chart sorted descending, (3) Points earned vs redeemed dual-axis line chart by month, (4) Top 10 campaigns by engagement rate. Package with the members.hyper and campaigns.hyper extracts into output/loyalty-dashboard.twbx."

Claude Code:
1. Writes Jinja2 TWB XML templates with proper datasource definitions, column mappings, sheet XML, and dashboard layout XML
2. Renders the template with your data schema
3. Packages everything into `.twbx`

### Step 4: Preview Locally

Open the generated `.twbx` in **Tableau Desktop**:
- `File → Open → browse to output/loyalty-dashboard.twbx`
- All sheets and dashboards render against your local extract data
- No internet required, no Salesforce API calls

Review visually. Request changes from Claude Code as plain English:
> "The tier bar chart needs to sort descending. Add a date range filter. Change the line chart colours to blue and orange."

Claude Code edits the XML and regenerates. Repeat until approved.

### Step 5: Deploy to Tableau Cloud

Once approved, run the publish script Claude Code generates:

```python
import tableauserverclient as TSC

auth = TSC.PersonalAccessTokenAuth('TOKEN_NAME', 'TOKEN_VALUE', site_id='SITE_ID')
server = TSC.Server('https://prod-apnortheast-a.online.tableau.com', use_server_version=True)

with server.auth.sign_in(auth):
    projects, _ = server.projects.get()
    project = next(p for p in projects if p.name == 'Analytics')
    
    wb = TSC.WorkbookItem(name='Loyalty Dashboard', project_id=project.id)
    wb = server.workbooks.publish(
        wb, 'workbooks/output/loyalty-dashboard.twbx',
        mode=TSC.Server.PublishMode.Overwrite
    )
    print(f"Live at: {wb.webpage_url}")
```

---

## Custom Viz Extensions — When and How

### When to Build Custom

Before building anything custom, check [exchange.tableau.com/viz-extensions](https://exchange.tableau.com/viz-extensions). Community extensions for Sankey, Network, Chord, Radial bar, Funnel, Radar, and others are already available for free.

Build a custom Viz Extension only when:
- The chart type doesn't exist on Exchange
- You need specific client branding baked into the visual
- You need interactive behaviour standard charts can't provide

### How Claude Code Builds a Viz Extension

Tell Claude Code:
> "Build a D3-based radial bar chart Viz Extension. It needs two encoding tiles: Category (discrete dimension) and Value (continuous measure). Style it with dark background, Cyntexa purple colour scale."

Claude Code generates:
1. `my-chart.trex` — manifest with encoding definitions
2. `my-chart.html` — HTML shell linking to the Extensions API JS library and D3
3. `my-chart.js` — D3 rendering logic using `getVisualSpecificationAsync()` and `getSummaryDataReaderAsync()`

You test it locally:
```bash
cd extensions-api && npm start   # starts server on localhost:8765
# In Tableau Desktop → Marks card → Add Extension → Access Local → open .trex
```

Iterate until it looks right. Then deploy to Azure Static Web Apps or GitHub Pages, update the URL in the `.trex` file, add the URL to the Tableau Cloud safe list.

---

## Prompting Claude Code Effectively

### Start Each Session With Context

```
Project: Loyalty dashboard for Salesforce Loyalty Cloud + Marketing Cloud
Data: /data/extracts/members.hyper, campaigns.hyper, transactions.hyper
Target: Tableau Cloud (Creator license)
Output folder: workbooks/output/
```

### Describe Changes Precisely

Instead of: *"Fix the chart"*  
Say: *"In the Members by Tier sheet, sort the bars by member count descending, add data labels showing the count, and change the bar colour to #7B4FE0"*

### Review Generated XML Before Running

Claude Code edits TWB XML directly. Before running the package/publish scripts, scan the generated XML for datasource connection strings and field name mappings. TWB XML is human-readable — a quick look catches most issues.

### Iterating on Custom Extensions

Keep a running notes file of what each JS function does. Paste it into each new Claude Code session so it has context when modifying the extension later.

---

## Data Refresh in Production

Once published to Tableau Cloud, switch from the packaged extract to a **live Salesforce connection with scheduled extract refresh** so your client's data stays current automatically.

In Tableau Cloud: `Data Sources → select your datasource → Schedule Extract Refresh`

Supported frequencies: every 15 min / hourly / daily / weekly.

For Salesforce specifically, Tableau Cloud has a native connector that handles authentication and incremental refresh without any scripts.

---

## Key Python Libraries

```bash
pip install tableauserverclient      # publish, manage workbooks on Tableau Cloud/Server
pip install tableaudocumentapi       # read/modify TWB/TWBX XML (connection strings, fields)
pip install tableauhyperapi          # create/update .hyper extract files
pip install simple-salesforce        # query Salesforce via SOQL
pip install jinja2 pandas            # template rendering and data manipulation
```

---

## Key References

| Resource | Link |
|---|---|
| Tableau Server Client (TSC) Python | https://github.com/tableau/server-client-python |
| TSC Documentation | https://tableau.github.io/server-client-python/docs/ |
| Tableau Document API (Python) | https://github.com/tableau/document-api-python |
| Tableau Hyper API | https://tableau.github.io/hyper-db/docs/ |
| Extensions API SDK (GitHub) | https://github.com/tableau/extensions-api |
| REST API Publishing Reference | https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_ref_publishing.htm |
| Tableau Exchange (free Viz Extensions) | https://exchange.tableau.com/viz-extensions |
| simple-salesforce (Python) | https://github.com/simple-salesforce/simple-salesforce |
| Tableau Desktop Download | https://www.tableau.com/products/desktop/download |
| Login-based License Management | https://help.tableau.com/current/online/en-us/license_based_management_online.htm |
