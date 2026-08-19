import { PrismaClient, Role, RoomStatus, DiscountType } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

async function main() {
  console.log('🌱 Seeding initial data for YayeTech Hotel System...');

  // ── 1. Countries & Cities ────────────────────────────────────────────────
  const ethiopia = await prisma.country.upsert({
    where: { code: 'ET' },
    update: {},
    create: { name: 'Ethiopia', code: 'ET' },
  });

  const kenya = await prisma.country.upsert({
    where: { code: 'KE' },
    update: {},
    create: { name: 'Kenya', code: 'KE' },
  });

  const usa = await prisma.country.upsert({
    where: { code: 'US' },
    update: {},
    create: { name: 'United States', code: 'US' },
  });

  const addis = await prisma.city.upsert({
    where: { name_countryId: { name: 'Addis Ababa', countryId: ethiopia.id } },
    update: {},
    create: { name: 'Addis Ababa', countryId: ethiopia.id },
  });

  const hawassa = await prisma.city.upsert({
    where: { name_countryId: { name: 'Hawassa', countryId: ethiopia.id } },
    update: {},
    create: { name: 'Hawassa', countryId: ethiopia.id },
  });

  const nairobi = await prisma.city.upsert({
    where: { name_countryId: { name: 'Nairobi', countryId: kenya.id } },
    update: {},
    create: { name: 'Nairobi', countryId: kenya.id },
  });

  const newYork = await prisma.city.upsert({
    where: { name_countryId: { name: 'New York', countryId: usa.id } },
    update: {},
    create: { name: 'New York', countryId: usa.id },
  });

  // ── 2. Users (Admin, Manager, Staff, Customer) ───────────────────────────
  const adminPassword = await bcrypt.hash('AdminPass123!', 12);
  const managerPassword = await bcrypt.hash('ManagerPass123!', 12);
  const staffPassword = await bcrypt.hash('StaffPass123!', 12);
  const customerPassword = await bcrypt.hash('CustomerPass123!', 12);

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

  const staff = await prisma.user.upsert({
    where: { email: 'staff@yayetech.com' },
    update: {},
    create: {
      email: 'staff@yayetech.com',
      fullName: 'Hotel Staff',
      passwordHash: staffPassword,
      role: Role.STAFF,
      emailVerifiedAt: new Date(),
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@yayetech.com' },
    update: {},
    create: {
      email: 'customer@yayetech.com',
      fullName: 'John Guest',
      passwordHash: customerPassword,
      role: Role.CUSTOMER,
      emailVerifiedAt: new Date(),
    },
  });

  // ── 3. Amenities ────────────────────────────────────────────────────────
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
    { name: 'Pet Friendly', category: 'GENERAL', icon: 'pets' },
  ];

  const amenityMap = new Map<string, string>();
  for (const amenity of standardAmenities) {
    const created = await prisma.amenity.upsert({
      where: { name: amenity.name },
      update: {},
      create: amenity,
    });
    amenityMap.set(amenity.name, created.id);
  }

  // ── 4. Hotels ───────────────────────────────────────────────────────────
  const skylightHotel = await prisma.hotel.upsert({
    where: { id: 'hotel-skylight-001' },
    update: {},
    create: {
      id: 'hotel-skylight-001',
      name: 'Grand Skylight Hotel Addis',
      description: 'Luxury 5-star hotel located near Bole International Airport featuring world-class amenities.',
      address: 'Bole Road, Airport Zone, Addis Ababa',
      lat: 8.9806,
      lng: 38.7958,
      starRating: 5,
      status: 'ACTIVE',
      cityId: addis.id,
      managerId: manager.id,
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945', isPrimary: true },
          { url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b', isPrimary: false },
        ],
      },
    },
  });

  const haileResort = await prisma.hotel.upsert({
    where: { id: 'hotel-haile-002' },
    update: {},
    create: {
      id: 'hotel-haile-002',
      name: 'Haile Resort Hawassa',
      description: 'Serene lakeside resort overlooking Lake Hawassa with luxury suites and watersports.',
      address: 'Lakefront Drive, Hawassa',
      lat: 7.0621,
      lng: 38.4763,
      starRating: 4,
      status: 'ACTIVE',
      cityId: hawassa.id,
      managerId: manager.id,
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef', isPrimary: true },
        ],
      },
    },
  });

  // Link Amenities to Hotels
  const wifiId = amenityMap.get('Free WiFi')!;
  const poolId = amenityMap.get('Swimming Pool')!;
  const gymId = amenityMap.get('Gym & Fitness')!;

  await prisma.hotelAmenity.upsert({
    where: { hotelId_amenityId: { hotelId: skylightHotel.id, amenityId: wifiId } },
    update: {},
    create: { hotelId: skylightHotel.id, amenityId: wifiId },
  });
  await prisma.hotelAmenity.upsert({
    where: { hotelId_amenityId: { hotelId: skylightHotel.id, amenityId: poolId } },
    update: {},
    create: { hotelId: skylightHotel.id, amenityId: poolId },
  });

  // ── 5. Rooms for Skylight Hotel ──────────────────────────────────────────
  const roomDeluxe = await prisma.room.upsert({
    where: { hotelId_roomNumber: { hotelId: skylightHotel.id, roomNumber: '101' } },
    update: {},
    create: {
      hotelId: skylightHotel.id,
      roomNumber: '101',
      type: 'Deluxe',
      capacity: 2,
      beds: 1,
      bathroom: 1,
      basePrice: 120.00,
      status: RoomStatus.AVAILABLE,
      description: 'Spacious Deluxe room with king bed and airport view.',
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39', isPrimary: true },
        ],
      },
    },
  });

  const roomSuite = await prisma.room.upsert({
    where: { hotelId_roomNumber: { hotelId: skylightHotel.id, roomNumber: '201' } },
    update: {},
    create: {
      hotelId: skylightHotel.id,
      roomNumber: '201',
      type: 'Executive Suite',
      capacity: 4,
      beds: 2,
      bathroom: 2,
      basePrice: 280.00,
      status: RoomStatus.AVAILABLE,
      description: 'Luxury Executive Suite with separate living room and panoramic city balcony.',
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843', isPrimary: true },
        ],
      },
    },
  });

  // ── 6. Coupons ───────────────────────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      discountType: DiscountType.PERCENTAGE,
      value: 10.00,
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2027-12-31'),
      usageLimit: 500,
      timesUsed: 12,
    },
  });

  await prisma.coupon.upsert({
    where: { code: 'SUMMER50' },
    update: {},
    create: {
      code: 'SUMMER50',
      discountType: DiscountType.FIXED_AMOUNT,
      value: 50.00,
      validFrom: new Date('2026-06-01'),
      validTo: new Date('2026-09-01'),
      usageLimit: 100,
      timesUsed: 5,
    },
  });

  // ── 7. Platform Settings ────────────────────────────────────────────────
  await prisma.platformSetting.upsert({
    where: { key: 'system_info' },
    update: {},
    create: {
      key: 'system_info',
      value: {
        name: 'YayeTech Hotel Booking Platform',
        version: '1.0.0',
        supportEmail: 'support@yayetech.com',
      },
    },
  });

  console.log('✅ Seeding complete!');
  console.log(`   Admin:    ${admin.email} (AdminPass123!)`);
  console.log(`   Manager:  ${manager.email} (ManagerPass123!)`);
  console.log(`   Staff:    ${staff.email} (StaffPass123!)`);
  console.log(`   Customer: ${customer.email} (CustomerPass123!)`);
  console.log(`   Hotels:   ${skylightHotel.name}, ${haileResort.name}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
