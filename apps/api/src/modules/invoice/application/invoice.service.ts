import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../../../common/storage/storage';
import PDFDocument from 'pdfkit';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly db: PrismaService,
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
  ) {}

  async generate(bookingId: string): Promise<Buffer> {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: {
        hotel: true,
        user: { select: { fullName: true, email: true } },
        details: { include: { room: true } },
        payment: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const payment = booking.payment;
    const invoiceNo = `INV-${(booking.bookingRef ?? booking.id).toUpperCase()}`;
    const created = booking.createdAt.toISOString().slice(0, 10);

    const buffer = await this.renderPdf(booking, invoiceNo, created, payment);

    if (payment && !payment.invoiceUrl) {
      this.uploadAndPersist(bookingId, payment.id, buffer, invoiceNo).catch(
        (err: unknown) =>
          console.error(
            `[InvoiceService] Failed to persist invoice URL for booking ${bookingId}:`,
            err,
          ),
      );
    }

    return buffer;
  }

  private async uploadAndPersist(
    bookingId: string,
    paymentId: string,
    pdfBuffer: Buffer,
    invoiceNo: string,
  ): Promise<void> {
    const stored = await this.storage.upload(
      {
        buffer: pdfBuffer,
        originalname: `${invoiceNo}.pdf`,
        mimetype: 'application/pdf',
      },
      'invoices',
    );
    await this.db.payment.update({
      where: { id: paymentId },
      data: { invoiceUrl: stored.url },
    });
  }

  private async renderPdf(
    booking: Awaited<ReturnType<InvoiceService['fetchBooking']>>,
    invoiceNo: string,
    created: string,
    payment: { method: string; status: string; providerRef?: string | null } | null,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .text('INVOICE', { align: 'center' });
    doc.moveDown();
    doc.font('Helvetica').fontSize(10).fillColor('gray');
    doc.text(`Invoice No: ${invoiceNo}`, { align: 'center' });
    doc.text(`Booking Ref: ${booking.bookingRef ?? booking.id}`, {
      align: 'center',
    });
    doc.text(`Issue date: ${created}`, { align: 'center' });
    doc.fillColor('black').moveDown(1.5);

    doc.font('Helvetica-Bold').fontSize(12).text(`${booking.hotel.name}`);
    doc.font('Helvetica').fontSize(10);
    doc.text(booking.hotel.address);
    doc.text(
      `City: ${booking.hotel.cityId}  |  Stars: ${'★'.repeat(booking.hotel.starRating)}`,
    );
    doc.moveDown(1.5);

    doc.text(`Billed to: ${booking.user.fullName}`);
    doc.text(`Email: ${booking.user.email}`);
    doc.moveDown();

    doc.text(`Check-in:  ${booking.checkIn.toISOString().slice(0, 10)}`);
    doc.text(`Check-out: ${booking.checkOut.toISOString().slice(0, 10)}`);
    doc.moveDown(1.5);

    const tableTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Room', 48, tableTop);
    doc.text('Rate/night', 250, tableTop);
    doc.text('Nights', 350, tableTop);
    doc.text('Amount', 430, tableTop);
    doc.moveDown();

    const nights = Math.max(
      1,
      Math.round(
        (booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000,
      ),
    );
    doc.font('Helvetica').fontSize(10);
    for (const detail of booking.details) {
      const total = detail.room.basePrice.toNumber() * nights;
      doc.text(detail.room.roomNumber, 48, doc.y);
      doc.text(`$${detail.room.basePrice.toNumber().toFixed(2)}`, 250, doc.y);
      doc.text(String(nights), 350, doc.y);
      doc.text(`$${total.toFixed(2)}`, 430, doc.y);
      doc.moveDown();
    }

    doc.moveDown(1.5);
    const totalY = doc.y;
    doc.font('Helvetica-Bold');
    doc.text('Subtotal', 350, totalY);
    doc.text(`$${booking.totalPrice.toNumber().toFixed(2)}`, 430, totalY);
    doc.font('Helvetica');

    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(`Total paid: $${booking.totalPrice.toNumber().toFixed(2)}`);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Payment method: ${payment?.method ?? 'N/A'}`);
    doc.text(`Payment status: ${payment?.status ?? 'N/A'}`);
    if (payment?.providerRef) {
      doc.text(`Transaction ref: ${payment.providerRef}`);
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor('gray');
    doc.text(
      'This is a computer-generated receipt. Thank you for booking with YayeTech Hotel.',
      { align: 'center' },
    );

    doc.end();
    return done;
  }

  private async fetchBooking(bookingId: string) {
    return this.db.booking.findUnique({
      where: { id: bookingId },
      include: {
        hotel: true,
        user: { select: { fullName: true, email: true } },
        details: { include: { room: true } },
        payment: true,
      },
    });
  }
}
