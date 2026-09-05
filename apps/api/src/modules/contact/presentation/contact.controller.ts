import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  hotelIdParamsSchema,
} from '@repo/shared-types';
import { ContactService } from '../application/contact.service';
import {
  ContactThreadIdParamsDto,
  CreateContactThreadDto,
  SendContactMessageDto,
  UpdateContactStatusDto,
} from './dto/contact.dto';

class HotelIdParamsDto extends createZodDto(hotelIdParamsSchema) {}

const listThreadsQuerySchema = z.object({
  hotelId: z.string().optional(),
});
class ListThreadsQueryDto extends createZodDto(listThreadsQuerySchema) {}

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('contact')
@ApiBearerAuth()
@Controller()
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post('hotels/:id/contact')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Initiate a contact inquiry with a hotel' })
  createThread(
    @Param() params: HotelIdParamsDto,
    @Body() dto: CreateContactThreadDto,
    @Req() req: AuthedRequest,
  ) {
    return this.contact.createThread(params.id, dto, req.user);
  }

  @Get('contact/threads')
  @ApiOperation({ summary: 'List contact threads for current user/manager/staff' })
  listThreads(
    @Query() query: ListThreadsQueryDto,
    @Req() req: AuthedRequest,
  ) {
    return this.contact.listThreads(req.user, query.hotelId);
  }

  @Get('contact/threads/:threadId')
  @ApiOperation({ summary: 'Get thread details and messages' })
  getThread(
    @Param() params: ContactThreadIdParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.contact.getThread(params.threadId, req.user);
  }

  @Post('contact/threads/:threadId/messages')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Send a message in a contact thread' })
  sendMessage(
    @Param() params: ContactThreadIdParamsDto,
    @Body() dto: SendContactMessageDto,
    @Req() req: AuthedRequest,
  ) {
    return this.contact.sendMessage(params.threadId, dto, req.user);
  }

  @Patch('contact/threads/:threadId/status')
  @ApiOperation({ summary: 'Close or reopen a contact thread' })
  updateStatus(
    @Param() params: ContactThreadIdParamsDto,
    @Body() dto: UpdateContactStatusDto,
    @Req() req: AuthedRequest,
  ) {
    return this.contact.updateStatus(params.threadId, dto, req.user);
  }
}
