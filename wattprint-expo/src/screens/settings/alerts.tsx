import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ActionButton, Page, Pill, QueryContent, Surface } from '@/components/app-ui';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { Text } from '@/components/ui/text';
import { acknowledgeAlert } from '@/features/dashboard/api';
import { alertsQuery } from '@/features/dashboard/queries';
import type { Alert } from '@/features/dashboard/schemas';

import { SettingsBack } from './settings-back';

function useAlertCopy(alert: Alert) {
  const { t, i18n } = useTranslation();
  const { payload, kind } = alert;
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const device = alert.device?.name ?? t('notifications.device');

  switch (kind) {
    case 'longer_than_usual': {
      const { usual_min, recent_min, days } = payload;
      if (usual_min === undefined || recent_min === undefined || days === undefined) break;
      return {
        icon: 'devices' as const,
        title: t('notifications.longer.title'),
        body: t('notifications.longer.body', {
          device,
          recent: number.format(recent_min),
          usual: number.format(usual_min),
          days: number.format(days),
        }),
      };
    }
    case 'standby_high': {
      const { usual_w, recent_w, nights } = payload;
      if (usual_w === undefined || recent_w === undefined || nights === undefined) break;
      return {
        icon: 'moon' as const,
        title: t('notifications.standby.title'),
        body: t('notifications.standby.body', {
          recent: number.format(recent_w),
          usual: number.format(usual_w),
          nights: number.format(nights),
        }),
      };
    }
    case 'unexplained_load': {
      const { usual_w, watts, minutes } = payload;
      if (usual_w === undefined || watts === undefined || minutes === undefined) break;
      return {
        icon: 'bolt' as const,
        title: t('notifications.unexplained.title'),
        body: t('notifications.unexplained.body', {
          watts: number.format(watts),
          usual: number.format(usual_w),
          minutes: number.format(minutes),
        }),
      };
    }
    case 'tier_near': {
      const { tier_no, days, from_kwh, price_per_kwh } = payload;
      if (
        tier_no === undefined ||
        days === undefined ||
        from_kwh === undefined ||
        price_per_kwh === undefined
      )
        break;
      const price = new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: 'VND',
      }).format(price_per_kwh);
      return {
        icon: 'chart' as const,
        title: t(days === 0 ? 'notifications.tier.reached' : 'notifications.tier.near', {
          tier: number.format(tier_no),
        }),
        body: t(days === 0 ? 'notifications.tier.reachedBody' : 'notifications.tier.nearBody', {
          threshold: number.format(from_kwh),
          price,
          days: number.format(days),
        }),
      };
    }
  }

  return {
    icon: 'bell' as const,
    title: t('notifications.fallback'),
    body: t('notifications.fallbackBody'),
  };
}

function AlertCard({ alert }: { alert: Alert }) {
  const { t, i18n } = useTranslation();
  const { icon, title, body } = useAlertCopy(alert);
  const client = useQueryClient();
  const queryKey = alertsQuery().queryKey;
  const markSeen = useMutation({
    mutationFn: acknowledgeAlert,
    onMutate: () => client.cancelQueries({ queryKey }),
    onSuccess: () => {
      client.setQueryData(queryKey, (data: Alert[] | undefined) =>
        data?.map((item) =>
          item.id === alert.id && item.status === 'open'
            ? { ...item, status: 'acknowledged' }
            : item,
        ),
      );
    },
  });
  const date = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(alert.ts));
  const warning = alert.status === 'open' && alert.severity === 'warning';

  return (
    <Surface size="sm">
      <View className="flex-row gap-3">
        <View
          className={`h-11 w-11 items-center justify-center rounded-2xl ${warning ? 'bg-warning-soft' : 'bg-brand-soft'}`}
        >
          <AppIcon
            name={icon}
            size={22}
            className={warning ? 'text-warning-ink' : 'text-brand-ink'}
          />
        </View>
        <View className="flex-1 gap-1">
          <Text accessibilityRole="header" className="text-foreground text-base font-semibold">
            {title}
          </Text>
          <Text className="text-muted-foreground text-sm">{date}</Text>
        </View>
      </View>
      <Text className="text-foreground text-base leading-6">{body}</Text>
      {markSeen.isError && <ErrorState className="flex-none" error={markSeen.error} />}
      {alert.status === 'open' && (
        <ActionButton
          variant="tonal"
          busy={markSeen.isPending}
          onPress={() => markSeen.mutate(alert.id)}
        >
          {t(markSeen.isPending ? 'notifications.acknowledging' : 'notifications.acknowledge')}
        </ActionButton>
      )}
      {alert.status === 'acknowledged' && (
        <Pill tone="green">{t('notifications.acknowledged')}</Pill>
      )}
      {alert.status === 'resolved' && <Pill>{t('notifications.resolved')}</Pill>}
    </Surface>
  );
}

export function Alerts() {
  const { t } = useTranslation();
  const alerts = useQuery(alertsQuery());
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await alerts.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Page
      title={t('notifications.title')}
      action={<SettingsBack />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <QueryContent query={alerts}>
        {(items) =>
          items.length > 0 ? (
            items.map((item) => <AlertCard key={item.id} alert={item} />)
          ) : (
            <Surface variant="quiet">
              <EmptyState
                className="flex-none"
                title={t('notifications.empty')}
                description={t('notifications.emptyDescription')}
              />
            </Surface>
          )
        }
      </QueryContent>
    </Page>
  );
}
