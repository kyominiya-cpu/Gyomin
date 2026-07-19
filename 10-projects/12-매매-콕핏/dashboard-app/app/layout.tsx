import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "채널·리스크 트레이딩 콕핏",
  description: "채널 사냥 리스트 · 포지션 사이징 · 매매 장부",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
