import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  ActionButton,
  Pill,
  QueryContent,
  SectionTitle,
  SegmentedControl,
  Surface,
} from '@/components/app-ui';
import { DisplayText } from '@/components/display-text';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { deleteGoal, saveGoal } from '@/features/dashboard/api';
import { goalQuery } from '@/features/dashboard/queries';
import type { Goal } from '@/features/dashboard/schemas';
import { formatCurrency } from '@/lib/format';
import { dashboardNumber, errorCode, parseAmount } from '@/screens/dashboard-parts';

export function GoalSection() {
  const { t } = useTranslation();
  const goal = useQuery({ ...goalQuery(), subscribed: useIsFocused() });
  const [editing, setEditing] = useState(false);
  return (
    <>
      <SectionTitle>{t('savings.goalTitle')}</SectionTitle>
      {errorCode(goal.error) === 'tariff_missing' ? (
        <Surface variant="quiet">
          <Text className="text-muted-foreground text-base">{t('savings.tariffMissing')}</Text>
        </Surface>
      ) : (
        <QueryContent query={goal}>
          {(data) =>
            editing || data === null ? (
              <GoalForm
                goal={data}
                editing={editing}
                onEdit={() => setEditing(true)}
                onDone={() => setEditing(false)}
              />
            ) : (
              <GoalProgress goal={data} onEdit={() => setEditing(true)} />
            )
          }
        </QueryContent>
      )}
    </>
  );
}

function useAmount() {
  const { t, i18n } = useTranslation();
  return (kind: Goal['kind'], value: number) =>
    kind === 'kwh'
      ? t('energy.kwh', { value: dashboardNumber(value, i18n.language) })
      : formatCurrency(value, i18n.language, 'VND');
}

function GoalProgress({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const { t, i18n } = useTranslation();
  const amount = useAmount();
  const kwh = (value: number) => t('energy.kwh', { value: dashboardNumber(value, i18n.language) });
  const share = Math.min(1, goal.used / goal.target);
  const projectedShare = goal.projected === null ? 0 : Math.min(1, goal.projected / goal.target);
  return (
    <Surface>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-muted-foreground text-sm font-medium">{t('savings.used')}</Text>
        <Pill
          tone={
            goal.status === 'over' ? 'warning' : goal.status === 'on_track' ? 'green' : 'neutral'
          }
        >
          {t(`savings.status.${goal.status}`)}
        </Pill>
      </View>
      <DisplayText className="text-foreground text-[28px] leading-9 tabular-nums">
        {t('savings.of', {
          used: amount(goal.kind, goal.used),
          target: amount(goal.kind, goal.target),
        })}
      </DisplayText>
      <View
        accessible
        accessibilityLabel={t('savings.used')}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}
        className="bg-secondary h-3 overflow-hidden rounded-full"
      >
        <View
          className="bg-primary/35 absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${projectedShare * 100}%` }}
        />
        <View
          className={`${goal.status === 'over' ? 'bg-warning-ink' : 'bg-primary'} absolute inset-y-0 left-0 rounded-full`}
          style={{ width: `${share * 100}%` }}
        />
      </View>
      {goal.projected !== null && (
        <Text className="text-muted-foreground text-sm">
          {t('savings.projected')}: {amount(goal.kind, goal.projected)}
        </Text>
      )}
      {goal.status === 'over' && goal.cut_kwh !== null && (
        <Text className="text-foreground text-base">
          {t('savings.cut', { value: kwh(goal.cut_kwh) })}
        </Text>
      )}
      {goal.left_per_day !== null && goal.left_per_day > 0 && (
        <Text className="text-muted-foreground text-sm">
          {t('savings.perDay', {
            days: goal.days_left,
            value: amount(goal.kind, goal.left_per_day),
          })}
        </Text>
      )}
      {goal.devices.length > 0 && (
        <View className="gap-2">
          <Text className="text-foreground text-sm font-semibold">{t('savings.priority')}</Text>
          {goal.devices.map((device) => (
            <View
              key={device.id}
              className="border-border flex-row flex-wrap justify-between gap-x-3 border-t pt-2"
            >
              <Text className="text-foreground text-sm">{device.name}</Text>
              <Text className="text-muted-foreground text-sm tabular-nums">
                {kwh(device.kwh)} ·{' '}
                {Intl.NumberFormat(i18n.language, {
                  style: 'percent',
                  maximumFractionDigits: 0,
                }).format(device.share)}
              </Text>
            </View>
          ))}
        </View>
      )}
      <ActionButton variant="outline" onPress={onEdit}>
        {t('savings.editGoal')}
      </ActionButton>
    </Surface>
  );
}

function GoalForm({
  goal,
  editing,
  onEdit,
  onDone,
}: {
  goal: Goal | null;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [kind, setKind] = useState<Goal['kind']>(goal?.kind ?? 'kwh');
  const [text, setText] = useState(goal ? String(goal.target) : '');
  const [submitted, setSubmitted] = useState(false);
  const target = parseAmount(text);
  const valid = Number.isFinite(target) && target > 0;
  const done = (data: Goal | null) => {
    client.setQueryData(goalQuery().queryKey, data);
    onDone();
  };
  const save = useMutation({ mutationFn: saveGoal, onSuccess: done });
  const remove = useMutation({ mutationFn: deleteGoal, onSuccess: () => done(null) });
  if (!editing && goal === null) {
    return (
      <Surface variant="quiet">
        <Text className="text-muted-foreground text-base">{t('savings.noGoal')}</Text>
        <ActionButton onPress={onEdit}>{t('savings.setGoal')}</ActionButton>
      </Surface>
    );
  }
  const busy = save.isPending || remove.isPending;
  const failure = save.error ?? remove.error;
  return (
    <Surface>
      <SegmentedControl
        value={kind}
        options={[
          { value: 'kwh', label: t('savings.unitKwh') },
          { value: 'vnd', label: t('savings.unitVnd') },
        ]}
        onChange={setKind}
      />
      <View className="gap-1.5">
        <Text className="text-foreground text-sm font-medium">
          {t('savings.targetLabel', { unit: kind === 'kwh' ? 'kWh' : 'đ' })}
        </Text>
        <Input className="bg-secondary min-h-12 rounded-xl px-3">
          <InputField
            aria-label={t('savings.targetLabel', { unit: kind === 'kwh' ? 'kWh' : 'đ' })}
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            editable={!busy}
            className="text-base"
          />
        </Input>
        {submitted && !valid && (
          <Text accessibilityLiveRegion="polite" selectable className="text-destructive text-sm">
            {t('savings.invalidTarget')}
          </Text>
        )}
        {failure && (
          <Text accessibilityLiveRegion="polite" selectable className="text-destructive text-sm">
            {errorCode(failure) === 'tariff_missing' ? t('savings.tariffMissing') : failure.message}
          </Text>
        )}
      </View>
      <ActionButton
        busy={save.isPending}
        disabled={busy}
        onPress={() => {
          setSubmitted(true);
          if (valid) save.mutate({ kind, target });
        }}
      >
        {t('savings.save')}
      </ActionButton>
      <View className="flex-row flex-wrap gap-2">
        <ActionButton variant="ghost" disabled={busy} onPress={onDone} className="flex-1">
          {t('savings.cancel')}
        </ActionButton>
        {goal !== null && (
          <ActionButton
            variant="outline"
            busy={remove.isPending}
            disabled={busy}
            onPress={() => remove.mutate()}
            className="flex-1"
          >
            {t('savings.removeGoal')}
          </ActionButton>
        )}
      </View>
    </Surface>
  );
}
