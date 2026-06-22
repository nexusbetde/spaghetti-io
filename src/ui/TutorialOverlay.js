import { t } from '../i18n.js';
import { markTutorialSeen } from '../utils/device.js';

/**
 * TutorialOverlay — Visual onboarding shown on first play.
 *
 * Design principles (from CrazyGames guidelines):
 *  - Prioritize visuals over text — we draw mouse/keyboard or drag/tap icons.
 *  - Skippable via a clearly labeled button.
 *  - Game keeps running behind the overlay so the player can already feel the
 *    movement before dismissing.
 *
 * The overlay is dismissed by:
 *  - Tapping the "Got it!" button
 *  - Tapping anywhere on the dark background
 *  - Auto after the player moved their pointer significantly (5+ seconds idle)
 */
export default class TutorialOverlay {
  constructor(scene, { isTouch = false, onDismiss = null } = {}) {
    this.scene = scene;
    this.isTouch = isTouch;
    this.onDismiss = onDismiss;
    this.objects = [];
    this.dismissed = false;

    this.build();
  }

  build() {
    const { width, height } = this.scene.scale;

    // Dark semi-transparent backdrop
    const bg = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setDepth(100)
      .setInteractive({ useHandCursor: false });
    bg.on('pointerdown', () => this.dismiss());
    this.objects.push(bg);

    // Title
    const title = this.scene.add
      .text(width / 2, height * 0.16, t('tutorial_title'), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '52px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 7
      })
      .setOrigin(0.5)
      .setDepth(101);
    this.objects.push(title);

    // Panels: two side-by-side instruction blocks
    if (this.isTouch) {
      this.buildMobilePanels();
    } else {
      this.buildDesktopPanels();
    }

    // Continue button (large, daumenfreundlich)
    this.buildContinueButton();
  }

  // ===========================================================================
  // Desktop: mouse icon + SPACE key icon
  // ===========================================================================

  buildDesktopPanels() {
    const { width, height } = this.scene.scale;
    const cy = height * 0.5;

    // LEFT: Mouse with directional arrows
    const leftX = width * 0.28;
    this.drawMouseIcon(leftX, cy - 30);
    this.objects.push(
      this.scene.add
        .text(leftX, cy + 100, t('tutorial_move'), {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '28px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4
        })
        .setOrigin(0.5)
        .setDepth(101)
    );

    // RIGHT: SPACE key
    const rightX = width * 0.72;
    this.drawSpaceKeyIcon(rightX, cy - 30);
    this.objects.push(
      this.scene.add
        .text(rightX, cy + 100, t('tutorial_boost'), {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '28px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4
        })
        .setOrigin(0.5)
        .setDepth(101)
    );
  }

  drawMouseIcon(x, y) {
    const g = this.scene.add.graphics().setDepth(101);

    // Mouse body
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x - 32, y - 50, 64, 90, 30);
    g.lineStyle(4, 0x222222, 1);
    g.strokeRoundedRect(x - 32, y - 50, 64, 90, 30);

    // Scroll wheel line (visible button divider)
    g.lineStyle(3, 0x222222, 1);
    g.beginPath();
    g.moveTo(x, y - 45);
    g.lineTo(x, y - 12);
    g.strokePath();

    // Tiny scroll wheel
    g.fillStyle(0x555555, 1);
    g.fillRoundedRect(x - 3, y - 28, 6, 14, 3);

    // 4 directional arrows around the mouse
    const arrowColor = 0xffd700;
    const dist = 80;
    this.drawArrow(g, x, y - 60, x, y - dist, arrowColor);          // up
    this.drawArrow(g, x, y + 50, x, y + dist, arrowColor);          // down
    this.drawArrow(g, x - 50, y, x - dist, y, arrowColor);          // left
    this.drawArrow(g, x + 50, y, x + dist, y, arrowColor);          // right

    this.objects.push(g);
  }

  drawSpaceKeyIcon(x, y) {
    const g = this.scene.add.graphics().setDepth(101);

    // Key outer shadow
    g.fillStyle(0x222222, 0.6);
    g.fillRoundedRect(x - 95, y - 28, 190, 65, 12);

    // Key body
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x - 95, y - 32, 190, 60, 12);
    g.lineStyle(4, 0x222222, 1);
    g.strokeRoundedRect(x - 95, y - 32, 190, 60, 12);

    this.objects.push(g);

    // Label "SPACE"
    this.objects.push(
      this.scene.add
        .text(x, y - 2, 'SPACE', {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '26px',
          color: '#222222'
        })
        .setOrigin(0.5)
        .setDepth(102)
    );

    // Down-arrow indicator above the key (showing "press")
    this.drawArrow(g, x, y - 75, x, y - 45, 0xffd700);
  }

  // ===========================================================================
  // Mobile: drag icon + boost-button icon
  // ===========================================================================

  buildMobilePanels() {
    const { width, height } = this.scene.scale;

    // TOP: drag to steer
    const topY = height * 0.4;
    this.drawDragIcon(width / 2, topY);
    this.objects.push(
      this.scene.add
        .text(width / 2, topY + 95, t('tutorial_mobile_move'), {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '26px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4
        })
        .setOrigin(0.5)
        .setDepth(101)
    );

    // BOTTOM: tap boost button
    const botY = height * 0.65;
    this.drawTapBoostIcon(width / 2, botY);
    this.objects.push(
      this.scene.add
        .text(width / 2, botY + 95, t('tutorial_mobile_boost'), {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '26px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4
        })
        .setOrigin(0.5)
        .setDepth(101)
    );
  }

  drawDragIcon(x, y) {
    const g = this.scene.add.graphics().setDepth(101);

    // Dotted curved path (arc-ish)
    g.lineStyle(4, 0xffd700, 0.9);
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      if (i % 2 !== 0) continue;
      const t1 = i / segments;
      const t2 = (i + 1) / segments;
      const ax = x - 60 + t1 * 120;
      const ay = y + Math.sin(t1 * Math.PI) * -30;
      const bx = x - 60 + t2 * 120;
      const by = y + Math.sin(t2 * Math.PI) * -30;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.strokePath();
    }

    // Finger circle at the end
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x + 60, y, 20);
    g.lineStyle(4, 0x222222, 1);
    g.strokeCircle(x + 60, y, 20);

    // Pulse rings at the finger position
    const pulse = this.scene.add.circle(x + 60, y, 30, 0xffd700, 0).setDepth(101);
    pulse.setStrokeStyle(3, 0xffd700, 0.8);
    this.scene.tweens.add({
      targets: pulse,
      radius: 50,
      alpha: { from: 0.8, to: 0 },
      duration: 900,
      repeat: -1,
      ease: 'Cubic.easeOut'
    });

    this.objects.push(g, pulse);
  }

  drawTapBoostIcon(x, y) {
    const g = this.scene.add.graphics().setDepth(101);

    // Boost button visual
    g.fillStyle(0xff6b35, 1);
    g.fillCircle(x, y, 36);
    g.lineStyle(4, 0xffffff, 1);
    g.strokeCircle(x, y, 36);

    this.objects.push(g);

    // Lightning bolt-ish icon inside (just an exclamation feel)
    this.objects.push(
      this.scene.add
        .text(x, y - 2, '!', {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '40px',
          color: '#ffffff'
        })
        .setOrigin(0.5)
        .setDepth(102)
    );

    // Pulse ring around the button
    const pulse = this.scene.add.circle(x, y, 40, 0xff6b35, 0).setDepth(101);
    pulse.setStrokeStyle(3, 0xff6b35, 0.7);
    this.scene.tweens.add({
      targets: pulse,
      radius: 60,
      alpha: { from: 0.7, to: 0 },
      duration: 1000,
      repeat: -1,
      ease: 'Cubic.easeOut'
    });
    this.objects.push(pulse);
  }

  // ===========================================================================
  // Continue button
  // ===========================================================================

  buildContinueButton() {
    const { width, height } = this.scene.scale;
    const y = height * 0.86;

    const padX = 32;
    const padY = 14;
    const label = t('tutorial_continue');

    // Approximate width based on label length (fontSize 32)
    const textWidth = label.length * 19;
    const buttonWidth = textWidth + padX * 2;
    const buttonHeight = 64;

    const bg = this.scene.add
      .rectangle(width / 2, y, buttonWidth, buttonHeight, 0xff6b35, 1)
      .setDepth(101)
      .setStrokeStyle(4, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const text = this.scene.add
      .text(width / 2, y, label, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(102);

    bg.on('pointerover', () => bg.setScale(1.07));
    bg.on('pointerout', () => bg.setScale(1));
    bg.on('pointerdown', (pointer, _x, _y, event) => {
      event?.stopPropagation?.();
      this.dismiss();
    });

    // Idle pulse to draw the eye
    this.scene.tweens.add({
      targets: [bg, text],
      scale: { from: 1, to: 1.06 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.objects.push(bg, text);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  drawArrow(g, x1, y1, x2, y2, color) {
    g.lineStyle(5, color, 1);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.strokePath();

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const len = 14;
    g.beginPath();
    g.moveTo(x2, y2);
    g.lineTo(x2 - Math.cos(angle - 0.5) * len, y2 - Math.sin(angle - 0.5) * len);
    g.moveTo(x2, y2);
    g.lineTo(x2 - Math.cos(angle + 0.5) * len, y2 - Math.sin(angle + 0.5) * len);
    g.strokePath();
  }

  dismiss() {
    if (this.dismissed) return;
    this.dismissed = true;

    markTutorialSeen();

    // Fade everything out and clean up
    this.scene.tweens.add({
      targets: this.objects,
      alpha: 0,
      duration: 250,
      onComplete: () => {
        this.objects.forEach((o) => o.destroy());
        this.objects = [];
        if (typeof this.onDismiss === 'function') this.onDismiss();
      }
    });
  }
}
