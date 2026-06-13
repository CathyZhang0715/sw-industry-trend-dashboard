const board = document.querySelector("#board");
const tableBody = document.querySelector("#tableBody");
const refreshButton = document.querySelector("#refreshButton");
const refreshInterval = document.querySelector("#refreshInterval");
const leader = document.querySelector("#leader");
const laggard = document.querySelector("#laggard");
const average = document.querySelector("#average");
const updatedAt = document.querySelector("#updatedAt");
const period = document.querySelector("#period");
const breadth = document.querySelector("#breadth");
const source = document.querySelector("#source");
const focusChart = document.querySelector("#focusChart");
const focusLegend = document.querySelector("#focusLegend");
const industryPicker = document.querySelector("#industryPicker");
const selectLeadersButton = document.querySelector("#selectLeadersButton");
const clearFocusButton = document.querySelector("#clearFocusButton");

let timer = null;
let latestRows = [];
let selectedCodes = new Set(["801770", "801730", "801080", "801780"]);
const lineColors = ["#35c987", "#65c7d7", "#e2b654", "#ff7f6e", "#b68cff", "#f06fa9"];

function formatPercent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "--";
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatDate(value) {
  if (!value) return "--";
  return value.replaceAll("-", ".");
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function toneClass(value) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function cardClass(value) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return "";
  return value > 0 ? "up" : "down";
}

function sparkline(points) {
  const closes = points.map((point) => point.close).filter(Number.isFinite);
  if (closes.length < 2) return "";

  const width = 180;
  const height = 56;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const path = closes
    .map((close, index) => {
      const x = (index / (closes.length - 1)) * width;
      const y = height - ((close - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${path}"></path>
    </svg>
  `;
}

function normalizeSeries(points) {
  const first = points.find((point) => Number.isFinite(point.close) && point.close > 0);
  if (!first) return [];
  return points
    .filter((point) => Number.isFinite(point.close))
    .map((point) => ({
      date: point.date,
      value: (point.close / first.close) * 100
    }));
}

function makePath(series, bounds) {
  const { min, max, width, height, paddingX, paddingY, length } = bounds;
  const range = max - min || 1;
  return series
    .map((point, index) => {
      const x = paddingX + (index / Math.max(1, length - 1)) * (width - paddingX * 2);
      const y = height - paddingY - ((point.value - min) / range) * (height - paddingY * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function renderFocusChart(rows) {
  const selected = rows.filter((row) => selectedCodes.has(row.code));
  if (!selected.length) {
    focusChart.innerHTML = `<text x="480" y="180" text-anchor="middle" class="empty-chart">选择行业后显示趋势</text>`;
    focusLegend.innerHTML = "";
    return;
  }

  const series = selected.map((row, index) => ({
    ...row,
    color: lineColors[index % lineColors.length],
    series: normalizeSeries(row.points || [])
  }));
  const values = series.flatMap((row) => row.series.map((point) => point.value));
  const min = Math.floor(Math.min(...values) / 5) * 5;
  const max = Math.ceil(Math.max(...values) / 5) * 5;
  const width = 960;
  const height = 360;
  const paddingX = 58;
  const paddingY = 34;
  const length = Math.max(...series.map((row) => row.series.length));
  const ticks = [min, min + (max - min) / 2, max];
  const grid = ticks
    .map((tick) => {
      const y = height - paddingY - ((tick - min) / (max - min || 1)) * (height - paddingY * 2);
      return `
        <line x1="${paddingX}" x2="${width - paddingX}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"></line>
        <text x="18" y="${(y + 4).toFixed(1)}">${tick.toFixed(0)}</text>
      `;
    })
    .join("");
  const paths = series
    .map(
      (row) => `
        <path d="${makePath(row.series, { min, max, width, height, paddingX, paddingY, length })}" stroke="${row.color}"></path>
      `
    )
    .join("");
  const latestLabels = series
    .map((row) => {
      const last = row.series.at(-1);
      if (!last) return "";
      const y = height - paddingY - ((last.value - min) / (max - min || 1)) * (height - paddingY * 2);
      return `<text x="${width - paddingX + 10}" y="${(y + 4).toFixed(1)}" fill="${row.color}">${row.name}</text>`;
    })
    .join("");

  focusChart.innerHTML = `
    <g class="grid">${grid}</g>
    <line class="base-line" x1="${paddingX}" x2="${width - paddingX}" y1="${height - paddingY}" y2="${height - paddingY}"></line>
    <g class="lines">${paths}</g>
    <g class="line-labels">${latestLabels}</g>
  `;
  focusLegend.innerHTML = series
    .map(
      (row) => `
        <span>
          <i style="background:${row.color}"></i>
          ${row.name} <strong class="${toneClass(row.changePct)}">${formatPercent(row.changePct)}</strong>
        </span>
      `
    )
    .join("");
}

function renderIndustryPicker(rows) {
  industryPicker.innerHTML = rows
    .map(
      (row) => `
        <button class="${selectedCodes.has(row.code) ? "selected" : ""}" type="button" data-code="${row.code}">
          ${row.name}
        </button>
      `
    )
    .join("");
}

function renderFocus(rows) {
  renderFocusChart(rows);
  renderIndustryPicker(rows);
}

function renderSummary(rows, payload) {
  const validRows = rows.filter((row) => Number.isFinite(row.changePct));
  const sorted = [...validRows].sort((a, b) => b.changePct - a.changePct);
  const avg = validRows.reduce((sum, row) => sum + row.changePct, 0) / validRows.length;
  const winners = validRows.filter((row) => row.changePct > 0).length;

  leader.textContent = sorted[0] ? `${sorted[0].name} ${formatPercent(sorted[0].changePct)}` : "--";
  laggard.textContent = sorted.at(-1)
    ? `${sorted.at(-1).name} ${formatPercent(sorted.at(-1).changePct)}`
    : "--";
  average.textContent = Number.isFinite(avg) ? formatPercent(avg) : "--";
  average.className = toneClass(avg);
  period.textContent = `${formatDate(payload.startDate)} - ${formatDate(payload.latestTradingDate)}`;
  breadth.textContent = `${winners}/${validRows.length}`;
  updatedAt.textContent = formatTime(payload.asOf);
  source.textContent = `${payload.note || payload.source || ""} 行情缓存更新：${formatTime(payload.dataFetchedAt || payload.asOf)}。`;
}

function renderBoard(rows) {
  const maxMove = Math.max(1, ...rows.map((row) => Math.abs(row.changePct || 0)));
  board.innerHTML = rows
    .map((row, index) => {
      const magnitude = Math.min(100, (Math.abs(row.changePct || 0) / maxMove) * 100);
      return `
        <article class="sector-card ${cardClass(row.changePct)}">
          <div class="rank">${String(index + 1).padStart(2, "0")}</div>
          <div class="sector-title">
            <h2>${row.name}</h2>
            <span class="ticker">${row.code}</span>
          </div>
          <div class="chart ${toneClass(row.changePct)}">${sparkline(row.points || [])}</div>
          <div class="metrics">
            <div>
              <span>三个月</span>
              <strong class="${toneClass(row.changePct)}">${formatPercent(row.changePct)}</strong>
            </div>
            <div>
              <span>最新</span>
              <strong>${formatNumber(row.latestClose)}</strong>
            </div>
          </div>
          <div class="bar" style="--width:${magnitude}%; --bar-color:${row.changePct >= 0 ? "var(--green)" : "var(--red)"}">
            <span></span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTable(rows) {
  tableBody.innerHTML = rows
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${row.name}</strong></td>
          <td>${row.code}</td>
          <td>${formatNumber(row.latestClose)}</td>
          <td class="${toneClass(row.dayChangePct)}">${formatPercent(row.dayChangePct)}</td>
          <td class="${toneClass(row.changePct)}">${formatPercent(row.changePct)}</td>
          <td>${formatPercent(row.maxDrawdown)}</td>
          <td>${formatPercent(row.annualizedVolatility)}</td>
          <td>${formatDate(row.latestDate)}</td>
        </tr>
      `
    )
    .join("");
}

function renderError(error) {
  board.innerHTML = `
    <article class="sector-card error-card">
      <div class="sector-title">
        <h2>数据连接失败</h2>
      </div>
      <p class="sector-meta">${error.message}</p>
    </article>
  `;
}

async function loadData() {
  refreshButton.disabled = true;
  refreshButton.textContent = "刷新中";
  try {
    const response = await fetchDashboardData();
    const payload = await response.json();
    const rows = payload.data
      .filter((row) => !row.error)
      .sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity));
    renderSummary(rows, payload);
    latestRows = rows;
    renderFocus(rows);
    renderBoard(rows);
    renderTable(rows);
  } catch (error) {
    renderError(error);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "刷新";
  }
}

async function fetchDashboardData() {
  const endpoints = ["/api/industries", "api/industries.json"];
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (response.ok) return response;
      lastError = new Error(`${endpoint} HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("数据接口不可用");
}

function schedule() {
  if (timer) clearInterval(timer);
  const interval = Number(refreshInterval.value);
  if (interval > 0) timer = setInterval(loadData, interval);
}

refreshButton.addEventListener("click", loadData);
refreshInterval.addEventListener("change", schedule);
industryPicker.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-code]");
  if (!button) return;
  const code = button.dataset.code;
  if (selectedCodes.has(code)) {
    selectedCodes.delete(code);
  } else if (selectedCodes.size < lineColors.length) {
    selectedCodes.add(code);
  }
  renderFocus(latestRows);
});
selectLeadersButton.addEventListener("click", () => {
  selectedCodes = new Set(latestRows.slice(0, 4).map((row) => row.code));
  renderFocus(latestRows);
});
clearFocusButton.addEventListener("click", () => {
  selectedCodes = new Set();
  renderFocus(latestRows);
});

schedule();
loadData();
