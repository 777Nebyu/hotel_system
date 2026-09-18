import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentGatewayRegistry } from '../infrastructure/gateway-registry';
import { getRequestId } from '../../../common/context/request-context';
import { AuditService } from '../../../common/services/audit.service';
import { FraudService } from '../../fraud/application/fraud.service';
import { OtpService } from './otp.service';
import { ChapaMockProvider } from '../infrastructure/gateways/chapa-mock.provider';
import {
  PaymentCompletedEvent,
  PaymentFailedEvent,
  PaymentRefundedEvent,
  PaymentEventNames,
} from '../../events/payment.events';
import type { MarkCashPaidInput, MockGatewayCallback, PaymentMethod } from '@repo/shared-types';

function calculateRefundAmount(
  paidAmount: number,
  checkIn: Date,
  cancelledAt: Date = new Date(),
): number {
  const daysUntilCheckIn = Math.floor(
    (checkIn.getTime() - cancelledAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysUntilCheckIn >= 7) return Math.round(paidAmount * 100) / 100;
  if (daysUntilCheckIn >= 3) return Math.round(paidAmount * 0.5 * 100) / 100;
  return 0;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly registry: PaymentGatewayRegistry,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @Optional()
    private readonly fraud?: FraudService,
    @Optional()
    private readonly otpService?: OtpService,
    @Optional()
    private readonly chapa?: ChapaMockProvider,
  ) {}

  async createIntent(bookingId: string, method: PaymentMethod, userId: string) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('You cannot pay for this booking');
    }
    if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') {
      throw new ConflictException('This booking can no longer be paid');
    }

    const adapter = this.registry.get(method);
    const { providerRef } = await adapter.initiate(
      {
        id: booking.id,
        totalPrice: booking.totalPrice.toNumber(),
        currency: 'ETB',
      },
      booking.totalPrice.toNumber(),
      'ETB',
    );

    const initialStatus = method === 'CASH' ? 'PENDING_AT_HOTEL' : 'PENDING';

    const payment = await this.db.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        method,
        amount: booking.totalPrice,
        status: initialStatus,
        providerRef,
      },
      update: { method, status: initialStatus, providerRef },
    });

    if (method === 'CASH') {
      await this.db.booking.update({
        where: { id: booking.id },
        data: { status: 'CONFIRMED' },
      });
      await this.db.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: 'CONFIRMED',
          changedBy: userId,
          reason: 'Cash at hotel booking confirmed',
        },
      });
    }

    this.logger.log({
      message: 'Payment initiated',
      paymentId: payment.id,
      bookingId,
      method,
      amount: booking.totalPrice.toNumber(),
      currency: 'ETB',
      correlationId: getRequestId(),
    });

    return {
      paymentId: payment.id,
      bookingId: booking.id,
      method,
      amount: payment.amount.toNumber(),
      status: payment.status,
      redirectUrl: `/payments/mock/${booking.id}`,
    };
  }

  async myPayments(userId: string) {
    const payments = await this.db.payment.findMany({
      where: { booking: { userId } },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            bookingRef: true,
            hotel: { select: { id: true, name: true } },
            checkIn: true,
            checkOut: true,
          },
        },
        attempts: { orderBy: { attemptedAt: 'desc' }, take: 5 },
      },
    });
    return { data: payments };
  }

  async mockCallback(
    bookingId: string,
    body: MockGatewayCallback,
    webhookSecret: string | undefined,
  ) {
    this.assertMockWebhookSecret(webhookSecret);
    const payment = await this.db.payment.findUnique({
      where: { bookingId },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'SUCCEEDED') {
      return {
        status: 'SUCCEEDED' as const,
        paymentId: payment.id,
        transactionId: payment.providerRef,
        idempotent: true,
      };
    }
    if (payment.status === 'REFUNDED') {
      throw new ConflictException('A refunded payment cannot be completed');
    }

    const adapter = this.registry.get(payment.method);
    let approved = false;

    if (body.status === 'FAILED') {
      approved = false;
    } else if (body.status === 'SUCCEEDED') {
      approved = true;
    } else {
      const result = await adapter.confirm(
        payment.providerRef ?? body.reference ?? 'default',
        body.reference,
      );
      approved = result.approved;
    }

    if (approved) {
      const changed = await this.db.payment.updateMany({
        where: { id: payment.id, status: { in: ['PENDING', 'PENDING_AT_HOTEL', 'FAILED'] } },
        data: {
          status: 'SUCCEEDED',
          providerRef: body.transactionId ?? payment.providerRef ?? null,
        },
      });

      await this.db.paymentAttempt.create({
        data: {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          method: payment.method,
          outcome: 'SUCCEEDED',
          status: 'SUCCEEDED',
          amount: payment.amount,
          providerRef: body.transactionId ?? payment.providerRef ?? null,
        },
      });

      if (changed.count > 0) {
        await this.db.bookingStatusHistory.create({
          data: {
            bookingId,
            fromStatus: payment.booking.status,
            toStatus: 'CONFIRMED',
            changedBy: 'system',
            reason: 'Payment completed',
          },
        });
      }

      const updated = await this.db.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      if (changed.count === 0) {
        return {
          status: updated.status,
          paymentId: payment.id,
          transactionId: updated.providerRef,
          idempotent: true,
        };
      }
      this.emitter.emit(
        PaymentEventNames.COMPLETED,
        new PaymentCompletedEvent(
          payment.id,
          bookingId,
          payment.booking.userId,
          payment.amount.toNumber(),
          updated.method,
        ),
      );
      await this.audit.record(
        payment.booking.userId,
        'PAYMENT_COMPLETED',
        'Payment',
        payment.id,
        { bookingId, method: updated.method, amount: payment.amount.toNumber() },
      );
      this.logger.log({
        message: 'Payment confirmed',
        paymentId: payment.id,
        bookingId,
        method: updated.method,
        amount: payment.amount.toNumber(),
        correlationId: getRequestId(),
      });
      return {
        status: 'SUCCEEDED' as const,
        paymentId: payment.id,
        transactionId: updated.providerRef ?? null,
        idempotent: false,
      };
    }

    await this.db.paymentAttempt.create({
      data: {
        bookingId: payment.bookingId,
        paymentId: payment.id,
        method: payment.method,
        outcome: 'FAILED',
        status: 'FAILED',
        amount: payment.amount,
        providerRef: body.transactionId ?? payment.providerRef ?? null,
      },
    });

    await this.db.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        providerRef: body.transactionId ?? payment.providerRef ?? null,
      },
    });

    this.emitter.emit(
      PaymentEventNames.FAILED,
      new PaymentFailedEvent(
        payment.id,
        bookingId,
        payment.booking.userId,
        payment.amount.toNumber(),
        payment.method,
        'Payment charge failed or declined',
      ),
    );

    if (this.fraud && payment.booking?.userId) {
      void this.fraud.checkPaymentFailureVelocity(payment.booking.userId);
    }

    this.logger.warn({
      message: 'Payment declined',
      paymentId: payment.id,
      bookingId,
      method: payment.method,
      amount: payment.amount.toNumber(),
      correlationId: getRequestId(),
    });

    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message: 'Payment declined',
        status: 'FAILED',
        paymentId: payment.id,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  async markCashPaid(
    bookingId: string,
    body: MarkCashPaidInput,
    actor: { sub: string; role: string; hotelId?: string },
  ) {
    const payment = await this.db.payment.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: { hotel: { select: { id: true, managerId: true } } },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.method !== 'CASH') {
      throw new BadRequestException(
        'Only CASH payments can be marked as paid via this endpoint',
      );
    }

    const hotelId = payment.booking.hotel.id;
    if (actor.role === 'MANAGER') {
      if (actor.hotelId !== hotelId) {
        throw new ForbiddenException(
          'You can only mark payments for your own hotel',
        );
      }
    } else if (actor.role === 'STAFF') {
      if (actor.hotelId !== hotelId) {
        throw new ForbiddenException(
          'You can only mark payments for your assigned hotel',
        );
      }
    } else if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (payment.status === 'SUCCEEDED') {
      return {
        status: 'SUCCEEDED' as const,
        paymentId: payment.id,
        idempotent: true,
      };
    }
    if (payment.status === 'REFUNDED') {
      throw new ConflictException('A refunded payment cannot be completed');
    }

    const ref = body.reference ?? `CASH-${Date.now()}`;

    await this.db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED', providerRef: ref },
      });
      await tx.paymentAttempt.create({
        data: {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          method: 'CASH',
          outcome: 'SUCCEEDED',
          status: 'SUCCEEDED',
          amount: payment.amount,
          providerRef: ref,
        },
      });
    });

    this.emitter.emit(
      PaymentEventNames.COMPLETED,
      new PaymentCompletedEvent(
        payment.id,
        bookingId,
        payment.booking.userId,
        payment.amount.toNumber(),
        'CASH',
      ),
    );

    await this.db.bookingStatusHistory.create({
      data: {
        bookingId,
        fromStatus: 'PENDING',
        toStatus: 'CONFIRMED',
        changedBy: actor.sub,
        reason: 'Payment collected in cash at hotel',
      },
    });

    await this.audit.record(
      actor.sub,
      'PAYMENT_CASH_PAID',
      'Payment',
      payment.id,
      { bookingId, amount: payment.amount.toNumber() },
    );

    return {
      status: 'SUCCEEDED' as const,
      paymentId: payment.id,
      idempotent: false,
    };
  }

  async refund(bookingId: string, actor: { sub: string; role: string }) {
    const payment = await this.db.payment.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: {
            hotel: { select: { managerId: true } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const isOwner =
      payment.booking.userId === actor.sub &&
      payment.booking.status === 'CANCELLED';
    const isPlatformOperator = ['STAFF', 'ADMIN'].includes(actor.role);
    const isHotelManager =
      actor.role === 'MANAGER' &&
      payment.booking.hotel.managerId === actor.sub;

    if (!isOwner && !isPlatformOperator && !isHotelManager) {
      throw new ForbiddenException('You cannot refund this booking');
    }
    if (payment.status === 'REFUNDED') {
      return {
        status: 'REFUNDED' as const,
        paymentId: payment.id,
        refundAmount: payment.refundAmount?.toNumber() ?? 0,
        idempotent: true,
      };
    }
    if (payment.status !== 'SUCCEEDED') {
      throw new ConflictException('Only a successful payment can be refunded');
    }

    const refundAmount = isPlatformOperator
      ? payment.amount.toNumber()
      : calculateRefundAmount(
          payment.amount.toNumber(),
          payment.booking.checkIn,
        );

    const adapter = this.registry.get(payment.method);
    if (payment.providerRef) {
      await adapter.refund(payment.providerRef, refundAmount);
    }

    const changed = await this.db.payment.updateMany({
      where: { id: payment.id, status: 'SUCCEEDED' },
      data: {
        status: 'REFUNDED',
        refundAmount,
        refundedAt: new Date(),
      },
    });
    if (changed.count === 0) {
      return {
        status: 'REFUNDED' as const,
        paymentId: payment.id,
        refundAmount: payment.refundAmount?.toNumber() ?? refundAmount,
        idempotent: true,
      };
    }

    this.emitter.emit(
      PaymentEventNames.REFUNDED,
      new PaymentRefundedEvent(
        payment.id,
        bookingId,
        payment.booking.userId,
        refundAmount,
        payment.method,
      ),
    );
    await this.audit.record(
      actor.sub,
      'PAYMENT_REFUNDED',
      'Payment',
      payment.id,
      { bookingId, refundAmount, method: payment.method },
    );
    return {
      status: 'REFUNDED' as const,
      paymentId: payment.id,
      refundAmount,
      idempotent: false,
    };
  }

  // ── Chapa Flow: OTP Verification ────────────────────────────────────────────

  /**
   * Verify OTP for Telebirr payments.
   * On success, transitions payment to SUCCEEDED and confirms booking.
   */
  async verifyOtp(
    paymentId: string,
    code: string,
  ): Promise<{
    status: 'SUCCEEDED' | 'FAILED';
    reason?: string;
    paymentId: string;
    bookingId?: string;
  }> {
    if (!this.otpService) {
      throw new BadRequestException('OTP service not available');
    }

    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status !== 'OTP_SENT') {
      return {
        status: 'FAILED',
        reason: 'Payment is not in OTP verification state',
        paymentId,
      };
    }

    const result = await this.otpService.verifyOtp(paymentId, code);

    if (!result.valid) {
      const statusMap = {
        INVALID: 'FAILED',
        EXPIRED: 'FAILED',
        MAX_ATTEMPTS: 'FAILED',
      } as const;

      return {
        status: statusMap[result.reason!],
        reason: result.reason === 'INVALID'
          ? 'Incorrect verification code'
          : result.reason === 'EXPIRED'
            ? 'Verification code expired'
            : 'Too many attempts',
        paymentId,
      };
    }

    // OTP valid — transition to SUCCEEDED
    await this.completePayment(paymentId, payment.bookingId, 'OTP_VERIFIED');

    return {
      status: 'SUCCEEDED',
      paymentId,
      bookingId: payment.bookingId,
    };
  }

  // ── Chapa Flow: Bank Callback ───────────────────────────────────────────────

  /**
   * Handle bank authorization callback.
   */
  async handleBankCallback(
    paymentId: string,
    body: {
      status: 'AUTHORIZED' | 'DECLINED' | 'INSUFFICIENT_BALANCE' | 'TIMEOUT';
      bankTransactionId?: string;
      pin?: string;
    },
  ): Promise<{
    status: 'SUCCEEDED' | 'FAILED';
    reason?: string;
    paymentId: string;
  }> {
    if (!this.chapa) {
      throw new BadRequestException('Chapa provider not available');
    }

    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status !== 'PROCESSING') {
      return {
        status: 'FAILED',
        reason: 'Payment is not in processing state',
        paymentId,
      };
    }

    const bankCode = payment.bankCode ?? 'CBE';
    const accountNumber = '100000'; // Default demo account

    const result = await this.chapa.handleBankAuthorization(
      paymentId,
      bankCode,
      accountNumber,
      payment.amount.toNumber(),
      body.status,
    );

    if (result.approved) {
      await this.completePayment(paymentId, payment.bookingId, 'BANK_AUTHORIZED');
      return { status: 'SUCCEEDED', paymentId };
    }

    // Failed
    await this.db.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED',
        failureReason: result.failureReason ?? 'Bank authorization failed',
      },
    });

    await this.db.paymentAttempt.create({
      data: {
        bookingId: payment.bookingId,
        paymentId: payment.id,
        method: payment.method,
        outcome: 'FAILED',
        status: 'FAILED',
        amount: payment.amount,
        errorMessage: result.failureReason,
      },
    });

    this.emitter.emit(
      PaymentEventNames.FAILED,
      new PaymentFailedEvent(
        payment.id,
        payment.bookingId,
        payment.booking.userId,
        payment.amount.toNumber(),
        payment.method,
        result.failureReason ?? 'Bank authorization failed',
      ),
    );

    return {
      status: 'FAILED',
      reason: result.failureReason ?? 'Bank authorization failed',
      paymentId,
    };
  }

  // ── Chapa Flow: Webhook Verification ────────────────────────────────────────

  /**
   * Handle Chapa webhook with full server-side verification.
   * Idempotent — duplicate webhooks return the existing result.
   */
  async handleWebhook(
    txRef: string,
    body: {
      status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
      amount?: number;
      currency?: string;
    },
  ): Promise<{
    status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'ALREADY_PROCESSED';
    paymentId: string;
  }> {
    const payment = await this.db.payment.findFirst({
      where: { txRef },
      include: { booking: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment not found for tx_ref: ${txRef}`);
    }

    // Idempotent: already in terminal state
    if (payment.status === 'SUCCEEDED') {
      return { status: 'ALREADY_PROCESSED', paymentId: payment.id };
    }
    if (payment.status === 'REFUNDED') {
      throw new ConflictException('A refunded payment cannot be modified');
    }

    // Validate amount (never trust frontend)
    if (body.amount !== undefined) {
      const bookingTotal = payment.booking.totalPrice.toNumber();
      if (Math.abs(body.amount - bookingTotal) > 0.01) {
        this.logger.error({
          message: 'Webhook amount mismatch',
          txRef,
          webhookAmount: body.amount,
          bookingTotal,
          paymentId: payment.id,
        });
        throw new BadRequestException('PAYMENT_AMOUNT_MISMATCH');
      }
    }

    // Validate currency
    if (body.currency && body.currency !== payment.currency) {
      throw new BadRequestException('PAYMENT_CURRENCY_MISMATCH');
    }

    // Record webhook event
    await this.db.paymentEvent.create({
      data: {
        paymentId: payment.id,
        eventType: 'WEBHOOK_RECEIVED',
        status: body.status,
        payload: { txRef, amount: body.amount, currency: body.currency },
      },
    });

    if (body.status === 'SUCCESS') {
      await this.completePayment(payment.id, payment.bookingId, 'WEBHOOK');
      return { status: 'SUCCEEDED', paymentId: payment.id };
    }

    if (body.status === 'FAILED' || body.status === 'CANCELLED') {
      const status = body.status === 'FAILED' ? 'FAILED' : 'CANCELLED';
      await this.db.payment.update({
        where: { id: payment.id },
        data: {
          status,
          failureReason: body.status === 'FAILED'
            ? 'Payment failed via webhook'
            : 'Payment cancelled via webhook',
        },
      });

      await this.db.paymentAttempt.create({
        data: {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          method: payment.method,
          outcome: status,
          status,
          amount: payment.amount,
        },
      });

      this.emitter.emit(
        PaymentEventNames.FAILED,
        new PaymentFailedEvent(
          payment.id,
          payment.bookingId,
          payment.booking.userId,
          payment.amount.toNumber(),
          payment.method,
          `Payment ${status.toLowerCase()} via webhook`,
        ),
      );

      return { status, paymentId: payment.id };
    }

    return { status: 'FAILED', paymentId: payment.id };
  }

  // ── Chapa Flow: Payment Status ──────────────────────────────────────────────

  /**
   * Get payment status for polling.
   */
  async getPaymentStatus(paymentId: string) {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        txRef: true,
        amount: true,
        currency: true,
        method: true,
        failureReason: true,
        completedAt: true,
      },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  // ── Chapa Flow: Cancel Payment ──────────────────────────────────────────────

  /**
   * Cancel a pending/processing payment.
   */
  async cancelPayment(
    paymentId: string,
    userId: string,
  ): Promise<{ status: string }> {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.booking.userId !== userId) {
      throw new ForbiddenException('You cannot cancel this payment');
    }

    if (!['PENDING', 'PROCESSING', 'OTP_SENT'].includes(payment.status)) {
      return { status: payment.status };
    }

    await this.db.payment.update({
      where: { id: paymentId },
      data: { status: 'CANCELLED' },
    });

    await this.db.paymentEvent.create({
      data: {
        paymentId,
        eventType: 'PAYMENT_CANCELLED',
        status: 'CANCELLED',
      },
    });

    return { status: 'CANCELLED' };
  }

  // ── Chapa Flow: Initiate with Chapa Provider ────────────────────────────────

  /**
   * Initiate payment via Chapa provider with method-specific flow.
   */
  async createChapaIntent(
    bookingId: string,
    method: PaymentMethod,
    userId: string,
    details: {
      phone?: string;
      email?: string;
      bankCode?: string;
      accountNumber?: string;
    } = {},
  ) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('You cannot pay for this booking');
    }
    if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') {
      throw new ConflictException('This booking can no longer be paid');
    }

    if (!this.chapa) {
      throw new BadRequestException('Chapa provider not available');
    }

    // Generate tx_ref
    const txRef = `CHP-YT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Chapa methods (Telebirr + bank methods) are handled directly by ChapaMockProvider,
    // not through the legacy gateway registry. Only use the registry for non-Chapa methods.
    let providerRef = txRef;
    if (!this.chapa.isSupportedMethod(method)) {
      const adapter = this.registry.get(method);
      const result = await adapter.initiate(
        {
          id: booking.id,
          totalPrice: booking.totalPrice.toNumber(),
          currency: 'ETB',
        },
        booking.totalPrice.toNumber(),
        'ETB',
      );
      providerRef = result.providerRef;
    }

    // Determine initial status based on method
    let initialStatus: 'PENDING' | 'PENDING_AT_HOTEL' | 'PROCESSING' | 'OTP_SENT';
    if (method === 'CASH') {
      initialStatus = 'PENDING_AT_HOTEL';
    } else if (method === 'TELEBIRR') {
      initialStatus = 'PENDING'; // Will transition to OTP_SENT after OTP generation
    } else {
      initialStatus = 'PROCESSING'; // Bank methods
    }

    const payment = await this.db.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        userId,
        provider: 'CHAPA',
        method,
        amount: booking.totalPrice,
        currency: 'ETB',
        status: initialStatus,
        txRef,
        providerRef,
        idempotencyKey: `YT-${booking.id.slice(0, 8)}-PAYMENT-01`,
        metadata: details.phone
          ? { phone: details.phone }
          : details.email
            ? { email: details.email }
            : undefined,
      },
      update: {
        method,
        status: initialStatus,
        txRef,
        providerRef,
      },
    });

    // Handle CASH
    if (method === 'CASH') {
      await this.db.booking.update({
        where: { id: booking.id },
        data: { status: 'CONFIRMED' },
      });
      await this.db.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: 'CONFIRMED',
          changedBy: userId,
          reason: 'Cash at hotel booking confirmed',
        },
      });
    }

    // Handle Telebirr OTP
    if (method === 'TELEBIRR' && details.phone && this.chapa) {
      await this.chapa.initializeTelebirr(
        payment.id,
        txRef,
        booking.totalPrice.toNumber(),
        details.phone,
      );
    }

    // Handle Bank methods
    if (method !== 'TELEBIRR' && method !== 'CASH' && this.chapa) {
      const bankCode = this.chapa.getBankCode(method) ?? 'CBE';
      const bankResult = await this.chapa.initializeBank(
        payment.id,
        txRef,
        booking.totalPrice.toNumber(),
        bankCode,
        details.accountNumber ?? '100000',
      );

      this.logger.log({
        message: 'Chapa payment initiated',
        paymentId: payment.id,
        bookingId,
        method,
        txRef,
        amount: booking.totalPrice.toNumber(),
        paymentReference: bankResult.paymentReference,
        correlationId: getRequestId(),
      });

      return {
        paymentId: payment.id,
        bookingId: booking.id,
        method,
        txRef,
        amount: payment.amount.toNumber(),
        status: payment.status,
        paymentReference: bankResult.paymentReference,
      };
    }

    this.logger.log({
      message: 'Chapa payment initiated',
      paymentId: payment.id,
      bookingId,
      method,
      txRef,
      amount: booking.totalPrice.toNumber(),
      correlationId: getRequestId(),
    });

    return {
      paymentId: payment.id,
      bookingId: booking.id,
      method,
      txRef,
      amount: payment.amount.toNumber(),
      status: payment.status,
    };
  }

  // ── Helper: Complete Payment ────────────────────────────────────────────────

  private async completePayment(
    paymentId: string,
    bookingId: string,
    trigger: string,
  ) {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });

    if (!payment) return;

    const changed = await this.db.payment.updateMany({
      where: { id: paymentId, status: { in: ['PENDING', 'PENDING_AT_HOTEL', 'OTP_SENT', 'PROCESSING', 'FAILED'] } },
      data: {
        status: 'SUCCEEDED',
        completedAt: new Date(),
      },
    });

    await this.db.paymentAttempt.create({
      data: {
        bookingId,
        paymentId,
        method: payment.method,
        outcome: 'SUCCEEDED',
        status: 'SUCCEEDED',
        amount: payment.amount,
        providerRef: payment.providerRef,
      },
    });

    await this.db.paymentEvent.create({
      data: {
        paymentId,
        eventType: 'PAYMENT_SUCCESS',
        status: 'SUCCEEDED',
        payload: { trigger },
      },
    });

    if (changed.count > 0) {
      await this.db.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' },
      });

      await this.db.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: payment.booking.status,
          toStatus: 'CONFIRMED',
          changedBy: 'system',
          reason: `Payment completed via ${trigger}`,
        },
      });
    }

    this.emitter.emit(
      PaymentEventNames.COMPLETED,
      new PaymentCompletedEvent(
        paymentId,
        bookingId,
        payment.booking.userId,
        payment.amount.toNumber(),
        payment.method,
      ),
    );

    await this.audit.record(
      payment.booking.userId,
      'PAYMENT_COMPLETED',
      'Payment',
      paymentId,
      { bookingId, method: payment.method, amount: payment.amount.toNumber(), trigger },
    );

    this.logger.log({
      message: 'Payment confirmed',
      paymentId,
      bookingId,
      method: payment.method,
      amount: payment.amount.toNumber(),
      trigger,
      correlationId: getRequestId(),
    });
  }

  private assertMockWebhookSecret(received: string | undefined) {
    const expected = this.config.getOrThrow<string>('payment.mockWebhookSecret');
    if (!received) throw new UnauthorizedException('Missing payment webhook secret');
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);
    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid payment webhook secret');
    }
  }
}
