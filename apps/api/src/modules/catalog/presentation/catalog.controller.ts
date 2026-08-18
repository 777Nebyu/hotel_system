import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from '../application/catalog.service';
import {
  AvailabilityWindowDto,
  HotelIdParamsDto,
  RoomIdParamsDto,
  SearchHotelsDto,
} from './dto/catalog.dto';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('catalog')
@Public()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('countries')
  @ApiOperation({ summary: 'List countries with their cities' })
  countries() {
    return this.catalog.listCountries();
  }

  @Get('cities')
  @ApiOperation({ summary: 'List cities, optionally filtered by country' })
  cities(@Query('country') country?: string) {
    return this.catalog.listCities(country);
  }

  @Get('amenities')
  @ApiOperation({ summary: 'List all available amenities' })
  amenities() {
    return this.catalog.listAmenities();
  }

  @Get('hotels')
  @ApiOperation({ summary: 'Search hotels with filters, sorting, pagination' })
  search(@Query() query: SearchHotelsDto) {
    return this.catalog.search(query);
  }

  @Get('hotels/:id')
  @ApiOperation({ summary: 'Get a hotel detail' })
  hotel(@Param() params: HotelIdParamsDto) {
    return this.catalog.hotelById(params.id);
  }

  @Get('hotels/:id/rooms')
  @ApiOperation({
    summary:
      'List a hotel rooms with availability and price range for a stay window',
  })
  rooms(
    @Param() params: HotelIdParamsDto,
    @Query() window: AvailabilityWindowDto,
  ) {
    return this.catalog.hotelRoomsWithAvailability(params.id, window);
  }

  @Get('rooms/:roomId')
  @ApiOperation({ summary: 'Get a room detail' })
  room(@Param() params: RoomIdParamsDto) {
    return this.catalog.roomById(params.roomId);
  }
}
