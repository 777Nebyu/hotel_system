import { Module } from '@nestjs/common';
import { FavoriteController } from './presentation/favorite.controller';
import { FavoriteService } from './application/favorite.service';

@Module({
  controllers: [FavoriteController],
  providers: [FavoriteService],
})
export class FavoriteModule {}
