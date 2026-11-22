import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { withUniwind } from 'uniwind';

const AnimatedPressable = withUniwind(Animated.createAnimatedComponent(Pressable));
const pressSpring = {
  damping: 22,
  stiffness: 440,
  mass: 0.58,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
};

type TactilePressableProps = Omit<PressableProps, 'children' | 'style'> & {
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function TactilePressable({
  children,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...props
}: TactilePressableProps) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const pressStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.54 : 1 - progress.get() * 0.14,
    transform: [{ scale: reduceMotion ? 1 : 1 - progress.get() * 0.026 }],
  }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        progress.set(withSpring(1, pressSpring));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        progress.set(withSpring(0, pressSpring));
        onPressOut?.(event);
      }}
      style={[style, pressStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
