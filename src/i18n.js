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
    boost_button_label: 'BOOST',
    // Start hint (shown until player makes first move)
    start_hint_desktop: 'Move your mouse to play',
    start_hint_mobile: 'Drag your finger to play',
    // Leaderboard + multi-snake
    hud_leaderboard: 'LEADERBOARD',
    you: 'You',
    kill_bonus: 'Kill bonus',
    stats_kills: 'Kills',
    stats_eaten: 'Eaten',
    stats_time: 'Time',
    game_over_title: 'FINITO!',
    game_over_died_wall: 'You hit the wall!',
    game_over_died_self: 'You bit yourself!',
    game_over_died_snake: 'You ran into another spaghetti!',
    game_over_score: 'Score',
    game_over_length: 'Length',
    game_over_best: 'Best',
    game_over_new_best: 'NEW BEST!',
    game_over_play_again: 'Play Again'
  },
  de: {
    tutorial_title: 'Steuerung',
    tutorial_move: 'Bewegen zum Lenken',
    tutorial_boost: 'Halten für Boost',
    tutorial_mobile_move: 'Wischen zum Lenken',
    tutorial_mobile_boost: 'Knopf halten für Boost',
    tutorial_continue: 'Los geht\'s!',
    hud_score: 'Score',
    hud_length: 'Länge',
    hud_boost_label: 'BOOST!',
    goal_eat: 'Friss Fleischbällchen zum Wachsen!',
    goal_golden: 'Goldene Bällchen geben Bonuspunkte!',
    boost_button_label: 'BOOST',
    start_hint_desktop: 'Bewege die Maus zum Spielen',
    start_hint_mobile: 'Wische mit dem Finger zum Spielen',
    hud_leaderboard: 'BESTENLISTE',
    you: 'Du',
    kill_bonus: 'Kill-Bonus',
    stats_kills: 'Kills',
    stats_eaten: 'Gegessen',
    stats_time: 'Zeit',
    game_over_title: 'FINITO!',
    game_over_died_wall: 'Du bist in die Wand gerannt!',
    game_over_died_self: 'Du hast dich selbst gebissen!',
    game_over_died_snake: 'Du bist in eine andere Spaghetti gerannt!',
    game_over_score: 'Score',
    game_over_length: 'Länge',
    game_over_best: 'Bestleistung',
    game_over_new_best: 'NEUER REKORD!',
    game_over_play_again: 'Nochmal spielen'
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
