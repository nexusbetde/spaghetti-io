import SpaghettiPlayer from '../game/SpaghettiPlayer.js';
import Meatball from '../game/Meatball.js';
import BotAI, { BOT_PALETTES } from '../game/BotAI.js';
import TutorialOverlay from '../ui/TutorialOverlay.js';
import GameOverScreen from '../ui/GameOverScreen.js';
import Leaderboard from '../ui/Leaderboard.js';
import { t } from '../i18n.js';
import {
  isTouchDevice,
  hasSeenTutorial,
  getHighScore,
  maybeSetHighScore
} from '../utils/device.js';

/**
 * GameScene — Hauptspiel mit Spieler, KI-Bots und Multi-Snake-Kollisionen.
 *
 * Schritt 5b: Groessere Welt + Kamera + bessere Bot-AI
 *  - World ist jetzt 2560x1440 (4x Flaeche), Kamera folgt dem Spieler weich
 *  - HUD-Elemente auf scrollFactor(0) — bleiben am Bildschirmrand
 *  - 8 Bots statt 6, 80 Fleischbaellchen statt 50 (passend zur groesseren Karte)
 *  - Sichtbare Welt-Boundary in Sauce-Rot, damit der Rand spuerbar wird
 */

// Welt
const WORLD_WIDTH = 2560;
const WORLD_HEIGHT = 1440;

// Spielfeld-Inhalt
const MEATBALL_COUNT = 80;
const MAGNET_RADIUS = 90;
const SPAWN_MIN_DIST_FROM_PLAYER = 160;

// Bots
const BOT_COUNT = 8;
const BOT_RESPAWN_DELAY_MIN = 2200;
const BOT_RESPAWN_DELAY_MAX = 4500;
const PLAYER_KILL_BONUS = 50;

// Snake-Kollision
const SELF_COLLISION_SAFE_SEGMENTS = 12;

// Mobile boost button
const BOOST_BTN_RADIUS = 55;
const BOOST_BTN_MARGIN = 28;

// Death
const DEATH_ANIM_DURATION = 1400;
const DEATH_DROP_EVERY_NTH_SEGMENT = 3;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.isTouch = isTouchDevice();
    this.worldBounds = { width: WORLD_WIDTH, height: WORLD_HEIGHT };

    // === Hintergrund (fuellt die GANZE Welt, nicht nur den Viewport) ===
    this.drawCheckerboard();
    this.drawWorldBorder();

    // === Spieler in der Weltmitte ===
    this.player = new SpaghettiPlayer(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2, {
      name: t('you'),
      nameColor: '#ffd700'
    });

    // Steuerungs-Ziel (Welt-Koordinaten)
    this.targetX = WORLD_WIDTH / 2;
    this.targetY = WORLD_HEIGHT / 2;

    // === Kamera-Setup ===
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    // Unsichtbarer Follow-Target, dessen Position wir jeden Frame an den Kopf ankoppeln
    this.cameraFollow = this.add.zone(this.player.headX, this.player.headY, 1, 1);
    this.cameras.main.startFollow(this.cameraFollow, true, 0.14, 0.14);
    this.cameras.main.setBackgroundColor('#2d1810');

    // State
    this.score = 0;
    this.gameOver = false;
    this.gameOverScreen = null;
    this.meatballs = [];
    this.bots = [];

    this.inputEnabled = false;
    this.spawnTime = this.time.now;
    this.hasMoved = false;
    this.startHint = null;

    // Input
    this.setupInput();

    // HUD (alles mit scrollFactor(0))
    this.createHUD();

    // Mobile boost button
    this.boostButton = null;
    if (this.isTouch) {
      this.createMobileBoostButton();
    }

    // Spawns
    this.spawnInitialMeatballs();
    this.spawnBots();

    // Leaderboard rechts oberhalb des Best-Badges (oder ganz oben links)
    this.leaderboard = new Leaderboard(this, 16, getHighScore() > 0 ? 56 : 16);

    // Tutorial / Start-Hinweis
    if (!hasSeenTutorial()) {
      this.tutorial = new TutorialOverlay(this, {
        isTouch: this.isTouch,
        onDismiss: () => {
          this.tutorial = null;
          this.inputEnabled = true;
          this.spawnTime = this.time.now;
          this.showStartHint();
          this.showGoalBanner();
        }
      });
    } else {
      this.inputEnabled = true;
      this.showStartHint();
      this.showGoalBanner();
    }
  }

  update() {
    if (this.gameOver) return;

    // 1) Spieler bewegen
    this.player.update(this.targetX, this.targetY, this.worldBounds);

    // 2) Bots bewegen
    const allSnakes = this.collectActiveSnakes();
    for (const bot of this.bots) {
      bot.update(this.meatballs, this.snakesExcluding(bot.snake, allSnakes), this.worldBounds);
    }

    // 3) Kamera ans Kopf-Follow-Target koppeln
    this.cameraFollow.setPosition(this.player.headX, this.player.headY);

    // 4) Kollisionen (mit Spawn-Schonfrist)
    const SPAWN_GRACE_MS = 800;
    const inGracePeriod = this.time.now - this.spawnTime < SPAWN_GRACE_MS;

    if (!inGracePeriod) {
      if (this.player.checkWallCollision(this.worldBounds)) {
        this.die('wall');
        return;
      }
      if (this.player.checkSelfCollision(SELF_COLLISION_SAFE_SEGMENTS)) {
        this.die('self');
        return;
      }
      for (const bot of this.bots) {
        if (bot.snake.isDead) continue;
        if (this.player.checkCollisionWith(bot.snake)) {
          this.die('snake');
          return;
        }
      }
      this.processBotCollisions();
    }

    // 5) Fleischbaellchen
    this.processMeatballs();

    // 6) HUD-Updates
    this.boostIndicator.setVisible(this.player.isBoosting);
    this.lengthText.setText(`${t('hud_length')}: ${this.player.length}`);
    this.leaderboard.update(this.collectLeaderboardEntries());
  }

  // ---------------------------------------------------------------------------
  // Snake-Helpers
  // ---------------------------------------------------------------------------

  collectActiveSnakes() {
    const list = [];
    if (!this.player.isDead) list.push(this.player);
    for (const bot of this.bots) if (!bot.snake.isDead) list.push(bot.snake);
    return list;
  }

  snakesExcluding(exclude, list) {
    return list.filter((s) => s !== exclude);
  }

  collectLeaderboardEntries() {
    const entries = [];
    entries.push({
      name: t('you'),
      length: this.player.length,
      isPlayer: true,
      alive: !this.player.isDead
    });
    for (const bot of this.bots) {
      entries.push({
        name: bot.name,
        length: bot.snake.length,
        isPlayer: false,
        alive: !bot.snake.isDead
      });
    }
    return entries;
  }

  // ---------------------------------------------------------------------------
  // Bot-Lifecycle
  // ---------------------------------------------------------------------------

  spawnBots() {
    const palettes = Phaser.Utils.Array.Shuffle(BOT_PALETTES.slice()).slice(0, BOT_COUNT);
    for (const palette of palettes) {
      const pos = this.findSafeSpawnPoint();
      this.bots.push(new BotAI(this, palette, pos.x, pos.y));
    }
  }

  findSafeSpawnPoint() {
    const margin = 160;
    const minDist = 220;

    let best = null;
    let bestScore = -1;

    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Phaser.Math.Between(margin, WORLD_WIDTH - margin);
      const y = Phaser.Math.Between(margin, WORLD_HEIGHT - margin);

      let minD = Infinity;
      for (const s of this.collectActiveSnakes()) {
        const d = Math.hypot(x - s.headX, y - s.headY);
        if (d < minD) minD = d;
      }

      if (minD > bestScore) {
        bestScore = minD;
        best = { x, y };
      }
      if (minD >= minDist) break;
    }

    return best || { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
  }

  processBotCollisions() {
    for (const bot of this.bots) {
      if (bot.snake.isDead) continue;
      const snake = bot.snake;

      if (snake.checkWallCollision(this.worldBounds)) {
        this.killBot(bot, 'wall');
        continue;
      }
      if (snake.checkSelfCollision(SELF_COLLISION_SAFE_SEGMENTS)) {
        this.killBot(bot, 'self');
        continue;
      }
      if (snake.checkCollisionWith(this.player)) {
        this.killBot(bot, 'player');
        this.awardKillBonus(snake.headX, snake.headY);
        continue;
      }
      let killed = false;
      for (const other of this.bots) {
        if (other === bot || other.snake.isDead) continue;
        if (snake.checkCollisionWith(other.snake)) {
          this.killBot(bot, 'bot');
          killed = true;
          break;
        }
      }
      if (killed) continue;
    }
  }

  killBot(bot, cause) {
    if (bot.snake.isDead) return;

    const data = bot.snake.captureDeathState();
    bot.snake.kill();
    bot.snake.setVisible(false);

    this.playSauceSplatter(data.headX, data.headY);
    this.playBodyDebris(data);
    this.dropDeathMeatballs(data.segments);

    const delay = BOT_RESPAWN_DELAY_MIN + Math.random() * (BOT_RESPAWN_DELAY_MAX - BOT_RESPAWN_DELAY_MIN);
    this.time.delayedCall(delay, () => this.respawnBot(bot));
  }

  respawnBot(bot) {
    if (this.gameOver) return;
    const pos = this.findSafeSpawnPoint();
    bot.snake.respawn(pos.x, pos.y);
  }

  awardKillBonus(x, y) {
    this.score += PLAYER_KILL_BONUS;
    this.scoreText.setText(`${t('hud_score')}: ${this.score}`);
    this.popScore();

    // Schwebender Bonus-Text an der Welt-Position des Kills
    const txt = this.add
      .text(x, y, `+${PLAYER_KILL_BONUS} ${t('kill_bonus')}`, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '26px',
        color: '#ff6b35',
        stroke: '#000000',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.tweens.add({
      targets: txt,
      y: y - 80,
      alpha: 0,
      scale: 1.3,
      duration: 1200,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy()
    });
  }

  // ---------------------------------------------------------------------------
  // Spieler-Tod und Restart
  // ---------------------------------------------------------------------------

  die(cause) {
    if (this.gameOver) return;
    this.gameOver = true;

    const deathData = this.player.captureDeathState();

    this.player.kill();
    this.player.setVisible(false);

    this.playSauceSplatter(deathData.headX, deathData.headY);
    this.playBodyDebris(deathData);
    this.cameras.main.shake(380, 0.008);

    this.dropDeathMeatballs(deathData.segments);

    const previousBest = getHighScore();
    const isNewBest = maybeSetHighScore(this.score);

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
    this.scene.restart();
  }

  // ---------------------------------------------------------------------------
  // Visuelle Death-Effekte
  // ---------------------------------------------------------------------------

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

  playBodyDebris(deathData) {
    deathData.segments.forEach((seg, i) => {
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

  dropDeathMeatballs(segmentPositions) {
    for (let i = 0; i < segmentPositions.length; i += DEATH_DROP_EVERY_NTH_SEGMENT) {
      const seg = segmentPositions[i];
      const jitter = 14;
      const x = seg.x + (Math.random() - 0.5) * jitter;
      const y = seg.y + (Math.random() - 0.5) * jitter;
      const type = (i % (DEATH_DROP_EVERY_NTH_SEGMENT * 5) === 0) ? 'golden' : 'normal';
      this.meatballs.push(new Meatball(this, x, y, type));
    }
  }

  // ---------------------------------------------------------------------------
  // Fleischbaellchen (jetzt fuer ALLE Snakes)
  // ---------------------------------------------------------------------------

  spawnInitialMeatballs() {
    for (let i = 0; i < MEATBALL_COUNT; i++) {
      this.spawnMeatball();
    }
  }

  spawnMeatball() {
    const margin = 40;
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
      x = Phaser.Math.Between(margin, WORLD_WIDTH - margin);
      y = Phaser.Math.Between(margin, WORLD_HEIGHT - margin);
      const distToPlayer = Math.hypot(x - this.player.headX, y - this.player.headY);
      if (distToPlayer >= SPAWN_MIN_DIST_FROM_PLAYER) break;
    }
    const type = Meatball.randomType();
    this.meatballs.push(new Meatball(this, x, y, type));
  }

  processMeatballs() {
    const snakes = this.collectActiveSnakes();
    if (snakes.length === 0) return;

    for (let i = this.meatballs.length - 1; i >= 0; i--) {
      const m = this.meatballs[i];

      let closestSnake = null;
      let closestDist = Infinity;
      for (const s of snakes) {
        const d = Math.hypot(s.headX - m.x, s.headY - m.y);
        if (d < closestDist) {
          closestDist = d;
          closestSnake = s;
        }
      }
      if (!closestSnake) continue;

      m.updatePull(closestSnake.headX, closestSnake.headY, MAGNET_RADIUS);

      const dist = Math.hypot(closestSnake.headX - m.x, closestSnake.headY - m.y);
      if (dist < closestSnake.headRadius + m.radius) {
        this.handleMeatballEaten(m, i, closestSnake);
      }
    }

    while (this.meatballs.length < MEATBALL_COUNT) {
      this.spawnMeatball();
    }
  }

  handleMeatballEaten(meatball, idx, snake) {
    snake.grow(meatball.growth);

    if (snake === this.player) {
      this.score += meatball.value;
      this.scoreText.setText(`${t('hud_score')}: ${this.score}`);
      this.popScore();
      this.showEatBurst(meatball.x, meatball.y, meatball.value, meatball.type === 'golden');
    }

    meatball.destroy();
    this.meatballs.splice(idx, 1);
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
  // Input — Pointer-Position via worldX/worldY (durch Kamera transformiert)
  // ---------------------------------------------------------------------------

  setupInput() {
    this.input.on('pointermove', (pointer) => {
      if (!this.inputEnabled) return;
      if (this.isPointerOverBoostButton(pointer)) return;
      this.targetX = pointer.worldX;
      this.targetY = pointer.worldY;
      this.markPlayerHasMoved();
    });

    this.input.on('pointerdown', (pointer) => {
      if (!this.inputEnabled) return;
      if (this.isPointerOverBoostButton(pointer)) return;
      this.targetX = pointer.worldX;
      this.targetY = pointer.worldY;
      this.markPlayerHasMoved();

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
      if (!this.inputEnabled || this.gameOver) return;
      this.player.setBoosting(true);
    });
    spaceKey.on('up', () => this.player?.setBoosting(false));

    const shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    shiftKey.on('down', () => {
      if (!this.inputEnabled || this.gameOver) return;
      this.player.setBoosting(true);
    });
    shiftKey.on('up', () => this.player?.setBoosting(false));
  }

  markPlayerHasMoved() {
    if (this.hasMoved) return;
    this.hasMoved = true;
    this.spawnTime = this.time.now;
    this.fadeStartHint();
  }

  // Boost-Button-Position ist im SCREEN-Space (scrollFactor 0), also pointer.x verwenden.
  isPointerOverBoostButton(pointer) {
    if (!this.boostButton) return false;
    const dx = pointer.x - this.boostButton.cx;
    const dy = pointer.y - this.boostButton.cy;
    return dx * dx + dy * dy < (this.boostButton.hitRadius * this.boostButton.hitRadius);
  }

  // ---------------------------------------------------------------------------
  // Mobile boost button (Screen-fixed)
  // ---------------------------------------------------------------------------

  createMobileBoostButton() {
    const cx = this.scale.width - BOOST_BTN_MARGIN - BOOST_BTN_RADIUS;
    const cy = this.scale.height - BOOST_BTN_MARGIN - BOOST_BTN_RADIUS;

    const pulseRing = this.add
      .circle(cx, cy, BOOST_BTN_RADIUS + 6, 0xff6b35, 0)
      .setDepth(49)
      .setScrollFactor(0);
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
      .setScrollFactor(0)
      .setStrokeStyle(4, 0xffffff, 0.85)
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(cx, cy + 2, '\u26A1', { fontSize: '54px' })
      .setOrigin(0.5)
      .setDepth(51)
      .setScrollFactor(0);

    const subLabel = this.add
      .text(cx, cy + 38, t('boost_button_label'), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(51)
      .setScrollFactor(0);

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
  // HUD (alles screen-fixed via scrollFactor(0))
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
      .setDepth(20)
      .setScrollFactor(0);

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
      .setDepth(20)
      .setScrollFactor(0);

    // Best (top left)
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
        .setDepth(20)
        .setScrollFactor(0);
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
      .setScrollFactor(0)
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
  // Start-Hinweis (Screen-fixed)
  // ---------------------------------------------------------------------------

  showStartHint() {
    const w = this.scale.width;
    const h = this.scale.height;

    const hintKey = this.isTouch ? 'start_hint_mobile' : 'start_hint_desktop';

    const text = this.add
      .text(w / 2, h * 0.34, t(hintKey), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setScrollFactor(0);

    this.tweens.add({
      targets: text,
      y: '+=12',
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const arrow = this.add.graphics().setDepth(30).setScrollFactor(0);
    arrow.lineStyle(5, 0xffd700, 1);
    arrow.fillStyle(0xffd700, 1);
    const ax = w / 2;
    const ay = h * 0.34 + 38;
    arrow.beginPath();
    arrow.moveTo(ax, ay);
    arrow.lineTo(ax, ay + 28);
    arrow.strokePath();
    arrow.fillTriangle(ax - 10, ay + 22, ax + 10, ay + 22, ax, ay + 40);

    this.tweens.add({
      targets: arrow,
      y: '+=12',
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.startHint = { text, arrow };
  }

  fadeStartHint() {
    if (!this.startHint) return;
    const { text, arrow } = this.startHint;
    this.startHint = null;
    this.tweens.add({
      targets: [text, arrow],
      alpha: 0,
      y: '-=30',
      duration: 400,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        text.destroy();
        arrow.destroy();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Goal banner (Screen-fixed)
  // ---------------------------------------------------------------------------

  showGoalBanner() {
    const w = this.scale.width;
    const cy = 110;

    const line1 = this.add
      .text(w / 2, cy, t('goal_eat'), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setScrollFactor(0)
      .setAlpha(0);

    const line2 = this.add
      .text(w / 2, cy + 38, t('goal_golden'), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '20px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setScrollFactor(0)
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
  // Hintergrund — die ganze Welt fuellen
  // ---------------------------------------------------------------------------

  drawCheckerboard() {
    const tileSize = 80;
    const graphics = this.add.graphics().setDepth(0);

    for (let y = 0; y < WORLD_HEIGHT; y += tileSize) {
      for (let x = 0; x < WORLD_WIDTH; x += tileSize) {
        const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        graphics.fillStyle(isEven ? 0xc41e3a : 0xffffff, 0.10);
        graphics.fillRect(x, y, tileSize, tileSize);
      }
    }
  }

  /**
   * Sichtbarer Welt-Rand in Sauce-Rot — gibt dem Spieler ein Gefuehl
   * dafuer wo die Wand ist, sobald die Kamera den Rand zeigt.
   */
  drawWorldBorder() {
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(8, 0xc41e3a, 0.85);
    g.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Innere doppelte Linie fuer einen 'Warning'-Look
    g.lineStyle(2, 0xffd700, 0.6);
    g.strokeRect(12, 12, WORLD_WIDTH - 24, WORLD_HEIGHT - 24);
  }
}
