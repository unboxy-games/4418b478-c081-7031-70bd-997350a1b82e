import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// ─── Layout ───────────────────────────────────────────────────────────────────
const COLS    = 8;
const BW      = 120;
const BH      = 36;
const BGAP_X  = 10;
const BGAP_Y  = 10;
const BTOT_W  = COLS * BW + (COLS - 1) * BGAP_X;   // 1030
const BX0     = (GAME_WIDTH - BTOT_W) / 2;          // 125
const BY0     = 148;

const PAD_W0  = 144;
const PAD_H   = 18;
const PAD_Y   = GAME_HEIGHT - 68;

const BALL_R  = 11;
const SPEED0  = 425;   // px/s for level 1

const HUD_H   = 96;    // height of top bar

// ─── Colours ──────────────────────────────────────────────────────────────────
const ROW_COL  = [0x4285F4, 0xEA4335, 0xFBBC05, 0x34A853];
const ROW_DARK = [0x2063c2, 0xb8271c, 0xc89300, 0x1a7a40];
const ROW_PTS  = [40, 30, 20, 10];

type Kind  = 'normal' | 'hard' | 'life' | 'wide';
type State = 'playing' | 'paused' | 'over' | 'clear' | 'win';

interface Brick {
  gfx:  Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Text | null;
  cx: number; cy: number;
  w: number;  h: number;
  color: number; dark: number;
  pts: number; kind: Kind; hp: number;
}

// 0=empty  1=normal  2=hard(2-hit)  3=+life  4=wide-paddle
const LEVELS: number[][][] = [
  [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [3, 1, 1, 2, 1, 1, 2, 4],
    [1, 2, 1, 1, 1, 1, 2, 1],
    [1, 1, 4, 0, 0, 3, 1, 1],
  ],
  [
    [2, 1, 2, 1, 1, 2, 1, 2],
    [1, 3, 1, 2, 2, 1, 3, 1],
    [1, 1, 4, 1, 1, 4, 1, 1],
    [2, 1, 1, 2, 2, 1, 1, 2],
  ],
  [
    [2, 2, 2, 2, 2, 2, 2, 2],
    [2, 3, 1, 1, 1, 1, 3, 2],
    [2, 1, 4, 2, 2, 4, 1, 2],
    [2, 2, 2, 1, 1, 2, 2, 2],
  ],
];

// ─── Scene ────────────────────────────────────────────────────────────────────
export class GameScene extends Phaser.Scene {
  // Paddle
  private padGfx!: Phaser.GameObjects.Graphics;
  private padX = GAME_WIDTH / 2;
  private padW = PAD_W0;

  // Ball
  private ballGfx!: Phaser.GameObjects.Graphics;
  private bx = GAME_WIDTH / 2;
  private by = PAD_Y - PAD_H / 2 - BALL_R;
  private bvx = 0;
  private bvy = 0;
  private spd = SPEED0;
  private launched = false;
  private trailMs = 0;

  // Bricks
  private bricks: Brick[] = [];

  // State
  private lives   = 3;
  private score   = 0;
  private hiScore = 0;
  private level   = 0;
  private state: State = 'playing';
  private wideMs    = 0;
  private padHitMs  = 0;   // countdown for paddle-hit flash (ms)

  // HUD refs
  private scoreDisp!: Phaser.GameObjects.Text;
  private hiDisp!:    Phaser.GameObjects.Text;
  private levelDisp!: Phaser.GameObjects.Text;
  private livesArr:   Phaser.GameObjects.Graphics[] = [];
  private msgBg!:     Phaser.GameObjects.Graphics;
  private msgText!:   Phaser.GameObjects.Text;
  private hintText!:  Phaser.GameObjects.Text;

  private clicked = false;

  constructor() { super({ key: 'GameScene' }); }

  // ── create ──────────────────────────────────────────────────────────────────
  create(): void {
    // Background gradient
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x0e0e1c, 0x0e0e1c, 0x090912, 0x090912, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle grid
    const grid = this.add.graphics().setDepth(0);
    grid.lineStyle(1, 0xffffff, 0.022);
    for (let x = 0; x <= GAME_WIDTH; x += 40) grid.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += 40) grid.lineBetween(0, y, GAME_WIDTH, y);

    // Side walls (visual guides)
    const walls = this.add.graphics().setDepth(1);
    walls.lineStyle(2, 0x2a3a5a, 0.9);
    walls.lineBetween(BX0 - 16, HUD_H + 4, BX0 - 16, GAME_HEIGHT);
    walls.lineBetween(BX0 + BTOT_W + 16, HUD_H + 4, BX0 + BTOT_W + 16, GAME_HEIGHT);
    walls.lineBetween(BX0 - 16, HUD_H + 4, BX0 + BTOT_W + 16, HUD_H + 4);
    // Glow dots at wall corners
    walls.fillStyle(0x4466aa, 0.5);
    walls.fillCircle(BX0 - 16, HUD_H + 4, 4);
    walls.fillCircle(BX0 + BTOT_W + 16, HUD_H + 4, 4);

    // ── HUD bar ──
    const hudBg = this.add.graphics().setDepth(9);
    hudBg.fillStyle(0x0a0a18, 1);
    hudBg.fillRect(0, 0, GAME_WIDTH, HUD_H);
    hudBg.lineStyle(1, 0x2a3a5a, 0.9);
    hudBg.lineBetween(0, HUD_H, GAME_WIDTH, HUD_H);

    // Labels
    this.add.text(32, 20, 'BALLS', { fontFamily: 'monospace', fontSize: '12px', color: '#445577' }).setDepth(10);
    this.add.text(GAME_WIDTH / 2, 18, 'SCORE', { fontFamily: 'monospace', fontSize: '12px', color: '#445577' }).setOrigin(0.5, 0).setDepth(10);
    this.add.text(GAME_WIDTH - 32, 18, 'BEST', { fontFamily: 'monospace', fontSize: '12px', color: '#445577' }).setOrigin(1, 0).setDepth(10);
    this.add.text(32, 60, 'LV', { fontFamily: 'monospace', fontSize: '12px', color: '#445577' }).setDepth(10);

    // Score
    this.scoreDisp = this.add.text(GAME_WIDTH / 2, 52, '00000', {
      fontFamily: 'monospace', fontSize: '38px', color: '#ffffff',
    }).setOrigin(0.5, 0.5).setDepth(10);

    // Hi-score
    this.hiDisp = this.add.text(GAME_WIDTH - 32, 52, '00000', {
      fontFamily: 'monospace', fontSize: '24px', color: '#556688',
    }).setOrigin(1, 0.5).setDepth(10);

    // Level
    this.levelDisp = this.add.text(60, 68, '1', {
      fontFamily: 'monospace', fontSize: '24px', color: '#99bbff',
    }).setOrigin(0, 0.5).setDepth(10);

    // Lives
    this.redrawLives();

    // ── Message overlay ──
    this.msgBg = this.add.graphics().setDepth(998).setVisible(false);
    this.msgBg.fillStyle(0x000000, 0.72);
    this.msgBg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.msgText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      fontFamily: 'monospace', fontSize: '34px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6, align: 'center', lineSpacing: 12,
    }).setOrigin(0.5).setDepth(1000).setVisible(false);

    // ── Hint text ──
    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 24, 'CLICK OR SPACE TO LAUNCH', {
      fontFamily: 'monospace', fontSize: '13px', color: '#445566',
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: this.hintText, alpha: 0.25, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // ── Paddle ──
    this.padGfx = this.add.graphics().setDepth(3);

    // ── Ball ──
    this.ballGfx = this.add.graphics().setDepth(5);
    this.ballGfx.x = this.bx;
    this.ballGfx.y = this.by;
    this.drawBall();
    this.addBallIdleTween();

    // ── Input ──
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const hw = this.padW / 2;
      this.padX = Phaser.Math.Clamp(p.x, BX0 - 14 + hw, BX0 + BTOT_W + 14 - hw);
    });
    this.input.on('pointerdown',          () => { this.clicked = true; });
    this.input.keyboard?.on('keydown-SPACE', () => { this.clicked = true; });

    // ── Init ──
    this.loadHiScore();
    this.buildLevel();
  }

  // ── update ──────────────────────────────────────────────────────────────────
  update(_t: number, delta: number): void {
    const dt = delta / 1000;
    const wasClicked = this.clicked;
    this.clicked = false;

    if (this.state === 'paused') {
      if (wasClicked) { this.state = 'playing'; this.hideMsg(); this.hintText.setVisible(true); }
      this.syncBallToPaddle();
      this.drawPaddle();
      return;
    }
    if (this.state === 'over' || this.state === 'win') {
      if (wasClicked) this.restartGame();
      return;
    }
    if (this.state === 'clear') {
      if (wasClicked) this.nextLevel();
      return;
    }

    // ── Playing ──
    if (!this.launched) {
      this.syncBallToPaddle();
      this.drawPaddle();
      if (wasClicked) this.launch();
      return;
    }

    // Wide countdown
    if (this.wideMs > 0) {
      this.wideMs -= delta;
      if (this.wideMs <= 0) this.padW = PAD_W0;
    }
    // Paddle-hit flash countdown
    if (this.padHitMs > 0) this.padHitMs -= delta;

    // Ball trail
    this.trailMs += delta;
    if (this.trailMs > 28) {
      this.trailMs = 0;
      const ghost = this.add.graphics().setDepth(4);
      ghost.fillStyle(0xffffff, 0.22);
      ghost.fillCircle(this.bx, this.by, BALL_R * 0.7);
      this.tweens.add({
        targets: ghost, alpha: 0, scaleX: 0.3, scaleY: 0.3,
        duration: 160, ease: 'Quad.easeIn',
        onComplete: () => ghost.destroy(),
      });
    }

    // Move
    this.bx += this.bvx * dt;
    this.by += this.bvy * dt;

    // Wall bounces
    const left  = BX0 - 14;
    const right = BX0 + BTOT_W + 14;
    if (this.bx - BALL_R < left)  { this.bx = left  + BALL_R; this.bvx =  Math.abs(this.bvx); this.cameras.main.shake(45, 0.0025); }
    if (this.bx + BALL_R > right) { this.bx = right - BALL_R; this.bvx = -Math.abs(this.bvx); this.cameras.main.shake(45, 0.0025); }
    if (this.by - BALL_R < HUD_H + 6) { this.by = HUD_H + 6 + BALL_R; this.bvy = Math.abs(this.bvy); this.cameras.main.shake(45, 0.0025); }

    // Ball lost
    if (this.by > GAME_HEIGHT + 50) { this.loseLife(); return; }

    // Collisions
    this.paddleCollide();
    this.brickCollide();

    // Sync ball gfx
    this.ballGfx.x = this.bx;
    this.ballGfx.y = this.by;
    this.drawPaddle();

    // Win check
    if (this.launched && this.bricks.length === 0) this.onLevelClear();
  }

  // ─── Physics helpers ────────────────────────────────────────────────────────
  private syncBallToPaddle(): void {
    this.bx = this.padX;
    this.by = PAD_Y - PAD_H / 2 - BALL_R;
    this.ballGfx.x = this.bx;
    this.ballGfx.y = this.by;
  }

  private launch(): void {
    this.launched = true;
    this.hintText.setVisible(false);
    this.tweens.killTweensOf(this.ballGfx);
    this.ballGfx.setScale(1);
    const deg = -90 + Phaser.Math.Between(-38, 38);
    const rad = Phaser.Math.DegToRad(deg);
    this.bvx = Math.cos(rad) * this.spd;
    this.bvy = Math.sin(rad) * this.spd;
    this.tweens.add({ targets: this.ballGfx, scaleX: 1.5, scaleY: 1.5, duration: 80, yoyo: true, ease: 'Sine.easeOut' });
  }

  private paddleCollide(): void {
    const hh = PAD_H / 2, hw = this.padW / 2;
    if (
      this.bvy > 0 &&
      this.by + BALL_R >= PAD_Y - hh &&
      this.by - BALL_R <= PAD_Y + hh &&
      this.bx >= this.padX - hw - BALL_R &&
      this.bx <= this.padX + hw + BALL_R
    ) {
      this.by = PAD_Y - hh - BALL_R;
      const pct = Phaser.Math.Clamp((this.bx - this.padX) / hw, -1, 1);
      const ang = Phaser.Math.DegToRad(-90 + pct * 58);
      const spd = Math.min(Math.hypot(this.bvx, this.bvy) * 1.008, this.spd * 1.65);
      this.bvx = Math.cos(ang) * spd;
      this.bvy = Math.sin(ang) * spd;
      if (this.bvy > 0) this.bvy = -this.bvy;
      this.padHitMs = 120;   // trigger flash drawn in drawPaddle()
    }
  }

  private brickCollide(): void {
    for (let i = this.bricks.length - 1; i >= 0; i--) {
      const b = this.bricks[i];
      const dx = Math.abs(this.bx - b.cx);
      const dy = Math.abs(this.by - b.cy);
      const hw = b.w / 2 + BALL_R, hh = b.h / 2 + BALL_R;
      if (dx > hw || dy > hh) continue;

      const ox = hw - dx, oy = hh - dy;
      if (ox < oy) { this.bvx = -this.bvx; this.bx += this.bvx > 0 ? ox : -ox; }
      else         { this.bvy = -this.bvy; this.by += this.bvy > 0 ? oy : -oy; }

      b.hp--;
      if (b.hp <= 0) {
        this.breakBrick(b, i);
      } else {
        this.drawBrickGfx(b);
        this.tweens.add({ targets: b.gfx, alpha: 0.3, duration: 55, yoyo: true });
      }
      break;
    }
  }

  private breakBrick(b: Brick, idx: number): void {
    this.burst(b.cx, b.cy, b.color);
    this.addScore(b.pts * (this.level + 1));
    if (b.kind === 'life') {
      if (this.lives < 3) { this.lives++; this.redrawLives(); }
      this.floatText(b.cx, b.cy, '+BALL', '#ff9999');
    } else if (b.kind === 'wide') {
      this.padW = Math.round(PAD_W0 * 1.78);
      this.wideMs = 9000;
      this.floatText(b.cx, b.cy, 'WIDE!', '#ffdd44');
    }
    b.gfx.destroy();
    b.icon?.destroy();
    this.bricks.splice(idx, 1);
  }

  // ─── Level management ───────────────────────────────────────────────────────
  private buildLevel(): void {
    this.bricks.forEach(b => { b.gfx.destroy(); b.icon?.destroy(); });
    this.bricks = [];

    const layout = LEVELS[this.level % LEVELS.length];
    layout.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell === 0) return;
        const cx = BX0 + c * (BW + BGAP_X) + BW / 2;
        const cy = BY0 + r * (BH + BGAP_Y) + BH / 2;
        const color = ROW_COL[r % ROW_COL.length];
        const dark  = ROW_DARK[r % ROW_DARK.length];
        const pts   = ROW_PTS[r % ROW_PTS.length];
        const kind: Kind = cell === 2 ? 'hard' : cell === 3 ? 'life' : cell === 4 ? 'wide' : 'normal';
        const hp = kind === 'hard' ? 2 : 1;

        const gfx = this.add.graphics().setDepth(2);
        gfx.x = cx; gfx.y = cy;
        const brick: Brick = { gfx, icon: null, cx, cy, w: BW, h: BH, color, dark, pts, kind, hp };
        this.drawBrickGfx(brick);

        if (kind === 'life' || kind === 'wide') {
          const sym = kind === 'life' ? '+' : '○';
          brick.icon = this.add.text(cx, cy, sym, {
            fontFamily: 'monospace', fontSize: kind === 'life' ? '22px' : '20px',
            color: '#ffffff', fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(3);
          this.tweens.add({ targets: brick.icon, scaleX: 1.22, scaleY: 1.22, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }

        // Drop-in animation
        const finalY = cy;
        gfx.y = cy - 44; gfx.alpha = 0;
        this.tweens.add({
          targets: gfx, y: finalY, alpha: 1,
          duration: 380, delay: (r * COLS + c) * 20,
          ease: 'Back.easeOut',
        });
        if (brick.icon) {
          const finalIconY = cy;
          brick.icon.y = cy - 44; brick.icon.alpha = 0;
          this.tweens.add({
            targets: brick.icon, y: finalIconY, alpha: 1,
            duration: 380, delay: (r * COLS + c) * 20 + 80,
            ease: 'Back.easeOut',
          });
        }
        this.bricks.push(brick);
      });
    });
  }

  private onLevelClear(): void {
    this.cameras.main.flash(500, 255, 255, 120);
    if (this.level >= LEVELS.length - 1) {
      this.state = 'win';
      this.saveHiScore();
      this.showMsg('YOU WIN!\n\nFinal: ' + String(this.score).padStart(5, '0') + '\n\nClick to play again');
    } else {
      this.state = 'clear';
      this.showMsg('LEVEL ' + (this.level + 1) + ' CLEAR!\n\nClick for next level');
    }
  }

  private nextLevel(): void {
    this.level++;
    this.hideMsg();
    this.launched = false;
    this.padW = PAD_W0; this.wideMs = 0;
    this.spd  = SPEED0 + this.level * 35;
    this.padX = GAME_WIDTH / 2;
    this.state = 'playing';
    this.levelDisp.setText(String(this.level + 1));
    this.hintText.setVisible(true);
    this.addBallIdleTween();
    this.buildLevel();
  }

  private loseLife(): void {
    this.lives--;
    this.launched = false;
    this.padX = GAME_WIDTH / 2;
    this.wideMs = 0; this.padW = PAD_W0;
    this.redrawLives();
    this.cameras.main.flash(350, 255, 30, 30);
    this.cameras.main.shake(280, 0.014);

    if (this.lives <= 0) {
      this.state = 'over';
      this.saveHiScore();
      this.showMsg('GAME OVER\n\nScore: ' + String(this.score).padStart(5, '0') + '\n\nClick to retry');
    } else {
      this.state = 'paused';
      this.addBallIdleTween();
      this.showMsg(this.lives + ' ball' + (this.lives > 1 ? 's' : '') + ' left\n\nClick to continue');
    }
  }

  private restartGame(): void {
    this.score = 0; this.lives = 3; this.level = 0;
    this.spd = SPEED0; this.padW = PAD_W0; this.wideMs = 0;
    this.padX = GAME_WIDTH / 2;
    this.launched = false; this.state = 'playing';
    this.scoreDisp.setText('00000');
    this.levelDisp.setText('1');
    this.hideMsg(); this.redrawLives();
    this.hintText.setVisible(true);
    this.addBallIdleTween();
    this.buildLevel();
  }

  // ─── Drawing helpers ────────────────────────────────────────────────────────
  private drawBrickGfx(b: Brick): void {
    b.gfx.clear();
    const x = -b.w / 2, y = -b.h / 2, r = 7;

    if (b.kind === 'hard' && b.hp === 2) {
      b.gfx.fillStyle(b.color, 0.72);
      b.gfx.fillRoundedRect(x, y, b.w, b.h, r);
      b.gfx.fillStyle(0xffffff, 0.1);
      b.gfx.fillRoundedRect(x + 4, y + 3, b.w - 8, b.h * 0.38, { tl: r, tr: r, bl: 0, br: 0 });
      this.dashedRect(b.gfx, x, y, b.w, b.h, r);
    } else if (b.kind === 'hard' && b.hp === 1) {
      // Cracked / damaged
      b.gfx.fillStyle(b.dark, 1);
      b.gfx.fillRoundedRect(x, y, b.w, b.h, r);
      b.gfx.lineStyle(1.5, 0x000000, 0.55);
      b.gfx.lineBetween(x + b.w * 0.33, y + 4, x + b.w * 0.43, y + b.h - 4);
      b.gfx.lineBetween(x + b.w * 0.62, y + 4, x + b.w * 0.52, y + b.h - 4);
      b.gfx.lineStyle(1, 0xffffff, 0.18);
      b.gfx.strokeRoundedRect(x, y, b.w, b.h, r);
    } else {
      b.gfx.fillStyle(b.color, 1);
      b.gfx.fillRoundedRect(x, y, b.w, b.h, r);
      b.gfx.fillStyle(0xffffff, 0.2);
      b.gfx.fillRoundedRect(x + 4, y + 3, b.w - 8, b.h * 0.38, { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
      b.gfx.fillStyle(b.dark, 0.55);
      b.gfx.fillRoundedRect(x + 4, y + b.h * 0.66, b.w - 8, b.h * 0.27, { tl: 0, tr: 0, bl: r - 1, br: r - 1 });
      b.gfx.lineStyle(1.5, b.dark, 0.9);
      b.gfx.strokeRoundedRect(x, y, b.w, b.h, r);
    }
  }

  private dashedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, _r: number): void {
    g.lineStyle(2, 0xffffff, 0.72);
    const dash = 9, gap = 5;
    const segs: [number, number, number, number][] = [
      [x,   y,   x+w, y  ], [x+w, y,   x+w, y+h],
      [x+w, y+h, x,   y+h], [x,   y+h, x,   y  ],
    ];
    for (const [x1, y1, x2, y2] of segs) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const nx = (x2 - x1) / len, ny = (y2 - y1) / len;
      let d = 0, draw = true;
      while (d < len) {
        const step = Math.min(d + (draw ? dash : gap), len);
        if (draw) g.lineBetween(x1 + nx * d, y1 + ny * d, x1 + nx * step, y1 + ny * step);
        d = step; draw = !draw;
      }
    }
  }

  private drawPaddle(): void {
    this.padGfx.clear();
    const x = this.padX - this.padW / 2, y = PAD_Y - PAD_H / 2, r = PAD_H / 2;
    // Glow
    this.padGfx.fillStyle(0xaabbdd, 0.12);
    this.padGfx.fillRoundedRect(x - 6, y - 4, this.padW + 12, PAD_H + 8, r + 4);
    // Body
    this.padGfx.fillStyle(0xd8dcea, 1);
    this.padGfx.fillRoundedRect(x, y, this.padW, PAD_H, r);
    // Top highlight
    this.padGfx.fillStyle(0xffffff, 0.55);
    this.padGfx.fillRoundedRect(x + 6, y + 2, this.padW - 12, PAD_H * 0.38, r);
    // Bottom shadow
    this.padGfx.fillStyle(0x8899aa, 0.5);
    this.padGfx.fillRoundedRect(x + 6, y + PAD_H * 0.64, this.padW - 12, PAD_H * 0.28, { tl: 0, tr: 0, bl: r, br: r });
    // Border
    this.padGfx.lineStyle(1.5, 0x667799, 0.7);
    this.padGfx.strokeRoundedRect(x, y, this.padW, PAD_H, r);
    // Hit flash — fades out over 120 ms after a ball bounce
    if (this.padHitMs > 0) {
      const alpha = (this.padHitMs / 120) * 0.55;
      this.padGfx.fillStyle(0xffffff, alpha);
      this.padGfx.fillRoundedRect(x, y, this.padW, PAD_H, r);
    }
  }

  private drawBall(): void {
    this.ballGfx.clear();
    this.ballGfx.fillStyle(0xffffff, 0.13);
    this.ballGfx.fillCircle(0, 0, BALL_R + 5);
    this.ballGfx.fillStyle(0xffffff, 1);
    this.ballGfx.fillCircle(0, 0, BALL_R);
    this.ballGfx.fillStyle(0xffffff, 0.65);
    this.ballGfx.fillCircle(-BALL_R * 0.32, -BALL_R * 0.32, BALL_R * 0.4);
  }

  private addBallIdleTween(): void {
    this.tweens.killTweensOf(this.ballGfx);
    this.ballGfx.setScale(1);
    this.tweens.add({
      targets: this.ballGfx, scaleX: 1.1, scaleY: 1.1,
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  private redrawLives(): void {
    this.livesArr.forEach(g => g.destroy());
    this.livesArr = [];
    for (let i = 0; i < 3; i++) {
      const g = this.add.graphics().setDepth(10);
      const cx = 36 + i * 28, cy = 62;
      if (i < this.lives) {
        g.fillStyle(0xffffff, 1);
        g.fillCircle(cx, cy, 10);
        g.fillStyle(0xffffff, 0.55);
        g.fillCircle(cx - 3, cy - 3, 4);
      } else {
        g.lineStyle(2, 0x2a3a5a, 1);
        g.strokeCircle(cx, cy, 10);
      }
      this.livesArr.push(g);
    }
  }

  private addScore(pts: number): void {
    this.score += pts;
    this.scoreDisp.setText(String(this.score).padStart(5, '0'));
    this.tweens.add({ targets: this.scoreDisp, scaleX: 1.2, scaleY: 1.2, duration: 75, yoyo: true, ease: 'Sine.easeOut' });
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      this.hiDisp.setText(String(this.hiScore).padStart(5, '0'));
      this.hiDisp.setColor('#ffdd88');
    }
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: 'monospace', fontSize: '20px', color,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: t, y: y - 58, alpha: 0, duration: 880, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private burst(x: number, y: number, color: number): void {
    for (let i = 0; i < 14; i++) {
      const p = this.add.graphics().setDepth(6);
      const sz = Phaser.Math.Between(4, 11);
      p.fillStyle(color, 1);
      p.fillRect(-sz / 2, -sz / 2, sz, sz);
      p.x = x + Phaser.Math.Between(-16, 16);
      p.y = y;
      const ang = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
      const spd = Phaser.Math.Between(60, 230);
      this.tweens.add({
        targets: p,
        x: p.x + Math.cos(ang) * spd * 0.55,
        y: p.y + Math.sin(ang) * spd * 0.55 + 35,
        alpha: 0, scaleX: 0.15, scaleY: 0.15,
        duration: Phaser.Math.Between(260, 560), ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private showMsg(text: string): void {
    this.msgBg.setVisible(true).setAlpha(0);
    this.msgText.setText(text).setVisible(true).setAlpha(0);
    this.tweens.add({ targets: [this.msgBg, this.msgText], alpha: 1, duration: 300, ease: 'Sine.easeOut' });
  }

  private hideMsg(): void {
    this.msgBg.setVisible(false);
    this.msgText.setVisible(false);
  }

  // ─── Persistence ────────────────────────────────────────────────────────────
  private async loadHiScore(): Promise<void> {
    try {
      const sdk = (window as any).unboxy;
      if (!sdk) return;
      const val = await sdk.saves.get('highScore');
      if (typeof val === 'number') {
        this.hiScore = val;
        this.hiDisp.setText(String(this.hiScore).padStart(5, '0'));
      }
    } catch { /* silent */ }
  }

  private async saveHiScore(): Promise<void> {
    try {
      const sdk = (window as any).unboxy;
      if (!sdk) return;
      const existing = await sdk.saves.get('highScore');
      if (typeof existing !== 'number' || this.score > existing) {
        await sdk.saves.set('highScore', this.score);
      }
    } catch (e) { console.warn('Failed to save hi-score:', e); }
  }
}
