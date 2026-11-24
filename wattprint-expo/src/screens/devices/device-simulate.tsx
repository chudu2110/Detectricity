import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ActionButton, SectionTitle, Surface } from '@/components/app-ui';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { simulateSaving } from '@/features/dashboard/api';
import type { SimulationInput } from '@/features/dashboard/schemas';
import { formatCurrency } from '@/lib/format';
import { dashboardNumber, errorCode, parseAmount } from '@/screens/dashboard-parts';

const FIELDS = ['hours', 'watts', 'price'] as const;
type Field = (typeof FIELDS)[number];

export function DeviceSimulate({ deviceId }: { deviceId: string }) {
  const { t, i18n } = useTranslation();
  const [values, setValues] = useState<Record<Field, string>>({ hours: '', watts: '', price: '' });
  const [submitted, setSubmitted] = useState(false);
  const run = useMutation({ mutationFn: simulateSaving });
  const number = (value: number) => dashboardNumber(value, i18n.language);
  const kwh = (value: number) => t('energy.kwh', { value: number(value) });
  const money = (value: number) => formatCurrency(value, i18n.language, 'VND');
  const parsed = Object.fromEntries(
    FIELDS.map((field) => [field, values[field].trim() ? parseAmount(values[field]) : undefined]),
  ) as Record<Field, number | undefined>;
  const invalid = FIELDS.filter((field) => {
    const value = parsed[field];
    return value !== undefined && !(Number.isFinite(value) && value >= 0);
  });
  const labels: Record<Field, string> = {
    hours: t('savings.hoursLess'),
    watts: t('savings.newWatts'),
    price: t('savings.price'),
  };
  const result = run.data;
  return (
    <Surface>
      <SectionTitle>{t('savings.simulateTitle')}</SectionTitle>
      <Text className="text-muted-foreground text-sm">{t('savings.simulateHint')}</Text>
      {FIELDS.map((field) => (
        <View key={field} className="gap-1.5">
          <Text className="text-foreground text-sm font-medium">{labels[field]}</Text>
          <Input className="bg-secondary min-h-12 rounded-xl px-3">
            <InputField
              aria-label={labels[field]}
              value={values[field]}
              onChangeText={(text) => setValues((current) => ({ ...current, [field]: text }))}
              keyboardType="decimal-pad"
              editable={!run.isPending}
              className="text-base"
            />
          </Input>
          {submitted && invalid.includes(field) && (
            <Text accessibilityLiveRegion="polite" selectable className="text-destructive text-sm">
              {t('savings.invalidNumber')}
            </Text>
          )}
        </View>
      ))}
      <ActionButton
        busy={run.isPending}
        onPress={() => {
          setSubmitted(true);
          if (invalid.length) return;
          const body: SimulationInput = { device_id: deviceId };
          if (parsed.hours !== undefined) body.hours_per_day_less = parsed.hours;
          if (parsed.watts !== undefined) body.new_watts = parsed.watts;
          if (parsed.price !== undefined) body.price_vnd = parsed.price;
          run.mutate(body);
        }}
      >
        {t('savings.simulate')}
      </ActionButton>
      {run.error && (
        <Text accessibilityLiveRegion="polite" selectable className="text-destructive text-sm">
          {errorCode(run.error) === 'device_runs_missing' ? t('savings.noRuns') : run.error.message}
        </Text>
      )}
      {result && (
        <View accessibilityLiveRegion="polite" className="bg-secondary gap-1 rounded-2xl p-3">
          <Text className="text-muted-foreground text-sm">
            {t('savings.now', {
              hours: number(result.hours_per_day),
              watts: t('devices.watts', { value: number(result.watts_when_on) }),
            })}
          </Text>
          <Text className="text-foreground text-base font-semibold">
            {result.kwh_per_month_saved >= 0
              ? t('savings.saved', { value: kwh(result.kwh_per_month_saved) })
              : t('savings.moreUse', { value: kwh(-result.kwh_per_month_saved) })}
          </Text>
          {result.vnd_per_month_saved !== null && result.vnd_per_month_saved > 0 && (
            <Text className="text-foreground text-sm">
              {t('savings.savedMoney', { value: money(result.vnd_per_month_saved) })}
            </Text>
          )}
          {result.price_vnd !== null && (
            <Text className="text-foreground text-sm">
              {result.payback_months !== null
                ? t('savings.payback', { months: number(result.payback_months) })
                : t('savings.noPayback')}
            </Text>
          )}
        </View>
      )}
    </Surface>
  );
}
