import { NextResponse } from "next/server";
import { getPositions, savePositions } from "@/lib/store";
import type { Position } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getPositions());
}

export async function PUT(req: Request) {
  const items = (await req.json()) as Position[];
  await savePositions(items);
  return NextResponse.json(items);
}
