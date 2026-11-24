import { Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BlurTargetView } from 'expo-blur';
import { type ComponentRef, createRef, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Easing,
  Keyboard,
  Platform,
  View as NativeView,
  type View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppTabBar } from '@/components/app-tab-bar';
import { DockInsetContext } from '@/hooks/use-dock-inset';
import { useSystemReducedMotion } from '@/hooks/use-system-reduced-motion';
import { homeQuery } from '@/features/dashboard/queries';
import { ApiError } from '@/lib/errors';
import { ErrorState } from '@/components/states/error-state';
import { HomeOnboarding } from '@/screens/onboarding/home-onboarding';

const tabGlide = {
  animation: 'timing' as const,
  config: { duration: 300, easing: Easing.out(Easing.cubic) },
};

export default function AppLayout() {
  const home = useQuery({ ...homeQuery(), retry: false });
  const [targets] = useState(() => ({
    '(home)': createRef<ComponentRef<typeof View>>(),
    '(devices)': createRef<ComponentRef<typeof View>>(),
    '(energy)': createRef<ComponentRef<typeof View>>(),
    '(assistant)': createRef<ComponentRef<typeof View>>(),
    '(settings)': createRef<ComponentRef<typeof View>>(),
  }));
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  const [dockHeight, setDockHeight] = useState(70);
  const reducedMotion = useSystemReducedMotion();
  const insets = useSafeAreaInsets();
  const dockBottom = Math.max(insets.bottom, 10) + 7;

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (home.isError && home.error instanceof ApiError && home.error.status === 404) {
    return <HomeOnboarding />;
  }
  if (home.isError) {
    return (
      <NativeView className="bg-background flex-1 items-center justify-center px-5">
        <ErrorState error={home.error} onRetry={() => void home.refetch()} />
      </NativeView>
    );
  }
  if (home.data === undefined) {
    return (
      <NativeView className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator colorClassName="accent-primary-strong" />
      </NativeView>
    );
  }

  return (
    <DockInsetContext value={keyboardVisible ? 0 : dockHeight + dockBottom}>
      <Tabs
        tabBar={(props) =>
          keyboardVisible ? null : (
            <AppTabBar
              {...props}
              bottom={dockBottom}
              target={targets[props.state.routes[props.state.index].name as keyof typeof targets]}
              onHeight={setDockHeight}
              reducedMotion={reducedMotion}
            />
          )
        }
        screenLayout={({ children, route }) => (
          <BlurTargetView ref={targets[route.name as keyof typeof targets]} style={{ flex: 1 }}>
            {children}
          </BlurTargetView>
        )}
        screenOptions={{
          headerShown: false,
          tabBarStyle: { position: 'absolute' },
          animation: reducedMotion ? 'none' : 'shift',
          transitionSpec: reducedMotion ? undefined : tabGlide,
        }}
      >
        <Tabs.Screen name="(home)" />
        <Tabs.Screen name="(devices)" />
        <Tabs.Screen name="(energy)" />
        <Tabs.Screen name="(assistant)" />
        <Tabs.Screen name="(settings)" />
      </Tabs>
    </DockInsetContext>
  );
}
