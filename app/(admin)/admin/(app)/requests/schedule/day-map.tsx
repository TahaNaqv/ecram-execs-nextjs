import { cachedRouteLine } from "@/lib/fleet/route-line";
import { routesEnabled } from "@/lib/fleet/route";
import { browserMapKey } from "@/lib/fleet/map";
import { interpolate } from "@/lib/i18n/interpolate";
import { UNASSIGNED, type DayTrip } from "@/lib/admin/schedule";
import { Card, CardHeader } from "../../../_components/ui";
import { DayMapView, type MapRoute } from "./day-map-view";

type Copy = {
  mapTitle: string;
  mapNote: string;
  mapNoKey: string;
  mapNoRoutes: string;
  mapFailed: string;
  mapFrame: string;
  mapTrips: string;
  mapOpen: string;
  mapShowAll: string;
  unassigned: string;
};

/** One colour per car, in the order the day first meets them. Distinct enough to tell apart on a map. */
const PALETTE = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d"];
const UNASSIGNED_COLOUR = "#52525b";

const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** The day's confirmed trips on a map, each as the line its route follows. Google is asked once per trip and the answer is kept. */
export async function DayMap({ trips, locale, copy, framed = true }: { trips: DayTrip[]; locale: "en" | "nl"; copy: Copy; framed?: boolean }) {
  if (trips.length === 0) return null;
  // On a page that already has a card around it (the dashboard), the map goes inside that one
  const frame = (children: React.ReactNode) =>
    framed ? (
      <Card className="overflow-hidden">
        <CardHeader title={copy.mapTitle} description={copy.mapNote} />
        {children}
      </Card>
    ) : (
      children
    );
  const key = browserMapKey();

  if (!key || !routesEnabled()) {
    return frame(<p className="px-5 py-4 text-sm text-zinc-500">{copy.mapNoKey}</p>);
  }

  const settled = await Promise.allSettled(trips.map((t) => cachedRouteLine(t.route)));
  const colours = new Map<string, string>();
  const routes: MapRoute[] = [];
  let failed = 0;
  settled.forEach((result, i) => {
    if (result.status !== "fulfilled") {
      failed++;
      return;
    }
    const t = trips[i];
    if (!colours.has(t.car)) colours.set(t.car, t.car === UNASSIGNED ? UNASSIGNED_COLOUR : PALETTE[colours.size % PALETTE.length]);
    routes.push({
      id: t.id,
      reference: t.reference,
      name: t.name,
      car: t.car === UNASSIGNED ? copy.unassigned : t.carName,
      colour: colours.get(t.car)!,
      time: clock(t.start),
      from: t.route.collection ?? "",
      to: t.route.destination ?? "",
      path: result.value,
    });
  });
  routes.sort((a, b) => a.time.localeCompare(b.time));

  return frame(
    <>
      {routes.length > 0 ? (
        <DayMapView apiKey={key} routes={routes} locale={locale} copy={{ frame: copy.mapFrame, trips: copy.mapTrips, open: copy.mapOpen, showAll: copy.mapShowAll }} />
      ) : (
        <p className="px-5 py-4 text-sm text-zinc-500">{copy.mapNoRoutes}</p>
      )}
      {failed > 0 && routes.length > 0 && <p className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">{interpolate(copy.mapFailed, { count: failed })}</p>}
    </>,
  );
}
