import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Graphics[] = [];
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // Score
    this.scoreText = this.add
      .text(20, 16, 'Score: 0', {
        fontSize: '24px', color: '#ffd700',
        stroke: '#000', strokeThickness: 4,
      })
      .setDepth(200);

    // Level
    this.levelText = this.add
      .text(GAME_WIDTH / 2, 16, 'Level 1', {
        fontSize: '24px', color: '#ffffff',
        stroke: '#000', strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(200);

    // Lives hearts
    this.hearts = [];
    this.drawHearts(3);

    // Bottom hint
    this.hintText = this.add
      .text(GAME_WIDTH / 2, 690, 'Draw  ○ circle   △ triangle   ⚡ zigzag  to defeat ghosts!', {
        fontSize: '17px', color: '#ede7f6',
        stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(200)
      .setAlpha(0.85);

    const gameScene = this.scene.get('GameScene');
    gameScene.events.on('uiScore', (score: number) => {
      this.scoreText.setText(`Score: ${score}`);
      this.tweens.add({
        targets: this.scoreText,
        scaleX: 1.3, scaleY: 1.3,
        duration: 100, yoyo: true,
      });
    });

    gameScene.events.on('uiLives', (lives: number) => {
      this.drawHearts(lives);
    });

    gameScene.events.on('uiLevel', (level: number) => {
      this.levelText.setText(level > 4 ? '' : level === 4 ? '⚠ BOSS' : `Level ${level}`);
    });
  }

  private drawHearts(count: number): void {
    for (const h of this.hearts) h.destroy();
    this.hearts = [];

    for (let i = 0; i < 3; i++) {
      const g = this.add.graphics().setDepth(200);
      const x = GAME_WIDTH - 44 - i * 42;
      const y = 28;
      if (i < count) {
        // Full heart — red
        g.fillStyle(0xff1744, 1);
        this.drawHeart(g, x, y, 16);
        g.lineStyle(2, 0xb71c1c, 1);
        this.strokeHeart(g, x, y, 16);
      } else {
        // Empty heart — grey outline
        g.lineStyle(2, 0x666666, 1);
        this.strokeHeart(g, x, y, 16);
      }
      this.hearts.push(g);
    }
  }

  private drawHeart(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    const pts: Phaser.Geom.Point[] = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      const hx = cx + r * 16 * Math.pow(Math.sin(t), 3) / 16;
      const hy = cy - r * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
      pts.push(new Phaser.Geom.Point(hx, hy));
    }
    g.fillPoints(pts, true);
  }

  private strokeHeart(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    g.beginPath();
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      const hx = cx + r * 16 * Math.pow(Math.sin(t), 3) / 16;
      const hy = cy - r * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
      if (i === 0) g.moveTo(hx, hy); else g.lineTo(hx, hy);
    }
    g.strokePath();
  }
}
