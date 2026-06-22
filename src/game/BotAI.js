import SpaghettiPlayer from './SpaghettiPlayer.js';

/**
 * BOT_PALETTES — visuelle Identitaeten fuer KI-Snakes.
 * Echte italienische Pasta-/Sauce-Namen geben Charakter ohne Lokalisierung
 * (Carbonara klingt international ueberall gleich).
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

/**
 * BotAI — ein KI-Controller fuer einen Spaghetti.
 *
 * Strategie pro Frame:
 *  1) Standard-Ziel: das naechste Fleischbaellchen
 *  2) Wand-Vermeidung: wenn der voraussichtliche naechste Pfad in der Wand
 *     landen wuerde, lenkt der Bot vom Rand weg
 *  3) Snake-Vermeidung: wenn ein anderer Koerper im Vorwaerts-Kegel des Bots
 *     liegt, lenkt der Bot tangential weg
 *  4) Boost: gelegentlich, wenn das Ziel mittlere Distanz hat und der Weg
 *     frei ist
 *
 * Die KI ist absichtlich vorsichtig — Bots sollen nicht andauernd suizidieren.
 */
export default class BotAI {
  constructor(scene, palette, x, y) {
    this.scene = scene;
    this.palette = palette;
    this.name = palette.name;

    // Eigenen Snake erstellen
    this.snake = new SpaghettiPlayer(scene, x, y, {
      ...palette,
      name: palette.name,
      nameColor: '#ffffff'
    });

    // Boost-State
    this.lastBoostStart = 0;
    this.lastBoostEnd = 0;
    this.boostCooldownMs = 2500 + Math.random() * 2500;

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

    // Ziel-Auswahl
    let target = this.chooseTarget(head, dir, meatballs, otherSnakes, worldBounds);

    // Boost-Logik
    this.updateBoost(head, target);

    // Snake bewegen
    this.snake.update(target.x, target.y, worldBounds);
  }

  // ---------------------------------------------------------------------------
  // Ziel-Auswahl
  // ---------------------------------------------------------------------------

  chooseTarget(head, dir, meatballs, otherSnakes, worldBounds) {
    // Schritt 1: erstmal das beste Fleischbaellchen finden
    const meatballTarget = this.findClosestMeatball(head, meatballs);

    // Schritt 2: Wand-Vermeidung. Wenn Vorwaerts-Pfad zu nah am Rand vorbeischrammt,
    // ziele Richtung Spielfeldmitte.
    const margin = 90;
    const lookAhead = 80;
    const ahead = { x: head.x + dir.x * lookAhead, y: head.y + dir.y * lookAhead };
    const nearLeft = ahead.x < margin;
    const nearRight = ahead.x > worldBounds.width - margin;
    const nearTop = ahead.y < margin;
    const nearBottom = ahead.y > worldBounds.height - margin;

    if (nearLeft || nearRight || nearTop || nearBottom) {
      // Lenke zum Inneren des Spielfelds, in Richtung Mitte
      return {
        x: worldBounds.width / 2,
        y: worldBounds.height / 2
      };
    }

    // Schritt 3: Snake-Vermeidung. Pruefe ob im Vorwaerts-Kegel ein Koerper liegt.
    const danger = this.findNearestDanger(head, dir, otherSnakes, 100);
    if (danger) {
      // Tangentialer Ausweichvektor: 90 Grad gedreht weg vom Danger-Punkt
      const dx = danger.x - head.x;
      const dy = danger.y - head.y;
      // Beide moegliche Tangenten ausprobieren, nimm die mit mehr Platz
      const tangentialA = { x: head.x + (-dy) * 2, y: head.y + dx * 2 };
      const tangentialB = { x: head.x + dy * 2, y: head.y + (-dx) * 2 };
      // Bevorzuge die Tangente die weiter vom Rand wegfuehrt
      const distA = this.distFromBounds(tangentialA, worldBounds);
      const distB = this.distFromBounds(tangentialB, worldBounds);
      return distA > distB ? tangentialA : tangentialB;
    }

    // Schritt 4: Wenn ein Fleischbaellchen verfuegbar, hin
    if (meatballTarget) {
      return { x: meatballTarget.x, y: meatballTarget.y };
    }

    // Schritt 5: Wandern
    return this.wander(head);
  }

  findClosestMeatball(head, meatballs) {
    let best = null;
    let bestDist = Infinity;
    for (const m of meatballs) {
      // Goldene Baellchen sind extra attraktiv (effektive Distanz halbiert)
      const weight = m.type === 'golden' ? 0.5 : 1;
      const dist = Math.hypot(m.x - head.x, m.y - head.y) * weight;
      if (dist < bestDist) {
        bestDist = dist;
        best = m;
      }
    }
    return best;
  }

  /**
   * Sucht den naechsten "gefaehrlichen Punkt" — also Kopf oder Koerper-Segment
   * einer anderen Schlange — der vor uns im Bewegungskegel liegt.
   */
  findNearestDanger(head, dir, otherSnakes, lookRadius) {
    let nearest = null;
    let nearestDist = lookRadius;

    for (const other of otherSnakes) {
      if (!other || other === this.snake || other.isDead) continue;

      // Andere Koepfe
      const headPoint = { x: other.headX, y: other.headY };
      const d = this.coneDistance(head, dir, headPoint, lookRadius);
      if (d !== null && d < nearestDist) {
        nearestDist = d;
        nearest = headPoint;
      }

      // Ihre Koerper-Segmente, sparse abtasten fuer Performance
      const step = Math.max(2, Math.floor(other.segmentCount / 12));
      for (let i = 0; i < other.segmentCount; i += step) {
        const idx = i * other.segmentSpacing;
        if (idx >= other.pathHistory.length) continue;
        const seg = other.pathHistory[idx];
        const sd = this.coneDistance(head, dir, seg, lookRadius);
        if (sd !== null && sd < nearestDist) {
          nearestDist = sd;
          nearest = seg;
        }
      }
    }
    return nearest;
  }

  /**
   * Distanz zum Punkt p — aber nur wenn p im Vorwaerts-Halbkreis liegt.
   * @returns Distanz oder null
   */
  coneDistance(head, dir, p, maxRadius) {
    const dx = p.x - head.x;
    const dy = p.y - head.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius || dist < 0.01) return null;
    // Skalar-Produkt um zu pruefen ob p vor uns liegt
    const dot = dx * dir.x + dy * dir.y;
    if (dot < 0) return null; // dahinter, ignorieren
    return dist;
  }

  distFromBounds(p, worldBounds) {
    return Math.min(p.x, p.y, worldBounds.width - p.x, worldBounds.height - p.y);
  }

  wander(head) {
    const now = this.scene.time.now;
    if (now - this.lastWanderUpdate > 800 + Math.random() * 1200) {
      // Alle ~1-2s Wander-Richtung leicht aendern
      this.wanderAngle += (Math.random() - 0.5) * Math.PI;
      this.lastWanderUpdate = now;
    }
    return {
      x: head.x + Math.cos(this.wanderAngle) * 200,
      y: head.y + Math.sin(this.wanderAngle) * 200
    };
  }

  // ---------------------------------------------------------------------------
  // Aktuelle Bewegungsrichtung
  // ---------------------------------------------------------------------------

  getCurrentDirection() {
    const h = this.snake.pathHistory;
    if (h.length < 2) return { x: 1, y: 0 };
    const dx = h[0].x - h[2 < h.length ? 2 : 1].x;
    const dy = h[0].y - h[2 < h.length ? 2 : 1].y;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) return { x: 1, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  // ---------------------------------------------------------------------------
  // Boost
  // ---------------------------------------------------------------------------

  updateBoost(head, target) {
    const now = this.scene.time.now;

    if (this.snake.isBoosting) {
      // Maximal ~1s am Stueck, dann Cooldown
      if (now - this.lastBoostStart > 800 + Math.random() * 400) {
        this.snake.setBoosting(false);
        this.lastBoostEnd = now;
      }
    } else {
      // Vielleicht Boost initiieren
      if (now - this.lastBoostEnd > this.boostCooldownMs) {
        const targetDist = Math.hypot(target.x - head.x, target.y - head.y);
        // Nur boosten wenn Ziel sinnvolle Distanz hat
        if (targetDist > 80 && targetDist < 250 && Math.random() < 0.35) {
          this.snake.setBoosting(true);
          this.lastBoostStart = now;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  destroy() {
    this.snake.destroy();
  }
}
