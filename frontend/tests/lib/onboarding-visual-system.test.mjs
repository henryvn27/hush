import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('onboarding uses the native setup assistant visual language', async () => {
  const files = await Promise.all([
    'src/components/onboarding/OnboardingContainer.tsx',
    'src/components/onboarding/shared/PermissionRow.tsx',
    'src/components/onboarding/shared/ProgressIndicator.tsx',
    'src/components/onboarding/steps/WelcomeStep.tsx',
    'src/components/onboarding/steps/SetupOverviewStep.tsx',
    'src/components/onboarding/steps/DownloadProgressStep.tsx',
    'src/components/onboarding/steps/PermissionsStep.tsx',
  ].map((path) => readFile(new URL(path, root), 'utf8')));

  const combined = files.join('\n');
  const [container, , progress, , , downloads] = files;

  assert.match(container, /hush-onboarding-topbar/);
  assert.match(container, /hush-onboarding-progress/);
  assert.match(container, /hush-onboarding-main/);
  assert.match(container, /PRIVATE BY DEFAULT/);
  assert.match(container, /logo-collapsed\.png/);
  assert.match(progress, /aria-current=\{isActive \? 'step'/);
  assert.match(downloads, /role="progressbar"/);
  assert.match(downloads, /aria-valuenow=\{Math\.round\(state\.progress\)\}/);
  assert.match(combined, /@heroicons\/react/);
  assert.doesNotMatch(combined, /from ['"]lucide-react['"]/);
  assert.doesNotMatch(combined, /rounded-\[3px\]/);
  assert.doesNotMatch(combined, /<svg/);
  assert.doesNotMatch(combined, /bg-(?:blue|gray|slate|white)-/);
  assert.match(downloads, /motion-reduce:animate-none/);
  assert.match(downloads, /state\.status === 'error'/);
  assert.match(downloads, /Download couldn&apos;t finish/);
  assert.match(downloads, /Try Again/);
  assert.match(downloads, /text-destructive/);
  assert.match(downloads, /disabled:cursor-not-allowed/);
});

test('native QA can open a real onboarding step without changing permissions or model state', async () => {
  const [qaMode, context] = await Promise.all([
    readFile(new URL('src/lib/native-qa-mode.ts', root), 'utf8'),
    readFile(new URL('src/contexts/OnboardingContext.tsx', root), 'utf8'),
  ]);

  assert.match(qaMode, /NEXT_PUBLIC_MEETILY_NATIVE_QA_ONBOARDING_STEP/);
  assert.match(qaMode, /nativeQaMode === 'onboarding'/);
  assert.match(context, /useState\(nativeQaOnboardingStep \?\? 1\)/);
  const completionFlow = context.slice(
    context.indexOf('const completeOnboarding'),
    context.indexOf('// Start background downloads for models.'),
  );
  const qaCompletionGuard = completionFlow.indexOf('if (isNativeQaMode)');
  const readinessProbe = completionFlow.indexOf("invoke<boolean>('builtin_ai_is_model_ready'");
  assert.ok(qaCompletionGuard > -1 && qaCompletionGuard < readinessProbe);
  assert.match(completionFlow, /Native QA completion: skipping model readiness and download preparation/);
  assert.doesNotMatch(qaMode, /trigger_microphone_permission|trigger_system_audio_permission_command|download_model/);
});

test('permissions completion exits onboarding without an unbounded reload wait', async () => {
  const [flow, permissions, layout, context] = await Promise.all([
    readFile(new URL('src/components/onboarding/OnboardingFlow.tsx', root), 'utf8'),
    readFile(new URL('src/components/onboarding/steps/PermissionsStep.tsx', root), 'utf8'),
    readFile(new URL('src/app/layout.tsx', root), 'utf8'),
    readFile(new URL('src/contexts/OnboardingContext.tsx', root), 'utf8'),
  ]);

  assert.match(flow, /<PermissionsStep onComplete=\{onComplete\}/);
  assert.match(permissions, /withTimeout\(/);
  assert.match(permissions, /15_000/);
  assert.match(permissions, /onComplete\(\)/);
  assert.match(permissions, /Finishing setup…/);
  assert.match(permissions, /Could not finish setup/);
  assert.doesNotMatch(permissions, /window\.location\.reload\(\)/);
  assert.match(layout, /setShowOnboarding\(false\)/);
  assert.match(layout, /setOnboardingCompleted\(true\)/);
  assert.ok(
    layout.indexOf('Onboarding completed, showing main app') < layout.indexOf('setShowOnboarding(false)', layout.indexOf('Onboarding completed, showing main app')),
    'completed onboarding status hides setup on relaunch',
  );
  const completionHandler = layout.slice(
    layout.indexOf('const handleOnboardingComplete'),
    layout.indexOf('\n  }', layout.indexOf('const handleOnboardingComplete')) + 4,
  );
  assert.doesNotMatch(completionHandler, /window\.location\.reload\(\)/);
  assert.match(context, /Model readiness check deferred/);
  assert.match(context, /Local model check timed out\./);
  assert.match(context, /Hush could not save setup\. Please try again\./);
  assert.ok(
    context.indexOf("invoke('complete_onboarding'") < context.indexOf("invoke<boolean>('builtin_ai_is_model_ready'", context.indexOf('const completeOnboarding')),
    'onboarding is saved before the non-blocking model readiness probe',
  );
});
