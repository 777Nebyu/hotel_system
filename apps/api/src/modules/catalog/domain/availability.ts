import type { Room, RoomAvailability } from '../../../generated/prisma/client';

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function isAvailableOn(
  roomStatus: Room['status'],
  overrides: Pick<RoomAvailability, 'date' | 'status'>[],
  date: Date,
): boolean {
  const override = overrides.find((o) => dateKey(o.date) === dateKey(date));
  return override
    ? override.status === 'AVAILABLE'
    : roomStatus === 'AVAILABLE';
}

export function availableNights(
  roomStatus: Room['status'],
  overrides: Pick<RoomAvailability, 'date' | 'status'>[],
  from: Date,
  toExclusive: Date,
): number {
  let count = 0;
  for (let d = from.getTime(); d < toExclusive.getTime(); d += 86_400_000) {
    if (isAvailableOn(roomStatus, overrides, new Date(d))) count += 1;
  }
  return count;
}

export function roomAvailableAcross(
  roomStatus: Room['status'],
  overrides: Pick<RoomAvailability, 'date' | 'status'>[],
  from: Date,
  toExclusive: Date,
): boolean {
  return (
    availableNights(roomStatus, overrides, from, toExclusive) ===
    Math.round((toExclusive.getTime() - from.getTime()) / 86_400_000)
  );
}
