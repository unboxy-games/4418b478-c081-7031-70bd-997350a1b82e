import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreEntry {
  score: number;
  date: number; // Unix timestamp (ms)
}

interface ScoreRow extends ScoreEntry {
  rank: number;
}

interface GridButton {
  bg: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Graphics;
  isLit: boolean;
  row: number;
  col: number;
  cx: number;
  cy: number;
  zone: Phaser.GameObjects.Zone;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const CELL = 120;
const BTN = 108;
const RADIUS = 14;
const COLS = 4;
const ROWS = 4;
const GRID_W = COLS * CELL - (CELL - BTN); // 468
const GRID_H = ROWS * CELL - (CELL - BTN); // 468
const GRID_START_X = (GAME_WIDTH - GRID_W) / 2; // 406
const GRID_START_Y = 130;

const SLIDER_LEFT = 420;
const SLIDER_RIGHT = 860;
const SLIDER_Y = 668;
const SPEED_MIN = 300;
const SPEED_MAX = 2000;

const ROUND_SECONDS = 30;

// ─── Scene ────────────────────────────────────────────────────────────────────

export class GameScene extends Phaser.Scene {
  declare rexUI: any; // injected by the rexUI scene plugin

  // Core game state
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private buttons: GridButton[] = [];
  private litIndex = -1;
  private interval = 900;
  private lightTimer?: Phaser.Time.TimerEvent;
  private roundActive = false;

  // Round countdown
  private roundTimeLeft = ROUND_SECONDS;
  private roundTimerEvent?: Phaser.Time.TimerEvent;
  private roundTimerText!: Phaser.GameObjects.Text;
  private roundTimerGfx!: Phaser.GameObjects.Graphics;

  // Speed slider
  private speedLabel!: Phaser.GameObjects.Text;
  private sliderTrackGfx!: Phaser.GameObjects.Graphics;
  private sliderThumbGfx!: Phaser.GameObjects.Graphics;
  private sliderThumbZone!: Phaser.GameObjects.Zone;
  private sliderX = 0;

  // Persistence
  private savedScores: ScoreEntry[] = [];

  // Overlay groups (destroyed/rebuilt each open)
  private roundOverGroup: Phaser.GameObjects.GameObject[] = [];
  private leaderboardGroup: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.score = 0;
    this.interval = 900;
    this.litIndex = -1;
    this.buttons = [];
    this.roundActive = false;
    this.roundTimeLeft = ROUND_SECONDS;
    this.roundOverGroup = [];
    this.leaderboardGroup = [];

    this.drawBackground();
    this.buildHeader();
    this.buildGrid();
    this.buildSlider();

    this.loadScores(); // fire-and-forget; game runs fine before it resolves

    // Start first round after a short pause
    this.time.delayedCall(600, () => this.startRound());
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x0d0d1a, 0x0d0d1a, 0x1a1a35, 0x1a1a35, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const lines = this.add.graphics().setDepth(0);
    lines.lineStyle(1, 0x2222aa, 0.08);
    for (let x = 0; x <= GAME_WIDTH; x += 80) lines.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += 80) lines.lineBetween(0, y, GAME_WIDTH, y);

    const vig = this.add.graphics().setDepth(0);
    for (let i = 0; i < 6; i++) {
      const alpha = 0.06 * (6 - i);
      const inset = i * 30;
      vig.fillStyle(0x000000, alpha);
      vig.fillRect(0, 0, GAME_WIDTH, inset + 20);
      vig.fillRect(0, GAME_HEIGHT - inset - 20, GAME_WIDTH, inset + 20);
      vig.fillRect(0, 0, inset + 20, GAME_HEIGHT);
      vig.fillRect(GAME_WIDTH - inset - 20, 0, inset + 20, GAME_HEIGHT);
    }
  }

  // ─── Header ──────────────────────────────────────────────────────────────────

  private buildHeader(): void {
    // Title
    this.add.text(GAME_WIDTH / 2, 38, 'REACTION', {
      fontSize: '32px', fontStyle: 'bold', color: '#FFD700', letterSpacing: 10,
    }).setOrigin(0.5).setDepth(10);

    // Divider
    const div = this.add.graphics().setDepth(9);
    div.lineStyle(1, 0xFFD700, 0.22);
    div.lineBetween(GAME_WIDTH / 2 - 160, 62, GAME_WIDTH / 2 + 160, 62);

    // Score pill (center)
    const pill = this.add.graphics().setDepth(9);
    pill.fillStyle(0x000000, 0.45);
    pill.fillRoundedRect(GAME_WIDTH / 2 - 110, 72, 220, 48, 24);
    pill.lineStyle(1, 0xFFD700, 0.3);
    pill.strokeRoundedRect(GAME_WIDTH / 2 - 110, 72, 220, 48, 24);

    this.scoreText = this.add.text(GAME_WIDTH / 2, 96, 'Score: 0', {
      fontSize: '26px', fontStyle: 'bold', color: '#FFD700',
    }).setOrigin(0.5).setDepth(10);

    // Round timer (left side)
    this.roundTimerGfx = this.add.graphics().setDepth(9);
    this.add.text(140, 75, 'TIME', {
      fontSize: '11px', color: '#666688', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(10);
    this.roundTimerText = this.add.text(140, 96, '0:30', {
      fontSize: '26px', fontStyle: 'bold', color: '#aaaadd',
    }).setOrigin(0.5).setDepth(10);
    this.updateTimerDisplay();

    // High Scores button (top right)
    this.buildHighScoresButton();
  }

  private buildHighScoresButton(): void {
    const bx = GAME_WIDTH - 115;
    const by = 50;
    const bw = 186;
    const bh = 44;

    const btnGfx = this.add.graphics().setDepth(10);
    const drawBtn = (hover: boolean) => {
      btnGfx.clear();
      btnGfx.fillStyle(hover ? 0x2a1a00 : 0x000000, hover ? 0.75 : 0.5);
      btnGfx.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 10);
      btnGfx.lineStyle(1.5, 0xFFD700, hover ? 0.9 : 0.5);
      btnGfx.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 10);
    };
    drawBtn(false);

    this.add.text(bx - 16, by + 1, '🏆', { fontSize: '18px' }).setOrigin(0.5).setDepth(11);
    this.add.text(bx + 22, by, 'SCORES', {
      fontSize: '14px', fontStyle: 'bold', color: '#FFD700', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(11);

    const zone = this.add.zone(bx, by, bw, bh).setInteractive({ cursor: 'pointer' });
    zone.setDepth(12);
    zone.on('pointerdown', () => this.showLeaderboard());
    zone.on('pointerover', () => drawBtn(true));
    zone.on('pointerout', () => drawBtn(false));
  }

  // ─── Round timer ─────────────────────────────────────────────────────────────

  private updateTimerDisplay(): void {
    const s = this.roundTimeLeft;
    const mins = Math.floor(s / 60);
    const secs = String(s % 60).padStart(2, '0');
    this.roundTimerText.setText(`${mins}:${secs}`);

    const isRed = s <= 5;
    const isOrange = s <= 10 && !isRed;
    const col = isRed ? '#FF4444' : isOrange ? '#FF9944' : '#aaaadd';
    this.roundTimerText.setColor(col);

    this.roundTimerGfx.clear();
    const bgCol = isRed ? 0x3a0000 : isOrange ? 0x2a1200 : 0x000000;
    this.roundTimerGfx.fillStyle(bgCol, 0.45);
    this.roundTimerGfx.fillRoundedRect(90, 72, 100, 48, 24);
    this.roundTimerGfx.lineStyle(1, isRed ? 0xFF4444 : isOrange ? 0xFF9944 : 0x5555aa, 0.4);
    this.roundTimerGfx.strokeRoundedRect(90, 72, 100, 48, 24);
  }

  private startRound(): void {
    this.roundActive = true;
    this.roundTimeLeft = ROUND_SECONDS;
    this.score = 0;
    this.updateScore();
    this.updateTimerDisplay();

    if (this.roundTimerEvent) this.roundTimerEvent.remove(false);
    this.roundTimerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.onTimerTick,
      callbackScope: this,
      loop: true,
    });

    this.startLightTimer();
  }

  private onTimerTick(): void {
    this.roundTimeLeft = Math.max(0, this.roundTimeLeft - 1);
    this.updateTimerDisplay();

    // Urgent shake when <= 5 s
    if (this.roundTimeLeft > 0 && this.roundTimeLeft <= 5) {
      this.tweens.add({
        targets: this.roundTimerText,
        x: 140 + 5,
        duration: 55,
        yoyo: true,
        repeat: 1,
        onComplete: () => { this.roundTimerText.x = 140; },
      });
    }

    if (this.roundTimeLeft === 0) {
      this.endRound();
    }
  }

  private endRound(): void {
    this.roundActive = false;
    if (this.roundTimerEvent) this.roundTimerEvent.remove(false);
    if (this.lightTimer) this.lightTimer.remove(false);

    if (this.litIndex >= 0 && this.litIndex < this.buttons.length && this.buttons[this.litIndex].isLit) {
      this.darkenButton(this.litIndex);
    }
    this.litIndex = -1;

    // Persist (fire-and-forget)
    this.saveScoreEntry({ score: this.score, date: Date.now() });

    this.time.delayedCall(350, () => this.showRoundOver());
  }

  // ─── Grid ────────────────────────────────────────────────────────────────────

  private buildGrid(): void {
    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(0x000000, 0.3);
    panel.fillRoundedRect(GRID_START_X - 18, GRID_START_Y - 18, GRID_W + 36, GRID_H + 36, 24);
    panel.lineStyle(1, 0x3333aa, 0.4);
    panel.strokeRoundedRect(GRID_START_X - 18, GRID_START_Y - 18, GRID_W + 36, GRID_H + 36, 24);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cx = GRID_START_X + col * CELL + BTN / 2;
        const cy = GRID_START_Y + row * CELL + BTN / 2;

        const glow = this.add.graphics().setDepth(1);
        const bg = this.add.graphics().setDepth(2);
        this.drawButtonDark(bg, cx, cy);

        const zone = this.add.zone(cx, cy, BTN, BTN).setInteractive({ cursor: 'pointer' });
        zone.setDepth(5);

        const idx = this.buttons.length;
        const btn: GridButton = { bg, glow, isLit: false, row, col, cx, cy, zone };
        this.buttons.push(btn);

        zone.on('pointerdown', () => this.handleTap(idx));
        zone.on('pointerover', () => { if (!btn.isLit) btn.bg.setAlpha(0.8); });
        zone.on('pointerout', () => { btn.bg.setAlpha(1); });
      }
    }
  }

  private drawButtonDark(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.clear();
    const x = cx - BTN / 2, y = cy - BTN / 2;
    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(x + 3, y + 5, BTN, BTN, RADIUS);
    g.fillStyle(0x252535, 1);
    g.fillRoundedRect(x, y, BTN, BTN, RADIUS);
    g.fillStyle(0x3a3a55, 0.8);
    g.fillRoundedRect(x + 4, y + 4, BTN - 8, BTN * 0.3, { tl: RADIUS - 2, tr: RADIUS - 2, bl: 0, br: 0 });
    g.fillStyle(0x0a0a18, 0.5);
    g.fillRoundedRect(x + 4, y + BTN * 0.72, BTN - 8, BTN * 0.24, { tl: 0, tr: 0, bl: RADIUS - 2, br: RADIUS - 2 });
    g.fillStyle(0x454565, 0.9);
    g.fillCircle(cx - BTN * 0.28, cy - BTN * 0.28, 3.5);
    g.fillCircle(cx + BTN * 0.28, cy - BTN * 0.28, 3.5);
    g.fillCircle(cx - BTN * 0.28, cy + BTN * 0.28, 3.5);
    g.fillCircle(cx + BTN * 0.28, cy + BTN * 0.28, 3.5);
    g.lineStyle(1.5, 0x3a3a58, 0.6);
    g.strokeCircle(cx, cy, 16);
  }

  private drawButtonLit(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.clear();
    const x = cx - BTN / 2, y = cy - BTN / 2;
    g.fillStyle(0x553300, 0.8);
    g.fillRoundedRect(x + 3, y + 5, BTN, BTN, RADIUS);
    g.fillStyle(0xFFCC00, 1);
    g.fillRoundedRect(x, y, BTN, BTN, RADIUS);
    g.fillStyle(0xFFEC80, 0.85);
    g.fillRoundedRect(x + 4, y + 4, BTN - 8, BTN * 0.35, { tl: RADIUS - 2, tr: RADIUS - 2, bl: 0, br: 0 });
    g.fillStyle(0xBB8800, 0.4);
    g.fillRoundedRect(x + 4, y + BTN * 0.7, BTN - 8, BTN * 0.26, { tl: 0, tr: 0, bl: RADIUS - 2, br: RADIUS - 2 });
    g.lineStyle(2, 0xFFFFCC, 0.5);
    g.strokeRoundedRect(x + 5, y + 5, BTN - 10, BTN - 10, RADIUS - 2);
    g.fillStyle(0xFFFFFF, 0.75);
    g.fillCircle(cx - BTN * 0.25, cy - BTN * 0.25, 4.5);
    g.fillCircle(cx + BTN * 0.25, cy - BTN * 0.25, 4.5);
    g.fillCircle(cx, cy + BTN * 0.28, 4.5);
    g.fillStyle(0xFFFFEE, 0.9);
    g.fillCircle(cx, cy, 10);
    g.fillStyle(0xFFCC00, 1);
    g.fillCircle(cx, cy, 5);
  }

  private drawGlow(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.clear();
    for (let i = 5; i >= 1; i--) {
      const expand = i * 9;
      g.fillStyle(0xFFDD00, 0.05 * i);
      g.fillRoundedRect(cx - BTN / 2 - expand, cy - BTN / 2 - expand, BTN + expand * 2, BTN + expand * 2, RADIUS + expand);
    }
  }

  // ─── Light / Darken ──────────────────────────────────────────────────────────

  private lightUpButton(idx: number): void {
    const btn = this.buttons[idx];
    btn.isLit = true;
    this.drawButtonLit(btn.bg, btn.cx, btn.cy);
    this.drawGlow(btn.glow, btn.cx, btn.cy);
    btn.bg.setScale(1);
    this.tweens.add({
      targets: btn.bg, scaleX: 1.06, scaleY: 1.06,
      duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  private darkenButton(idx: number): void {
    const btn = this.buttons[idx];
    btn.isLit = false;
    this.tweens.killTweensOf(btn.bg);
    btn.bg.setScale(1);
    this.drawButtonDark(btn.bg, btn.cx, btn.cy);
    btn.glow.clear();
  }

  // ─── Tap handling ────────────────────────────────────────────────────────────

  private handleTap(idx: number): void {
    if (!this.roundActive) return;
    const btn = this.buttons[idx];

    if (btn.isLit) {
      this.score++;
      this.updateScore();
      this.litIndex = -1;

      this.tweens.add({
        targets: btn.bg, scaleX: 1.22, scaleY: 1.22, duration: 70, yoyo: true,
        ease: 'Back.easeOut', onComplete: () => this.darkenButton(idx),
      });
      this.tweens.add({
        targets: this.scoreText, scaleX: 1.35, scaleY: 1.35, duration: 90, yoyo: true, ease: 'Back.easeOut',
      });
      this.spawnParticles(btn.cx, btn.cy, 0xFFD700);

    } else {
      this.score--;
      this.updateScore();

      const flash = this.add.graphics().setDepth(6);
      flash.fillStyle(0xFF2222, 0.75);
      flash.fillRoundedRect(btn.cx - BTN / 2, btn.cy - BTN / 2, BTN, BTN, RADIUS);
      this.tweens.add({
        targets: flash, alpha: 0, duration: 280, ease: 'Power2',
        onComplete: () => flash.destroy(),
      });

      const origX = GAME_WIDTH / 2;
      this.tweens.add({
        targets: this.scoreText, x: origX + 10, duration: 50, yoyo: true, repeat: 3,
        onComplete: () => { this.scoreText.x = origX; },
      });
      this.spawnParticles(btn.cx, btn.cy, 0xFF4444);
    }
  }

  private updateScore(): void {
    this.scoreText.setText(`Score: ${this.score}`);
    this.scoreText.setColor(this.score < 0 ? '#FF6666' : '#FFD700');
  }

  private spawnParticles(x: number, y: number, color: number): void {
    for (let i = 0; i < 12; i++) {
      const p = this.add.graphics().setDepth(4);
      p.fillStyle(color, 1);
      p.fillCircle(0, 0, Phaser.Math.Between(3, 8));
      p.x = x; p.y = y;
      const angle = (i / 12) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
      const speed = Phaser.Math.FloatBetween(55, 130);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0, scaleX: 0.1, scaleY: 0.1,
        duration: Phaser.Math.Between(380, 650),
        ease: 'Power2',
        onComplete: () => p.destroy(),
      });
    }
  }

  // ─── Light timer ─────────────────────────────────────────────────────────────

  private startLightTimer(): void {
    if (this.lightTimer) this.lightTimer.remove(false);
    this.lightTimer = this.time.addEvent({
      delay: this.interval,
      callback: this.lightRandom,
      callbackScope: this,
      loop: true,
    });
  }

  private lightRandom(): void {
    if (this.litIndex >= 0 && this.litIndex < this.buttons.length && this.buttons[this.litIndex].isLit) {
      this.darkenButton(this.litIndex);
    }
    let newIdx: number;
    do { newIdx = Phaser.Math.Between(0, ROWS * COLS - 1); } while (newIdx === this.litIndex);
    this.litIndex = newIdx;
    this.lightUpButton(this.litIndex);
  }

  // ─── Speed slider ────────────────────────────────────────────────────────────

  private buildSlider(): void {
    const TRACK_W = SLIDER_RIGHT - SLIDER_LEFT;
    const t = (SPEED_MAX - this.interval) / (SPEED_MAX - SPEED_MIN);
    this.sliderX = SLIDER_LEFT + t * TRACK_W;

    const panel = this.add.graphics().setDepth(9);
    panel.fillStyle(0x000000, 0.45);
    panel.fillRoundedRect(SLIDER_LEFT - 50, SLIDER_Y - 42, TRACK_W + 100, 84, 18);
    panel.lineStyle(1, 0x3333aa, 0.35);
    panel.strokeRoundedRect(SLIDER_LEFT - 50, SLIDER_Y - 42, TRACK_W + 100, 84, 18);

    this.add.text(GAME_WIDTH / 2, SLIDER_Y - 22, 'Speed', {
      fontSize: '16px', fontStyle: 'bold', color: '#9999cc', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(10);
    this.add.text(SLIDER_LEFT, SLIDER_Y + 20, 'Slow', { fontSize: '13px', color: '#555577' }).setOrigin(0.5).setDepth(10);
    this.add.text(SLIDER_RIGHT, SLIDER_Y + 20, 'Fast', { fontSize: '13px', color: '#555577' }).setOrigin(0.5).setDepth(10);
    this.speedLabel = this.add.text(GAME_WIDTH / 2, SLIDER_Y + 20, `${this.interval} ms`, {
      fontSize: '13px', color: '#FFD700', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.sliderTrackGfx = this.add.graphics().setDepth(9);
    this.sliderThumbGfx = this.add.graphics().setDepth(10);
    this.redrawSlider();

    const trackZone = this.add.zone(GAME_WIDTH / 2, SLIDER_Y, TRACK_W + 8, 22).setInteractive({ cursor: 'pointer' });
    trackZone.setDepth(8);
    trackZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.sliderX = Phaser.Math.Clamp(pointer.x, SLIDER_LEFT, SLIDER_RIGHT);
      this.onSliderMoved();
    });

    this.sliderThumbZone = this.add.zone(this.sliderX, SLIDER_Y, 40, 40).setInteractive({ draggable: true, cursor: 'grab' });
    this.sliderThumbZone.setDepth(11);
    this.input.setDraggable(this.sliderThumbZone);
    this.sliderThumbZone.on('drag', (_ptr: Phaser.Input.Pointer, dragX: number) => {
      this.sliderX = Phaser.Math.Clamp(dragX, SLIDER_LEFT, SLIDER_RIGHT);
      this.sliderThumbZone.x = this.sliderX;
      this.onSliderMoved();
    });
  }

  private onSliderMoved(): void {
    const TRACK_W = SLIDER_RIGHT - SLIDER_LEFT;
    const t = (this.sliderX - SLIDER_LEFT) / TRACK_W;
    this.interval = Math.round(SPEED_MAX - t * (SPEED_MAX - SPEED_MIN));
    this.speedLabel.setText(`${this.interval} ms`);
    this.redrawSlider();
    if (this.roundActive) this.startLightTimer();
  }

  private redrawSlider(): void {
    const g = this.sliderTrackGfx;
    g.clear();
    g.fillStyle(0x111128, 1);
    g.fillRoundedRect(SLIDER_LEFT, SLIDER_Y - 5, SLIDER_RIGHT - SLIDER_LEFT, 10, 5);
    const fillW = this.sliderX - SLIDER_LEFT;
    if (fillW > 0) {
      g.fillStyle(0xFFD700, 0.55);
      g.fillRoundedRect(SLIDER_LEFT, SLIDER_Y - 4, fillW, 8, 4);
    }
    const t = this.sliderThumbGfx;
    t.clear();
    t.fillStyle(0x000000, 0.35);
    t.fillCircle(this.sliderX + 2, SLIDER_Y + 3, 15);
    t.fillStyle(0xFFD700, 1);
    t.fillCircle(this.sliderX, SLIDER_Y, 15);
    t.fillStyle(0xFFEE88, 1);
    t.fillCircle(this.sliderX, SLIDER_Y, 9);
    t.fillStyle(0xCC9900, 1);
    t.fillCircle(this.sliderX, SLIDER_Y, 4);
  }

  // ─── Persistence ─────────────────────────────────────────────────────────────

  private async loadScores(): Promise<void> {
    try {
      const unboxy = await unboxyReady;
      if (!unboxy) return;
      const data = await unboxy.saves.get<ScoreEntry[]>('highScores');
      if (Array.isArray(data)) this.savedScores = data;
    } catch (err) {
      console.warn('[game] failed to load scores', err);
    }
  }

  private async saveScoreEntry(entry: ScoreEntry): Promise<void> {
    // Prepend newest first; keep last 50
    this.savedScores = [entry, ...this.savedScores].slice(0, 50);
    try {
      const unboxy = await unboxyReady;
      if (!unboxy) return;
      await unboxy.saves.set('highScores', this.savedScores);
    } catch (err) {
      console.warn('[game] failed to save score', err);
      // Game continues — save failure is not fatal
    }
  }

  // ─── Round Over screen ───────────────────────────────────────────────────────

  private showRoundOver(): void {
    this.destroyGroup(this.roundOverGroup);
    this.roundOverGroup = [];

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const PW = 480, PH = 290;

    // Dim
    const dim = this.add.graphics().setDepth(40);
    dim.fillStyle(0x000000, 0.68);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dim.setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 220 });
    this.roundOverGroup.push(dim);

    // Panel
    const panel = this.add.graphics().setDepth(41);
    panel.fillStyle(0x0e0e22, 1);
    panel.fillRoundedRect(cx - PW / 2, cy - PH / 2, PW, PH, 20);
    panel.lineStyle(2, 0xFFD700, 0.65);
    panel.strokeRoundedRect(cx - PW / 2, cy - PH / 2, PW, PH, 20);
    this.roundOverGroup.push(panel);

    // Accent bar at top of panel
    const accent = this.add.graphics().setDepth(41);
    accent.fillStyle(0xFFD700, 0.15);
    accent.fillRoundedRect(cx - PW / 2, cy - PH / 2, PW, 56, { tl: 20, tr: 20, bl: 0, br: 0 });
    this.roundOverGroup.push(accent);

    // "TIME'S UP!" title
    const title = this.add.text(cx, cy - PH / 2 + 28, "TIME'S UP!", {
      fontSize: '32px', fontStyle: 'bold', color: '#FFD700', letterSpacing: 5,
    }).setOrigin(0.5).setDepth(42);
    title.setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: title, scaleX: 1, scaleY: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    this.roundOverGroup.push(title);

    // Score
    const scoreCol = this.score < 0 ? '#FF6666' : this.score === 0 ? '#aaaaaa' : '#ffffff';
    const scoreLabel = this.add.text(cx, cy - 38, `You scored: ${this.score}`, {
      fontSize: '28px', fontStyle: 'bold', color: scoreCol,
    }).setOrigin(0.5).setDepth(42);
    this.roundOverGroup.push(scoreLabel);

    // Best score info (uses savedScores which already has the new entry prepended)
    const best = this.savedScores.length > 0
      ? Math.max(...this.savedScores.map(s => s.score))
      : this.score;
    const isBest = this.score >= best;
    const bestStr = isBest ? '⭐ New best score!' : `Best: ${best}`;
    const bestLabel = this.add.text(cx, cy + 10, bestStr, {
      fontSize: '17px', color: isBest ? '#FFD700' : '#777999',
    }).setOrigin(0.5).setDepth(42);
    this.roundOverGroup.push(bestLabel);

    if (isBest) {
      this.tweens.add({
        targets: bestLabel, scaleX: 1.12, scaleY: 1.12, duration: 600,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // Buttons
    this.addRoundOverButton(cx - 110, cy + 80, 190, 48, 'Play Again', '#FFD700', () => {
      this.destroyGroup(this.roundOverGroup);
      this.roundOverGroup = [];
      this.startRound();
    });
    this.addRoundOverButton(cx + 110, cy + 80, 190, 48, 'High Scores', '#9999ff', () => {
      this.destroyGroup(this.roundOverGroup);
      this.roundOverGroup = [];
      this.showLeaderboard();
    });
  }

  private addRoundOverButton(
    bx: number, by: number, bw: number, bh: number,
    label: string, color: string, onClick: () => void,
  ): void {
    const hex = parseInt(color.replace('#', '0x'), 16);
    const g = this.add.graphics().setDepth(42);
    const drawState = (hover: boolean) => {
      g.clear();
      g.fillStyle(hover ? hex : 0x000000, hover ? 0.2 : 0.45);
      g.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 10);
      g.lineStyle(2, hex, hover ? 1 : 0.7);
      g.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 10);
    };
    drawState(false);
    this.roundOverGroup.push(g);

    const txt = this.add.text(bx, by, label, {
      fontSize: '18px', fontStyle: 'bold', color,
    }).setOrigin(0.5).setDepth(43);
    this.roundOverGroup.push(txt);

    const zone = this.add.zone(bx, by, bw, bh).setInteractive({ cursor: 'pointer' });
    zone.setDepth(44);
    this.roundOverGroup.push(zone);

    zone.on('pointerdown', onClick);
    zone.on('pointerover', () => { drawState(true); txt.setScale(1.06); });
    zone.on('pointerout', () => { drawState(false); txt.setScale(1); });
  }

  // ─── Leaderboard panel ───────────────────────────────────────────────────────

  private showLeaderboard(): void {
    this.destroyGroup(this.leaderboardGroup);
    this.leaderboardGroup = [];

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const PW = 600, PH = 490;

    // Full-screen dimmer (click to close)
    const dim = this.add.graphics().setDepth(50);
    dim.fillStyle(0x000000, 0.78);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dim.setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 200 });
    this.leaderboardGroup.push(dim);

    const dimZone = this.add.zone(cx, cy, GAME_WIDTH, GAME_HEIGHT).setInteractive();
    dimZone.setDepth(51);
    dimZone.on('pointerdown', () => this.hideLeaderboard());
    this.leaderboardGroup.push(dimZone);

    // Panel
    const panel = this.add.graphics().setDepth(52);
    panel.fillStyle(0x0d0d22, 1);
    panel.fillRoundedRect(cx - PW / 2, cy - PH / 2, PW, PH, 22);
    panel.lineStyle(2, 0xFFD700, 0.55);
    panel.strokeRoundedRect(cx - PW / 2, cy - PH / 2, PW, PH, 22);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, duration: 200 });
    this.leaderboardGroup.push(panel);

    // Gold top-bar
    const topbar = this.add.graphics().setDepth(52);
    topbar.fillStyle(0xFFD700, 0.12);
    topbar.fillRoundedRect(cx - PW / 2, cy - PH / 2, PW, 62, { tl: 22, tr: 22, bl: 0, br: 0 });
    topbar.setAlpha(0);
    this.tweens.add({ targets: topbar, alpha: 1, duration: 200 });
    this.leaderboardGroup.push(topbar);

    // Blocker: stops clicks on panel from reaching dimmer
    const blocker = this.add.zone(cx, cy, PW, PH).setInteractive();
    blocker.setDepth(53);
    blocker.on('pointerdown', (_ptr: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
    });
    this.leaderboardGroup.push(blocker);

    // Title
    const titleY = cy - PH / 2 + 31;
    const titleTxt = this.add.text(cx, titleY, 'MY HIGH SCORES', {
      fontSize: '22px', fontStyle: 'bold', color: '#FFD700', letterSpacing: 6,
    }).setOrigin(0.5).setDepth(54).setAlpha(0);
    this.tweens.add({ targets: titleTxt, alpha: 1, duration: 250, delay: 80 });
    this.leaderboardGroup.push(titleTxt);

    // Divider under title
    const divGfx = this.add.graphics().setDepth(54);
    divGfx.lineStyle(1, 0xFFD700, 0.22);
    divGfx.lineBetween(cx - PW / 2 + 30, cy - PH / 2 + 62, cx + PW / 2 - 30, cy - PH / 2 + 62);
    this.leaderboardGroup.push(divGfx);

    // Close button (×)
    const CX = cx + PW / 2 - 24;
    const CY = cy - PH / 2 + 24;
    const closeBg = this.add.graphics().setDepth(56);
    const drawClose = (hover: boolean) => {
      closeBg.clear();
      closeBg.fillStyle(hover ? 0x442200 : 0x1a1a33, 1);
      closeBg.fillCircle(CX, CY, 16);
      closeBg.lineStyle(1.5, hover ? 0xFFD700 : 0x555577, 1);
      closeBg.strokeCircle(CX, CY, 16);
    };
    drawClose(false);
    this.leaderboardGroup.push(closeBg);

    const closeTxt = this.add.text(CX, CY, '✕', { fontSize: '15px', color: '#aaaacc' })
      .setOrigin(0.5).setDepth(57);
    this.leaderboardGroup.push(closeTxt);

    const closeZone = this.add.zone(CX, CY, 38, 38).setInteractive({ cursor: 'pointer' });
    closeZone.setDepth(58);
    this.leaderboardGroup.push(closeZone);
    closeZone.on('pointerdown', (_ptr: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.hideLeaderboard();
    });
    closeZone.on('pointerover', () => { drawClose(true); closeTxt.setColor('#FFD700'); });
    closeZone.on('pointerout', () => { drawClose(false); closeTxt.setColor('#aaaacc'); });

    // Sorted items (best score first)
    const sortedScores: ScoreRow[] = [...this.savedScores]
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));

    // Column header row
    const HDR_Y = cy - PH / 2 + 80;
    const COL_RANK_X = cx - PW / 2 + 58;
    const COL_SCORE_X = cx - 20;
    const COL_DATE_X = cx + PW / 2 - 90;

    const hdrStyle = { fontSize: '11px', color: '#555577', letterSpacing: 2 };
    [
      this.add.text(COL_RANK_X, HDR_Y, 'RANK', hdrStyle).setOrigin(0.5).setDepth(54),
      this.add.text(COL_SCORE_X, HDR_Y, 'SCORE', hdrStyle).setOrigin(0.5).setDepth(54),
      this.add.text(COL_DATE_X, HDR_Y, 'DATE', hdrStyle).setOrigin(0.5).setDepth(54),
    ].forEach(t => this.leaderboardGroup.push(t));

    const hdrDivGfx = this.add.graphics().setDepth(54);
    hdrDivGfx.lineStyle(1, 0x2a2a4a, 1);
    hdrDivGfx.lineBetween(cx - PW / 2 + 28, HDR_Y + 14, cx + PW / 2 - 28, HDR_Y + 14);
    this.leaderboardGroup.push(hdrDivGfx);

    if (sortedScores.length === 0) {
      // Empty state
      const empty = this.add.text(cx, cy + 20, 'No scores yet!\nFinish a round to log your score.', {
        fontSize: '18px', color: '#444466', align: 'center',
      }).setOrigin(0.5).setDepth(54);
      this.leaderboardGroup.push(empty);
      return;
    }

    // ── GridTable ──
    const CELL_H = 52;
    const TABLE_W = PW - 40; // 560
    const TABLE_H = CELL_H * 6; // 6 visible rows = 312
    const TABLE_X = cx;
    const TABLE_Y = cy - PH / 2 + 100 + TABLE_H / 2; // top at 100px from panel top

    // Column x offsets, relative to cell center (container origin)
    const RANK_OFF_X = -(TABLE_W / 2) + 58;
    const SCORE_OFF_X = -20;
    const DATE_OFF_X = TABLE_W / 2 - 90;

    const table = this.rexUI.add.gridTable({
      x: TABLE_X,
      y: TABLE_Y,
      width: TABLE_W,
      height: TABLE_H,
      scrollMode: 'vertical',

      background: this.rexUI.add.roundRectangle(0, 0, 10, 10, 8, 0x090918),

      table: {
        cellWidth: TABLE_W,
        cellHeight: CELL_H,
        columns: 1,
        mask: { padding: 1 },
        enableLayer: true,      // CRITICAL — without this rows are invisible
        reuseCellContainer: true,
      },

      slider: {
        track: this.rexUI.add.roundRectangle(0, 0, 8, 10, 4, 0x1a1a33),
        thumb: this.rexUI.add.roundRectangle(0, 0, 8, 32, 4, 0x4444aa),
      },

      mouseWheelScroller: { focus: true, speed: 0.4 },

      space: { left: 0, right: 10, top: 4, bottom: 4, table: 0, slider: 4 },

      items: sortedScores,

      createCellContainerCallback: (cell: any, cellContainer: any) => {
        const w = cell.width as number;
        const h = cell.height as number;
        const item = cell.item as ScoreRow;

        if (cellContainer === null) {
          // Build the cell container once — a plain Phaser Container
          const bgGfx = this.add.graphics();
          const rankT = this.add.text(0, 0, '', {
            fontSize: '15px', fontStyle: 'bold', color: '#888aaa',
          }).setOrigin(0.5);
          const scoreT = this.add.text(0, 0, '', {
            fontSize: '22px', fontStyle: 'bold', color: '#FFD700',
          }).setOrigin(0.5);
          const dateT = this.add.text(0, 0, '', {
            fontSize: '14px', color: '#667090',
          }).setOrigin(0.5);

          cellContainer = this.add.container(0, 0, [bgGfx, rankT, scoreT, dateT]);
        }

        // Mutate on reuse — ALWAYS update from cell.item
        const container = cellContainer as Phaser.GameObjects.Container;
        const [bgGfx, rankT, scoreT, dateT] = container.list as [
          Phaser.GameObjects.Graphics,
          Phaser.GameObjects.Text,
          Phaser.GameObjects.Text,
          Phaser.GameObjects.Text,
        ];

        // Alternating row background
        bgGfx.clear();
        bgGfx.fillStyle(cell.index % 2 === 0 ? 0x10101e : 0x181830, 1);
        bgGfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 4);

        // Medal colors for top 3
        const MEDALS: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
        const rankColor = MEDALS[item.rank] ?? '#666688';
        const scoreColor = MEDALS[item.rank] ?? '#e0e0ff';

        rankT.setText(`#${item.rank}`).setColor(rankColor).setPosition(RANK_OFF_X, 0);
        scoreT.setText(`${item.score}`).setColor(scoreColor).setPosition(SCORE_OFF_X, 0);
        dateT.setText(this.formatDate(item.date)).setPosition(DATE_OFF_X, 0);

        return cellContainer;
      },
    })
      .layout()
      .setDepth(60)
      .setAlpha(0);

    this.tweens.add({ targets: table, alpha: 1, duration: 250, delay: 100 });
    this.leaderboardGroup.push(table);
  }

  private hideLeaderboard(): void {
    this.destroyGroup(this.leaderboardGroup);
    this.leaderboardGroup = [];
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private destroyGroup(group: Phaser.GameObjects.GameObject[]): void {
    for (const obj of group) {
      if (obj && obj.active) {
        this.tweens.killTweensOf(obj);
        (obj as any).destroy();
      }
    }
  }

  private formatDate(timestamp: number): string {
    const d = new Date(timestamp);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  update(_time: number, _delta: number): void {}
}
