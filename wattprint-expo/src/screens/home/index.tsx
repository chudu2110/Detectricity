import { useQuery } from '@tanstack/react-query';
import { useIsFocused, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { HouseIllustration } from '@/components/house-illustration';
import { DisplayText } from '@/components/display-text';
import { IllustratedIcon } from '@/components/illustrated-icon';
import { AppIcon } from '@/components/app-icon';
import {
  ActionButton,
  IconButton,
  Page,
  Pill,
  QueryContent,
  SectionTitle,
  Surface,
} from '@/components/app-ui';
import { Text } from '@/components/ui/text';
import { isLocalDemo } from '@/env';
import { useSystemReducedMotion } from '@/hooks/use-system-reduced-motion';
import {
  billQuery,
  devicesQuery,
  homeQuery,
  overviewQuery,
  weatherQuery,
} from '@/features/dashboard/queries';
import { formatCurrency } from '@/lib/format';
import {
  dashboardNumber,
  DeviceList,
  MetricPair,
  VIETNAM_TIME_ZONE,
} from '@/screens/dashboard-parts';

export function Home() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const subscribed = useIsFocused();
  const home = useQuery({ ...homeQuery(), subscribed });
  const overview = useQuery({ ...overviewQuery(), subscribed });
  const bill = useQuery({ ...billQuery(), subscribed });
  const devices = useQuery({ ...devicesQuery(), subscribed });
  const weather = useQuery({
    ...weatherQuery(i18n.language.startsWith('vi') ? 'vi' : 'en'),
    subscribed,
  });
  const [paused, setPaused] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const heroBottom = useRef(Infinity);
  const reduced = useSystemReducedMotion();
  const queries = [overview, devices, weather, bill, home];
  const kwh = (value: number) => t('energy.kwh', { value: dashboardNumber(value, i18n.language) });
  const watts = (value: number) =>
    t('devices.watts', { value: dashboardNumber(value, i18n.language) });

  return (
    <Page
      title={home.data?.name ?? t('tabs.home')}
      eyebrow={isLocalDemo() ? t('material.demoHousehold') : 'Detectricity'}
      scrollEventThrottle={160}
      onScroll={({ nativeEvent }) =>
        setHeroVisible(nativeEvent.contentOffset.y < heroBottom.current)
      }
      action={
        <IconButton
          label={t('dashboardNew.alerts')}
          onPress={() => router.push('/(app)/(settings)/alerts')}
        >
          <AppIcon name="bell" />
        </IconButton>
      }
      refreshControl={
        <RefreshControl
          refreshing={queries.some((query) => query.isRefetching)}
          onRefresh={() => queries.forEach((query) => void query.refetch())}
        />
      }
    >
      <QueryContent query={overview}>
        {({ today, live }) => (
          <View
            onLayout={({ nativeEvent: { layout } }) => {
              heroBottom.current = layout.y + layout.height;
            }}
          >
            <Surface variant="matcha" size="md">
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <View className="min-w-[60%] flex-1 gap-1">
                  <Text className="text-brand-ink text-[15px] leading-5 font-semibold">
                    {t('material.todayEnergy')}
                  </Text>
                  {today ? (
                    <DisplayText
                      accessibilityLabel={kwh(today.kwh)}
                      weight="semibold"
                      className="text-foreground text-[48px] leading-[56px] tracking-[-2px] tabular-nums"
                    >
                      {dashboardNumber(today.kwh, i18n.language)}
                      <Text className="text-brand-ink text-[17px] font-medium tracking-normal">
                        {' '}
                        kWh
                      </Text>
                    </DisplayText>
                  ) : (
                    <Text className="text-foreground text-lg">{t('dashboard.noReading')}</Text>
                  )}
                </View>
                {today && <Pill tone="green">{t('material.recorded')}</Pill>}
              </View>
              <View className="-mx-2">
                <HouseIllustration active={subscribed && heroVisible && !paused} />
                {!reduced && (
                  <View className="absolute bottom-1 right-1">
                    <IconButton
                      label={t(paused ? 'material.resumeScene' : 'material.pauseScene')}
                      onPress={() => setPaused(!paused)}
                    >
                      <AppIcon
                        name={paused ? 'play' : 'pause'}
                        size={16}
                        className="text-brand-ink"
                      />
                    </IconButton>
                  </View>
                )}
              </View>
              <View className="border-glass-rim/70 bg-card/45 flex-row flex-wrap gap-x-5 gap-y-3 rounded-3xl border p-4">
                <MetricPair label={t('home.currentDraw')}>
                  {live ? watts(live.watts) : t('dashboard.noReading')}
                </MetricPair>
                {bill.data && (
                  <MetricPair label={t('dashboardNew.todayCost')}>
                    {formatCurrency(bill.data.today_amount, i18n.language, 'VND')}
                  </MetricPair>
                )}
              </View>
              {today?.typical_kwh != null && (
                <Text className="text-brand-ink text-xs">
                  {t('dashboardNew.typical', { value: kwh(today.typical_kwh) })}
                </Text>
              )}
              {live && (
                <Text className="text-brand-ink text-xs">
                  {t('dashboardNew.lastReading', {
                    value: new Date(live.ts).toLocaleString(i18n.language, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: VIETNAM_TIME_ZONE,
                    }),
                  })}
                </Text>
              )}
            </Surface>
          </View>
        )}
      </QueryContent>

      <Surface>
        <View className="flex-row items-center gap-3">
          <IllustratedIcon name="chat" size={58} />
          <View className="flex-1 gap-1">
            <SectionTitle>{t('dashboardNew.askTitle')}</SectionTitle>
            <Text className="text-muted-foreground text-sm">{t('dashboardNew.askQuestion')}</Text>
          </View>
        </View>
        <ActionButton
          variant="solid"
          trailingIcon="arrow"
          onPress={() =>
            router.push({
              pathname: '/(app)/(assistant)/assistant',
              params: { question: t('dashboardNew.askQuestion') },
            })
          }
        >
          {t('dashboardNew.askAction')}
        </ActionButton>
      </Surface>

      <View className="gap-2">
        <SectionTitle
          action={
            <ActionButton
              variant="ghost"
              onPress={() => router.navigate('/(app)/(devices)/devices')}
            >
              {t('dashboardNew.allDevices')}
            </ActionButton>
          }
        >
          {t('dashboardNew.topDevices')}
        </SectionTitle>
        <Text className="text-muted-foreground text-sm">{t('dashboardNew.estimatedToday')}</Text>
        <QueryContent query={devices} empty={(items) => items.length === 0}>
          {(items) => (
            <DeviceList
              devices={[...items].sort((a, b) => b.today_kwh - a.today_kwh).slice(0, 3)}
            />
          )}
        </QueryContent>
      </View>

      <QueryContent query={weather}>
        {({ province, now }) => (
          <Surface size="sm">
            <View className="flex-row items-center gap-3">
              <IllustratedIcon name="sun" size={50} />
              <View className="flex-1 gap-1">
                <Text className="text-foreground text-base font-semibold">{province}</Text>
                <Text className="text-muted-foreground text-sm">{now.sky.description}</Text>
              </View>
              <Text className="text-foreground text-xl font-semibold">
                {dashboardNumber(now.temp, i18n.language)} °C
              </Text>
            </View>
          </Surface>
        )}
      </QueryContent>
    </Page>
  );
}
