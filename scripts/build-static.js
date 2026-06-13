import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchDashboard } from "../lib/dashboard-data.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(rootDir, "public");
const distDir = join(rootDir, "dist");
const apiDir = join(distDir, "api");

await rm(distDir, { force: true, recursive: true });
await cp(publicDir, distDir, { recursive: true });
await mkdir(apiDir, { recursive: true });

const payload = await fetchDashboard({ useCache: false });
const validRows = payload.data.filter((row) => !row.error);

if (validRows.length < 31 || !payload.startDate || !payload.latestTradingDate) {
  throw new Error(`Static build failed: only ${validRows.length}/31 industries have valid data`);
}

await writeFile(join(apiDir, "industries.json"), `${JSON.stringify(payload)}\n`);

console.log(
  `Built static dashboard: ${payload.data.length} industries, ${payload.startDate} to ${payload.latestTradingDate}`
);
