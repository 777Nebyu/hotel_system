import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../../../prisma/prisma.service';
import { MockSmsService } from '../infrastructure/mock-sms.service';
import { BankMockProvider } from '../infrastructure/gateways/bank-mock.provider';

@ApiTags('Admin: Payment Sandbox')
@ApiBearerAuth()
@Controller('admin/payment-sandbox')
export class AdminSandboxController {
  constructor(
    private readonly db: PrismaService,
    private readonly sms: MockSmsService,
    private readonly bank: BankMockProvider,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Sandbox dashboard — recent transactions' })
  async dashboard() {
    const recentPayments = await this.db.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        booking: {
          select: {
            id: true,
            bookingRef: true,
            user: { select: { fullName: true, email: true } },
          },
        },
      },
    });

    const stats = await this.db.payment.groupBy({
      by: ['status'],
      _count: true,
    });

    return {
      transactions: recentPayments.map((p) => ({
        id: p.id,
        txRef: p.txRef,
        provider: p.provider,
        method: p.method,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        bookingRef: p.booking?.bookingRef,
        customer: p.booking?.user?.fullName,
        createdAt: p.createdAt,
      })),
      stats: stats.map((s) => ({ status: s.status, count: s._count })),
    };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List transactions with filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'method', required: false })
  @ApiQuery({ name: 'provider', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async listTransactions(
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Query('provider') provider?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (method) where.method = method;
    if (provider) where.provider = provider;

    const [data, total] = await Promise.all([
      this.db.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * size,
        take: size,
        include: {
          booking: {
            select: {
              bookingRef: true,
              user: { select: { fullName: true, email: true } },
            },
          },
          events: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      }),
      this.db.payment.count({ where }),
    ]);

    return {
      data: data.map((p) => ({
        id: p.id,
        txRef: p.txRef,
        provider: p.provider,
        method: p.method,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        failureReason: p.failureReason,
        bankCode: p.bankCode,
        bookingRef: p.booking?.bookingRef,
        customer: p.booking?.user?.fullName,
        recentEvents: p.events.map((e) => ({
          type: e.eventType,
          status: e.status,
          createdAt: e.createdAt,
        })),
        createdAt: p.createdAt,
      })),
      meta: {
        total,
        page: pageNum,
        pageSize: size,
        pageCount: Math.ceil(total / size),
      },
    };
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Transaction detail with event history' })
  @ApiParam({ name: 'id' })
  async getTransaction(@Param('id') id: string) {
    const payment = await this.db.payment.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            bookingRef: true,
            totalPrice: true,
            status: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        events: { orderBy: { createdAt: 'asc' } },
        attempts: { orderBy: { attemptedAt: 'desc' } },
      },
    });

    if (!payment) {
      return { error: 'Transaction not found' };
    }

    return {
      id: payment.id,
      txRef: payment.txRef,
      provider: payment.provider,
      method: payment.method,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      bankCode: payment.bankCode,
      transactionId: payment.transactionId,
      failureReason: payment.failureReason,
      metadata: payment.metadata,
      booking: payment.booking,
      events: payment.events.map((e) => ({
        id: e.id,
        type: e.eventType,
        status: e.status,
        payload: e.payload,
        createdAt: e.createdAt,
      })),
      attempts: payment.attempts.map((a) => ({
        id: a.id,
        outcome: a.outcome,
        status: a.status,
        amount: a.amount,
        providerRef: a.providerRef,
        errorMessage: a.errorMessage,
        attemptedAt: a.attemptedAt,
      })),
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  @Get('sms')
  @ApiOperation({ summary: 'Mock SMS inbox' })
  getSms() {
    return {
      data: this.sms.getAll(),
      count: this.sms.count(),
    };
  }

  @Post('sms/clear')
  @ApiOperation({ summary: 'Clear mock SMS inbox' })
  clearSms() {
    this.sms.clear();
    return { message: 'SMS inbox cleared' };
  }

  @Delete('sms/:id')
  @ApiOperation({ summary: 'Delete a specific SMS' })
  deleteSms(@Param('id') id: string) {
    const deleted = this.sms.delete(id);
    return deleted
      ? { message: 'SMS deleted' }
      : { message: 'SMS not found' };
  }

  @Get('banks')
  @ApiOperation({ summary: 'List demo bank accounts' })
  getBanks() {
    const banks: Record<string, unknown[]> = {};
    for (const code of this.bank.getSupportedBanks()) {
      banks[code] = this.bank.getDemoAccounts(code).map((a) => ({
        accountNumber: a.accountNumber,
        balance: a.balance,
        status: a.status,
        holderName: a.holderName,
        bankName: this.bank.getBankName(a.bankCode),
      }));
    }
    return { banks };
  }
}
