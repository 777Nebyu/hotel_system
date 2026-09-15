import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminImportService } from './admin-import.service';

describe('AdminImportService', () => {
  let service: AdminImportService;
  let db: any;
  let audit: any;

  beforeEach(() => {
    db = {
      hotel: {
        findUnique: jest.fn(),
      },
      room: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    audit = {
      record: jest.fn().mockResolvedValue({}),
    };
    service = new AdminImportService(db, audit);
  });

  it('throws NotFoundException if hotel does not exist', async () => {
    db.hotel.findUnique.mockResolvedValue(null);

    await expect(
      service.importRoomsFromCsv('invalid-id', Buffer.from('roomNumber,type,basePrice\n101,DELUXE,150'), {
        sub: 'admin-1',
        role: 'ADMIN',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException if headers are missing', async () => {
    db.hotel.findUnique.mockResolvedValue({ id: 'hotel-1' });

    const csvData = Buffer.from('title,author\nBook,Author');
    await expect(
      service.importRoomsFromCsv('hotel-1', csvData, { sub: 'admin-1', role: 'ADMIN' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('successfully imports valid rooms and detects duplicates', async () => {
    db.hotel.findUnique.mockResolvedValue({ id: 'hotel-1' });
    db.room.findMany.mockResolvedValue([{ roomNumber: '101' }]); // 101 already in DB

    const csvContent = [
      'roomNumber,type,capacity,basePrice,description',
      '101,DELUXE,2,200,Existing room',
      '102,STANDARD,2,100,New standard room',
      '103,SUITE,4,350,New suite',
      '103,SUITE,4,350,Duplicate in file',
    ].join('\n');

    const result = await service.importRoomsFromCsv(
      'hotel-1',
      Buffer.from(csvContent),
      { sub: 'admin-1', role: 'ADMIN' },
    );

    expect(result.importedCount).toBe(2);
    expect(result.failedCount).toBe(2);
    expect(result.errors).toEqual([
      { row: 2, roomNumber: '101', error: 'Room already exists in this hotel' },
      { row: 5, roomNumber: '103', error: 'Duplicate roomNumber in uploaded file' },
    ]);
    expect(db.room.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ roomNumber: '102', type: 'STANDARD', basePrice: 100 }),
        expect.objectContaining({ roomNumber: '103', type: 'SUITE', basePrice: 350 }),
      ],
    });
    expect(audit.record).toHaveBeenCalledWith(
      'admin-1',
      'DATA_IMPORTED',
      'Hotel',
      'hotel-1',
      { type: 'rooms', importedCount: 2, failedCount: 2 },
    );
  });
});
