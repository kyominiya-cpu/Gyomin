// 지수·뉴스 샘플 데이터. 실시간 피드(KIS API 등) 붙기 전까지 표시용.
// 실제 값은 여기서 직접 수정하거나, 추후 API로 교체.
export interface IdxRow {
  name: string;
  price: string;
  chg: string;
  pct: string;
  up: boolean;
}

export const DOMESTIC_IDX: IdxRow[] = [
  { name: "코스피", price: "2,712.14", chg: "+8.30", pct: "+0.3%", up: true },
  { name: "코스피200", price: "358.42", chg: "+1.12", pct: "+0.3%", up: true },
  { name: "코스닥", price: "848.36", chg: "-3.24", pct: "-0.4%", up: false },
  { name: "K200 선물", price: "359.10", chg: "+0.90", pct: "+0.2%", up: true },
];

export const US_IDX: IdxRow[] = [
  { name: "S&P 500", price: "5,638.94", chg: "-12.40", pct: "-0.2%", up: false },
  { name: "나스닥종합", price: "18,342.10", chg: "-88.60", pct: "-0.5%", up: false },
  { name: "나스닥100 선물", price: "20,115.3", chg: "+42.10", pct: "+0.2%", up: true },
  { name: "다우존스", price: "41,240.20", chg: "-105.30", pct: "-0.3%", up: false },
  { name: "VIX", price: "15.42", chg: "+0.31", pct: "+2.1%", up: true },
];

export interface NewsRow {
  title: string;
  src: string;
  time: string;
}

export const NEWS: NewsRow[] = [
  { title: "미국 증시 혼조 마감 — 국채 금리 하락 속 기술주 소폭 약세", src: "MT Newswires", time: "15:32" },
  { title: "삼성전자, HBM4 공급 협의 진전 보도에 장중 강세", src: "연합인포맥스", time: "14:05" },
  { title: "엔비디아, 데이터센터 수요 지속 전망에 목표주가 상향", src: "Reuters", time: "11:47" },
  { title: "코스피, 외국인 순매수 전환 … 반도체 업종 주도", src: "한경", time: "09:58" },
];
