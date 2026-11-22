import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AssistantScreen } from '.';
import { i18n } from '@/i18n';
import { streamChat } from '@/features/copilot/api';
import type { Reply } from '@/features/copilot/schemas';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));
jest.mock('@/features/copilot/api', () => ({
  streamChat: jest.fn(),
  fetchConversations: jest.fn().mockResolvedValue([]),
  setFeedback: jest.fn(),
  deleteConversation: jest.fn(),
  updateConversation: jest.fn(),
}));
const mockCancel = jest.fn();
jest.mock('@/features/copilot/hooks/use-copilot-voice', () => ({
  useCopilotVoice: () => ({
    recording: false,
    busy: false,
    error: null,
    cancel: mockCancel,
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    play: jest.fn(),
  }),
}));
jest.setTimeout(15_000);
const clients: QueryClient[] = [];
beforeEach(async () => {
  await i18n.changeLanguage('en');
  jest.clearAllMocks();
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
async function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <AssistantScreen />
    </QueryClientProvider>,
  );
}
const reply: Reply = {
  intent: 'usage',
  tier: 'inferred',
  steps: [],
  sql: null,
  text: 'Based on available household data.',
  sources: [],
  widgets: [],
  followUps: [],
};
it('sends only an explicit question and renders a completed answer with the correct evidence tier', async () => {
  jest.mocked(streamChat).mockImplementation(async (_input, onEvent) => {
    onEvent({ event: 'meta', data: { conversation_id: 'conversation', message_id: 'message' } });
    return reply;
  });
  await show();
  expect(streamChat).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText('Question for the assistant'),
    'How much energy?',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send question' }));
  expect(await screen.findByText(reply.text)).toBeTruthy();
  expect(screen.getByText('Interpretation')).toBeTruthy();
  expect(jest.mocked(streamChat).mock.calls[0][0]).toMatchObject({
    question: 'How much energy?',
    lang: 'en',
  });
});
it('does not give playback or rating actions to a failed partial answer', async () => {
  jest.mocked(streamChat).mockImplementation(async (_input, onEvent) => {
    onEvent({ event: 'token', data: { text: 'unfinished' } });
    onEvent({ event: 'error', data: { code: 'provider', message: 'failed', reply } });
    throw new Error('provider');
  });
  await show();
  await fireEvent.changeText(screen.getByLabelText('Question for the assistant'), 'Question');
  await fireEvent.press(screen.getByRole('button', { name: 'Send question' }));
  expect(
    await screen.findByText('This action could not be completed. Please try again.'),
  ).toBeTruthy();
  expect(screen.queryByText('unfinished')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Listen to answer' })).toBeNull();
});

it('loads a suggestion as an editable draft and clears it in a new conversation', async () => {
  await show();
  const suggestion = 'Which appliances use the most electricity?';
  await fireEvent.press(screen.getByRole('button', { name: suggestion }));
  expect(screen.getByLabelText('Question for the assistant').props.value).toBe(suggestion);
  expect(screen.getByRole('button', { name: 'Send question' })).toBeEnabled();
  expect(streamChat).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('assistant.new') }));
  expect(screen.getByLabelText('Question for the assistant').props.value).toBe('');
  expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled();
});

it('lets the user stop an in-flight answer from the composer', async () => {
  jest.mocked(streamChat).mockImplementation(
    (_input, _onEvent, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
  );
  await show();
  await fireEvent.changeText(screen.getByLabelText('Question for the assistant'), 'Question');
  await fireEvent.press(screen.getByRole('button', { name: 'Send question' }));
  await fireEvent.press(await screen.findByRole('button', { name: i18n.t('assistant.stop') }));
  expect(jest.mocked(streamChat).mock.calls[0][2]?.aborted).toBe(true);
  expect(await screen.findByRole('button', { name: 'Send question' })).toBeDisabled();
});
