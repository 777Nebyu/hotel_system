import { roundCurrency } from '../../catalog/domain/pricing';

export interface QuoteRoomLine {
  roomId: string;
  roomNumber: string;
  pricePerNight: number;
  nights: number;
  roomTotal: number;
}

export interface BookingQuote {
  hotelId: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guests: { adults: number; children: number };
  rooms: QuoteRoomLine[];
  subtotal: number;
  serviceFee: number;
  total: number;
}

export interface QuoteRoomSpec {
  roomId: string;
  roomNumber: string;
  nightly: number[];
}

export function buildQuote(input: {
  hotelId: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  rooms: QuoteRoomSpec[];
}): BookingQuote {
  const nights = Math.round(
    (input.checkOut.getTime() - input.checkIn.getTime()) / 86_400_000,
  );
  const span = Math.max(1, nights);
  const rooms: QuoteRoomLine[] = input.rooms.map((room) => {
    const roomTotal = roundCurrency(
      room.nightly.reduce((sum, price) => sum + price, 0),
    );
    const pricePerNight = roundCurrency(roomTotal / span);
    return {
      roomId: room.roomId,
      roomNumber: room.roomNumber,
      pricePerNight,
      nights,
      roomTotal,
    };
  });
  const subtotal = roundCurrency(
    rooms.reduce((sum, line) => sum + line.roomTotal, 0),
  );
  const serviceFee = roundCurrency(subtotal * 0.05);
  const total = roundCurrency(subtotal + serviceFee);
  return {
    hotelId: input.hotelId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights,
    guests: { adults: input.adults, children: input.children },
    rooms,
    subtotal,
    serviceFee,
    total,
  };
}
