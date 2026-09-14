export type GlobeGestureMode = 'idle' | 'holding' | 'locked';

export interface GlobeGestureState {
  mode: GlobeGestureMode;
  releasePending: boolean;
}

export type GlobeGestureEvent = 'pressed' | 'released' | 'release-timeout';
export type GlobeGestureEffect = 'none' | 'start' | 'stop' | 'schedule-release' | 'cancel-release';

export interface GlobeGestureTransition {
  state: GlobeGestureState;
  effect: GlobeGestureEffect;
}

export const INITIAL_GLOBE_GESTURE_STATE: GlobeGestureState = {
  mode: 'idle',
  releasePending: false,
};

/**
 * Hold starts dictation immediately. A second press inside the release grace
 * period locks it, and the next press exits the locked mode cleanly.
 */
export function advanceGlobeGesture(
  state: GlobeGestureState,
  event: GlobeGestureEvent,
): GlobeGestureTransition {
  if (event === 'pressed') {
    if (state.mode === 'idle') {
      return { state: { mode: 'holding', releasePending: false }, effect: 'start' };
    }

    if (state.mode === 'holding' && state.releasePending) {
      return { state: { mode: 'locked', releasePending: false }, effect: 'cancel-release' };
    }

    if (state.mode === 'locked') {
      return { state: INITIAL_GLOBE_GESTURE_STATE, effect: 'stop' };
    }

    return { state, effect: 'none' };
  }

  if (event === 'released' && state.mode === 'holding' && !state.releasePending) {
    return { state: { ...state, releasePending: true }, effect: 'schedule-release' };
  }

  if (event === 'release-timeout' && state.mode === 'holding' && state.releasePending) {
    return { state: INITIAL_GLOBE_GESTURE_STATE, effect: 'stop' };
  }

  return { state, effect: 'none' };
}
