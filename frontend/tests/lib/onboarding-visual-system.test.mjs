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

  assert.match(container, /grid-cols-\[264px_minmax\(0,1fr\)\]/);
  assert.match(container, /max-\[1160px\]:grid-cols-\[232px_minmax\(0,1fr\)\]/);
  assert.match(container, /Private by default/);
  assert.match(progress, /aria-current=\{isActive \? 'step'/);
  assert.match(downloads, /role="progressbar"/);
  assert.match(downloads, /aria-valuenow=\{Math\.round\(state\.progress\)\}/);
  assert.match(combined, /@heroicons\/react/);
  assert.doesNotMatch(combined, /from ['"]lucide-react['"]/);
  assert.doesNotMatch(combined, /rounded-\[3px\]/);
  assert.doesNotMatch(combined, /<svg/);
  assert.doesNotMatch(combined, /bg-(?:blue|gray|slate|white)-/);
});
