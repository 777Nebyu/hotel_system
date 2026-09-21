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
    const booking = await this.fetchBooking(bookingId);
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
    booking: NonNullable<Awaited<ReturnType<InvoiceService['fetchBooking']>>>,
    invoiceNo: string,
    created: string,
    payment: { method: string; status: string; providerRef?: string | null; txRef?: string | null } | null,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const startX = 40;
    const pageWidth = 515;
    const currency = (booking as any).currency || 'ETB';

    // ── 1. Header Banner ───────────────────────────────────────────────────
    // LuxStay Brand Badge Box
    doc.roundedRect(startX, 40, 38, 38, 8).fill('#0F2942');
    doc.fillColor('#D4AF37').font('Helvetica-Bold').fontSize(22).text('L', startX + 11, 48);

    doc.fillColor('#0F2942').font('Helvetica-Bold').fontSize(22).text('LuxStay', startX + 48, 43);
    doc.fillColor('#D4AF37').font('Helvetica-Bold').fontSize(7.5).text('CURATED STAYS & GRAND RESORTS', startX + 49, 66);

    // Invoice Meta (Right-Aligned)
    doc.fillColor('#0F2942').font('Helvetica-Bold').fontSize(20).text('INVOICE', startX, 40, {
      width: pageWidth,
      align: 'right',
    });
    doc.fillColor('#64748B').font('Helvetica').fontSize(8.5).text(`Invoice No: ${invoiceNo}`, startX, 63, {
      width: pageWidth,
      align: 'right',
    });
    doc.text(`Issue Date: ${created}`, startX, 75, {
      width: pageWidth,
      align: 'right',
    });

    // Gold Accent Hairline
    doc.strokeColor('#D4AF37').lineWidth(1.5).moveTo(startX, 92).lineTo(startX + pageWidth, 92).stroke();

    // ── 2. Two-Column Metadata Info Cards ──────────────────────────────────
    const cardY = 104;
    const cardHeight = 88;
    const colWidth = (pageWidth - 14) / 2;

    // Left Card: Billed To
    doc.roundedRect(startX, cardY, colWidth, cardHeight, 8).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fillColor('#D4AF37').font('Helvetica-Bold').fontSize(8).text('BILLED TO', startX + 14, cardY + 12);
    doc.fillColor('#0F2942').font('Helvetica-Bold').fontSize(11).text(booking.user?.fullName || 'Valued Guest', startX + 14, cardY + 25);
    doc.fillColor('#475569').font('Helvetica').fontSize(8.5).text(booking.user?.email || 'N/A', startX + 14, cardY + 41);
    doc.text((booking.user as any)?.phone || 'Verified Guest Account', startX + 14, cardY + 54);
    doc.fillColor('#0F2942').font('Helvetica-Bold').fontSize(8.5).text(`Booking Ref: ${booking.bookingRef ?? booking.id}`, startX + 14, cardY + 68);

    // Right Card: Property & Stay Dates
    const col2X = startX + colWidth + 14;
    doc.roundedRect(col2X, cardY, colWidth, cardHeight, 8).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fillColor('#D4AF37').font('Helvetica-Bold').fontSize(8).text('PROPERTY & STAY DETAILS', col2X + 14, cardY + 12);
    doc.fillColor('#0F2942').font('Helvetica-Bold').fontSize(11).text(booking.hotel.name, col2X + 14, cardY + 25);
    if (booking.hotel.address) {
      doc.fillColor('#475569').font('Helvetica').fontSize(8.5).text(booking.hotel.address, col2X + 14, cardY + 41, { width: colWidth - 28 });
    }
    const checkInStr = booking.checkIn.toISOString().slice(0, 10);
    const checkOutStr = booking.checkOut.toISOString().slice(0, 10);
    doc.fillColor('#0F2942').font('Helvetica-Bold').fontSize(8.5).text(`Check-in: ${checkInStr}  |  Check-out: ${checkOutStr}`, col2X + 14, cardY + 68);

    // ── 3. Tabular Itemized Charges ────────────────────────────────────────
    const tableY = 206;
    const tableHeaderHeight = 24;

    // Table Header Bar
    doc.roundedRect(startX, tableY, pageWidth, tableHeaderHeight, 6).fill('#0F2942');

    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
    doc.text('SUITE / ROOM', startX + 12, tableY + 7);
    doc.text('ROOM TYPE', startX + 150, tableY + 7);
    doc.text('NIGHTS', startX + 285, tableY + 7, { width: 50, align: 'center' });
    doc.text('NIGHTLY RATE', startX + 345, tableY + 7, { width: 80, align: 'right' });
    doc.text('AMOUNT', startX + 435, tableY + 7, { width: 68, align: 'right' });

    const nights = Math.max(
      1,
      Math.round(
        (booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000,
      ),
    );

    let currentY = tableY + tableHeaderHeight;
    const rowHeight = 28;

    booking.details.forEach((detail, index) => {
      const bg = index % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(startX, currentY, pageWidth, rowHeight).fillAndStroke(bg, '#E2E8F0');

      const roomTotal = detail.room.basePrice.toNumber() * nights;
      const typeDisplay = detail.room.type ? detail.room.type.replace(/_/g, ' ') : 'Luxury Suite';

      doc.fillColor('#0F2942').font('Helvetica-Bold').fontSize(9).text(`Room ${detail.room.roomNumber}`, startX + 12, currentY + 9);
      doc.fillColor('#475569').font('Helvetica').fontSize(8.5).text(typeDisplay, startX + 150, currentY + 9);
      doc.text(String(nights), startX + 285, currentY + 9, { width: 50, align: 'center' });
      doc.text(`${currency} ${detail.room.basePrice.toNumber().toFixed(2)}`, startX + 345, currentY + 9, { width: 80, align: 'right' });
      doc.fillColor('#0F2942').font('Helvetica-Bold').fontSize(9).text(`${currency} ${roomTotal.toFixed(2)}`, startX + 435, currentY + 9, { width: 68, align: 'right' });

      currentY += rowHeight;
    });

    // ── 4. Financial & Payment Summary ─────────────────────────────────────
    const summaryY = currentY + 16;
    const summaryHeight = 138;

    const subtotal = booking.subtotal
      ? booking.subtotal.toNumber()
      : booking.totalPrice.toNumber();
    const taxRatePercent = booking.taxRate
      ? Math.round(booking.taxRate.toNumber() * 100)
      : 15;
    const taxAmount = booking.taxAmount ? booking.taxAmount.toNumber() : 0;
    const serviceFee = booking.serviceFee ? booking.serviceFee.toNumber() : 0;
    const discount = booking.discount ? booking.discount.toNumber() : 0;
    const totalPaid = booking.totalPrice.toNumber();

    // Left Box: Payment Details
    doc.roundedRect(startX, summaryY, colWidth, summaryHeight, 8).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fillColor('#D4AF37').font('Helvetica-Bold').fontSize(8).text('SETTLEMENT & PAYMENT', startX + 14, summaryY + 12);

    const payInfoY = summaryY + 28;
    const payMethod = (payment?.method ?? (booking as any).paymentMethod ?? 'ELECTRONIC').replace(/_/g, ' ');
    const payStatus = payment?.status ?? (booking as any).paymentStatus ?? 'SUCCEEDED';
    const txRef = payment?.providerRef || (payment as any)?.txRef || (booking as any).bookingRef || 'CONFIRMED';

    doc.fillColor('#64748B').font('Helvetica').fontSize(8.5);
    doc.text('Payment Method:', startX + 14, payInfoY);
    doc.fillColor('#0F2942').font('Helvetica-Bold').text(payMethod, startX + 96, payInfoY);

    doc.fillColor('#64748B').font('Helvetica').text('Payment Status:', startX + 14, payInfoY + 18);
    // Status Pill
    const isPaid = payStatus === 'SUCCEEDED' || payStatus === 'COMPLETED';
    const pillBg = isPaid ? '#ECFDF5' : '#FFFBEB';
    const pillBorder = isPaid ? '#A7F3D0' : '#FDE68A';
    const pillColor = isPaid ? '#059669' : '#D97706';
    doc.roundedRect(startX + 96, payInfoY + 15, 74, 16, 4).fillAndStroke(pillBg, pillBorder);
    doc.fillColor(pillColor).font('Helvetica-Bold').fontSize(7.5).text(payStatus, startX + 101, payInfoY + 19);

    doc.fillColor('#64748B').font('Helvetica').fontSize(8.5).text('Transaction Ref:', startX + 14, payInfoY + 38);
    doc.fillColor('#0F2942').font('Helvetica-Bold').fontSize(8).text(txRef, startX + 96, payInfoY + 38, { width: colWidth - 105 });

    doc.fillColor('#94A3B8').font('Helvetica').fontSize(7.5).text(
      'Security Guarantee: Encrypted transaction verified with 100% reservation backing.',
      startX + 14,
      payInfoY + 68,
      { width: colWidth - 28, lineGap: 2 },
    );

    // Right Box: Price Breakdown
    doc.roundedRect(col2X, summaryY, colWidth, summaryHeight, 8).fillAndStroke('#FFFFFF', '#E2E8F0');
    let breakY = summaryY + 14;

    const renderBreakLine = (label: string, val: string, isGreen = false) => {
      doc.fillColor('#64748B').font('Helvetica').fontSize(8.5).text(label, col2X + 14, breakY);
      doc.fillColor(isGreen ? '#059669' : '#0F2942').font('Helvetica-Bold').fontSize(8.5).text(val, col2X, breakY, {
        width: colWidth - 14,
        align: 'right',
      });
      breakY += 16;
    };

    renderBreakLine('Subtotal', `${currency} ${subtotal.toFixed(2)}`);
    if (discount > 0) {
      renderBreakLine('Promo Discount', `-${currency} ${discount.toFixed(2)}`, true);
    }
    renderBreakLine(`VAT / Tax (${taxRatePercent}%)`, `${currency} ${taxAmount.toFixed(2)}`);
    if (serviceFee > 0) {
      renderBreakLine('Service Fee', `${currency} ${serviceFee.toFixed(2)}`);
    }

    // Grand Total Box
    const totalBoxY = summaryY + summaryHeight - 38;
    doc.roundedRect(col2X + 8, totalBoxY, colWidth - 16, 32, 6).fill('#0F2942');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text('TOTAL AMOUNT PAID', col2X + 18, totalBoxY + 10);
    doc.fillColor('#D4AF37').font('Helvetica-Bold').fontSize(12).text(`${currency} ${totalPaid.toFixed(2)}`, col2X, totalBoxY + 9, {
      width: colWidth - 26,
      align: 'right',
    });

    // ── 5. Luxury Footer ───────────────────────────────────────────────────
    const footerY = 746;
    doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(startX, footerY).lineTo(startX + pageWidth, footerY).stroke();

    doc.fillColor('#0F2942').font('Helvetica-Bold').fontSize(9).text(
      'Thank you for booking with LuxStay.',
      startX,
      footerY + 12,
      { width: pageWidth, align: 'center' },
    );

    doc.fillColor('#64748B').font('Helvetica').fontSize(8).text(
      'This is an official computer-generated receipt · LuxStay Global · Concierge Support: concierge@luxstay.com',
      startX,
      footerY + 25,
      { width: pageWidth, align: 'center' },
    );

    doc.fillColor('#94A3B8').font('Helvetica').fontSize(7).text(
      `Verified Electronic Digest: ${booking.id} · Issued at ${created}`,
      startX,
      footerY + 37,
      { width: pageWidth, align: 'center' },
    );

    doc.end();
    return done;
  }

  private async fetchBooking(bookingId: string) {
    return this.db.booking.findUnique({
      where: { id: bookingId },
      include: {
        hotel: true,
        user: { select: { fullName: true, email: true, phone: true } },
        details: { include: { room: true } },
        payment: true,
      },
    });
  }
}
