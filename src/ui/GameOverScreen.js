import { t } from '../i18n.js';

/**
 * GameOverScreen — Modal UI shown after the player dies.
 *
 * Layout:
 *  ┌────────────────────────────┐
 *  │      FINITO!               │  ← big dramatic title
 *  │   You hit the wall!        │  ← cause line
 *  │                            │
 *  │   Score:   245             │
 *  │   Length:  78              │
 *  │   Best:    450             │  ← or "NEW BEST!" badge
 *  │                            │
 *  │      [ Play Again ]        │  ← big orange button
 *  └────────────────────────────┘
 *
 * Visually framed by a dark semi-transparent backdrop and a sauce-red panel.
 */
export default class GameOverScreen {
  constructor(scene, { score, length, highscore, isNewHighscore, cause, onRestart }) {
    this.scene = scene;
    this.score = score;
    this.length = length;
    this.highscore = highscore;
    this.isNewHighscore = isNewHighscore;
    this.cause = cause;
    this.onRestart = onRestart;

    this.objects = [];
    this.build();
  }

  build() {
    const { width, height } = this.scene.scale;

    // Dark backdrop (entire screen)
    const backdrop = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
      .setDepth(200)
      .setInteractive(); // blocks gameplay interactions underneath
    this.objects.push(backdrop);

    // Card panel
    const cardWidth = Math.min(560, width - 60);
    const cardHeight = 460;
    const cardX = width / 2;
    const cardY = height / 2;

    const cardShadow = this.scene.add
      .rectangle(cardX + 6, cardY + 8, cardWidth, cardHeight, 0x000000, 0.5)
      .setDepth(201);

    const card = this.scene.add
      .rectangle(cardX, cardY, cardWidth, cardHeight, 0x2d1810, 0.97)
      .setDepth(201)
      .setStrokeStyle(6, 0xc41e3a, 1);

    this.objects.push(cardShadow, card);

    // ---------------------------------------------------------------------
    // Title
    // ---------------------------------------------------------------------
    const title = this.scene.add
      .text(cardX, cardY - cardHeight / 2 + 60, t('game_over_title'), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '64px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 8
      })
      .setOrigin(0.5)
      .setDepth(202);
    this.objects.push(title);

    // Subtle entrance animation for the title
    title.setScale(0.5).setAlpha(0);
    this.scene.tweens.add({
      targets: title,
      scale: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut'
    });

    // Cause line
    const causeKey =
      this.cause === 'self'
        ? 'game_over_died_self'
        : this.cause === 'snake'
          ? 'game_over_died_snake'
          : 'game_over_died_wall';
    const causeLine = this.scene.add
      .text(cardX, cardY - cardHeight / 2 + 115, t(causeKey), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'italic'
      })
      .setOrigin(0.5)
      .setDepth(202);
    this.objects.push(causeLine);

    // ---------------------------------------------------------------------
    // Stats block
    // ---------------------------------------------------------------------
    const statsY = cardY - 50;
    const lineSpacing = 42;

    this.objects.push(
      this.buildStatLine(cardX, statsY, t('game_over_score'), String(this.score), '#ffd700')
    );
    this.objects.push(
      this.buildStatLine(cardX, statsY + lineSpacing, t('game_over_length'), String(this.length), '#ffffff')
    );

    // Best line — special treatment if it's a new best
    if (this.isNewHighscore) {
      this.buildNewBestRow(cardX, statsY + lineSpacing * 2);
    } else {
      this.objects.push(
        this.buildStatLine(
          cardX,
          statsY + lineSpacing * 2,
          t('game_over_best'),
          String(this.highscore),
          '#cccccc'
        )
      );
    }

    // ---------------------------------------------------------------------
    // Play Again button (big, daumenfreundlich)
    // ---------------------------------------------------------------------
    this.buildPlayAgainButton(cardX, cardY + cardHeight / 2 - 60);
  }

  buildStatLine(x, y, label, value, valueColor) {
    // Layout: left-aligned label + right-aligned value, both around center
    const labelText = this.scene.add
      .text(x - 30, y, `${label}:`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#ffffff'
      })
      .setOrigin(1, 0.5)
      .setDepth(202);

    const valueText = this.scene.add
      .text(x + 30, y, value, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '28px',
        color: valueColor,
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0, 0.5)
      .setDepth(202);

    this.objects.push(labelText);
    return valueText; // returns the value text for potential extra animation
  }

  /**
   * Special-case the high-score row when it's a new best.
   * Gold gradient look, larger, slight bounce in.
   */
  buildNewBestRow(x, y) {
    // "NEW BEST!" badge
    const badge = this.scene.add
      .text(x - 30, y, t('game_over_new_best'), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '24px',
        color: '#000000',
        backgroundColor: '#ffd700',
        padding: { x: 12, y: 6 },
        stroke: '#000000',
        strokeThickness: 2
      })
      .setOrigin(1, 0.5)
      .setDepth(202);

    const value = this.scene.add
      .text(x + 30, y, String(this.score), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '34px',
        color: '#ffd700',
        stroke: '#8b0000',
        strokeThickness: 5
      })
      .setOrigin(0, 0.5)
      .setDepth(202);

    this.objects.push(badge, value);

    // Bounce-in animation, then a slow pulse
    badge.setScale(0).setAlpha(0);
    value.setScale(0).setAlpha(0);

    this.scene.tweens.add({
      targets: [badge, value],
      scale: 1,
      alpha: 1,
      duration: 500,
      delay: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Slow heartbeat-style pulse on the badge
        this.scene.tweens.add({
          targets: badge,
          scale: { from: 1, to: 1.1 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    });
  }

  buildPlayAgainButton(x, y) {
    const label = t('game_over_play_again');
    const padX = 30;
    const padY = 14;
    const textWidth = label.length * 17;
    const buttonWidth = Math.max(220, textWidth + padX * 2);
    const buttonHeight = 64;

    const shadow = this.scene.add
      .rectangle(x + 4, y + 6, buttonWidth, buttonHeight, 0x000000, 0.5)
      .setDepth(202);

    const bg = this.scene.add
      .rectangle(x, y, buttonWidth, buttonHeight, 0xff6b35, 1)
      .setDepth(203)
      .setStrokeStyle(4, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const text = this.scene.add
      .text(x, y, label, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(204);

    bg.on('pointerover', () => {
      bg.setScale(1.05);
      text.setScale(1.05);
    });
    bg.on('pointerout', () => {
      bg.setScale(1);
      text.setScale(1);
    });
    bg.on('pointerdown', () => {
      bg.setScale(0.95);
      text.setScale(0.95);
    });
    bg.on('pointerup', () => {
      bg.setScale(1);
      text.setScale(1);
      if (typeof this.onRestart === 'function') {
        this.onRestart();
      }
    });

    // Idle pulse to draw attention
    this.scene.tweens.add({
      targets: [bg, text],
      scale: { from: 1, to: 1.06 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.objects.push(shadow, bg, text);
  }

  destroy() {
    this.objects.forEach((o) => {
      if (o && o.destroy) o.destroy();
    });
    this.objects = [];
  }
}
