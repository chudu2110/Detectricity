import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

import { DisplayText } from '@/components/display-text';
import { GlassSurface } from '@/components/glass-surface';
import { Text } from '@/components/ui/text';
import type { WeatherForecastSlot, WeatherReading } from '@/features/dashboard/schemas';
import { useMotionPhase } from '@/hooks/use-motion-phase';
import { formatNumber } from '@/lib/format';
import { toCssColor } from '@/lib/nav-theme';

// OpenWeather's language-independent icon groups: https://openweathermap.org/api/weather-conditions
const skies = {
  '01': 'clear',
  '02': 'partlyCloudy',
  '03': 'cloudy',
  '04': 'cloudy',
  '09': 'rain',
  '10': 'rain',
  '11': 'storm',
  '13': 'snow',
  '50': 'haze',
} as const;

export function weatherAppearance(icon?: string) {
  const code = icon?.match(/^(\d{2})([dn])$/);
  const group = code?.[1];
  const condition =
    group && Object.hasOwn(skies, group) ? skies[group as keyof typeof skies] : 'unknown';
  return { condition, night: condition !== 'unknown' && code?.[2] === 'n' };
}

const skyTokens = [
  '--art-sky',
  '--art-lake',
  '--art-honey',
  '--art-light',
  '--art-ink',
  '--glass-fill',
  '--glass-edge',
];
const cloudBank =
  'M-30 100C-10 81 15 84 29 90C44 70 72 69 91 80C103 59 132 52 154 65C169 46 201 47 218 66C236 52 260 56 272 73C288 64 310 64 322 77C341 72 361 82 387 76V118H-30Z';
const farBank =
  'M-24 97Q-9 77 11 83Q27 57 54 70Q75 47 100 60Q118 44 139 54Q163 28 183 43Q212 32 223 54Q253 35 275 54Q298 43 319 61Q344 54 390 79V118H-24Z';

function WeatherSky({ icon, active }: { icon?: string; active: boolean }) {
  const { condition, night } = weatherAppearance(icon);
  const rain = condition === 'rain' || condition === 'storm';
  const precip = rain || condition === 'snow';
  const luminary = condition === 'clear' || condition === 'partlyCloudy';
  const clouds = condition === 'partlyCloudy' || condition === 'cloudy' || precip;
  const phase = useMotionPhase(active && condition !== 'unknown', precip ? 1200 : 8200);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [sky, lake, gold, light, ink, fill, edge] = useCSSVariable(skyTokens).map((v) =>
    typeof v === 'string' ? toCssColor(v) : undefined,
  );
  const rotate = useAnimatedStyle(() => ({ transform: [{ rotate: `${phase.get() * 360}deg` }] }));
  const drift = useAnimatedStyle(() => ({
    transform: [{ translateX: (precip ? 2 : 15) * Math.sin(phase.get() * 2 * Math.PI) }],
  }));
  const shimmer = useAnimatedStyle(() => ({
    opacity: 0.65 + 0.35 * Math.cos(phase.get() * 2 * Math.PI),
  }));
  const fall = useAnimatedStyle(() => ({ transform: [{ translateY: 52 * (phase.get() % 1) }] }));
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox="0 0 360 148"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={`${id}sky`} x1="0%" y1="0%" x2="70%" y2="100%">
            <Stop offset="0" stopColor={night || rain ? ink : sky} />
            <Stop offset="1" stopColor={night || precip ? lake : luminary ? gold : edge} />
          </LinearGradient>
        </Defs>
        <Rect width="360" height="148" fill={`url(#${id}sky)`} />
        {night && luminary && (
          <Path
            d="m107 19 1 3 3 1-3 1-1 3-1-3-3-1 3-1z M183 28h2v2h-2z M336 79h2v2h-2z M208 90h2v2h-2z M360 13h-2v2h2z"
            fill={light}
          />
        )}
        {clouds && <Path d={farBank} fill={night || precip ? ink : light} opacity={0.55} />}
        <Path
          d="M0 117Q50 102 92 119T209 125Q252 103 291 118T360 122V148H0Z"
          fill={lake}
          opacity={0.48}
        />
        <Path d="M0 136Q79 111 147 135T264 132Q317 118 360 132V148H0Z" fill={ink} opacity={0.52} />
      </Svg>
      {luminary &&
        (night ? (
          <Animated.View style={[styles.sun, shimmer]}>
            <Svg width="100%" height="100%" viewBox="0 0 140 140">
              <Path d="M88 39a29 29 0 1 0 14 43A26 26 0 0 1 88 39Z" fill={light} />
            </Svg>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.sun, rotate]}>
            <Svg width="100%" height="100%" viewBox="0 0 140 140">
              <Defs>
                <RadialGradient id={`${id}aureole`} cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0" stopColor={light} />
                  <Stop offset="0.42" stopColor={gold} />
                  <Stop offset="1" stopColor={gold} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx="70" cy="70" r="69" fill={`url(#${id}aureole)`} />
              {Array.from({ length: 12 }, (_, i) => (
                <Path
                  key={i}
                  d="M68 41 70 5 72 41Z"
                  transform={`rotate(${i * 30} 70 70)`}
                  fill={light}
                  opacity={0.62}
                />
              ))}
              <Circle cx="70" cy="70" r="24" fill={gold} />
              <Circle cx="70" cy="70" r="19" fill={light} />
            </Svg>
          </Animated.View>
        ))}
      {(clouds || condition === 'haze') && (
        <Animated.View style={[styles.clouds, drift]}>
          <Svg width="100%" height="100%" viewBox="0 0 360 148" preserveAspectRatio="none">
            {condition === 'haze' ? (
              <Path
                d="M-5 64Q82 52 172 64T367 58M-5 84Q110 70 218 83T367 79M-5 100Q72 92 180 100T367 92"
                stroke={light}
                strokeWidth={7}
                opacity={0.42}
                fill="none"
              />
            ) : (
              <Path
                d={cloudBank}
                transform={precip ? 'translate(0 -30)' : undefined}
                fill={night || precip ? lake : light}
                opacity={night ? 0.86 : 0.9}
              />
            )}
            {condition === 'storm' && (
              <Path d="m286 59-12 21h8l-4 16 20-25h-10l7-12Z" fill={gold} />
            )}
          </Svg>
        </Animated.View>
      )}
      {precip && (
        <Animated.View style={[styles.precipitation, fall]}>
          <Svg width="100%" height="100%">
            <Defs>
              <Pattern id={`${id}fall`} patternUnits="userSpaceOnUse" width="44" height="52">
                {rain ? (
                  <Path
                    d="m12 4-5 13m28 16-4 10"
                    stroke={light}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    opacity={0.8}
                  />
                ) : (
                  <>
                    <Circle cx={12} cy={4} r={2.4} fill={light} />
                    <Circle cx={35} cy={33} r={1.7} fill={light} />
                  </>
                )}
              </Pattern>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${id}fall)`} />
          </Svg>
        </Animated.View>
      )}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={`${id}veil`} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0" stopColor={fill} stopOpacity={1} />
            <Stop offset="0.38" stopColor={fill} stopOpacity={0.98} />
            <Stop offset="0.8" stopColor={fill} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id}veil)`} />
      </Svg>
    </View>
  );
}

export function WeatherCard({
  weather,
  active,
  forecast,
  children,
}: {
  weather: WeatherReading;
  active: boolean;
  forecast?: WeatherForecastSlot;
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const sample = forecast ?? weather.now;
  const degrees = formatNumber(sample.temp, i18n.language, { maximumFractionDigits: 1 });
  const time =
    forecast &&
    new Date(forecast.dt * 1000).toLocaleString(i18n.language, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  return (
    <GlassSurface>
      <View className="overflow-hidden rounded-[26px]">
        <View className="min-h-[148px] justify-center gap-1 px-5 py-4">
          <WeatherSky icon={sample.sky.icon} active={active} />
          <Text className="text-muted-foreground text-sm font-semibold">
            {time ? t('weatherPanel.forecastAt', { time }) : t('dashboard.weather')}
          </Text>
          <DisplayText
            weight="semibold"
            className="text-foreground self-start text-[45px] leading-[55px] tracking-[-1.5px]"
          >
            {degrees} °C
          </DisplayText>
          <Text className="text-foreground self-start rounded-full bg-glass-fill/95 px-2.5 py-1 text-sm font-semibold">
            {sample.sky.description}
          </Text>
        </View>
        <View className="gap-3 px-5 py-4">
          <View className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <DisplayText
              weight="semibold"
              className="text-foreground shrink text-[19px] leading-[25px]"
            >
              {weather.province}
            </DisplayText>
            <Text className="text-muted-foreground text-sm">
              {forecast
                ? t('weatherPanel.rainChance', { value: Math.round(forecast.pop * 100) })
                : t('dashboard.humidity', { value: weather.now.humidity })}
            </Text>
          </View>
          {children}
        </View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  sun: { position: 'absolute', right: 6, top: 0, width: 140, height: 140 },
  clouds: { position: 'absolute', top: 0, bottom: 0, left: -18, right: -18 },
  precipitation: { position: 'absolute', top: -52, bottom: 0, left: 0, right: 0 },
});
