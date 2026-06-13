import https from "node:https";

const cacheTtlMs = 10 * 60 * 1000;
const maxRetries = 1;
const batchSize = 6;
const requestTimeoutMs = 8000;

const industries = [
  { code: "801010", name: "农林牧渔" },
  { code: "801030", name: "基础化工" },
  { code: "801040", name: "钢铁" },
  { code: "801050", name: "有色金属" },
  { code: "801080", name: "电子" },
  { code: "801110", name: "家用电器" },
  { code: "801120", name: "食品饮料" },
  { code: "801130", name: "纺织服饰" },
  { code: "801140", name: "轻工制造" },
  { code: "801150", name: "医药生物" },
  { code: "801160", name: "公用事业" },
  { code: "801170", name: "交通运输" },
  { code: "801180", name: "房地产" },
  { code: "801200", name: "商贸零售" },
  { code: "801210", name: "社会服务" },
  { code: "801230", name: "综合" },
  { code: "801710", name: "建筑材料" },
  { code: "801720", name: "建筑装饰" },
  { code: "801730", name: "电力设备" },
  { code: "801740", name: "国防军工" },
  { code: "801750", name: "计算机" },
  { code: "801760", name: "传媒" },
  { code: "801770", name: "通信" },
  { code: "801780", name: "银行" },
  { code: "801790", name: "非银金融" },
  { code: "801880", name: "汽车" },
  { code: "801890", name: "机械设备" },
  { code: "801950", name: "煤炭" },
  { code: "801960", name: "石油石化" },
  { code: "801970", name: "环保" },
  { code: "801980", name: "美容护理" }
];

let cache = null;

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  const parsed = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function calculateMaxDrawdown(points) {
  let peak = -Infinity;
  let drawdown = 0;

  for (const point of points) {
    if (point.close > peak) peak = point.close;
    if (peak > 0) drawdown = Math.min(drawdown, ((point.close - peak) / peak) * 100);
  }

  return drawdown;
}

function calculateVolatility(points) {
  const returns = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1].close;
    const current = points[index].close;
    if (previous > 0 && current > 0) returns.push((current - previous) / previous);
  }

  if (!returns.length) return 0;
  const average = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        rejectUnauthorized: false,
        timeout: requestTimeoutMs,
        headers: {
          accept: "application/json",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36"
        }
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Invalid JSON: ${error.message}`));
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Request timed out"));
    });
    req.on("error", reject);
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function requestJsonWithRetry(url) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await requestJson(url);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await wait(800 * (attempt + 1));
    }
  }

  throw lastError;
}

function normalizePoint(row) {
  const close = parseNumber(row.closeindex);
  const open = parseNumber(row.openindex);
  const high = parseNumber(row.maxindex);
  const low = parseNumber(row.minindex);
  const amount = parseNumber(row.bargainamount);
  const turnover = parseNumber(row.bargainsum);

  if (!row.bargaindate || close === null) return null;

  return {
    date: row.bargaindate,
    close,
    open,
    high,
    low,
    amount,
    turnover
  };
}

function summarizeIndustry(industry, rawRows) {
  const allPoints = rawRows
    .map(normalizePoint)
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!allPoints.length) throw new Error(`${industry.code} missing history`);

  const latest = allPoints.at(-1);
  const latestDate = parseDate(latest.date);
  const cutoff = addMonths(latestDate, -3);
  const points = allPoints.filter((point) => parseDate(point.date) >= cutoff);
  const first = points[0];
  const change = latest.close - first.close;
  const changePct = first.close ? (change / first.close) * 100 : 0;
  const latestPoint = points.at(-1);
  const previousPoint = points.at(-2);
  const dayChange = previousPoint ? latestPoint.close - previousPoint.close : 0;
  const dayChangePct = previousPoint?.close ? (dayChange / previousPoint.close) * 100 : 0;

  return {
    ...industry,
    latestDate: latest.date,
    startDate: first.date,
    latestClose: latest.close,
    startClose: first.close,
    change,
    changePct,
    dayChange,
    dayChangePct,
    high: Math.max(...points.map((point) => point.high ?? point.close)),
    low: Math.min(...points.map((point) => point.low ?? point.close)),
    maxDrawdown: calculateMaxDrawdown(points),
    annualizedVolatility: calculateVolatility(points),
    points
  };
}

async function fetchIndustry(industry) {
  const url = new URL("https://www.swsresearch.com/institute-sw/api/index_publish/trend/");
  url.searchParams.set("swindexcode", industry.code);
  url.searchParams.set("period", "DAY");

  const payload = await requestJsonWithRetry(url);
  if (payload.code !== "200" || !Array.isArray(payload.data)) {
    throw new Error(`${industry.code} unexpected response`);
  }

  return summarizeIndustry(industry, payload.data);
}

export async function fetchDashboard({ useCache = true } = {}) {
  if (useCache && cache && Date.now() - cache.fetchedAt < cacheTtlMs) {
    return {
      ...cache.payload,
      asOf: Date.now(),
      dataFetchedAt: cache.fetchedAt
    };
  }

  const settled = [];
  for (let index = 0; index < industries.length; index += batchSize) {
    const batch = industries.slice(index, index + batchSize);
    settled.push(...(await Promise.allSettled(batch.map(fetchIndustry))));
  }
  const data = settled.map((item, index) => {
    if (item.status === "fulfilled") return item.value;
    return { ...industries[index], error: item.reason.message, points: [] };
  });
  const valid = data.filter((row) => Number.isFinite(row.changePct));
  const latestTradingDate = valid
    .map((row) => row.latestDate)
    .sort((a, b) => b.localeCompare(a))[0];
  const startDate = valid
    .map((row) => row.startDate)
    .sort((a, b) => a.localeCompare(b))[0];

  const payload = {
    asOf: Date.now(),
    dataFetchedAt: Date.now(),
    latestTradingDate,
    startDate,
    source: "申万宏源研究指数发布趋势接口",
    note: "使用申万一级行业分类 31 个一级指数，服务端截取各指数最新交易日前三个月日线。",
    data
  };

  cache = { fetchedAt: Date.now(), payload };
  return payload;
}
