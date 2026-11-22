import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Href,
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { AmbientBackdrop, GlassSurface } from '@/components/glass-surface';
import { IllustratedIcon } from '@/components/illustrated-icon';
import { DisplayText } from '@/components/display-text';
import { TactilePressable } from '@/components/tactile-pressable';
import { useDockInset } from '@/hooks/use-dock-inset';
import { AppIcon } from '@/components/app-icon';
import {
  ActionButton,
  BrandMark,
  IconButton,
  PageHeader,
  Pill,
  QueryContent,
  Surface,
} from '@/components/app-ui';
import { Text } from '@/components/ui/text';
import {
  deleteConversation,
  setFeedback,
  streamChat,
  updateConversation,
} from '@/features/copilot/api';
import { useCopilotVoice } from '@/features/copilot/hooks/use-copilot-voice';
import { SavingsPlan } from '@/features/copilot/components/savings-plan';
import { conversationListQuery, conversationQuery, copilotKeys } from '@/features/copilot/queries';
import type { Message, Reply } from '@/features/copilot/schemas';
import { AssistantActivity, AssistantOrb } from './assistant-motion';

const Input = withUniwind(TextInput);
const welcomeEntrance = FadeIn.duration(240).reduceMotion(ReduceMotion.System);
const replyEntrance = FadeIn.duration(160).reduceMotion(ReduceMotion.System);
const nativeSources: Record<string, Href> = {
  '/dashboard/statistics': '/(app)/(energy)/energy',
  '/dashboard/devices': '/(app)/(devices)/devices',
  '/dashboard/bill': '/(app)/(energy)/energy',
  '/dashboard/settings': '/(app)/(settings)/home',
};

export function AssistantScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'vi';
  const params = useLocalSearchParams<{ question?: string }>();
  const insets = useSafeAreaInsets();
  const dockInset = useDockInset();
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  const router = useRouter();
  const client = useQueryClient();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const composer = useRef<ComponentRef<typeof Input>>(null);
  const controller = useRef<AbortController | null>(null);
  const [input, setInput] = useState(params.question ?? '');
  const [previousQuestion, setPreviousQuestion] = useState(params.question);
  if (params.question !== previousQuestion) {
    setPreviousQuestion(params.question);
    setInput(params.question ?? '');
  }
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamText, setStreamText] = useState('');
  const [step, setStep] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [history, setHistory] = useState(false);
  const conversations = useQuery({ ...conversationListQuery(), enabled: history });
  const voice = useCopilotVoice({ lang, onTranscript: setInput });

  useEffect(() => () => controller.current?.abort(), []);
  const cancelVoice = voice.cancel;
  useFocusEffect(useCallback(() => () => cancelVoice(), [cancelVoice]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') cancelVoice();
    });
    return () => listener.remove();
  }, [cancelVoice]);

  async function send(question = input) {
    const text = question.trim();
    if (!text || busy || voice.recording || voice.busy) return;
    Keyboard.dismiss();
    const abort = new AbortController();
    controller.current = abort;
    setError(false);
    setBusy(true);
    setInput('');
    setStreamText('');
    setStep('');
    setMessages((items) => [
      ...items,
      {
        id: `local-${Date.now()}`,
        role: 'user',
        content: text,
        reply: null,
        feedback: null,
        created_at: new Date().toISOString(),
      },
    ]);
    let activeId = conversationId;
    let replyId = '';
    let finalReply: Reply | null = null;
    try {
      finalReply = await streamChat(
        { question: text, conversation_id: conversationId, lang },
        (event) => {
          if (event.event === 'meta') {
            activeId = event.data.conversation_id;
            replyId = event.data.message_id;
            setConversationId(activeId);
          }
          if (event.event === 'token') setStreamText((value) => value + event.data.text);
          if (event.event === 'step') setStep(event.data.label);
        },
        abort.signal,
      );
    } catch {
      if (!abort.signal.aborted) {
        setError(true);
        setInput(text);
      }
    } finally {
      const completed = finalReply;
      if (completed)
        setMessages((items) => [
          ...items,
          {
            id: replyId,
            role: 'assistant',
            content: completed.text,
            reply: completed,
            feedback: null,
            created_at: new Date().toISOString(),
          },
        ]);
      setBusy(false);
      setStep('');
      setStreamText('');
      if (activeId) void client.invalidateQueries({ queryKey: copilotKeys.detail(activeId) });
      void client.invalidateQueries({ queryKey: copilotKeys.list() });
      controller.current = null;
    }
  }
  function newChat() {
    if (busy) return;
    voice.cancel();
    setConversationId(null);
    setMessages([]);
    setInput('');
    setStreamText('');
    setError(false);
    setHistory(false);
  }
  function draftQuestion(question: string) {
    setInput(question);
    composer.current?.focus();
  }
  async function feedback(message: Message, value: 'up' | 'down') {
    try {
      const next = message.feedback === value ? null : value;
      await setFeedback(message.id, next);
      setMessages((items) =>
        items.map((item) => (item.id === message.id ? { ...item, feedback: next } : item)),
      );
    } catch {
      setError(true);
    }
  }
  function openSource(url: string) {
    if (nativeSources[url]) router.push(nativeSources[url]);
    else if (/^https:\/\//i.test(url)) void Linking.openURL(url).catch(() => setError(true));
  }

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ paddingTop: insets.top }}
    >
      <AmbientBackdrop />
      <View className="px-5">
        <PageHeader
          title={t('assistant.title')}
          eyebrow="DETECTRICITY"
          action={
            <View className="flex-row gap-1">
              <IconButton
                label={t('assistant.history')}
                disabled={busy}
                onPress={() => setHistory(true)}
              >
                <AppIcon name="history" />
              </IconButton>
              <IconButton label={t('assistant.new')} disabled={busy} onPress={newChat}>
                <AppIcon name="plus" />
              </IconButton>
            </View>
          }
        />
      </View>
      <ScrollView
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (messages.length || busy || error || voice.error)
            scroll.current?.scrollToEnd({ animated: !reducedMotion });
        }}
      >
        {messages.length === 0 && !busy && (
          <Animated.View entering={welcomeEntrance} className="gap-4">
            <Surface variant="matcha" size="lg">
              <View className="flex-row items-center gap-3">
                <DisplayText
                  accessibilityRole="header"
                  className="text-brand-ink flex-1 text-[34px] leading-[40px] tracking-[-1.2px]"
                >
                  {t('assistant.welcome')}
                </DisplayText>
                <AssistantOrb active={focused && !history && !voice.recording} />
              </View>
              <Text className="text-brand-ink text-[16px] leading-6">{t('assistant.intro')}</Text>
            </Surface>
            <DisplayText
              accessibilityRole="header"
              className="text-foreground text-[22px] leading-7 tracking-[-0.5px]"
            >
              {t('assistant.try')}
            </DisplayText>
            <GlassSurface className="px-3 py-1" radius={24}>
              {['bill', 'devices', 'save'].map((key, index) => {
                const question = t(`assistant.prompts.${key}`);
                const selected = input === question;
                return (
                  <TactilePressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={question}
                    accessibilityHint={t('assistant.draftHint')}
                    accessibilityState={{ selected }}
                    disabled={voice.busy || voice.recording}
                    onPress={() => draftQuestion(question)}
                    className={
                      index > 0
                        ? 'border-glass-edge min-h-16 flex-row items-center gap-3 border-t py-2'
                        : 'min-h-16 flex-row items-center gap-3 py-2'
                    }
                  >
                    <IllustratedIcon
                      name={key === 'devices' ? 'plug' : key === 'save' ? 'leaf' : 'chart'}
                      size={42}
                    />
                    <Text className="text-foreground flex-1 text-[16px] leading-[23px] font-medium">
                      {question}
                    </Text>
                    <View
                      className={
                        selected
                          ? 'bg-brand-soft mr-1 h-7 w-7 items-center justify-center rounded-full'
                          : 'bg-glass-quiet mr-1 h-7 w-7 items-center justify-center rounded-full'
                      }
                    >
                      <AppIcon
                        name={selected ? 'check' : 'plus'}
                        className="text-brand-ink"
                        size={16}
                      />
                    </View>
                  </TactilePressable>
                );
              })}
            </GlassSurface>
            <Text className="text-muted-foreground text-xs leading-5">{t('assistant.note')}</Text>
          </Animated.View>
        )}
        {messages.map((message) =>
          message.role === 'user' ? (
            <Animated.View
              entering={replyEntrance}
              key={message.id}
              className="border-glass-rim/70 bg-brand-soft/75 ml-8 self-end rounded-3xl rounded-br-md border px-5 py-4"
            >
              <Text selectable className="text-brand-ink text-base leading-6">
                {message.content}
              </Text>
            </Animated.View>
          ) : (
            <Surface key={message.id}>
              <View className="flex-row items-center gap-2">
                <BrandMark size="sm" />
                <Text className="text-foreground text-sm font-semibold">Detectricity</Text>
                {message.reply && (
                  <Pill>
                    {t(
                      message.reply.tier === 'measured'
                        ? 'assistant.measured'
                        : message.reply.tier === 'estimated'
                          ? 'assistant.estimated'
                          : 'assistant.inferred',
                    )}
                  </Pill>
                )}
              </View>
              <Text selectable className="text-foreground text-base leading-7">
                {message.reply?.text ?? message.content}
              </Text>
              {message.reply?.widgets.map((widget, index) => (
                <SavingsPlan key={index} widget={widget} />
              ))}
              {!!message.reply?.sources.length && (
                <View className="gap-1">
                  <Text className="text-muted-foreground text-xs">{t('assistant.sources')}</Text>
                  {message.reply.sources.map((source, index) => (
                    <TactilePressable
                      key={`${source.url}-${index}`}
                      accessibilityRole="link"
                      onPress={() => openSource(source.url)}
                      className="border-glass-edge min-h-12 flex-row items-center gap-2 border-b py-2"
                    >
                      <Text className="text-primary-strong flex-1 text-sm font-medium leading-5">
                        {index + 1}. {source.title}
                      </Text>
                      <AppIcon name="arrow" size={16} className="text-primary-strong" />
                    </TactilePressable>
                  ))}
                </View>
              )}
              <View className="flex-row gap-2">
                <IconButton
                  label={t('assistant.helpful')}
                  onPress={() => void feedback(message, 'up')}
                >
                  <AppIcon
                    name="up"
                    className={
                      message.feedback === 'up' ? 'text-primary-strong' : 'text-muted-foreground'
                    }
                  />
                </IconButton>
                <IconButton
                  label={t('assistant.unhelpful')}
                  onPress={() => void feedback(message, 'down')}
                >
                  <AppIcon
                    name="down"
                    className={
                      message.feedback === 'down' ? 'text-primary-strong' : 'text-muted-foreground'
                    }
                  />
                </IconButton>
                <IconButton
                  label={t('assistant.listen')}
                  disabled={voice.busy}
                  onPress={() =>
                    voice.playingMessageId === message.id
                      ? voice.stopPlayback()
                      : void voice.play(message.id)
                  }
                >
                  <AppIcon name={voice.playingMessageId === message.id ? 'stop' : 'volume'} />
                </IconButton>
              </View>
              {message.id === messages.at(-1)?.id &&
                message.reply?.followUps.map((question) => (
                  <ActionButton
                    key={question}
                    variant="outline"
                    disabled={busy}
                    onPress={() => draftQuestion(question)}
                  >
                    {question}
                  </ActionButton>
                ))}
            </Surface>
          ),
        )}
        {(busy || streamText) && (
          <Surface>
            {busy && messages.length > 0 && <AssistantActivity active={focused && !history} />}
            <Text accessibilityLiveRegion="polite" className="text-foreground text-base leading-7">
              {streamText || step || t('assistant.thinking')}
            </Text>
          </Surface>
        )}
        {(error || voice.error) && (
          <Surface>
            <Text selectable accessibilityLiveRegion="polite" className="text-destructive text-sm">
              {voice.error ? t('assistant.voiceError') : t('assistant.error')}
            </Text>
          </Surface>
        )}
      </ScrollView>
      <View
        className="gap-2 px-5 pt-3"
        style={{ paddingBottom: Math.max(dockInset, insets.bottom, 12) }}
      >
        {voice.recording && (
          <View className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center gap-2">
              <AssistantActivity active={focused && !history} />
              <Text className="text-primary-strong shrink text-sm">{t('assistant.recording')}</Text>
            </View>
            <ActionButton variant="ghost" onPress={voice.cancel}>
              {t('assistant.cancel')}
            </ActionButton>
          </View>
        )}
        <GlassSurface className="flex-row items-end gap-2 p-2" radius={28}>
          <IconButton
            label={t(voice.recording ? 'assistant.finishRecording' : 'assistant.record')}
            disabled={busy || voice.busy}
            onPress={() => void (voice.recording ? voice.stopRecording() : voice.startRecording())}
          >
            <AppIcon name={voice.recording ? 'stop' : 'mic'} className="text-primary-strong" />
          </IconButton>
          <Input
            ref={composer}
            accessibilityLabel={t('assistant.input')}
            placeholder={t('assistant.placeholder')}
            placeholderTextColorClassName="accent-muted-foreground"
            selectionColorClassName="accent-primary"
            multiline
            maxLength={2000}
            editable={!busy && !voice.recording && !voice.busy}
            value={input}
            onChangeText={setInput}
            className="text-foreground max-h-36 min-h-12 flex-1 py-3 text-base"
          />
          {busy && messages.length > 0 ? (
            <IconButton
              variant="solid"
              label={t('assistant.stop')}
              onPress={() => controller.current?.abort()}
            >
              <AppIcon name="stop" size={20} className="text-primary-foreground" />
            </IconButton>
          ) : (
            <IconButton
              variant="solid"
              label={t('assistant.send')}
              disabled={!input.trim() || busy || voice.recording || voice.busy}
              onPress={() => void send()}
            >
              <AppIcon name="send" size={21} className="text-primary-foreground" />
            </IconButton>
          )}
        </GlassSurface>
      </View>
      <Modal
        visible={history}
        animationType={reducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setHistory(false)}
      >
        <View
          className="bg-background flex-1 px-5"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <AmbientBackdrop />
          <PageHeader
            title={t('assistant.history')}
            action={
              <IconButton label={t('assistant.close')} onPress={() => setHistory(false)}>
                <AppIcon name="close" />
              </IconButton>
            }
          />
          <ScrollView contentContainerClassName="gap-3 pb-6">
            {error && (
              <Text selectable className="text-destructive text-sm">
                {t('assistant.error')}
              </Text>
            )}
            <ActionButton onPress={newChat}>{t('assistant.new')}</ActionButton>
            <QueryContent query={conversations} empty={(items) => !items.length}>
              {(items) =>
                items.map((item) => (
                  <Surface key={item.id}>
                    <TactilePressable
                      accessibilityRole="button"
                      className="min-h-12 justify-center gap-1"
                      onPress={() => {
                        voice.cancel();
                        if (conversationId !== item.id) setInput('');
                        setConversationId(item.id);
                        setMessages([]);
                        setBusy(true);
                        setError(false);
                        void client
                          .query(conversationQuery(item.id))
                          .then((data) => setMessages(data.messages))
                          .catch(() => setError(true))
                          .finally(() => setBusy(false));
                        setStreamText('');
                        setHistory(false);
                      }}
                    >
                      <DisplayText weight="semibold" className="text-foreground text-xl leading-7">
                        {item.title ?? t('assistant.untitled')}
                      </DisplayText>
                      <Text className="text-muted-foreground text-sm">
                        {new Date(item.updated_at).toLocaleDateString(
                          lang === 'vi' ? 'vi-VN' : 'en-US',
                        )}
                      </Text>
                    </TactilePressable>
                    <View className="flex-row gap-2">
                      <ActionButton
                        variant="tonal"
                        onPress={() => {
                          void updateConversation(item.id, { pinned: !item.pinned })
                            .then(() => client.invalidateQueries({ queryKey: copilotKeys.list() }))
                            .catch(() => setError(true));
                        }}
                      >
                        {t(item.pinned ? 'assistant.unpin' : 'assistant.pin')}
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        onPress={() =>
                          Alert.alert(t('assistant.delete'), t('assistant.deleteConfirm'), [
                            { text: t('assistant.cancel'), style: 'cancel' },
                            {
                              text: t('assistant.delete'),
                              style: 'destructive',
                              onPress: () => {
                                void deleteConversation(item.id)
                                  .then(() => {
                                    if (conversationId === item.id) newChat();
                                    return client.invalidateQueries({
                                      queryKey: copilotKeys.list(),
                                    });
                                  })
                                  .catch(() => setError(true));
                              },
                            },
                          ])
                        }
                      >
                        {t('assistant.delete')}
                      </ActionButton>
                    </View>
                  </Surface>
                ))
              }
            </QueryContent>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
