import { SetMetadata } from '@nestjs/common';
import {
  FEATURE_FLAG_KEY_METADATA,
  type FeatureFlagKey,
} from './feature-flags.constants';

export const RequireFeatureFlag = (key: FeatureFlagKey) =>
  SetMetadata(FEATURE_FLAG_KEY_METADATA, key);
