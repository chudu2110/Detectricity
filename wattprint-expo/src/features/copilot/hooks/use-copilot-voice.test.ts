import { act, renderHook, waitFor } from '@testing-library/react-native';

import { fetchSpeech, transcribeAudio } from '@/features/copilot/api';
import { ApiError } from '@/lib/errors';

import { useCopilotVoice } from './use-copilot-voice';

const mockRecorder = {
  uri: 'file:///recording.m4a',
  prepareToRecordAsync: jest.fn(async () => {}),
  record: jest.fn(),
  stop: jest.fn(async () => {}),
};
const mockPlayer = { replace: jest.fn(), play: jest.fn(), pause: jest.fn() };
const mockPermission = jest.fn();
const mockDelete = jest.fn();
const mockWrite = jest.fn();
const mockBytes = Uint8Array.of(4, 5, 6).buffer;

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: () => mockPermission(),
  setAudioModeAsync: async () => {},
  useAudioRecorder: () => mockRecorder,
  useAudioPlayer: () => mockPlayer,
}));
jest.mock('expo', () => ({ ...jest.requireActual('expo'), useEventListener: jest.fn() }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  File: class {
    readonly uri: string;
    readonly exists = true;
    readonly size = 3;
    constructor(...parts: string[]) {
      this.uri = parts.join('/');
    }
    create() {}
    delete = mockDelete;
    write = mockWrite;
    arrayBuffer = async () => mockBytes;
  },
}));
jest.mock('@/features/copilot/api', () => ({
  fetchSpeech: jest.fn(),
  transcribeAudio: jest.fn(),
  maxAudioBytes: 10 * 1024 * 1024,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPermission.mockResolvedValue({ granted: true });
});

it('asks for permission only on explicit action and handles microphone denial', async () => {
  mockPermission.mockResolvedValue({ granted: false });
  const { result } = await renderHook(() =>
    useCopilotVoice({ lang: 'vi', onTranscript: jest.fn() }),
  );
  expect(mockPermission).not.toHaveBeenCalled();
  await act(async () => result.current.startRecording());
  expect(mockRecorder.record).not.toHaveBeenCalled();
  expect(result.current.error).toMatchObject({ status: 403 });
});

it('submits the finished recording and removes the cache file', async () => {
  const onTranscript = jest.fn();
  jest
    .mocked(transcribeAudio)
    .mockResolvedValue({ text: 'Điện năng', language: 'vi', duration: 1 });
  const { result } = await renderHook(() => useCopilotVoice({ lang: 'vi', onTranscript }));
  await act(async () => result.current.startRecording());
  expect(result.current.recording).toBe(true);
  await act(async () => result.current.stopRecording());
  expect(result.current.recording).toBe(false);
  expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
  expect(transcribeAudio).toHaveBeenCalledWith(mockBytes, 'vi', expect.any(AbortSignal));
  expect(onTranscript).toHaveBeenCalledWith('Điện năng');
  expect(mockDelete).toHaveBeenCalledTimes(1);
});

it('discards a cancelled recording without uploading it', async () => {
  const { result } = await renderHook(() =>
    useCopilotVoice({ lang: 'vi', onTranscript: jest.fn() }),
  );
  await act(async () => result.current.startRecording());
  await act(async () => result.current.cancel());
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(transcribeAudio).not.toHaveBeenCalled();
});

it('plays authenticated response bytes from a temporary local file', async () => {
  jest.mocked(fetchSpeech).mockResolvedValue(mockBytes);
  const { result } = await renderHook(() =>
    useCopilotVoice({ lang: 'vi', onTranscript: jest.fn() }),
  );
  await act(async () => result.current.play('message-id'));
  expect(fetchSpeech).toHaveBeenCalledWith('message-id', 'vi', expect.any(AbortSignal));
  expect(mockWrite).toHaveBeenCalledWith(new Uint8Array(mockBytes));
  expect(mockPlayer.replace).toHaveBeenCalledWith(
    expect.stringMatching(/^file:\/\/\/cache\/.*\.mp3$/),
  );
  expect(result.current.playingMessageId).toBe('message-id');
  await act(async () => result.current.stopPlayback());
  expect(result.current.isPlaying).toBe(false);
  expect(mockDelete).toHaveBeenCalledTimes(1);
});

it('shows the provider error without starting playback', async () => {
  jest.mocked(fetchSpeech).mockRejectedValue(new ApiError(503, undefined, undefined));
  const { result } = await renderHook(() =>
    useCopilotVoice({ lang: 'vi', onTranscript: jest.fn() }),
  );
  await act(async () => result.current.play('message-id'));
  expect(result.current.error).toMatchObject({ status: 503 });
  expect(mockPlayer.play).not.toHaveBeenCalled();
});
