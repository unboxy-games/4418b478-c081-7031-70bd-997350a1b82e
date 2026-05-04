import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// Knight animation frame keys
const KNIGHT_WALK_FRAMES   = ['knightWalk1', 'knightWalk2'];
const KNIGHT_ATTACK_FRAMES = ['knightAttack1', 'knightAttack2'];
const KNIGHT_IDLE_FRAME    = 'knightIdle';
const KNIGHT_SPEED         = 200; // px/s
const KNIGHT_FRAME_MS      = 140; // ms per walk frame
const KNIGHT_ATTACK_MS     = 160; // ms per attack frame

export class TitleScene extends Phaser.Scene {
  declare rexUI: any;

  private knight!: Phaser.GameObjects.Image;
  private knightKeys!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
  };
  private knightFrameIdx   = 0;
  private knightFrameMs    = 0;
  private knightState: 'idle' | 'walk' | 'attack' = 'idle';
  private knightAttackMs   = 0;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // ── Background ──────────────────────────────────────────────────────────
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x020510, 0x020510, 0x060d1e, 0x060d1e, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Abstract geometric layer
    this.drawGeometricBg();

    // Subtle radial glow behind title
    const glow = this.add.graphics().setDepth(0);
    glow.fillStyle(0x1a2d6b, 0.30);
    glow.fillEllipse(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, 700, 360);

    // ── Court divider ───────────────────────────────────────────────────────
    this.drawDivider();

    // ── Decorative ghost court elements ─────────────────────────────────────
    const ghost = this.add.graphics().setDepth(1);

    // Paddles
    ghost.fillStyle(0x4488dd, 0.09);
    ghost.fillRoundedRect(58, GAME_HEIGHT / 2 - 55, 16, 110, 6);
    ghost.fillStyle(0xdd8833, 0.09);
    ghost.fillRoundedRect(GAME_WIDTH - 74, GAME_HEIGHT / 2 - 55, 16, 110, 6);

    // Ghost ball
    ghost.fillStyle(0xffffff, 0.08);
    ghost.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, 10);

    // Court top & bottom boundary lines
    ghost.lineStyle(2, 0xffffff, 0.06);
    ghost.lineBetween(0, 4, GAME_WIDTH, 4);
    ghost.lineBetween(0, GAME_HEIGHT - 4, GAME_WIDTH, GAME_HEIGHT - 4);

    // ── PONG title ──────────────────────────────────────────────────────────
    const titleLetters = ['P', 'O', 'N', 'G'];
    const letterSpacing = 130;
    const startX = GAME_WIDTH / 2 - (letterSpacing * (titleLetters.length - 1)) / 2;

    titleLetters.forEach((letter, i) => {
      const finalY = GAME_HEIGHT / 2 - 120;
      const txt = this.add.text(startX + i * letterSpacing, finalY - 40, letter, {
        fontSize: '160px',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#1a3a9e',
        strokeThickness: 8,
      })
        .setOrigin(0.5)
        .setDepth(2)
        .setAlpha(0);

      this.tweens.add({
        targets: txt,
        alpha: 1,
        y: finalY,
        duration: 500,
        delay: 80 + i * 90,
        ease: 'Back.Out',
      });
    });

    // ── Subtitle rule lines ─────────────────────────────────────────────────
    const ruleY = GAME_HEIGHT / 2 - 6;
    const rules = this.add.graphics().setDepth(2).setAlpha(0);
    rules.lineStyle(2, 0xffffff, 0.3);
    rules.lineBetween(80, ruleY, GAME_WIDTH / 2 - 90, ruleY);
    rules.lineBetween(GAME_WIDTH / 2 + 90, ruleY, GAME_WIDTH - 80, ruleY);
    this.tweens.add({ targets: rules, alpha: 1, duration: 500, delay: 500 });

    // ── Player control cards ─────────────────────────────────────────────────
    const makeCard = (x: number, label: string, keys: string, color: number) => {
      const cardG = this.add.graphics().setDepth(2).setAlpha(0);

      // Card bg
      cardG.fillStyle(color, 0.12);
      cardG.fillRoundedRect(x - 90, GAME_HEIGHT / 2 + 18, 180, 90, 12);
      cardG.lineStyle(1, color, 0.4);
      cardG.strokeRoundedRect(x - 90, GAME_HEIGHT / 2 + 18, 180, 90, 12);

      const playerTxt = this.add.text(x, GAME_HEIGHT / 2 + 38, label, {
        fontSize: '16px',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        letterSpacing: 3,
      }).setOrigin(0.5).setDepth(2).setAlpha(0);

      const keysTxt = this.add.text(x, GAME_HEIGHT / 2 + 68, keys, {
        fontSize: '22px',
        fontFamily: 'monospace',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(2).setAlpha(0);

      this.tweens.add({ targets: [cardG, playerTxt, keysTxt], alpha: 1, duration: 500, delay: 500 });
    };

    makeCard(GAME_WIDTH / 4, 'PLAYER 1', 'W  ·  S', 0x4488dd);
    makeCard((3 * GAME_WIDTH) / 4, 'PLAYER 2', '↑  ·  ↓', 0xdd8833);

    // ── VS badge ────────────────────────────────────────────────────────────
    const vsBadge = this.add.graphics().setDepth(3).setAlpha(0);
    vsBadge.fillStyle(0xffffff, 0.08);
    vsBadge.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 63, 24);
    const vsText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 63, 'VS', {
      fontSize: '17px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(3).setAlpha(0);
    this.tweens.add({ targets: [vsBadge, vsText], alpha: 1, duration: 400, delay: 600 });

    // ── First-to notice ──────────────────────────────────────────────────────
    const notice = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 135, 'FIRST TO 7 POINTS WINS', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#3a4a7a',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(2).setAlpha(0);
    this.tweens.add({ targets: notice, alpha: 1, duration: 400, delay: 650 });

    // ── Start button (rexUI) ─────────────────────────────────────────────────
    const btnBg = this.rexUI.add.roundRectangle(0, 0, 0, 0, 14, 0x1a3a9e);
    const btnBgHover = this.rexUI.add.roundRectangle(0, 0, 0, 0, 14, 0x2a5acc);

    const btnLabel = this.rexUI.add.label({
      width: 220,
      height: 56,
      background: btnBg,
      text: this.add.text(0, 0, '▶  START GAME', {
        fontSize: '20px',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        color: '#ffffff',
      }),
      align: 'center',
      space: { left: 16, right: 16, top: 0, bottom: 0 },
      name: 'start',
    });

    const startBtn = this.rexUI.add.buttons({
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 72,
      orientation: 'x',
      buttons: [btnLabel],
      click: { mode: 'pointerup', clickInterval: 300 },
    })
      .layout()
      .setDepth(100)
      .setAlpha(0);

    this.tweens.add({ targets: startBtn, alpha: 1, duration: 400, delay: 750 });

    // Hover: swap background fill
    startBtn.on('button.over', (_btn: any) => {
      btnBg.setVisible(false);
      btnBgHover.setVisible(true);
      // Swap the label's background in-place
      btnLabel.setBackground(btnBgHover);
      btnLabel.layout();
    });
    startBtn.on('button.out', (_btn: any) => {
      btnBg.setVisible(true);
      btnBgHover.setVisible(false);
      btnLabel.setBackground(btnBg);
      btnLabel.layout();
    });

    const go = () => {
      startBtn.off('button.click');
      this.input.keyboard!.off('keydown-ENTER', go);
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('GameScene'));
    };

    startBtn.on('button.click', go);

    // ENTER starts the game (SPACE is reserved for knight attack)
    this.input.keyboard!.once('keydown-ENTER', go);

    // ── Decorative car ───────────────────────────────────────────────────────
    const car = this.add.image(GAME_WIDTH / 2 + 320, GAME_HEIGHT - 90, 'tile_0002')
      .setScale(3.5)
      .setDepth(2)
      .setAlpha(0);
    this.tweens.add({ targets: car, alpha: 0.75, duration: 500, delay: 700 });

    // ── ESC hint ────────────────────────────────────────────────────────────
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 22, 'ENTER  or  CLICK TO START', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#1e2840',
    }).setOrigin(0.5).setDepth(2);

    // ── Controllable knight ──────────────────────────────────────────────────
    this.knight = this.add.image(160, GAME_HEIGHT - 110, KNIGHT_IDLE_FRAME)
      .setScale(0.14)
      .setDepth(6)
      .setAlpha(0);

    this.tweens.add({ targets: this.knight, alpha: 1, duration: 500, delay: 800 });

    // Arrow-key hint beneath the knight
    const knightHint = this.add.text(160, GAME_HEIGHT - 48, '← → ↑ ↓  move knight', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#2a3d6a',
    }).setOrigin(0.5).setDepth(6).setAlpha(0);
    this.tweens.add({ targets: knightHint, alpha: 1, duration: 400, delay: 950 });

    // Keyboard bindings (separate from ENTER/ESC used elsewhere)
    this.knightKeys = this.input.keyboard!.addKeys({
      left:  Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      up:    Phaser.Input.Keyboard.KeyCodes.UP,
      down:  Phaser.Input.Keyboard.KeyCodes.DOWN,
    }) as any;

    // SPACE → knight attack
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (this.knightState === 'attack') return; // already attacking
      this.knightState    = 'attack';
      this.knightAttackMs = 0;
      this.knightFrameMs  = 0;
      this.knight.setTexture(KNIGHT_ATTACK_FRAMES[0]);

      // Punch-scale feedback
      const base = 0.14;
      this.tweens.add({
        targets: this.knight,
        scaleX: base * 1.18,
        scaleY: base * 1.18,
        duration: 70,
        yoyo: true,
        ease: 'Quad.Out',
        onComplete: () => { this.knight.setScale(base); },
      });

      // Slash effect: a few white arcs that fade out quickly
      const slash = this.add.graphics().setDepth(7);
      const sx    = this.knight.flipX ? this.knight.x - 36 : this.knight.x + 36;
      const sy    = this.knight.y - 8;
      const dir   = this.knight.flipX ? -1 : 1;
      slash.lineStyle(3, 0xffffff, 0.9);
      slash.beginPath();
      slash.arc(sx, sy, 28, Phaser.Math.DegToRad(-40 * dir - 30), Phaser.Math.DegToRad(-40 * dir + 30), false);
      slash.strokePath();
      slash.lineStyle(2, 0xaaddff, 0.7);
      slash.beginPath();
      slash.arc(sx, sy + 10, 20, Phaser.Math.DegToRad(-50 * dir - 25), Phaser.Math.DegToRad(-50 * dir + 25), false);
      slash.strokePath();
      this.tweens.add({
        targets: slash,
        alpha: 0,
        duration: 220,
        ease: 'Quad.In',
        onComplete: () => slash.destroy(),
      });
    });
  }

  update(_time: number, delta: number): void {
    if (!this.knight || !this.knightKeys) return;

    // ── Attack state: play 2 frames then return to idle ──────────────────────
    if (this.knightState === 'attack') {
      this.knightAttackMs += delta;
      const frameIdx = Math.min(
        Math.floor(this.knightAttackMs / KNIGHT_ATTACK_MS),
        KNIGHT_ATTACK_FRAMES.length - 1,
      );
      this.knight.setTexture(KNIGHT_ATTACK_FRAMES[frameIdx]);

      if (this.knightAttackMs >= KNIGHT_ATTACK_MS * KNIGHT_ATTACK_FRAMES.length) {
        // Attack finished — resume idle/walk on next tick
        this.knightState    = 'idle';
        this.knightAttackMs = 0;
        this.knight.setTexture(KNIGHT_IDLE_FRAME);
      }
      return; // lock movement during attack
    }

    // ── Movement ─────────────────────────────────────────────────────────────
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;

    if (this.knightKeys.left.isDown)  { dx = -1; this.knight.setFlipX(true);  }
    if (this.knightKeys.right.isDown) { dx =  1; this.knight.setFlipX(false); }
    if (this.knightKeys.up.isDown)    { dy = -1; }
    if (this.knightKeys.down.isDown)  { dy =  1; }

    // Normalise diagonal
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    this.knight.x = Phaser.Math.Clamp(
      this.knight.x + dx * KNIGHT_SPEED * dt, 40, GAME_WIDTH - 40,
    );
    this.knight.y = Phaser.Math.Clamp(
      this.knight.y + dy * KNIGHT_SPEED * dt, 40, GAME_HEIGHT - 40,
    );

    const moving = dx !== 0 || dy !== 0;
    this.knightState = moving ? 'walk' : 'idle';

    if (moving) {
      this.knightFrameMs += delta;
      if (this.knightFrameMs >= KNIGHT_FRAME_MS) {
        this.knightFrameMs  = 0;
        this.knightFrameIdx = (this.knightFrameIdx + 1) % KNIGHT_WALK_FRAMES.length;
        this.knight.setTexture(KNIGHT_WALK_FRAMES[this.knightFrameIdx]);
      }
    } else {
      this.knightFrameMs = 0;
      this.knight.setTexture(KNIGHT_IDLE_FRAME);
    }
  }

  private drawGeometricBg(): void {
    const g = this.add.graphics().setDepth(0);

    // Helper: points for a regular polygon
    const polyPts = (cx: number, cy: number, r: number, sides = 6, rot = 0) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (Math.PI * 2 / sides) * i + rot;
        return new Phaser.Geom.Point(cx + r * Math.cos(a), cy + r * Math.sin(a));
      });

    // ── Filled polygon blobs ────────────────────────────────────────────────

    // Large hexagon — top-left
    g.fillStyle(0x1a33bb, 0.08);
    g.fillPoints(polyPts(110, 155, 135), true);

    // Large hexagon — bottom-right
    g.fillStyle(0x0d2280, 0.07);
    g.fillPoints(polyPts(GAME_WIDTH - 135, GAME_HEIGHT - 115, 155), true);

    // Medium hexagon — top-right, rotated 30°
    g.fillStyle(0x3311aa, 0.07);
    g.fillPoints(polyPts(GAME_WIDTH - 190, 148, 105, 6, Math.PI / 6), true);

    // Triangle — bottom-left
    g.fillStyle(0x1144bb, 0.06);
    g.fillPoints(polyPts(190, GAME_HEIGHT - 90, 170, 3, 0), true);

    // Triangle — upper-right area
    g.fillStyle(0x220066, 0.06);
    g.fillPoints(polyPts(GAME_WIDTH - 95, 285, 125, 3, Math.PI / 5), true);

    // Small diamond (square rotated 45°) — left center
    g.fillStyle(0x2255cc, 0.06);
    g.fillPoints(polyPts(60, GAME_HEIGHT / 2 + 60, 70, 4, Math.PI / 4), true);

    // Small diamond — right center
    g.fillStyle(0x441188, 0.06);
    g.fillPoints(polyPts(GAME_WIDTH - 60, GAME_HEIGHT / 2 - 60, 80, 4, Math.PI / 4), true);

    // ── Wireframe outlines (slightly brighter) ──────────────────────────────

    g.lineStyle(1, 0x4466dd, 0.14);
    g.strokePoints(polyPts(110, 155, 135), true);
    g.strokePoints(polyPts(GAME_WIDTH - 135, GAME_HEIGHT - 115, 155), true);

    g.lineStyle(1, 0x6644cc, 0.12);
    g.strokePoints(polyPts(GAME_WIDTH - 190, 148, 105, 6, Math.PI / 6), true);
    g.strokePoints(polyPts(190, GAME_HEIGHT - 90, 170, 3, 0), true);
    g.strokePoints(polyPts(GAME_WIDTH - 95, 285, 125, 3, Math.PI / 5), true);

    g.lineStyle(1, 0x3366ee, 0.12);
    g.strokePoints(polyPts(60, GAME_HEIGHT / 2 + 60, 70, 4, Math.PI / 4), true);
    g.strokePoints(polyPts(GAME_WIDTH - 60, GAME_HEIGHT / 2 - 60, 80, 4, Math.PI / 4), true);

    // ── Wireframe circles ────────────────────────────────────────────────────
    g.lineStyle(1, 0x2244aa, 0.09);
    g.strokeCircle(GAME_WIDTH / 2 - 310, GAME_HEIGHT / 2 + 95, 210);
    g.strokeCircle(GAME_WIDTH / 2 + 295, GAME_HEIGHT / 2 - 55, 185);
    g.strokeCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, 340);

    // ── Thin diagonal lines ─────────────────────────────────────────────────
    g.lineStyle(1, 0x1a2d8a, 0.09);
    g.lineBetween(0, 0, GAME_WIDTH * 0.55, GAME_HEIGHT);
    g.lineBetween(GAME_WIDTH, 0, GAME_WIDTH * 0.45, GAME_HEIGHT);
    g.lineBetween(0, GAME_HEIGHT, GAME_WIDTH * 0.28, 0);
    g.lineBetween(GAME_WIDTH, GAME_HEIGHT, GAME_WIDTH * 0.72, 0);
    // Cross accent lines
    g.lineStyle(1, 0x2233aa, 0.07);
    g.lineBetween(0, GAME_HEIGHT * 0.35, GAME_WIDTH * 0.4, 0);
    g.lineBetween(GAME_WIDTH, GAME_HEIGHT * 0.65, GAME_WIDTH * 0.6, GAME_HEIGHT);

    // ── Small accent dots at polygon vertices ───────────────────────────────
    const dotPts = [
      ...polyPts(110, 155, 135),
      ...polyPts(GAME_WIDTH - 135, GAME_HEIGHT - 115, 155),
    ];
    g.fillStyle(0x4466ff, 0.18);
    dotPts.forEach(p => g.fillCircle(p.x, p.y, 2.5));
  }

  private drawDivider(): void {
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(2, 0xffffff, 0.10);
    const dh = 18, gh = 12;
    for (let y = 0; y < GAME_HEIGHT; y += dh + gh) {
      g.lineBetween(GAME_WIDTH / 2, y, GAME_WIDTH / 2, y + dh);
    }
  }
}
