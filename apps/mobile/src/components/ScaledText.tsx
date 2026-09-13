import { Platform, Text as RNText, type TextProps } from 'react-native';

const ALLOW_FONT_SCALING = Platform.OS !== 'web';

export function ScaledText(props: TextProps) {
  return <RNText {...props} allowFontScaling={ALLOW_FONT_SCALING} maxFontSizeMultiplier={1.5} />;
}

export const textProps: TextProps = {
  allowFontScaling: ALLOW_FONT_SCALING,
  maxFontSizeMultiplier: 1.5,
};
