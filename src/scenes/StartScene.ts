import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' });
  }

  create(): void {
    this.createBackground();
    this.createTitle();
    this.createDemoEnemies();
    this.createPrompt();
    this.createControls();

    // Space to start solo
    const startGame = () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
        this.scene.start('UIScene');
      });
    };

    const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey.once('down', startGame);

    // Tap anywhere to start (touch screens)
    this.input.once('pointerdown', startGame);

    // M to enter co-op lobby
    const mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    mKey.once('down', () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('LobbyScene');
      });
    });

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  // ── Background (matches GameScene) ─────────────────────────────────────
  private createBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x000011, 0x000011, 0x000033, 0x000033, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const neb = this.add.graphics().setDepth(0);
    neb.fillStyle(0x0a0044, 0.45);
    neb.fillEllipse(260, 340, 520, 280);
    neb.fillStyle(0x001a11, 0.35);
    neb.fillEllipse(980, 440, 420, 260);
    neb.fillStyle(0x330011, 0.2);
    neb.fillEllipse(640, 600, 360, 200);

    const starGfx = this.add.graphics().setDepth(0);
    for (let i = 0; i < 200; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, GAME_HEIGHT);
      const r  = Phaser.Math.FloatBetween(0.4, 2.2);
      const a  = Phaser.Math.FloatBetween(0.2, 1.0);
      starGfx.fillStyle(0xffffff, a);
      starGfx.fillCircle(sx, sy, r);
    }
  }

  // ── Title ───────────────────────────────────────────────────────────────
  private createTitle(): void {
    // Shadow / glow layers
    this.add.text(GAME_WIDTH / 2 + 4, 130 + 4, 'GALAXIAN', {
      fontFamily: 'monospace',
      fontSize: '96px',
      color: '#330000',
    }).setOrigin(0.5).setDepth(4).setAlpha(0.7);

    this.add.text(GAME_WIDTH / 2 + 2, 130 + 2, 'GALAXIAN', {
      fontFamily: 'monospace',
      fontSize: '96px',
      color: '#991100',
    }).setOrigin(0.5).setDepth(5).setAlpha(0.8);

    const title = this.add.text(GAME_WIDTH / 2, 130, 'GALAXIAN', {
      fontFamily: 'monospace',
      fontSize: '96px',
      color: '#ffcc00',
      stroke: '#ff4400',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(6);

    // Gentle floating bob
    this.tweens.add({
      targets: title,
      y: 138,
      duration: 1800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      loop: -1,
    });
  }

  // ── Decorative enemy rows ───────────────────────────────────────────────
  private createDemoEnemies(): void {
    const rows = [
      { y: 240, count: 8, type: 0 },   // Flagships (red/gold)
      { y: 295, count: 9, type: 1 },   // Escorts (blue)
      { y: 348, count: 10, type: 2 },  // Drones (green)
    ];

    for (const row of rows) {
      const totalW = (row.count - 1) * 72;
      const startX = GAME_WIDTH / 2 - totalW / 2;
      for (let i = 0; i < row.count; i++) {
        const x = startX + i * 72;
        const g = this.makeEnemyGfx(row.type, x, row.y);
        const baseY = row.y;
        // Idle pulse tween
        this.tweens.add({
          targets: g,
          scaleX: 1.08,
          scaleY: 1.08,
          alpha: 0.85,
          duration: 700 + Phaser.Math.Between(0, 300),
          ease: 'Sine.easeInOut',
          yoyo: true,
          loop: -1,
          delay: i * 60,
        });
        // Slow horizontal drift matching formation feel
        this.tweens.add({
          targets: g,
          y: baseY + 6,
          duration: 2200 + i * 80,
          ease: 'Sine.easeInOut',
          yoyo: true,
          loop: -1,
          delay: i * 40,
        });
      }
    }
  }

  private makeEnemyGfx(type: number, x: number, y: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(3);
    g.x = x;
    g.y = y;

    if (type === 0) {
      // Flagship — red/gold
      g.fillStyle(0x991111);
      g.fillEllipse(0, 0, 40, 24);
      g.fillStyle(0x770d0d);
      g.fillTriangle(0, -8, -20, 14, -8, 2);
      g.fillTriangle(0, -8, 20, 14, 8, 2);
      g.fillStyle(0xffcc00);
      g.fillCircle(0, -2, 10);
      g.fillStyle(0xffee88);
      g.fillCircle(0, -4, 6);
      g.fillStyle(0xff2222);
      g.fillCircle(-6, -3, 3.5);
      g.fillCircle(6, -3, 3.5);
      g.fillStyle(0xffffff);
      g.fillCircle(-5, -4, 1.8);
      g.fillCircle(7, -4, 1.8);
      g.lineStyle(2, 0xffcc00, 1);
      g.beginPath(); g.moveTo(0, -12); g.lineTo(0, -16); g.strokePath();
      g.fillStyle(0xffcc00);
      g.fillCircle(0, -16, 3);
    } else if (type === 1) {
      // Escort — blue
      g.fillStyle(0x1155cc);
      g.fillEllipse(0, 0, 32, 20);
      g.fillStyle(0x0c3d99);
      g.fillTriangle(0, -7, -18, 11, -7, 2);
      g.fillTriangle(0, -7, 18, 11, 7, 2);
      g.fillStyle(0xaaddff);
      g.fillCircle(0, -2, 7);
      g.fillStyle(0x77bbff);
      g.fillCircle(0, -3, 4);
      g.fillStyle(0xffeedd);
      g.fillCircle(-6, -3, 2.5);
      g.fillCircle(6, -3, 2.5);
      g.fillStyle(0xff4400);
      g.fillCircle(-6, -3, 1.2);
      g.fillCircle(6, -3, 1.2);
    } else {
      // Drone — green
      g.fillStyle(0x119944);
      g.fillEllipse(0, 0, 28, 18);
      g.fillStyle(0x0d7733);
      g.fillTriangle(0, -6, -16, 10, -7, 2);
      g.fillTriangle(0, -6, 16, 10, 7, 2);
      g.fillStyle(0x77ffaa);
      g.fillCircle(0, -2, 6);
      g.fillStyle(0xccffdd);
      g.fillCircle(0, -3, 3);
      g.fillStyle(0xffff55);
      g.fillCircle(-5, -3, 2.2);
      g.fillCircle(5, -3, 2.2);
      g.fillStyle(0x884400);
      g.fillCircle(-5, -3, 1.1);
      g.fillCircle(5, -3, 1.1);
    }

    return g;
  }

  // ── Press Space prompt ──────────────────────────────────────────────────
  private createPrompt(): void {
    const prompt = this.add.text(GAME_WIDTH / 2, 460, 'PRESS SPACE  or  TAP  TO START', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#004488',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    this.tweens.add({
      targets: prompt,
      alpha: 0,
      duration: 550,
      ease: 'Sine.easeInOut',
      yoyo: true,
      loop: -1,
    });

    // Co-op option
    const mpPrompt = this.add.text(GAME_WIDTH / 2, 504, 'PRESS  M  FOR  CO-OP  MULTIPLAYER', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#44ff88',
      stroke: '#002200',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    this.tweens.add({
      targets: mpPrompt,
      alpha: 0.2,
      duration: 850,
      ease: 'Sine.easeInOut',
      yoyo: true,
      loop: -1,
      delay: 300,
    });
  }

  // ── Controls hint ───────────────────────────────────────────────────────
  private createControls(): void {
    const style = {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#6688aa',
    };
    const cy = 560;
    this.add.text(GAME_WIDTH / 2, cy,      '← A / D →  Move          Space  Fire', style)
      .setOrigin(0.5).setDepth(10);

    // Score table
    const tableStyle = { fontFamily: 'monospace', fontSize: '18px', color: '#aabbcc' };
    const tx = GAME_WIDTH / 2;
    this.add.text(tx, cy + 44, '⬛ FLAGSHIP   150 pts', { ...tableStyle, color: '#ffcc00' })
      .setOrigin(0.5).setDepth(10);
    this.add.text(tx, cy + 68, '⬛ ESCORT      80 pts', { ...tableStyle, color: '#88bbff' })
      .setOrigin(0.5).setDepth(10);
    this.add.text(tx, cy + 92, '⬛ DRONE        40 pts', { ...tableStyle, color: '#66ffaa' })
      .setOrigin(0.5).setDepth(10);
  }
}
