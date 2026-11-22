import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { DisplayText } from '@/components/display-text';
import { IllustratedIcon } from '@/components/illustrated-icon';
import { TactilePressable } from '@/components/tactile-pressable';
import {
  ActionButton,
  Page,
  QueryContent,
  SectionTitle,
  SegmentedControl,
  Surface,
} from '@/components/app-ui';
import { ErrorState } from '@/components/states/error-state';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useSignOut } from '@/features/auth/hooks/use-sign-out';
import { homeQuery } from '@/features/dashboard/queries';
import { updateUserPreferences } from '@/features/profile/api';
import { meQuery, userPreferencesQuery } from '@/features/profile/queries';
import type { UserPreferences } from '@/features/profile/schemas';
import { usePreferencesStore } from '@/stores/preferences-store';

const notificationKeys = [
  'notify_anomaly',
  'notify_tier',
  'weekly_summary',
] as const satisfies readonly (keyof UserPreferences)[];

function LinkRow({
  icon,
  title,
  subtitle,
  href,
}: {
  icon: ComponentProps<typeof AppIcon>['name'];
  title: string;
  subtitle: string;
  href: Href;
}) {
  const router = useRouter();
  return (
    <TactilePressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      className="min-h-16 flex-row items-center gap-3 rounded-2xl py-2.5"
    >
      <View className="border-glass-rim bg-glass-matcha/75 h-11 w-11 items-center justify-center rounded-2xl border">
        <IllustratedIcon name={icon} size={33} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-foreground text-[16px] leading-[22px] font-semibold tracking-[-0.25px]">
          {title}
        </Text>
        <Text className="text-muted-foreground text-sm">{subtitle}</Text>
      </View>
      <AppIcon name="chevron" size={17} className="text-muted-foreground" />
    </TactilePressable>
  );
}

function EmailPreferences() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const options = userPreferencesQuery();
  const preferences = useQuery(options);
  const save = useMutation({
    mutationFn: updateUserPreferences,
    onMutate: () => client.cancelQueries({ queryKey: options.queryKey }),
    onSuccess: (data) => client.setQueryData(options.queryKey, data),
  });

  return (
    <View className="gap-2.5">
      <SectionTitle>{t('account.emailPreferences')}</SectionTitle>
      <QueryContent query={preferences}>
        {(data) => (
          <Surface size="sm">
            <View className="divide-border divide-y">
              {notificationKeys.map((key) => {
                const value = (save.isPending ? save.variables?.[key] : undefined) ?? data[key];
                const label = t(`account.${key}`);
                return (
                  <View
                    key={key}
                    className="min-h-14 flex-row items-center justify-between gap-3 py-1"
                  >
                    <TactilePressable
                      accessible={false}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      disabled={save.isPending}
                      onPress={() => save.mutate({ [key]: !value })}
                      className="min-h-12 flex-1 justify-center"
                    >
                      <Text className="text-foreground text-base leading-[23px]">{label}</Text>
                    </TactilePressable>
                    <Switch
                      accessibilityLabel={label}
                      value={value}
                      onValueChange={(value) => save.mutate({ [key]: value })}
                      disabled={save.isPending}
                      className="min-h-12 min-w-12"
                    />
                  </View>
                );
              })}
            </View>
          </Surface>
        )}
      </QueryContent>
      {save.isError && (
        <ErrorState
          className="flex-none"
          error={save.error}
          onRetry={() => save.mutate(save.variables)}
        />
      )}
    </View>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const profile = useQuery(meQuery());
  const home = useQuery(homeQuery());
  const signOut = useSignOut();
  const theme = usePreferencesStore((state) => state.theme);
  const language = usePreferencesStore((state) => state.language);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const setLanguage = usePreferencesStore((state) => state.setLanguage);

  return (
    <Page title={t('account.title')}>
      <QueryContent query={profile}>
        {(user) => (
          <Surface variant="matcha" className="flex-row items-center">
            <IllustratedIcon name="user" size={60} />
            <View className="flex-1 gap-1">
              <DisplayText
                weight="semibold"
                className="text-brand-ink text-[23px] leading-[30px] tracking-[-0.6px]"
              >
                {user.full_name?.trim() || user.email}
              </DisplayText>
              {!!user.full_name?.trim() && (
                <Text selectable className="text-brand-ink text-sm">
                  {user.email}
                </Text>
              )}
              {home.data && (
                <Text className="text-brand-ink text-xs font-medium">
                  {t(`account.membership.${home.data.role}`)}
                </Text>
              )}
            </View>
          </Surface>
        )}
      </QueryContent>

      <View className="gap-2.5">
        <SectionTitle>{t('account.household')}</SectionTitle>
        <Surface size="sm">
          <View className="divide-border divide-y">
            <LinkRow
              icon="home"
              title={t('account.homeSettings')}
              subtitle={home.data?.name ?? t('account.manageHousehold')}
              href="/(app)/(settings)/home"
            />
            <LinkRow
              icon="bell"
              title={t('account.alerts')}
              subtitle={t('account.reviewAlerts')}
              href="/(app)/(settings)/alerts"
            />
          </View>
        </Surface>
      </View>

      <EmailPreferences />

      <Surface size="sm">
        <View className="gap-2">
          <SectionTitle>{t('account.appearance')}</SectionTitle>
          <SegmentedControl
            value={theme}
            options={[
              { value: 'system', label: t('account.theme.system') },
              { value: 'light', label: t('account.theme.light') },
              { value: 'dark', label: t('account.theme.dark') },
            ]}
            onChange={setTheme}
          />
        </View>
        <View className="gap-2">
          <SectionTitle>{t('account.language')}</SectionTitle>
          <SegmentedControl
            value={language}
            options={[
              { value: 'vi', label: t('account.vietnamese') },
              { value: 'en', label: t('account.english') },
            ]}
            onChange={setLanguage}
          />
        </View>
      </Surface>

      {signOut.isError && <ErrorState className="flex-none" error={signOut.error} />}
      <ActionButton
        variant="outline"
        trailingIcon="logout"
        busy={signOut.isPending}
        onPress={() => signOut.mutate()}
      >
        {signOut.isPending ? t('account.signingOut') : t('account.signOut')}
      </ActionButton>
    </Page>
  );
}
