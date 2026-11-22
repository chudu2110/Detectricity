import { Image } from 'expo-image';
import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

import { useMotionPhase } from '@/hooks/use-motion-phase';
import { toCssColor } from '@/lib/nav-theme';

function Rotor({
  x,
  y,
  radius,
  scale,
  phase,
  offset,
  blade,
  light,
  ink,
}: {
  x: number;
  y: number;
  radius: number;
  scale: number;
  phase: SharedValue<number>;
  offset: number;
  blade: string;
  light: string;
  ink: string;
}) {
  const turn = useAnimatedStyle(() => ({
    transform: [{ rotate: `${phase.get() * 360 + offset}deg` }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: (x - radius) * scale,
          top: (y - radius) * scale,
          width: 2 * radius * scale,
          height: 2 * radius * scale,
        },
        turn,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 64 64">
        {[0, 120, 240].map((angle) => (
          <G key={angle} transform={`rotate(${angle} 32 32)`}>
            <Path
              d="M30 32 28.4 25 Q28 20.8 32.8 2.2 Q33.4 .7 33.8 2.4 L34.2 22.7 32.9 32Z"
              fill={blade}
            />
            <Path d="m32.6 30 .4-8.6 .4-16.2" stroke={light} strokeWidth="1.3" fill="none" />
          </G>
        ))}
        <Circle cx="32" cy="32" r="3.1" fill={ink} />
        <Circle cx="31.4" cy="31.2" r="1.9" fill={light} />
      </Svg>
    </Animated.View>
  );
}

// The light follows the same cubic Bézier as the illuminated foreground track.
const currentPath = 'M-12 145 C82 112 148 202 250 158';
function CurrentLight({
  phase,
  scale,
  offset,
  color,
}: {
  phase: SharedValue<number>;
  scale: number;
  offset: number;
  color: string;
}) {
  const travel = useAnimatedStyle(() => {
    const t = (phase.get() + offset) % 1;
    const u = 1 - t;
    const x = -12 * u * u * u + 3 * 82 * u * u * t + 3 * 148 * u * t * t + 250 * t * t * t;
    const y = 145 * u * u * u + 3 * 112 * u * u * t + 3 * 202 * u * t * t + 158 * t * t * t;
    return {
      opacity: Math.min(1, t * 12, u * 12),
      transform: [{ translateX: (x - 4) * scale }, { translateY: (y - 4) * scale }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: 8 * scale,
          height: 8 * scale,
          borderRadius: 8,
          backgroundColor: color,
        },
        travel,
      ]}
    />
  );
}

export function HouseIllustration({
  size = 'hero',
  active = true,
}: {
  size?: 'hero' | 'welcome';
  active?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const scale = width / 360;
  const phase = useMotionPhase(active, 5600);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [sky, base, mint, moss, lake, light, honey, ink] = useCSSVariable([
    '--art-sky',
    '--glass-quiet',
    '--art-mint',
    '--art-moss',
    '--art-lake',
    '--art-light',
    '--art-honey',
    '--art-ink',
  ]).map((c) => (typeof c === 'string' ? toCssColor(c) : ''));
  const cloudDrift = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.sin(phase.get() * Math.PI * 2) * 11 * scale }],
  }));
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className="w-full overflow-hidden rounded-[22px]"
      style={{ aspectRatio: 360 / 184 }}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 360 184">
        <Defs>
          <LinearGradient id={`${id}sky`} x2="0%" y2="100%">
            <Stop offset="0" stopColor={sky} stopOpacity={0.54} />
            <Stop offset="1" stopColor={base} />
          </LinearGradient>
          <RadialGradient id={`${id}sun`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={honey} stopOpacity={0.95} />
            <Stop offset="0.35" stopColor={honey} stopOpacity={0.58} />
            <Stop offset="1" stopColor={light} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`${id}grass`} x1="0%" y1="0%" x2="90%" y2="100%">
            <Stop offset="0" stopColor={mint} />
            <Stop offset="1" stopColor={moss} />
          </LinearGradient>
        </Defs>
        <Rect width="360" height="184" fill={`url(#${id}sky)`} />
        <Circle cx="183" cy="49" r="47" fill={`url(#${id}sun)`} />
        <Circle cx="183" cy="49" r="12" fill={honey} />
        <Path d="M0 101Q39 72 92 92T196 91Q274 44 360 79V184H0Z" fill={moss} opacity="0.23" />
        <Path d="M0 120Q77 76 151 108T295 100Q332 85 360 92V184H0Z" fill={mint} opacity="0.84" />
        <Path d="M0 128Q67 106 153 128Q233 148 283 119T360 112V184H0Z" fill={`url(#${id}grass)`} />
        <Path
          d="M0 152Q70 120 153 151T360 137M0 167Q65 136 143 164T360 154"
          stroke={light}
          opacity="0.28"
          fill="none"
        />
        <Path
          d="M75 67 73 122Q75 124 79 122L77 67Z M133 84 132 113Q134 115 136 113L135 84Z"
          fill={lake}
        />
        <Path d="m76 69-1 51M134 85v27" stroke={light} strokeWidth="1.4" />
        <Path d={currentPath} fill="none" stroke={light} strokeWidth="5" opacity="0.24" />
        <Path d={currentPath} fill="none" stroke={light} strokeWidth="1.3" opacity="0.9" />
      </Svg>
      {width > 0 && (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, cloudDrift]}>
            <Svg width="100%" height="100%" viewBox="0 0 360 184">
              <Path
                d="M10 33q5-8 14-7 6-11 15-6 5 3 6 7 10-3 16 6ZM151 24q4-6 10-5 5-8 12-4 4 2 5 5 6-2 11 4Z"
                fill={light}
                opacity="0.7"
              />
            </Svg>
          </Animated.View>
          <Rotor
            x={134}
            y={84}
            radius={20}
            scale={scale}
            phase={phase}
            offset={55}
            blade={lake}
            light={light}
            ink={ink}
          />
          <Rotor
            x={76}
            y={67}
            radius={36}
            scale={scale}
            phase={phase}
            offset={-12}
            blade={moss}
            light={light}
            ink={ink}
          />
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 360 184">
            <Ellipse cx="270" cy="159" rx="62" ry="6" fill={ink} opacity="0.12" />
          </Svg>
          <Image
            source={require('../../assets/illustrations/eco-home-glass.png')}
            contentFit="contain"
            accessible={false}
            style={{
              position: 'absolute',
              right: 3 * scale,
              bottom: 10 * scale,
              width: (size === 'welcome' ? 185 : 178) * scale,
              height: 175 * scale,
            }}
          />
          <CurrentLight phase={phase} scale={scale} offset={0.18} color={light} />
          <CurrentLight phase={phase} scale={scale} offset={0.7} color={honey} />
        </>
      )}
    </View>
  );
}
