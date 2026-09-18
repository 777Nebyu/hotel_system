import { Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockSmsService } from '../infrastructure/mock-sms.service';

@ApiTags('Dev: Mock SMS')
@Controller('dev/sms')
export class MockSmsController {
  constructor(private readonly sms: MockSmsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all mock SMS messages' })
  getAll() {
    return {
      data: this.sms.getAll(),
      count: this.sms.count(),
    };
  }

  @Post('clear')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear all mock SMS messages' })
  clear() {
    this.sms.clear();
    return { message: 'SMS inbox cleared' };
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a specific SMS message' })
  delete(id: string) {
    const deleted = this.sms.delete(id);
    if (!deleted) {
      return { message: 'Message not found' };
    }
    return { message: 'Message deleted' };
  }
}
