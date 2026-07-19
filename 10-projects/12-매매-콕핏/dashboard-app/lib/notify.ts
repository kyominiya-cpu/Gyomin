import type { AlertSignal } from "./types";

// WebAudio 짧은 비프음 (에셋 불필요). 매수/매도에 따라 음 높이 다름.
export function beep(signal: AlertSignal = "info") {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = signal === "sell" ? 620 : signal === "buy" ? 920 : 760;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.36);
    osc.onended = () => ctx.close();
  } catch {
    /* 무음 환경 무시 */
  }
}

export async function ensureNotifyPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const p = await Notification.requestPermission();
  return p === "granted";
}

export function notify(title: string, body: string) {
  try {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    /* 무시 */
  }
}

export const SIGNAL_LABEL: Record<AlertSignal, string> = {
  buy: "매수 신호",
  sell: "분할매도 신호",
  info: "알림",
};
