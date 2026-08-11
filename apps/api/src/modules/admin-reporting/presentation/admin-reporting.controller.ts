import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('admin-reporting')
@Controller('admin/reports')
export class AdminReportingController {}
