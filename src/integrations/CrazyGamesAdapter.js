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
   * Fordert ein Rewarded-Video an. Spieler bekommt Belohnung wenn er das
   * Video ZU ENDE schaut. Resolved zu true wenn voll geschaut, false sonst
   * (uebersprungen, Fehler, kein Inventar).
   */
  async requestRewardedAd() {
    if (!this.sdk?.ad?.requestAd) return false;
    try {
      // SDK API: requestAd nimmt den Ad-Type als String, resolved bei
      // 'adFinished' und rejected bei 'adError' / 'adStartFailed'
      await this.sdk.ad.requestAd('rewarded');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Fordert ein Midgame-Video an. Sollte zwischen Gameplay-Phasen kommen
   * (z.B. nach dem Tod, bevor Play Again).
   */
  async requestMidgameAd() {
    if (!this.sdk?.ad?.requestAd) return false;
    try {
      await this.sdk.ad.requestAd('midgame');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Ist die SDK ueberhaupt aktiv (= sind Ads moeglich)?
   */
  isAvailable() {
    return !!this.sdk;
  }
}
