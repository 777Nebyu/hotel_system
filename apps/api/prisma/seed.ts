import 'dotenv/config';
import { PrismaClient, Role, RoomStatus, DiscountType } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/common/security/password-hasher';

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
  const adminPassword = await hashPassword('AdminPass123!');
  const managerPassword = await hashPassword('ManagerPass123!');
  const staffPassword = await hashPassword('StaffPass123!');
  const customerPassword = await hashPassword('CustomerPass123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@yayetech.com' },
    update: { emailVerified: true, emailVerifiedAt: new Date(), status: 'ACTIVE' },
    create: {
      email: 'admin@yayetech.com',
      fullName: 'System Admin',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@yayetech.com' },
    update: { emailVerified: true, emailVerifiedAt: new Date(), status: 'ACTIVE' },
    create: {
      email: 'manager@yayetech.com',
      fullName: 'Hotel Manager',
      passwordHash: managerPassword,
      role: Role.MANAGER,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff@yayetech.com' },
    update: { emailVerified: true, emailVerifiedAt: new Date(), status: 'ACTIVE' },
    create: {
      email: 'staff@yayetech.com',
      fullName: 'Hotel Staff',
      passwordHash: staffPassword,
      role: Role.STAFF,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@yayetech.com' },
    update: { emailVerified: true, emailVerifiedAt: new Date(), status: 'ACTIVE' },
    create: {
      email: 'customer@yayetech.com',
      fullName: 'Kibru Guest',
      passwordHash: customerPassword,
      role: Role.CUSTOMER,
      emailVerified: true,
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

  // ── 8. Discover Pillar (Sources, Verified Places & Emergency Contacts) ──
  console.log('🏛️ Seeding verified Discover & Heritage places...');

  const heritageAuthoritySource = await prisma.source.upsert({
    where: { id: 'source-ethiopian-heritage' },
    update: {},
    create: {
      id: 'source-ethiopian-heritage',
      name: 'Ethiopian Heritage Authority',
      url: 'https://heritage.gov.et',
      license: 'Official Public Record / Open Government Data',
      verifiedBy: 'Cultural Heritage Field Review Team',
    },
  });

  const tourismMinistrySource = await prisma.source.upsert({
    where: { id: 'source-tourism-ministry' },
    update: {},
    create: {
      id: 'source-tourism-ministry',
      name: 'Ministry of Tourism Ethiopia (Land of Origins)',
      url: 'https://tourism.gov.et',
      license: 'Public Domain / Verified Tourism Directory',
      verifiedBy: 'Addis Ababa Tourism Information Desk',
    },
  });

  const addisAdministrationSource = await prisma.source.upsert({
    where: { id: 'source-addis-admin' },
    update: {},
    create: {
      id: 'source-addis-admin',
      name: 'Addis Ababa City Administration & Emergency Services',
      url: 'https://addisababa.gov.et',
      license: 'Official Civic Registry',
      verifiedBy: 'City Administration Public Safety Board',
    },
  });

  // Verified Places in Addis Ababa
  const placesData = [
    {
      id: 'place-national-museum',
      name: 'National Museum of Ethiopia',
      amharicName: 'የኢትዮጵያ ብሔራዊ ሙዚየም',
      description: 'Home to the famous 3.2-million-year-old fossilized hominid remains of Lucy (Dinknesh), ancient Aksumite relics, and royal ceremonial attire.',
      amharicDescription: 'ድንቅነሽ (ሉሲ) የተገኘችበት፣ ጥንታዊ የአክሱም ቅርሶችና የንጉሣውያን አልባሳት የሚገኙበት ታሪካዊ ሙዚየም።',
      category: 'MUSEUM' as const,
      address: 'King George VI St, Arat Kilo, Addis Ababa',
      lat: 9.0384,
      lng: 38.7618,
      phone: '+251 11 111 7150',
      website: 'https://heritage.gov.et/national-museum',
      openingHours: 'Mon-Sun 09:00 - 17:00',
      hoursVerified: true,
      priceLevel: 1,
      rating: 4.8,
      images: [
        'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800',
      ],
      sourceId: heritageAuthoritySource.id,
      cityId: addis.id,
    },
    {
      id: 'place-holy-trinity',
      name: 'Holy Trinity Cathedral (Kidist Selassie)',
      amharicName: 'ቅድስት ሥላሴ ካቴድራል',
      description: 'Architectural jewel with soaring stained-glass windows, hand-carved imperial thrones, and the final resting place of Emperor Haile Selassie and patriots of the liberation struggle.',
      amharicDescription: 'የቀዳማዊ ኃይለ ሥላሴና የሀገር አርበኞች መካነ መቃብር የሚገኝበት፣ ውብ ጥንታዊ ህንፃ ጥበብ የተላበሰ ቅዱስ ስፍራ።',
      category: 'HERITAGE' as const,
      address: 'Arat Kilo, Queen Elizabeth II St, Addis Ababa',
      lat: 9.0315,
      lng: 38.7663,
      phone: '+251 11 123 3582',
      openingHours: 'Mon-Sun 08:00 - 18:00',
      hoursVerified: true,
      priceLevel: 1,
      rating: 4.7,
      images: [
        'https://images.unsplash.com/photo-1590076215667-875d4ef2d7ee?w=800',
      ],
      sourceId: heritageAuthoritySource.id,
      cityId: addis.id,
    },
    {
      id: 'place-entoto-park',
      name: 'Entoto Natural & Eco Park',
      amharicName: 'የእንጦጦ የተፈጥሮ ፓርክ',
      description: 'Mountain retreat 3,200m above sea level with aromatic eucalyptus forests, horseback riding, ziplining, craft coffee lounges, and panoramic views of Addis Ababa.',
      amharicDescription: 'በንጹሕ አየር፣ በፈረስ ግልቢያና በአዲስ አበባ ከተማ ሙሉ ገጽታ የሚታይበት ውብ ተራራማ የተፈጥሮ መናፈሻ።',
      category: 'ATTRACTION' as const,
      address: 'Mount Entoto Ridge, Addis Ababa',
      lat: 9.0792,
      lng: 38.7635,
      phone: '+251 11 869 9999',
      openingHours: 'Mon-Sun 06:00 - 20:00',
      hoursVerified: true,
      priceLevel: 2,
      rating: 4.9,
      images: [
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800',
      ],
      sourceId: tourismMinistrySource.id,
      cityId: addis.id,
    },
    {
      id: 'place-tomoca-coffee',
      name: 'Tomoca Coffee (Historic Piazza)',
      amharicName: 'ቶሞካ ቡና (ፒያሳ)',
      description: 'Founded in 1953, Addis Ababa’s most iconic Italian-style espresso bar roasting high-altitude Harar, Sidama, and Yirgacheffe beans.',
      amharicDescription: 'ከ1953 ዓ.ም ጀምሮ ጥራት ያለው የኢትዮጵያ ሀረር እና ሲዳማ ቡና የሚቀርብበት አንጋፋው የፒያሳ ካፌ።',
      category: 'CAFE' as const,
      address: 'Wavel St, Piazza, Addis Ababa',
      lat: 9.0348,
      lng: 38.7516,
      phone: '+251 11 111 2781',
      website: 'https://tomocacoffee.com',
      openingHours: 'Mon-Sat 06:30 - 20:30, Sun 08:00 - 18:00',
      hoursVerified: true,
      priceLevel: 1,
      rating: 4.8,
      images: [
        'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800',
      ],
      sourceId: tourismMinistrySource.id,
      cityId: addis.id,
    },
    {
      id: 'place-yod-abyssinia',
      name: 'Yod Abyssinia Cultural Restaurant',
      amharicName: 'ዮድ አቢሲኒያ የባህል ምግብ ቤት',
      description: 'World-renowned Ethiopian traditional dining featuring injera feasts, traditional honey mead (Tej), and live tribal music and dance from all 10+ Ethiopian regions.',
      amharicDescription: 'የተለያዩ የኢትዮጵያ ብሔረሰቦች ባህላዊ ሙዚቃና ውዝዋዜ፣ ጠጅና ምርጥ የባህል ምግቦች የሚቀርቡበት የታወቀ ስፍራ።',
      category: 'RESTAURANT' as const,
      address: 'Bole Medhanialem Area, Addis Ababa',
      lat: 8.9950,
      lng: 38.7885,
      phone: '+251 11 661 2179',
      openingHours: 'Mon-Sun 12:00 - 23:30',
      hoursVerified: true,
      priceLevel: 3,
      rating: 4.7,
      images: [
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
      ],
      sourceId: tourismMinistrySource.id,
      cityId: addis.id,
    },
    {
      id: 'place-addis-mercato',
      name: 'Addis Mercato (Merkato)',
      amharicName: 'አዲስ መርካቶ',
      description: 'The largest open-air marketplace in Africa. An energetic sensory kaleidoscope offering authentic spices (berbere), handwoven fabrics (shemma), and silver filigree jewelry.',
      amharicDescription: 'በአፍሪካ ግዙፉ ክፍት የገበያ ማዕከል፤ ባህላዊ ቅመማ ቅመሞች፣ የሀገር ባህል ልብሶች እና ጥበቦች መገኛ።',
      category: 'SHOPPING' as const,
      address: 'Addis Ketema District, Addis Ababa',
      lat: 9.0300,
      lng: 38.7390,
      openingHours: 'Mon-Sat 08:30 - 18:30 (Closed Sundays)',
      hoursVerified: true,
      priceLevel: 1,
      rating: 4.5,
      images: [
        'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800',
      ],
      sourceId: tourismMinistrySource.id,
      cityId: addis.id,
    },
    {
      id: 'place-tikur-anbessa',
      name: 'Tikur Anbessa (Black Lion) Hospital',
      amharicName: 'ጥቁር አንበሳ ስፔሻላይዝድ ሆስፒታል',
      description: 'Premier tertiary referral and teaching hospital with 24/7 emergency medicine trauma care unit.',
      amharicDescription: 'የ24 ሰዓት የድንገተኛ አደጋ ህክምና ክፍል ያለው ቀዳሚው የመንግስት ስፔሻላይዝድ ሆስፒታል።',
      category: 'HOSPITAL' as const,
      address: 'Zambia St, Lideta, Addis Ababa',
      lat: 9.0186,
      lng: 38.7492,
      phone: '+251 11 551 1211',
      openingHours: '24 Hours Emergency Service',
      hoursVerified: true,
      priceLevel: 1,
      rating: 4.3,
      images: [
        'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800',
      ],
      sourceId: addisAdministrationSource.id,
      cityId: addis.id,
    },
  ];

  const unattributedPlaces = placesData.filter((place) => !place.sourceId);
  if (unattributedPlaces.length > 0) {
    throw new Error(
      `ROAD-001 violation: every seeded place must have a sourceId (${unattributedPlaces.map((place) => place.id).join(', ')})`,
    );
  }

  for (const p of placesData) {
    await prisma.place.upsert({
      where: { id: p.id },
      update: {},
      create: p,
    });
  }

  // Emergency Contacts (Curated official phone numbers with source verification)
  const emergencyData = [
    {
      id: 'emg-police-991',
      city: 'Addis Ababa',
      kind: 'POLICE',
      name: 'Ethiopian Federal Police Emergency Dispatch',
      phone: '991',
      sourceId: addisAdministrationSource.id,
      status: 'PUBLISHED',
    },
    {
      id: 'emg-ambulance-907',
      city: 'Addis Ababa',
      kind: 'AMBULANCE',
      name: 'Ethiopian Red Cross National Ambulance',
      phone: '907',
      sourceId: addisAdministrationSource.id,
      status: 'PUBLISHED',
    },
    {
      id: 'emg-fire-939',
      city: 'Addis Ababa',
      kind: 'FIRE',
      name: 'City Fire & Emergency Rescue Service',
      phone: '939',
      sourceId: addisAdministrationSource.id,
      status: 'PUBLISHED',
    },
    {
      id: 'emg-hospital-tikur',
      city: 'Addis Ababa',
      kind: 'HOSPITAL',
      name: 'Tikur Anbessa Emergency Trauma Desk',
      phone: '+251 11 551 1211',
      sourceId: addisAdministrationSource.id,
      status: 'PUBLISHED',
    },
    {
      id: 'emg-hotel-skylight',
      city: 'Addis Ababa',
      hotelId: skylightHotel.id,
      kind: 'HOTEL',
      name: 'Grand Skylight Front Desk & Guest Safety',
      phone: '+251 11 681 8181',
      sourceId: tourismMinistrySource.id,
      status: 'PUBLISHED',
    },
  ];

  for (const emg of emergencyData) {
    await prisma.emergencyContact.upsert({
      where: { id: emg.id },
      update: {},
      create: emg,
    });
  }

  console.log('✅ Seeding complete!');
  console.log(`   Admin:    ${admin.email} (AdminPass123!)`);
  console.log(`   Manager:  ${manager.email} (ManagerPass123!)`);
  console.log(`   Staff:    ${staff.email} (StaffPass123!)`);
  console.log(`   Customer: ${customer.email} (CustomerPass123!)`);
  console.log(`   Hotels:   ${skylightHotel.name}, ${haileResort.name}`);
  console.log(`   Places:   ${placesData.length} verified places seeded`);
  console.log(`   Contacts: ${emergencyData.length} emergency contacts seeded`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
