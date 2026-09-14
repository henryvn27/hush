import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const modulePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'src',
  'lib',
  'recording-readiness.ts',
);
const source = fs.readFileSync(modulePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { exports: module.exports, module });

const { deriveRecordingReadiness } = module.exports;
const base = {
  isChecking: false,
  audioError: null,
  inputDevices: ['Studio Mic'],
  outputDevices: ['System Audio'],
  selectedMicrophone: null,
  selectedSystemAudio: null,
  modelState: 'ready',
  modelError: null,
};

assert.equal(deriveRecordingReadiness(base).canStart, true);

const noMicrophone = deriveRecordingReadiness({ ...base, inputDevices: [] });
assert.equal(noMicrophone.canStart, false);
assert.equal(noMicrophone.items[0].state, 'blocked');
assert.equal(noMicrophone.blockReason, 'Microphone needs attention');

const microphoneOnly = deriveRecordingReadiness({ ...base, outputDevices: [] });
assert.equal(microphoneOnly.canStart, true);
assert.equal(microphoneOnly.items[1].state, 'optional');

const missingSelectedSystemAudio = deriveRecordingReadiness({
  ...base,
  selectedSystemAudio: 'Disconnected Loopback',
});
assert.equal(missingSelectedSystemAudio.canStart, false);
assert.equal(missingSelectedSystemAudio.items[1].state, 'blocked');

const downloading = deriveRecordingReadiness({ ...base, modelState: 'downloading' });
assert.equal(downloading.canStart, false);
assert.match(downloading.blockDetail, /downloading/);

const checking = deriveRecordingReadiness({ ...base, isChecking: true });
assert.equal(checking.canStart, false);
assert.equal(checking.items.every(item => item.state === 'checking'), true);

const remoteProvider = deriveRecordingReadiness({ ...base, transcriptionProvider: 'openai' });
assert.equal(remoteProvider.items[2].label, 'Transcription');
assert.equal(remoteProvider.items[2].detail, 'The selected transcription provider is ready.');

const whisperProvider = deriveRecordingReadiness({ ...base, transcriptionProvider: 'localWhisper' });
assert.equal(whisperProvider.items[2].label, 'Local transcription');
assert.equal(whisperProvider.items[2].detail, 'The selected local Whisper model is available.');

console.log('recording-readiness tests passed');
