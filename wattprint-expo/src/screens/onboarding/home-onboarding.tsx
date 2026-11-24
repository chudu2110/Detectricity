import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { withUniwind } from 'uniwind';

import { ActionButton, Page, QueryContent, SectionTitle, Surface } from '@/components/app-ui';
import { ErrorState } from '@/components/states/error-state';
import { TactilePressable } from '@/components/tactile-pressable';
import { Text } from '@/components/ui/text';
import { createHome } from '@/features/dashboard/api';
import { homeQuery, provincesQuery } from '@/features/dashboard/queries';

const StyledInput = withUniwind(TextInput);

export function HomeOnboarding() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const provinces = useQuery(provincesQuery());
  const [name, setName] = useState('');
  const [province, setProvince] = useState<string | null>(null);
  const [billingDay, setBillingDay] = useState('1');
  const save = useMutation({
    mutationFn: createHome,
    onSuccess: (home) => client.setQueryData(homeQuery().queryKey, home),
  });
  const day = Number(billingDay);
  const valid = name.trim().length > 0 && province !== null && day >= 1 && day <= 28;

  return (
    <Page title={t('onboarding.title')} eyebrow={t('onboarding.eyebrow')}>
      <Text className="text-muted-foreground text-base">{t('onboarding.intro')}</Text>
      <Surface>
        <SectionTitle>{t('onboarding.home')}</SectionTitle>
        <Text className="text-foreground text-sm font-medium">{t('account.homeName')}</Text>
        <StyledInput
          value={name}
          onChangeText={setName}
          placeholder={t('onboarding.homePlaceholder')}
          placeholderTextColorClassName="accent-muted-foreground"
          className="bg-secondary text-foreground min-h-12 rounded-xl px-3 text-base"
        />
        <Text className="text-foreground text-sm font-medium">{t('account.province')}</Text>
        <QueryContent query={provinces}>
          {(items) => (
            <View className="flex-row flex-wrap gap-2">
              {items.map((item) => (
                <TactilePressable
                  key={item.code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: province === item.code }}
                  onPress={() => setProvince(item.code)}
                  className={`min-h-11 justify-center rounded-full border px-4 ${province === item.code ? 'border-primary-strong bg-brand-soft' : 'border-glass-edge bg-glass-fill'}`}
                >
                  <Text
                    className={
                      province === item.code ? 'text-brand-ink font-semibold' : 'text-foreground'
                    }
                  >
                    {item.name}
                  </Text>
                </TactilePressable>
              ))}
            </View>
          )}
        </QueryContent>
        <Text className="text-foreground text-sm font-medium">{t('account.billingDay')}</Text>
        <StyledInput
          value={billingDay}
          onChangeText={setBillingDay}
          keyboardType="number-pad"
          className="bg-secondary text-foreground min-h-12 rounded-xl px-3 text-base"
        />
        <Text className="text-muted-foreground text-sm">{t('account.billingHelp')}</Text>
      </Surface>
      {save.isError && <ErrorState className="flex-none" error={save.error} />}
      <ActionButton
        disabled={!valid}
        busy={save.isPending}
        onPress={() =>
          province &&
          save.mutate({ name: name.trim(), province_code: province, billing_cycle_day: day })
        }
      >
        {t('onboarding.create')}
      </ActionButton>
    </Page>
  );
}
