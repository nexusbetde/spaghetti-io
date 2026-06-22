import SpaghettiPlayer from '../game/SpaghettiPlayer.js';
import Meatball from '../game/Meatball.js';

/**
 * GameScene — Die Haupt-Spielszene.
 *
 * Schritt 3: Fressen, Wachsen, Score
 *  - Fleischbaellchen spawnen zufaellig auf der Karte (immer ~ MEATBALL_COUNT viele)
 *  - Magnet-Effekt zieht Baellchen zum Spieler, wenn er nah ist
 *  - Kollision Kopf vs. Baellchen = Essen, Wachsen, Score-Up
 *  - Goldene Baellchen sind selten und bringen viel mehr Punkte
 */

// Spiel-Konstanten
const MEATBALL_COUNT = 35;           // Zielanzahl an Baellchen auf der Karte
const MAGNET_RADIUS = 90;            // Pixel: ab dieser Distanz zieht der Magnet
const SPAWN_MIN_DIST_FROM_PLAYER = 120; // Damit Baellchen nicht direkt vor der Nase spawnen

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;

    // Hintergrund
    this.drawCheckerboard();

    // Spielfeld-Grenzen
    this.worldBounds = { width, height };

    // Spieler erstellen
    this.player = new SpaghettiPlayer(this, width / 2, height / 2);

    // Ziel-Position fuer Steuerung (wird durch Maus/Touch aktualisiert)
    this.targetX = width / 2;
    this.targetY = height / 2;

    // Score
    this.score = 0;

    // Liste aller aktuell aktiven Fleischbaellchen
    this.meatballs = [];

    // Eingaben einrichten
    this.setupInput();

    // HUD bauen
    this.createHUD();

    // Initialen Schwarm an Baellchen spawnen
    for (let i = 0; i < MEATBALL_COUNT; i++) {
      this.spawnMeatball();
    }
  }

  update() {
    // 1) Spieler bewegen
    this.player.update(this.targetX, this.targetY, this.worldBounds);

    // 2) Fleischbaellchen pruefen: Magnet + Kollision
    this.processMeatballs();

    // 3) UI-Updates
    this.boostIndicator.setVisible(this.player.isBoosting);
  }

  // ---------------------------------------------------------------------------
  // Fleischbaellchen-Logik
  // ---------------------------------------------------------------------------

  processMeatballs() {
    const headX = this.player.headX;
    const headY = this.player.headY;
    const eatRadius = this.player.headRadius;

    // Rueckwaerts iterieren, weil wir mittendrin spliced'en
    for (let i = this.meatballs.length - 1; i >= 0; i--) {
      const m = this.meatballs[i];
      const dist = m.updatePull(headX, headY, MAGNET_RADIUS);

      // Kollision Kopf vs. Baellchen
      if (dist < eatRadius + m.radius) {
        this.eatMeatball(m, i);
      }
    }
  }

  spawnMeatball() {
    const { width, height } = this.scale;
    const margin = 40;

    // Mehrere Versuche, einen Spawn-Punkt zu finden, der nicht zu nah am Spieler ist
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
      x = Phaser.Math.Between(margin, width - margin);
      y = Phaser.Math.Between(margin, height - margin);
      const distToPlayer = Math.hypot(x - this.player.headX, y - this.player.headY);
      if (distToPlayer >= SPAWN_MIN_DIST_FROM_PLAYER) break;
    }

    const type = Meatball.randomType();
    this.meatballs.push(new Meatball(this, x, y, type));
  }

  eatMeatball(meatball, idx) {
    // 1) Score erhoehen
    this.score += meatball.value;
    this.scoreText.setText(`Score: ${this.score}`);
    this.popScore();

    // 2) Spieler waechst
    this.player.grow(meatball.growth);
    this.lengthText.setText(`Laenge: ${this.player.length}`);

    // 3) Visuelles Feedback an der Fress-Position
    this.showEatBurst(meatball.x, meatball.y, meatball.value, meatball.type === 'golden');

    // 4) Baellchen entfernen und ein neues woanders spawnen
    meatball.destroy();
    this.meatballs.splice(idx, 1);
    this.spawnMeatball();
  }

  /**
   * "+N" Text steigt auf + Partikel-Burst.
   */
  showEatBurst(x, y, points, isGolden) {
    // Floating "+N" Text
    const text = this.add
      .text(x, y, `+${points}`, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: isGolden ? '34px' : '22px',
        color: isGolden ? '#ffd700' : '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(25);

    this.tweens.add({
      targets: text,
      y: y - 55,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy()
    });

    // Kleiner Partikel-Burst (6 Kreise fliegen sternfoermig auseinander)
    const burstColor = isGolden ? 0xffd700 : 0xcd853f;
    const particleCount = isGolden ? 10 : 6;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 / particleCount) * i + Math.random() * 0.3;
      const speed = 35 + Math.random() * 45;
      const size = 2.5 + Math.random() * 2;

      const p = this.add.circle(x, y, size, burstColor).setDepth(20);

      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        scale: 0,
        alpha: 0,
        duration: 400 + Math.random() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy()
      });
    }
  }

  /**
   * Score-Text kurz aufpoppen lassen — fuer befriedigendes Feedback.
   */
  popScore() {
    this.tweens.killTweensOf(this.scoreText);
    this.scoreText.setScale(1);
    this.tweens.add({
      targets: this.scoreText,
      scale: { from: 1.3, to: 1 },
      duration: 220,
      ease: 'Back.easeOut'
    });
  }

  // ---------------------------------------------------------------------------
  // Eingaben
  // ---------------------------------------------------------------------------

  setupInput() {
    // Pointer-Position als Richtungsziel speichern (Maus UND Touch)
    this.input.on('pointermove', (pointer) => {
      this.targetX = pointer.x;
      this.targetY = pointer.y;
    });

    // Wenn ein Finger auf Mobile zum ersten Mal beruehrt, sofort Zielposition setzen
    this.input.on('pointerdown', (pointer) => {
      this.targetX = pointer.x;
      this.targetY = pointer.y;
      this.player.setBoosting(true);
    });

    this.input.on('pointerup', () => this.player.setBoosting(false));
    this.input.on('pointerout', () => this.player.setBoosting(false));

    // Leertaste und Shift als zusaetzliche Boost-Tasten fuer Desktop
    const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey.on('down', () => this.player.setBoosting(true));
    spaceKey.on('up', () => this.player.setBoosting(false));

    const shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    shiftKey.on('down', () => this.player.setBoosting(true));
    shiftKey.on('up', () => this.player.setBoosting(false));
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  createHUD() {
    const padX = 16;
    const padY = 14;
    const labelStyle = {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 6 }
    };

    // Steuerungshinweise links
    this.add.text(padX, padY, 'Maus / Finger = Richtung', labelStyle).setDepth(20);
    this.add.text(padX, padY + 34, 'KLICK / SPACE / SHIFT = BOOST', labelStyle).setDepth(20);

    // Score rechts oben
    this.scoreText = this.add
      .text(this.scale.width - padX, padY, 'Score: 0', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '28px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 5
      })
      .setOrigin(1, 0)
      .setDepth(20);

    this.lengthText = this.add
      .text(this.scale.width - padX, padY + 38, `Laenge: ${this.player.length}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 10, y: 6 }
      })
      .setOrigin(1, 0)
      .setDepth(20);

    // Boost-Indikator mittig oben
    this.boostIndicator = this.add
      .text(this.scale.width / 2, 40, 'BOOST!', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '36px',
        color: '#ff6b35',
        stroke: '#000000',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);

    this.tweens.add({
      targets: this.boostIndicator,
      scale: { from: 1, to: 1.15 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Status unten
    this.add
      .text(
        this.scale.width / 2,
        this.scale.height - 18,
        'Schritt 3: Fressen + Wachsen  |  Schritt 4 folgt: Kollision und Game Over',
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          color: '#aaaaaa'
        }
      )
      .setOrigin(0.5, 1)
      .setDepth(20);
  }

  // ---------------------------------------------------------------------------
  // Hintergrund
  // ---------------------------------------------------------------------------

  drawCheckerboard() {
    const tileSize = 80;
    const { width, height } = this.scale;
    const graphics = this.add.graphics();
    graphics.setDepth(0);

    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        graphics.fillStyle(isEven ? 0xc41e3a : 0xffffff, 0.12);
        graphics.fillRect(x, y, tileSize, tileSize);
      }
    }
  }
}
