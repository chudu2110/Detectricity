import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ActionButton, Pill, QueryContent, SectionTitle, Surface } from '@/components/app-ui';
import { Text } from '@/components/ui/text';
import { acceptPlan } from '@/features/copilot/api';
import { plansQuery } from '@/features/dashboard/queries';
import type { Plan } from '@/features/dashboard/schemas';
import { formatCurrency } from '@/lib/format';
import { dashboardNumber } from '@/screens/dashboard-parts';

export function PlansSection() {
  const { t } = useTranslation();
  const plans = useQuery({ ...plansQuery(), subscribed: useIsFocused() });
  return (
    <>
      <SectionTitle>{t('savings.plansTitle')}</SectionTitle>
      <QueryContent query={plans}>
        {(data) =>
          data.length === 0 ? (
            <Surface variant="quiet">
              <Text className="text-muted-foreground text-base">{t('savings.noPlans')}</Text>
            </Surface>
          ) : (
            data.map((plan) => <PlanCard key={plan.id} plan={plan} />)
          )
        }
      </QueryContent>
    </>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const start = useMutation({
    mutationFn: () => acceptPlan(plan.id),
    onSuccess: () => client.invalidateQueries({ queryKey: plansQuery().queryKey }),
  });
  const kwh = (value: number) => t('energy.kwh', { value: dashboardNumber(value, i18n.language) });
  const money = (value: number) => formatCurrency(value, i18n.language, 'VND');
  const m = plan.measure;
  const started = plan.started_at !== null;
  return (
    <Surface>
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <Text className="text-foreground flex-1 text-base font-semibold">{plan.title}</Text>
        <Pill tone={started ? 'green' : 'neutral'}>
          {t(`savings.planStatus.${plan.status}`, { defaultValue: plan.status })}
        </Pill>
      </View>
      {plan.tasks.map((task) => (
        <Text key={task} className="text-muted-foreground text-sm">
          • {task}
        </Text>
      ))}
      <Text className="text-foreground text-sm">
        {plan.expected_kwh_per_month
          ? t('savings.expected', {
              value: [
                kwh(plan.expected_kwh_per_month),
                plan.expected_vnd_per_month ? money(plan.expected_vnd_per_month) : null,
              ]
                .filter(Boolean)
                .join(' · '),
            })
          : t('savings.notMeasurable')}
      </Text>
      {m && (
        <View className="bg-secondary gap-1 rounded-2xl p-3">
          {m.status === 'not_enough_data' ? (
            <Text className="text-foreground text-sm">
              {t('savings.notEnough', { min: m.min_days ?? 10 })}
            </Text>
          ) : (
            <>
              {m.status === 'measuring' && (
                <Text className="text-foreground text-sm font-medium">
                  {t('savings.measuring', { day: m.trial_day, days: m.trial_days })}
                </Text>
              )}
              {m.kwh_per_month_saved != null && m.kwh_per_month_margin != null && (
                <Text className="text-foreground text-sm">
                  {t(m.kwh_per_month_saved >= 0 ? 'savings.measured' : 'savings.measuredMore', {
                    value: kwh(Math.abs(m.kwh_per_month_saved)),
                    margin: kwh(m.kwh_per_month_margin),
                  })}
                  {m.vnd_per_month_saved ? ` · ${money(m.vnd_per_month_saved)}` : ''}
                </Text>
              )}
              {m.clear === false && (
                <Text className="text-muted-foreground text-sm">{t('savings.unclear')}</Text>
              )}
              {m.status === 'measuring' && m.kwh_per_month_saved == null && (
                <Text className="text-muted-foreground text-sm">
                  {t('savings.notEnough', { min: m.min_days ?? 10 })}
                </Text>
              )}
            </>
          )}
          <Text className="text-muted-foreground text-xs">{t('savings.measureNote')}</Text>
        </View>
      )}
      {!started && (
        <ActionButton variant="tonal" busy={start.isPending} onPress={() => start.mutate()}>
          {t('savings.start')}
        </ActionButton>
      )}
      {start.error && (
        <Text accessibilityLiveRegion="polite" selectable className="text-destructive text-sm">
          {start.error.message}
        </Text>
      )}
    </Surface>
  );
}
