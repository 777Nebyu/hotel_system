import { FeatureFlagService } from './feature-flag.service';
import { DEFAULT_FEATURE_FLAGS } from './feature-flags.constants';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let db: any;
  let cache: any;
  let audit: any;

  beforeEach(() => {
    db = {
      platformSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    audit = {
      record: jest.fn().mockResolvedValue({}),
    };
    service = new FeatureFlagService(db, cache, audit);
  });

  it('returns default value when setting is not in cache or db', async () => {
    db.platformSetting.findUnique.mockResolvedValue(null);

    const isEnabled = await service.isEnabled('ENABLE_WALK_IN_BOOKINGS');

    expect(isEnabled).toBe(DEFAULT_FEATURE_FLAGS.ENABLE_WALK_IN_BOOKINGS);
    expect(cache.set).toHaveBeenCalledWith('feature_flag:ENABLE_WALK_IN_BOOKINGS', true, 60);
  });

  it('returns cached value if present', async () => {
    cache.get.mockResolvedValue(false);

    const isEnabled = await service.isEnabled('ENABLE_WALK_IN_BOOKINGS');

    expect(isEnabled).toBe(false);
    expect(db.platformSetting.findUnique).not.toHaveBeenCalled();
  });

  it('returns db value when cache misses and caches it', async () => {
    db.platformSetting.findUnique.mockResolvedValue({ value: false });

    const isEnabled = await service.isEnabled('ENABLE_WALK_IN_BOOKINGS');

    expect(isEnabled).toBe(false);
    expect(cache.set).toHaveBeenCalledWith('feature_flag:ENABLE_WALK_IN_BOOKINGS', false, 60);
  });

  it('updates platformSetting, cache, and records audit on setFlag', async () => {
    const result = await service.setFlag(
      'ENABLE_WALK_IN_BOOKINGS',
      false,
      'admin-1',
      'Temporarily disabled for maintenance',
    );

    expect(result).toBe(false);
    expect(db.platformSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'ff_ENABLE_WALK_IN_BOOKINGS' },
      create: { key: 'ff_ENABLE_WALK_IN_BOOKINGS', value: false },
      update: { value: false },
    });
    expect(cache.set).toHaveBeenCalledWith('feature_flag:ENABLE_WALK_IN_BOOKINGS', false, 60);
    expect(audit.record).toHaveBeenCalledWith(
      'admin-1',
      'FEATURE_FLAG_UPDATED',
      'FeatureFlag',
      'ENABLE_WALK_IN_BOOKINGS',
      { enabled: false, reason: 'Temporarily disabled for maintenance' },
    );
  });
});
