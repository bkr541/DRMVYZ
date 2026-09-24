/**
 * Drop-marker ids that deterministically resolve to each gesture family under
 * the fixed randomness seed/track used by the HUM:N test harnesses. Event
 * randomness is keyed by the preset revision, so re-record these if it changes. The
 * Gestures vitest suite asserts these stay correct, so the real-browser
 * acceptance suite can rely on them.
 */
export const CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS = Object.freeze({
  reach: 'drop-0',
  lunge: 'drop-1',
  shock: 'drop-3',
  headGrab: 'drop-2',
} as const)
