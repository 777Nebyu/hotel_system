import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationService } from '../application/notification.service';
import {
  NotificationIdParamsDto,
  NotificationsQueryDto,
} from './dto/notification.dto';

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  list(@Query() query: NotificationsQueryDto, @Req() req: AuthedRequest) {
    return this.notifications.list(req.user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count for the current user' })
  unread(@Req() req: AuthedRequest) {
    return this.notifications.unreadCount(req.user.sub);
  }

  @Post(':notificationId/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  read(@Param() params: NotificationIdParamsDto, @Req() req: AuthedRequest) {
    return this.notifications.markRead(params.notificationId, req.user.sub);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  readAll(@Req() req: AuthedRequest) {
    return this.notifications.markAllRead(req.user.sub);
  }
}
