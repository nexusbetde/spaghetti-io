/**
 * Device-related helpers.
 */

/**
 * Heuristic: does this device primarily use touch input?
 * Mobile detection is hard and never perfect — these heuristics catch the
 * vast majority of phones and tablets. Hybrid devices (Surface, iPad with
 * mouse) may report touch even when a mouse is connected; that is acceptable
 * because the touch UI is non-blocking on desktop.
 */
export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (navigator.maxTouchPoints ?? 0) > 0 ||
    (navigator.msMaxTouchPoints ?? 0) > 0
  );
}

/**
 * Persistent flag for "has the user seen the tutorial".
 * Wrapped in try/catch because localStorage can throw in private mode.
 */
const TUTORIAL_FLAG = 'spaghetti-io.tutorialShown';

export function hasSeenTutorial() {
  try {
    return localStorage.getItem(TUTORIAL_FLAG) === '1';
  } catch (e) {
    return false;
  }
}

export function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_FLAG, '1');
  } catch (e) {
    // Storage disabled — tutorial will show again next time, which is fine.
  }
}
