"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { WatchItem, Position, Settings, WebhookEvent, Checklist } from "@/lib/types";
import { LEDGER_LABEL } from "@/lib/types";
import { snapshot, type Zone } from "@/lib/channel";
import { positionSize, portfolioHeat, expectancy, realizedR } from "@/lib/risk";
import { spark } from "@/lib/spark";
import { won, num, todayISO, uid } from "@/lib/format";
import { beep, notify, ensureNotifyPermission, SIGNAL_LABEL } from "@/lib/notify";
import { C } from "@/lib/theme";
import { DOMESTIC_IDX, US_IDX, NEWS } from "@/lib/marketSample";

/* ---------- 공통 스타일 ---------- */
const panel: CSSProperties = { background: C.panel, border: `1px solid ${C.edge}`, borderRadius: 6, overflow: "hidden" };
const head: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderBottom: `1px solid ${C.edge}` };
const headTitle: CSSProperties = { font: "600 12.5px 'IBM Plex Sans KR'", color: C.text };
const mono: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums" };

const ZONE: Record<Zone, { label: string; fg: string; bg: string; border: string; dot: string }> = {
  buy: { label: "매수존 근접", fg: "#a7ecc0", bg: "#122016", border: "#1f4a30", dot: C.buy },
  sell: { label: "분할매도 근접", fg: "#f4c987", bg: "#221a0e", border: "#4a3a1a", dot: C.warn },
  breakdown: { label: "하단 이탈 · 손절", fg: "#ffb3b8", bg: "#2a1416", border: "#5a2328", dot: C.sell },
  neutral: { label: "중립", fg: "#9aa2b1", bg: C.row, border: C.edge2, dot: "#6b7484" },
};

const GATE_DEFS: { key: keyof Checklist; label: string; title: string }[] = [
  { key: "maAligned", label: "정", title: "정배열" },
  { key: "macd", label: "M", title: "MACD" },
  { key: "volume", label: "거", title: "거래량" },
  { key: "reversalCandle", label: "캔", title: "반등캔들" },
];

async function put(url: string, body: unknown) {
  await fetch(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

interface Calc {
  symbolId: string;
  entry: string;
  stop: string;
  target: string;
}

export default function Terminal({
  initialSettings,
  initialWatchlist,
  initialPositions,
}: {
  initialSettings: Settings;
  initialWatchlist: WatchItem[];
  initialPositions: Position[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [positions, setPositions] = useState(initialPositions);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [clock, setClock] = useState("--:--:--");
  const [pushOn, setPushOn] = useState(false);
  const seenRef = useRef<Set<string> | null>(null);

  const first = initialWatchlist[0];
  const [calc, setCalc] = useState<Calc>(() => {
    if (!first) return { symbolId: "", entry: "", stop: "", target: "" };
    const s = snapshot(first.channel, first.currentPrice, todayISO());
    return { symbolId: first.id, entry: String(first.currentPrice ?? ""), stop: String(Math.round(s.lower)), target: String(Math.round(s.upper)) };
  });

  const today = todayISO();

  const saveWatch = useCallback((next: WatchItem[]) => { setWatchlist(next); void put("/api/watchlist", next); }, []);
  const savePositions = useCallback((next: Position[]) => { setPositions(next); void put("/api/positions", next); }, []);
  const saveSettings = useCallback((next: Settings) => { setSettings(next); void put("/api/settings", next); }, []);
  const saveEvents = useCallback((next: WebhookEvent[]) => { setEvents(next); void put("/api/tv-webhook", next); }, []);

  const toggleGate = useCallback((id: string, key: keyof Checklist) => {
    setWatchlist((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, checklist: { ...w.checklist, [key]: !w.checklist[key] } } : w));
      void put("/api/watchlist", next);
      return next;
    });
  }, []);

  const selectForSizing = useCallback((it: WatchItem) => {
    const s = snapshot(it.channel, it.currentPrice, today);
    setCalc({ symbolId: it.id, entry: String(it.currentPrice ?? ""), stop: String(Math.round(s.lower)), target: String(Math.round(s.upper)) });
  }, [today]);

  const ackEvent = useCallback((id: string) => {
    setEvents((prev) => { const next = prev.map((e) => (e.id === id ? { ...e, acknowledged: true } : e)); void put("/api/tv-webhook", next); return next; });
  }, []);

  const enablePush = useCallback(async () => { const ok = await ensureNotifyPermission(); setPushOn(ok); if (ok) beep("info"); }, []);

  // clock
  useEffect(() => {
    const tick = () => { const d = new Date(); setClock([d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":")); };
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);

  // 알림 폴링 + 신규 발사
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setPushOn(Notification.permission === "granted");
    let alive = true;
    const load = () => fetch("/api/tv-webhook").then((r) => r.json()).then((d: WebhookEvent[]) => {
      if (!alive) return; setEvents(d);
      if (seenRef.current === null) { seenRef.current = new Set(d.map((e) => e.id)); return; }
      for (const e of d) { if (seenRef.current.has(e.id)) continue; seenRef.current.add(e.id); if (!e.acknowledged) { notify(`${e.ticker || "알림"} · ${SIGNAL_LABEL[e.signal]}`, e.message); beep(e.signal); } }
    }).catch(() => {});
    load(); const t = setInterval(load, 15000); return () => { alive = false; clearInterval(t); };
  }, []);

  // 사냥 리스트 뷰모델 (매수존/이탈이 위로 오도록 하단까지% 오름차순 정렬)
  const items = useMemo(() => {
    return watchlist
      .map((it) => {
        const s = snapshot(it.channel, it.currentPrice, today, settings.buyProximityPct, settings.sellProximityPct);
        return { it, s, sp: spark(it.channel, it.currentPrice, today, s.zone, it.id), sortKey: s.toLowerPct ?? 9999 };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [watchlist, today, settings.buyProximityPct, settings.sellProximityPct]);

  const buyCount = items.filter((r) => r.s.zone === "buy").length;
  const sellCount = items.filter((r) => r.s.zone === "sell").length;
  const breakCount = items.filter((r) => r.s.zone === "breakdown").length;

  const heat = portfolioHeat(positions, settings.account);
  const stats = expectancy(positions);
  const unread = events.filter((e) => !e.acknowledged).length;

  // 사이징 계산
  const calcItem = watchlist.find((w) => w.id === calc.symbolId) ?? null;
  const entry = parseFloat(calc.entry), stop = parseFloat(calc.stop), target = parseFloat(calc.target);
  const valid = Number.isFinite(entry) && Number.isFinite(stop) && entry > stop;
  const size = valid ? positionSize(settings.account, settings.riskPct, entry, stop) : null;
  const targetR = valid && Number.isFinite(target) ? (target - entry) / (entry - stop) : NaN;
  const thisHeatPct = size ? (size.riskPerShare * size.qty) / settings.account * 100 : 0;
  const newHeat = heat.heatPct + thisHeatPct;
  const trendOff = !!calcItem && !calcItem.checklist.maAligned;
  const overCap = newHeat > settings.heatCapPct;
  const calcWarn = !valid || overCap || trendOff;
  const calcWarnMsg = !valid
    ? "진입가는 손절가보다 높아야 합니다."
    : trendOff
    ? "역배열(정배열 OFF) — 플레이북상 매수 금지 자리입니다."
    : `포트폴리오 히트 상한(${settings.heatCapPct}%) 초과 — 수량을 줄이세요.`;

  const addPosition = () => {
    if (!size || size.qty <= 0 || !calcItem) return;
    const pos: Position = {
      id: uid("pos"), ticker: calcItem.ticker, ledger: calcItem.ledger,
      entry, stop, qty: size.qty, target: Number.isFinite(target) ? target : null,
      riskAmount: size.riskPerShare * size.qty, status: "open", exit: null, rMultiple: null,
      openedAt: today, closedAt: null,
    };
    savePositions([pos, ...positions]);
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.ink, color: "#d1d4dc", overflow: "hidden" }}>
      <TopBar clock={clock} date={today} />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Rail />
        <div style={{ flex: 1, overflow: "auto", padding: 10, display: "grid", gridTemplateColumns: "288px minmax(560px,1fr) 372px", gap: 10, alignContent: "start", background: C.ink, minWidth: 1420 }}>
          {/* COLUMN A */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <IdxPanel title="국내 지수" tag="샘플 · KRX" rows={DOMESTIC_IDX} />
            <IdxPanel title="미국 지수 · 선물" tag="샘플" rows={US_IDX} />
            <NewsPanel />
          </div>

          {/* COLUMN B */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <HuntList
              rows={items} prox={settings.buyProximityPct} buyCount={buyCount} sellCount={sellCount} breakCount={breakCount}
              onToggleGate={toggleGate} onSelect={selectForSizing} selectedId={calc.symbolId}
            />
            <Ledger positions={positions} watchlist={watchlist} stats={stats} heat={heat} heatCap={settings.heatCapPct} onChange={savePositions} today={today} />
          </div>

          {/* COLUMN C */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <Sizer
              watchlist={watchlist} calc={calc} setCalc={setCalc} onSelect={selectForSizing}
              size={size} valid={valid} targetR={targetR} newHeat={newHeat} overCap={overCap}
              warn={calcWarn} warnMsg={calcWarnMsg} riskPct={settings.riskPct} onLog={addPosition}
            />
            <AlertsPanel events={events} unread={unread} pushOn={pushOn} onAck={ackEvent} onEnablePush={enablePush} />
            <SettingsSummary settings={settings} onChange={saveSettings} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= TOP BAR ================= */
function TopBar({ clock, date }: { clock: string; date: string }) {
  return (
    <div style={{ height: 46, flex: "0 0 46px", display: "flex", alignItems: "center", gap: 12, padding: "0 14px", background: C.ink, borderBottom: "1px solid #202636" }}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: "linear-gradient(135deg,#22c55e,#0e9f6e)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#04140c", fontSize: 13 }}>채</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 380px", height: 30, background: C.panel2, border: `1px solid ${C.edge}`, borderRadius: 7, padding: "0 10px" }}>
        <span style={{ color: C.dim, fontSize: 12.5 }}>🔍 종목·티커·기능 검색</span>
        <span style={{ marginLeft: "auto", color: C.dim2, border: `1px solid ${C.edge2}`, borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>/</span>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#111a12", border: "1px solid #1f3a26", borderRadius: 6, padding: "4px 9px" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.buy, boxShadow: `0 0 6px ${C.buy}` }} />
          <span style={{ fontSize: 11.5, color: C.buySoft, fontWeight: 600 }}>장중</span>
        </div>
        <span style={{ ...mono, font: "500 12px 'IBM Plex Mono'", color: C.muted }}>{date}</span>
        <span style={{ ...mono, font: "600 12px 'IBM Plex Mono'", color: C.text, minWidth: 58, textAlign: "right" }}>{clock}</span>
      </div>
    </div>
  );
}

/* ================= RAIL ================= */
function Rail() {
  const items = ["시세", "사냥", "사이징", "장부", "알림", "설정"];
  return (
    <div style={{ width: 50, flex: "0 0 50px", background: C.ink, borderRight: "1px solid #202636", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 10, gap: 6 }}>
      {items.map((label, i) => (
        <div key={label} title={label} style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 10, color: i === 0 ? C.blue : C.muted, background: i === 0 ? C.blueBg : "transparent", position: "relative" }}>
          {label}
          {i === 0 && <span style={{ position: "absolute", left: -9, top: 8, width: 3, height: 20, borderRadius: 3, background: C.blue }} />}
        </div>
      ))}
    </div>
  );
}

/* ================= COLUMN A ================= */
function IdxPanel({ title, tag, rows }: { title: string; tag: string; rows: typeof DOMESTIC_IDX }) {
  return (
    <div style={panel}>
      <div style={{ ...head, padding: "8px 12px" }}>
        <span style={headTitle}>{title}</span>
        <span style={{ fontSize: 10, color: C.dim, letterSpacing: ".5px" }}>{tag}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 82px 60px 44px", padding: "5px 12px", borderBottom: `1px solid ${C.edgeDim}`, font: "600 10px 'IBM Plex Sans KR'", color: C.dim, textTransform: "uppercase", letterSpacing: ".4px" }}>
        <span>지수</span><span style={{ textAlign: "right" }}>현재</span><span style={{ textAlign: "right" }}>대비</span><span style={{ textAlign: "right" }}>%</span>
      </div>
      {rows.map((q) => (
        <div key={q.name} style={{ display: "grid", gridTemplateColumns: "1fr 82px 60px 44px", padding: "6px 12px", alignItems: "center", borderBottom: `1px solid ${C.row}` }}>
          <span style={{ fontSize: 12, color: C.text2 }}>{q.name}</span>
          <span style={{ ...mono, font: "500 12px 'IBM Plex Mono'", textAlign: "right", color: C.text }}>{q.price}</span>
          <span style={{ ...mono, font: "500 11.5px 'IBM Plex Mono'", textAlign: "right", color: q.up ? C.buy : C.sell }}>{q.chg}</span>
          <span style={{ ...mono, font: "500 11.5px 'IBM Plex Mono'", textAlign: "right", color: q.up ? C.buy : C.sell }}>{q.pct}</span>
        </div>
      ))}
    </div>
  );
}

function NewsPanel() {
  return (
    <div style={panel}>
      <div style={{ ...head, padding: "8px 12px" }}>
        <span style={headTitle}>시장 뉴스</span>
        <span style={{ fontSize: 10, color: C.dim }}>샘플</span>
      </div>
      {NEWS.map((n, i) => (
        <div key={i} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.row}`, cursor: "pointer" }}>
          <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.35 }}>{n.title}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 10.5, color: C.dim }}><span>{n.src}</span><span>·</span><span>{n.time}</span></div>
        </div>
      ))}
    </div>
  );
}

/* ================= COLUMN B: HUNT LIST ================= */
type Row = { it: WatchItem; s: ReturnType<typeof snapshot>; sp: ReturnType<typeof spark>; sortKey: number };

function HuntList({ rows, prox, buyCount, sellCount, breakCount, onToggleGate, onSelect, selectedId }: {
  rows: Row[]; prox: number; buyCount: number; sellCount: number; breakCount: number;
  onToggleGate: (id: string, k: keyof Checklist) => void; onSelect: (it: WatchItem) => void; selectedId: string;
}) {
  const cols = "26px 158px 138px 92px 96px 92px 74px 74px 96px 118px";
  return (
    <div style={{ ...panel, border: "1px solid #2a3550", boxShadow: "0 0 0 1px rgba(76,159,254,.08)" }}>
      <div style={{ ...head, background: "linear-gradient(90deg,rgba(76,159,254,.06),transparent)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 15, borderRadius: 2, background: C.blue }} />
          <span style={{ font: "700 13.5px 'IBM Plex Sans KR'", color: C.text1 }}>채널 사냥 리스트</span>
          <span style={{ fontSize: 10, color: C.blue, border: `1px solid ${C.blueEdge}`, background: C.blueBg, borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>핵심 ★</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: C.buySoft }}>매수존 {buyCount}</span>
          <span style={{ fontSize: 11, color: C.warnSoft }}>분할매도 {sellCount}</span>
          <span style={{ fontSize: 11, color: C.sellSoft }}>이탈 {breakCount}</span>
          <span style={{ fontSize: 10, color: C.dim, borderLeft: `1px solid ${C.edge2}`, paddingLeft: 10 }}>근접 ±{prox}%</span>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 960 }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, padding: "7px 12px", borderBottom: `1px solid ${C.edge}`, font: "600 10px 'IBM Plex Sans KR'", color: C.dim, textTransform: "uppercase", letterSpacing: ".4px" }}>
            <span /><span>종목 · 장부</span><span style={{ textAlign: "center" }}>채널</span><span style={{ textAlign: "right" }}>오늘 하단</span><span style={{ textAlign: "right" }}>현재가</span><span style={{ textAlign: "right" }}>오늘 상단</span><span style={{ textAlign: "right" }}>→하단</span><span style={{ textAlign: "right" }}>→상단</span><span style={{ textAlign: "center" }}>플레이북</span><span style={{ textAlign: "right" }}>상태</span>
          </div>
          {rows.length === 0 && <div style={{ padding: "30px 12px", textAlign: "center", color: C.dim, fontSize: 12 }}>관심종목이 없습니다.</div>}
          {rows.map(({ it, s, sp }) => {
            const z = ZONE[s.zone];
            const rowBg = selectedId === it.id ? "rgba(76,159,254,.08)" : s.zone === "breakdown" ? "rgba(239,68,68,.05)" : s.zone === "buy" ? "rgba(34,197,94,.04)" : "transparent";
            return (
              <div key={it.id} onClick={() => onSelect(it)} style={{ display: "grid", gridTemplateColumns: cols, padding: "8px 12px", alignItems: "center", borderBottom: `1px solid ${C.row}`, background: rowBg, cursor: "pointer" }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${z.dot}`, background: s.zone === "neutral" ? "transparent" : z.dot }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "600 13px 'IBM Plex Sans KR'", color: "#eceff4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.ticker || "(이름없음)"}</div>
                  <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 9.5, color: C.muted, background: C.edgeDim2, borderRadius: 3, padding: "1px 5px" }}>{LEDGER_LABEL[it.ledger]}</span>
                    <span style={{ fontSize: 10, color: C.dim, fontFamily: "'IBM Plex Mono'" }}>{it.tvSymbol}</span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <svg width="130" height="46" viewBox="0 0 130 46" style={{ display: "block" }}>
                    <path d={sp.upperPath} fill="none" stroke="#4a3a1a" strokeWidth="1" strokeDasharray="3 2" />
                    <path d={sp.lowerPath} fill="none" stroke="#1e4030" strokeWidth="1" strokeDasharray="3 2" />
                    <path d={sp.bandPath} fill={sp.bandFill} stroke="none" />
                    <path d={sp.pricePath} fill="none" stroke={sp.priceColor} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx={sp.dotX} cy={sp.dotY} r="2.6" fill={z.dot} />
                    <circle cx={sp.dotX} cy={sp.dotY} r="5" fill="none" stroke={z.dot} strokeWidth="1" opacity="0.4" />
                  </svg>
                </div>
                <span style={{ ...mono, font: "500 12.5px 'IBM Plex Mono'", textAlign: "right", color: C.buy }}>{won(s.lower)}</span>
                <span style={{ ...mono, font: "600 13px 'IBM Plex Mono'", textAlign: "right", color: C.text1 }}>{it.currentPrice != null ? won(it.currentPrice) : "—"}</span>
                <span style={{ ...mono, font: "500 12.5px 'IBM Plex Mono'", textAlign: "right", color: C.warn }}>{won(s.upper)}</span>
                <span style={{ ...mono, font: "500 12px 'IBM Plex Mono'", textAlign: "right", color: s.zone === "breakdown" ? C.sellSoft : s.toLowerPct != null && s.toLowerPct <= prox ? C.buy : C.muted }}>{s.toLowerPct == null ? "—" : `${s.toLowerPct >= 0 ? "+" : "−"}${Math.abs(s.toLowerPct).toFixed(1)}%`}</span>
                <span style={{ ...mono, font: "500 12px 'IBM Plex Mono'", textAlign: "right", color: s.toUpperPct != null && s.toUpperPct <= prox && s.zone !== "breakdown" ? C.warn : C.muted }}>{s.toUpperPct == null ? "—" : `${s.toUpperPct >= 0 ? "+" : "−"}${Math.abs(s.toUpperPct).toFixed(1)}%`}</span>
                <div style={{ display: "flex", gap: 3, justifyContent: "center" }} onClick={(e) => e.stopPropagation()}>
                  {GATE_DEFS.map((g) => {
                    const on = it.checklist[g.key];
                    return (
                      <span key={g.key} onClick={() => onToggleGate(it.id, g.key)} title={g.title} style={{ width: 19, height: 19, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", font: "600 9.5px 'IBM Plex Sans KR'", border: `1px solid ${on ? "#2a6b45" : C.edge2}`, background: on ? "#1a3a26" : C.panel2, color: on ? C.buySoft : C.dim }}>{g.label}</span>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <span style={{ font: "600 11px 'IBM Plex Sans KR'", padding: "3px 8px", borderRadius: 5, whiteSpace: "nowrap", color: z.fg, background: z.bg, border: `1px solid ${z.border}` }}>{z.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ padding: "7px 12px", display: "flex", gap: 14, alignItems: "center", background: C.card, fontSize: 10.5, color: C.dim }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, borderTop: "1.5px dashed #1e4030" }} />채널 하단(지지)</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, borderTop: "1.5px dashed #4a3a1a" }} />채널 상단(분할매도)</span>
        <span style={{ marginLeft: "auto" }}>행 클릭 → 사이징 · 게이트 클릭 토글 (정·M·거·캔)</span>
      </div>
    </div>
  );
}

/* ================= COLUMN B: LEDGER ================= */
function Ledger({ positions, watchlist, stats, heat, heatCap, onChange, today }: {
  positions: Position[]; watchlist: WatchItem[]; stats: ReturnType<typeof expectancy>;
  heat: ReturnType<typeof portfolioHeat>; heatCap: number; onChange: (p: Position[]) => void; today: string;
}) {
  const open = positions.filter((p) => p.status === "open");
  const closed = positions.filter((p) => p.status === "closed");
  const [exitIn, setExitIn] = useState<Record<string, string>>({});
  const priceOf = (ticker: string) => watchlist.find((w) => w.ticker === ticker)?.currentPrice ?? null;
  const heatColor = heat.heatPct > heatCap ? C.sellSoft : heat.heatPct > heatCap * 0.75 ? C.warnSoft : C.buySoft;
  const cols = "1fr 70px 70px 52px 92px 56px 44px";

  const close = (id: string) => {
    const p = positions.find((x) => x.id === id); const raw = exitIn[id];
    if (!p || !raw) return; const exit = Number(raw); const r = realizedR(p.entry, p.stop, exit);
    onChange(positions.map((x) => (x.id === id ? { ...x, status: "closed", exit, rMultiple: r, closedAt: today } : x)));
  };

  return (
    <div style={panel}>
      <div style={head}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={headTitle}>매매 장부</span>
          <span style={{ fontSize: 10, color: C.dim }}>데이 · 포지션 · 중장기</span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Stat label="승률" val={stats.trades ? `${stats.winRate.toFixed(0)}%` : "—"} />
          <Stat label="기대값" val={stats.trades ? `${stats.expectancyR >= 0 ? "+" : ""}${stats.expectancyR.toFixed(2)}R` : "—"} color={C.buy} />
          <Stat label="포트폴리오 히트" val={`${heat.heatPct.toFixed(1)}% / ${heatCap.toFixed(1)}%`} color={heatColor} />
        </div>
      </div>

      <SubHead text="열린 포지션" />
      <LedgerHead cols={cols} last="R" mid="평가손익" />
      {open.length === 0 && <Empty text="열린 포지션 없음" />}
      {open.map((p) => {
        const cp = priceOf(p.ticker);
        const pnl = cp != null ? (cp - p.entry) * p.qty : null;
        const r = cp != null ? (cp - p.entry) / (p.entry - p.stop) : null;
        const col = (pnl ?? 0) >= 0 ? C.buy : C.sell;
        return (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: cols, padding: "6px 12px", alignItems: "center", borderTop: `1px solid ${C.row}` }}>
            <NameCell name={p.ticker} book={LEDGER_LABEL[p.ledger]} />
            <Cell v={won(p.entry)} /><Cell v={won(p.stop)} c={C.sellSoft} /><Cell v={num(p.qty)} />
            <Cell v={pnl == null ? "—" : `${pnl >= 0 ? "+" : "−"}${won(Math.abs(pnl))}`} c={col} bold />
            <Cell v={r == null ? "—" : `${r >= 0 ? "+" : ""}${r.toFixed(2)}R`} c={col} bold />
            <div style={{ display: "flex", gap: 3, justifyContent: "flex-end" }}>
              <input value={exitIn[p.id] ?? ""} onChange={(e) => setExitIn({ ...exitIn, [p.id]: e.target.value })} placeholder="청산" style={{ width: 44, height: 22, background: C.card, border: `1px solid ${C.edge2}`, borderRadius: 4, color: C.text, ...mono, fontSize: 10, textAlign: "right", padding: "0 4px" }} />
              <button onClick={() => close(p.id)} style={{ height: 22, padding: "0 6px", background: C.edgeDim2, border: `1px solid ${C.edge2}`, borderRadius: 4, color: C.muted, fontSize: 10, cursor: "pointer" }}>✓</button>
            </div>
          </div>
        );
      })}

      <SubHead text="청산 기록" border />
      <LedgerHead cols={cols} last="R" mid="실현손익" midLeft="청산" />
      {closed.length === 0 && <Empty text="청산 기록 없음" />}
      {closed.map((p) => {
        const pnl = p.exit != null ? (p.exit - p.entry) * p.qty : 0;
        const r = p.rMultiple ?? 0; const col = r >= 0 ? C.buy : C.sell;
        return (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: cols, padding: "6px 12px", alignItems: "center", borderTop: `1px solid ${C.row}` }}>
            <NameCell name={p.ticker} book={LEDGER_LABEL[p.ledger]} dim />
            <Cell v={won(p.entry)} c={C.muted} /><Cell v={p.exit != null ? won(p.exit) : "—"} c={C.muted} /><Cell v={num(p.qty)} c={C.muted} />
            <Cell v={`${pnl >= 0 ? "+" : "−"}${won(Math.abs(pnl))}`} c={col} bold />
            <Cell v={`${r >= 0 ? "+" : ""}${r.toFixed(2)}R`} c={col} bold />
            <div style={{ textAlign: "right" }}><button onClick={() => onChange(positions.filter((x) => x.id !== p.id))} style={{ background: "none", border: "none", color: C.dim, fontSize: 10, cursor: "pointer" }}>✕</button></div>
          </div>
        );
      })}
    </div>
  );
}

/* ================= COLUMN C: SIZER ================= */
function Sizer({ watchlist, calc, setCalc, onSelect, size, valid, targetR, newHeat, overCap, warn, warnMsg, riskPct, onLog }: {
  watchlist: WatchItem[]; calc: Calc; setCalc: (c: Calc) => void; onSelect: (it: WatchItem) => void;
  size: ReturnType<typeof positionSize> | null; valid: boolean; targetR: number; newHeat: number; overCap: boolean;
  warn: boolean; warnMsg: string; riskPct: number; onLog: () => void;
}) {
  const inp: CSSProperties = { width: "100%", height: 32, background: C.card, border: `1px solid ${C.edge2}`, borderRadius: 6, color: C.text, ...mono, fontSize: 12.5, textAlign: "right", padding: "0 8px" };
  return (
    <div style={panel}>
      <div style={head}>
        <span style={headTitle}>포지션 사이징 계산기</span>
        <span style={{ fontSize: 10, color: C.dim }}>{riskPct}% 룰</span>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, color: C.dim, display: "block", marginBottom: 4 }}>종목</label>
          <select value={calc.symbolId} onChange={(e) => { const it = watchlist.find((w) => w.id === e.target.value); if (it) onSelect(it); }} style={{ width: "100%", height: 32, background: C.card, border: `1px solid ${C.edge2}`, borderRadius: 6, color: C.text, fontSize: 12.5, padding: "0 8px" }}>
            {watchlist.map((w) => <option key={w.id} value={w.id}>{w.ticker} · {LEDGER_LABEL[w.ledger]}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div><label style={{ fontSize: 10, color: C.dim, display: "block", marginBottom: 4 }}>진입가</label><input inputMode="decimal" value={calc.entry} onChange={(e) => setCalc({ ...calc, entry: e.target.value })} style={inp} /></div>
          <div><label style={{ fontSize: 10, color: C.buy, display: "block", marginBottom: 4 }}>손절가 (하단)</label><input inputMode="decimal" value={calc.stop} onChange={(e) => setCalc({ ...calc, stop: e.target.value })} style={{ ...inp, color: C.buySoft, borderColor: "#223a2b" }} /></div>
          <div><label style={{ fontSize: 10, color: C.warn, display: "block", marginBottom: 4 }}>목표가 (상단)</label><input inputMode="decimal" value={calc.target} onChange={(e) => setCalc({ ...calc, target: e.target.value })} style={{ ...inp, color: C.warnSoft, borderColor: "#3a3018" }} /></div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.edge}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10.5, color: C.dim, marginBottom: 2 }}>매수 수량</div>
              <div style={{ ...mono, font: "700 30px 'IBM Plex Mono'", color: C.blue, lineHeight: 1 }}>{size ? num(size.qty) : "0"}<span style={{ fontSize: 14, color: C.dim, marginLeft: 3 }}>주</span></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10.5, color: C.dim, marginBottom: 2 }}>총 매수금액</div>
              <div style={{ ...mono, font: "600 17px 'IBM Plex Mono'", color: C.text }}>{size && valid ? won(size.cost) : "—"}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <MiniBox label="1R · 주당 리스크" val={size && valid ? won(size.riskPerShare) : "—"} bg="#131a12" border="#1f3a26" color={C.buySoft} />
            <MiniBox label="목표 R배수" val={!isNaN(targetR) ? `${targetR.toFixed(2)}R` : "—"} bg="#1a1710" border="#3a3018" color={C.warnSoft} />
            <MiniBox label="트레이드 리스크" val={size && valid ? won(size.riskAmount) : "—"} bg={C.card} border={C.edge} color={C.text} />
            <MiniBox label="반영 후 히트" val={`${newHeat.toFixed(1)}%`} bg={overCap ? "#2a1416" : C.card} border={overCap ? "#5a2328" : C.edge} color={overCap ? C.sellSoft : C.buySoft} />
          </div>
          {warn && (
            <div style={{ marginTop: 10, background: "#2a1416", border: "1px solid #5a2328", borderRadius: 6, padding: "7px 10px", display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: C.sellSoft }}>⚠</span>
              <span style={{ fontSize: 11.5, color: "#f2a0a6" }}>{warnMsg}</span>
            </div>
          )}
        </div>
        <button onClick={onLog} disabled={!size || size.qty <= 0} style={{ width: "100%", height: 36, background: "#1a3a26", border: "1px solid #2a6b45", borderRadius: 7, color: C.buySoft, font: "600 13px 'IBM Plex Sans KR'", cursor: size && size.qty > 0 ? "pointer" : "not-allowed", opacity: size && size.qty > 0 ? 1 : 0.4 }}>＋ 장부에 진입 기록</button>
      </div>
    </div>
  );
}

/* ================= COLUMN C: ALERTS ================= */
function AlertsPanel({ events, unread, pushOn, onAck, onEnablePush }: {
  events: WebhookEvent[]; unread: number; pushOn: boolean; onAck: (id: string) => void; onEnablePush: () => void;
}) {
  const dotFor = (sig: string) => (sig === "sell" ? C.warn : sig === "buy" ? C.buy : C.muted);
  const active = events.filter((e) => !e.acknowledged);
  return (
    <div style={panel}>
      <div style={head}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ color: C.warnSoft }}>🔔</span>
          <span style={headTitle}>알림 · 웹훅 수신 {unread > 0 && <span style={{ color: C.warnSoft }}>· {unread}</span>}</span>
        </div>
        <button onClick={onEnablePush} style={{ fontSize: 10, color: pushOn ? C.buySoft : C.dim, background: "none", border: `1px solid ${pushOn ? "#1f3a26" : C.edge2}`, borderRadius: 5, padding: "2px 7px", cursor: "pointer" }}>{pushOn ? "알림 ON" : "알림 켜기"}</button>
      </div>
      {active.length === 0 && <div style={{ padding: "18px 12px", textAlign: "center", fontSize: 11.5, color: C.dim }}>모든 알림을 확인했습니다.</div>}
      {active.map((a) => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: `1px solid ${C.row}` }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotFor(a.signal), flex: "0 0 8px", boxShadow: `0 0 6px ${dotFor(a.signal)}` }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{a.ticker || "알림"} · {a.message}</div>
            <div style={{ fontSize: 10.5, color: C.dim, marginTop: 2, display: "flex", gap: 7 }}><span>{new Date(a.receivedAt).toLocaleString("ko-KR")}</span><span style={{ color: dotFor(a.signal) }}>{SIGNAL_LABEL[a.signal]}</span></div>
          </div>
          <button onClick={() => onAck(a.id)} style={{ height: 26, padding: "0 10px", background: C.edgeDim2, border: `1px solid ${C.edge2}`, borderRadius: 6, color: C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>확인</button>
        </div>
      ))}
    </div>
  );
}

/* ================= COLUMN C: SETTINGS ================= */
function SettingsSummary({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const [edit, setEdit] = useState(false);
  const [s, setS] = useState(settings);
  useEffect(() => setS(settings), [settings]);
  const cell = (label: string, key: keyof Settings, suffix = "") => (
    <div style={{ background: C.panel, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: C.dim }}>{label}</div>
      {edit ? (
        <input type="number" value={s[key]} onChange={(e) => setS({ ...s, [key]: Number(e.target.value) })} style={{ width: "100%", background: C.card, border: `1px solid ${C.edge2}`, borderRadius: 4, color: C.text, ...mono, fontSize: 13, padding: "2px 4px", marginTop: 2 }} />
      ) : (
        <div style={{ ...mono, font: "600 14px 'IBM Plex Mono'", color: C.text }}>{key === "account" ? won(settings.account) : `${settings[key]}${suffix}`}</div>
      )}
    </div>
  );
  return (
    <div style={panel}>
      <div style={head}>
        <span style={headTitle}>리스크 설정</span>
        {edit ? (
          <button onClick={() => { onChange(s); setEdit(false); }} style={{ fontSize: 10, color: C.buySoft, background: "none", border: `1px solid #1f3a26`, borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>저장</button>
        ) : (
          <button onClick={() => setEdit(true)} style={{ fontSize: 10, color: C.dim, background: "none", border: `1px solid ${C.edge2}`, borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>수정</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: C.edgeDim }}>
        {cell("계좌 규모 (₩)", "account")}
        {cell("트레이드 리스크", "riskPct", "%")}
        {cell("히트 상한", "heatCapPct", "%")}
        {cell("근접 임계", "buyProximityPct", "%")}
      </div>
    </div>
  );
}

/* ================= 작은 조각들 ================= */
function Stat({ label, val, color }: { label: string; val: string; color?: string }) {
  return <div style={{ textAlign: "right" }}><div style={{ fontSize: 9.5, color: C.dim }}>{label}</div><div style={{ ...mono, font: "600 12.5px 'IBM Plex Mono'", color: color ?? C.text }}>{val}</div></div>;
}
function SubHead({ text, border }: { text: string; border?: boolean }) {
  return <div style={{ padding: "8px 12px 3px", fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: ".4px", fontWeight: 600, borderTop: border ? `1px solid ${C.edgeDim}` : undefined }}>{text}</div>;
}
function LedgerHead({ cols, mid, last, midLeft }: { cols: string; mid: string; last: string; midLeft?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, padding: "4px 12px", font: "600 10px 'IBM Plex Sans KR'", color: C.dim, textTransform: "uppercase", letterSpacing: ".3px" }}>
      <span>종목·장부</span><span style={{ textAlign: "right" }}>진입</span><span style={{ textAlign: "right" }}>{midLeft ?? "손절"}</span><span style={{ textAlign: "right" }}>수량</span><span style={{ textAlign: "right" }}>{mid}</span><span style={{ textAlign: "right" }}>{last}</span><span />
    </div>
  );
}
function Empty({ text }: { text: string }) { return <div style={{ padding: "12px", textAlign: "center", fontSize: 11, color: C.dim }}>{text}</div>; }
function NameCell({ name, book, dim }: { name: string; book: string; dim?: boolean }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ fontSize: 12, color: dim ? C.text2 : "#eceff4", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span><span style={{ fontSize: 9, color: C.muted, background: C.edgeDim2, borderRadius: 3, padding: "1px 5px" }}>{book}</span></div>;
}
function Cell({ v, c, bold }: { v: string; c?: string; bold?: boolean }) {
  return <span style={{ ...mono, font: `${bold ? 600 : 500} 12px 'IBM Plex Mono'`, textAlign: "right", color: c ?? C.text2 }}>{v}</span>;
}
function MiniBox({ label, val, bg, border, color }: { label: string; val: string; bg: string; border: string; color: string }) {
  return <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: "8px 10px" }}><div style={{ fontSize: 10, color: C.dim }}>{label}</div><div style={{ ...mono, font: "600 13.5px 'IBM Plex Mono'", color }}>{val}</div></div>;
}
