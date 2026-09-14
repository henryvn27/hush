import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('native QA modes isolate data and never auto-start model downloads', async () => {
  const [mode, layout, onboarding, downloadStep, paginatedTranscripts] = await Promise.all([
    readFile(new URL('src/lib/native-qa-mode.ts', root), 'utf8'),
    readFile(new URL('src/app/layout.tsx', root), 'utf8'),
    readFile(new URL('src/contexts/OnboardingContext.tsx', root), 'utf8'),
    readFile(new URL('src/components/onboarding/steps/DownloadProgressStep.tsx', root), 'utf8'),
    readFile(new URL('src/hooks/usePaginatedTranscripts.ts', root), 'utf8'),
  ]);

  assert.match(mode, /NEXT_PUBLIC_MEETILY_NATIVE_QA_MODE/);
  assert.match(mode, /'meeting-error'/);
  assert.match(mode, /openMeetingErrorForNativeQa/);
  assert.match(layout, /bypassOnboardingForNativeQa/);
  assert.match(layout, /window\.location\.replace\('\/meeting-details'\)/);
  assert.match(onboarding, /initializeNativeQaDatabase/);
  assert.match(onboarding, /never scan or import a person's legacy Meetily data/);
  assert.equal((downloadStep.match(/if \(isNativeQaMode\) return;/g) ?? []).length, 1);
  assert.doesNotMatch(downloadStep, /summaryDownloadStartedRef|startSummaryDownload\s*=|summaryModel:\s*selectedSummaryModel/);
  assert.match(downloadStep, /includeSummary:\s*false/);
  assert.match(paginatedTranscripts, /if \(!meetingId\) \{\s*reset\(\);[\s\S]*setIsLoading\(false\);/);
});
