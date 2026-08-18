import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CloudinaryStorageService,
  LocalStorageService,
  STORAGE_SERVICE,
  type StorageService,
} from './storage';

@Global()
@Module({
  providers: [
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
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
