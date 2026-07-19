import { NextResponse } from "next/server";
import { getWatchlist, saveWatchlist } from "@/lib/store";
import type { WatchItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getWatchlist());
}

// 전체 목록 교체 (단일 사용자 로컬 앱 — 클라이언트가 배열 전체를 관리·전송)
export async function PUT(req: Request) {
  const items = (await req.json()) as WatchItem[];
  await saveWatchlist(items);
  return NextResponse.json(items);
}
