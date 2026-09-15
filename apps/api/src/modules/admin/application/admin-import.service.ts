import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Workbook } from 'exceljs';
import { Readable } from 'stream';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';

export interface RoomImportRow {
  roomNumber: string;
  type: string;
  capacity: number;
  beds?: number;
  bathroom?: number;
  basePrice: number;
  description?: string;
}

export interface ImportResult {
  hotelId: string;
  totalRows: number;
  importedCount: number;
  failedCount: number;
  errors: { row: number; roomNumber?: string; error: string }[];
}

@Injectable()
export class AdminImportService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async importRoomsFromCsv(
    hotelId: string,
    fileBuffer: Buffer,
    actor: { sub: string; role: string },
  ): Promise<ImportResult> {
    const hotel = await this.db.hotel.findUnique({
      where: { id: hotelId },
      select: { id: true, managerId: true },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    if (actor.role === 'MANAGER' && hotel.managerId !== actor.sub) {
      throw new ForbiddenException(
        'You can only import rooms for hotels you manage',
      );
    }

    const workbook = new Workbook();
    const stream = Readable.from(fileBuffer);
    await workbook.csv.read(stream);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('Uploaded file is empty or invalid CSV');
    }

    // Map column headers
    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value || '').trim().toLowerCase();
    });

    const colIndex = (name: string) =>
      headers.findIndex((h) => h === name.toLowerCase());

    const roomNumIdx =
      colIndex('roomnumber') !== -1
        ? colIndex('roomnumber')
        : colIndex('room_number');
    const typeIdx = colIndex('type');
    const capIdx = colIndex('capacity');
    const bedsIdx = colIndex('beds');
    const bathIdx = colIndex('bathroom');
    const priceIdx =
      colIndex('baseprice') !== -1
        ? colIndex('baseprice')
        : colIndex('base_price');
    const descIdx = colIndex('description');

    if (roomNumIdx === -1 || typeIdx === -1 || priceIdx === -1) {
      throw new BadRequestException(
        'CSV must include roomNumber, type, and basePrice headers',
      );
    }

    const existingRooms = await this.db.room.findMany({
      where: { hotelId },
      select: { roomNumber: true },
    });
    const existingSet = new Set(
      existingRooms.map((r) => r.roomNumber.toLowerCase()),
    );

    const validRooms: RoomImportRow[] = [];
    const errors: { row: number; roomNumber?: string; error: string }[] = [];
    const seenInFile = new Set<string>();

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (!row || !row.hasValues) continue;

      const roomNumberVal = String(row.getCell(roomNumIdx).value || '').trim();
      const typeVal = String(row.getCell(typeIdx).value || '').trim();
      const priceVal = parseFloat(String(row.getCell(priceIdx).value || '0'));
      const capacityVal =
        capIdx !== -1
          ? parseInt(String(row.getCell(capIdx).value || '2'), 10)
          : 2;
      const bedsVal =
        bedsIdx !== -1
          ? parseInt(String(row.getCell(bedsIdx).value || '1'), 10)
          : 1;
      const bathVal =
        bathIdx !== -1
          ? parseInt(String(row.getCell(bathIdx).value || '1'), 10)
          : 1;
      const descVal =
        descIdx !== -1
          ? String(row.getCell(descIdx).value || '').trim()
          : undefined;

      if (!roomNumberVal) {
        errors.push({ row: rowNumber, error: 'Missing roomNumber' });
        continue;
      }
      if (existingSet.has(roomNumberVal.toLowerCase())) {
        errors.push({
          row: rowNumber,
          roomNumber: roomNumberVal,
          error: 'Room already exists in this hotel',
        });
        continue;
      }
      if (seenInFile.has(roomNumberVal.toLowerCase())) {
        errors.push({
          row: rowNumber,
          roomNumber: roomNumberVal,
          error: 'Duplicate roomNumber in uploaded file',
        });
        continue;
      }
      if (isNaN(priceVal) || priceVal <= 0) {
        errors.push({
          row: rowNumber,
          roomNumber: roomNumberVal,
          error: 'Invalid basePrice (must be positive number)',
        });
        continue;
      }

      seenInFile.add(roomNumberVal.toLowerCase());
      validRooms.push({
        roomNumber: roomNumberVal,
        type: typeVal || 'STANDARD',
        capacity: isNaN(capacityVal) || capacityVal <= 0 ? 2 : capacityVal,
        beds: isNaN(bedsVal) || bedsVal <= 0 ? 1 : bedsVal,
        bathroom: isNaN(bathVal) || bathVal <= 0 ? 1 : bathVal,
        basePrice: priceVal,
        description: descVal,
      });
    }

    if (validRooms.length > 0) {
      await this.db.room.createMany({
        data: validRooms.map((r) => ({
          hotelId,
          roomNumber: r.roomNumber,
          type: r.type,
          capacity: r.capacity,
          beds: r.beds ?? 1,
          bathroom: r.bathroom ?? 1,
          basePrice: r.basePrice,
          description: r.description,
        })),
      });
    }

    await this.audit.record(actor.sub, 'DATA_IMPORTED', 'Hotel', hotelId, {
      type: 'rooms',
      importedCount: validRooms.length,
      failedCount: errors.length,
    });

    return {
      hotelId,
      totalRows: validRooms.length + errors.length,
      importedCount: validRooms.length,
      failedCount: errors.length,
      errors,
    };
  }
}
