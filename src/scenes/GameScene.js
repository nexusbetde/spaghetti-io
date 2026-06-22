import SpaghettiPlayer from '../game/SpaghettiPlayer.js';
import Meatball from '../game/Meatball.js';
import TutorialOverlay from '../ui/TutorialOverlay.js';
import { t } from '../i18n.js';
import { isTouchDevice, hasSeenTutorial } from '../utils/device.js';

/**
 * GameScene — Main gameplay.
 *
 * Step 3.5: CrazyGames Polish
 *  - i18n: all visible strings via t()
 *  - Touch device detection + dedicated on-screen boost button
 *  - Visual tutorial overlay on first play
 *  - Goal banner ("Eat to grow!") in the first seconds
 *  - Cleaner HUD without developer status text
 *  - Mobile fix: finger position controls direction, boost is its own button
 */

// Game constants
const MEATBALL_COUNT = 35;
const MAGNET_RADIUS = 90;
const SPAWN_MIN_DIST_FROM_PLAYER = 120;

// Mobile boost button
const BOOST_BTN_RADIUS = 55;
const BOOST_BTN_MARGIN = 28;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;

    this.isTouch = isTouchDevice();
    this.worldBounds = { width, height };

    // Background
    this.drawCheckerboard();

    // Player
    this.player = new SpaghettiPlayer(this, width / 2, height / 2);

    // Direction target (updated by mouse/touch)
    this.targetX = width / 2;
    this.targetY = height / 2;

    // Score
    this.score = 0;

    // Meatballs
    this.meatballs = [];

    // Input
    this.setupInput();

    // HUD
    this.createHUD();

    // Mobile boost button (only on touch devices)
    this.boostButton = null;
    if (this.isTouch) {
      this.createMobileBoostButton();
    }

    // Spawn initial meatballs
    for (let i = 0; i < MEATBALL_COUNT; i++) {
      this.spawnMeatball();
    }

    // Show tutorial overlay on first ever play
    if (!hasSeenTutorial()) {
      this.tutorial = new TutorialOverlay(this, {
        isTouch: this.isTouch,
        onDismiss: () => {
          this.tutorial = null;
          this.showGoalBanner();
        }
      });
    } else {
      // Returning player: still show the brief goal banner
      this.showGoalBanner();
    }
  }

  update() {
    // Player follows target
    this.player.update(this.targetX, this.targetY, this.worldBounds);

    // Meatball magnet + collision
    this.processMeatballs();

    // HUD updates
    this.boostIndicator.setVisible(this.player.isBoosting);
  }

  // ---------------------------------------------------------------------------
  // Meatball logic
  // ---------------------------------------------------------------------------

  processMeatballs() {
    const headX = this.player.headX;
    const headY = this.player.headY;
    const eatRadius = this.player.headRadius;

    for (let i = this.meatballs.length - 1; i >= 0; i--) {
      const m = this.meatballs[i];
      const dist = m.updatePull(headX, headY, MAGNET_RADIUS);

      if (dist < eatRadius + m.radius) {
        this.eatMeatball(m, i);
      }
    }
  }

  spawnMeatball() {
    const { width, height } = this.scale;
    const margin = 40;

    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
      x = Phaser.Math.Between(margin, width - margin);
      y = Phaser.Math.Between(margin, height - margin);
      const distToPlayer = Math.hypot(x - this.player.headX, y - this.player.headY);
      if (distToPlayer >= SPAWN_MIN_DIST_FROM_PLAYER) break;
    }

    const type = Meatball.randomType();
    this.meatballs.push(new Meatball(this, x, y, type));
  }

  eatMeatball(meatball, idx) {
    this.score += meatball.value;
    this.scoreText.setText(`${t('hud_score')}: ${this.score}`);
    this.popScore();

    this.player.grow(meatball.growth);
    this.lengthText.setText(`${t('hud_length')}: ${this.player.length}`);

    this.showEatBurst(meatball.x, meatball.y, meatball.value, meatball.type === 'golden');

    meatball.destroy();
    this.meatballs.splice(idx, 1);
    this.spawnMeatball();
  }

  showEatBurst(x, y, points, isGolden) {
    // Floating "+N"
    const text = this.add
      .text(x, y, `+${points}`, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: isGolden ? '34px' : '22px',
        color: isGolden ? '#ffd700' : '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(25);

    this.tweens.add({
      targets: text,
      y: y - 55,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy()
    });

    const burstColor = isGolden ? 0xffd700 : 0xcd853f;
    const particleCount = isGolden ? 10 : 6;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 / particleCount) * i + Math.random() * 0.3;
      const speed = 35 + Math.random() * 45;
      const size = 2.5 + Math.random() * 2;

      const p = this.add.circle(x, y, size, burstColor).setDepth(20);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        scale: 0,
        alpha: 0,
        duration: 400 + Math.random() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy()
      });
    }
  }

  popScore() {
    this.tweens.killTweensOf(this.scoreText);
    this.scoreText.setScale(1);
    this.tweens.add({
      targets: this.scoreText,
      scale: { from: 1.3, to: 1 },
      duration: 220,
      ease: 'Back.easeOut'
    });
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  setupInput() {
    // Direction tracking — pointer position controls steering
    this.input.on('pointermove', (pointer) => {
      if (this.isPointerOverBoostButton(pointer)) return;
      this.targetX = pointer.x;
      this.targetY = pointer.y;
    });

    this.input.on('pointerdown', (pointer) => {
      if (this.isPointerOverBoostButton(pointer)) return;
      this.targetX = pointer.x;
      this.targetY = pointer.y;

      // Desktop: click = boost. Mobile uses the dedicated button instead so
      // that finger drag does not constantly trigger boost.
      if (!this.isTouch) {
        this.player.setBoosting(true);
      }
    });

    this.input.on('pointerup', () => {
      if (!this.isTouch) {
        this.player.setBoosting(false);
      }
    });

    this.input.on('pointerout', () => {
      if (!this.isTouch) {
        this.player.setBoosting(false);
      }
    });

    // Keyboard boost (Desktop, supports both common boost keys)
    const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey.on('down', () => this.player.setBoosting(true));
    spaceKey.on('up', () => this.player.setBoosting(false));

    const shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    shiftKey.on('down', () => this.player.setBoosting(true));
    shiftKey.on('up', () => this.player.setBoosting(false));
  }

  isPointerOverBoostButton(pointer) {
    if (!this.boostButton) return false;
    const dx = pointer.x - this.boostButton.cx;
    const dy = pointer.y - this.boostButton.cy;
    return dx * dx + dy * dy < (this.boostButton.hitRadius * this.boostButton.hitRadius);
  }

  // ---------------------------------------------------------------------------
  // Mobile boost button
  // ---------------------------------------------------------------------------

  createMobileBoostButton() {
    const { width, height } = this.scale;
    const cx = width - BOOST_BTN_MARGIN - BOOST_BTN_RADIUS;
    const cy = height - BOOST_BTN_MARGIN - BOOST_BTN_RADIUS;

    // Outer pulse ring (visual attention-grabber, auto-disappears)
    const pulseRing = this.add.circle(cx, cy, BOOST_BTN_RADIUS + 6, 0xff6b35, 0).setDepth(49);
    pulseRing.setStrokeStyle(4, 0xff6b35, 0.7);
    const pulseTween = this.tweens.add({
      targets: pulseRing,
      radius: BOOST_BTN_RADIUS + 30,
      alpha: { from: 0.9, to: 0 },
      duration: 900,
      repeat: -1,
      ease: 'Cubic.easeOut'
    });
    this.time.delayedCall(8000, () => {
      pulseTween.stop();
      pulseRing.destroy();
    });

    // The actual button
    const bg = this.add
      .circle(cx, cy, BOOST_BTN_RADIUS, 0xff6b35, 0.55)
      .setDepth(50)
      .setStrokeStyle(4, 0xffffff, 0.85)
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(cx, cy + 2, '\u26A1', { fontSize: '54px' })
      .setOrigin(0.5)
      .setDepth(51);

    const subLabel = this.add
      .text(cx, cy + 38, t('boost_button_label'), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(51);

    const setActive = (active) => {
      if (active) {
        bg.setFillStyle(0xff6b35, 1);
        bg.setScale(0.92);
      } else {
        bg.setFillStyle(0xff6b35, 0.55);
        bg.setScale(1);
      }
      this.player.setBoosting(active);
    };

    bg.on('pointerdown', () => setActive(true));
    bg.on('pointerup', () => setActive(false));
    bg.on('pointerupoutside', () => setActive(false));
    bg.on('pointerout', () => setActive(false));

    this.boostButton = {
      cx,
      cy,
      hitRadius: BOOST_BTN_RADIUS + 14,
      bg,
      label,
      subLabel
    };
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  createHUD() {
    const padX = 16;
    const padY = 14;

    // Score (top right)
    this.scoreText = this.add
      .text(this.scale.width - padX, padY, `${t('hud_score')}: 0`, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '28px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 5
      })
      .setOrigin(1, 0)
      .setDepth(20);

    this.lengthText = this.add
      .text(this.scale.width - padX, padY + 38, `${t('hud_length')}: ${this.player.length}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 10, y: 6 }
      })
      .setOrigin(1, 0)
      .setDepth(20);

    // Boost indicator (center top) — visible only while boosting
    this.boostIndicator = this.add
      .text(this.scale.width / 2, 40, t('hud_boost_label'), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '36px',
        color: '#ff6b35',
        stroke: '#000000',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);

    this.tweens.add({
      targets: this.boostIndicator,
      scale: { from: 1, to: 1.15 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // ---------------------------------------------------------------------------
  // Goal banner — brief intro hint
  // ---------------------------------------------------------------------------

  showGoalBanner() {
    const { width } = this.scale;
    const cy = 110;

    const line1 = this.add
      .text(width / 2, cy, t('goal_eat'), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0);

    const line2 = this.add
      .text(width / 2, cy + 38, t('goal_golden'), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '20px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0);

    // Fade in
    this.tweens.add({
      targets: [line1, line2],
      alpha: 1,
      duration: 400,
      ease: 'Cubic.easeOut'
    });

    // Fade out after 4 seconds
    this.time.delayedCall(4000, () => {
      this.tweens.add({
        targets: [line1, line2],
        alpha: 0,
        y: '-=20',
        duration: 600,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          line1.destroy();
          line2.destroy();
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Background
  // ---------------------------------------------------------------------------

  drawCheckerboard() {
    const tileSize = 80;
    const { width, height } = this.scale;
    const graphics = this.add.graphics().setDepth(0);

    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        graphics.fillStyle(isEven ? 0xc41e3a : 0xffffff, 0.12);
        graphics.fillRect(x, y, tileSize, tileSize);
      }
    }
  }
}
