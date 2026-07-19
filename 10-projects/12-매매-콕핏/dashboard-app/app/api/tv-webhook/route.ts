import { NextResponse } from "next/server";
import { getEvents, saveEvents } from "@/lib/store";
import type { WebhookEvent, AlertSignal } from "@/lib/types";

export const dynamic = "force-dynamic";

// 대시보드에 표시할 최근 이벤트 조회 (프론트 폴링)
export async function GET() {
  return NextResponse.json(await getEvents());
}

// 이벤트 배열 교체 (확인처리/삭제용 — 클라이언트가 갱신된 전체 배열 전송)
export async function PUT(req: Request) {
  const items = (await req.json()) as WebhookEvent[];
  await saveEvents(items.slice(0, 200));
  return NextResponse.json(items);
}

function inferSignal(explicit: unknown, message: string): AlertSignal {
  const s = String(explicit ?? "").toLowerCase();
  if (s === "buy" || s === "sell" || s === "info") return s;
  if (/매수|하단|지지|buy|support/i.test(message)) return "buy";
  if (/매도|상단|저항|sell|resist/i.test(message)) return "sell";
  return "info";
}

// TradingView 알람 웹훅 수신. JSON 또는 평문 텍스트 모두 처리.
// TradingView Alert 메시지 예시(JSON):
//   {"ticker":"{{ticker}}","price":{{close}},"signal":"buy","message":"채널 하단 도달"}
export async function POST(req: Request) {
  let ticker = "";
  let message = "";
  let price: number | null = null;
  let signalRaw: unknown = "";

  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const b = (await req.json()) as Record<string, unknown>;
      ticker = String(b.ticker ?? b.symbol ?? "");
      message = String(b.message ?? b.text ?? JSON.stringify(b));
      signalRaw = b.signal;
      const rawPrice = b.price ?? b.close;
      price = rawPrice != null && Number.isFinite(Number(rawPrice)) ? Number(rawPrice) : null;
    } else {
      message = await req.text();
    }
  } catch {
    message = "(웹훅 파싱 실패)";
  }

  const events = await getEvents();
  const ev: WebhookEvent = {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ticker,
    message: message || "(빈 메시지)",
    price,
    signal: inferSignal(signalRaw, message),
    acknowledged: false,
    receivedAt: new Date().toISOString(),
  };
  events.unshift(ev);
  await saveEvents(events.slice(0, 200)); // 최근 200건 유지

  return NextResponse.json({ ok: true, event: ev });
}
