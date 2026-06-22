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
 * Schritt 5: Bots
 *  - 6 KI-Spaghetti mit verschiedenen italienischen Farben/Namen
 *  - Bots jagen Fleischbaellchen und weichen Waenden + anderen Snakes aus
 *  - Multi-Snake-Kollisionen: Kopf vs. fremder Koerper = Tod
 *  - Bot-Tod droppt Fleischbaellchen, danach Respawn nach 2-4s
 *  - Kill durch Player gibt +50 Score
 *  - Live-Leaderboard oben links
 */

// Spielfeld
const MEATBALL_COUNT = 50;
const MAGNET_RADIUS = 90;
const SPAWN_MIN_DIST_FROM_PLAYER = 120;

// Snake-Kollision
const SELF_COLLISION_SAFE_SEGMENTS = 12;

// Bots
const BOT_COUNT = 6;
const BOT_RESPAWN_DELAY_MIN = 2200;
const BOT_RESPAWN_DELAY_MAX = 4200;
const PLAYER_KILL_BONUS = 50;

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
    const { width, height } = this.scale;

    this.isTouch = isTouchDevice();
    this.worldBounds = { width, height };

    // Background
    this.drawCheckerboard();

    // Player
    this.player = new SpaghettiPlayer(this, width / 2, height / 2, {
      name: t('you'),
      nameColor: '#ffd700'
    });

    // Direction target (updated by mouse/touch)
    this.targetX = width / 2;
    this.targetY = height / 2;

    // State
    this.score = 0;
    this.gameOver = false;
    this.gameOverScreen = null;
    this.meatballs = [];
    this.bots = [];

    // Eingaben werden waehrend Tutorial geblockt
    this.inputEnabled = false;
    this.spawnTime = this.time.now;
    this.hasMoved = false;
    this.startHint = null;

    // Input
    this.setupInput();

    // HUD
    this.createHUD();

    // Mobile boost button (only on touch devices)
    this.boostButton = null;
    if (this.isTouch) {
      this.createMobileBoostButton();
    }

    // Spawn meatballs and bots
    this.spawnInitialMeatballs();
    this.spawnBots();

    // Leaderboard rechts neben dem Best-Badge (oder ganz oben links wenn kein Best)
    this.leaderboard = new Leaderboard(this, 16, getHighScore() > 0 ? 56 : 16);

    // Tutorial on first ever play, otherwise just the goal banner + hint
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

    // 3) Kollisionen pruefen (mit Spawn-Schonfrist)
    const SPAWN_GRACE_MS = 800;
    const inGracePeriod = this.time.now - this.spawnTime < SPAWN_GRACE_MS;

    if (!inGracePeriod) {
      // Spieler-Kollisionen (Tod = Game Over)
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

      // Bot-Kollisionen (Tod = Respawn)
      this.processBotCollisions();
    }

    // 4) Fleischbaellchen-Logik fuer alle Snakes
    this.processMeatballs();

    // 5) HUD
    this.boostIndicator.setVisible(this.player.isBoosting);
    this.lengthText.setText(`${t('hud_length')}: ${this.player.length}`);
    this.leaderboard.update(this.collectLeaderboardEntries());
  }

  // ---------------------------------------------------------------------------
  // Snake-Sammlung (Helpers)
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
    // Zufaellige Auswahl von BOT_COUNT Paletten ohne Wiederholung
    const palettes = Phaser.Utils.Array.Shuffle(BOT_PALETTES.slice()).slice(0, BOT_COUNT);

    for (const palette of palettes) {
      const pos = this.findSafeSpawnPoint();
      this.bots.push(new BotAI(this, palette, pos.x, pos.y));
    }
  }

  findSafeSpawnPoint() {
    const { width, height } = this.scale;
    const margin = 120;
    const minDist = 180;

    let best = null;
    let bestScore = -1;

    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Phaser.Math.Between(margin, width - margin);
      const y = Phaser.Math.Between(margin, height - margin);

      // Minimaler Abstand zu allen aktiven Schlangen
      let minD = Infinity;
      for (const s of this.collectActiveSnakes()) {
        const d = Math.hypot(x - s.headX, y - s.headY);
        if (d < minD) minD = d;
      }

      if (minD > bestScore) {
        bestScore = minD;
        best = { x, y };
      }
      if (minD >= minDist) break; // gut genug
    }

    return best || { x: width / 2, y: height / 2 };
  }

  processBotCollisions() {
    for (const bot of this.bots) {
      if (bot.snake.isDead) continue;
      const snake = bot.snake;

      // Wand
      if (snake.checkWallCollision(this.worldBounds)) {
        this.killBot(bot, 'wall');
        continue;
      }
      // Self
      if (snake.checkSelfCollision(SELF_COLLISION_SAFE_SEGMENTS)) {
        this.killBot(bot, 'self');
        continue;
      }
      // Player-Body
      if (snake.checkCollisionWith(this.player)) {
        this.killBot(bot, 'player');
        // Spieler bekommt Bonus
        this.awardKillBonus(snake.headX, snake.headY);
        continue;
      }
      // Andere Bots
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

    // Visuelle Effekte
    this.playSauceSplatter(data.headX, data.headY);
    this.playBodyDebris(data);

    // Fleischbaellchen droppen
    this.dropDeathMeatballs(data.segments);

    // Respawn nach Delay
    const delay = BOT_RESPAWN_DELAY_MIN + Math.random() * (BOT_RESPAWN_DELAY_MAX - BOT_RESPAWN_DELAY_MIN);
    this.time.delayedCall(delay, () => this.respawnBot(bot));
  }

  respawnBot(bot) {
    if (this.gameOver) return;
    const pos = this.findSafeSpawnPoint();
    bot.snake.respawn(pos.x, pos.y);
    // Boost-State frisch starten
    bot.lastBoostStart = 0;
    bot.lastBoostEnd = this.time.now;
  }

  awardKillBonus(x, y) {
    this.score += PLAYER_KILL_BONUS;
    this.scoreText.setText(`${t('hud_score')}: ${this.score}`);
    this.popScore();

    // Schwebender Bonus-Text
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
  // Visuelle Death-Effekte (geteilt zwischen Spieler- und Bot-Tod)
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
  // Fleischbaellchen
  // ---------------------------------------------------------------------------

  spawnInitialMeatballs() {
    for (let i = 0; i < MEATBALL_COUNT; i++) {
      this.spawnMeatball();
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

  processMeatballs() {
    const snakes = this.collectActiveSnakes();
    if (snakes.length === 0) return;

    for (let i = this.meatballs.length - 1; i >= 0; i--) {
      const m = this.meatballs[i];

      // Naechste Snake-Kopf-Position finden
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

      // Magnet-Zug
      m.updatePull(closestSnake.headX, closestSnake.headY, MAGNET_RADIUS);

      // Aktuelle Distanz pruefen (kann nach Pull kleiner sein)
      const dist = Math.hypot(closestSnake.headX - m.x, closestSnake.headY - m.y);
      if (dist < closestSnake.headRadius + m.radius) {
        this.handleMeatballEaten(m, i, closestSnake);
      }
    }

    // Auffuellen falls unter Soll
    while (this.meatballs.length < MEATBALL_COUNT) {
      this.spawnMeatball();
    }
  }

  handleMeatballEaten(meatball, idx, snake) {
    snake.grow(meatball.growth);

    // Spieler bekommt Score-Reward und Burst-Effekt
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
  // Input
  // ---------------------------------------------------------------------------

  setupInput() {
    this.input.on('pointermove', (pointer) => {
      if (!this.inputEnabled) return;
      if (this.isPointerOverBoostButton(pointer)) return;
      this.targetX = pointer.x;
      this.targetY = pointer.y;
      this.markPlayerHasMoved();
    });

    this.input.on('pointerdown', (pointer) => {
      if (!this.inputEnabled) return;
      if (this.isPointerOverBoostButton(pointer)) return;
      this.targetX = pointer.x;
      this.targetY = pointer.y;
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

    // Best score (top left) — small badge
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
  // Start-Hinweis
  // ---------------------------------------------------------------------------

  showStartHint() {
    const { width, height } = this.scale;

    const hintKey = this.isTouch ? 'start_hint_mobile' : 'start_hint_desktop';

    const text = this.add
      .text(width / 2, height * 0.34, t(hintKey), {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.tweens.add({
      targets: text,
      y: '+=12',
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const arrow = this.add.graphics().setDepth(30);
    arrow.lineStyle(5, 0xffd700, 1);
    arrow.fillStyle(0xffd700, 1);
    const ax = width / 2;
    const ay = height * 0.34 + 38;
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
  // Goal banner
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
