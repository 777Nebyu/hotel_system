import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  FadeInRight,
  FadeIn as ReanimatedFadeIn,
} from 'react-native-reanimated';

type FadeDirection = 'down' | 'up' | 'left' | 'right' | 'none';

interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: FadeDirection;
  style?: StyleProp<ViewStyle>;
}

const DIRECTION_MAP = {
  down: FadeInDown,
  up: FadeInUp,
  left: FadeInLeft,
  right: FadeInRight,
  none: ReanimatedFadeIn,
};

export function FadeInView({
  children,
  delay = 0,
  duration = 350,
  direction = 'down',
  style,
}: FadeInViewProps) {
  const entering = DIRECTION_MAP[direction].duration(duration).delay(delay);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

export function FadeInCard({
  children,
  index = 0,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <FadeInView delay={index * 60} duration={300} direction="down" style={style}>
      {children}
    </FadeInView>
  );
}
