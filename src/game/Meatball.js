/**
 * Meatball — Ein Sammelbares Item auf der Karte.
 *
 * Vier Sorten:
 *  - normal: braun, 1 Punkt, +1 Wachstum
 *  - golden: gold, pulsiert, 10 Punkte, +5 Wachstum (~8% Spawn-Chance)
 *  - truffle: violett, leicht groesser, pulsiert, 25 Punkte, +10 Wachstum
 *      (~2% Spawn-Chance, max 3 gleichzeitig)
 *  - chili: rote Capsule mit gruenem Stiel, wackelt + pulsiert, +20 Wachstum,
 *      AKTIVIERT RAMPAGE MODE fuer 3 Sekunden — Unsterblichkeit + Auto-Boost +
 *      One-Shot-Kills bei jedem Snake-Kontakt (~0.5% Spawn-Chance, max 1)
 */
export const MEATBALL_TYPES = {
  normal: {
    color: 0x8b4513,
    outline: 0x4a2818,
    highlight: 0xcd853f,
    radius: 9,
    value: 1,
    growth: 1
  },
  golden: {
    color: 0xffd700,
    outline: 0xb8860b,
    highlight: 0xffec8b,
    radius: 12,
    value: 10,
    growth: 5
  },
  truffle: {
    color: 0x6a1b9a,         // tiefes Violett
    outline: 0x38006b,
    highlight: 0xba68c8,
    radius: 14,
    value: 25,
    growth: 10
  },
  pepperoncini: {
    // Gruene Kapsel, mittlere Power: 5s Sprint ohne Invincibility/Kill
    color: 0x66bb6a,
    outline: 0x2e7d32,
    highlight: 0xc8e6c9,
    radius: 12,
    value: 10,
    growth: 5,
    sprintDuration: 5000
  },
  chili: {
    // Chili nutzt eigenes Rendering; Felder hier sind nur fuer die Logik
    color: 0xff1f1f,
    outline: 0x6b0014,
    highlight: 0xff7777,
    radius: 13,
    value: 5,
    growth: 8,
    rampageDuration: 10000
  }
};

// Spawn-Wahrscheinlichkeiten — pro neuem Spawn-Event
const SPAWN_PROBABILITIES = {
  chili: 0.012,         // ~1.2% — Rampage, am seltensten
  pepperoncini: 0.025,  // ~2.5% — Sprint, dazwischen
  truffle: 0.03,        // ~3% — Mega-Punkte, uncommon
  golden: 0.08          // ~8% — Standard-Bonus
};

export default class Meatball {
  constructor(scene, x, y, type = 'normal') {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.type = type;

    const cfg = MEATBALL_TYPES[type];
    this.radius = cfg.radius;
    this.value = cfg.value;
    this.growth = cfg.growth;
    this.rampageDuration = cfg.rampageDuration ?? 0;
    this.sprintDuration = cfg.sprintDuration ?? 0;

    if (type === 'chili') {
      this.createCapsuleVisuals(x, y, cfg, {
        stemColor: 0x4caf50,
        stemOutline: 0x2e7d32,
        leafColor: 0x66bb6a
      });
    } else if (type === 'pepperoncini') {
      this.createCapsuleVisuals(x, y, cfg, {
        stemColor: 0x8d6e63,        // brauner Stiel kontrastiert mit gruenem Body
        stemOutline: 0x5d4037,
        leafColor: 0xa5d6a7
      });
    } else {
      this.createBallVisuals(x, y, cfg);
    }

    // Pulse-Animation fuer golden + truffle
    if (type === 'golden') {
      this.startCirclePulse(1.18, 600);
    } else if (type === 'truffle') {
      this.startCirclePulse(1.22, 800);
    }
  }

  // ---------------------------------------------------------------------------
  // Standard-Kreis-Rendering (normal, golden, truffle)
  // ---------------------------------------------------------------------------

  createBallVisuals(x, y, cfg) {
    this.outline = this.scene.add.circle(x, y, this.radius + 1.5, cfg.outline).setDepth(2);
    this.body = this.scene.add.circle(x, y, this.radius, cfg.color).setDepth(2);
    this.highlight = this.scene.add
      .circle(
        x - this.radius * 0.35,
        y - this.radius * 0.35,
        this.radius * 0.3,
        cfg.highlight,
        0.75
      )
      .setDepth(3);
  }

  startCirclePulse(maxScale, duration) {
    this.pulseTween = this.scene.tweens.add({
      targets: [this.body, this.outline, this.highlight],
      scale: { from: 1, to: maxScale },
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // ---------------------------------------------------------------------------
  // Custom-Rendering fuer Kapsel-Powerups (Chili-Pepper, Pepperoncini)
  // ---------------------------------------------------------------------------

  createCapsuleVisuals(x, y, cfg, palette) {
    // Container damit Wobble + Position alles zusammenhaelt
    this.container = this.scene.add.container(x, y).setDepth(3);

    // Body: ovale Kapsel
    const body = this.scene.add.ellipse(0, 2, 16, 26, cfg.color);
    body.setStrokeStyle(2.5, cfg.outline);

    // Glanzlicht oben links
    const highlight = this.scene.add.ellipse(-3, -4, 4, 8, cfg.highlight, 0.6);

    // Stiel
    const stem = this.scene.add.rectangle(0, -13, 6, 7, palette.stemColor);
    stem.setStrokeStyle(1.5, palette.stemOutline);

    // Kleines Blatt
    const leaf = this.scene.add.triangle(4, -15, 0, 0, 6, -1, 4, 4, palette.leafColor);
    leaf.setStrokeStyle(1, palette.stemOutline);

    this.container.add([body, stem, leaf, highlight]);

    // Wobble — wackelt lebhaft
    this.wobbleTween = this.scene.tweens.add({
      targets: this.container,
      angle: { from: -18, to: 18 },
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Glow-Pulse auf dem Body
    this.pulseTween = this.scene.tweens.add({
      targets: body,
      scaleX: { from: 1, to: 1.18 },
      scaleY: { from: 1, to: 1.18 },
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // ---------------------------------------------------------------------------
  // Magnet (gleich fuer alle Typen)
  // ---------------------------------------------------------------------------

  updatePull(targetX, targetY, magnetRadius) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < magnetRadius && dist > 0.1) {
      const pullStrength = (magnetRadius - dist) / magnetRadius;
      const pullSpeed = pullStrength * 5;
      this.x += (dx / dist) * pullSpeed;
      this.y += (dy / dist) * pullSpeed;
      this.refreshPosition();
    }

    return dist;
  }

  refreshPosition() {
    if (this.container) {
      this.container.setPosition(this.x, this.y);
    } else {
      this.outline.setPosition(this.x, this.y);
      this.body.setPosition(this.x, this.y);
      this.highlight.setPosition(
        this.x - this.radius * 0.35,
        this.y - this.radius * 0.35
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  destroy() {
    if (this.pulseTween) this.pulseTween.stop();
    if (this.wobbleTween) this.wobbleTween.stop();
    if (this.container) {
      this.container.destroy();
    } else {
      this.outline.destroy();
      this.body.destroy();
      this.highlight.destroy();
    }
  }

  // ---------------------------------------------------------------------------
  // Type-Auswahl beim Spawn
  // ---------------------------------------------------------------------------

  /**
   * Statische Hilfsfunktion fuer einfaches Random-Typing (normal / golden).
   * Truffle und Chili werden separat geprueft (mit Caps), siehe GameScene.
   */
  static randomType() {
    return Math.random() < SPAWN_PROBABILITIES.golden ? 'golden' : 'normal';
  }

  /**
   * Waehlt den Typ unter Beachtung der Caps und Wahrscheinlichkeiten.
   * @param counts - { truffle: N, chili: N, pepperoncini: N }
   */
  static pickType(counts) {
    if (counts.chili < 1 && Math.random() < SPAWN_PROBABILITIES.chili) {
      return 'chili';
    }
    if (counts.pepperoncini < 2 && Math.random() < SPAWN_PROBABILITIES.pepperoncini) {
      return 'pepperoncini';
    }
    if (counts.truffle < 3 && Math.random() < SPAWN_PROBABILITIES.truffle) {
      return 'truffle';
    }
    return Meatball.randomType();
  }
}
