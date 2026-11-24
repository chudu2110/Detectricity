import { ApiError } from '@/lib/errors';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { withUniwind } from 'uniwind';

import { AppIcon } from '@/components/app-icon';
import { IconButton, Pill, Surface } from '@/components/app-ui';
import { DisplayText } from '@/components/display-text';
import { DeviceIllustration } from '@/components/illustrated-icon';
import { TactilePressable } from '@/components/tactile-pressable';
import { Text } from '@/components/ui/text';
import type { LiveDevice } from '@/features/dashboard/schemas';
import { useSystemReducedMotion } from '@/hooks/use-system-reduced-motion';
import { formatNumber } from '@/lib/format';

export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const AnimatedBars = withUniwind(Animated.View);

export function dashboardNumber(value: number, language: string) {
  return formatNumber(value, language, { maximumFractionDigits: 2 });
}

export function BackButton() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <IconButton
      label={t('dashboardNew.back')}
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(app)/(devices)/devices');
      }}
    >
      <AppIcon name="back" />
    </IconButton>
  );
}

export function DeviceListRow({ device }: { device: LiveDevice }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  return (
    <TactilePressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(app)/(devices)/[id]', params: { id: device.id } })}
      className="min-h-[76px] flex-row items-center gap-2 rounded-2xl py-2.5"
    >
      <DeviceIllustration type={device.type} />
      <View className="flex-1 flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <View className="min-w-[44%] flex-1 gap-1">
          <Text className="text-foreground text-[16px] leading-[22px] font-semibold tracking-[-0.25px]">
            {device.name}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <View
              className={
                device.on
                  ? 'bg-primary-strong h-1.5 w-1.5 rounded-full'
                  : 'border-muted-foreground h-1.5 w-1.5 rounded-full border'
              }
            />
            <Text className="text-muted-foreground flex-shrink text-[13px] leading-[18px]">
              {[t(device.on ? 'dashboardNew.status.on' : 'dashboardNew.status.off'), device.room]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
        <DisplayText
          weight="semibold"
          className="text-brand-ink shrink text-[18px] leading-6 tabular-nums"
        >
          {t('energy.kwh', { value: dashboardNumber(device.today_kwh, i18n.language) })}
        </DisplayText>
      </View>
      <AppIcon name="chevron" className="text-muted-foreground" size={14} />
    </TactilePressable>
  );
}

export function MetricPair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="min-w-28 flex-1 gap-1">
      <Text className="text-muted-foreground text-[13px] leading-[19px] font-medium">{label}</Text>
      <DisplayText
        weight="semibold"
        className="text-foreground text-[22px] leading-[28px] tracking-[-0.6px] tabular-nums"
      >
        {children}
      </DisplayText>
    </View>
  );
}

function MeterBar({
  value,
  max,
  phase,
  progress,
  selected,
}: {
  value: number;
  max: number;
  phase: number;
  progress: SharedValue<number>;
  selected: boolean;
}) {
  const rise = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (progress.get() - phase * 0.42) / 0.58));
    return { transform: [{ scaleY: 1 - (1 - t) ** 3 }] };
  });
  return (
    <AnimatedBars
      className={selected ? 'bg-brand-ink rounded-t-sm' : 'bg-primary-strong rounded-t-sm'}
      style={[
        { height: max > 0 && value > 0 ? `${(value / max) * 100}%` : 1, transformOrigin: 'bottom' },
        rise,
      ]}
    />
  );
}

export function EnergyBars({
  buckets,
  labels,
  summary,
  intervalLabel,
}: {
  buckets: readonly (number | undefined)[];
  labels: readonly string[];
  summary: string;
  intervalLabel?: (index: number) => string;
}) {
  const { t, i18n } = useTranslation();
  const [picked, setPicked] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const reduced = useSystemReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(
      reduced
        ? 1
        : withTiming(1, { duration: 920, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
    );
  }, [progress, reduced]);
  const max = Math.max(0, ...buckets.map((value) => value ?? 0));
  const last = buckets.length - 1;
  const selected = Math.min(
    picked ??
      Math.max(
        0,
        buckets.findLastIndex((v) => v !== undefined),
      ),
    last,
  );
  const interactive = !!intervalLabel && selected >= 0;
  const value = buckets[selected];
  const reading =
    value === undefined
      ? t('energyNew.missingReading')
      : t('energy.kwh', { value: dashboardNumber(value, i18n.language) });
  const interval = interactive ? intervalLabel(selected) : '';
  return (
    <View className="gap-3">
      {interactive && (
        <View className="flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <Text className="text-brand-ink text-sm font-semibold">{interval}</Text>
          <DisplayText
            weight="semibold"
            className="text-foreground text-[18px] leading-6 tabular-nums"
          >
            {reading}
          </DisplayText>
        </View>
      )}
      <View className="h-28">
        <View className="absolute inset-0 justify-between">
          <View className="bg-border h-px" />
          <View className="bg-border h-px" />
          <View className="bg-border h-px" />
        </View>
        <View
          accessible={!interactive}
          accessibilityLabel={summary}
          className="h-full flex-row items-end"
        >
          {buckets.map((value, index) => (
            <View
              key={index}
              className={
                interactive && selected === index
                  ? 'bg-brand-ink/15 mx-px h-full flex-1 justify-end rounded-t-sm'
                  : 'mx-px h-full flex-1 justify-end'
              }
            >
              {value !== undefined && (
                <MeterBar
                  value={value}
                  max={max}
                  phase={index / Math.max(1, last)}
                  progress={progress}
                  selected={interactive && selected === index}
                />
              )}
            </View>
          ))}
        </View>
        {interactive && (
          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel={summary}
            accessibilityValue={{
              min: 1,
              max: buckets.length,
              now: selected + 1,
              text: `${interval}, ${reading}`,
            }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (nativeEvent.actionName === 'increment') setPicked(Math.min(last, selected + 1));
              if (nativeEvent.actionName === 'decrement') setPicked(Math.max(0, selected - 1));
            }}
            onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
            onPress={({ nativeEvent }) => {
              if (width > 0)
                setPicked(
                  Math.max(
                    0,
                    Math.min(last, Math.floor((nativeEvent.locationX / width) * buckets.length)),
                  ),
                );
            }}
            className="absolute inset-0"
          />
        )}
      </View>
      <View className="flex-row justify-between gap-2">
        {labels.map((label, index) => (
          <Text key={index} className="text-muted-foreground shrink text-xs">
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function DeviceList({ devices }: { devices: readonly LiveDevice[] }) {
  return (
    <Surface size="sm">
      <View className="gap-1">
        {devices.map((device, index) => (
          <View key={device.id}>
            {index > 0 && <View className="bg-border ml-16 h-px" />}
            <DeviceListRow device={device} />
          </View>
        ))}
      </View>
    </Surface>
  );
}

export function EstimatedPill() {
  const { t } = useTranslation();
  return <Pill tone="green">{t('dashboardNew.estimated')}</Pill>;
}

export function errorCode(error: unknown): string | undefined {
  const body = error instanceof ApiError ? (error.body as { code?: unknown } | null) : null;
  return typeof body?.code === 'string' ? body.code : undefined;
}

/** "1.234,5" or "1234.5" or "750.000" as a number; NaN when it is not one. */
export function parseAmount(text: string): number {
  const clean = text.replace(/\s/g, '');
  if (!/^\d+([.,]\d+)*$/.test(clean)) return Number.NaN;
  const groups = clean.split(/[.,]/);
  if (groups.length === 1) return Number(clean);
  const thousands = groups.length > 1 && groups.slice(1).every((group) => group.length === 3);
  return Number(thousands ? groups.join('') : `${groups.slice(0, -1).join('')}.${groups.at(-1)}`);
}
