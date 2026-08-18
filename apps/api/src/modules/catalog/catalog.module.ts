import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../common/services/audit.service';
import { ResourceScopeHelper } from '../../common/guards/resource-scope.helper';
import { CatalogService } from './application/catalog.service';
import { ManagerCatalogService } from './application/manager-catalog.service';
import {
  CloudinaryStorageService,
  LocalStorageService,
  STORAGE_SERVICE,
  type StorageService,
} from './infrastructure/storage/storage';
import { CatalogController } from './presentation/catalog.controller';
import { ManagerCatalogController } from './presentation/manager-catalog.controller';

@Module({
  controllers: [CatalogController, ManagerCatalogController],
  providers: [
    CatalogService,
    ManagerCatalogService,
    ResourceScopeHelper,
    AuditService,
    {
      provide: STORAGE_SERVICE,
      useFactory: (config: ConfigService): StorageService => {
        const cloudinary = config.get<{
          cloudName?: string;
          apiKey?: string;
          apiSecret?: string;
        }>('cloudinary');
        if (cloudinary?.apiKey && cloudinary.apiSecret) {
          return new CloudinaryStorageService(
            cloudinary.cloudName ?? '',
            cloudinary.apiKey,
            cloudinary.apiSecret,
          );
        }
        return new LocalStorageService();
      },
      inject: [ConfigService],
    },
  ],
})
export class CatalogModule {}
