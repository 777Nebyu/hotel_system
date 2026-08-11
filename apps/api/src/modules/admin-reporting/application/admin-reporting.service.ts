import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminReportingService {
  constructor(private readonly db: PrismaService) {}
}
