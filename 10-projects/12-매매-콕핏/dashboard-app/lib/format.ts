export const won = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
export const num = (n: number) => Math.round(n).toLocaleString("ko-KR");
export const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;
export const signedPct = (n: number, d = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;

// 로컬(KST 등) 기준 오늘 YYYY-MM-DD
export function todayISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
