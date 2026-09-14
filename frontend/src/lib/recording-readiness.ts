export type ReadinessState = 'checking' | 'ready' | 'optional' | 'blocked' | 'error';

export interface RecordingReadinessItem {
  id: 'microphone' | 'system-audio' | 'transcription';
  label: string;
  state: ReadinessState;
  detail: string;
}

export interface RecordingReadiness {
  items: RecordingReadinessItem[];
  canStart: boolean;
  blockReason: string | null;
  blockDetail: string | null;
}

export interface RecordingReadinessInput {
  isChecking: boolean;
  audioError: string | null;
  inputDevices: string[];
  outputDevices: string[];
  selectedMicrophone: string | null;
  selectedSystemAudio: string | null;
  modelState: 'checking' | 'ready' | 'downloading' | 'missing' | 'error';
  modelError: string | null;
}

function selectedDeviceDetail(selected: string | null, fallback: string): string {
  return selected ? selected : fallback;
}

export function deriveRecordingReadiness(input: RecordingReadinessInput): RecordingReadiness {
  if (input.isChecking) {
    return {
      items: [
        { id: 'microphone', label: 'Microphone', state: 'checking', detail: 'Checking available input devices...' },
        { id: 'system-audio', label: 'System audio', state: 'checking', detail: 'Checking available output capture...' },
        { id: 'transcription', label: 'Local transcription', state: 'checking', detail: 'Checking the configured local model...' },
      ],
      canStart: false,
      blockReason: 'Checking recording setup',
      blockDetail: 'Hush is reading local devices and model availability.',
    };
  }

  const microphoneMatches = input.selectedMicrophone
    ? input.inputDevices.includes(input.selectedMicrophone)
    : input.inputDevices.length > 0;
  const systemAudioMatches = input.selectedSystemAudio
    ? input.outputDevices.includes(input.selectedSystemAudio)
    : true;

  const microphone: RecordingReadinessItem = input.audioError
    ? {
        id: 'microphone',
        label: 'Microphone',
        state: 'error',
        detail: `Hush could not read audio devices: ${input.audioError}`,
      }
    : microphoneMatches
      ? {
          id: 'microphone',
          label: 'Microphone',
          state: 'ready',
          detail: selectedDeviceDetail(input.selectedMicrophone, 'A default input device is available.'),
        }
      : {
          id: 'microphone',
          label: 'Microphone',
          state: 'blocked',
          detail: input.selectedMicrophone
            ? `${input.selectedMicrophone} is not currently available.`
            : 'No input device was reported. Connect a microphone or grant audio access.',
        };

  const systemAudio: RecordingReadinessItem = input.audioError
    ? {
        id: 'system-audio',
        label: 'System audio',
        state: 'error',
        detail: 'Output capture availability could not be verified.',
      }
    : !systemAudioMatches
      ? {
          id: 'system-audio',
          label: 'System audio',
          state: 'blocked',
          detail: `${input.selectedSystemAudio} is not currently available.`,
        }
      : input.outputDevices.length > 0
        ? {
            id: 'system-audio',
            label: 'System audio',
            state: 'ready',
            detail: selectedDeviceDetail(input.selectedSystemAudio, 'A default output capture device is available.'),
          }
        : {
            id: 'system-audio',
            label: 'System audio',
            state: 'optional',
            detail: 'Unavailable. Microphone-only recording can still start.',
          };

  const transcription: RecordingReadinessItem = (() => {
    switch (input.modelState) {
      case 'ready':
        return {
          id: 'transcription',
          label: 'Local transcription',
          state: 'ready',
          detail: 'A local Parakeet model is available.',
        };
      case 'downloading':
        return {
          id: 'transcription',
          label: 'Local transcription',
          state: 'blocked',
          detail: 'The transcription model is still downloading.',
        };
      case 'missing':
        return {
          id: 'transcription',
          label: 'Local transcription',
          state: 'blocked',
          detail: 'Download a transcription model before recording.',
        };
      case 'error':
        return {
          id: 'transcription',
          label: 'Local transcription',
          state: 'error',
      detail: input.modelError || 'Hush could not verify the local transcription model.',
        };
      case 'checking':
      default:
        return {
          id: 'transcription',
          label: 'Local transcription',
          state: 'checking',
          detail: 'Checking the configured local model...',
        };
    }
  })();

  const items = [microphone, systemAudio, transcription];
  const blocker = items.find(item => item.state === 'blocked' || item.state === 'error' || item.state === 'checking');

  return {
    items,
    canStart: !blocker,
    blockReason: blocker ? `${blocker.label} needs attention` : null,
    blockDetail: blocker?.detail || null,
  };
}
