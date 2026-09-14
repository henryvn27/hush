import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceGlobeGesture,
  INITIAL_GLOBE_GESTURE_STATE,
} from '../../src/lib/globe-gesture.ts';

test('Globe hold starts immediately and stops after release timeout', () => {
  const started = advanceGlobeGesture(INITIAL_GLOBE_GESTURE_STATE, 'pressed');
  assert.deepEqual(started, {
    state: { mode: 'holding', releasePending: false },
    effect: 'start',
  });

  const pending = advanceGlobeGesture(started.state, 'released');
  assert.equal(pending.effect, 'schedule-release');

  const stopped = advanceGlobeGesture(pending.state, 'release-timeout');
  assert.deepEqual(stopped, {
    state: INITIAL_GLOBE_GESTURE_STATE,
    effect: 'stop',
  });
});

test('Globe double press locks dictation and the next press exits cleanly', () => {
  const holding = advanceGlobeGesture(INITIAL_GLOBE_GESTURE_STATE, 'pressed');
  const releasePending = advanceGlobeGesture(holding.state, 'released');
  const locked = advanceGlobeGesture(releasePending.state, 'pressed');

  assert.deepEqual(locked, {
    state: { mode: 'locked', releasePending: false },
    effect: 'cancel-release',
  });

  const exited = advanceGlobeGesture(locked.state, 'pressed');
  assert.deepEqual(exited, {
    state: INITIAL_GLOBE_GESTURE_STATE,
    effect: 'stop',
  });
});

test('late release timeout cannot stop locked dictation', () => {
  const locked = { mode: 'locked', releasePending: false };
  assert.deepEqual(advanceGlobeGesture(locked, 'released'), {
    state: locked,
    effect: 'none',
  });
  assert.deepEqual(advanceGlobeGesture(locked, 'release-timeout'), {
    state: locked,
    effect: 'none',
  });
});
