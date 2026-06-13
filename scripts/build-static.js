import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchDashboard } from "../lib/dashboard-data.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(rootDir, "public");
const distDir = join(rootDir, "dist");
const apiDir = join(distDir, "api");
const previousSnapshotUrl =
  "https://cathyzhang0715.github.io/sw-industry-trend-dashboard/api/industries.json";

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
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
    });

    req.on("timeout", () => {
      req.destroy(new Error("Request timed out"));
    });
    req.on("error", reject);
  });
}

function validCount(payload) {
  return payload.data.filter((row) => !row.error).length;
}

async function loadPreviousSnapshot() {
  const payload = await requestJson(previousSnapshotUrl);
  if (!Array.isArray(payload.data) || validCount(payload) < 31) {
    throw new Error("Previous snapshot is missing complete industry data");
  }
  return {
    ...payload,
    asOf: Date.now(),
    stale: true,
    dataFetchError: "本次 GitHub Actions 未能从申万接口获取完整数据，暂用上一次成功快照。"
  };
}

await rm(distDir, { force: true, recursive: true });
await cp(publicDir, distDir, { recursive: true });
await mkdir(apiDir, { recursive: true });

let payload = await fetchDashboard({ useCache: false });
let validRows = payload.data.filter((row) => !row.error);
const failedRows = payload.data.filter((row) => row.error);

if (validRows.length < 31 || !payload.startDate || !payload.latestTradingDate) {
  console.error("Static build data fetch failed:");
  for (const row of failedRows) {
    console.error(`- ${row.code} ${row.name}: ${row.error}`);
  }

  try {
    payload = await loadPreviousSnapshot();
    validRows = payload.data.filter((row) => !row.error);
    console.warn(`Using previous published snapshot with ${validRows.length}/31 industries.`);
  } catch (error) {
    console.error(`Previous snapshot fallback failed: ${error.message}`);
    throw new Error(`Static build failed: only ${validRows.length}/31 industries have valid data`);
  }
}

await writeFile(join(apiDir, "industries.json"), `${JSON.stringify(payload)}\n`);

console.log(
  `Built static dashboard: ${payload.data.length} industries, ${payload.startDate} to ${payload.latestTradingDate}`
);
