import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { type ComponentRef, type RefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { AppIconName } from '@/components/app-icon';
import { GlassSurface } from '@/components/glass-surface';
import { IllustratedIcon } from '@/components/illustrated-icon';
import { DisplayText } from '@/components/display-text';
import { TactilePressable } from '@/components/tactile-pressable';
import { useNavTheme } from '@/hooks/use-nav-theme';

const destinations: Record<string, { icon: AppIconName; key: string }> = {
  '(home)': { icon: 'home', key: 'home' },
  '(devices)': { icon: 'devices', key: 'devices' },
  '(energy)': { icon: 'chart', key: 'energy' },
  '(assistant)': { icon: 'chat', key: 'assistant' },
  '(settings)': { icon: 'user', key: 'settings' },
};

function DockGlyph({
  name,
  selected,
  reducedMotion,
}: {
  name: AppIconName;
  selected: boolean;
  reducedMotion: boolean;
}) {
  const lift = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    const target = selected ? 1 : 0;
    lift.set(
      reducedMotion
        ? target
        : withSpring(target, {
            damping: 13,
            stiffness: 215,
            mass: 0.8,
            reduceMotion: ReduceMotion.Never,
          }),
    );
  }, [lift, reducedMotion, selected]);
  const style = useAnimatedStyle(() => {
    const progress = lift.get();
    return {
      transform: [
        { translateY: -3 * progress },
        { scale: 1 + progress * 0.12 },
        { rotate: `${reducedMotion ? 0 : -7 * Math.sin(progress * Math.PI)}deg` },
      ],
    };
  });
  return (
    <View className="h-8 items-center justify-center">
      <Animated.View style={style}>
        <IllustratedIcon name={name} size={34} />
      </Animated.View>
    </View>
  );
}

export function AppTabBar({
  state,
  emitter,
  navigateToTab,
  descriptors,
  insets,
  target,
  bottom,
  onHeight,
  reducedMotion,
}: BottomTabBarProps & {
  target?: RefObject<ComponentRef<typeof View> | null>;
  bottom: number;
  onHeight: (height: number) => void;
  reducedMotion: boolean;
}) {
  const { t } = useTranslation();
  const { dark } = useNavTheme();
  const [transparent, setTransparent] = useState(
    () => Platform.OS === 'android' && Number(Platform.Version) >= 31,
  );
  const [trackWidth, setTrackWidth] = useState(0);
  const position = useSharedValue(state.index);
  const itemWidth = trackWidth / state.routes.length;

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let active = true;
    const listener = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (reduce) =>
      setTransparent(!reduce),
    );
    void AccessibilityInfo.isReduceTransparencyEnabled().then((reduce) => {
      if (active) setTransparent(!reduce);
    });
    return () => {
      active = false;
      listener.remove();
    };
  }, []);

  useEffect(() => {
    position.set(
      reducedMotion
        ? state.index
        : withSpring(state.index, {
            damping: 22,
            stiffness: 238,
            reduceMotion: ReduceMotion.Never,
          }),
    );
  }, [position, reducedMotion, state.index]);

  const selection = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * itemWidth + 2 }],
    width: Math.max(itemWidth - 4, 0),
  }));

  return (
    <View
      onLayout={({ nativeEvent }) => onHeight(nativeEvent.layout.height)}
      className="absolute"
      style={{ bottom, left: insets.left + 14, right: insets.right + 14 }}
    >
      <GlassSurface
        tone="dock"
        radius={30}
        className="p-[5px]"
        backdrop={
          transparent && target ? (
            <BlurView
              key={state.routes[state.index].key}
              blurTarget={target}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={68}
              tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
              style={[StyleSheet.absoluteFill, { borderRadius: 30 }]}
            />
          ) : undefined
        }
      >
        <View
          accessibilityRole="tablist"
          className="flex-row"
          onLayout={({ nativeEvent }) => setTrackWidth(nativeEvent.layout.width)}
        >
          {trackWidth > 0 && (
            <Animated.View pointerEvents="none" style={[styles.selection, selection]}>
              <View className="bg-glass-matcha/80 border-glass-rim flex-1 rounded-[23px] border" />
            </Animated.View>
          )}
          {state.routes.map((route, index) => {
            const item = destinations[route.name];
            if (!item) return null;
            const selected = index === state.index;
            return (
              <TactilePressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityLabel={
                  descriptors[route.key].options.tabBarAccessibilityLabel ?? t(`tabs.${item.key}`)
                }
                accessibilityState={{ selected }}
                onPress={() => {
                  const event = emitter.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!selected && !event.defaultPrevented) navigateToTab(route.key);
                }}
                className="min-h-[60px] flex-1 items-center justify-center gap-0.5 py-1"
              >
                <DockGlyph name={item.icon} selected={selected} reducedMotion={reducedMotion} />
                <DisplayText
                  weight={selected ? 'semibold' : 'medium'}
                  className={
                    selected
                      ? 'text-brand-ink text-center text-[12px] leading-4'
                      : 'text-muted-foreground text-center text-[12px] leading-4'
                  }
                >
                  {t(`tabs.${item.key}`)}
                </DisplayText>
              </TactilePressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  selection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
});
