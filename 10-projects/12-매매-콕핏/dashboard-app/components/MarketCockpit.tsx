"use client";

import TvWidget from "./TvWidget";

// 심볼은 필요 시 여기서 편집. TradingView가 못 찾는 심볼은 위젯이 'invalid symbol' 표시.
const TICKER_TAPE = [
  { proName: "KRX:KOSPI", title: "코스피" },
  { proName: "KRX:KOSPI200", title: "코스피200" },
  { proName: "NASDAQ:IXIC", title: "나스닥 종합" },
  { proName: "CME_MINI:NQ1!", title: "나스닥100 선물" },
  { proName: "SP:SPX", title: "S&P500" },
  { proName: "CME_MINI:ES1!", title: "S&P500 선물" },
];

const MINI_GRID = [
  { symbol: "KRX:KOSPI", label: "코스피" },
  { symbol: "KRX:KOSPI200", label: "코스피200" },
  { symbol: "NASDAQ:IXIC", label: "나스닥 종합" },
  { symbol: "CME_MINI:NQ1!", label: "나스닥100 선물" },
  { symbol: "SP:SPX", label: "S&P500" },
  { symbol: "CME_MINI:ES1!", label: "S&P500 선물" },
];

export default function MarketCockpit() {
  return (
    <div className="space-y-4">
      {/* 상단 티커 테이프 */}
      <div className="rounded-lg border border-edge bg-panel overflow-hidden">
        <TvWidget
          widget="ticker-tape"
          config={{
            symbols: TICKER_TAPE,
            showSymbolLogo: true,
            colorTheme: "dark",
            isTransparent: true,
            displayMode: "adaptive",
            locale: "kr",
          }}
        />
      </div>

      {/* 지수 미니 차트 그리드 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MINI_GRID.map((m) => (
          <div key={m.symbol} className="rounded-lg border border-edge bg-panel p-2">
            <div className="mb-1 px-1 text-xs text-muted">{m.label}</div>
            <div className="h-[220px]">
              <TvWidget
                widget="mini-symbol-overview"
                config={{
                  symbol: m.symbol,
                  width: "100%",
                  height: "100%",
                  locale: "kr",
                  dateRange: "3M",
                  colorTheme: "dark",
                  isTransparent: true,
                  autosize: true,
                  chartOnly: false,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted">
        데이터·차트는 TradingView 위젯(무료). 심볼이 &apos;invalid&apos;로 뜨면{" "}
        <code className="text-edge">components/MarketCockpit.tsx</code>의 심볼 문자열을 조정하세요.
      </p>
    </div>
  );
}
