import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

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

export class GameScene extends Phaser.Scene {
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private speedLabel!: Phaser.GameObjects.Text;
  private buttons: GridButton[] = [];
  private litIndex = -1;
  private interval = 900;
  private lightTimer?: Phaser.Time.TimerEvent;

  private sliderTrackGfx!: Phaser.GameObjects.Graphics;
  private sliderThumbGfx!: Phaser.GameObjects.Graphics;
  private sliderThumbZone!: Phaser.GameObjects.Zone;
  private sliderX = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.score = 0;
    this.interval = 900;
    this.litIndex = -1;
    this.buttons = [];

    this.drawBackground();
    this.buildHeader();
    this.buildGrid();
    this.buildSlider();
    this.startTimer();
  }

  // ─── Background ────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x0d0d1a, 0x0d0d1a, 0x1a1a35, 0x1a1a35, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle grid lines
    const lines = this.add.graphics().setDepth(0);
    lines.lineStyle(1, 0x2222aa, 0.08);
    for (let x = 0; x <= GAME_WIDTH; x += 80) {
      lines.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    for (let y = 0; y <= GAME_HEIGHT; y += 80) {
      lines.lineBetween(0, y, GAME_WIDTH, y);
    }

    // Vignette
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

  // ─── Header ────────────────────────────────────────────────────────────────

  private buildHeader(): void {
    // Title
    this.add.text(GAME_WIDTH / 2, 38, 'REACTION', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#FFD700',
      letterSpacing: 10,
    }).setOrigin(0.5).setDepth(10);

    // Subtitle divider
    const div = this.add.graphics().setDepth(9);
    div.lineStyle(1, 0xFFD700, 0.25);
    div.lineBetween(GAME_WIDTH / 2 - 160, 62, GAME_WIDTH / 2 + 160, 62);

    // Score background pill
    const pill = this.add.graphics().setDepth(9);
    pill.fillStyle(0x000000, 0.45);
    pill.fillRoundedRect(GAME_WIDTH / 2 - 110, 72, 220, 48, 24);
    pill.lineStyle(1, 0xFFD700, 0.3);
    pill.strokeRoundedRect(GAME_WIDTH / 2 - 110, 72, 220, 48, 24);

    this.scoreText = this.add.text(GAME_WIDTH / 2, 96, 'Score: 0', {
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#FFD700',
    }).setOrigin(0.5).setDepth(10);
  }

  // ─── Grid ──────────────────────────────────────────────────────────────────

  private buildGrid(): void {
    // Panel behind grid
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
        zone.on('pointerover', () => {
          if (!btn.isLit) {
            btn.bg.setAlpha(0.8);
          }
        });
        zone.on('pointerout', () => {
          btn.bg.setAlpha(1);
        });
      }
    }
  }

  private drawButtonDark(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.clear();
    const x = cx - BTN / 2;
    const y = cy - BTN / 2;

    // Shadow
    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(x + 3, y + 5, BTN, BTN, RADIUS);

    // Body
    g.fillStyle(0x252535, 1);
    g.fillRoundedRect(x, y, BTN, BTN, RADIUS);

    // Top bevel highlight
    g.fillStyle(0x3a3a55, 0.8);
    g.fillRoundedRect(x + 4, y + 4, BTN - 8, BTN * 0.3, { tl: RADIUS - 2, tr: RADIUS - 2, bl: 0, br: 0 });

    // Bottom bevel shadow
    g.fillStyle(0x0a0a18, 0.5);
    g.fillRoundedRect(x + 4, y + BTN * 0.72, BTN - 8, BTN * 0.24, { tl: 0, tr: 0, bl: RADIUS - 2, br: RADIUS - 2 });

    // Subtle corner dots for character
    g.fillStyle(0x454565, 0.9);
    g.fillCircle(cx - BTN * 0.28, cy - BTN * 0.28, 3.5);
    g.fillCircle(cx + BTN * 0.28, cy - BTN * 0.28, 3.5);
    g.fillCircle(cx - BTN * 0.28, cy + BTN * 0.28, 3.5);
    g.fillCircle(cx + BTN * 0.28, cy + BTN * 0.28, 3.5);

    // Center circle
    g.lineStyle(1.5, 0x3a3a58, 0.6);
    g.strokeCircle(cx, cy, 16);
  }

  private drawButtonLit(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.clear();
    const x = cx - BTN / 2;
    const y = cy - BTN / 2;

    // Shadow
    g.fillStyle(0x553300, 0.8);
    g.fillRoundedRect(x + 3, y + 5, BTN, BTN, RADIUS);

    // Body — rich gold
    g.fillStyle(0xFFCC00, 1);
    g.fillRoundedRect(x, y, BTN, BTN, RADIUS);

    // Top highlight
    g.fillStyle(0xFFEC80, 0.85);
    g.fillRoundedRect(x + 4, y + 4, BTN - 8, BTN * 0.35, { tl: RADIUS - 2, tr: RADIUS - 2, bl: 0, br: 0 });

    // Bottom shade
    g.fillStyle(0xBB8800, 0.4);
    g.fillRoundedRect(x + 4, y + BTN * 0.7, BTN - 8, BTN * 0.26, { tl: 0, tr: 0, bl: RADIUS - 2, br: RADIUS - 2 });

    // Inner ring
    g.lineStyle(2, 0xFFFFCC, 0.5);
    g.strokeRoundedRect(x + 5, y + 5, BTN - 10, BTN - 10, RADIUS - 2);

    // Star dots
    g.fillStyle(0xFFFFFF, 0.75);
    g.fillCircle(cx - BTN * 0.25, cy - BTN * 0.25, 4.5);
    g.fillCircle(cx + BTN * 0.25, cy - BTN * 0.25, 4.5);
    g.fillCircle(cx, cy + BTN * 0.28, 4.5);

    // Center burst
    g.fillStyle(0xFFFFEE, 0.9);
    g.fillCircle(cx, cy, 10);
    g.fillStyle(0xFFCC00, 1);
    g.fillCircle(cx, cy, 5);
  }

  private drawGlow(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.clear();
    for (let i = 5; i >= 1; i--) {
      const expand = i * 9;
      const alpha = 0.05 * i;
      g.fillStyle(0xFFDD00, alpha);
      g.fillRoundedRect(
        cx - BTN / 2 - expand,
        cy - BTN / 2 - expand,
        BTN + expand * 2,
        BTN + expand * 2,
        RADIUS + expand
      );
    }
  }

  // ─── Light / Darken ────────────────────────────────────────────────────────

  private lightUpButton(idx: number): void {
    const btn = this.buttons[idx];
    btn.isLit = true;
    this.drawButtonLit(btn.bg, btn.cx, btn.cy);
    this.drawGlow(btn.glow, btn.cx, btn.cy);
    btn.bg.setScale(1);

    this.tweens.add({
      targets: btn.bg,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
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

  // ─── Tap handling ──────────────────────────────────────────────────────────

  private handleTap(idx: number): void {
    const btn = this.buttons[idx];

    if (btn.isLit) {
      this.score++;
      this.updateScore();
      this.litIndex = -1;

      // Pop then darken
      this.tweens.add({
        targets: btn.bg,
        scaleX: 1.22,
        scaleY: 1.22,
        duration: 70,
        yoyo: true,
        ease: 'Back.easeOut',
        onComplete: () => this.darkenButton(idx),
      });

      // Score text bounce
      this.tweens.add({
        targets: this.scoreText,
        scaleX: 1.35,
        scaleY: 1.35,
        duration: 90,
        yoyo: true,
        ease: 'Back.easeOut',
      });

      this.spawnParticles(btn.cx, btn.cy, 0xFFD700);

    } else {
      this.score--;
      this.updateScore();

      // Red flash overlay
      const flash = this.add.graphics().setDepth(6);
      flash.fillStyle(0xFF2222, 0.75);
      flash.fillRoundedRect(btn.cx - BTN / 2, btn.cy - BTN / 2, BTN, BTN, RADIUS);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 280,
        ease: 'Power2',
        onComplete: () => flash.destroy(),
      });

      // Score shake
      const origX = GAME_WIDTH / 2;
      this.tweens.add({
        targets: this.scoreText,
        x: origX + 10,
        duration: 50,
        yoyo: true,
        repeat: 3,
        onComplete: () => { this.scoreText.x = origX; },
      });

      this.spawnParticles(btn.cx, btn.cy, 0xFF4444);
    }
  }

  private updateScore(): void {
    const col = this.score < 0 ? '#FF6666' : '#FFD700';
    this.scoreText.setText(`Score: ${this.score}`);
    this.scoreText.setColor(col);
  }

  private spawnParticles(x: number, y: number, color: number): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const p = this.add.graphics().setDepth(4);
      const size = Phaser.Math.Between(3, 8);
      p.fillStyle(color, 1);
      p.fillCircle(0, 0, size);
      p.x = x;
      p.y = y;

      const angle = (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
      const speed = Phaser.Math.FloatBetween(55, 130);

      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: Phaser.Math.Between(380, 650),
        ease: 'Power2',
        onComplete: () => p.destroy(),
      });
    }
  }

  // ─── Timer ─────────────────────────────────────────────────────────────────

  private startTimer(): void {
    if (this.lightTimer) {
      this.lightTimer.remove(false);
    }
    this.lightTimer = this.time.addEvent({
      delay: this.interval,
      callback: this.lightRandom,
      callbackScope: this,
      loop: true,
    });
  }

  private lightRandom(): void {
    // Darken previous if still lit
    if (this.litIndex >= 0 && this.buttons[this.litIndex].isLit) {
      this.darkenButton(this.litIndex);
    }

    // Pick a new random index (different from current)
    let newIdx: number;
    do {
      newIdx = Phaser.Math.Between(0, ROWS * COLS - 1);
    } while (newIdx === this.litIndex);

    this.litIndex = newIdx;
    this.lightUpButton(this.litIndex);
  }

  // ─── Slider ────────────────────────────────────────────────────────────────

  private buildSlider(): void {
    const TRACK_W = SLIDER_RIGHT - SLIDER_LEFT;

    // Map initial interval to thumb X: left=slow(2000ms), right=fast(300ms)
    const t = (SPEED_MAX - this.interval) / (SPEED_MAX - SPEED_MIN);
    this.sliderX = SLIDER_LEFT + t * TRACK_W;

    // Panel
    const panel = this.add.graphics().setDepth(9);
    panel.fillStyle(0x000000, 0.45);
    panel.fillRoundedRect(SLIDER_LEFT - 50, SLIDER_Y - 42, TRACK_W + 100, 84, 18);
    panel.lineStyle(1, 0x3333aa, 0.35);
    panel.strokeRoundedRect(SLIDER_LEFT - 50, SLIDER_Y - 42, TRACK_W + 100, 84, 18);

    // "Speed" label centered above track
    this.add.text(GAME_WIDTH / 2, SLIDER_Y - 22, 'Speed', {
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#9999cc',
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(10);

    // Slow / Fast end labels
    this.add.text(SLIDER_LEFT, SLIDER_Y + 20, 'Slow', {
      fontSize: '13px',
      color: '#555577',
    }).setOrigin(0.5).setDepth(10);

    this.add.text(SLIDER_RIGHT, SLIDER_Y + 20, 'Fast', {
      fontSize: '13px',
      color: '#555577',
    }).setOrigin(0.5).setDepth(10);

    // Current speed value label
    this.speedLabel = this.add.text(GAME_WIDTH / 2, SLIDER_Y + 20, `${this.interval} ms`, {
      fontSize: '13px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    // Track graphics
    this.sliderTrackGfx = this.add.graphics().setDepth(9);

    // Thumb graphics
    this.sliderThumbGfx = this.add.graphics().setDepth(10);

    this.redrawSlider();

    // Click-on-track zone
    const trackZone = this.add
      .zone(GAME_WIDTH / 2, SLIDER_Y, TRACK_W + 8, 22)
      .setInteractive({ cursor: 'pointer' });
    trackZone.setDepth(8);
    trackZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.sliderX = Phaser.Math.Clamp(pointer.x, SLIDER_LEFT, SLIDER_RIGHT);
      this.onSliderMoved();
    });

    // Draggable thumb zone
    this.sliderThumbZone = this.add.zone(this.sliderX, SLIDER_Y, 40, 40).setInteractive({
      draggable: true,
      cursor: 'grab',
    });
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
    this.startTimer();
  }

  private redrawSlider(): void {
    // Track
    const g = this.sliderTrackGfx;
    g.clear();
    const TRACK_W = SLIDER_RIGHT - SLIDER_LEFT;

    // Groove background
    g.fillStyle(0x111128, 1);
    g.fillRoundedRect(SLIDER_LEFT, SLIDER_Y - 5, TRACK_W, 10, 5);

    // Filled portion (left = slow end)
    const fillW = this.sliderX - SLIDER_LEFT;
    if (fillW > 0) {
      g.fillStyle(0xFFD700, 0.55);
      g.fillRoundedRect(SLIDER_LEFT, SLIDER_Y - 4, fillW, 8, 4);
    }

    // Thumb
    const t = this.sliderThumbGfx;
    t.clear();
    const tx = this.sliderX;
    const ty = SLIDER_Y;

    t.fillStyle(0x000000, 0.35);
    t.fillCircle(tx + 2, ty + 3, 15);

    t.fillStyle(0xFFD700, 1);
    t.fillCircle(tx, ty, 15);

    t.fillStyle(0xFFEE88, 1);
    t.fillCircle(tx, ty, 9);

    t.fillStyle(0xCC9900, 1);
    t.fillCircle(tx, ty, 4);
  }

  update(_time: number, _delta: number): void {}
}
