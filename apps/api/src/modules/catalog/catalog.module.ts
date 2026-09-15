import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { AuditService } from '../../common/services/audit.service';
import { ResourceScopeHelper } from '../../common/guards/resource-scope.helper';
import { CatalogService } from './application/catalog.service';
import { ManagerCatalogService } from './application/manager-catalog.service';
import { CatalogController } from './presentation/catalog.controller';
import { ManagerCatalogController } from './presentation/manager-catalog.controller';

@Module({
  imports: [StorageModule],
  controllers: [CatalogController, ManagerCatalogController],
  providers: [
    CatalogService,
    ManagerCatalogService,
    ResourceScopeHelper,
    AuditService,
  ],
})
export class CatalogModule {}
