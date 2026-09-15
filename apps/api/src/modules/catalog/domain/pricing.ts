import type { Room, SeasonalPricing } from '../../../generated/prisma/client';

export interface NightPrice {
  date: Date;
  price: number;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function seasonalsByDate(
  seasonals: SeasonalPricing[],
): Map<string, SeasonalPricing> {
  const map = new Map<string, SeasonalPricing>();
  for (const s of seasonals) {
    for (
      let d = s.startDate.getTime();
      d <= s.endDate.getTime();
      d += 86_400_000
    ) {
      map.set(toDateKey(new Date(d)), s);
    }
  }
  return map;
}

export function effectivePriceOn(
  room: Pick<Room, 'basePrice'>,
  seasonals: SeasonalPricing[],
  date: Date,
): number {
  const override = seasonalsByDate(seasonals).get(toDateKey(date));
  return override
    ? override.priceOverride.toNumber()
    : room.basePrice.toNumber();
}

export function nightlyPrices(
  room: Pick<Room, 'basePrice'>,
  seasonals: SeasonalPricing[],
  from: Date,
  toExclusive: Date,
): NightPrice[] {
  const nights: NightPrice[] = [];
  for (let d = from.getTime(); d < toExclusive.getTime(); d += 86_400_000) {
    nights.push({
      date: new Date(d),
      price: effectivePriceOn(room, seasonals, new Date(d)),
    });
  }
  return nights;
}

export function priceRange(
  room: Pick<Room, 'basePrice'>,
  seasonals: SeasonalPricing[],
  from: Date,
  toExclusive: Date,
): { min: number; max: number } | null {
  const prices = nightlyPrices(room, seasonals, from, toExclusive).map(
    (n) => n.price,
  );
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function minBasePrice(rooms: Pick<Room, 'basePrice'>[]): number | null {
  if (rooms.length === 0) return null;
  return Math.min(...rooms.map((r) => r.basePrice.toNumber()));
}

export function minNightlyPrice(
  room: Pick<Room, 'basePrice'>,
  seasonals: SeasonalPricing[],
): number {
  const seasonalMin = seasonals.reduce(
    (min, s) => Math.min(min, s.priceOverride.toNumber()),
    Number.POSITIVE_INFINITY,
  );
  return Math.min(room.basePrice.toNumber(), seasonalMin);
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
