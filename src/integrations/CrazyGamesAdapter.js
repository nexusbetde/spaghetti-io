/**
 * CrazyGamesAdapter — Wrapper um die CrazyGames HTML5 SDK v2.
 *
 * Funktioniert auf 3 Ebenen:
 *  1) Auf crazygames.com: SDK ist geladen + initialisiert -> echte Ads + Lifecycle
 *  2) Auf eigenem Hosting (GitHub Pages): SDK laedt evtl. nicht oder gibt
 *     keine Ads -> alle Calls werden gracefully zu No-Ops
 *  3) Offline / SDK blockiert: window.CrazyGames undefined -> No-Ops
 *
 * Saubere try/catch um JEDEN SDK-Aufruf, damit ein SDK-Fehler nie das
 * Spiel zerschiesst.
 *
 * Docs: https://docs.crazygames.com/sdk/html5-v2/
 */
export default class CrazyGamesAdapter {
  constructor() {
    this.sdk = this.resolveSDK();
    if (this.sdk) {
      // eslint-disable-next-line no-console
      console.info('[CrazyGames] SDK verfuegbar');
    } else {
      // eslint-disable-next-line no-console
      console.info('[CrazyGames] SDK nicht verfuegbar — Game laeuft im Standalone-Modus');
    }
  }

  resolveSDK() {
    if (typeof window === 'undefined') return null;
    try {
      return window.CrazyGames?.SDK ?? null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Aktive Gameplay-Phase signalisieren — keine Ads waehrend dieser Zeit.
   */
  gameplayStart() {
    try {
      this.sdk?.game?.gameplayStart?.();
    } catch (e) {
      // ignore
    }
  }

  /**
   * Gameplay-Pause / Game Over signalisieren — Ads sind hier OK.
   */
  gameplayStop() {
    try {
      this.sdk?.game?.gameplayStop?.();
    } catch (e) {
      // ignore
    }
  }

  /**
   * 'Happy time' — wird beim Erreichen besonderer Erfolge gerufen (Highscore,
   * Boss besiegt, Rampage). Die Plattform feiert (Konfetti etc.).
   */
  happytime() {
    try {
      this.sdk?.game?.happytime?.();
    } catch (e) {
      // ignore
    }
  }

  /**
   * Rewarded-Ad — DEAKTIVIERT fuer CrazyGames Basic Launch.
   * Wird nach initialem Review/Approval wieder aktiviert.
   */
  requestRewardedAd() {
    return Promise.resolve(false);
  }

  /**
   * Midgame-Ad — DEAKTIVIERT fuer CrazyGames Basic Launch.
   * Wird nach initialem Review/Approval wieder aktiviert.
   */
  requestMidgameAd() {
    return Promise.resolve(false);
  }

  /**
   * Ist die SDK ueberhaupt aktiv (= sind Ads moeglich)?
   */
  isAvailable() {
    return !!this.sdk;
  }

  /**
   * Registriert einen Listener fuer die SDK-Settings (Mute-Audio etc.).
   * Wird sofort einmal mit dem Initial-State aufgerufen.
   *
   * @param callback - (muteAudio: boolean) => void
   */
  onMuteAudioChange(callback) {
    if (!this.sdk?.game) {
      // SDK nicht da — Initial-State immer false, kein Listener moeglich
      try { callback(false); } catch (e) {}
      return;
    }
    // Initial-State sofort liefern
    try {
      callback(!!this.sdk.game.settings?.muteAudio);
    } catch (e) {
      callback(false);
    }
    // Aenderungen abonnieren
    try {
      this.sdk.game.addSettingsChangeListener?.((settings) => {
        try { callback(!!settings?.muteAudio); } catch (e) {}
      });
    } catch (e) {
      // ignore — Listener-Registrierung fehlgeschlagen, aber wir haben den Initial-State
    }
  }
}
