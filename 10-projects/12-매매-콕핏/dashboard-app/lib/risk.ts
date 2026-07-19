import type { Position } from "./types";

export interface SizeResult {
  qty: number; // 매수 수량 (정수, 버림)
  riskAmount: number; // 1R = 계좌 × 리스크%
  riskPerShare: number; // 주당 리스크 = 진입 - 손절
  cost: number; // 총 매수금액 = 진입 × qty
}

// 포지션 사이징: 수량 = (계좌 × 리스크%) ÷ (진입가 - 손절가)  [롱 기준]
export function positionSize(account: number, riskPct: number, entry: number, stop: number): SizeResult {
  const riskAmount = account * (riskPct / 100);
  const riskPerShare = entry - stop;
  if (riskPerShare <= 0 || !Number.isFinite(riskPerShare)) {
    return { qty: 0, riskAmount, riskPerShare, cost: 0 };
  }
  const qty = Math.floor(riskAmount / riskPerShare);
  return { qty, riskAmount, riskPerShare, cost: qty * entry };
}

// 목표가까지의 R배수 = (목표 - 진입) ÷ (진입 - 손절)
export function rToTarget(entry: number, stop: number, target: number): number {
  const risk = entry - stop;
  if (risk <= 0) return 0;
  return (target - entry) / risk;
}

// 청산 시 실현 R = (청산 - 진입) ÷ (진입 - 손절)
export function realizedR(entry: number, stop: number, exit: number): number {
  const risk = entry - stop;
  if (risk <= 0) return 0;
  return (exit - entry) / risk;
}

// 포트폴리오 히트: 열린 포지션들의 남은 리스크 총합 (통화 + 계좌 대비 %)
export function portfolioHeat(positions: Position[], account: number): { heat: number; heatPct: number } {
  const heat = positions
    .filter((p) => p.status === "open")
    .reduce((sum, p) => sum + Math.max(0, p.entry - p.stop) * p.qty, 0);
  return { heat, heatPct: account > 0 ? (heat / account) * 100 : 0 };
}

// 성과 집계: 청산된 트레이드의 승률 · 평균 R · 기대값(R)
export function expectancy(positions: Position[]): {
  trades: number;
  winRate: number;
  avgR: number;
  expectancyR: number;
} {
  const closed = positions.filter((p) => p.status === "closed" && p.rMultiple != null);
  const n = closed.length;
  if (n === 0) return { trades: 0, winRate: 0, avgR: 0, expectancyR: 0 };
  const wins = closed.filter((p) => (p.rMultiple as number) > 0).length;
  const sumR = closed.reduce((s, p) => s + (p.rMultiple as number), 0);
  const avgR = sumR / n;
  return { trades: n, winRate: (wins / n) * 100, avgR, expectancyR: avgR };
}
