import Terminal from "@/components/Terminal";
import { getSettings, getWatchlist, getPositions } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [settings, watchlist, positions] = await Promise.all([getSettings(), getWatchlist(), getPositions()]);
  return <Terminal initialSettings={settings} initialWatchlist={watchlist} initialPositions={positions} />;
}
