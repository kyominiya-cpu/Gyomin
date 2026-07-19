import type { Channel } from "./types";
import { lowerAt } from "./channel";
import type { Zone } from "./channel";

// 종목명 기반 결정적 시드 (가격 히스토리 피드 붙기 전까지 스파크라인 파형용)
function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return ((h % 1000) / 1000) * 3;
}

export interface Spark {
  upperPath: string;
  lowerPath: string;
  pricePath: string;
  bandPath: string;
  bandFill: string;
  priceColor: string;
  dotX: string;
  dotY: string;
}

const DAY = 86_400_000;

// 채널(앵커 외삽) + 현재가로 미니 스파크라인 SVG path 생성.
// 가격 경로는 실시간 히스토리 피드(L5) 붙기 전까지 결정적 파형으로 근사, 마지막 점은 실제 현재가에 고정.
export function spark(ch: Channel, price: number | null, today: string, zone: Zone, seedKey: string): Spark {
  const W = 130, H = 46, pad = 5, N = 26;
  const width = ch.width;
  const startMs = Date.parse(today) - (N - 1) * DAY;

  const lowers: number[] = [];
  const uppers: number[] = [];
  for (let i = 0; i < N; i++) {
    const d = new Date(startMs + i * DAY).toISOString().slice(0, 10);
    const lb = lowerAt(ch, d);
    lowers.push(lb);
    uppers.push(lb + width);
  }

  const seed = seedFrom(seedKey);
  const p = price ?? lowers[N - 1] + width / 2;
  const series: number[] = [];
  for (let i = 0; i < N; i++) {
    let frac = 0.5 + 0.32 * Math.sin(i * 0.8 + seed * 3) + 0.12 * Math.sin(i * 1.9 + seed);
    frac = Math.max(-0.15, Math.min(1.15, frac));
    series.push(lowers[i] + width * frac);
  }
  series[N - 1] = p;

  let mn = Infinity, mx = -Infinity;
  for (const v of [...series, ...lowers, ...uppers]) {
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const rng = mx - mn || 1;
  const X = (i: number) => pad + (i / (N - 1)) * (W - 2 * pad);
  const Y = (v: number) => H - pad - ((v - mn) / rng) * (H - 2 * pad);
  const toPath = (arr: number[]) => arr.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ");

  const bandPath =
    uppers.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ") +
    " " +
    lowers.map((_, i) => "L" + X(N - 1 - i).toFixed(1) + "," + Y(lowers[N - 1 - i]).toFixed(1)).join(" ") +
    " Z";

  const bandFill =
    zone === "buy" ? "rgba(34,197,94,.06)" :
    zone === "sell" ? "rgba(245,158,11,.06)" :
    zone === "breakdown" ? "rgba(239,68,68,.06)" : "rgba(139,147,163,.04)";
  const priceColor =
    zone === "breakdown" ? "#f0616d" :
    zone === "buy" ? "#cfe8d6" :
    zone === "sell" ? "#e6d0a8" : "#aeb6c4";

  return {
    upperPath: toPath(uppers),
    lowerPath: toPath(lowers),
    pricePath: toPath(series),
    bandPath,
    bandFill,
    priceColor,
    dotX: X(N - 1).toFixed(1),
    dotY: Y(series[N - 1]).toFixed(1),
  };
}
