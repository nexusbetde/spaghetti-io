/**
 * Meatball — Ein Fleischbaellchen das der Spieler einsammeln kann.
 *
 * Es gibt zwei Sorten:
 *  - normal: braun, 1 Punkt, +1 Wachstum
 *  - golden: gold, pulsiert, 10 Punkte, +5 Wachstum, ca. 8% Spawn-Chance
 *
 * Die Bewegung (Magnet-Effekt) passiert in updatePull().
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
  }
};

const GOLDEN_CHANCE = 0.08;

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

    // 3 uebereinander gestapelte Kreise = 3D-Look
    this.outline = scene.add.circle(x, y, this.radius + 1.5, cfg.outline).setDepth(2);
    this.body = scene.add.circle(x, y, this.radius, cfg.color).setDepth(2);

    // Kleiner heller Punkt oben-links = Glanzlicht (macht es plastisch)
    this.highlight = scene.add
      .circle(
        x - this.radius * 0.35,
        y - this.radius * 0.35,
        this.radius * 0.3,
        cfg.highlight,
        0.75
      )
      .setDepth(3);

    // Goldene Baellchen pulsieren als Eye-Catcher
    if (type === 'golden') {
      this.pulseTween = scene.tweens.add({
        targets: [this.body, this.outline, this.highlight],
        scale: { from: 1, to: 1.18 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  /**
   * Magnet-Effekt: zieht das Baellchen zum Ziel, wenn es im Magnet-Radius ist.
   * @returns Die berechnete Distanz zum Ziel (fuer Kollisionsabfrage in GameScene).
   */
  updatePull(targetX, targetY, magnetRadius) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < magnetRadius && dist > 0.1) {
      // Naeher = staerker. Bei voller Naehe ist pullSpeed = 5 px/Frame.
      const pullStrength = (magnetRadius - dist) / magnetRadius;
      const pullSpeed = pullStrength * 5;

      this.x += (dx / dist) * pullSpeed;
      this.y += (dy / dist) * pullSpeed;

      this.refreshPosition();
    }

    return dist;
  }

  /**
   * Aktualisiert die Position aller Grafik-Objekte synchron.
   */
  refreshPosition() {
    this.outline.setPosition(this.x, this.y);
    this.body.setPosition(this.x, this.y);
    this.highlight.setPosition(
      this.x - this.radius * 0.35,
      this.y - this.radius * 0.35
    );
  }

  /**
   * Aufraeumen — wichtig damit keine Grafik-Objekte als Memory-Leak bleiben.
   */
  destroy() {
    if (this.pulseTween) this.pulseTween.stop();
    this.outline.destroy();
    this.body.destroy();
    this.highlight.destroy();
  }

  /**
   * Hilfsfunktion: gibt zufaellig 'normal' oder 'golden' zurueck.
   */
  static randomType() {
    return Math.random() < GOLDEN_CHANCE ? 'golden' : 'normal';
  }
}
