/**
 * SoundManager — Procedurale Sound-Effekte via Web Audio API.
 *
 * Vorteile:
 *  - Keine externen Audio-Dateien noetig (= keine Lizenz-Fragen)
 *  - Zero Lade-Latenz
 *  - Variable Pitches/Envelopes pro Aufruf (kein "selber Sound 100x")
 *  - Funktioniert offline
 *
 * Wichtig:
 *  - Browser (besonders iOS Safari) erlauben keine Audio-Wiedergabe bevor
 *    der User irgendwas geklickt/getippt hat. unlock() ruft ctx.resume()
 *    aus einem User-Gesture-Handler heraus auf.
 *  - Alle Methoden sind no-op wenn muted oder kein AudioContext verfuegbar.
 */

const STORAGE_KEY = 'spaghetti-io.muted';

export default class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = this.loadMuted();
  }

  loadMuted() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  saveMuted() {
    try {
      localStorage.setItem(STORAGE_KEY, this.muted ? '1' : '0');
    } catch (e) {
      // ignore
    }
  }

  /**
   * Lazy-initialisiert den AudioContext. Wird beim ersten unlock() aufgerufen
   * — vorher haetten Browser sowieso 'suspended' geblockt.
   */
  ensureContext() {
    if (this.ctx) return this.ctx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.6; // Globaler Pegel
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      // No audio support — silent fallback
    }
    return this.ctx;
  }

  /**
   * Aus einer User-Geste (Klick/Tap/Tastendruck) aufrufen.
   * Holt Safari/iOS aus dem 'suspended' State raus.
   */
  unlock() {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    this.saveMuted();
  }

  isMuted() {
    return this.muted;
  }

  // ---------------------------------------------------------------------------
  // Sound-Effekte
  // ---------------------------------------------------------------------------

  /**
   * Pop beim Fressen.
   *  - Normal: 600 -> 320 Hz, Sinus, kurz
   *  - Golden: hoeher (800 -> 1200) + ein Triangle-Sparkle als Overlay
   */
  playEat(isGolden = false) {
    const ctx = this.audioReady();
    if (!ctx) return;
    const t = ctx.currentTime;
    const dest = this.masterGain;

    // Haupt-Pop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isGolden ? 800 : 600, t);
    osc.frequency.exponentialRampToValueAtTime(isGolden ? 1200 : 320, t + 0.08);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(isGolden ? 0.32 : 0.22, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.15);

    // Golden-Sparkle obendrauf
    if (isGolden) {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1800, t + 0.02);
      osc2.frequency.exponentialRampToValueAtTime(2400, t + 0.08);
      gain2.gain.setValueAtTime(0, t + 0.02);
      gain2.gain.linearRampToValueAtTime(0.14, t + 0.025);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc2.connect(gain2).connect(dest);
      osc2.start(t + 0.02);
      osc2.stop(t + 0.14);
    }
  }

  /**
   * Whoosh beim Boost-Start. Einmaliger Sound — kein Dauerton.
   */
  playBoost() {
    const ctx = this.audioReady();
    if (!ctx) return;
    const t = ctx.currentTime;
    const dest = this.masterGain;

    // Filtered Noise = Whoosh
    const bufferSize = Math.floor(ctx.sampleRate * 0.3);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + 0.2);
    filter.Q.value = 4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    noise.connect(filter).connect(gain).connect(dest);
    noise.start(t);
  }

  /**
   * Splat / Squelch beim Tod. Kombination aus:
   *  - Absteigendem Sawtooth (Bass-Rumble)
   *  - Lowpass-gefiltertem Noise (Splat-Anteil)
   */
  playDeath() {
    const ctx = this.audioReady();
    if (!ctx) return;
    const t = ctx.currentTime;
    const dest = this.masterGain;

    // Bass-Rumble
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.5);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 800;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.32, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    osc.connect(lowpass).connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.6);

    // Splat-Noise
    const bufferSize = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 1000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(0.28, t + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    noise.connect(noiseFilter).connect(noiseGain).connect(dest);
    noise.start(t);
  }

  /**
   * Triumphales Arpeggio (C5-E5-G5-C6) beim Kill-Bonus.
   */
  playKillBonus() {
    const ctx = this.audioReady();
    if (!ctx) return;
    const t = ctx.currentTime;
    const dest = this.masterGain;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const offset = i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + offset);
      gain.gain.linearRampToValueAtTime(0.11, t + offset + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.18);
      osc.connect(gain).connect(dest);
      osc.start(t + offset);
      osc.stop(t + offset + 0.2);
    });
  }

  /**
   * Subtiler Klick fuer UI-Buttons (Got it! / Play Again / Mute toggle).
   */
  playUIClick() {
    const ctx = this.audioReady();
    if (!ctx) return;
    const t = ctx.currentTime;
    const dest = this.masterGain;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 900;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.10, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /**
   * Bassiger Pop + hoher Sparkle beim Truffle (Mega-Bällchen).
   */
  playMegaEat() {
    const ctx = this.audioReady();
    if (!ctx) return;
    const t = ctx.currentTime;
    const dest = this.masterGain;

    // Tiefer Pop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.18);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.32, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.24);

    // Hoher Sparkle
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1500, t + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(2400, t + 0.12);
    gain2.gain.setValueAtTime(0, t + 0.02);
    gain2.gain.linearRampToValueAtTime(0.14, t + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc2.connect(gain2).connect(dest);
    osc2.start(t + 0.02);
    osc2.stop(t + 0.2);
  }

  /**
   * Epische Rampage-Aktivierung: Power-Chord + Highsweep.
   * Spielt wenn der Player ein Chili-Pepper isst.
   */
  playRampageStart() {
    const ctx = this.audioReady();
    if (!ctx) return;
    const t = ctx.currentTime;
    const dest = this.masterGain;

    // A-Major Power-Chord (A2, E3, A3, C#4)
    const notes = [110, 165, 220, 277];
    notes.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.07, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(gain).connect(dest);
      osc.start(t);
      osc.stop(t + 0.7);
    });

    // Aufsteigender Highsweep obendrauf
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.type = 'triangle';
    sweep.frequency.setValueAtTime(400, t);
    sweep.frequency.exponentialRampToValueAtTime(2000, t + 0.5);
    sweepGain.gain.setValueAtTime(0, t);
    sweepGain.gain.linearRampToValueAtTime(0.1, t + 0.1);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    sweep.connect(sweepGain).connect(dest);
    sweep.start(t);
    sweep.stop(t + 0.6);
  }

  /**
   * Schneller Zap-Sound fuer jeden Kill waehrend des Rampage-Modes.
   */
  playRampageKill() {
    const ctx = this.audioReady();
    if (!ctx) return;
    const t = ctx.currentTime;
    const dest = this.masterGain;

    // Hoher absteigender Sawtooth
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.1);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  /**
   * Aufsteigende Doppel-Note beim Sprint-Start (Pepperoncini).
   * Kuerzer und heller als Rampage — signalisiert 'kleines Power-up'.
   */
  playSprintStart() {
    const ctx = this.audioReady();
    if (!ctx) return;
    const t = ctx.currentTime;
    const dest = this.masterGain;

    // Schneller Triangle-Aufstieg G5 -> C6
    const notes = [784, 1047];
    notes.forEach((freq, i) => {
      const offset = i * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + offset);
      gain.gain.linearRampToValueAtTime(0.14, t + offset + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.2);
      osc.connect(gain).connect(dest);
      osc.start(t + offset);
      osc.stop(t + offset + 0.22);
    });
  }

  /**
   * Helper: gibt den Context zurueck wenn alles ready ist, sonst null.
   * Versteckt die three guards (muted / no-ctx / suspended).
   */
  audioReady() {
    if (this.muted) return null;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'suspended') return null;
    return ctx;
  }
}
