import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';
import { ActionButton, Surface } from '@/components/app-ui';
import { Text } from '@/components/ui/text';
import { acceptPlan } from '@/features/copilot/api';

const planSchema = z.object({
  kind: z.literal('plan'),
  id: z.uuid(),
  tasks: z.array(z.object({ label: z.string(), detail: z.string() })),
  kwh: z.number(),
  vnd: z.number().nullable(),
  status: z.string(),
});
function Plan({ plan }: { plan: z.infer<typeof planSchema> }) {
  const { t, i18n } = useTranslation();
  const accept = useMutation({ mutationFn: () => acceptPlan(plan.id) });
  const active = accept.data?.status === 'accepted' || plan.status === 'accepted';
  return (
    <Surface variant="quiet">
      <Text className="text-foreground text-base font-semibold">{t('assistant.plan')}</Text>
      {plan.tasks.map((task, index) => (
        <View key={index} className="gap-1">
          <Text className="text-foreground text-sm font-medium">
            {index + 1}. {task.label}
          </Text>
          <Text className="text-muted-foreground text-sm leading-5">{task.detail}</Text>
        </View>
      ))}
      <Text className="text-muted-foreground text-sm">
        {t('assistant.planEstimate', {
          kwh: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(plan.kwh),
        })}
      </Text>
      <ActionButton
        variant="tonal"
        disabled={accept.isPending || active}
        onPress={() => accept.mutate()}
      >
        {t(active ? 'assistant.planAccepted' : 'assistant.planAccept')}
      </ActionButton>
      {accept.isError && (
        <Text selectable className="text-destructive text-sm">
          {t('assistant.error')}
        </Text>
      )}
    </Surface>
  );
}
export function SavingsPlan({ widget }: { widget: unknown }) {
  const parsed = planSchema.safeParse(widget);
  return parsed.success ? <Plan plan={parsed.data} /> : null;
}
