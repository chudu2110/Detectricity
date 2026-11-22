import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, BrandMark, Surface } from '@/components/app-ui';
import { AmbientBackdrop } from '@/components/glass-surface';
import { HouseIllustration } from '@/components/house-illustration';
import { DisplayText } from '@/components/display-text';
import { authErrorKey } from '@/features/auth/auth-error';
import { useSignIn } from '@/features/auth/hooks/use-sign-in';
import { errorMessage } from '@/lib/errors';

export function SignInScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const signIn = useSignIn();
  const errorKey = authErrorKey(signIn.error);
  const apiError = signIn.error ? (errorKey ? t(errorKey) : errorMessage(signIn.error, t)) : null;
  return (
    <View className="bg-background flex-1">
      <AmbientBackdrop />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="grow gap-5 px-6"
        contentContainerStyle={{ paddingTop: insets.top + 22, paddingBottom: insets.bottom + 24 }}
      >
        <View className="flex-row items-center gap-3">
          <BrandMark size="sm" />
          <DisplayText
            weight="semibold"
            className="text-foreground text-[24px] leading-8 tracking-[-0.8px]"
          >
            Detectricity
          </DisplayText>
        </View>
        <View className="-mx-1">
          <HouseIllustration size="welcome" />
        </View>
        <Surface size="lg">
          <Text className="text-primary-strong text-xs font-semibold tracking-widest">
            {t('auth.signIn.tagline')}
          </Text>
          <DisplayText
            weight="semibold"
            className="text-foreground text-[36px] leading-[44px] tracking-[-1.2px]"
            accessibilityRole="header"
          >
            {t('auth.signIn.subtitle')}
          </DisplayText>
          <Text className="text-muted-foreground text-base leading-6">
            {t('auth.signIn.intro')}
          </Text>
        </Surface>
        <Text className="text-foreground sr-only">{t('auth.signIn.title')}</Text>
        {apiError !== null && (
          <Text selectable accessibilityLiveRegion="polite" className="text-destructive text-sm">
            {apiError}
          </Text>
        )}
        <View className="flex-1" />
        <ActionButton busy={signIn.isPending} trailingIcon="arrow" onPress={() => signIn.mutate()}>
          {t('auth.signIn.submit')}
        </ActionButton>
      </ScrollView>
    </View>
  );
}
