import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DiscoverService } from '../application/discover.service';
import {
  CreatePlaceDto,
  EmergencyContactsQueryDto,
  HeritageQueryDto,
  NearbyPlacesQueryDto,
  SearchPlacesQueryDto,
} from './dto/discover.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../generated/prisma/client';

@ApiTags('discover')
@Controller('discover')
export class DiscoverController {
  constructor(private readonly discoverService: DiscoverService) {}

  @Public()
  @Get('destinations')
  @ApiOperation({ summary: 'List supported destinations with verified places and hotel counts' })
  getDestinations(@Query('limit') limit?: string) {
    return this.discoverService.getDestinations(limit ? Number(limit) : undefined);
  }

  @Public()
  @Get('destinations/:cityId')
  @ApiOperation({ summary: 'Get a destination with nearby verified places and active hotels' })
  getDestination(@Param('cityId') cityId: string) {
    return this.discoverService.getDestination(cityId);
  }

  @Public()
  @Get('nearby')
  @ApiOperation({
    summary: 'Find nearby places and attractions by coordinates',
  })
  getNearby(@Query() query: NearbyPlacesQueryDto) {
    return this.discoverService.getNearby(query);
  }

  @Public()
  @Get('heritage')
  @ApiOperation({
    summary: 'List verified heritage, cultural sites, and museums',
  })
  getHeritage(@Query() query: HeritageQueryDto) {
    return this.discoverService.getHeritage(query);
  }

  @Public()
  @Get('emergency')
  @ApiOperation({
    summary: 'Get verified emergency contacts and safety numbers',
  })
  getEmergencyContacts(@Query() query: EmergencyContactsQueryDto) {
    return this.discoverService.getEmergencyContacts(query);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search places by text query' })
  search(@Query() query: SearchPlacesQueryDto) {
    return this.discoverService.search(query);
  }

  @Public()
  @Get('sources')
  @ApiOperation({
    summary: 'Get verified content sources and licensing information',
  })
  getSources() {
    return this.discoverService.getSources();
  }

  @Public()
  @Get('places/:id')
  @ApiOperation({
    summary: 'Get full details for a place with source attribution',
  })
  getPlaceById(@Param('id') id: string) {
    return this.discoverService.getById(id);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post('places')
  @ApiOperation({ summary: 'Add a new verified place (Admin / Manager only)' })
  createPlace(@Body() dto: CreatePlaceDto) {
    return this.discoverService.createPlace(dto);
  }
}
