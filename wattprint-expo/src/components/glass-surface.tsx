import { type ReactNode, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

import { toCssColor } from '@/lib/nav-theme';

function useGlassColors(names: string[]) {
  return useCSSVariable(names).map((value) =>
    typeof value === 'string' ? toCssColor(value) : undefined,
  );
}

export function AmbientBackdrop() {
  const gradientId = `ambient-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [base, matcha, skylight, shade] = useGlassColors([
    '--background',
    '--ambient-matcha',
    '--ambient-skylight',
    '--ambient-shade',
  ]);

  return (
    <View pointerEvents="none" accessible={false} className="bg-background absolute inset-0">
      <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`${gradientId}-base`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor={base} />
            <Stop offset="1" stopColor={shade} />
          </LinearGradient>
          <RadialGradient id={`${gradientId}-matcha`} cx="72%" cy="6%" rx="84%" ry="54%">
            <Stop offset="0" stopColor={matcha} />
            <Stop offset="1" stopColor={matcha} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${gradientId}-light`} cx="0%" cy="44%" rx="91%" ry="56%">
            <Stop offset="0" stopColor={skylight} stopOpacity={0.86} />
            <Stop offset="1" stopColor={skylight} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="400" height="800" fill={`url(#${gradientId}-base)`} />
        <Rect width="400" height="800" fill={`url(#${gradientId}-matcha)`} />
        <Rect width="400" height="800" fill={`url(#${gradientId}-light)`} />
      </Svg>
    </View>
  );
}

type GlassTone = 'default' | 'matcha' | 'quiet' | 'dock';
const backing = {
  default: '--glass-fill',
  matcha: '--glass-matcha',
  quiet: '--glass-quiet',
  dock: '--glass-fill',
} satisfies Record<GlassTone, string>;

export function GlassSurface({
  children,
  backdrop,
  tone = 'default',
  radius = 26,
  className,
}: {
  children: ReactNode;
  backdrop?: ReactNode;
  tone?: GlassTone;
  radius?: number;
  className?: string;
}) {
  const gradientId = `glass-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [fill, rim, edge, shadow] = useGlassColors([
    backing[tone],
    '--glass-rim',
    '--glass-edge',
    '--glass-shadow',
  ]);
  const dock = tone === 'dock';

  return (
    <View
      className={className}
      style={{
        borderRadius: radius,
        boxShadow: [
          { color: shadow, offsetX: 0, offsetY: dock ? 9 : 6, blurRadius: dock ? 24 : 16 },
          { color: shadow, offsetX: 0, offsetY: 1, blurRadius: 4 },
        ],
      }}
    >
      <View
        pointerEvents="none"
        accessible={false}
        style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
      >
        {backdrop}
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="74%" y2="100%">
              <Stop offset="0" stopColor={rim} stopOpacity={dock && backdrop ? 0.48 : 0.78} />
              <Stop offset="0.42" stopColor={fill} stopOpacity={dock && backdrop ? 0.54 : 0.94} />
              <Stop offset="1" stopColor={fill} stopOpacity={dock && backdrop ? 0.75 : 1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      </View>
      <View
        pointerEvents="none"
        accessible={false}
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 1,
            borderTopColor: rim,
            borderLeftColor: rim,
            borderRightColor: edge,
            borderBottomColor: edge,
          },
        ]}
      />
      {children}
    </View>
  );
}
