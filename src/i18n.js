/**
 * Minimal i18n helper.
 *
 * - Language is auto-detected from navigator.language at module load.
 * - Falls back to English for any locale that is not in `messages`.
 * - All user-facing strings in the game go through t().
 *
 * To add a language: add the locale code as a key in `messages` with the same
 * keys as `messages.en`. Missing keys fall back to English automatically.
 */

const messages = {
  en: {
    // Tutorial
    tutorial_title: 'How to Play',
    tutorial_move: 'Move to steer',
    tutorial_boost: 'Hold for boost',
    tutorial_mobile_move: 'Drag anywhere to steer',
    tutorial_mobile_boost: 'Hold the button for boost',
    tutorial_continue: 'Got it!',
    // HUD
    hud_score: 'Score',
    hud_length: 'Length',
    hud_boost_label: 'BOOST!',
    // Goal banner
    goal_eat: 'Eat meatballs to grow!',
    goal_golden: 'Golden meatballs give bonus points!',
    // Boost button
    boost_button_label: 'BOOST'
  },
  de: {
    tutorial_title: 'Steuerung',
    tutorial_move: 'Bewegen zum Lenken',
    tutorial_boost: 'Halten fuer Boost',
    tutorial_mobile_move: 'Wischen zum Lenken',
    tutorial_mobile_boost: 'Knopf halten fuer Boost',
    tutorial_continue: 'Los gehts!',
    hud_score: 'Score',
    hud_length: 'Laenge',
    hud_boost_label: 'BOOST!',
    goal_eat: 'Friss Fleischbaellchen zum Wachsen!',
    goal_golden: 'Goldene Baellchen geben Bonuspunkte!',
    boost_button_label: 'BOOST'
  }
};

function detectLanguage() {
  const raw = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  const code = raw.slice(0, 2).toLowerCase();
  return messages[code] ? code : 'en';
}

const currentLang = detectLanguage();

/**
 * Translate a key into the detected language.
 * Falls back to English, then to the key itself.
 */
export function t(key) {
  return messages[currentLang][key] ?? messages.en[key] ?? key;
}

/**
 * Returns the active 2-letter language code.
 */
export function getLanguage() {
  return currentLang;
}
