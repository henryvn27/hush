import { ArrowPathIcon, MicrophoneIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline';
import { invoke } from '@tauri-apps/api/core';
import { AppState } from '@/components/app-shell/AppState';
import { Button } from '@/components/ui/button';
import { useIsLinux } from '@/hooks/usePlatform';

interface PermissionWarningProps {
  hasMicrophone: boolean;
  hasSystemAudio: boolean;
  onRecheck: () => void;
  isRechecking?: boolean;
}

export function PermissionWarning({
  hasMicrophone,
  hasSystemAudio,
  onRecheck,
  isRechecking = false,
}: PermissionWarningProps) {
  const isLinux = useIsLinux();

  if (isLinux || (hasMicrophone && hasSystemAudio)) return null;

  const isMacOS = navigator.userAgent.includes('Mac');
  const openMicrophoneSettings = async () => {
    try {
      await invoke('open_system_settings', { preferencePane: 'Privacy_Microphone' });
    } catch (error) {
      console.error('Failed to open microphone settings:', error);
    }
  };
  const openSystemAudioSettings = async () => {
    try {
      await invoke('open_system_settings', { preferencePane: 'Privacy_ScreenCapture' });
    } catch (error) {
      console.error('Failed to open system audio settings:', error);
    }
  };

  return (
    <AppState
      kind="permission"
      compact
      className="mb-4 max-w-2xl"
      title={!hasMicrophone ? 'Microphone access is required' : 'System audio is unavailable'}
      description={!hasMicrophone
        ? 'Connect a microphone and allow Hush in System Settings before starting a recording.'
        : 'Microphone recording can continue, but computer audio will not be captured until system audio access is configured.'}
      action={
        <div className="flex flex-wrap gap-2">
          {isMacOS && !hasMicrophone && (
            <Button size="sm" onClick={openMicrophoneSettings}><MicrophoneIcon />Open microphone settings</Button>
          )}
          {isMacOS && !hasSystemAudio && (
            <Button size="sm" variant="outline" onClick={openSystemAudioSettings}><SpeakerWaveIcon />Open system audio settings</Button>
          )}
          <Button size="sm" variant="ghost" onClick={onRecheck} disabled={isRechecking}>
            <ArrowPathIcon className={isRechecking ? 'animate-spin motion-reduce:animate-none' : ''} />
            Recheck
          </Button>
        </div>
      }
    />
  );
}
