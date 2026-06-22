/**
 * GameScene — Die Haupt-Spielszene.
 * Aktuell zeigt sie nur einen Titel-Bildschirm.
 * In den naechsten Schritten kommt die Spielmechanik dazu.
 */
export default class GameScene extends Phaser.Scene {
  constructor() {
    // Jede Scene braucht einen eindeutigen Namen
    super('GameScene');
  }

  /**
   * create() laeuft EINMAL beim Start der Scene.
   * Hier bauen wir alles auf, was zu Beginn auf dem Bildschirm sein soll.
   */
  create() {
    const { width, height } = this.scale;

    // 1) Karierte Tischdecke als Hintergrund (Pizzeria-Vibe)
    this.drawCheckerboard();

    // 2) Grosser Titel
    this.add
      .text(width / 2, height / 2 - 80, '🍝 Spaghetti.io', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '88px',
        color: '#ffcc00',
        stroke: '#8b0000',
        strokeThickness: 10
      })
      .setOrigin(0.5);

    // 3) Slogan
    this.add
      .text(width / 2, height / 2 + 20, 'Fress. Wachs. Dominier.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5);

    // 4) Animierter Fleischbaellchen-Tease (kleine Vorschau auf das Spiel)
    this.drawMeatballPreview(width / 2, height / 2 + 120);

    // 5) Status unten
    this.add
      .text(width / 2, height - 40, 'Schritt 1: Setup laeuft  |  Schritt 2 folgt: Spaghetti steuern', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#aaaaaa'
      })
      .setOrigin(0.5);
  }

  /**
   * Zeichnet eine rot-weiss karierte Tischdecke als Hintergrund.
   * Reines Phaser-Graphics, keine Bilddateien noetig.
   */
  drawCheckerboard() {
    const tileSize = 80;
    const { width, height } = this.scale;
    const graphics = this.add.graphics();

    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        graphics.fillStyle(isEven ? 0xc41e3a : 0xffffff, 0.15);
        graphics.fillRect(x, y, tileSize, tileSize);
      }
    }
  }

  /**
   * Kleine animierte Vorschau: ein paar huepfende Fleischbaellchen.
   * Nur Eye-Candy fuer den Titelbildschirm.
   */
  drawMeatballPreview(centerX, centerY) {
    const meatballColors = [0x8b4513, 0xa0522d, 0x6b3410, 0x8b4513, 0xa0522d];

    meatballColors.forEach((color, index) => {
      const x = centerX + (index - 2) * 60;
      const meatball = this.add.circle(x, centerY, 18, color);
      meatball.setStrokeStyle(3, 0x4a2818);

      // Huepf-Animation mit kleinem Versatz pro Baellchen
      this.tweens.add({
        targets: meatball,
        y: centerY - 20,
        duration: 600,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: index * 100
      });
    });
  }
}
