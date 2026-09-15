import { colors, font, space, theme } from '../theme';
import { resolveColorScheme } from '../hooks/useAppColorScheme';

describe('Theme', () => {
  describe('colors', () => {
    it('has all expected keys', () => {
      const expectedKeys = [
        'surface', 'paper', 'paperDeep', 'clay', 'clayLight', 'line', 'lineStrong',
        'ink', 'inkSoft', 'inkMuted', 'umber', 'umberDeep',
        'teal', 'tealDeep', 'tealTint', 'gold', 'goldDeep', 'goldTint',
        'brick', 'brickTint'
      ];
      expectedKeys.forEach(key => {
        expect(colors).toHaveProperty(key);
      });
    });

    it('has correct color values', () => {
      expect(colors.teal).toBe('#0F8A83');
      expect(colors.gold).toBe('#C8983A');
      expect(colors.brick).toBe('#DC2626');
    });
  });

  describe('font', () => {
    it('has display and mono', () => {
      expect(font).toHaveProperty('display');
      expect(font).toHaveProperty('mono');
    });

    it('has valid font families', () => {
      expect(typeof font.display).toBe('string');
      expect(typeof font.mono).toBe('string');
    });
  });

  describe('space', () => {
    it('returns correct values', () => {
      expect(space(0)).toBe(0);
      expect(space(1)).toBe(4);
      expect(space(2)).toBe(8);
      expect(space(4)).toBe(16);
      expect(space(6)).toBe(24);
    });
  });

  describe('theme', () => {
    it('has all theme properties', () => {
      expect(theme).toHaveProperty('colors');
      expect(theme).toHaveProperty('font');
      expect(theme).toHaveProperty('fontSizes');
      expect(theme).toHaveProperty('spacing');
      expect(theme).toHaveProperty('borderRadius');
    });

    it('has semantic color mappings', () => {
      expect(theme.colors.text).toBe(colors.ink);
      expect(theme.colors.background).toBe(colors.paper);
      expect(theme.colors.primary).toBe(colors.teal);
      expect(theme.colors.error).toBe(colors.brick);
    });
  });

  describe('resolveColorScheme', () => {
    it('prefers the user-selected theme over the system theme', () => {
      expect(resolveColorScheme('dark', 'light')).toBe('dark');
      expect(resolveColorScheme('light', 'dark')).toBe('light');
    });

    it('falls back to the system theme when preference is system', () => {
      expect(resolveColorScheme('system', 'dark')).toBe('dark');
      expect(resolveColorScheme('system', 'light')).toBe('light');
    });
  });
});
