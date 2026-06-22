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
    this.baseSpeed = options.baseSpeed ?? 3.2;   // Pixel pro Frame bei 60 FPS
    this.boostSpeed = options.boostSpeed ?? 6.0; // Boost = fast doppelt so schnell
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
    // Wir starten gefuellt mit der Startposition, damit der Koerper sofort sichtbar ist
    this.pathHistory = [];
    const maxHistory = this.segmentCount * this.segmentSpacing + 5;
    for (let i = 0; i < maxHistory; i++) {
      this.pathHistory.push({ x, y });
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
  }

  /**
   * Hauptupdate — pro Frame aufrufen.
   * @param {number} targetX - Ziel-X (z.B. Mauszeiger)
   * @param {number} targetY - Ziel-Y
   * @param {object} worldBounds - { width, height } um den Spieler im Spielfeld zu halten
   */
  update(targetX, targetY, worldBounds) {
    // 1) Bewege den Kopf in Richtung Ziel
    const dx = targetX - this.headX;
    const dy = targetY - this.headY;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      const speed = this.isBoosting ? this.boostSpeed : this.baseSpeed;
      // Normalisierter Richtungsvektor * Geschwindigkeit
      this.headX += (dx / dist) * speed;
      this.headY += (dy / dist) * speed;
    }

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

  /**
   * Sauberes Aufraeumen — wichtig fuer spaeter, wenn wir Scenes wechseln.
   */
  destroy() {
    this.bodyGraphics.destroy();
    this.eyeWhiteLeft.destroy();
    this.eyeWhiteRight.destroy();
    this.pupilLeft.destroy();
    this.pupilRight.destroy();
  }
}
