import { useAppSelector } from '../store/hooks';
import { request } from '../api';

describe('Auth', () => {
  it('useAppSelector exists and is a function', () => {
    expect(useAppSelector).toBeDefined();
    expect(typeof useAppSelector).toBe('function');
  });

  it('request exists and is a function', () => {
    expect(request).toBeDefined();
    expect(typeof request).toBe('function');
  });
});
