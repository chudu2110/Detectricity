import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppIcon } from '@/components/app-icon';
import { IconButton } from '@/components/app-ui';

export function SettingsBack() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <IconButton
      label={t('account.back')}
      onPress={() => {
        router.replace('/(app)/(settings)/settings');
      }}
    >
      <AppIcon name="back" className="text-foreground" size={20} />
    </IconButton>
  );
}
