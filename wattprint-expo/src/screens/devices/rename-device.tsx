import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ActionButton, IconButton, Surface } from '@/components/app-ui';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';

export function EditDeviceButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <IconButton label={t('dataSources.renameDevice')} onPress={onPress} variant="solid">
      <AppIcon name="edit" className="text-primary-foreground" />
    </IconButton>
  );
}

export function RenameDeviceForm({
  initialName,
  initialRoom,
  onSave,
  onCancel,
  busy,
  error,
}: {
  initialName: string;
  initialRoom?: string | null;
  onSave: (name: string, room: string | null) => void;
  onCancel: () => void;
  busy: boolean;
  error: unknown;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [room, setRoom] = useState(initialRoom ?? '');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View className="bg-background/80 flex-1 justify-center px-5">
        <Surface className="gap-3">
          <Text className="text-foreground text-lg font-semibold">
            {t('dataSources.renameDevice')}
          </Text>
          <Input>
            <InputField
              accessibilityLabel={t('dataSources.plugAlias')}
              value={name}
              onChangeText={setName}
            />
          </Input>
          <Text className="text-muted-foreground text-sm">{t('dataSources.room')}</Text>
          <Input>
            <InputField
              accessibilityLabel={t('dataSources.room')}
              value={room}
              onChangeText={setRoom}
              placeholder={t('dataSources.roomPlaceholder')}
            />
          </Input>
          {error && (
            <Text className="text-destructive text-sm" accessibilityRole="alert" selectable>
              {error instanceof Error ? error.message : t('dataSources.error')}
            </Text>
          )}
          <ActionButton
            disabled={!name.trim()}
            busy={busy}
            onPress={() => onSave(name.trim(), room.trim() || null)}
          >
            {t('dataSources.saveName')}
          </ActionButton>
          <ActionButton variant="ghost" onPress={onCancel}>
            {t('dataSources.cancel')}
          </ActionButton>
        </Surface>
      </View>
    </Modal>
  );
}
