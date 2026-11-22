import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ActionButton, Page, QueryContent, SegmentedControl } from '@/components/app-ui';
import { TactilePressable } from '@/components/tactile-pressable';
import { EmptyState } from '@/components/states/empty-state';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { devicesQuery } from '@/features/dashboard/queries';
import { DeviceList } from '@/screens/dashboard-parts';

type DeviceFilter = 'all' | 'on';

function searchText(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd');
}

export function Devices() {
  const { t } = useTranslation();
  const subscribed = useIsFocused();
  const devices = useQuery({ ...devicesQuery(), subscribed });
  const [filter, setFilter] = useState<DeviceFilter>('all');
  const [search, setSearch] = useState('');

  return (
    <Page
      title={t('tabs.devices')}
      refreshControl={
        <RefreshControl
          refreshing={devices.isRefetching}
          onRefresh={() => void devices.refetch()}
        />
      }
    >
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
        {(data) => {
          const needle = searchText(search.trim());
          const matches = data
            .filter((device) => filter === 'all' || device.on)
            .filter((device) => searchText(`${device.name} ${device.room ?? ''}`).includes(needle))
            .sort((a, b) => b.today_kwh - a.today_kwh);
          return (
            <View className="gap-3">
              <Text className="text-muted-foreground text-[13px] leading-5 font-medium">
                {t('dashboardNew.estimatedToday')}
              </Text>
              {matches.length > 0 ? (
                <DeviceList devices={matches} />
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
    </Page>
  );
}
