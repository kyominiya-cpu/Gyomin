// 3장부: 데이(단타) / 포지션(스윙~중기) / 중장기
export type Ledger = "day" | "position" | "longterm";

export const LEDGER_LABEL: Record<Ledger, string> = {
  day: "데이",
  position: "포지션",
  longterm: "중장기",
};

// 채널 선 위의 한 점 (날짜 + 가격)
export interface Anchor {
  t: string; // ISO date "YYYY-MM-DD"
  p: number; // price
}

// 평행 추세 채널.
//  - lower: 하단(지지) 선을 정의하는 두 앵커점
//  - width: 하단선에서 상단(저항)선까지의 수직 가격 폭 (상단 = 하단 + width)
// 선은 두 점으로 완전히 결정되므로, 매일 값이 변해도 재입력 불필요.
// 채널을 다시 그릴 때만 앵커를 갱신.
export interface Channel {
  lower: [Anchor, Anchor];
  width: number;
}

// 플레이북 진입 게이트 (포지션 장부 플레이북 v1 기준)
export interface Checklist {
  maAligned: boolean; // 이평선 정배열 (추세 ON)
  macd: boolean; // MACD 동의
  volume: boolean; // 거래량 증가
  reversalCandle: boolean; // 반등 캔들(아랫꼬리/양봉)
}

export interface WatchItem {
  id: string;
  ticker: string; // 표시 이름 e.g. "삼성전자"
  tvSymbol: string; // TradingView 심볼 e.g. "KRX:005930"
  ledger: Ledger;
  channel: Channel;
  currentPrice: number | null; // 수동 입력(현재가). v1은 실시간 피드 없음
  checklist: Checklist;
  note?: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  ticker: string;
  ledger: Ledger;
  entry: number;
  stop: number;
  qty: number;
  target: number | null; // 상단(분할매도 목표)
  riskAmount: number; // 1R (통화)
  status: "open" | "closed";
  exit: number | null;
  rMultiple: number | null; // 실현 R
  openedAt: string;
  closedAt: string | null;
  note?: string;
}

export interface Settings {
  account: number; // 계좌 규모 (KRW)
  riskPct: number; // 트레이드당 리스크 % (예: 1)
  heatCapPct: number; // 포트폴리오 히트 상한 % (예: 6)
  buyProximityPct: number; // 매수존 근접 임계 % (예: 1.5)
  sellProximityPct: number; // 분할매도 근접 임계 %
}

export type AlertSignal = "buy" | "sell" | "info";

export interface WebhookEvent {
  id: string;
  ticker: string;
  message: string;
  price: number | null;
  signal: AlertSignal;
  acknowledged: boolean;
  receivedAt: string;
}
