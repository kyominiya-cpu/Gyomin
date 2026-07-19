"use client";

import { useEffect, useRef } from "react";

// TradingView 공식 임베드 위젯 로더.
// widget: embed-widget-<widget> 의 <widget> 부분 (예: "mini-symbol-overview", "ticker-tape", "advanced-chart")
export default function TvWidget({
  widget,
  config,
  className,
}: {
  widget: string;
  config: Record<string, unknown>;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = "";

    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    container.appendChild(inner);

    const script = document.createElement("script");
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify(config);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
    // config는 객체라 문자열로 비교
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget, JSON.stringify(config)]);

  return <div ref={ref} className={`tradingview-widget-container ${className ?? ""}`} />;
}
