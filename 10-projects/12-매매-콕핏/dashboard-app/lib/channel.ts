import type { Channel } from "./types";

const MS_PER_DAY = 86_400_000;

export function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / MS_PER_DAY;
}

// 하단(지지) 선의 `on` 날짜 값 = 두 앵커점을 지나는 직선의 선형 외삽
export function lowerAt(ch: Channel, on: string): number {
  const [a, b] = ch.lower;
  const span = daysBetween(a.t, b.t);
  if (span === 0) return a.p; // 두 점 날짜 동일 → 수평선으로 간주
  const slopePerDay = (b.p - a.p) / span;
  return b.p + slopePerDay * daysBetween(b.t, on);
}

// 상단(저항) 선 = 하단 + 폭
export function upperAt(ch: Channel, on: string): number {
  return lowerAt(ch, on) + ch.width;
}

export type Zone = "buy" | "sell" | "neutral" | "breakdown";

export interface ChannelSnapshot {
  lower: number;
  upper: number;
  price: number | null;
  posPctOfChannel: number | null; // 0=하단, 100=상단 (채널 내 위치)
  toLowerPct: number | null; // 하단까지 남은 % (현재가 대비). 음수면 이탈
  toUpperPct: number | null; // 상단까지 남은 % (현재가 대비)
  belowLower: boolean; // 하단 이탈 → 손절 경보
  zone: Zone;
}

// 오늘(on) 기준 채널 스냅샷. 현재가와 비교해 매수존/분할매도존 근접 판정.
export function snapshot(
  ch: Channel,
  price: number | null,
  on: string,
  buyThreshPct = 1.5,
  sellThreshPct = 1.5,
): ChannelSnapshot {
  const lower = lowerAt(ch, on);
  const upper = upperAt(ch, on);

  if (price == null || !Number.isFinite(price)) {
    return {
      lower,
      upper,
      price: null,
      posPctOfChannel: null,
      toLowerPct: null,
      toUpperPct: null,
      belowLower: false,
      zone: "neutral",
    };
  }

  const height = upper - lower;
  const posPctOfChannel = height > 0 ? ((price - lower) / height) * 100 : null;
  const toLowerPct = ((price - lower) / price) * 100; // 하단까지 남은 여유
  const toUpperPct = ((upper - price) / price) * 100; // 상단까지 남은 여유
  const belowLower = price < lower;

  let zone: Zone;
  if (belowLower) zone = "breakdown";
  else if (toLowerPct <= buyThreshPct) zone = "buy";
  else if (toUpperPct <= sellThreshPct) zone = "sell";
  else zone = "neutral";

  return { lower, upper, price, posPctOfChannel, toLowerPct, toUpperPct, belowLower, zone };
}
