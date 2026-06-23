/**
 * SpaghettiPlayer — Eine steuerbare Pasta-Schlange.
 *
 * Funktionsweise (Position-History-Technik):
 *  1) Wir merken uns die letzten N Positionen des Kopfes in einem Array (pathHistory).
 *  2) Jedes Koerper-Segment "sitzt" an einer aelteren Position aus dieser History.
 *  3) Das ergibt automatisch die typische Schlangen-Bewegung — der Koerper folgt
 *     dem Kopf entlang seines tatsaechlichen Pfads.
 *
 * Diese Technik nutzt auch slither.io. Sie ist simpel und sieht super aus.
 */
export default class SpaghettiPlayer {
  constructor(scene, x, y, options = {}) {
    this.scene = scene;

    // === Position ===
    this.headX = x;
    this.headY = y;

    // === Bewegung ===
    this.baseSpeed = options.baseSpeed ?? 3.0;   // gemuetlicher als Original (3.2) — User will langsamer
    this.boostSpeed = options.boostSpeed ?? 8.0; // explosiver Boost (Ratio 2.67x vs Base, war 1.88x original)
    this.sprintSpeed = options.sprintSpeed ?? 10.35; // Mitte zwischen Boost und Rampage, fuer Pepperoncini-Powerup
    this.rampageSpeed = options.rampageSpeed ?? 13.5; // ~1.7x boost — Komet-Modus waehrend Chili-Rampage
    this.isBoosting = false;

    // === Koerper-Konfiguration ===
    this.segmentCount = options.segmentCount ?? 30;
    this.segmentSpacing = options.segmentSpacing ?? 4; // History-Index-Abstand zwischen Segmenten
    this.headRadius = options.headRadius ?? 16;
    this.bodyRadius = options.bodyRadius ?? 13;
    this.bodyEndRadius = options.bodyEndRadius ?? 8; // Schwanz duenner = klassische Pasta-Form

    // === Farben (Pasta-Look) ===
    this.bodyColor = options.bodyColor ?? 0xf5deb3;    // wheat
    this.bodyOutline = options.bodyOutline ?? 0xc99e6b; // darker wheat
    this.headColor = options.headColor ?? 0xffd700;    // gold (Kopf hervorheben)
    this.headOutline = options.headOutline ?? 0xb8860b;

    // === Pfad-History ===
    // Der Koerper wird beim Spawn nach LINKS vom Kopf ausgelegt — bewusst NICHT
    // alle Punkte auf den Spawn-Punkt setzen, sonst lieferten Kopf und alle
    // Segmente die gleiche Position und checkSelfCollision() haette im ersten
    // Frame sofort True zurueckgegeben.
    this.pathHistory = [];
    const maxHistory = this.segmentCount * this.segmentSpacing + 5;
    for (let i = 0; i < maxHistory; i++) {
      this.pathHistory.push({ x: x - i * this.baseSpeed, y });
    }

    // === Grafik-Objekte ===
    // Ein Graphics-Objekt fuer den ganzen Koerper (effizienter als 30 einzelne Sprites)
    this.bodyGraphics = scene.add.graphics();
    this.bodyGraphics.setDepth(5);

    // Augen als separate Kreise (damit sie immer schoen oben bleiben)
    this.eyeWhiteLeft = scene.add.circle(x, y, 4.5, 0xffffff).setDepth(15);
    this.eyeWhiteRight = scene.add.circle(x, y, 4.5, 0xffffff).setDepth(15);
    this.pupilLeft = scene.add.circle(x, y, 2.2, 0x000000).setDepth(16);
    this.pupilRight = scene.add.circle(x, y, 2.2, 0x000000).setDepth(16);

    // === Lebensstatus ===
    // Wird auf true gesetzt sobald der Spieler stirbt, stoppt update() und draw().
    this.isDead = false;

    // === Rampage-Mode (Chili-Pepper Powerup) ===
    // Solange aktiv: unsterblich, Auto-Boost, tot jeden anderen Snake bei Beruehrung
    this.isRampaging = false;
    this.rampageEndsAt = 0;
    this.rampageAura = null;
    this.rampageAuraTween = null;

    // === Sprint-Mode (Pepperoncini Powerup) ===
    // Solange aktiv: nur Speed-Bump auf sprintSpeed. Kein Schutz, kein Kill.
    this.isSprinting = false;
    this.sprintEndsAt = 0;
    this.sprintAura = null;
    this.sprintAuraTween = null;

    // === Name-Label (optional, fuer Bots oder als "You"-Marker) ===
    this.name = options.name ?? null;
    this.nameLabel = null;
    if (this.name) {
      this.nameLabel = scene.add
        .text(x, y - this.headRadius - 14, this.name, {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '14px',
          color: options.nameColor ?? '#ffffff',
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0.5, 1)
        .setDepth(17);
    }
  }

  /**
   * Hauptupdate — pro Frame aufrufen.
   * @param {number} targetX - Ziel-X (z.B. Mauszeiger)
   * @param {number} targetY - Ziel-Y
   * @param {object} worldBounds - { width, height } um den Spieler im Spielfeld zu halten
   */
  update(targetX, targetY, worldBounds) {
    // Tote Spieler bewegen sich nicht mehr
    if (this.isDead) return;

    // Rampage-Timeout pruefen + Auto-Boost waehrend aktiv
    if (this.isRampaging) {
      if (this.scene.time.now >= this.rampageEndsAt) {
        this.deactivateRampage();
      } else {
        this.isBoosting = true;
      }
    }

    // Sprint-Timeout pruefen
    if (this.isSprinting) {
      if (this.scene.time.now >= this.sprintEndsAt) {
        this.deactivateSprint();
      }
    }

    // 1) Bewege den Kopf in Richtung Ziel
    const dx = targetX - this.headX;
    const dy = targetY - this.headY;
    const dist = Math.hypot(dx, dy);

    // Kein bedeutender Input -> kein Update. WICHTIG: Wenn wir auch ohne
    // Bewegung die History pushen wuerden, kollabieren nach ~50 Frames alle
    // Segment-Positionen auf den Kopf und die Self-Collision triggert von
    // selbst — Spieler stuerbe also wenn er einfach nichts tut.
    if (dist <= 1) {
      return;
    }

    // Speed: Rampage > Sprint > Boost > Base
    let speed;
    if (this.isRampaging) {
      speed = this.rampageSpeed;
    } else if (this.isSprinting) {
      speed = this.sprintSpeed;
    } else if (this.isBoosting) {
      speed = this.boostSpeed;
    } else {
      speed = this.baseSpeed;
    }

    // Normalisierter Richtungsvektor * Geschwindigkeit
    this.headX += (dx / dist) * speed;
    this.headY += (dy / dist) * speed;

    // 2) Halte den Kopf im Spielfeld (Clamping)
    if (worldBounds) {
      const margin = this.headRadius;
      this.headX = Phaser.Math.Clamp(this.headX, margin, worldBounds.width - margin);
      this.headY = Phaser.Math.Clamp(this.headY, margin, worldBounds.height - margin);
    }

    // 3) Neue Position vorne in die History einfuegen
    this.pathHistory.unshift({ x: this.headX, y: this.headY });

    // 4) History auf benoetigte Laenge kuerzen
    const maxHistory = this.segmentCount * this.segmentSpacing + 5;
    if (this.pathHistory.length > maxHistory) {
      this.pathHistory.length = maxHistory;
    }

    // 5) Neuzeichnen
    this.draw();
    this.updateEyes();
    this.updateNameLabel();
    this.updateRampageAura();
    this.updateSprintAura();
  }

  /**
   * Positioniert die Rampage-Aura am Kopf, falls aktiv.
   */
  updateRampageAura() {
    if (this.rampageAura && this.isRampaging) {
      this.rampageAura.setPosition(this.headX, this.headY);
    }
  }

  /**
   * Positioniert die Sprint-Aura am Kopf, falls aktiv.
   */
  updateSprintAura() {
    if (this.sprintAura && this.isSprinting) {
      this.sprintAura.setPosition(this.headX, this.headY);
    }
  }

  /**
   * Positioniert das Namens-Label ueber dem Kopf.
   */
  updateNameLabel() {
    if (this.nameLabel) {
      this.nameLabel.setPosition(this.headX, this.headY - this.headRadius - 14);
    }
  }

  /**
   * Zeichnet den gesamten Koerper.
   * Wir gehen von hinten nach vorne, damit der Kopf oben liegt.
   */
  draw() {
    this.bodyGraphics.clear();

    // Koerper-Segmente
    for (let i = this.segmentCount - 1; i >= 0; i--) {
      const historyIdx = i * this.segmentSpacing;
      if (historyIdx >= this.pathHistory.length) continue;

      const pos = this.pathHistory[historyIdx];

      // Lineare Interpolation der Groesse: vorne dick, hinten duenn (Pasta-Taper)
      const t = i / (this.segmentCount - 1); // 0 = vorne, 1 = hinten
      const radius = this.bodyRadius - t * (this.bodyRadius - this.bodyEndRadius);

      // Outline (groesserer Kreis darunter)
      this.bodyGraphics.fillStyle(this.bodyOutline, 1);
      this.bodyGraphics.fillCircle(pos.x, pos.y, radius + 1.5);

      // Body fill
      this.bodyGraphics.fillStyle(this.bodyColor, 1);
      this.bodyGraphics.fillCircle(pos.x, pos.y, radius);
    }

    // Kopf — auf aktueller Position, etwas groesser, andere Farbe
    this.bodyGraphics.fillStyle(this.headOutline, 1);
    this.bodyGraphics.fillCircle(this.headX, this.headY, this.headRadius + 2);
    this.bodyGraphics.fillStyle(this.headColor, 1);
    this.bodyGraphics.fillCircle(this.headX, this.headY, this.headRadius);
  }

  /**
   * Positioniert die Augen abhaengig von der Bewegungsrichtung.
   * Die Augen liegen seitlich vorne auf dem Kopf, die Pupillen schauen in Bewegungsrichtung.
   */
  updateEyes() {
    if (this.pathHistory.length < 2) return;

    // Bewegungsrichtung aus den letzten 2 History-Punkten
    const prev = this.pathHistory[2] ?? this.pathHistory[1];
    const angle = Math.atan2(this.headY - prev.y, this.headX - prev.x);

    const eyeOffsetForward = 4;
    const eyeOffsetSide = 7;

    // Berechne Augenpositionen mit Rotation
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Linkes Auge: seitlich links vom Kopf
    const lx = this.headX + cos * eyeOffsetForward - sin * eyeOffsetSide;
    const ly = this.headY + sin * eyeOffsetForward + cos * eyeOffsetSide;

    // Rechtes Auge: seitlich rechts
    const rx = this.headX + cos * eyeOffsetForward + sin * eyeOffsetSide;
    const ry = this.headY + sin * eyeOffsetForward - cos * eyeOffsetSide;

    this.eyeWhiteLeft.setPosition(lx, ly);
    this.eyeWhiteRight.setPosition(rx, ry);

    // Pupillen leicht nach vorne versetzt (in Bewegungsrichtung)
    const pupilShift = 1.8;
    this.pupilLeft.setPosition(lx + cos * pupilShift, ly + sin * pupilShift);
    this.pupilRight.setPosition(rx + cos * pupilShift, ry + sin * pupilShift);
  }

  /**
   * Boost an/aus schalten.
   */
  setBoosting(active) {
    this.isBoosting = active;
  }

  /**
   * Spieler waechst — fuegt zusaetzliche Segmente hinten an.
   * Wird aufgerufen, wenn ein Fleischbaellchen gegessen wird.
   *
   * @param {number} amount - Anzahl neuer Segmente
   */
  grow(amount = 1) {
    this.segmentCount += amount;

    // History muss lang genug sein, damit die neuen hinteren Segmente
    // tatsaechlich eine Position zum Sitzen haben.
    const maxHistory = this.segmentCount * this.segmentSpacing + 5;
    if (this.pathHistory.length < maxHistory) {
      // Mit der letzten bekannten Position auffuellen — die neuen Segmente
      // erscheinen so erst mal am Schwanz und wachsen dann sichtbar nach.
      const last = this.pathHistory[this.pathHistory.length - 1] ?? {
        x: this.headX,
        y: this.headY
      };
      while (this.pathHistory.length < maxHistory) {
        this.pathHistory.push({ x: last.x, y: last.y });
      }
    }
  }

  /**
   * Aktuelle Laenge der Schlange (Anzahl Segmente).
   */
  get length() {
    return this.segmentCount;
  }

  // ---------------------------------------------------------------------------
  // Kollisionen
  // ---------------------------------------------------------------------------

  /**
   * Prueft ob der Kopf die Spielfeld-Grenze beruehrt.
   */
  checkWallCollision(worldBounds) {
    const r = this.headRadius;
    return (
      this.headX <= r ||
      this.headX >= worldBounds.width - r ||
      this.headY <= r ||
      this.headY >= worldBounds.height - r
    );
  }

  /**
   * Prueft ob der Kopf einen Punkt des eigenen Koerpers beruehrt.
   * Die ersten SAFE_SEGMENT_OFFSET Segmente werden ignoriert, weil sie
   * unmittelbar hinter dem Kopf liegen — sonst wuerde der Spieler bei
   * jeder Kurve sofort sterben.
   */
  checkSelfCollision(safeSegmentOffset = 12) {
    for (let i = safeSegmentOffset; i < this.segmentCount; i++) {
      const historyIdx = i * this.segmentSpacing;
      if (historyIdx >= this.pathHistory.length) continue;

      const pos = this.pathHistory[historyIdx];
      const dist = Math.hypot(this.headX - pos.x, this.headY - pos.y);

      // Radius dieses Segments (taper)
      const t = i / (this.segmentCount - 1);
      const segRadius = this.bodyRadius - t * (this.bodyRadius - this.bodyEndRadius);

      // Etwas grosszuegig: 60% der kombinierten Radien
      if (dist < (this.headRadius + segRadius) * 0.6) {
        return true;
      }
    }
    return false;
  }

  /**
   * Prueft ob der Kopf einen Punkt des Koerpers einer ANDEREN Schlange beruehrt.
   * Anders als bei Self-Collision pruefen wir hier ALLE Segmente — es gibt
   * keine "Safe-Zone" weil wir nicht in unserem eigenen Pfad fahren.
   */
  checkCollisionWith(other) {
    if (!other || other === this || other.isDead) return false;

    // Kopf-vs-Kopf erst: bei direktem Crash beide tot (caller entscheidet wer)
    const headDist = Math.hypot(this.headX - other.headX, this.headY - other.headY);
    if (headDist < this.headRadius + other.headRadius) return true;

    // Mein Kopf vs. ihre Koerper-Segmente
    for (let i = 0; i < other.segmentCount; i++) {
      const idx = i * other.segmentSpacing;
      if (idx >= other.pathHistory.length) continue;

      const pos = other.pathHistory[idx];
      const dist = Math.hypot(this.headX - pos.x, this.headY - pos.y);

      const t = i / Math.max(1, other.segmentCount - 1);
      const segRadius = other.bodyRadius - t * (other.bodyRadius - other.bodyEndRadius);

      // 0.75 = nicht ganz so streng, gibt Spielraum bei knappen Vorbeiziehern
      if (dist < (this.headRadius + segRadius) * 0.75) {
        return true;
      }
    }
    return false;
  }

  /**
   * Setzt die Schlange auf einen neuen Spawn-Punkt zurueck.
   * Wird fuer Bot-Respawn benutzt und koennte auch fuer Player-Restart genutzt
   * werden (wir restarten dort allerdings die ganze Scene).
   */
  respawn(x, y, options = {}) {
    this.headX = x;
    this.headY = y;
    this.isDead = false;
    this.isBoosting = false;

    // Rampage- und Sprint-Status zuruecksetzen
    if (this.isRampaging) {
      this.deactivateRampage();
    }
    if (this.isSprinting) {
      this.deactivateSprint();
    }

    if (options.segmentCount !== undefined) {
      this.segmentCount = options.segmentCount;
    } else {
      this.segmentCount = 30;
    }

    // History neu auslegen, Koerper nach links vom Kopf
    this.pathHistory = [];
    const maxHistory = this.segmentCount * this.segmentSpacing + 5;
    for (let i = 0; i < maxHistory; i++) {
      this.pathHistory.push({ x: x - i * this.baseSpeed, y });
    }

    this.setVisible(true);
    this.draw();
    this.updateEyes();
    this.updateNameLabel();
  }
  captureDeathState() {
    const segments = [];
    for (let i = 0; i < this.segmentCount; i++) {
      const historyIdx = i * this.segmentSpacing;
      if (historyIdx >= this.pathHistory.length) continue;

      const pos = this.pathHistory[historyIdx];
      const t = i / (this.segmentCount - 1);
      const radius = this.bodyRadius - t * (this.bodyRadius - this.bodyEndRadius);

      segments.push({ x: pos.x, y: pos.y, radius });
    }
    return {
      headX: this.headX,
      headY: this.headY,
      headRadius: this.headRadius,
      headColor: this.headColor,
      headOutline: this.headOutline,
      bodyColor: this.bodyColor,
      bodyOutline: this.bodyOutline,
      segments
    };
  }

  /**
   * Sichtbarkeit aller Grafik-Objekte umschalten.
   */
  setVisible(visible) {
    this.bodyGraphics.setVisible(visible);
    this.eyeWhiteLeft.setVisible(visible);
    this.eyeWhiteRight.setVisible(visible);
    this.pupilLeft.setVisible(visible);
    this.pupilRight.setVisible(visible);
    if (this.nameLabel) this.nameLabel.setVisible(visible);
    if (this.rampageAura) this.rampageAura.setVisible(visible && this.isRampaging);
    if (this.sprintAura) this.sprintAura.setVisible(visible && this.isSprinting);
  }

  /**
   * Markiert den Spieler als tot — Bewegung und Zeichnen stoppen.
   */
  kill() {
    this.isDead = true;
    this.isBoosting = false;
    this.deactivateRampage();
    this.deactivateSprint();
  }

  // ---------------------------------------------------------------------------
  // Rampage-Mode (Chili-Pepper Powerup)
  // ---------------------------------------------------------------------------

  /**
   * Aktiviert den Rampage-Mode fuer duration ms.
   * Effekt: unsterblich, Auto-Boost, todbringend bei Body-Kontakt.
   */
  activateRampage(duration = 3000) {
    const now = this.scene.time.now;
    // Wenn schon aktiv: verlaengern statt neu setzen
    if (this.isRampaging) {
      this.rampageEndsAt = Math.max(this.rampageEndsAt, now + duration);
      return;
    }

    this.isRampaging = true;
    this.rampageEndsAt = now + duration;

    // Aura erstellen wenn noch nicht da
    if (!this.rampageAura) {
      this.rampageAura = this.scene.add
        .circle(this.headX, this.headY, this.headRadius * 2.2, 0xff2222, 0.32)
        .setDepth(4);
      this.rampageAura.setStrokeStyle(3, 0xff5555, 0.85);
    } else {
      this.rampageAura.setPosition(this.headX, this.headY);
      this.rampageAura.setVisible(true);
    }

    // Pulsierende Aura
    if (this.rampageAuraTween) this.rampageAuraTween.stop();
    this.rampageAuraTween = this.scene.tweens.add({
      targets: this.rampageAura,
      scale: { from: 0.85, to: 1.25 },
      alpha: { from: 0.32, to: 0.6 },
      duration: 280,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  deactivateRampage() {
    if (!this.isRampaging) return;
    this.isRampaging = false;
    this.rampageEndsAt = 0;
    if (this.rampageAuraTween) {
      this.rampageAuraTween.stop();
      this.rampageAuraTween = null;
    }
    if (this.rampageAura) {
      this.rampageAura.setVisible(false);
      this.rampageAura.setScale(1);
      this.rampageAura.setAlpha(0.32);
    }
    // Boost wieder aus — caller kann selbst neu aktivieren wenn gewollt
    this.isBoosting = false;
  }

  /**
   * Wieviele ms ist die Rampage noch aktiv?
   */
  rampageMillisLeft() {
    if (!this.isRampaging) return 0;
    return Math.max(0, this.rampageEndsAt - this.scene.time.now);
  }

  // ---------------------------------------------------------------------------
  // Sprint-Mode (Pepperoncini Powerup) — nur Speed, kein Schutz, kein Kill
  // ---------------------------------------------------------------------------

  activateSprint(duration = 5000) {
    const now = this.scene.time.now;
    if (this.isSprinting) {
      this.sprintEndsAt = Math.max(this.sprintEndsAt, now + duration);
      return;
    }
    this.isSprinting = true;
    this.sprintEndsAt = now + duration;

    if (!this.sprintAura) {
      this.sprintAura = this.scene.add
        .circle(this.headX, this.headY, this.headRadius * 1.7, 0x66bb6a, 0.25)
        .setDepth(4);
      this.sprintAura.setStrokeStyle(2.5, 0x4caf50, 0.85);
    } else {
      this.sprintAura.setPosition(this.headX, this.headY);
      this.sprintAura.setVisible(true);
    }

    if (this.sprintAuraTween) this.sprintAuraTween.stop();
    this.sprintAuraTween = this.scene.tweens.add({
      targets: this.sprintAura,
      scale: { from: 0.95, to: 1.18 },
      alpha: { from: 0.25, to: 0.5 },
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  deactivateSprint() {
    if (!this.isSprinting) return;
    this.isSprinting = false;
    this.sprintEndsAt = 0;
    if (this.sprintAuraTween) {
      this.sprintAuraTween.stop();
      this.sprintAuraTween = null;
    }
    if (this.sprintAura) {
      this.sprintAura.setVisible(false);
      this.sprintAura.setScale(1);
      this.sprintAura.setAlpha(0.25);
    }
  }

  sprintMillisLeft() {
    if (!this.isSprinting) return 0;
    return Math.max(0, this.sprintEndsAt - this.scene.time.now);
  }

  /**
   * Sauberes Aufraeumen — wichtig fuer spaeter, wenn wir Scenes wechseln.
   */
  destroy() {
    this.bodyGraphics.destroy();
    this.eyeWhiteLeft.destroy();
    this.eyeWhiteRight.destroy();
    this.pupilLeft.destroy();
    this.pupilRight.destroy();
    if (this.nameLabel) this.nameLabel.destroy();
    if (this.rampageAuraTween) this.rampageAuraTween.stop();
    if (this.rampageAura) this.rampageAura.destroy();
    if (this.sprintAuraTween) this.sprintAuraTween.stop();
    if (this.sprintAura) this.sprintAura.destroy();
  }
}
