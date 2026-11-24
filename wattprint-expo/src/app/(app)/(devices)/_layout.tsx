import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function DevicesLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="devices" options={{ title: t('tabs.devices') }} />
      <Stack.Screen name="sources" options={{ title: t('dataSources.add') }} />
      <Stack.Screen name="groups/[type]" options={{ title: t('dataSources.groupTitle') }} />
      <Stack.Screen name="plugs/[id]" options={{ title: t('tabs.devices') }} />
    </Stack>
  );
}
