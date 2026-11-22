import { tva } from '@gluestack-ui/utils/nativewind-utils';
import type { UseQueryResult } from '@tanstack/react-query';
import { type ComponentProps, type ReactNode, useId, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { DisplayText } from '@/components/display-text';
import { AmbientBackdrop, GlassSurface } from '@/components/glass-surface';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { OfflineState } from '@/components/states/offline-state';
import { TactilePressable } from '@/components/tactile-pressable';
import { Text } from '@/components/ui/text';
import { useDockInset } from '@/hooks/use-dock-inset';
import { toCssColor } from '@/lib/nav-theme';

const titleEntrance = FadeInDown.withInitialValues({ opacity: 0, translateY: 8 })
  .duration(260)
  .reduceMotion(ReduceMotion.System);

export function PageHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 pb-1 pt-5">
      <Animated.View entering={titleEntrance} className="flex-1 gap-1">
        {eyebrow && (
          <Text className="text-brand-ink text-[12px] leading-[18px] font-semibold tracking-[1px]">
            {eyebrow}
          </Text>
        )}
        <DisplayText
          weight="semibold"
          accessibilityRole="header"
          className="text-foreground text-[36px] leading-[44px] tracking-[-1.35px]"
        >
          {title}
        </DisplayText>
      </Animated.View>
      {action}
    </View>
  );
}

type PageProps = ComponentProps<typeof ScrollView> & {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
};
export function Page({
  title,
  eyebrow,
  action,
  children,
  contentContainerStyle,
  ...props
}: PageProps) {
  const insets = useSafeAreaInsets();
  const dockInset = useDockInset();
  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <AmbientBackdrop />
      <ScrollView
        {...props}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-5 px-5"
        contentContainerStyle={[
          contentContainerStyle,
          { paddingBottom: Math.max(insets.bottom, dockInset) + 16 },
        ]}
      >
        <PageHeader title={title} eyebrow={eyebrow} action={action} />
        {children}
      </ScrollView>
    </View>
  );
}

const surfaceStyle = tva({
  base: 'gap-4',
  variants: {
    size: { sm: 'p-4', md: 'p-5', lg: 'p-6' },
  },
  defaultVariants: { size: 'md' },
});
export function Surface({
  children,
  variant = 'default',
  size = 'md',
  className,
}: {
  children: ReactNode;
  variant?: 'default' | 'matcha' | 'quiet';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <GlassSurface tone={variant} className={surfaceStyle({ size, class: className })}>
      {children}
    </GlassSurface>
  );
}

const actionStyle = tva({
  base: 'min-h-12 min-w-12 flex-row items-center justify-center gap-2.5 overflow-hidden rounded-full border px-5 py-2.5',
  variants: {
    variant: {
      solid: 'border-brand-ink/60 bg-primary-strong',
      tonal: 'border-glass-rim bg-glass-matcha',
      outline: 'border-input/75 bg-glass-fill',
      ghost: 'border-transparent bg-transparent px-3',
    },
  },
  defaultVariants: { variant: 'solid' },
});
const actionTextStyle = tva({
  base: 'shrink text-center text-[16px] leading-[23px] tracking-[-0.3px]',
  variants: {
    variant: {
      solid: 'text-primary-foreground',
      tonal: 'text-brand-ink',
      outline: 'text-foreground',
      ghost: 'text-primary-strong',
    },
  },
});

function ControlSheen({ strong = false }: { strong?: boolean }) {
  const id = `control-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const tint = useCSSVariable(strong ? '--art-light' : '--glass-rim');
  const color = typeof tint === 'string' ? toCssColor(tint) : undefined;
  return (
    <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="10%" y1="0%" x2="76%" y2="100%">
            <Stop offset="0" stopColor={color} stopOpacity={strong ? 0.18 : 0.82} />
            <Stop offset="0.5" stopColor={color} stopOpacity={strong ? 0.035 : 0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function ActionButton({
  children,
  variant = 'solid',
  disabled,
  busy = false,
  trailingIcon,
  accessibilityState,
  className,
  ...props
}: ComponentProps<typeof TactilePressable> & {
  children: ReactNode;
  variant?: 'solid' | 'tonal' | 'outline' | 'ghost';
  trailingIcon?: AppIconName;
  busy?: boolean;
}) {
  return (
    <TactilePressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: !!disabled || busy, busy }}
      disabled={!!disabled || busy}
      className={actionStyle({ variant, class: [trailingIcon && 'pl-5 pr-2', className] })}
    >
      {variant !== 'ghost' && <ControlSheen strong={variant === 'solid'} />}
      {typeof children === 'string' ? (
        <DisplayText
          weight="semibold"
          className={actionTextStyle({ variant, class: trailingIcon && 'flex-1 text-left' })}
        >
          {children}
        </DisplayText>
      ) : (
        children
      )}
      {busy ? (
        <ActivityIndicator
          accessible={false}
          colorClassName={
            variant === 'solid' ? 'accent-primary-foreground' : 'accent-primary-strong'
          }
        />
      ) : trailingIcon ? (
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          className={`h-8 w-8 items-center justify-center rounded-full ${variant === 'solid' ? 'bg-primary-foreground/15' : 'bg-glass-fill'}`}
        >
          <AppIcon
            name={trailingIcon}
            size={17}
            className={variant === 'solid' ? 'text-primary-foreground' : 'text-brand-ink'}
          />
        </View>
      ) : null}
    </TactilePressable>
  );
}

export function IconButton({
  label,
  children,
  onPress,
  disabled,
  variant = 'glass',
}: {
  label: string;
  children: ReactNode;
  onPress?: ComponentProps<typeof TactilePressable>['onPress'];
  disabled?: boolean;
  variant?: 'glass' | 'solid';
}) {
  return (
    <TactilePressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-12 min-w-12 items-center justify-center overflow-hidden rounded-full border ${variant === 'solid' ? 'border-brand-ink/60 bg-primary-strong' : 'border-glass-rim bg-glass-quiet'}`}
    >
      <ControlSheen strong={variant === 'solid'} />
      {children}
    </TactilePressable>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <DisplayText
        weight="semibold"
        accessibilityRole="header"
        className="text-foreground flex-1 text-[22px] leading-[29px] tracking-[-0.6px]"
      >
        {children}
      </DisplayText>
      {action}
    </View>
  );
}

const pillStyle = tva({
  base: 'self-start rounded-full px-3 py-1',
  variants: {
    tone: { neutral: 'bg-secondary', green: 'bg-brand-soft', warning: 'bg-warning-soft' },
  },
  defaultVariants: { tone: 'neutral' },
});
const pillTextStyle = tva({
  base: 'text-xs font-medium',
  variants: {
    tone: {
      neutral: 'text-muted-foreground',
      green: 'text-brand-ink',
      warning: 'text-warning-ink',
    },
  },
});
export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'warning';
}) {
  return (
    <View className={pillStyle({ tone })}>
      <Text className={pillTextStyle({ tone })}>{children}</Text>
    </View>
  );
}

export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-10 w-10 rounded-2xl',
    md: 'h-14 w-14 rounded-2xl',
    lg: 'h-20 w-20 rounded-3xl',
  };
  return (
    <View className={`bg-brand-soft items-center justify-center ${sizes[size]}`}>
      <AppIcon
        name="leaf"
        size={size === 'lg' ? 42 : size === 'md' ? 30 : 24}
        className="text-brand-ink"
      />
    </View>
  );
}

export function QueryContent<T>({
  query,
  children,
  empty,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  empty?: (data: T) => boolean;
}) {
  if (query.data === undefined) {
    if (query.fetchStatus === 'paused') return <OfflineState className="flex-none" />;
    if (query.isError)
      return (
        <ErrorState
          className="flex-none"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      );
    return <LoadingState className="flex-none" />;
  }
  return (
    <>
      {query.isError && (
        <ErrorState
          className="flex-none"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      )}
      {empty?.(query.data) ? <EmptyState className="flex-none" /> : children(query.data)}
    </>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const selected = options.findIndex((option) => option.value === value);
  const itemWidth = options.length ? trackWidth / options.length : 0;
  const selectionStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withSpring(Math.max(selected, 0) * itemWidth, {
          damping: 23,
          stiffness: 310,
          overshootClamping: true,
          reduceMotion: ReduceMotion.System,
        }),
      },
    ],
  }));
  return (
    <View
      accessibilityRole="tablist"
      className="border-glass-edge bg-glass-quiet rounded-[28px] border p-1"
    >
      <View
        className="flex-row"
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        {itemWidth > 0 && selected >= 0 && (
          <Animated.View
            pointerEvents="none"
            accessible={false}
            style={[
              { position: 'absolute', top: 0, bottom: 0, left: 0, width: itemWidth },
              selectionStyle,
            ]}
          >
            <View className="border-glass-rim bg-glass-fill flex-1 overflow-hidden rounded-[23px] border">
              <ControlSheen />
            </View>
          </Animated.View>
        )}
        {options.map((option) => (
          <TactilePressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: value === option.value }}
            onPress={() => onChange(option.value)}
            className={`min-h-12 flex-1 items-center justify-center rounded-[23px] px-2 py-2 ${!itemWidth && value === option.value ? 'bg-glass-fill' : ''}`}
          >
            <DisplayText
              weight={value === option.value ? 'semibold' : 'medium'}
              className={
                value === option.value
                  ? 'text-brand-ink text-center text-[15px] leading-5'
                  : 'text-muted-foreground text-center text-[15px] leading-5'
              }
            >
              {option.label}
            </DisplayText>
          </TactilePressable>
        ))}
      </View>
    </View>
  );
}
