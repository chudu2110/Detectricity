import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Page, Pill, QueryContent, SectionTitle, Surface } from '@/components/app-ui';
import { DisplayText } from '@/components/display-text';
import { DeviceIllustration } from '@/components/illustrated-icon';
import { EmptyState } from '@/components/states/empty-state';
import { Text } from '@/components/ui/text';
import { deviceQuery, devicesQuery } from '@/features/dashboard/queries';
import { renameDevice } from '@/features/dashboard/api';
import {
  BackButton,
  dashboardNumber,
  EnergyBars,
  EstimatedPill,
  MetricPair,
  VIETNAM_TIME_ZONE,
} from '@/screens/dashboard-parts';
import { EditDeviceButton, RenameDeviceForm } from './rename-device';

export function DeviceDetailScreen({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const save = useMutation({
    mutationFn: ({ name, room }: { name: string; room: string | null }) =>
      renameDevice(id, name, room),
    onSuccess: () => {
      setEditing(false);
      void client.invalidateQueries({ queryKey: devicesQuery().queryKey });
      void client.invalidateQueries({ queryKey: deviceQuery(id).queryKey });
    },
  });
  const cached = client.getQueryData(devicesQuery().queryKey)?.find((device) => device.id === id);
  const detail = useQuery(deviceQuery(id));
  const preview = detail.data ?? cached;
  const number = (value: number) => dashboardNumber(value, i18n.language);
  const kwh = (value: number) => t('energy.kwh', { value: number(value) });
  const watts = (value: number) => t('devices.watts', { value: number(value) });
  const clock = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: VIETNAM_TIME_ZONE,
  });

  return (
    <Page
      title={
        preview?.type === 'other'
          ? preview.name.replace(/1$/, '')
          : (preview?.name ?? t('dashboardNew.device'))
      }
      eyebrow={preview?.room ?? undefined}
      action={<BackButton />}
      floatingAction={preview ? <EditDeviceButton onPress={() => setEditing(true)} /> : undefined}
    >
      {editing && preview && (
        <RenameDeviceForm
          key={preview.name}
          initialName={preview.name}
          initialRoom={preview.room}
          onSave={(name, room) => save.mutate({ name, room })}
          onCancel={() => setEditing(false)}
          busy={save.isPending}
          error={save.error}
        />
      )}
      {preview && (
        <Surface variant="matcha" size="lg">
          <View className="flex-row items-center justify-between gap-4">
            <DeviceIllustration type={preview.type} size={72} />
            <Pill tone={preview.on ? 'green' : 'neutral'}>
              {t(preview.on ? 'dashboardNew.status.on' : 'dashboardNew.status.off')}
            </Pill>
          </View>
          <View className="gap-1">
            <Text className="text-brand-ink text-sm font-medium">{t('home.currentDraw')}</Text>
            <DisplayText className="text-brand-ink text-[43px] leading-[53px] tracking-[-1.5px] tabular-nums">
              {watts(preview.watts)}
            </DisplayText>
          </View>
          <View className="bg-card/70 flex-row flex-wrap gap-x-5 gap-y-3 rounded-2xl p-4">
            <MetricPair label={t('dashboardNew.day')}>{kwh(preview.today_kwh)}</MetricPair>
            <MetricPair label={t('dashboardNew.month')}>{kwh(preview.month_kwh)}</MetricPair>
          </View>
          <Text className="text-brand-ink text-sm">{t('dashboardNew.estimatedDevice')}</Text>
        </Surface>
      )}
      <QueryContent query={detail}>
        {(data) => (
          <>
            <Surface>
              <SectionTitle action={<EstimatedPill />}>{t('dashboardNew.thisMonth')}</SectionTitle>
              {data.days.length > 0 ? (
                <EnergyBars
                  buckets={data.days.map((day) => day.kwh)}
                  labels={[data.days[0].date, data.days[data.days.length - 1].date].map((date) =>
                    new Date(`${date}T12:00:00+07:00`).toLocaleDateString(i18n.language, {
                      day: 'numeric',
                      month: 'short',
                      timeZone: VIETNAM_TIME_ZONE,
                    }),
                  )}
                  summary={t('dashboardNew.monthChart', { value: kwh(data.month_kwh) })}
                />
              ) : (
                <EmptyState className="flex-none" title={t('energy.noUsageTitle')} />
              )}
              <View className="flex-row flex-wrap gap-4">
                <MetricPair label={t('dashboardNew.averageOn')}>{watts(data.avg_on_w)}</MetricPair>
                <MetricPair label={t('dashboardNew.peak')}>{watts(data.peak_w)}</MetricPair>
                <MetricPair label={t('dashboardNew.homeShare')}>
                  {Intl.NumberFormat(i18n.language, {
                    style: 'percent',
                    maximumFractionDigits: 1,
                  }).format(data.home_share)}
                </MetricPair>
                {data.typical_w !== null && (
                  <MetricPair label={t('dashboardNew.typicalPower')}>
                    {watts(data.typical_w)}
                  </MetricPair>
                )}
              </View>
            </Surface>
            {data.tip && (
              <Surface variant="quiet">
                <SectionTitle>{t('dashboardNew.deviceTip')}</SectionTitle>
                <Text className="text-muted-foreground text-base">{data.tip}</Text>
              </Surface>
            )}
            <Surface>
              <SectionTitle>{t('dashboardNew.recentRuns')}</SectionTitle>
              {data.cycles.length === 0 ? (
                <Text className="text-muted-foreground text-sm">
                  {t('dashboardNew.noRecentRuns')}
                </Text>
              ) : (
                [...data.cycles].reverse().map((cycle) => (
                  <View
                    key={cycle.start}
                    className="border-border flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t pt-3"
                  >
                    <Text className="text-muted-foreground text-sm">
                      {cycle.end === null
                        ? t('dashboardNew.sinceTime', { time: clock.format(cycle.start) })
                        : `${clock.format(cycle.start)} – ${clock.format(cycle.end)}`}
                    </Text>
                    <Text className="text-foreground text-sm font-semibold">{kwh(cycle.kwh)}</Text>
                  </View>
                ))
              )}
            </Surface>
          </>
        )}
      </QueryContent>
    </Page>
  );
}
