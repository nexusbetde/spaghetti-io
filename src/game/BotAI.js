import SpaghettiPlayer from './SpaghettiPlayer.js';

/**
 * BOT_PALETTES — visuelle Identitaeten fuer KI-Snakes.
 */
export const BOT_PALETTES = [
  { name: 'Bolognese', bodyColor: 0xa84538, bodyOutline: 0x6b2820, headColor: 0xd4574a, headOutline: 0x8b1a14 },
  { name: 'Pesto',     bodyColor: 0x7cb342, bodyOutline: 0x4a6f1d, headColor: 0x9cd35a, headOutline: 0x4a8521 },
  { name: 'Marinara',  bodyColor: 0xc41e3a, bodyOutline: 0x6b0014, headColor: 0xe04060, headOutline: 0x8b0020 },
  { name: 'Carbonara', bodyColor: 0xf5f5dc, bodyOutline: 0xa08560, headColor: 0xfff8dc, headOutline: 0x8b6332 },
  { name: 'Alfredo',   bodyColor: 0xfff4d6, bodyOutline: 0xc99e6b, headColor: 0xfff8e0, headOutline: 0xa08560 },
  { name: 'Fusilli',   bodyColor: 0xff9933, bodyOutline: 0xb35c00, headColor: 0xffaa44, headOutline: 0xa05500 },
  { name: 'Penne',     bodyColor: 0xd4a574, bodyOutline: 0x8b6332, headColor: 0xe0b888, headOutline: 0x6b4a14 },
  { name: 'Ravioli',   bodyColor: 0xc78866, bodyOutline: 0x6b3410, headColor: 0xd99878, headOutline: 0x8b4513 },
  { name: 'Lasagne',   bodyColor: 0xb22222, bodyOutline: 0x6b0014, headColor: 0xcc3333, headOutline: 0x7b0a16 },
  { name: 'Rigatoni',  bodyColor: 0xe6a85c, bodyOutline: 0x8b6332, headColor: 0xf0b870, headOutline: 0x8b6332 }
];

// Bot-Konstanten
const BOT_BASE_SPEED = 2.6;      // ~19% langsamer als Player (3.2)
const BOT_BOOST_SPEED = 4.5;     // unbenutzt — Boost ist deaktiviert
const WALL_AVOID_MARGIN = 180;   // ab dieser Distanz von der Wand setzt Repulsion ein
const SNAKE_AVOID_RADIUS = 160;  // ab dieser Distanz zu fremden Koerpern setzt Repulsion ein
const HEAD_REPULSION_BOOST = 1.6; // fremde Koepfe sind gefaehrlicher als Koerper-Segmente
const REPULSION_WEIGHT = 1.5;    // wie stark Repulsion das Ziel ueberlagert

/**
 * BotAI — KI-Controller fuer einen Spaghetti.
 *
 * Strategie:
 *  - Ziel = naechstes Fleischbaellchen (Gold mit halber Effektiv-Distanz)
 *  - Bewegung = Ziel-Richtung + summierte Repulsionsvektoren von Waenden
 *    und anderen Schlangen
 *  - Kontinuierliche, glatte Steuerung statt 90°-Tangenten
 *  - Kein Boost — Bots bleiben vorhersehbar und sterben seltener
 */
export default class BotAI {
  constructor(scene, palette, x, y) {
    this.scene = scene;
    this.palette = palette;
    this.name = palette.name;

    this.snake = new SpaghettiPlayer(scene, x, y, {
      ...palette,
      name: palette.name,
      nameColor: '#ffffff',
      baseSpeed: BOT_BASE_SPEED,
      boostSpeed: BOT_BOOST_SPEED
    });

    // Wander-State (wenn kein gutes Ziel da ist)
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.lastWanderUpdate = 0;
  }

  /**
   * Pro Frame aufrufen.
   * @param meatballs - alle aktuellen Fleischbaellchen
   * @param otherSnakes - alle anderen Snakes (Player + andere Bots)
   * @param worldBounds - { width, height }
   */
  update(meatballs, otherSnakes, worldBounds) {
    if (this.snake.isDead) return;

    const head = { x: this.snake.headX, y: this.snake.headY };
    const dir = this.getCurrentDirection();

    const target = this.chooseTarget(head, dir, meatballs, otherSnakes, worldBounds);

    this.snake.update(target.x, target.y, worldBounds);
  }

  // ---------------------------------------------------------------------------
  // Ziel-Auswahl — Repulsionsfeld-basiert
  // ---------------------------------------------------------------------------

  chooseTarget(head, dir, meatballs, otherSnakes, worldBounds) {
    // 1) Primaeres Ziel: naechstes Fleischbaellchen (oder Wander)
    const meatball = this.findClosestMeatball(head, meatballs);
    const goal = meatball ? { x: meatball.x, y: meatball.y } : this.wander(head);

    // 2) Ziel-Richtungsvektor normalisiert
    let goalDx = goal.x - head.x;
    let goalDy = goal.y - head.y;
    const goalLen = Math.hypot(goalDx, goalDy);
    if (goalLen > 0.01) {
      goalDx /= goalLen;
      goalDy /= goalLen;
    } else {
      goalDx = dir.x;
      goalDy = dir.y;
    }

    // 3) Repulsion: Waende
    let repX = 0;
    let repY = 0;
    if (head.x < WALL_AVOID_MARGIN) {
      repX += (WALL_AVOID_MARGIN - head.x) / WALL_AVOID_MARGIN;
    } else if (head.x > worldBounds.width - WALL_AVOID_MARGIN) {
      repX -= (head.x - (worldBounds.width - WALL_AVOID_MARGIN)) / WALL_AVOID_MARGIN;
    }
    if (head.y < WALL_AVOID_MARGIN) {
      repY += (WALL_AVOID_MARGIN - head.y) / WALL_AVOID_MARGIN;
    } else if (head.y > worldBounds.height - WALL_AVOID_MARGIN) {
      repY -= (head.y - (worldBounds.height - WALL_AVOID_MARGIN)) / WALL_AVOID_MARGIN;
    }

    // 4) Repulsion: andere Snakes (Koepfe + sparse abgetastete Koerper)
    const radSq = SNAKE_AVOID_RADIUS * SNAKE_AVOID_RADIUS;

    for (const other of otherSnakes) {
      if (!other || other === this.snake || other.isDead) continue;

      // Fremder Kopf — gefaehrlicher (HEAD_REPULSION_BOOST)
      this.addRepulsion(head, other.headX, other.headY, radSq, HEAD_REPULSION_BOOST, (rx, ry) => {
        repX += rx;
        repY += ry;
      });

      // Koerper-Segmente sparse abtasten fuer Performance
      const step = Math.max(2, Math.floor(other.segmentCount / 10));
      for (let i = 0; i < other.segmentCount; i += step) {
        const idx = i * other.segmentSpacing;
        if (idx >= other.pathHistory.length) continue;
        const seg = other.pathHistory[idx];
        this.addRepulsion(head, seg.x, seg.y, radSq, 1.0, (rx, ry) => {
          repX += rx;
          repY += ry;
        });
      }
    }

    // 5) Eigene Koerper-Segmente (Self-Avoidance) — vermeidet das Hineinfahren
    // in den eigenen Schwanz bei langer Schlange
    const selfStep = Math.max(2, Math.floor(this.snake.segmentCount / 10));
    for (let i = 12; i < this.snake.segmentCount; i += selfStep) {
      const idx = i * this.snake.segmentSpacing;
      if (idx >= this.snake.pathHistory.length) continue;
      const seg = this.snake.pathHistory[idx];
      this.addRepulsion(head, seg.x, seg.y, radSq, 1.0, (rx, ry) => {
        repX += rx;
        repY += ry;
      });
    }

    // 6) Kombiniere Ziel-Richtung + Repulsion
    const finalX = goalDx + repX * REPULSION_WEIGHT;
    const finalY = goalDy + repY * REPULSION_WEIGHT;

    const finalLen = Math.hypot(finalX, finalY);
    if (finalLen > 0.01) {
      return {
        x: head.x + (finalX / finalLen) * 200,
        y: head.y + (finalY / finalLen) * 200
      };
    }
    return {
      x: head.x + dir.x * 100,
      y: head.y + dir.y * 100
    };
  }

  /**
   * Addiert einen Repulsions-Beitrag von Punkt (px, py) auf den Head.
   * Staerke = (R - d) / R, also linear faded weg bis zum Radius.
   * boost multipliziert die Staerke (z.B. fremde Koepfe = 1.6x).
   */
  addRepulsion(head, px, py, radiusSq, boost, accumulate) {
    const dx = px - head.x;
    const dy = py - head.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1 || d2 > radiusSq) return;

    const d = Math.sqrt(d2);
    const f = (1 - d / SNAKE_AVOID_RADIUS) * boost;
    accumulate(-(dx / d) * f, -(dy / d) * f);
  }

  findClosestMeatball(head, meatballs) {
    let best = null;
    let bestDist = Infinity;
    for (const m of meatballs) {
      const weight = m.type === 'golden' ? 0.5 : 1;
      const dist = Math.hypot(m.x - head.x, m.y - head.y) * weight;
      if (dist < bestDist) {
        bestDist = dist;
        best = m;
      }
    }
    return best;
  }

  wander(head) {
    const now = this.scene.time.now;
    if (now - this.lastWanderUpdate > 1200 + Math.random() * 1600) {
      this.wanderAngle += (Math.random() - 0.5) * Math.PI;
      this.lastWanderUpdate = now;
    }
    return {
      x: head.x + Math.cos(this.wanderAngle) * 250,
      y: head.y + Math.sin(this.wanderAngle) * 250
    };
  }

  // ---------------------------------------------------------------------------
  // Aktuelle Bewegungsrichtung aus den letzten History-Punkten
  // ---------------------------------------------------------------------------

  getCurrentDirection() {
    const h = this.snake.pathHistory;
    if (h.length < 2) return { x: 1, y: 0 };
    const p1 = h[0];
    const p2 = h[Math.min(2, h.length - 1)];
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) return { x: 1, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  destroy() {
    this.snake.destroy();
  }
}
