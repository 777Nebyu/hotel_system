/**
 * Phase 1 DB Cleanup: Remove stale MAINTENANCE records for Grand Skylight Hotel rooms.
 *
 * Rooms affected:
 * - Room 101 (id: cmu1mbwtu000o4ofgnakbg71d)
 * - Room 201 (id: cmu1mbwu5000q4ofg7uqaqmvg)
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

async function main() {
  const roomIds = [
    'cmu1mbwtu000o4ofgnakbg71d', // Room 101
    'cmu1mbwu5000q4ofg7uqaqmvg', // Room 201
  ];

  // Show existing MAINTENANCE records before deleting
  const existing = await prisma.roomAvailability.findMany({
    where: {
      roomId: { in: roomIds },
      status: 'MAINTENANCE',
    },
    include: {
      room: { select: { roomNumber: true } },
    },
    orderBy: { date: 'asc' },
  });

  console.log(`Found ${existing.length} MAINTENANCE records to clear:`);
  for (const rec of existing) {
    console.log(`  Room ${rec.room.roomNumber} | ${rec.date.toISOString().slice(0, 10)} | ${rec.status}`);
  }

  if (existing.length === 0) {
    console.log('No stale MAINTENANCE records found. Rooms are already available.');
    return;
  }

  // Delete all MAINTENANCE records for these rooms
  const result = await prisma.roomAvailability.deleteMany({
    where: {
      roomId: { in: roomIds },
      status: 'MAINTENANCE',
    },
  });

  console.log(`\nDeleted ${result.count} MAINTENANCE records.`);
  console.log('Rooms 101 and 201 of Grand Skylight Hotel are now available for booking.');
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
