import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { TripService } from '../application/trip.service';
import {
  BuildDayDto,
  CreateTripDto,
  CreateTripItemDto,
  TripIdParamsDto,
  TripItemParamsDto,
  UpdateTripDto,
  UpdateTripItemDto,
} from './dto/trip.dto';

interface AuthedRequest {
  user: { sub: string };
}

@ApiTags('trips')
@ApiBearerAuth()
@Controller('trips')
@Roles(Role.CUSTOMER)
export class TripController {
  constructor(private readonly trips: TripService) {}

  @Get()
  @ApiOperation({ summary: 'List the current customer trips' })
  list(@Req() req: AuthedRequest) {
    return this.trips.list(req.user.sub);
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Create a private trip' })
  create(@Body() dto: CreateTripDto, @Req() req: AuthedRequest) {
    return this.trips.create(dto, req.user.sub);
  }

  @Get(':tripId')
  @ApiOperation({ summary: 'Get a private trip and itinerary' })
  get(@Param() params: TripIdParamsDto, @Req() req: AuthedRequest) {
    return this.trips.get(params.tripId, req.user.sub);
  }

  @Patch(':tripId')
  @ApiOperation({ summary: 'Update a private trip' })
  update(@Param() params: TripIdParamsDto, @Body() dto: UpdateTripDto, @Req() req: AuthedRequest) {
    return this.trips.update(params.tripId, dto, req.user.sub);
  }

  @Delete(':tripId')
  @ApiOperation({ summary: 'Soft-delete a private trip' })
  remove(@Param() params: TripIdParamsDto, @Req() req: AuthedRequest) {
    return this.trips.remove(params.tripId, req.user.sub);
  }

  @Post(':tripId/items')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Add an itinerary item with conflict metadata' })
  addItem(@Param() params: TripIdParamsDto, @Body() dto: CreateTripItemDto, @Req() req: AuthedRequest) {
    return this.trips.addItem(params.tripId, dto, req.user.sub);
  }

  @Patch(':tripId/items/:itemId')
  @ApiOperation({ summary: 'Edit an itinerary item' })
  updateItem(@Param() params: TripItemParamsDto, @Body() dto: UpdateTripItemDto, @Req() req: AuthedRequest) {
    return this.trips.updateItem(params.tripId, params.itemId, dto, req.user.sub);
  }

  @Delete(':tripId/items/:itemId')
  @ApiOperation({ summary: 'Delete an itinerary item without changing its booking' })
  removeItem(@Param() params: TripItemParamsDto, @Req() req: AuthedRequest) {
    return this.trips.removeItem(params.tripId, params.itemId, req.user.sub);
  }

  @Post(':tripId/build-day')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Generate a day plan draft based on hotel location, opening hours, and duration' })
  buildDay(@Param() params: TripIdParamsDto, @Body() dto: BuildDayDto, @Req() req: AuthedRequest) {
    return this.trips.buildDay(params.tripId, dto, req.user.sub);
  }
}

