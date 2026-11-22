import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { useMotionPhase } from '@/hooks/use-motion-phase';
import { toCssColor } from '@/lib/nav-theme';

export function AssistantOrb({ active }: { active: boolean }) {
  const phase = useMotionPhase(active, 6200);
  const ribbonStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${360 * phase.get()}deg` }],
  }));
  const glintStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.17 * Math.sin(phase.get() * Math.PI * 2) }],
  }));
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [light, clay, plum, sky, lake, mint] = useCSSVariable([
    '--art-light',
    '--art-clay',
    '--art-plum',
    '--art-sky',
    '--art-lake',
    '--art-mint',
  ]).map((color) => (typeof color === 'string' ? toCssColor(color) : undefined));
  return (
    <View
      style={{ width: 96, height: 96 }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`${id}-pearl`} cx="37%" cy="25%" rx="72%" ry="75%">
            <Stop offset="0" stopColor={light} />
            <Stop offset="0.35" stopColor={sky} />
            <Stop offset="0.63" stopColor={clay} />
            <Stop offset="1" stopColor={plum} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={46} fill={clay} opacity={0.25} />
        <Circle
          cx={50}
          cy={50}
          r={42}
          fill={`url(#${id}-pearl)`}
          stroke={light}
          strokeWidth={1.5}
        />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, ribbonStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id={`${id}-silk`} x1="2%" y1="17%" x2="95%" y2="88%">
              <Stop offset="0" stopColor={light} />
              <Stop offset="0.28" stopColor={mint} />
              <Stop offset="0.6" stopColor={lake} />
              <Stop offset="1" stopColor={plum} />
            </LinearGradient>
          </Defs>
          <Path
            d="M11 60C1 37 24 12 43 10C22 19 33 44 54 51C76 60 89 49 89 33C99 60 76 83 59 89C77 72 61 63 41 58C24 54 15 49 14 39C10 46 10 52 11 60Z"
            fill={`url(#${id}-silk)`}
            stroke={light}
            strokeWidth={0.85}
            strokeOpacity={0.85}
          />
          <Path
            d="M20 75C31 83 37 77 46 69M63 26C72 14 78 24 81 28"
            stroke={light}
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.85}
            fill="none"
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, glintStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Path d="M51 35Q53 47 64 50Q54 52 51 64Q49 53 38 50Q48 48 51 35Z" fill={light} />
          <Path d="M66 30Q67 35 72 36Q67 37 66 42Q65 37 60 36Q65 35 66 30Z" fill={light} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function WaveBar({ phase, index }: { phase: SharedValue<number>; index: number }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: 0.66 + 0.34 * Math.sin(2 * Math.PI * phase.get() - index * 0.95) }],
  }));
  return (
    <Animated.View style={style}>
      <View className="bg-primary-strong h-5 w-1 rounded-full" />
    </Animated.View>
  );
}

export function AssistantActivity({ active }: { active: boolean }) {
  const phase = useMotionPhase(active, 1250);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="h-6 flex-row items-center gap-[3px]"
    >
      {[0, 1, 2, 3, 4].map((index) => (
        <WaveBar key={index} phase={phase} index={index} />
      ))}
    </View>
  );
}
