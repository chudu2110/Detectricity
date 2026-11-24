import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Page, QueryContent, SectionTitle, SegmentedControl, Surface } from '@/components/app-ui';
import { DisplayText } from '@/components/display-text';
import { Text } from '@/components/ui/text';
import { EmptyState } from '@/components/states/empty-state';
import { ApiError } from '@/lib/errors';
import { billQuery, forecastQuery, seriesQuery } from '@/features/dashboard/queries';
import { type EnergyPeriod, energyBuckets, periodWindow } from '@/features/dashboard/period';
import { formatCurrency } from '@/lib/format';
import { GoalSection } from './goal-section';
import { PlansSection } from './plans-section';
import {
  dashboardNumber,
  EnergyBars,
  MetricPair,
  VIETNAM_TIME_ZONE,
} from '@/screens/dashboard-parts';

export function Energy() {
  const { t, i18n } = useTranslation();
  const subscribed = useIsFocused();
  const [period, setPeriod] = useState<EnergyPeriod>('day');
  const window = periodWindow(period);
  const series = useQuery({
    ...seriesQuery(window.since, window.until, period === 'day' ? 24 : period === 'week' ? 7 : 31),
    subscribed,
  });
  const bill = useQuery({ ...billQuery(), subscribed });
  const forecast = useQuery({ ...forecastQuery(), subscribed });
  const kwh = (value: number) => t('energy.kwh', { value: dashboardNumber(value, i18n.language) });
  const money = (value: number) => formatCurrency(value, i18n.language, 'VND');
  const billDate = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: VIETNAM_TIME_ZONE,
  });
  return (
    <Page title={t('tabs.energy')} eyebrow="DETECTRICITY">
      <SegmentedControl
        value={period}
        options={(['day', 'week', 'month'] as const).map((value) => ({
          value,
          label: t(`dashboardNew.${value}`),
        }))}
        onChange={setPeriod}
      />
      <QueryContent query={series} empty={(points) => !points.length}>
        {(points) => (
          <Surface variant="matcha" size="lg">
            <Text className="text-brand-ink text-sm font-medium">{t('energyNew.consumption')}</Text>
            <DisplayText className="text-brand-ink text-[43px] leading-[53px] tracking-[-1.5px] tabular-nums">
              {kwh(points.reduce((sum, point) => sum + point.energy_wh, 0) / 1000)}
            </DisplayText>
            <EnergyBars
              key={`${period}-${window.since}`}
              buckets={energyBuckets(points, window.since, window.until, period)}
              intervalLabel={(index) =>
                period === 'day'
                  ? `${String(index).padStart(2, '0')}:00–${String(index + 1).padStart(2, '0')}:00`
                  : billDate.format(Date.parse(window.since) + index * 86_400_000)
              }
              labels={
                period === 'day'
                  ? ['00:00', '24:00']
                  : [Date.parse(window.since), Date.parse(window.until) - 1].map((timestamp) =>
                      new Date(timestamp).toLocaleString(i18n.language, {
                        timeZone: VIETNAM_TIME_ZONE,
                        day: 'numeric',
                        month: 'short',
                      }),
                    )
              }
              summary={t('energyNew.consumption')}
            />
            <Text className="text-brand-ink text-sm">{t('energyNew.available')}</Text>
          </Surface>
        )}
      </QueryContent>
      <SectionTitle>{t('energyNew.bill')}</SectionTitle>
      <QueryContent query={bill}>
        {(data) => (
          <Surface>
            <Text className="text-muted-foreground text-sm font-medium">
              {[data.period_start, data.period_end]
                .map((day) => billDate.format(new Date(day)))
                .join(' – ')}
            </Text>
            <DisplayText className="text-foreground text-[34px] leading-[43px] tracking-[-1px] tabular-nums">
              {money(data.amount_total)}
            </DisplayText>
            <View className="flex-row flex-wrap gap-4">
              <MetricPair label={t('energyNew.consumption')}>{kwh(data.kwh)}</MetricPair>
            </View>
            <Text className="text-muted-foreground text-sm">{t('energyNew.billNote')}</Text>
            {data.tiers
              .filter((tier) => tier.kwh > 0)
              .map((tier) => (
                <View
                  key={tier.tier_no}
                  className="border-glass-edge flex-row flex-wrap justify-between gap-x-3 gap-y-1 border-t pt-3"
                >
                  <Text className="text-muted-foreground text-sm">
                    {t('energyNew.tier', { n: tier.tier_no })} · {kwh(tier.kwh)}
                  </Text>
                  <Text className="text-foreground text-sm font-medium">{money(tier.amount)}</Text>
                </View>
              ))}
          </Surface>
        )}
      </QueryContent>
      <SectionTitle>{t('energyNew.forecast')}</SectionTitle>
      {forecast.error instanceof ApiError && forecast.error.status === 404 && !forecast.data ? (
        <EmptyState
          className="flex-none"
          title={t('energyNew.notEnough')}
          description={t('energyNew.notEnoughDetail')}
        />
      ) : (
        <QueryContent query={forecast}>
          {(data) => (
            <Surface variant="quiet">
              <DisplayText className="text-foreground text-[28px] leading-9 tabular-nums">
                {money(data.amount)}
              </DisplayText>
              <Text className="text-muted-foreground text-sm">
                {t('energyNew.forecastNote', { days: data.basis_days })} · {kwh(data.kwh)}
              </Text>
            </Surface>
          )}
        </QueryContent>
      )}
      <GoalSection />
      <PlansSection />
    </Page>
  );
}
