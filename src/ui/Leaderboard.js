import { t } from '../i18n.js';

/**
 * Leaderboard — Top-5 Anzeige aller Snakes nach Laenge.
 *
 * Wird einmal beim Scene-Start erstellt und dann pro Frame (oder seltener)
 * via update(snakes) aktualisiert. Spieler wird visuell hervorgehoben.
 *
 * Layout (oben links):
 *   ┌─────────────────┐
 *   │ 🏆 LEADERBOARD  │
 *   │  1. Bolognese 84 │
 *   │  2. You       72 │  <- gelb hinterlegt
 *   │  3. Pesto     61 │
 *   └─────────────────┘
 */
export default class Leaderboard {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.maxRows = 5;

    this.objects = [];
    this.rows = [];

    this.build();
  }

  build() {
    const width = 200;
    const headerHeight = 30;
    const rowHeight = 22;
    const totalHeight = headerHeight + rowHeight * this.maxRows + 10;

    // Hintergrund-Karte
    const bg = this.scene.add
      .rectangle(this.x, this.y, width, totalHeight, 0x000000, 0.6)
      .setOrigin(0, 0)
      .setDepth(20)
      .setStrokeStyle(2, 0xffd700, 0.8);
    this.objects.push(bg);

    // Header
    const header = this.scene.add
      .text(this.x + width / 2, this.y + 6, `\u{1F3C6} ${t('hud_leaderboard')}`, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '15px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5, 0)
      .setDepth(21);
    this.objects.push(header);

    // Trenner
    const divider = this.scene.add
      .rectangle(this.x + 8, this.y + headerHeight, width - 16, 1, 0xffd700, 0.5)
      .setOrigin(0, 0)
      .setDepth(21);
    this.objects.push(divider);

    // 5 leere Zeilen vorbereiten
    for (let i = 0; i < this.maxRows; i++) {
      const rowY = this.y + headerHeight + 6 + i * rowHeight;

      const rowBg = this.scene.add
        .rectangle(this.x + 4, rowY, width - 8, rowHeight - 2, 0xffd700, 0)
        .setOrigin(0, 0)
        .setDepth(21);

      const rank = this.scene.add
        .text(this.x + 10, rowY + 3, `${i + 1}.`, {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '13px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2
        })
        .setOrigin(0, 0)
        .setDepth(22);

      const name = this.scene.add
        .text(this.x + 32, rowY + 3, '', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2
        })
        .setOrigin(0, 0)
        .setDepth(22);

      const length = this.scene.add
        .text(this.x + width - 10, rowY + 3, '', {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '13px',
          color: '#ffd700',
          stroke: '#000000',
          strokeThickness: 2
        })
        .setOrigin(1, 0)
        .setDepth(22);

      this.rows.push({ rowBg, rank, name, length });
      this.objects.push(rowBg, rank, name, length);
    }
  }

  /**
   * @param entries - Array von { name, length, isPlayer, alive }
   */
  update(entries) {
    // Filter tote raus, sort by length desc
    const sorted = entries
      .filter((e) => e.alive)
      .sort((a, b) => b.length - a.length);

    for (let i = 0; i < this.maxRows; i++) {
      const row = this.rows[i];
      const entry = sorted[i];

      if (!entry) {
        row.rank.setText(`${i + 1}.`);
        row.name.setText('—');
        row.length.setText('');
        row.rowBg.setFillStyle(0xffd700, 0);
        row.name.setColor('#666666');
        continue;
      }

      row.rank.setText(`${i + 1}.`);
      row.name.setText(this.truncate(entry.name, 11));
      row.length.setText(String(entry.length));

      if (entry.isPlayer) {
        // Spieler-Zeile hervorheben
        row.rowBg.setFillStyle(0xffd700, 0.18);
        row.name.setColor('#ffd700');
      } else {
        row.rowBg.setFillStyle(0xffd700, 0);
        row.name.setColor('#ffffff');
      }
    }
  }

  truncate(s, max) {
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + '…';
  }

  destroy() {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
    this.rows = [];
  }
}
