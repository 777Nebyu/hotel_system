import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HotelStatus,
  SuspensionRequestStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import type {
  RequestSuspensionInput,
  DecideSuspensionInput,
} from '@repo/shared-types';

@Injectable()
export class AdminSuspensionService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPending() {
    return this.db.suspensionRequest.findMany({
      where: { status: SuspensionRequestStatus.PENDING_APPROVAL },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async request(dto: RequestSuspensionInput, requesterId: string) {
    const suspensionRequest = await this.db.suspensionRequest.create({
      data: {
        requesterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      },
    });
    await this.audit.record(requesterId, 'REQUEST_SUSPENSION', dto.targetType, dto.targetId, {
      reason: dto.reason,
      suspensionRequestId: suspensionRequest.id,
    });
    return suspensionRequest;
  }

  async decide(
    id: string,
    dto: DecideSuspensionInput,
    approverId: string,
  ) {
    const pending = await this.db.suspensionRequest.findUnique({
      where: { id },
    });
    if (!pending) throw new NotFoundException('Suspension request not found');
    if (pending.status !== SuspensionRequestStatus.PENDING_APPROVAL) {
      throw new BadRequestException('This request has already been decided');
    }
    if (pending.requesterId === approverId) {
      throw new ForbiddenException(
        'Four-eyes principle: The requester cannot approve their own suspension request',
      );
    }

    const newStatus =
      dto.decision === 'APPROVED'
        ? SuspensionRequestStatus.APPROVED
        : SuspensionRequestStatus.REJECTED;

    const updated = await this.db.suspensionRequest.update({
      where: { id },
      data: { status: newStatus, approverId, decidedAt: new Date() },
    });

    if (dto.decision === 'APPROVED') {
      await this.applySuspension(pending.targetType, pending.targetId, approverId);
    }

    await this.audit.record(approverId, `SUSPENSION_${dto.decision}`, pending.targetType, pending.targetId, {
      suspensionRequestId: id,
      decision: dto.decision,
    });

    return updated;
  }

  async cancel(id: string, actorId: string) {
    const pending = await this.db.suspensionRequest.findUnique({
      where: { id },
    });
    if (!pending) throw new NotFoundException('Suspension request not found');
    if (pending.status !== SuspensionRequestStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only PENDING_APPROVAL requests can be cancelled');
    }
    if (pending.requesterId !== actorId) {
      throw new ForbiddenException('Only the requester can cancel this request');
    }
    const updated = await this.db.suspensionRequest.update({
      where: { id },
      data: {
        status: SuspensionRequestStatus.CANCELLED,
        decidedAt: new Date(),
      },
    });
    await this.audit.record(actorId, 'CANCEL_SUSPENSION_REQUEST', pending.targetType, pending.targetId, {
      suspensionRequestId: id,
    });
    return updated;
  }

  private async applySuspension(targetType: string, targetId: string, actorId: string) {
    if (targetType === 'USER') {
      await this.db.user.update({
        where: { id: targetId },
        data: { isActive: false },
      });
    } else if (targetType === 'HOTEL') {
      await this.db.hotel.update({
        where: { id: targetId },
        data: { status: HotelStatus.SUSPENDED },
      });
    }
  }
}
