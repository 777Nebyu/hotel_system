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
import { NotificationService } from '../application/notification.service';
import {
  NotificationIdParamsDto,
  NotificationsQueryDto,
  RegisterPushTokenDto,
  UpdateNotificationPreferenceDto,
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

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for the current user' })
  getPreferences(@Req() req: AuthedRequest) {
    return this.notifications.getPreferences(req.user.sub);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preference for the current user' })
  updatePreference(
    @Body() dto: UpdateNotificationPreferenceDto,
    @Req() req: AuthedRequest,
  ) {
    return this.notifications.updatePreference(
      req.user.sub,
      dto.type,
      dto.channel,
      dto.enabled,
    );
  }

  @Post('push-token')
  @ApiOperation({ summary: 'Register mobile device push token' })
  registerPushToken(
    @Body() dto: RegisterPushTokenDto,
    @Req() req: AuthedRequest,
  ) {
    return this.notifications.registerPushToken(req.user.sub, dto.token);
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
