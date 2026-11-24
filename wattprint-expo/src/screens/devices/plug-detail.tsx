import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Page, Pill, QueryContent, Surface } from '@/components/app-ui';
import { DeviceIllustration } from '@/components/illustrated-icon';
import { EmptyState } from '@/components/states/empty-state';
import { Text } from '@/components/ui/text';
import { renamePlug } from '@/features/data-sources/api';
import { plugsQuery, sourceKeys, sourcesQuery } from '@/features/data-sources/queries';
import { devicesQuery } from '@/features/dashboard/queries';
import { BackButton } from '@/screens/dashboard-parts';
import { EditDeviceButton, RenameDeviceForm } from './rename-device';

export function PlugDetailScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const sources = useQuery(sourcesQuery());
  const devices = useQuery(devicesQuery());
  const plugs = useQuery(plugsQuery());
  const [editing, setEditing] = useState(false);
  const save = useMutation({
    mutationFn: ({ name, room }: { name: string; room: string | null }) =>
      renamePlug(id, name, room),
    onSuccess: () => {
      setEditing(false);
      void client.invalidateQueries({ queryKey: sourceKeys.list });
      void client.invalidateQueries({ queryKey: devicesQuery().queryKey });
    },
  });

  return (
    <QueryContent query={sources}>
      {(allSources) => {
        const source = allSources.find((item) => item.id === id && item.kind === 'plug');
        if (!source) {
          return (
            <Page title={t('tabs.devices')} action={<BackButton />}>
              <EmptyState className="flex-none" title={t('dataSources.plugMissing')} />
            </Page>
          );
        }
        const device = devices.data?.find((item) => item.id === source.device_id);
        const plug = plugs.data?.find((item) => item.device_id === source.device_id);
        return (
          <Page
            title={source.name}
            eyebrow={source.room ?? undefined}
            action={<BackButton />}
            floatingAction={<EditDeviceButton onPress={() => setEditing(true)} />}
          >
            {editing && (
              <RenameDeviceForm
                key={source.name}
                initialName={source.name}
                initialRoom={source.room}
                onSave={(name, room) => save.mutate({ name, room })}
                onCancel={() => setEditing(false)}
                busy={save.isPending}
                error={save.error}
              />
            )}
            <Surface variant="matcha" size="lg">
              <View className="flex-row items-center justify-between gap-4">
                <DeviceIllustration type={device?.type ?? 'plug'} size={72} />
                {plug && (
                  <Pill tone={plug.online ? 'green' : 'neutral'}>
                    {t(plug.online ? 'dataSources.online' : 'dataSources.offline')}
                  </Pill>
                )}
              </View>
              <Text className="text-brand-ink text-lg font-semibold">
                {source.consumed_kwh === null
                  ? t('dataSources.noPlugReadings')
                  : t('dataSources.total', { value: source.consumed_kwh })}
              </Text>
              <Text className="text-brand-ink text-sm">{t('dataSources.plugInfo')}</Text>
            </Surface>
          </Page>
        );
      }}
    </QueryContent>
  );
}
