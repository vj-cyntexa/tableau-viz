'use strict';

const MARGIN = { top: 30, right: 160, bottom: 60, left: 75 };
const COLORS = d3.schemeTableau10;

tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent.worksheet;
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, () => render(ws));
  render(ws);
}).catch(err => {
  setError(err.message || String(err));
});

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
  try {
    return await reader.getAllPagesAsync();
  } finally {
    await reader.releaseAsync();
  }
}

function parseTableauData(dataTable, vizSpec) {
  const marksSpec = vizSpec.marksSpecificationCollection?.[0];
  if (!marksSpec) throw new Error('No marks specification found.');

  const encodings = marksSpec.encodingCollection;

  function fieldName(encodingId) {
    const enc = encodings.find(e => e.id === encodingId);
    return enc?.fieldCollection?.[0]?.fieldName ?? null;
  }

  const xField     = fieldName('x');
  const yField     = fieldName('y');
  const colorField = fieldName('color');

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

function drawChart(series) {
  const container = document.getElementById('chart');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top - MARGIN.bottom;

  d3.select(container).selectAll('*').remove();

  if (!series.length) { container.textContent = 'No data.'; return; }

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

  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H);

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-w).tickFormat(''))
    .call(grp => grp.select('.domain').remove());

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

  series.forEach(s => {
    g.append('path')
      .datum(s.values)
      .attr('class', 'series-line')
      .attr('stroke', color(s.name))
      .attr('d', lineGen);
  });

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

  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0)
    .style('left', '0px')
    .style('top', '0px');

  const bisect  = d3.bisector(d => d.date).left;
  const fmtDate = d3.timeFormat('%b %d, %Y');
  const fmtNum  = d3.format(',~f');

  const dots = series.map(s =>
    g.append('circle')
      .attr('class', 'dot')
      .attr('fill', color(s.name))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('display', 'none')
  );

  g.append('rect')
    .attr('width', w)
    .attr('height', h)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .on('mousemove', function (event) {
      const [mx] = d3.pointer(event);
      const hoverDate = x.invert(mx);

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

function setError(msg) {
  const el = document.getElementById('error');
  if (el) el.textContent = msg;
}

function clearError() {
  const el = document.getElementById('error');
  if (el) el.textContent = '';
}
