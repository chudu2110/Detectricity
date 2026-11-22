import { useEventListener } from 'expo';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchSpeech, maxAudioBytes, transcribeAudio } from '@/features/copilot/api';
import type { Language } from '@/features/copilot/schemas';
import { ApiError, ContractError, NetworkError } from '@/lib/errors';

type VoiceError = ApiError | ContractError | NetworkError;
type Operation = { kind: 'record' | 'transcribe' | 'play'; controller: AbortController };

let speechFileSequence = 0;

function removeFile(file: File | null) {
  try {
    if (file?.exists) file.delete();
  } catch {
    // The cache may already have evicted the file.
  }
}

function voiceError(error: unknown): VoiceError {
  if (
    error instanceof ApiError ||
    error instanceof NetworkError ||
    error instanceof ContractError
  ) {
    return error;
  }
  return new ApiError(503, undefined, undefined);
}

export function useCopilotVoice({
  lang,
  onTranscript,
}: {
  lang: Language;
  onTranscript: (text: string) => void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(null, { allowsExternalPlayback: false });
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<VoiceError | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const active = useRef<Operation | null>(null);
  const mounted = useRef(false);
  const recordingFile = useRef<File | null>(null);
  const speechFile = useRef<File | null>(null);

  const clearPlayback = useCallback(() => {
    const file = speechFile.current;
    speechFile.current = null;
    if (!file) return;
    try {
      player.pause();
      player.replace(null);
    } finally {
      removeFile(file);
    }
  }, [player]);

  const stopPlayback = useCallback(() => {
    if (active.current?.kind === 'play') active.current.controller.abort();
    try {
      clearPlayback();
    } catch (failure) {
      setError(voiceError(failure));
    }
    setPlayingMessageId(null);
  }, [clearPlayback]);

  useEventListener(player, 'playbackStatusUpdate', (status) => {
    if (!speechFile.current || (!status.didJustFinish && !status.error)) return;
    stopPlayback();
    if (status.error) setError(new ApiError(503, undefined, undefined));
  });

  const stopRecorder = useCallback(async () => {
    try {
      await recorder.stop();
    } finally {
      await setAudioModeAsync({ allowsRecording: false });
    }
  }, [recorder]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
      try {
        clearPlayback();
      } catch {
        // Expo can release the player during unmount.
      }
      const file = recordingFile.current;
      recordingFile.current = null;
      if (file)
        void stopRecorder()
          .catch(() => {})
          .finally(() => removeFile(file));
    };
  }, [clearPlayback, stopRecorder]);

  const run = useCallback(
    async (kind: Operation['kind'], work: (signal: AbortSignal) => Promise<void>) => {
      if (!mounted.current || active.current) return;
      const controller = new AbortController();
      active.current = { kind, controller };
      setBusy(true);
      setError(null);
      try {
        await work(controller.signal);
      } catch (failure) {
        if (!controller.signal.aborted && mounted.current) setError(voiceError(failure));
      } finally {
        active.current = null;
        if (mounted.current) setBusy(false);
      }
    },
    [],
  );

  const startRecording = () =>
    run('record', async (signal) => {
      if (recordingFile.current) return;
      stopPlayback();
      const permission = await requestRecordingPermissionsAsync();
      if (signal.aborted) return;
      if (!permission.granted) throw new ApiError(403, undefined, undefined);

      let prepared = false;
      let file: File | null = null;
      try {
        await setAudioModeAsync({ allowsRecording: true });
        if (signal.aborted) return;
        await recorder.prepareToRecordAsync();
        prepared = true;
        if (recorder.uri) file = new File(recorder.uri);
        if (signal.aborted) return;
        if (!file) throw new ContractError('Recording file unavailable', []);
        recorder.record();
        recordingFile.current = file;
        setRecording(true);
      } finally {
        if (!recordingFile.current) {
          try {
            if (prepared) await stopRecorder();
            else await setAudioModeAsync({ allowsRecording: false });
          } finally {
            removeFile(file);
          }
        }
      }
    });

  const finishRecording = useCallback(
    (upload?: (file: File, signal: AbortSignal) => Promise<void>) =>
      run('transcribe', async (signal) => {
        const file = recordingFile.current;
        if (!file) return;
        recordingFile.current = null;
        setRecording(false);
        try {
          await stopRecorder();
          if (!signal.aborted) await upload?.(file, signal);
        } finally {
          removeFile(file);
        }
      }),
    [run, stopRecorder],
  );

  const stopRecording = () =>
    finishRecording(async (file, signal) => {
      if (file.size > maxAudioBytes) throw new ApiError(413, undefined, undefined);
      const bytes = await file.arrayBuffer();
      if (signal.aborted) return;
      const { text } = await transcribeAudio(bytes, lang, signal);
      if (!signal.aborted) onTranscript(text);
    });

  const cancel = useCallback(() => {
    active.current?.controller.abort();
    stopPlayback();
    if (recordingFile.current) void finishRecording();
  }, [finishRecording, stopPlayback]);

  const play = (messageId: string) =>
    run('play', async (signal) => {
      if (recordingFile.current) return;
      clearPlayback();
      setPlayingMessageId(null);
      const bytes = await fetchSpeech(messageId, lang, signal);
      if (signal.aborted) return;
      const file = new File(
        Paths.cache,
        `copilot-speech-${Date.now()}-${++speechFileSequence}.mp3`,
      );
      speechFile.current = file;
      try {
        file.create();
        file.write(new Uint8Array(bytes));
        player.replace(file.uri);
        player.play();
        setPlayingMessageId(messageId);
      } catch (failure) {
        clearPlayback();
        throw failure;
      }
    });

  return {
    recording,
    busy,
    error,
    startRecording,
    stopRecording,
    play,
    stopPlayback,
    isPlaying: playingMessageId !== null,
    playingMessageId,
    cancel,
  };
}
