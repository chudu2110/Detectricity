import '../global.css';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useAppStateFocus } from '@/hooks/use-app-state-focus';
import { useNavTheme } from '@/hooks/use-nav-theme';
import { useSessionGate } from '@/hooks/use-session-gate';
import { initOnlineManager } from '@/lib/online-manager';
import { queryClient } from '@/lib/query-client';
import { RouteError } from '@/screens/route-error';
import { usePreferencesStore } from '@/stores/preferences-store';
import { i18n } from '@/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Uniwind } from 'uniwind';

// Apply the stored theme before the first render so the first frame is not the wrong theme.
Uniwind.setTheme(usePreferencesStore.getState().theme);

// Make TanStack Query follow the device connectivity (pause offline, resume on reconnect).
initOnlineManager();

// Keep the splash up until the stored session is known, so the user never sees a sign-in flash.
void SplashScreen.preventAutoHideAsync();

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteError {...props} />;
}

export default function RootLayout() {
  const theme = usePreferencesStore((s) => s.theme);
  const language = usePreferencesStore((s) => s.language);
  const navTheme = useNavTheme();
  const { ready, signedIn } = useSessionGate();
  const [fontsLoaded, fontError] = useFonts({
    'BricolageGrotesque-Medium': require('../../assets/fonts/BricolageGrotesque-Medium.ttf'),
    'BricolageGrotesque-SemiBold': require('../../assets/fonts/BricolageGrotesque-SemiBold.ttf'),
  });
  const canRender = ready && (fontsLoaded || !!fontError);
  const showApp = signedIn;
  useAppStateFocus();
  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [language]);

  useEffect(() => {
    if (canRender) void SplashScreen.hideAsync();
  }, [canRender]);

  return (
    <GluestackUIProvider mode={theme}>
      <StatusBar style="auto" />
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navTheme}>
          {canRender ? (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={showApp}>
                <Stack.Screen name="(app)" />
              </Stack.Protected>
              <Stack.Protected guard={!showApp}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>
            </Stack>
          ) : null}
        </ThemeProvider>
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}
