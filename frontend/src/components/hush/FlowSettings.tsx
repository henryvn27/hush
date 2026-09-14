'use client';

import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowPathIcon, ArrowTopRightOnSquareIcon, BookOpenIcon, CheckCircleIcon, ExclamationTriangleIcon, KeyIcon, LockClosedIcon, MicrophoneIcon, PlusIcon, ShieldCheckIcon, SparklesIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Switch } from '@base-ui/react/switch';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { readShortcutConfig, saveShortcutConfig, type ShortcutConfig } from './ShortcutRuntime';
import { readPhraseRules, writePhraseRules, type HushPhraseRule, type HushPhraseRuleKind } from '@/lib/hush-personalization';
import { useConfig } from '@/contexts/ConfigContext';

interface FlowAudioDevice {
  name: string;
  device_type: 'Input' | 'Output';
}

interface FlowRecordingPreferences {
  save_folder: string;
  auto_save: boolean;
  file_format: string;
  preferred_mic_device: string | null;
  preferred_system_device: string | null;
}

const FLOW_LANGUAGES = [
  ['auto', 'Auto detect'],
  ['en', 'English'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['ja', 'Japanese'],
  ['zh', 'Chinese'],
] as const;

const FLOW_BAR_DISABLED_KEY = 'hush-flow-bar-disabled';
const INSERT_AT_CURSOR_KEY = 'hush-insert-at-cursor';

const PRESET_SHORTCUTS: Array<ShortcutConfig & { id: string; hint: string; keyLabel: string }> = [
  { id: 'globe', kind: 'globe', label: 'Globe / Fn', hint: 'Hold to dictate. Double-press to keep listening.', keyLabel: 'Fn' },
  { id: 'option-space', kind: 'global', label: 'Option + Space', shortcut: 'Alt+Space', hint: 'Reliable fallback on any Mac keyboard.', keyLabel: '⌥ Space' },
  { id: 'command-shift-space', kind: 'global', label: 'Command + Shift + Space', shortcut: 'Command+Shift+Space', hint: 'A dedicated three-key shortcut for busy keyboards.', keyLabel: '⌘ ⇧ Space' },
];

function shortcutDisplayFromKey(event: KeyboardEvent<HTMLButtonElement>) {
  if (!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)) return null;
  if (/^(Meta|Control|Alt|Shift)(Left|Right)$/.test(event.code)) return null;

  const modifiers = [
    event.metaKey ? 'Command' : null,
    event.ctrlKey ? 'Control' : null,
    event.altKey ? 'Alt' : null,
    event.shiftKey ? 'Shift' : null,
  ].filter(Boolean) as string[];
  const key = event.code === 'Space' ? 'Space' : event.code;
  const keyLabel = event.code === 'Space' ? 'Space' : event.code.replace(/^(Key|Digit)/, '');
  const displayModifiers = [
    event.metaKey ? '⌘' : null,
    event.ctrlKey ? '⌃' : null,
    event.altKey ? '⌥' : null,
    event.shiftKey ? '⇧' : null,
  ].filter(Boolean);

  return {
    kind: 'global' as const,
    label: `${displayModifiers.join(' ')} ${keyLabel}`,
    shortcut: [...modifiers, key].join('+'),
  };
}

export function FlowSettings() {
  const { selectedLanguage, setSelectedLanguage } = useConfig();
  const [showFlowBar, setShowFlowBar] = useState(true);
  const [insertAtCursor, setInsertAtCursor] = useState(false);
  const [shortcut, setShortcut] = useState<ShortcutConfig>(() => readShortcutConfig());
  const [isCapturingShortcut, setIsCapturingShortcut] = useState(false);
  const [isCapturingAdditionalShortcut, setIsCapturingAdditionalShortcut] = useState(false);
  const [phraseRules, setPhraseRules] = useState<HushPhraseRule[]>([]);
  const [phraseKind, setPhraseKind] = useState<HushPhraseRuleKind>('dictionary');
  const [phraseTrigger, setPhraseTrigger] = useState('');
  const [phraseReplacement, setPhraseReplacement] = useState('');
  const [audioDevices, setAudioDevices] = useState<FlowAudioDevice[]>([]);
  const [recordingPreferences, setRecordingPreferences] = useState<FlowRecordingPreferences | null>(null);
  const [isSavingMic, setIsSavingMic] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micTestError, setMicTestError] = useState<string | null>(null);
  const [accessibilityReady, setAccessibilityReady] = useState<boolean | null>(null);

  useEffect(() => {
    setShowFlowBar(window.localStorage.getItem(FLOW_BAR_DISABLED_KEY) !== 'true');
    setInsertAtCursor(window.localStorage.getItem(INSERT_AT_CURSOR_KEY) === 'true');
    setPhraseRules(readPhraseRules());

    void Promise.all([
      invoke<FlowAudioDevice[]>('get_audio_devices'),
      invoke<FlowRecordingPreferences>('get_recording_preferences'),
    ]).then(([devices, preferences]) => {
      setAudioDevices(devices.filter((device) => device.device_type === 'Input'));
      setRecordingPreferences(preferences);
    }).catch((error) => {
      console.warn('Could not load Flow capture defaults:', error);
    });
    void invoke<boolean>('check_accessibility_permission')
      .then(setAccessibilityReady)
      .catch(() => setAccessibilityReady(null));

    const handleShortcutRejected = (event: Event) => {
      const config = (event as CustomEvent<ShortcutConfig>).detail;
      if (config) setShortcut(config);
    };
    window.addEventListener('hush-shortcut-rejected', handleShortcutRejected);
    return () => window.removeEventListener('hush-shortcut-rejected', handleShortcutRejected);
  }, []);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | undefined;
    void listen<{ levels?: Array<{ device_type?: string; rms_level?: number }> }>('audio-levels', (event) => {
      const inputLevels = (event.payload.levels ?? []).filter((level) => level.device_type === 'Input');
      setMicLevel(inputLevels.reduce((highest, level) => Math.max(highest, level.rms_level ?? 0), 0));
    }).then((cleanup) => { unlisten = cleanup; });
    return () => { unlisten?.(); void invoke('stop_audio_level_monitoring').catch(() => undefined); };
  }, []);

  const handleMicTest = async () => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    if (isTestingMic) {
      await invoke('stop_audio_level_monitoring').catch(() => undefined);
      setIsTestingMic(false);
      setMicLevel(0);
      return;
    }
    const deviceName = recordingPreferences?.preferred_mic_device ?? audioDevices[0]?.name;
    if (!deviceName) {
      setMicTestError('No microphone detected. Connect one, then refresh devices.');
      return;
    }
    setMicTestError(null);
    try {
      await invoke('start_audio_level_monitoring', { deviceNames: [deviceName] });
      setIsTestingMic(true);
    } catch (error) {
      setMicTestError(error instanceof Error ? error.message : 'Hush could not open this microphone.');
      setIsTestingMic(false);
    }
  };

  const handleFlowBarChange = (enabled: boolean) => {
    setShowFlowBar(enabled);
    window.localStorage.setItem(FLOW_BAR_DISABLED_KEY, String(!enabled));
    window.dispatchEvent(new CustomEvent('hush-flow-bar-visibility', { detail: { enabled } }));
  };

  const handleInsertAtCursorChange = (enabled: boolean) => {
    setInsertAtCursor(enabled);
    window.localStorage.setItem(INSERT_AT_CURSOR_KEY, String(enabled));
  };

  const addPhraseRule = () => {
    const trigger = phraseTrigger.trim();
    const replacement = phraseReplacement.trim();
    if (!trigger || !replacement) return;
    const nextRules = [
      ...phraseRules,
      { id: `${Date.now()}-${trigger}`, kind: phraseKind, trigger, replacement },
    ];
    setPhraseRules(nextRules);
    writePhraseRules(nextRules);
    setPhraseTrigger('');
    setPhraseReplacement('');
  };

  const removePhraseRule = (id: string) => {
    const nextRules = phraseRules.filter((rule) => rule.id !== id);
    setPhraseRules(nextRules);
    writePhraseRules(nextRules);
  };

  const refreshAudioDevices = async () => {
    try {
      const devices = await invoke<FlowAudioDevice[]>('get_audio_devices');
      setAudioDevices(devices.filter((device) => device.device_type === 'Input'));
      setMicTestError(null);
    } catch (error) {
      setMicTestError(error instanceof Error ? error.message : 'Could not refresh microphone devices.');
    }
  };

  const handleMicChange = async (deviceName: string) => {
    if (!recordingPreferences) return;
    const nextPreferences = {
      ...recordingPreferences,
      preferred_mic_device: deviceName === 'default' ? null : deviceName,
    };
    setRecordingPreferences(nextPreferences);
    setIsSavingMic(true);
    try {
      await invoke('set_recording_preferences', { preferences: nextPreferences });
      toast.success('Microphone preference saved');
    } catch (error) {
      setRecordingPreferences(recordingPreferences);
      toast.error('Could not save microphone preference', {
        description: error instanceof Error ? error.message : 'Try again from Recordings settings.',
      });
    } finally {
      setIsSavingMic(false);
    }
  };

  const requestAccessibilityPermission = async () => {
    try {
      const granted = await invoke<boolean>('request_accessibility_permission');
      setAccessibilityReady(granted);
      if (granted) {
        toast.success('Automatic paste is ready');
        return;
      }
    } catch (error) {
      console.warn('Could not request Accessibility permission:', error);
    }
    await openAccessibilitySettings();
  };

  const openAccessibilitySettings = async () => {
    try {
      await invoke('open_system_settings', { preferencePane: 'Privacy_Accessibility' });
      setTimeout(() => {
        void invoke<boolean>('check_accessibility_permission').then(setAccessibilityReady).catch(() => undefined);
      }, 700);
    } catch (error) {
      toast.error('Could not open Accessibility settings', {
        description: error instanceof Error ? error.message : 'Open System Settings > Privacy & Security > Accessibility manually.',
      });
    }
  };

  const openPrivacyPolicy = async () => {
    try {
      await invoke('open_external_url', { url: 'https://github.com/henryvn27/hush#privacy-and-data-boundary' });
    } catch (error) {
      toast.error('Could not open the privacy details', {
        description: error instanceof Error ? error.message : 'Review the privacy and data boundary in the Hush repository.',
      });
    }
  };

  const chooseShortcut = (config: ShortcutConfig) => {
    setShortcut(config);
    setIsCapturingShortcut(false);
    setIsCapturingAdditionalShortcut(false);
    saveShortcutConfig(config);
  };

  const handleShortcutCapture = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const captured = shortcutDisplayFromKey(event);
    if (captured) chooseShortcut(captured);
  };

  const handleAdditionalShortcutCapture = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const captured = shortcutDisplayFromKey(event);
    if (!captured || shortcut.kind !== 'global') return;
    if (captured.shortcut === shortcut.shortcut || shortcut.shortcuts?.includes(captured.shortcut)) return;
    chooseShortcut({
      ...shortcut,
      shortcuts: [...(shortcut.shortcuts ?? []), captured.shortcut],
    });
  };

  const removeAdditionalShortcut = (binding: string) => {
    if (shortcut.kind !== 'global') return;
    chooseShortcut({
      ...shortcut,
      shortcuts: (shortcut.shortcuts ?? []).filter((item) => item !== binding),
    });
  };

  const selectedPreset = PRESET_SHORTCUTS.find((preset) => (
    preset.kind === shortcut.kind
    && (preset.kind === 'globe' || (shortcut.kind === 'global' && preset.shortcut === shortcut.shortcut))
  ));

  return (
    <section className="hush-settings-flow" aria-labelledby="flow-settings-heading">
      <div className="hush-settings-flow-header">
        <div className="hush-settings-flow-icon" aria-hidden="true"><SparklesIcon className="size-4" /></div>
        <div>
          <p className="app-eyebrow">Hush Flow</p>
          <h2 id="flow-settings-heading">Dictate from anywhere</h2>
          <p>Keep the local Flow Bar close, then use the shortcut without opening the Hub.</p>
        </div>
      </div>

      <div className="hush-settings-flow-row hush-settings-shortcut-row">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hush-settings-flow-row-icon" aria-hidden="true"><KeyIcon className="size-4" /></span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Activation key</p>
            <p className="mt-1 text-xs text-muted-foreground">Use Globe / Fn for hold-to-talk, or choose a shortcut that works on your keyboard.</p>
          </div>
        </div>
        <kbd className="hush-settings-shortcut shrink-0">{shortcut.label}</kbd>
      </div>

      <div className="hush-settings-shortcut-choices" role="group" aria-label="Activation key choices">
        {PRESET_SHORTCUTS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="hush-settings-shortcut-choice"
            data-active={selectedPreset?.id === preset.id}
            onClick={() => chooseShortcut(preset)}
          >
            <span className="hush-settings-shortcut-choice-key">{preset.keyLabel}</span>
            <span className="hush-settings-shortcut-choice-copy">
              <strong>{preset.label}</strong>
              <span>{preset.hint}</span>
            </span>
          </button>
        ))}
        <button
          type="button"
          className="hush-settings-shortcut-choice hush-settings-shortcut-capture"
          data-active={shortcut.kind === 'global' && !selectedPreset}
          onClick={() => setIsCapturingShortcut(true)}
          onKeyDown={handleShortcutCapture}
          aria-label="Record a custom keybind"
        >
          <span className="hush-settings-shortcut-choice-key">{isCapturingShortcut ? 'Press…' : 'Custom'}</span>
          <span className="hush-settings-shortcut-choice-copy">
            <strong>{isCapturingShortcut ? 'Press your keys' : 'Record a keybind'}</strong>
            <span>{isCapturingShortcut ? 'Use at least one modifier, then release.' : 'Make Hush fit your keyboard.'}</span>
          </span>
        </button>
      </div>

      {shortcut.kind === 'global' && (
        <div className="hush-settings-shortcut-alternates" aria-label="Additional activation shortcuts">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium">Additional shortcuts</p>
              <p className="mt-1 text-xs text-muted-foreground">Keep up to three alternate bindings for different keyboards.</p>
            </div>
            {(shortcut.shortcuts ?? []).length < 3 && (
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                onClick={() => setIsCapturingAdditionalShortcut(true)}
                onKeyDown={handleAdditionalShortcutCapture}
              >
                <PlusIcon className="size-3.5" aria-hidden="true" />
                {isCapturingAdditionalShortcut ? 'Press keys...' : 'Add shortcut'}
              </button>
            )}
          </div>
          {(shortcut.shortcuts ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {shortcut.shortcuts?.map((binding) => (
                <button
                  key={binding}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs text-foreground"
                  onClick={() => removeAdditionalShortcut(binding)}
                  title="Remove alternate shortcut"
                >
                  <kbd>{binding.replaceAll('+', ' + ')}</kbd>
                  <span aria-hidden="true">x</span>
                  <span className="sr-only">Remove</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="hush-settings-flow-row">
        <div>
          <p className="text-sm font-medium">Show Flow Bar</p>
          <p className="mt-1 text-xs text-muted-foreground">Keep the ambient control visible above your work.</p>
        </div>
        <Switch.Root
          nativeButton
          render={<button type="button" />}
          aria-label="Show Flow Bar"
          checked={showFlowBar}
          onCheckedChange={handleFlowBarChange}
          className="hush-base-switch"
        >
          <Switch.Thumb className="hush-base-switch-thumb" />
        </Switch.Root>
      </div>

      <div className="hush-settings-flow-row">
        <div className="min-w-0">
          <p className="text-sm font-medium">Insert into focused app</p>
          <p className="mt-1 text-xs text-muted-foreground">Paste finished local dictation where you started it. Requires macOS Accessibility permission.</p>
          {insertAtCursor && accessibilityReady !== null && (
            <p className={`mt-2 flex items-center gap-1.5 text-xs ${accessibilityReady ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--warning))]'}`} role="status">
              {accessibilityReady ? <CheckCircleIcon className="size-3.5" aria-hidden="true" /> : <ExclamationTriangleIcon className="size-3.5" aria-hidden="true" />}
              {accessibilityReady ? 'Accessibility is ready' : 'Accessibility permission needed for automatic paste'}
            </p>
          )}
          {insertAtCursor && (
            <button
              type="button"
              onClick={() => void requestAccessibilityPermission()}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-foreground"
            >
              Allow automatic paste
              <ArrowTopRightOnSquareIcon className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <Switch.Root
          nativeButton
          render={<button type="button" />}
          aria-label="Insert transcript into focused app"
          checked={insertAtCursor}
          onCheckedChange={handleInsertAtCursorChange}
          className="hush-base-switch"
        >
          <Switch.Thumb className="hush-base-switch-thumb" />
        </Switch.Root>
      </div>

      <div className="hush-settings-flow-row hush-settings-phrases">
        <div className="flex min-w-0 items-start gap-3">
          <span className="hush-settings-flow-row-icon" aria-hidden="true"><BookOpenIcon className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Your words and phrases</p>
            <p className="mt-1 text-xs text-muted-foreground">Correct names locally or expand a short trigger before text is saved or inserted.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <select
                value={phraseKind}
                onChange={(event) => setPhraseKind(event.target.value as HushPhraseRuleKind)}
                aria-label="Phrase rule type"
                className="h-9 rounded-md border border-input bg-background px-2 text-xs focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="dictionary">Dictionary</option>
                <option value="snippet">Snippet</option>
              </select>
              <input
                value={phraseTrigger}
                onChange={(event) => setPhraseTrigger(event.target.value)}
                placeholder={phraseKind === 'snippet' ? ';sig' : 'Name to correct'}
                aria-label="Phrase trigger"
                className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <input
                value={phraseReplacement}
                onChange={(event) => setPhraseReplacement(event.target.value)}
                placeholder={phraseKind === 'snippet' ? 'Full phrase' : 'Preferred spelling'}
                aria-label="Phrase replacement"
                onKeyDown={(event) => { if (event.key === 'Enter') addPhraseRule(); }}
                className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <button
                type="button"
                onClick={addPhraseRule}
                disabled={!phraseTrigger.trim() || !phraseReplacement.trim()}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PlusIcon className="size-3.5" aria-hidden="true" />
                Add
              </button>
            </div>
            {phraseRules.length > 0 && (
              <div className="mt-3 space-y-1.5" aria-label="Saved words and phrases">
                {phraseRules.map((rule) => (
                  <div key={rule.id} className="flex items-center gap-2 rounded-md border border-border/70 bg-background/70 px-2.5 py-2 text-xs">
                    <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-medium text-muted-foreground">{rule.kind === 'snippet' ? 'Snippet' : 'Word'}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{rule.trigger}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="min-w-0 max-w-[12rem] truncate text-muted-foreground">{rule.replacement}</span>
                    <button
                      type="button"
                      onClick={() => removePhraseRule(rule.id)}
                      className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Remove ${rule.trigger}`}
                      title="Remove"
                    >
                      <TrashIcon className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hush-settings-flow-row hush-settings-capture-defaults">
        <div className="flex min-w-0 items-start gap-3">
          <span className="hush-settings-flow-row-icon" aria-hidden="true"><MicrophoneIcon className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Capture defaults</p>
            <p className="mt-1 text-xs text-muted-foreground">Keep the everyday microphone and language controls within reach.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Microphone
                <select
                  value={recordingPreferences?.preferred_mic_device || 'default'}
                  onChange={(event) => void handleMicChange(event.target.value)}
                  disabled={!recordingPreferences || isSavingMic}
                  aria-label="Default microphone"
                  className="h-9 rounded-md border border-input bg-background px-2.5 text-xs font-normal text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                >
                  <option value="default">System default</option>
                  {audioDevices.map((device) => <option key={device.name} value={device.name}>{device.name}</option>)}
                </select>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleMicTest()}
                    disabled={!recordingPreferences}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MicrophoneIcon className="size-3.5" aria-hidden="true" />
                    {isTestingMic ? 'Stop test' : 'Test microphone'}
                  </button>
                  {isTestingMic && <span className="hush-mic-test-meter" aria-label="Microphone input level"><span style={{ width: String(Math.min(100, Math.round(micLevel * 100))) + '%'  }} /></span>}
                </div>
                <button
                  type="button"
                  onClick={() => void refreshAudioDevices()}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-foreground"
                  aria-label="Refresh microphone devices"
                >
                  <ArrowPathIcon className="size-3.5" aria-hidden="true" />
                  Refresh devices
                </button>
                {micTestError && <p className="mt-1.5 text-xs text-[hsl(var(--destructive))]" role="alert">{micTestError}</p>}
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Dictation language
                <select
                  value={FLOW_LANGUAGES.some(([code]) => code === selectedLanguage) ? selectedLanguage : 'auto'}
                  onChange={(event) => setSelectedLanguage(event.target.value)}
                  aria-label="Dictation language"
                  className="h-9 rounded-md border border-input bg-background px-2.5 text-xs font-normal text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  {FLOW_LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="hush-settings-flow-row">
        <div className="flex min-w-0 items-start gap-3">
          <span className="hush-settings-flow-row-icon" aria-hidden="true"><ShieldCheckIcon className="size-4" /></span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Private by default</p>
            <p className="mt-1 text-xs text-muted-foreground">Recordings, transcripts, and local models stay on this Mac. Hush does not require an account.</p>
            <button
              type="button"
              onClick={() => void openPrivacyPolicy()}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-foreground"
            >
              Review the data boundary
              <LockClosedIcon className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
