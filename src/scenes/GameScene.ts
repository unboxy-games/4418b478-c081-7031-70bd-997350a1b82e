import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// ── Constants ──────────────────────────────────────────────────────────────
const PW = 16;          // paddle width
const PH = 110;         // paddle height
const PX_L = 58;        // left paddle X (left edge)
const PX_R = GAME_WIDTH - 58 - PW; // right paddle X (left edge)
const PADDLE_SPEED = 560;
const BALL_R = 10;
const WINNING_SCORE = 7;
const BASE_SPEED = 420;
const MAX_SPEED = 740;
const TRAIL_LEN = 9;

type State = 'countdown' | 'playing' | 'scored' | 'gameover';

export class GameScene extends Phaser.Scene {
  // Paddle centre Y
  private lY = GAME_HEIGHT / 2;
  private rY = GAME_HEIGHT / 2;

  // Ball state
  private bX = GAME_WIDTH / 2;
  private bY = GAME_HEIGHT / 2;
  private bVX = 0;
  private bVY = 0;
  private bSpeed = BASE_SPEED;
  private trail: Array<{ x: number; y: number }> = [];

  // Scores
  private lScore = 0;
  private rScore = 0;

  // State machine
  private state: State = 'countdown';

  // Graphics objects
  private lGfx!: Phaser.GameObjects.Graphics;
  private rGfx!: Phaser.GameObjects.Graphics;
  private ballGfx!: Phaser.GameObjects.Graphics;
  private lScoreTxt!: Phaser.GameObjects.Text;
  private rScoreTxt!: Phaser.GameObjects.Text;
  private flashGfx!: Phaser.GameObjects.Graphics;

  // Keys
  private wKey!: Phaser.Input.Keyboard.Key;
  private sKey!: Phaser.Input.Keyboard.Key;
  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'GameScene' });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    this.lY = GAME_HEIGHT / 2;
    this.rY = GAME_HEIGHT / 2;
    this.lScore = 0;
    this.rScore = 0;
    this.bSpeed = BASE_SPEED;
    this.trail = [];
    this.state = 'countdown';

    this.ensureParticleTexture();
    this.buildBackground();
    this.buildPaddles();
    this.buildBall();
    this.buildScoreUI();
    this.buildFlash();
    this.setupKeys();
    this.startCountdown();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    // ESC → menu (any state except gameover which handles its own ESC)
    if (this.state !== 'gameover' && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('TitleScene'));
      return;
    }

    if (this.state !== 'gameover') {
      this.movePaddles(dt);
    }

    if (this.state === 'playing') {
      this.moveBall(dt);
      // Record trail
      this.trail.push({ x: this.bX, y: this.bY });
      if (this.trail.length > TRAIL_LEN) this.trail.shift();
    }

    this.redrawPaddles();
    this.redrawBall();
  }

  // ── Setup helpers ──────────────────────────────────────────────────────────

  private ensureParticleTexture(): void {
    if (this.textures.exists('pongPart')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture('pongPart', 12, 12);
    g.destroy();
  }

  private buildBackground(): void {
    // Dark gradient background
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x050a18, 0x050a18, 0x080f22, 0x080f22, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Dashed center divider
    const div = this.add.graphics().setDepth(1);
    div.lineStyle(3, 0xffffff, 0.18);
    const dh = 20, gh = 14;
    for (let y = 0; y < GAME_HEIGHT; y += dh + gh) {
      div.lineBetween(GAME_WIDTH / 2, y, GAME_WIDTH / 2, y + dh);
    }

    // Subtle player labels
    this.add.text(GAME_WIDTH / 4, 22, 'P1', {
      fontSize: '16px', fontFamily: 'monospace', color: '#1e3a66',
    }).setOrigin(0.5).setDepth(2);

    this.add.text((3 * GAME_WIDTH) / 4, 22, 'P2', {
      fontSize: '16px', fontFamily: 'monospace', color: '#663a1e',
    }).setOrigin(0.5).setDepth(2);

    // ESC hint
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, 'ESC — Return to Menu', {
      fontSize: '13px', fontFamily: 'monospace', color: '#1e1e3a',
    }).setOrigin(0.5).setDepth(2);
  }

  private buildPaddles(): void {
    this.lGfx = this.add.graphics().setDepth(3);
    this.rGfx = this.add.graphics().setDepth(3);
  }

  private buildBall(): void {
    this.ballGfx = this.add.graphics().setDepth(4);
  }

  private buildScoreUI(): void {
    this.lScoreTxt = this.add.text(GAME_WIDTH / 4, 58, '0', {
      fontSize: '82px',
      fontFamily: 'monospace',
      color: '#4488dd',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.rScoreTxt = this.add.text((3 * GAME_WIDTH) / 4, 58, '0', {
      fontSize: '82px',
      fontFamily: 'monospace',
      color: '#dd8833',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);
  }

  private buildFlash(): void {
    this.flashGfx = this.add.graphics().setDepth(100).setAlpha(0);
  }

  private setupKeys(): void {
    const kb = this.input.keyboard!;
    this.wKey    = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.sKey    = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.upKey   = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.escKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  // ── Countdown ──────────────────────────────────────────────────────────────

  private startCountdown(): void {
    this.state = 'countdown';
    this.bX = GAME_WIDTH / 2;
    this.bY = GAME_HEIGHT / 2;
    this.bVX = 0;
    this.bVY = 0;
    this.bSpeed = BASE_SPEED;
    this.trail = [];

    ['3', '2', '1'].forEach((label, i) => {
      this.time.delayedCall(i * 850, () => this.popLabel(label));
    });
    this.time.delayedCall(3 * 850, () => {
      this.popLabel('GO!');
      this.launchBall();
      this.state = 'playing';
    });
  }

  private popLabel(text: string): void {
    const isGo = text === 'GO!';
    const lbl = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, text, {
      fontSize: isGo ? '90px' : '115px',
      fontFamily: 'monospace',
      color: isGo ? '#ffee44' : '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(50).setAlpha(0).setScale(0.6);

    this.tweens.add({
      targets: lbl, alpha: 1, scaleX: 1, scaleY: 1,
      duration: 250, ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: lbl, alpha: 0, scaleX: 1.4, scaleY: 1.4,
          delay: 480, duration: 220, ease: 'Power2',
          onComplete: () => lbl.destroy(),
        });
      },
    });
  }

  private launchBall(): void {
    const angle = Phaser.Math.Between(-35, 35);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const rad = Phaser.Math.DegToRad(angle);
    this.bVX = dir * this.bSpeed * Math.cos(rad);
    this.bVY = this.bSpeed * Math.sin(rad);
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  private movePaddles(dt: number): void {
    const min = PH / 2;
    const max = GAME_HEIGHT - PH / 2;
    if (this.wKey.isDown)    this.lY = Math.max(min, this.lY - PADDLE_SPEED * dt);
    if (this.sKey.isDown)    this.lY = Math.min(max, this.lY + PADDLE_SPEED * dt);
    if (this.upKey.isDown)   this.rY = Math.max(min, this.rY - PADDLE_SPEED * dt);
    if (this.downKey.isDown) this.rY = Math.min(max, this.rY + PADDLE_SPEED * dt);
  }

  private moveBall(dt: number): void {
    this.bX += this.bVX * dt;
    this.bY += this.bVY * dt;

    // Wall bounces (top / bottom)
    if (this.bY - BALL_R <= 0) {
      this.bY = BALL_R;
      this.bVY = Math.abs(this.bVY);
      this.onWallBounce();
    }
    if (this.bY + BALL_R >= GAME_HEIGHT) {
      this.bY = GAME_HEIGHT - BALL_R;
      this.bVY = -Math.abs(this.bVY);
      this.onWallBounce();
    }

    // Left paddle hit
    if (
      this.bVX < 0 &&
      this.bX - BALL_R <= PX_L + PW &&
      this.bX + BALL_R >= PX_L &&
      this.bY >= this.lY - PH / 2 &&
      this.bY <= this.lY + PH / 2
    ) {
      this.bX = PX_L + PW + BALL_R;
      this.onPaddleHit('left');
    }

    // Right paddle hit
    if (
      this.bVX > 0 &&
      this.bX + BALL_R >= PX_R &&
      this.bX - BALL_R <= PX_R + PW &&
      this.bY >= this.rY - PH / 2 &&
      this.bY <= this.rY + PH / 2
    ) {
      this.bX = PX_R - BALL_R;
      this.onPaddleHit('right');
    }

    // Score zones
    if (this.bX < -30)            this.doScore('right');
    else if (this.bX > GAME_WIDTH + 30) this.doScore('left');
  }

  // ── Collisions & effects ───────────────────────────────────────────────────

  private onPaddleHit(side: 'left' | 'right'): void {
    const paddleY = side === 'left' ? this.lY : this.rY;
    const rel     = (this.bY - paddleY) / (PH / 2); // -1..+1
    const deg     = rel * 65;
    const rad     = Phaser.Math.DegToRad(deg);

    this.bSpeed = Math.min(this.bSpeed * 1.06, MAX_SPEED);

    if (side === 'left') {
      this.bVX =  Math.abs(this.bSpeed * Math.cos(rad));
    } else {
      this.bVX = -Math.abs(this.bSpeed * Math.cos(rad));
    }
    this.bVY = this.bSpeed * Math.sin(rad);

    const tint = side === 'left' ? 0x88bbff : 0xffaa44;
    this.spawnParticles(this.bX, this.bY, tint);
    this.doFlash(side === 'left' ? 0x1a3388 : 0x884411, 0.14);
    this.cameras.main.shake(55, 0.005);
  }

  private onWallBounce(): void {
    this.spawnParticles(this.bX, this.bY, 0xccddff);
    this.cameras.main.shake(35, 0.002);
  }

  private spawnParticles(x: number, y: number, tint: number): void {
    const emitter = this.add.particles(x, y, 'pongPart', {
      speed: { min: 55, max: 190 },
      scale: { start: 0.75, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 380,
      tint,
      emitting: false,
    });
    emitter.setDepth(5);
    emitter.explode(14);
    this.time.delayedCall(500, () => emitter.destroy());
  }

  private doFlash(color: number, alpha: number): void {
    this.flashGfx.clear();
    this.flashGfx.fillStyle(color, 1);
    this.flashGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.flashGfx.setAlpha(alpha);
    this.tweens.killTweensOf(this.flashGfx);
    this.tweens.add({ targets: this.flashGfx, alpha: 0, duration: 180, ease: 'Power2' });
  }

  // ── Scoring ───────────────────────────────────────────────────────────────

  private doScore(scorer: 'left' | 'right'): void {
    this.state = 'scored';
    this.bVX = 0;
    this.bVY = 0;

    if (scorer === 'left') {
      this.lScore++;
      this.lScoreTxt.setText(String(this.lScore));
      this.tweens.add({
        targets: this.lScoreTxt, scaleX: 1.7, scaleY: 1.7,
        duration: 200, yoyo: true, ease: 'Power2',
      });
    } else {
      this.rScore++;
      this.rScoreTxt.setText(String(this.rScore));
      this.tweens.add({
        targets: this.rScoreTxt, scaleX: 1.7, scaleY: 1.7,
        duration: 200, yoyo: true, ease: 'Power2',
      });
    }

    this.doFlash(0xffffff, 0.38);
    this.cameras.main.shake(220, 0.012);

    if (this.lScore >= WINNING_SCORE || this.rScore >= WINNING_SCORE) {
      this.time.delayedCall(950, () => this.showGameOver(scorer));
    } else {
      this.time.delayedCall(1250, () => this.startCountdown());
    }
  }

  // ── Game-Over screen ───────────────────────────────────────────────────────

  private showGameOver(winner: 'left' | 'right'): void {
    this.state = 'gameover';

    const overlay = this.add.graphics().setDepth(999).setAlpha(0);
    overlay.fillStyle(0x000000, 0.68);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 400 });

    const label = winner === 'left' ? 'PLAYER 1 WINS!' : 'PLAYER 2 WINS!';
    const color = winner === 'left' ? '#4488dd' : '#dd8833';

    const winTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 72, label, {
      fontSize: '80px',
      fontFamily: 'monospace',
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(1000).setAlpha(0).setScale(0.55);

    this.tweens.add({
      targets: winTxt, alpha: 1, scaleX: 1, scaleY: 1,
      duration: 500, delay: 200, ease: 'Back.Out',
    });

    const scoreTxt = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 + 28,
      `${this.lScore}  ·  ${this.rScore}`,
      { fontSize: '58px', fontFamily: 'monospace', color: '#ffffff' }
    ).setOrigin(0.5).setDepth(1000).setAlpha(0);

    this.tweens.add({ targets: scoreTxt, alpha: 1, duration: 400, delay: 500 });

    const hint = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 + 128,
      'SPACE / CLICK  ·  Rematch          ESC  ·  Menu',
      { fontSize: '19px', fontFamily: 'monospace', color: '#555577' }
    ).setOrigin(0.5).setDepth(1000).setAlpha(0);

    this.tweens.add({ targets: hint, alpha: 1, duration: 400, delay: 750 });

    // Rematch
    const rematch = () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.restart());
    };
    this.input.keyboard!.once('keydown-SPACE', rematch);
    this.input.once('pointerdown', rematch);

    // ESC → menu (overrides the update-loop ESC since state is 'gameover')
    this.input.keyboard!.once('keydown-ESC', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('TitleScene'));
    });
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  private redrawPaddles(): void {
    // Left paddle (blue)
    this.lGfx.clear();
    this.lGfx.fillStyle(0x2244aa, 0.18);
    this.lGfx.fillRoundedRect(PX_L - 9, this.lY - PH / 2 - 9, PW + 18, PH + 18, 10);
    this.lGfx.fillStyle(0x4488dd, 1);
    this.lGfx.fillRoundedRect(PX_L, this.lY - PH / 2, PW, PH, 6);
    // Highlight stripe
    this.lGfx.fillStyle(0xaaccff, 0.55);
    this.lGfx.fillRoundedRect(PX_L + 2, this.lY - PH / 2 + 7, 5, PH - 14, 3);
    // Edge shine
    this.lGfx.fillStyle(0xffffff, 0.15);
    this.lGfx.fillRoundedRect(PX_L, this.lY - PH / 2, PW, 6, 3);

    // Right paddle (orange)
    this.rGfx.clear();
    this.rGfx.fillStyle(0xaa4411, 0.18);
    this.rGfx.fillRoundedRect(PX_R - 9, this.rY - PH / 2 - 9, PW + 18, PH + 18, 10);
    this.rGfx.fillStyle(0xdd8833, 1);
    this.rGfx.fillRoundedRect(PX_R, this.rY - PH / 2, PW, PH, 6);
    // Highlight stripe (right side)
    this.rGfx.fillStyle(0xffddaa, 0.55);
    this.rGfx.fillRoundedRect(PX_R + PW - 7, this.rY - PH / 2 + 7, 5, PH - 14, 3);
    // Edge shine
    this.rGfx.fillStyle(0xffffff, 0.15);
    this.rGfx.fillRoundedRect(PX_R, this.rY - PH / 2, PW, 6, 3);
  }

  private redrawBall(): void {
    this.ballGfx.clear();

    // Motion trail
    const len = this.trail.length;
    for (let i = 0; i < len; i++) {
      const t = this.trail[i];
      const frac = (i + 1) / (len + 1);
      this.ballGfx.fillStyle(0xffffff, frac * 0.25);
      this.ballGfx.fillCircle(t.x, t.y, BALL_R * frac * 0.85);
    }

    // Glow layers
    this.ballGfx.fillStyle(0xffffff, 0.07);
    this.ballGfx.fillCircle(this.bX, this.bY, BALL_R + 12);
    this.ballGfx.fillStyle(0xffffff, 0.14);
    this.ballGfx.fillCircle(this.bX, this.bY, BALL_R + 5);

    // Core
    this.ballGfx.fillStyle(0xffffff, 1);
    this.ballGfx.fillCircle(this.bX, this.bY, BALL_R);

    // Specular dot
    this.ballGfx.fillStyle(0xffffff, 0.75);
    this.ballGfx.fillCircle(this.bX - 3, this.bY - 3, 3);
  }
}
