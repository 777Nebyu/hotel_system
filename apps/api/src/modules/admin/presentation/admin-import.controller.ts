import {
  BadRequestException,
  Controller,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminImportService } from '../application/admin-import.service';
import { createZodDto } from 'nestjs-zod';
import { hotelIdParamsSchema } from '@repo/shared-types';

class HotelIdParamsDto extends createZodDto(hotelIdParamsSchema) {}

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('admin (import)')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('admin/import')
export class AdminImportController {
  constructor(private readonly imports: AdminImportService) {}

  @Post('hotels/:id/rooms')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Bulk import hotel rooms from CSV' })
  async importRooms(
    @Param() params: HotelIdParamsDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('CSV file is required');
    }
    return this.imports.importRoomsFromCsv(params.id, file.buffer, req.user);
  }
}
