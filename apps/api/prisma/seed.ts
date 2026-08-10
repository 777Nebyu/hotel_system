import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

async function main() {
  console.log('Seeding initial data...');

  // 1. Seed Country & Cities
  const ethio = await prisma.country.upsert({
    where: { code: 'ET' },
    update: {},
    create: {
      name: 'Ethiopia',
      code: 'ET',
    },
  });

  const addis = await prisma.city.upsert({
    where: { name_countryId: { name: 'Addis Ababa', countryId: ethio.id } },
    update: {},
    create: {
      name: 'Addis Ababa',
      countryId: ethio.id,
    },
  });

  // 2. Seed Default Admin User
  const adminPassword = await bcrypt.hash('AdminPass123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@yayetech.com' },
    update: {},
    create: {
      email: 'admin@yayetech.com',
      fullName: 'System Admin',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });

  // 3. Seed Default Hotel Manager User
  const managerPassword = await bcrypt.hash('ManagerPass123!', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@yayetech.com' },
    update: {},
    create: {
      email: 'manager@yayetech.com',
      fullName: 'Hotel Manager',
      passwordHash: managerPassword,
      role: Role.MANAGER,
      emailVerifiedAt: new Date(),
    },
  });

  // 4. Seed Standard Amenities
  const standardAmenities = [
    { name: 'Free WiFi', category: 'GENERAL', icon: 'wifi' },
    { name: 'Swimming Pool', category: 'GENERAL', icon: 'pool' },
    { name: 'Gym & Fitness', category: 'HEALTH', icon: 'fitness_center' },
    { name: 'Spa & Wellness', category: 'HEALTH', icon: 'spa' },
    { name: 'Free Parking', category: 'GENERAL', icon: 'local_parking' },
    { name: 'Restaurant', category: 'DINING', icon: 'restaurant' },
    { name: 'Breakfast Included', category: 'DINING', icon: 'free_breakfast' },
    { name: 'Airport Shuttle', category: 'SERVICES', icon: 'airport_shuttle' },
    { name: 'Air Conditioning', category: 'ROOM', icon: 'ac_unit' },
  ];

  for (const amenity of standardAmenities) {
    await prisma.amenity.upsert({
      where: { name: amenity.name },
      update: {},
      create: amenity,
    });
  }

  console.log(`Seeding complete. Created Admin: ${admin.email}, Manager: ${manager.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
