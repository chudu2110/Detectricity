import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ActionButton, Page, SegmentedControl, Surface } from '@/components/app-ui';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  addPlug,
  importCsv,
  previewCsv,
  recordMeter,
  type DataSource,
} from '@/features/data-sources/api';
import { plugsQuery, sourceKeys, sourcesQuery } from '@/features/data-sources/queries';

type Mode = 'plug' | 'csv' | 'meter';

function ErrorText({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <Text className="text-destructive text-sm" accessibilityRole="alert" selectable>
      {error instanceof Error ? error.message : t('dataSources.error')}
    </Text>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'decimal-pad' | 'default';
}) {
  return (
    <View className="gap-2">
      <Text className="text-foreground text-sm font-semibold">{label}</Text>
      <Input>
        <InputField
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
        />
      </Input>
    </View>
  );
}

function ExistingSources({ sources }: { sources: DataSource[] }) {
  const { t } = useTranslation();
  if (!sources.length) return null;
  return (
    <Surface className="gap-3">
      <Text className="text-foreground text-lg font-semibold">{t('dataSources.existing')}</Text>
      {sources.map((source) => (
        <View key={source.id} className="border-border border-b pb-3">
          <Text className="text-foreground font-medium">{source.name}</Text>
          <Text className="text-muted-foreground text-sm">
            {source.kind === 'plug'
              ? t('dataSources.simulated')
              : source.kind === 'csv'
                ? t('dataSources.csv')
                : t('dataSources.meter')}
            {source.latest_kwh !== null ? ` · ${source.latest_kwh} kWh` : ''}
            {source.readings ? t('dataSources.readings', { count: source.readings }) : ''}
          </Text>
          {source.consumed_kwh !== null && (
            <Text className="text-primary-strong text-sm">
              {t('dataSources.total', { value: source.consumed_kwh })}
            </Text>
          )}
        </View>
      ))}
    </Surface>
  );
}

export function AddDataSource() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('plug');
  const [selectedPlug, setSelectedPlug] = useState('');
  const [plugName, setPlugName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvDevice, setCsvDevice] = useState('');
  const [meterName, setMeterName] = useState('');
  const [meterReading, setMeterReading] = useState('');
  const [meterDate, setMeterDate] = useState(new Date().toISOString().slice(0, 10));
  const [localError, setLocalError] = useState<string | null>(null);
  const [meterResult, setMeterResult] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const sources = useQuery(sourcesQuery());
  const plugs = useQuery(plugsQuery());
  const preview = useMutation({ mutationFn: previewCsv });
  const savePlug = useMutation({
    mutationFn: () => addPlug(selectedPlug, plugName.trim()),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: sourceKeys.list });
      void client.invalidateQueries({ queryKey: sourceKeys.plugs });
      void client.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  const saveCsv = useMutation({
    mutationFn: () => importCsv(csvText, csvDevice.trim() || undefined),
    onSuccess: (result) => {
      setImportResult(
        t('dataSources.importSuccess', { rows: result.rows, sources: result.sources }),
      );
      void client.invalidateQueries({ queryKey: sourceKeys.list });
    },
  });
  const saveMeter = useMutation({
    mutationFn: () =>
      recordMeter(meterName.trim(), Number(meterReading.replace(',', '.')), meterDate),
    onSuccess: (result) => {
      setMeterResult(
        result.usage_kwh === null
          ? t('dataSources.firstReading')
          : t('dataSources.meterUsage', { value: result.usage_kwh }),
      );
      setMeterReading('');
      void client.invalidateQueries({ queryKey: sourceKeys.list });
    },
  });

  async function pickCsv() {
    preview.reset();
    saveCsv.reset();
    setCsvText('');
    setFileName('');
    setCsvDevice('');
    setLocalError(null);
    setImportResult(null);
    setPicking(true);
    try {
      const selection = await File.pickFileAsync({ mimeTypes: '*/*' });
      if (selection.canceled) return;
      const file = selection.result;
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error(t('dataSources.csvOnly'));
      if (file.size > 2_000_000) throw new Error(t('dataSources.csvSize'));
      const content = await file.text();
      setCsvText(content);
      setFileName(file.name);
      setCsvDevice('');
      preview.mutate(content);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : t('dataSources.csvOpenError'));
    } finally {
      setPicking(false);
    }
  }

  return (
    <Page title={t('dataSources.title')} eyebrow={t('dataSources.eyebrow')}>
      <ActionButton variant="ghost" onPress={() => router.back()}>
        {t('dataSources.back')}
      </ActionButton>
      <Text className="text-muted-foreground text-sm">{t('dataSources.intro')}</Text>
      <SegmentedControl
        value={mode}
        options={[
          { value: 'plug', label: t('dataSources.plug') },
          { value: 'csv', label: t('dataSources.csv') },
          { value: 'meter', label: t('dataSources.meter') },
        ]}
        onChange={(value) => {
          setMode(value);
          setLocalError(null);
        }}
      />

      {mode === 'plug' && (
        <Surface className="gap-4">
          <Text className="text-foreground text-lg font-semibold">
            {t('dataSources.choosePlug')}
          </Text>
          <Text className="text-muted-foreground text-sm">{t('dataSources.plugInfo')}</Text>
          {plugs.isLoading && <Text>{t('dataSources.searching')}</Text>}
          <ErrorText error={plugs.error} />
          {plugs.data?.length === 0 && <Text>{t('dataSources.noPlugs')}</Text>}
          {plugs.data?.map((plug) => (
            <ActionButton
              key={plug.device_id}
              variant={selectedPlug === plug.device_id ? 'solid' : 'outline'}
              onPress={() => {
                setSelectedPlug(plug.device_id);
                setPlugName(plug.assigned_name ?? plug.device_name);
                savePlug.reset();
              }}
            >
              {`${plug.plug_name} · ${plug.assigned_name ?? plug.device_name} · ${plug.online ? t('dataSources.online') : t('dataSources.offline')}`}
            </ActionButton>
          ))}
          {selectedPlug !== '' && (
            <>
              <Field
                label={t('dataSources.plugAlias')}
                value={plugName}
                onChangeText={setPlugName}
                placeholder={t('dataSources.exampleMicrowave')}
              />
              <ActionButton
                disabled={!plugName.trim()}
                busy={savePlug.isPending}
                onPress={() => savePlug.mutate()}
              >
                {t('dataSources.savePlug')}
              </ActionButton>
              <ErrorText error={savePlug.error} />
              {savePlug.isSuccess && (
                <Text className="text-primary-strong">{t('dataSources.plugSaved')}</Text>
              )}
            </>
          )}
        </Surface>
      )}

      {mode === 'csv' && (
        <Surface className="gap-4">
          <Text className="text-foreground text-lg font-semibold">
            {t('dataSources.importCsv')}
          </Text>
          <Text className="text-muted-foreground text-sm">{t('dataSources.csvInfo')}</Text>
          <ActionButton variant="outline" busy={picking} onPress={() => void pickCsv()}>
            {t('dataSources.chooseCsv')}
          </ActionButton>
          {!!fileName && <Text className="text-foreground">{fileName}</Text>}
          <ErrorText error={localError ? new Error(localError) : preview.error} />
          {preview.isPending && <Text>{t('dataSources.checkingCsv')}</Text>}
          {preview.data && (
            <>
              <Text className="text-muted-foreground text-sm">
                {t('dataSources.csvSummary', {
                  rows: preview.data.rows,
                  devices: preview.data.devices.length || 1,
                })}
              </Text>
              {preview.data.devices.length > 0 && (
                <Text className="text-foreground text-sm">
                  {t('dataSources.detected', { devices: preview.data.devices.join(', ') })}
                </Text>
              )}
              {preview.data.needs_device_name && (
                <Field
                  label={t('dataSources.csvDeviceQuestion')}
                  value={csvDevice}
                  onChangeText={setCsvDevice}
                  placeholder={t('dataSources.exampleMicrowave')}
                />
              )}
              <ActionButton
                disabled={preview.data.needs_device_name && !csvDevice.trim()}
                busy={saveCsv.isPending}
                onPress={() => saveCsv.mutate()}
              >
                {t('dataSources.import')}
              </ActionButton>
            </>
          )}
          <ErrorText error={saveCsv.error} />
          {!!importResult && <Text className="text-primary-strong">{importResult}</Text>}
        </Surface>
      )}

      {mode === 'meter' && (
        <Surface className="gap-4">
          <Text className="text-foreground text-lg font-semibold">
            {t('dataSources.recordMeter')}
          </Text>
          <Text className="text-muted-foreground text-sm">{t('dataSources.meterInfo')}</Text>
          <Field
            label={t('dataSources.meterName')}
            value={meterName}
            onChangeText={setMeterName}
            placeholder={t('dataSources.exampleMeter')}
          />
          <Field
            label={t('dataSources.meterReading')}
            value={meterReading}
            onChangeText={setMeterReading}
            keyboardType="decimal-pad"
            placeholder={t('dataSources.exampleReading')}
          />
          <Field
            label={t('dataSources.meterDate')}
            value={meterDate}
            onChangeText={setMeterDate}
            placeholder="2026-11-22"
          />
          <ActionButton
            disabled={
              !meterName.trim() ||
              !/^\d{4}-\d{2}-\d{2}$/.test(meterDate) ||
              !/^\d+(?:[.,]\d+)?$/.test(meterReading)
            }
            busy={saveMeter.isPending}
            onPress={() => saveMeter.mutate()}
          >
            {t('dataSources.saveReading')}
          </ActionButton>
          <ErrorText error={saveMeter.error} />
          {!!meterResult && <Text className="text-primary-strong">{meterResult}</Text>}
        </Surface>
      )}
      <ErrorText error={sources.error} />
      {sources.data && <ExistingSources sources={sources.data} />}
    </Page>
  );
}
