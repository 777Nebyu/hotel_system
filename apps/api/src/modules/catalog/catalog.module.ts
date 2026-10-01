import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { DiscoverModule } from '../discover/discover.module';
import { AuditService } from '../../common/services/audit.service';
import { ResourceScopeHelper } from '../../common/guards/resource-scope.helper';
import { CatalogService } from './application/catalog.service';
import { ManagerCatalogService } from './application/manager-catalog.service';
import { CatalogController } from './presentation/catalog.controller';
import { ManagerCatalogController } from './presentation/manager-catalog.controller';

@Module({
  imports: [StorageModule, DiscoverModule],
  controllers: [CatalogController, ManagerCatalogController],
  providers: [
    CatalogService,
    ManagerCatalogService,
    ResourceScopeHelper,
    AuditService,
  ],
  // AiModule injects CatalogService (room-availability lookup). Without this
  // export Nest resolves the tool's constructor param as unknown and the
  // whole application fails to bootstrap.
  exports: [CatalogService],
})
export class CatalogModule {}
