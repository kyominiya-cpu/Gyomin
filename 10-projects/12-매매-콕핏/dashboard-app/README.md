# 채널·리스크 트레이딩 콕핏 (v1)

TradingView 위에 얹는 **결정 · 규율 · 포지션 관리** 대시보드.
차트/드로잉/알람은 TradingView가, 이 앱은 TradingView가 못 하는 **포지션 사이징 · 채널 사냥 리스트 · 매매 장부**를 담당.

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
```

## 4개 화면

1. **시세 콕핏** — 코스피·코스피200·나스닥·S&P·선물 TradingView 위젯 (무료).
2. **채널 사냥** — 관심종목별로 **채널 하단선 앵커 2점 + 폭**을 한 번 입력하면, 매일 오늘의 하단/상단을 자동 외삽.
   현재가와 비교해 매수존/분할매도존 근접·하단이탈을 판정하고, 플레이북 체크리스트(정배열·MACD·거래량·반등캔들)를 게이트로 표시.
3. **포지션 사이징** — `수량 = 계좌 × 리스크% ÷ (진입 − 손절)`. 1R·목표 R배수·포트폴리오 히트 상한 경고. 진입을 장부에 기록.
4. **매매 장부** — 열린/청산 포지션, 청산 시 실현 R 자동 계산, 승률·기대값(R) 집계.

## 핵심 개념 — 기울어진 채널

추세 채널은 매일 값이 변하지만 **선은 두 점으로 정해진다.** 앵커 2점(날짜+가격)을 한 번 입력하면
`lib/channel.ts`가 선형 외삽으로 오늘 값을 계산 → **매일 재입력 불필요.** 채널을 다시 그릴 때만 앵커 갱신.

## TradingView 알림 연동 (선택, Pro 플랜+)

TradingView에서 그린 추세선 우클릭 → Alert → **Webhook URL**:
```
http://localhost:3000/api/tv-webhook
```
Alert 메시지(JSON) 예시:
```json
{"ticker":"{{ticker}}","price":{{close}},"message":"채널 하단 도달"}
```
채널 사냥 화면 하단 "TradingView 알림 수신" 패널에 20초마다 표시됨.

## 데이터

`data/*.json` 로컬 사이드카 (settings / watchlist / positions / events). 원본 마스터 없음.
다중 기기·실시간 시세·자동주문이 필요해지면 Supabase + KIS Developers API로 승격 (로드맵 L5).

## 기술 스택

Next.js 14 (App Router) · TypeScript · Tailwind · TradingView 임베드 위젯.
순수 로직은 `lib/channel.ts`(외삽·근접), `lib/risk.ts`(사이징·R·히트·기대값).
