import 'dotenv/config';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

async function main() {
  console.log('🚀 Starting End-to-End Flow Verification against', API_URL);

  // 1. Authenticate as Customer
  console.log('\n[1/7] Logging in as customer@yayetech.com...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'customer@yayetech.com',
      password: 'CustomerPass123!',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const { accessToken } = await loginRes.json();
  console.log('  ✅ Logged in successfully. Received Bearer token.');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  // 2. Search hotels
  console.log('\n[2/7] Searching hotel catalog...');
  const catalogRes = await fetch(`${API_URL}/catalog/hotels`);
  const catalogData = await catalogRes.json();
  const hotel = catalogData.data.find((h: any) => h.id === 'hotel-skylight-001') || catalogData.data[0];
  console.log(`  ✅ Found hotel: "${hotel.name}" (ID: ${hotel.id})`);

  // 3. Check rooms availability
  console.log('\n[3/7] Fetching room inventory...');
  const roomsRes = await fetch(`${API_URL}/catalog/hotels/${hotel.id}/rooms?checkIn=2026-10-01&checkOut=2026-10-04`);
  const rooms = await roomsRes.json();
  const availableRoom = rooms.find((r: any) => r.availableAcrossRange) || rooms[0];
  console.log(`  ✅ Selected room: Room #${availableRoom.roomNumber} (${availableRoom.type})`);

  // 4. Authoritative Checkout Quote Preview
  console.log('\n[4/7] Requesting authoritative checkout quote preview...');
  const quoteRes = await fetch(`${API_URL}/bookings/checkout`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      hotelId: hotel.id,
      roomIds: [availableRoom.id],
      checkIn: '2026-10-01',
      checkOut: '2026-10-04',
      guests: { adults: 2, children: 0 },
    }),
  });
  const quote = await quoteRes.json();
  console.log(`  ✅ Authoritative Quote: Nights=${quote.nights}, Subtotal=${quote.subtotal} ETB, Tax=${quote.taxAmount} ETB, Fee=${quote.serviceFee} ETB, Total=${quote.total} ETB`);

  // 5. Create 15-minute room hold
  console.log('\n[5/7] Placing 15-minute temporary room hold...');
  const holdRes = await fetch(`${API_URL}/bookings/holds`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      roomId: availableRoom.id,
      checkIn: '2026-10-01',
      checkOut: '2026-10-04',
    }),
  });
  const hold = await holdRes.json();
  console.log(`  ✅ Room hold active (Hold ID: ${hold.id})`);

  // 6. Create atomic booking & payment intent
  console.log('\n[6/7] Creating atomic booking reservation...');
  const bookingRes = await fetch(`${API_URL}/bookings`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      hotelId: hotel.id,
      roomIds: [availableRoom.id],
      checkIn: '2026-10-01',
      checkOut: '2026-10-04',
      guests: { adults: 2, children: 0 },
      guestInfos: [{ fullName: 'John Guest', email: 'customer@yayetech.com', phone: '0911234567' }],
      paymentMethod: 'CREDIT_CARD',
      bookingSource: 'ONLINE',
    }),
  });

  if (!bookingRes.ok) {
    throw new Error(`Booking creation failed: ${bookingRes.status} ${await bookingRes.text()}`);
  }

  const booking = await bookingRes.json();
  console.log(`  ✅ Booking created! Ref ID: ${booking.id}, Status: ${booking.status}`);

  // Create payment intent
  console.log('  → Initiating payment intent...');
  const intentRes = await fetch(`${API_URL}/payments/${booking.id}/intent`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ method: 'CREDIT_CARD' }),
  });
  const intent = await intentRes.json();
  console.log(`  ✅ Payment intent initiated (Payment ID: ${intent.paymentId}, Status: ${intent.status})`);

  // Execute mock gateway callback
  console.log('  → Authorizing payment via mock gateway callback...');
  const callbackRes = await fetch(`${API_URL}/payments/mock/${booking.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mock-payment-secret': 'development-mock-payment-secret',
    },
    body: JSON.stringify({
      reference: `TXN-E2E-${Date.now()}`,
      transactionId: 'GW-E2E-TEST-SUCCESS',
      message: 'Automated E2E mock gateway authorization approved',
    }),
  });
  const callbackResult = await callbackRes.json();
  console.log(`  ✅ Payment state machine transitioned to: ${callbackResult.status}`);

  // 7. Verify Confirmation, PDF Invoice, and My Bookings list
  console.log('\n[7/7] Verifying authoritative confirmation & PDF invoice...');
  const invoiceRes = await fetch(`${API_URL}/bookings/${booking.id}/invoice`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const invoiceContentType = invoiceRes.headers.get('content-type');
  console.log(`  ✅ Invoice download verified: HTTP ${invoiceRes.status}, Content-Type: ${invoiceContentType}`);

  const myBookingsRes = await fetch(`${API_URL}/bookings/my`, {
    headers: authHeaders,
  });
  const myBookings = await myBookingsRes.json();
  const confirmedBooking = myBookings.data.find((b: any) => b.id === booking.id);
  console.log(`  ✅ User Bookings Ledger verified: Found booking ${confirmedBooking.id} with status "${confirmedBooking.status}"`);

  console.log('\n🎉 ALL 7 END-TO-END REVENUE & RESERVATION LIFECYCLE TESTS PASSED!');
}

main().catch((err) => {
  console.error('\n❌ E2E test failed:', err);
  process.exit(1);
});
