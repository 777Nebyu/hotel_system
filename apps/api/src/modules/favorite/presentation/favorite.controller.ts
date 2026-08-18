import { Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { FavoriteService } from '../application/favorite.service';
import { HotelIdParamsDto } from './dto/favorite.dto';

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('favorites')
@ApiBearerAuth()
@Roles(Role.CUSTOMER)
@Controller('favorites')
export class FavoriteController {
  constructor(private readonly favorites: FavoriteService) {}

  @Get('my')
  @ApiOperation({ summary: 'List the current user favorite hotels' })
  my(@Req() req: AuthedRequest) {
    return this.favorites.myFavorites(req.user.sub);
  }

  @Post(':id')
  @ApiOperation({ summary: 'Add a hotel to favorites' })
  add(@Param() params: HotelIdParamsDto, @Req() req: AuthedRequest) {
    return this.favorites.toggleOn(params.id, req.user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a hotel from favorites' })
  remove(@Param() params: HotelIdParamsDto, @Req() req: AuthedRequest) {
    return this.favorites.toggleOff(params.id, req.user.sub);
  }
}
