import { useQuery } from '@tanstack/react-query';
import { useIsFocused, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ActionButton, Page, QueryContent, SegmentedControl, Surface } from '@/components/app-ui';
import { DisplayText } from '@/components/display-text';
import { DeviceIllustration } from '@/components/illustrated-icon';
import { TactilePressable } from '@/components/tactile-pressable';
import { EmptyState } from '@/components/states/empty-state';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { DataSource } from '@/features/data-sources/api';
import { sourcesQuery } from '@/features/data-sources/queries';
import { devicesQuery } from '@/features/dashboard/queries';
import type { LiveDevice } from '@/features/dashboard/schemas';
import { dashboardNumber } from '@/screens/dashboard-parts';

type DeviceFilter = 'all' | 'on';

function searchText(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd');
}

function DeviceGroups({ groups, sources }: { groups: LiveDevice[][]; sources: DataSource[] }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  return (
    <Surface size="sm">
      <View className="gap-1">
        {groups.map((group, index) => {
          const parent = group[0];
          const ids = new Set(group.map((device) => device.id));
          const plugCount = sources.filter(
            (source) => source.kind === 'plug' && source.device_id && ids.has(source.device_id),
          ).length;
          const today = group.reduce((total, device) => total + device.today_kwh, 0);
          return (
            <View key={parent.type}>
              {index > 0 && <View className="bg-border ml-16 h-px" />}
              <TactilePressable
                accessibilityRole="button"
                accessibilityLabel={t('dataSources.openGroup', { name: parent.name })}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/(devices)/groups/[type]',
                    params: { type: parent.type },
                  })
                }
                className="min-h-[76px] flex-row items-center gap-2 rounded-2xl py-2.5"
              >
                <DeviceIllustration type={parent.type} />
                <View className="flex-1 flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <View className="min-w-[44%] flex-1 gap-1">
                    <Text className="text-foreground text-[16px] leading-[22px] font-semibold">
                      {parent.name}
                    </Text>
                    <Text className="text-muted-foreground text-[13px] leading-[18px]">
                      {t('dataSources.groupChildren', {
                        original: group.length,
                        plugs: plugCount,
                      })}
                    </Text>
                  </View>
                  <DisplayText
                    weight="semibold"
                    className="text-brand-ink shrink text-[18px] leading-6 tabular-nums"
                  >
                    {t('energy.kwh', { value: dashboardNumber(today, i18n.language) })}
                  </DisplayText>
                </View>
                <AppIcon name="chevron" className="text-muted-foreground" size={14} />
              </TactilePressable>
            </View>
          );
        })}
      </View>
    </Surface>
  );
}

export function Devices() {
  const { t } = useTranslation();
  const subscribed = useIsFocused();
  const router = useRouter();
  const devices = useQuery({ ...devicesQuery(), subscribed });
  const sources = useQuery({ ...sourcesQuery(), subscribed });
  const [filter, setFilter] = useState<DeviceFilter>('all');
  const [search, setSearch] = useState('');

  return (
    <Page
      title={t('tabs.devices')}
      refreshControl={
        <RefreshControl
          refreshing={devices.isRefetching || sources.isRefetching}
          onRefresh={() => {
            void devices.refetch();
            void sources.refetch();
          }}
        />
      }
    >
      <ActionButton variant="tonal" onPress={() => router.push('/(app)/(devices)/sources')}>
        {t('dataSources.add')}
      </ActionButton>
      <Input className="bg-card/75 border-glass-rim min-h-14 gap-3 rounded-full px-4">
        <AppIcon name="search" size={20} className="text-primary-strong" />
        <InputField
          aria-label={t('dashboardNew.searchDevices')}
          placeholder={t('dashboardNew.searchDevices')}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCapitalize="none"
          className="text-base"
        />
        {search.length > 0 && (
          <TactilePressable
            accessibilityRole="button"
            accessibilityLabel={t('dashboardNew.clearSearch')}
            className="min-h-12 min-w-12 items-center justify-center"
            onPress={() => setSearch('')}
          >
            <View className="bg-glass-quiet h-7 w-7 items-center justify-center rounded-full">
              <AppIcon name="close" size={15} className="text-muted-foreground" />
            </View>
          </TactilePressable>
        )}
      </Input>
      <SegmentedControl
        value={filter}
        options={[
          { value: 'all', label: t('dashboardNew.filterAll') },
          { value: 'on', label: t('dashboardNew.filterOn') },
        ]}
        onChange={setFilter}
      />
      <QueryContent query={devices} empty={(data) => data.length === 0}>
        {(data) => (
          <QueryContent query={sources}>
            {(sourceData) => {
              const groupsByType = new Map<string, LiveDevice[]>();
              for (const device of data) {
                const group = groupsByType.get(device.type) ?? [];
                group.push(device);
                groupsByType.set(device.type, group);
              }
              const needle = searchText(search.trim());
              const groups = [...groupsByType.values()]
                .filter((group) => filter === 'all' || group.some((device) => device.on))
                .filter((group) => {
                  const ids = new Set(group.map((device) => device.id));
                  const names = [
                    ...group.map((device) => device.name + ' ' + (device.room ?? '')),
                    ...sourceData
                      .filter(
                        (source) =>
                          source.kind === 'plug' && source.device_id && ids.has(source.device_id),
                      )
                      .map((source) => source.name),
                  ];
                  return names.some((name) => searchText(name).includes(needle));
                })
                .sort(
                  (a, b) =>
                    b.reduce((total, device) => total + device.today_kwh, 0) -
                    a.reduce((total, device) => total + device.today_kwh, 0),
                );
              return (
                <View className="gap-3">
                  <Text className="text-muted-foreground text-[13px] leading-5 font-medium">
                    {t('dashboardNew.estimatedToday')}
                  </Text>
                  {groups.length > 0 ? (
                    <DeviceGroups groups={groups} sources={sourceData} />
                  ) : (
                    <EmptyState
                      className="flex-none"
                      title={t('dashboardNew.noDeviceMatch')}
                      description={t('dashboardNew.adjustDeviceFilters')}
                    >
                      <ActionButton
                        variant="tonal"
                        onPress={() => {
                          setSearch('');
                          setFilter('all');
                        }}
                      >
                        {t('dashboardNew.resetFilters')}
                      </ActionButton>
                    </EmptyState>
                  )}
                </View>
              );
            }}
          </QueryContent>
        )}
      </QueryContent>
    </Page>
  );
}
