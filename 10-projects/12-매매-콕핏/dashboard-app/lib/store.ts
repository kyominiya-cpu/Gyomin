import { promises as fs } from "fs";
import path from "path";
import type { Settings, WatchItem, Position, WebhookEvent } from "./types";

// 사이드카 저장소: 순수 로컬 JSON. 원본 마스터 없음(신규 프로젝트).
const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(file: string, data: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), "utf-8");
}

export const DEFAULT_SETTINGS: Settings = {
  account: 10_000_000,
  riskPct: 1,
  heatCapPct: 6,
  buyProximityPct: 1.5,
  sellProximityPct: 1.5,
};

export const getSettings = () => readJson<Settings>("settings.json", DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => writeJson("settings.json", s);

export const getWatchlist = () => readJson<WatchItem[]>("watchlist.json", []);
export const saveWatchlist = (w: WatchItem[]) => writeJson("watchlist.json", w);

export const getPositions = () => readJson<Position[]>("positions.json", []);
export const savePositions = (p: Position[]) => writeJson("positions.json", p);

export const getEvents = () => readJson<WebhookEvent[]>("events.json", []);
export const saveEvents = (e: WebhookEvent[]) => writeJson("events.json", e);
