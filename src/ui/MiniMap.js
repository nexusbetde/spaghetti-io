/**
 * MiniMap — Kleine Karte unten links, zeigt die ganze Welt + alle Snakes.
 *
 * Position bottom-left, weil top-left bereits Mute+Best+Leaderboard nutzt,
 * top-right ist Score+Length, bottom-right ist Mobile-Boost-Button.
 *
 * Spieler ist immer goldener groesserer Punkt mit Outline.
 * Bots sind kleinere Punkte in ihrer Body-Farbe.
 * Chili-Powerups erscheinen als rot-pulsende Punkte (wichtig zu wissen wo sie sind).
 */
export default class MiniMap {
  constructor(scene, x, y, width, height, worldBounds) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.worldWidth = worldBounds.width;
    this.worldHeight = worldBounds.height;

    // Map Snake-Referenz -> Dot
    this.snakeDots = new Map();
    // Map Meatball-Referenz -> Dot (nur fuer Chili)
    this.chiliDots = new Map();
    this.objects = [];

    this.build();
  }

  build() {
    // Hintergrund-Karte
    const bg = this.scene.add
      .rectangle(this.x, this.y, this.width, this.height, 0x000000, 0.55)
      .setOrigin(0, 0)
      .setDepth(20)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0xc41e3a, 0.85);
    this.objects.push(bg);

    // Innere goldene Linie passt zum Welt-Border-Style
    const innerBorder = this.scene.add
      .rectangle(this.x + 3, this.y + 3, this.width - 6, this.height - 6, 0xffd700, 0)
      .setOrigin(0, 0)
      .setDepth(21)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0xffd700, 0.35);
    this.objects.push(innerBorder);
  }

  /**
   * Welt-Koordinate -> Map-Koordinate
   */
  worldToMap(wx, wy) {
    return {
      x: this.x + (wx / this.worldWidth) * this.width,
      y: this.y + (wy / this.worldHeight) * this.height
    };
  }

  /**
   * @param snakes - Array von SpaghettiPlayer-Instanzen
   * @param meatballs - Array von Meatball-Instanzen (zum Hervorheben von Chili)
   */
  update(snakes, meatballs) {
    // Snake-Dots aktualisieren
    for (const snake of snakes) {
      let dot = this.snakeDots.get(snake);
      if (!dot) {
        dot = this.createSnakeDot(snake);
        this.snakeDots.set(snake, dot);
      }

      if (snake.isDead) {
        dot.setVisible(false);
        continue;
      }

      const pos = this.worldToMap(snake.headX, snake.headY);
      dot.setPosition(pos.x, pos.y);
      dot.setVisible(true);
    }

    // Chili-Dots (Powerup-Highlights)
    const currentChilis = new Set();
    for (const m of meatballs) {
      if (m.type !== 'chili') continue;
      currentChilis.add(m);
      let dot = this.chiliDots.get(m);
      if (!dot) {
        dot = this.scene.add
          .circle(0, 0, 2.5, 0xff2222, 1)
          .setStrokeStyle(1, 0xffffff, 0.8)
          .setDepth(23)
          .setScrollFactor(0);
        // Pulsiert leicht damit es auffaellt
        this.scene.tweens.add({
          targets: dot,
          scale: { from: 1, to: 1.6 },
          duration: 350,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        this.chiliDots.set(m, dot);
      }
      const pos = this.worldToMap(m.x, m.y);
      dot.setPosition(pos.x, pos.y);
    }

    // Entfernte Chilis aufraeumen
    for (const [m, dot] of this.chiliDots.entries()) {
      if (!currentChilis.has(m)) {
        dot.destroy();
        this.chiliDots.delete(m);
      }
    }
  }

  createSnakeDot(snake) {
    const isPlayer = snake.headColor === 0xffd700; // Spieler hat gold
    const color = isPlayer ? 0xffd700 : snake.bodyColor;
    const radius = isPlayer ? 4 : 2.5;
    const dot = this.scene.add
      .circle(0, 0, radius, color, 1)
      .setDepth(22)
      .setScrollFactor(0);

    if (isPlayer) {
      dot.setStrokeStyle(1.5, 0xffffff, 1);
    } else {
      dot.setStrokeStyle(1, 0x000000, 0.5);
    }
    return dot;
  }

  destroy() {
    for (const dot of this.snakeDots.values()) dot.destroy();
    for (const dot of this.chiliDots.values()) dot.destroy();
    this.snakeDots.clear();
    this.chiliDots.clear();
    this.objects.forEach((o) => o.destroy());
  }
}
