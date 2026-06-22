import SpaghettiPlayer from '../game/SpaghettiPlayer.js';
import Meatball from '../game/Meatball.js';
import TutorialOverlay from '../ui/TutorialOverlay.js';
import GameOverScreen from '../ui/GameOverScreen.js';
import { t } from '../i18n.js';
import {
  isTouchDevice,
  hasSeenTutorial,
  getHighScore,
  maybeSetHighScore
} from '../utils/device.js';

/**
 * GameScene — Main gameplay.
 *
 * Step 4: Death, Game Over, Restart
 *  - Head hits wall    -> die
 *  - Head hits own body (with safe-zone offset) -> die
 *  - Dramatic death animation: sauce splatter, body segments fly out,
 *    camera shake
 *  - Body becomes a trail of meatballs (prep for bots in step 5)
 *  - Game Over screen with score / length / best, "New Best!" celebration
 *  - "Play Again" button restarts the scene
 */

// Game constants
const MEATBALL_COUNT = 35;
const MAGNET_RADIUS = 90;
const SPAWN_MIN_DIST_FROM_PLAYER = 120;

// Mobile boost button
const BOOST_BTN_RADIUS = 55;
const BOOST_BTN_MARGIN = 28;

// Death
const DEATH_ANIM_DURATION = 1400;      // ms until game over screen appears
const SELF_COLLISION_SAFE_SEGMENTS = 12;
const DEATH_DROP_EVERY_NTH_SEGMENT = 3; // every 3rd body segment becomes a meatball

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

    // State
    this.score = 0;
    this.gameOver = false;
    this.gameOverScreen = null;
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

    // Tutorial on first ever play, otherwise just the goal banner
    if (!hasSeenTutorial()) {
      this.tutorial = new TutorialOverlay(this, {
        isTouch: this.isTouch,
        onDismiss: () => {
          this.tutorial = null;
          this.showGoalBanner();
        }
      });
    } else {
      this.showGoalBanner();
    }
  }

  update() {
    // While dead nothing moves
    if (this.gameOver) return;

    // Player follows target
    this.player.update(this.targetX, this.targetY, this.worldBounds);

    // Collision: wall
    if (this.player.checkWallCollision(this.worldBounds)) {
      this.die('wall');
      return;
    }

    // Collision: self
    if (this.player.checkSelfCollision(SELF_COLLISION_SAFE_SEGMENTS)) {
      this.die('self');
      return;
    }

    // Meatball magnet + collision
    this.processMeatballs();

    // HUD: boost indicator
    this.boostIndicator.setVisible(this.player.isBoosting);
  }

  // ---------------------------------------------------------------------------
  // Death and restart
  // ---------------------------------------------------------------------------

  die(cause) {
    if (this.gameOver) return;
    this.gameOver = true;

    // 1) Capture player state for the death effects
    const deathData = this.player.captureDeathState();

    // 2) Stop the player and hide its visuals (they will be replaced by debris)
    this.player.kill();
    this.player.setVisible(false);

    // 3) Visual chaos: sauce splatter + body debris + camera shake
    this.playSauceSplatter(deathData.headX, deathData.headY);
    this.playBodyDebris(deathData);
    this.cameras.main.shake(380, 0.008);

    // 4) Drop a trail of meatballs along the body — food for future bots
    this.dropDeathMeatballs(deathData.segments);

    // 5) Update highscore. maybeSetHighScore returns true only when beaten.
    const previousBest = getHighScore();
    const isNewBest = maybeSetHighScore(this.score);

    // 6) Show the game over screen after the death anim has had time to land
    this.time.delayedCall(DEATH_ANIM_DURATION, () => {
      this.gameOverScreen = new GameOverScreen(this, {
        score: this.score,
        length: deathData.segments.length,
        highscore: isNewBest ? this.score : previousBest,
        isNewHighscore: isNewBest,
        cause,
        onRestart: () => this.restart()
      });
    });
  }

  restart() {
    // Phaser.Scene.restart() destroys all game objects, then re-runs create()
    // — exactly the clean slate we want. The tutorial flag in localStorage
    // ensures the tutorial does not show again, but the goal banner does.
    this.scene.restart();
  }

  /**
   * Sauce splatter from the head — radial burst of red blobs.
   * Some stay on the floor as longer-lived stains.
   */
  playSauceSplatter(x, y) {
    const blobCount = 22;
    for (let i = 0; i < blobCount; i++) {
      const angle = (Math.PI * 2 / blobCount) * i + Math.random() * 0.5;
      const speed = 70 + Math.random() * 130;
      const size = 4 + Math.random() * 9;

      const blob = this.add.circle(x, y, size, 0xc41e3a, 1).setDepth(15);

      this.tweens.add({
        targets: blob,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        scale: { from: 1, to: 1.4 },
        duration: 700,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          // Leave a fading stain on the floor
          this.tweens.add({
            targets: blob,
            alpha: 0,
            duration: 2500,
            delay: 1500,
            onComplete: () => blob.destroy()
          });
        }
      });
    }
  }

  /**
   * Each body segment becomes a falling/rotating chunk that fades out.
   * Visually communicates "the spaghetti broke apart".
   */
  playBodyDebris(deathData) {
    deathData.segments.forEach((seg, i) => {
      // Filled circle in body color, with a slightly darker outline
      const piece = this.add.circle(seg.x, seg.y, seg.radius, deathData.bodyColor).setDepth(14);
      piece.setStrokeStyle(2, deathData.bodyOutline, 1);

      const angle = Math.random() * Math.PI * 2;
      const speed = 25 + Math.random() * 80;

      this.tweens.add({
        targets: piece,
        x: seg.x + Math.cos(angle) * speed,
        y: seg.y + Math.sin(angle) * speed,
        alpha: 0,
        scale: { from: 1, to: 0.6 },
        rotation: (Math.random() - 0.5) * Math.PI * 2,
        duration: 700 + Math.random() * 400,
        delay: i * 6,
        ease: 'Cubic.easeOut',
        onComplete: () => piece.destroy()
      });
    });

    // Head explosion: a bigger gold flash that fades out
    const headFlash = this.add
      .circle(deathData.headX, deathData.headY, deathData.headRadius, deathData.headColor)
      .setDepth(16);
    this.tweens.add({
      targets: headFlash,
      scale: { from: 1, to: 2.5 },
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => headFlash.destroy()
    });
  }

  /**
   * Spawn a sparse trail of meatballs along the path the snake used.
   * In step 5 (bots) this becomes a reward for whoever moves in next.
   */
  dropDeathMeatballs(segmentPositions) {
    for (let i = 0; i < segmentPositions.length; i += DEATH_DROP_EVERY_NTH_SEGMENT) {
      const seg = segmentPositions[i];
      const jitter = 14;
      const x = seg.x + (Math.random() - 0.5) * jitter;
      const y = seg.y + (Math.random() - 0.5) * jitter;
      // Every ~5th drop is golden — incentive for bots/players to go look
      const type = (i % (DEATH_DROP_EVERY_NTH_SEGMENT * 5) === 0) ? 'golden' : 'normal';
      this.meatballs.push(new Meatball(this, x, y, type));
    }
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
    this.input.on('pointermove', (pointer) => {
      if (this.isPointerOverBoostButton(pointer)) return;
      this.targetX = pointer.x;
      this.targetY = pointer.y;
    });

    this.input.on('pointerdown', (pointer) => {
      if (this.isPointerOverBoostButton(pointer)) return;
      this.targetX = pointer.x;
      this.targetY = pointer.y;

      // Desktop click = boost. Mobile uses the dedicated button.
      if (!this.isTouch && !this.gameOver) {
        this.player.setBoosting(true);
      }
    });

    this.input.on('pointerup', () => {
      if (!this.isTouch && this.player) {
        this.player.setBoosting(false);
      }
    });

    this.input.on('pointerout', () => {
      if (!this.isTouch && this.player) {
        this.player.setBoosting(false);
      }
    });

    const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey.on('down', () => {
      if (!this.gameOver) this.player.setBoosting(true);
    });
    spaceKey.on('up', () => this.player?.setBoosting(false));

    const shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    shiftKey.on('down', () => {
      if (!this.gameOver) this.player.setBoosting(true);
    });
    shiftKey.on('up', () => this.player?.setBoosting(false));
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
      if (this.gameOver) active = false;
      if (active) {
        bg.setFillStyle(0xff6b35, 1);
        bg.setScale(0.92);
      } else {
        bg.setFillStyle(0xff6b35, 0.55);
        bg.setScale(1);
      }
      this.player?.setBoosting(active);
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

    // Length under score
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

    // Best score (top left) — small badge so player always knows the target
    const best = getHighScore();
    if (best > 0) {
      this.add
        .text(padX, padY, `${t('game_over_best')}: ${best}`, {
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '16px',
          color: '#ffd700',
          backgroundColor: '#000000aa',
          padding: { x: 10, y: 6 },
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0, 0)
        .setDepth(20);
    }

    // Boost indicator (center top)
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

    this.tweens.add({
      targets: [line1, line2],
      alpha: 1,
      duration: 400,
      ease: 'Cubic.easeOut'
    });

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
