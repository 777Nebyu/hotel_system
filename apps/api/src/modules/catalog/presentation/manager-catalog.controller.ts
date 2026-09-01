import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ManagerCatalogService } from '../application/manager-catalog.service';
import {
  AttachAmenityDto,
  AvailabilityBulkDto,
  BlockMaintenanceDto,
  CreateHotelDto,
  CreateRoomDto,
  HotelAmenityParamsDto,
  HotelIdParamsDto,
  ImageIdParamsDto,
  RoomAmenityParamsDto,
  RoomIdParamsDto,
  RoomImageParamsDto,
  SeasonalPricingDto,
  SeasonalPricingParamsDto,
  UpdateHotelDto,
  UpdateRoomDto,
  UpsertHotelPolicyDto,
} from './dto/catalog.dto';

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('catalog (manager)')
@ApiBearerAuth()
@Controller('catalog')
export class ManagerCatalogController {
  constructor(private readonly manager: ManagerCatalogService) {}

  @Get('manager/hotels')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'List hotels managed by the current user' })
  myHotels(@Req() req: AuthedRequest) {
    return this.manager.myHotels(req.user.sub);
  }

  @Post('hotels')
  @Roles(Role.MANAGER, Role.ADMIN)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @ApiOperation({ summary: 'Create a hotel' })
  createHotel(@Body() dto: CreateHotelDto, @Req() req: AuthedRequest) {
    return this.manager.createHotel(dto, req.user);
  }

  @Patch('hotels/:id')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Update a hotel' })
  updateHotel(
    @Param() params: HotelIdParamsDto,
    @Body() dto: UpdateHotelDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.updateHotel(params.id, dto, req.user);
  }

  @Delete('hotels/:id')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a hotel' })
  deleteHotel(@Param() params: HotelIdParamsDto, @Req() req: AuthedRequest) {
    return this.manager.deleteHotel(params.id, req.user);
  }

  @Get('hotels/:id/policy')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Get hotel policy rules' })
  getHotelPolicy(
    @Param() params: HotelIdParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.getHotelPolicy(params.id, req.user);
  }

  @Put('hotels/:id/policy')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Configure hotel check-in/out and cancellation policies' })
  upsertHotelPolicy(
    @Param() params: HotelIdParamsDto,
    @Body() dto: UpsertHotelPolicyDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.upsertHotelPolicy(params.id, dto, req.user);
  }

  @Post('hotels/:id/images')
  @Roles(Role.MANAGER, Role.ADMIN)
  @UseInterceptors(
    FilesInterceptor('images', 10, { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload hotel images' })
  addImages(
    @Param() params: HotelIdParamsDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: AuthedRequest,
  ) {
    return this.manager.addHotelImages(params.id, files ?? [], req.user);
  }

  @Patch('hotels/:id/images/:imageId/primary')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Mark a hotel image as primary' })
  setPrimaryImage(
    @Param() params: ImageIdParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.setPrimaryHotelImage(
      params.id,
      params.imageId,
      req.user,
    );
  }

  @Delete('hotels/:id/images/:imageId')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Remove a hotel image' })
  removeImage(@Param() params: ImageIdParamsDto, @Req() req: AuthedRequest) {
    return this.manager.removeHotelImage(params.id, params.imageId, req.user);
  }

  @Post('hotels/:id/amenities')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Attach an amenity to a hotel' })
  attachAmenity(
    @Param() params: HotelIdParamsDto,
    @Body() dto: AttachAmenityDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.attachHotelAmenity(params.id, dto.amenityId, req.user);
  }

  @Delete('hotels/:id/amenities/:amenityId')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Detach an amenity from a hotel' })
  detachAmenity(
    @Param() params: HotelAmenityParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.detachHotelAmenity(
      params.id,
      params.amenityId,
      req.user,
    );
  }

  @Post('hotels/:id/rooms')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Create a room in a hotel' })
  createRoom(
    @Param() params: HotelIdParamsDto,
    @Body() dto: CreateRoomDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.createRoom(params.id, dto, req.user);
  }

  @Patch('rooms/:roomId')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Update a room' })
  updateRoom(
    @Param() params: RoomIdParamsDto,
    @Body() dto: UpdateRoomDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.updateRoom(params.roomId, dto, req.user);
  }

  @Delete('rooms/:roomId')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a room' })
  deleteRoom(@Param() params: RoomIdParamsDto, @Req() req: AuthedRequest) {
    return this.manager.deleteRoom(params.roomId, req.user);
  }

  @Post('rooms/:roomId/images')
  @Roles(Role.MANAGER, Role.ADMIN)
  @UseInterceptors(
    FilesInterceptor('images', 10, { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload room images' })
  addRoomImages(
    @Param() params: RoomIdParamsDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: AuthedRequest,
  ) {
    return this.manager.addRoomImages(params.roomId, files ?? [], req.user);
  }

  @Patch('rooms/:roomId/images/:imageId/primary')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Mark a room image as primary' })
  setRoomPrimaryImage(
    @Param() params: RoomImageParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.setPrimaryRoomImage(
      params.roomId,
      params.imageId,
      req.user,
    );
  }

  @Delete('rooms/:roomId/images/:imageId')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Remove a room image' })
  removeRoomImage(
    @Param() params: RoomImageParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.removeRoomImage(
      params.roomId,
      params.imageId,
      req.user,
    );
  }

  @Post('rooms/:roomId/amenities')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Attach an amenity to a room' })
  attachRoomAmenity(
    @Param() params: RoomIdParamsDto,
    @Body() dto: AttachAmenityDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.attachRoomAmenity(
      params.roomId,
      dto.amenityId,
      req.user,
    );
  }

  @Delete('rooms/:roomId/amenities/:amenityId')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Detach an amenity from a room' })
  detachRoomAmenity(
    @Param() params: RoomAmenityParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.detachRoomAmenity(
      params.roomId,
      params.amenityId,
      req.user,
    );
  }

  @Post('rooms/:roomId/seasonal-pricing')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Add seasonal pricing for a room' })
  addSeasonalPricing(
    @Param() params: RoomIdParamsDto,
    @Body() dto: SeasonalPricingDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.upsertSeasonalPricing(params.roomId, dto, req.user);
  }

  @Delete('rooms/:roomId/seasonal-pricing/:pricingId')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Remove seasonal pricing for a room' })
  removeSeasonalPricing(
    @Param() params: SeasonalPricingParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.removeSeasonalPricing(
      params.roomId,
      params.pricingId,
      req.user,
    );
  }

  @Post('rooms/:roomId/availability')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Bulk set room availability for a set of dates' })
  setAvailability(
    @Param() params: RoomIdParamsDto,
    @Body() dto: AvailabilityBulkDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.upsertAvailability(params.roomId, dto, req.user);
  }

  @Post('maintenance/block')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Block dates for room maintenance (51-availability-calendar-maintenance)',
  })
  blockMaintenance(
    @Body() dto: BlockMaintenanceDto,
    @Req() req: AuthedRequest,
  ) {
    return this.manager.blockMaintenance(dto, req.user);
  }
}
