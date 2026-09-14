import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowPathIcon, CursorArrowRaysIcon, MicrophoneIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { OnboardingContainer } from '../OnboardingContainer';
import { PermissionRow } from '../shared';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { withTimeout } from '@/lib/with-timeout';

interface PermissionsStepProps {
  onComplete: () => void;
}

export function PermissionsStep({ onComplete }: PermissionsStepProps) {
  const { setPermissionStatus, setPermissionsSkipped, permissions, completeOnboarding } = useOnboarding();
  const [isPending, setIsPending] = useState(false);
  const [isTestingCapture, setIsTestingCapture] = useState(false);
  const [captureTested, setCaptureTested] = useState(false);
  const [captureTestError, setCaptureTestError] = useState<string | null>(null);
  const captureTestTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelCaptureTest = useCallback(async () => {
    if (captureTestTimeoutRef.current) {
      clearTimeout(captureTestTimeoutRef.current);
      captureTestTimeoutRef.current = null;
    }

    try {
      await invoke('cancel_recording');
    } catch (error) {
      console.warn('[PermissionsStep] Could not cancel the capture test:', error);
    } finally {
      setIsTestingCapture(false);
    }
  }, []);

  useEffect(() => () => {
    if (captureTestTimeoutRef.current) clearTimeout(captureTestTimeoutRef.current);
    void invoke('cancel_recording').catch(() => undefined);
  }, []);

  const handleCaptureTest = async () => {
    if (isTestingCapture || isPending) return;
    setCaptureTestError(null);
    setIsTestingCapture(true);

    try {
      await invoke('flow_bar_start_recording');
      setCaptureTested(true);
      captureTestTimeoutRef.current = setTimeout(() => {
        void cancelCaptureTest();
      }, 5_000);
    } catch (error) {
      setIsTestingCapture(false);
      setCaptureTestError(error instanceof Error ? error.message : 'Hush could not start the local capture test.');
    }
  };

  // Check permissions - only logs current state, doesn't auto-authorize
  // Actual permission checks are done via explicit user actions (clicking Enable)
  const checkPermissions = useCallback(async () => {
    console.log('[PermissionsStep] Current permission states:');
    console.log(`  - Microphone: ${permissions.microphone}`);
    console.log(`  - System Audio: ${permissions.systemAudio}`);
    console.log(`  - Accessibility: ${permissions.accessibility}`);
    try {
      const accessibilityGranted = await invoke<boolean>("check_accessibility_permission");
      if (accessibilityGranted) setPermissionStatus("accessibility", "authorized");
    } catch (error) {
      console.warn("[PermissionsStep] Could not check Accessibility permission:", error);
    }
    // Don't auto-set permissions based on device availability
    // Permissions should only be set after explicit user action via Enable button
  }, [permissions.microphone, permissions.systemAudio, permissions.accessibility, setPermissionStatus]);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Request microphone permission
  const handleMicrophoneAction = async () => {
    if (permissions.microphone === 'denied') {
      // Try to open system settings
      try {
        await invoke('open_system_settings');
      } catch {
        alert('Please enable microphone access in System Preferences > Security & Privacy > Microphone');
      }
      return;
    }

    setIsPending(true);
    try {
      console.log('[PermissionsStep] Triggering microphone permission...');
      const granted = await invoke<boolean>('trigger_microphone_permission');
      console.log('[PermissionsStep] Microphone permission result:', granted);

      if (granted) {
        setPermissionStatus('microphone', 'authorized');
      } else {
        // Permission was denied or dialog was dismissed
        setPermissionStatus('microphone', 'denied');
      }
    } catch (err) {
      console.error('[PermissionsStep] Failed to request microphone permission:', err);
      setPermissionStatus('microphone', 'denied');
    } finally {
      setIsPending(false);
    }
  };

  // Request system audio permission
  const handleSystemAudioAction = async () => {
    if (permissions.systemAudio === 'denied') {
      // Try to open system settings
      try {
        await invoke('open_system_settings');
      } catch {
        alert('Please enable Audio Capture in System Settings → Privacy & Security → Audio Capture');
      }
      return;
    }

    setIsPending(true);
    try {
      console.log('[PermissionsStep] Triggering Audio Capture permission...');
      // Backend creates Core Audio tap, captures audio, and verifies it's not silence
      // Returns true if permission granted and audio verified, false if denied (silence)
      const granted = await invoke<boolean>('trigger_system_audio_permission_command');
      console.log('[PermissionsStep] System audio permission result:', granted);

      if (granted) {
        setPermissionStatus('systemAudio', 'authorized');
        console.log('[PermissionsStep] Audio Capture permission verified - audio is not silence');
      } else {
        // Permission was denied (audio is silence)
        setPermissionStatus('systemAudio', 'denied');
        console.log('[PermissionsStep] Audio Capture permission denied - audio is silence');
      }
    } catch (err) {
      console.error('[PermissionsStep] Failed to request system audio permission:', err);
      setPermissionStatus('systemAudio', 'denied');
    } finally {
      setIsPending(false);
    }
  };

  const handleAccessibilityAction = async () => {
    setIsPending(true);
    try {
      const alreadyGranted = await invoke<boolean>("check_accessibility_permission");
      if (alreadyGranted) {
        setPermissionStatus("accessibility", "authorized");
        return;
      }

      const granted = await invoke<boolean>("request_accessibility_permission");
      setPermissionStatus("accessibility", granted ? "authorized" : "denied");
      if (!granted) {
        await invoke("open_system_settings", { preferencePane: "Privacy_Accessibility" });
      }
    } catch (error) {
      console.error("[PermissionsStep] Failed to request Accessibility permission:", error);
      setPermissionStatus("accessibility", "denied");
    } finally {
      setIsPending(false);
    }
  };

  const handleFinish = async () => {
    if (isPending) return;

    setIsPending(true);
    try {
      await withTimeout(
        completeOnboarding(),
        'Setup is taking longer than expected. Please try again.',
        15_000,
      );
      onComplete();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      toast.error('Could not finish setup', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleSkip = async () => {
    await handleFinish();
    setPermissionsSkipped(true);
  };

  const allPermissionsGranted =
    permissions.microphone === 'authorized' &&
    permissions.systemAudio === 'authorized';

  return (
    <OnboardingContainer
      title="Let Hush hear the meeting."
      description="Allow microphone and system-audio access before local capture. Accessibility enables automatic insertion where you were typing."
      step={4}
      hideProgress={true}
      showNavigation={allPermissionsGranted}
      canGoNext={allPermissionsGranted}
    >
      <div className="max-w-[680px]">
        {/* Permission Rows */}
        <div className="divide-y divide-border border-y border-border">
          {/* Microphone */}
          <PermissionRow
            icon={<MicrophoneIcon />}
            title="Microphone"
            description="Required to capture your voice during meetings"
            status={permissions.microphone}
            isPending={isPending}
            onAction={handleMicrophoneAction}
          />

          {/* System Audio */}
          <PermissionRow
            icon={<SpeakerWaveIcon />}
            title="System Audio"
            description="Click Enable to grant Audio Capture permission"
            status={permissions.systemAudio}
            isPending={isPending}
            onAction={handleSystemAudioAction}
          />

          {/* Accessibility is optional but makes focused-app insertion automatic. */}
          <PermissionRow
            icon={<CursorArrowRaysIcon />}
            title="Accessibility"
            description="Allows Hush to insert finished dictation where you were typing"
            status={permissions.accessibility}
            isPending={isPending}
            onAction={handleAccessibilityAction}
          />
        </div>

        <div className="mt-8 border-y border-border py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-[470px]">
              <p className="text-[13px] font-medium text-foreground">Try it yourself</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                Speak for five seconds to verify that Hush can hear you and start its local engine before you leave setup.
              </p>
            </div>
            <Button
              variant={isTestingCapture ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => void (isTestingCapture ? cancelCaptureTest() : handleCaptureTest())}
              disabled={!allPermissionsGranted || isPending}
              className="shrink-0"
            >
              {isTestingCapture ? 'Cancel test' : captureTested ? 'Test again' : 'Start test'}
            </Button>
          </div>
          {isTestingCapture && (
            <div className="mt-4 flex items-center gap-2 text-[11px] text-foreground" role="status">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              Listening locally. Say a short sentence.
            </div>
          )}
          {captureTested && !isTestingCapture && !captureTestError && (
            <p className="mt-3 text-[11px] text-emerald-600 dark:text-emerald-400" role="status">
              Capture is ready. Your test audio was discarded.
            </p>
          )}
          {captureTestError && (
            <p className="mt-3 text-[11px] leading-5 text-destructive" role="alert">
              {captureTestError}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
          <Button onClick={handleFinish} disabled={!allPermissionsGranted || isPending} className="h-9">
            {isPending && <ArrowPathIcon className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {isPending ? 'Finishing setup…' : 'Finish Setup'}
          </Button>

          <button
            onClick={handleSkip}
            disabled={isPending}
            className="rounded-sm text-[12px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            I&apos;ll do this later
          </button>

          {!allPermissionsGranted && (
            <p className="basis-full text-[11px] leading-5 text-muted-foreground">
              Recording won&apos;t work without permissions. You can grant them later in settings.
            </p>
          )}
        </div>
      </div>
    </OnboardingContainer>
  );
}
