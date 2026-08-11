import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ReviewService {
  constructor(private readonly db: PrismaService) {}
}
