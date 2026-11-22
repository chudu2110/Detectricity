import { useIsFocused } from 'expo-router';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';

import { CollapsingScrollView } from '@/components/collapsing-scroll-view';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { OfflineState } from '@/components/states/offline-state';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { isLocalDemo } from '@/env';
import {
  devicesQuery,
  overviewQuery,
  seriesQuery,
  weatherQuery,
} from '@/features/dashboard/queries';
import {
  EnergyChart,
  EnergyChartAxis,
  EnergyChartBars,
} from '@/features/energy/components/energy-chart';
import { formatNumber } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';

// A failed refresh keeps the cached content visible beside its error and Retry button.
function QueryContent<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.data === undefined) {
    if (query.fetchStatus === 'paused') return <OfflineState />;
    if (query.isError)
      return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    return <LoadingState />;
  }
  return (
    <>
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {children(query.data)}
    </>
  );
}

export function LiveDashboard({ section }: { section: 'home' | 'devices' | 'energy' }) {
  const { t, i18n } = useTranslation();
  const demoName = useAuthStore((s) => s.user?.full_name ?? s.user?.email ?? '');
  const focused = useIsFocused();
  // A stable one-day window; pull-to-refresh advances it without changing keys on every render.
  const [until, setUntil] = useState(() => new Date().toISOString());
  const since = new Date(new Date(until).getTime() - 86_400_000).toISOString();
  const overview = useQuery({
    ...overviewQuery(),
    enabled: section === 'home',
    subscribed: focused,
  });
  const devices = useQuery({
    ...devicesQuery(),
    enabled: section !== 'energy',
    subscribed: focused,
  });
  const series = useQuery({
    ...seriesQuery(since, until),
    enabled: section === 'energy',
    subscribed: focused,
  });
  const weather = useQuery({
    ...weatherQuery(i18n.language.startsWith('vi') ? 'vi' : 'en'),
    enabled: section === 'home',
    subscribed: focused,
  });
  const number = (value: number) =>
    formatNumber(value, i18n.language, { maximumFractionDigits: 1 });

  function refresh() {
    if (section === 'energy') setUntil(new Date().toISOString());
    else {
      void devices.refetch();
      if (section === 'home') {
        void overview.refetch();
        void weather.refetch();
      }
    }
  }

  return (
    <CollapsingScrollView
      title={t(`tabs.${section}`)}
      contentContainerClassName="gap-4 p-4"
      refreshControl={
        <RefreshControl
          refreshing={
            overview.isRefetching ||
            devices.isRefetching ||
            series.isRefetching ||
            weather.isRefetching
          }
          onRefresh={refresh}
        />
      }
    >
      {isLocalDemo() && (
        <Text size="sm" className="text-muted-foreground">
          {t('dashboard.demoAccount', { name: demoName })}
        </Text>
      )}
      {section === 'home' && (
        <>
          <QueryContent query={overview}>
            {(data) => (
              <>
                <Card size="sm">
                  <Text>{t('home.currentDraw')}</Text>
                  <Text size="2xl" bold>
                    {data.live
                      ? t('devices.watts', { value: number(data.live.watts) })
                      : t('dashboard.noReading')}
                  </Text>
                  {data.live && (
                    <Text size="sm">{new Date(data.live.ts).toLocaleString(i18n.language)}</Text>
                  )}
                </Card>
                <Card size="sm">
                  <Text>{t('home.today')}</Text>
                  <Text size="xl" bold>
                    {data.today
                      ? t('energy.kwh', { value: number(data.today.kwh) })
                      : t('dashboard.noReading')}
                  </Text>
                </Card>
              </>
            )}
          </QueryContent>
          <Heading>{t('dashboard.weather')}</Heading>
          <QueryContent query={weather}>
            {(data) => (
              <Card size="sm">
                <Text bold>{data.province}</Text>
                <Text>
                  {number(data.now.temp)} °C · {data.now.sky.description}
                </Text>
                <Text>{t('dashboard.humidity', { value: number(data.now.humidity) })}</Text>
              </Card>
            )}
          </QueryContent>
        </>
      )}
      {section !== 'energy' && (
        <>
          <Heading>{t('tabs.devices')}</Heading>
          <Text size="sm" className="text-muted-foreground">
            {t('dashboard.deviceReadOnly')}
          </Text>
          <QueryContent query={devices}>
            {(data) =>
              data.length === 0 ? (
                <EmptyState />
              ) : (
                data.map((device) => (
                  <Card key={device.id} size="sm">
                    <Text bold>{device.name}</Text>
                    {device.room && <Text>{device.room}</Text>}
                    <Text>{t('devices.watts', { value: number(device.watts) })}</Text>
                    <Text>{t('dashboard.deviceToday', { value: number(device.today_kwh) })}</Text>
                  </Card>
                ))
              )
            }
          </QueryContent>
        </>
      )}
      {section === 'energy' && (
        <QueryContent query={series}>
          {(data) => {
            const points = data.map((point) => ({ at: point.ts, kwh: point.energy_wh / 1000 }));
            const total = points.reduce((sum, point) => sum + point.kwh, 0);
            return data.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <Text>{t('dashboard.lastDay', { value: number(total) })}</Text>
                <EnergyChart
                  points={points}
                  accessibilityLabel={t('dashboard.lastDay', { value: number(total) })}
                >
                  <EnergyChartBars />
                  <EnergyChartAxis
                    labels={points.map((point) =>
                      new Date(point.at).toLocaleTimeString(i18n.language, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    )}
                  />
                </EnergyChart>
              </>
            );
          }}
        </QueryContent>
      )}
    </CollapsingScrollView>
  );
}
