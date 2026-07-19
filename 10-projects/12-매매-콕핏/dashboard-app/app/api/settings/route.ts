import { NextResponse } from "next/server";
import { getSettings, saveSettings, DEFAULT_SETTINGS } from "@/lib/store";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<Settings>;
  const merged: Settings = { ...DEFAULT_SETTINGS, ...(await getSettings()), ...body };
  await saveSettings(merged);
  return NextResponse.json(merged);
}
