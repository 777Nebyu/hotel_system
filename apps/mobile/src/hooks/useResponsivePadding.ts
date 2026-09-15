import { useWindowDimensions } from 'react-native';

const PHONE_PADDING = 20;
const TABLET_PADDING = 32;
const BREAKPOINT = 600;

export function useResponsivePadding(): number {
  const { width } = useWindowDimensions();
  return width > BREAKPOINT ? TABLET_PADDING : PHONE_PADDING;
}
