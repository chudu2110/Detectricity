import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ActionButton, Page, QueryContent, Surface } from '@/components/app-ui';
import { DeviceIllustration } from '@/components/illustrated-icon';
import { TactilePressable } from '@/components/tactile-pressable';
import { EmptyState } from '@/components/states/empty-state';
import { Text } from '@/components/ui/text';
import { plugsQuery, sourcesQuery } from '@/features/data-sources/queries';
import { devicesQuery } from '@/features/dashboard/queries';
import { BackButton, dashboardNumber } from '@/screens/dashboard-parts';

export function DeviceGroupScreen({ type }: { type: string }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const devices = useQuery(devicesQuery());
  const sources = useQuery(sourcesQuery());
  const plugs = useQuery(plugsQuery());

  return (
    <QueryContent query={devices}>
      {(allDevices) => {
        const originals = allDevices.filter((device) => device.type === type);
        if (!originals.length) {
          return (
            <Page title={t('dataSources.groupTitle')} action={<BackButton />}>
              <EmptyState className="flex-none" title={t('dataSources.groupMissing')} />
            </Page>
          );
        }
        const ids = new Set(originals.map((device) => device.id));
        const today = originals.reduce((total, device) => total + device.today_kwh, 0);
        return (
          <Page
            title={originals[0].name}
            eyebrow={t('dataSources.groupTitle')}
            action={<BackButton />}
          >
            <Surface className="gap-3">
              <Text className="text-foreground text-lg font-semibold">
                {t('dataSources.groupUsage')}
              </Text>
              <Text className="text-primary-strong text-2xl font-semibold">
                {t('energy.kwh', { value: dashboardNumber(today, i18n.language) })}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {t('dataSources.groupUsageInfo')}
              </Text>
            </Surface>
            <QueryContent query={sources}>
              {(sourceData) => (
                <QueryContent query={plugs}>
                  {(plugData) => {
                    const children = sourceData.filter(
                      (source) =>
                        source.kind === 'plug' &&
                        source.device_id !== null &&
                        ids.has(source.device_id),
                    );
                    return (
                      <Surface className="gap-4">
                        <Text className="text-foreground text-lg font-semibold">
                          {t('dataSources.groupMembers')}
                        </Text>
                        {originals.map((device) => (
                          <TactilePressable
                            key={device.id}
                            accessibilityRole="button"
                            onPress={() =>
                              router.push({
                                pathname: '/(app)/(devices)/[id]',
                                params: { id: device.id },
                              })
                            }
                            className="border-border min-h-20 flex-row items-center gap-3 border-b pb-3"
                          >
                            <DeviceIllustration type={device.type} size={48} />
                            <View className="flex-1 gap-1">
                              <Text className="text-foreground font-semibold">
                                {t('dataSources.refitChild', { name: device.name })}
                              </Text>
                              <Text className="text-muted-foreground text-sm">
                                {t('dataSources.refitInfo')}
                              </Text>
                              <Text className="text-primary-strong text-sm">
                                {t('dataSources.todayUsage', {
                                  value: dashboardNumber(device.today_kwh, i18n.language),
                                })}
                              </Text>
                            </View>
                          </TactilePressable>
                        ))}
                        {children.map((source) => {
                          const plug = plugData.find((item) => item.device_id === source.device_id);
                          return (
                            <View key={source.id} className="border-border gap-2 border-b pb-3">
                              <Text className="text-foreground font-semibold">{source.name}</Text>
                              <Text className="text-muted-foreground text-sm">
                                {[
                                  plug?.plug_name,
                                  plug
                                    ? t(plug.online ? 'dataSources.online' : 'dataSources.offline')
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </Text>
                              <Text className="text-primary-strong text-sm">
                                {source.consumed_kwh === null
                                  ? t('dataSources.noPlugReadings')
                                  : t('dataSources.total', { value: source.consumed_kwh })}
                              </Text>
                            </View>
                          );
                        })}
                        {children.length === 0 && (
                          <Text className="text-muted-foreground text-sm">
                            {t('dataSources.noAssignedPlugs')}
                          </Text>
                        )}
                        <ActionButton
                          variant="outline"
                          onPress={() => router.push('/(app)/(devices)/sources')}
                        >
                          {t('dataSources.managePlugs')}
                        </ActionButton>
                      </Surface>
                    );
                  }}
                </QueryContent>
              )}
            </QueryContent>
          </Page>
        );
      }}
    </QueryContent>
  );
}
