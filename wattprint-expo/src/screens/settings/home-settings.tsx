import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, TextInput, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { withUniwind } from 'uniwind';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { DisplayText } from '@/components/display-text';
import { IllustratedIcon } from '@/components/illustrated-icon';
import { TactilePressable } from '@/components/tactile-pressable';
import {
  ActionButton,
  IconButton,
  Page,
  Pill,
  QueryContent,
  SectionTitle,
  Surface,
} from '@/components/app-ui';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { Text } from '@/components/ui/text';
import { updateHome } from '@/features/dashboard/api';
import {
  billHistoryQuery,
  billQuery,
  forecastQuery,
  homeQuery,
  provincesQuery,
  weatherQuery,
} from '@/features/dashboard/queries';
import type { Home, HomeUpdate } from '@/features/dashboard/schemas';

import { SettingsBack } from './settings-back';

const StyledInput = withUniwind(TextInput);

type Province = { code: string; name: string };
type Draft = {
  name: string;
  home_type: Home['home_type'];
  floor_area_m2: string;
  occupants: string;
  billing_cycle_day: string;
  province_code: Home['province_code'];
};

const homeTypes = ['apartment', 'house', 'other', null] as const;

function toDraft(home: Home): Draft {
  return {
    name: home.name,
    home_type: home.home_type,
    floor_area_m2: home.floor_area_m2 ?? '',
    occupants: home.occupants?.toString() ?? '',
    billing_cycle_day: String(home.billing_cycle_day),
    province_code: home.province_code,
  };
}

function wholeNumber(value: string, max: number) {
  return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max;
}

function parseDraft(draft: Draft, original: Draft) {
  const patch: HomeUpdate = {};
  const errors: Partial<Record<keyof Draft, string>> = {};
  if (draft.name !== original.name) {
    const name = draft.name.trim();
    if (!name || name.length > 255) errors.name = 'account.invalidName';
    else patch.name = name;
  }
  if (draft.floor_area_m2 !== original.floor_area_m2) {
    const value = draft.floor_area_m2.trim().replace(',', '.');
    if (
      value &&
      (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0 || Number(value) > 10000)
    ) {
      errors.floor_area_m2 = 'account.invalidArea';
    } else patch.floor_area_m2 = value || null;
  }
  if (draft.occupants !== original.occupants) {
    const value = draft.occupants.trim();
    if (value && !wholeNumber(value, 30)) errors.occupants = 'account.invalidOccupants';
    else patch.occupants = value ? Number(value) : null;
  }
  if (draft.billing_cycle_day !== original.billing_cycle_day) {
    const value = draft.billing_cycle_day.trim();
    if (!wholeNumber(value, 28)) errors.billing_cycle_day = 'account.invalidBillingDay';
    else patch.billing_cycle_day = Number(value);
  }
  if (draft.home_type !== original.home_type) patch.home_type = draft.home_type;
  if (draft.province_code !== original.province_code) patch.province_code = draft.province_code;
  return { patch, errors };
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-12 flex-row items-center justify-between gap-4 py-2.5">
      <Text className="text-foreground flex-1 text-base">{label}</Text>
      <Text className="text-muted-foreground max-w-[50%] text-right text-sm">{value}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  error,
  editable,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: ComponentProps<typeof StyledInput>['keyboardType'];
  error?: string;
  editable: boolean;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-foreground text-sm font-medium">{label}</Text>
      <StyledInput
        placeholderTextColorClassName="accent-muted-foreground"
        selectionColorClassName="accent-primary"
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        editable={editable}
        className="bg-secondary text-foreground min-h-12 rounded-xl px-3 py-2 text-base"
      />
      {error && (
        <Text accessibilityLiveRegion="polite" selectable className="text-destructive text-sm">
          {error}
        </Text>
      )}
    </View>
  );
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g, 'd').trim();
}

function ProvincePicker({
  value,
  onChange,
  onClose,
}: {
  value: Home['province_code'];
  onChange: (value: Home['province_code']) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const provinces = useQuery(provincesQuery());
  const reducedMotion = useReducedMotion();
  return (
    <Modal animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} visible>
      <SafeAreaView className="bg-background flex-1 gap-4 px-5 py-3">
        <SectionTitle
          action={
            <IconButton label={t('common.close')} onPress={onClose}>
              <AppIcon name="close" size={20} className="text-foreground" />
            </IconButton>
          }
        >
          {t('account.selectProvince')}
        </SectionTitle>
        <Field
          label={t('account.searchProvince')}
          value={search}
          onChangeText={setSearch}
          editable
        />
        <QueryContent query={provinces}>
          {(data) => {
            const filter = normalizeSearch(search);
            const items = data.filter((province) =>
              normalizeSearch(province.name).includes(filter),
            );
            const options = filter ? items : [{ code: null, name: t('account.notSet') }, ...items];
            return (
              <FlatList
                data={options}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(item) => item.code ?? ''}
                ListEmptyComponent={
                  <EmptyState title={t('account.provincesEmpty')} className="flex-none" />
                }
                renderItem={({ item }) => (
                  <TactilePressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: item.code === value }}
                    onPress={() => onChange(item.code)}
                    className="border-border min-h-12 flex-row items-center gap-3 border-b px-2 py-3"
                  >
                    <Text className="text-foreground flex-1 text-base">{item.name}</Text>
                    {item.code === value && (
                      <AppIcon name="check" className="text-primary-strong" size={20} />
                    )}
                  </TactilePressable>
                )}
              />
            );
          }}
        </QueryContent>
      </SafeAreaView>
    </Modal>
  );
}

function HomeEditor({
  home,
  provinces,
  onSaved,
  onCancel,
}: {
  home: Home;
  provinces?: Province[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [original] = useState(() => toDraft(home));
  const [draft, setDraft] = useState(original);
  const [pickingProvince, setPickingProvince] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: updateHome,
    onMutate: () => client.cancelQueries({ queryKey: homeQuery().queryKey }),
    onSuccess: (updated) => {
      client.setQueryData(homeQuery().queryKey, updated);
      if (updated.billing_cycle_day !== home.billing_cycle_day) {
        for (const queryKey of [
          billQuery().queryKey,
          forecastQuery().queryKey,
          billHistoryQuery().queryKey,
        ]) {
          void client.invalidateQueries({ queryKey });
        }
      }
      if (updated.province_code !== home.province_code) {
        void client.invalidateQueries({ queryKey: weatherQuery('vi').queryKey });
        void client.invalidateQueries({ queryKey: weatherQuery('en').queryKey });
      }
      onSaved();
    },
  });
  const { patch, errors } = parseDraft(draft, original);

  function setValue<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function fieldError(field: keyof Draft) {
    const key = errors[field];
    return submitted && key ? t(key) : undefined;
  }
  const editable = !save.isPending;
  const province = provinces?.find((item) => item.code === draft.province_code);
  return (
    <>
      <Surface>
        <SectionTitle>{t('account.homeDetails')}</SectionTitle>
        <Field
          label={t('account.homeName')}
          value={draft.name}
          onChangeText={(value) => setValue('name', value)}
          error={fieldError('name')}
          editable={editable}
        />
        <View className="gap-1.5">
          <Text className="text-foreground text-sm font-medium">{t('account.homeType')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {homeTypes.map((type) => {
              const selected = type === draft.home_type;
              return (
                <TactilePressable
                  key={type ?? ''}
                  disabled={!editable}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: !editable }}
                  onPress={() => setValue('home_type', type)}
                  className={`min-h-12 flex-row items-center gap-1.5 rounded-full border px-4 ${selected ? 'border-primary-strong bg-brand-soft' : 'border-glass-edge bg-glass-fill'}`}
                >
                  {selected && <AppIcon name="check" size={15} className="text-brand-ink" />}
                  <Text className={selected ? 'text-brand-ink font-semibold' : 'text-foreground'}>
                    {type ? t(`account.types.${type}`) : t('account.notSet')}
                  </Text>
                </TactilePressable>
              );
            })}
          </View>
        </View>
        <Field
          label={t('account.floorArea')}
          value={draft.floor_area_m2}
          onChangeText={(value) => setValue('floor_area_m2', value)}
          keyboardType="decimal-pad"
          error={fieldError('floor_area_m2')}
          editable={editable}
        />
        <Field
          label={t('account.occupants')}
          value={draft.occupants}
          onChangeText={(value) => setValue('occupants', value)}
          keyboardType="number-pad"
          error={fieldError('occupants')}
          editable={editable}
        />
        <View className="gap-1.5">
          <Text className="text-foreground text-sm font-medium">{t('account.province')}</Text>
          <TactilePressable
            accessibilityRole="button"
            accessibilityLabel={t('account.province')}
            accessibilityValue={{
              text: province?.name ?? draft.province_code ?? t('account.notSet'),
            }}
            accessibilityState={{ disabled: !editable }}
            disabled={!editable}
            onPress={() => setPickingProvince(true)}
            className="bg-secondary min-h-12 flex-row items-center justify-between gap-3 rounded-xl px-3 py-2"
          >
            <Text className="text-foreground flex-1 text-base">
              {province?.name ?? draft.province_code ?? t('account.selectProvince')}
            </Text>
            <AppIcon name="chevron" size={16} className="text-muted-foreground" />
          </TactilePressable>
        </View>
      </Surface>

      <Surface>
        <SectionTitle>{t('account.billing')}</SectionTitle>
        <Field
          label={t('account.billingDay')}
          value={draft.billing_cycle_day}
          onChangeText={(value) => setValue('billing_cycle_day', value)}
          keyboardType="number-pad"
          error={fieldError('billing_cycle_day')}
          editable={editable}
        />
        <Text className="text-muted-foreground text-sm">{t('account.billingHelp')}</Text>
      </Surface>

      {save.isError && <ErrorState className="flex-none" error={save.error} />}
      <View className="flex-row gap-2">
        <ActionButton variant="outline" className="flex-1" disabled={!editable} onPress={onCancel}>
          {t('account.cancel')}
        </ActionButton>
        <ActionButton
          className="flex-1"
          busy={save.isPending}
          onPress={() => {
            setSubmitted(true);
            if (Object.keys(errors).length > 0) return;
            if (Object.keys(patch).length === 0) onCancel();
            else save.mutate(patch);
          }}
        >
          {t(editable ? 'account.save' : 'account.saving')}
        </ActionButton>
      </View>
      {pickingProvince && (
        <ProvincePicker
          value={draft.province_code}
          onClose={() => setPickingProvince(false)}
          onChange={(value) => {
            setValue('province_code', value);
            setPickingProvince(false);
          }}
        />
      )}
    </>
  );
}

function HomeDetails({ home }: { home: Home }) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const provinces = useQuery({
    ...provincesQuery(),
    enabled: home.province_code !== null || editing,
  });
  const owner = home.role === 'owner';
  const province = provinces.data?.find((item) => item.code === home.province_code);

  if (editing && owner) {
    return (
      <HomeEditor
        home={home}
        provinces={provinces.data}
        onSaved={() => {
          setSaved(true);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      <Surface variant="matcha" className="flex-row items-center">
        <IllustratedIcon name="home" size={52} />
        <View className="flex-1 gap-1">
          <DisplayText
            weight="semibold"
            className="text-brand-ink text-[23px] leading-[30px] tracking-[-0.6px]"
          >
            {home.name}
          </DisplayText>
          <Text className="text-brand-ink text-sm">{t(`account.membership.${home.role}`)}</Text>
        </View>
        {owner && (
          <ActionButton
            variant="outline"
            onPress={() => {
              setSaved(false);
              setEditing(true);
            }}
          >
            {t('account.edit')}
          </ActionButton>
        )}
      </Surface>
      {saved && (
        <View accessibilityLiveRegion="polite">
          <Pill tone="green">{t('account.saved')}</Pill>
        </View>
      )}
      <Surface>
        <SectionTitle>{t('account.homeDetails')}</SectionTitle>
        <View className="divide-border divide-y">
          <Detail
            label={t('account.homeType')}
            value={home.home_type ? t(`account.types.${home.home_type}`) : t('account.notSet')}
          />
          <Detail
            label={t('account.floorArea')}
            value={
              home.floor_area_m2 === null
                ? t('account.notSet')
                : t('account.areaValue', {
                    area: new Intl.NumberFormat(i18n.language).format(Number(home.floor_area_m2)),
                  })
            }
          />
          <Detail
            label={t('account.occupants')}
            value={home.occupants?.toString() ?? t('account.notSet')}
          />
          <Detail
            label={t('account.province')}
            value={province?.name ?? home.province_code ?? t('account.notSet')}
          />
        </View>
      </Surface>
      <Surface>
        <SectionTitle>{t('account.billing')}</SectionTitle>
        <Detail
          label={t('account.billingDay')}
          value={t('account.dayOfMonth', { day: home.billing_cycle_day })}
        />
      </Surface>
      {!owner && <Text className="text-muted-foreground text-sm">{t('account.readOnly')}</Text>}
    </>
  );
}

export function HomeSettings() {
  const { t } = useTranslation();
  const home = useQuery(homeQuery());
  return (
    <Page
      title={t('account.homeSettings')}
      action={<SettingsBack />}
      keyboardShouldPersistTaps="handled"
    >
      <QueryContent query={home}>
        {(data) => <HomeDetails key={data.id} home={data} />}
      </QueryContent>
    </Page>
  );
}
