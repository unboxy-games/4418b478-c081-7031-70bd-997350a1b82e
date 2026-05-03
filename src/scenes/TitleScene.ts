import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // ── Background ──────────────────────────────────────────────────────────
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x050a18, 0x050a18, 0x080f22, 0x080f22, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Center dashed divider
    this.drawDivider();

    // Decorative ghost paddles
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0xffffff, 0.07);
    g.fillRoundedRect(58, GAME_HEIGHT / 2 - 55, 16, 110, 6);
    g.fillRoundedRect(GAME_WIDTH - 74, GAME_HEIGHT / 2 - 55, 16, 110, 6);

    // Ghost ball
    g.fillStyle(0xffffff, 0.07);
    g.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 10);

    // ── PONG title ──────────────────────────────────────────────────────────
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 115, 'PONG', {
      fontSize: '190px',
      fontFamily: 'monospace',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#2244bb',
      strokeThickness: 10,
    }).setOrigin(0.5).setDepth(2).setAlpha(0).setY(GAME_HEIGHT / 2 - 100);

    this.tweens.add({
      targets: title,
      alpha: 1,
      y: GAME_HEIGHT / 2 - 115,
      duration: 650,
      ease: 'Power3.Out',
    });

    // ── Player control labels ───────────────────────────────────────────────
    const p1 = this.add.text(GAME_WIDTH / 4, GAME_HEIGHT / 2 + 30, 'PLAYER 1\n  W  /  S', {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#4488dd',
      align: 'center',
    }).setOrigin(0.5).setDepth(2).setAlpha(0);

    const p2 = this.add.text((3 * GAME_WIDTH) / 4, GAME_HEIGHT / 2 + 30, 'PLAYER 2\n  ↑  /  ↓', {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#dd8833',
      align: 'center',
    }).setOrigin(0.5).setDepth(2).setAlpha(0);

    this.tweens.add({ targets: [p1, p2], alpha: 1, duration: 600, delay: 350, ease: 'Power2.Out' });

    // ── Start prompt ────────────────────────────────────────────────────────
    const startPrompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 148, '— PRESS SPACE OR CLICK TO START —', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#ffdd44',
    }).setOrigin(0.5).setDepth(2).setAlpha(0);

    this.tweens.add({ targets: startPrompt, alpha: 1, duration: 600, delay: 700, ease: 'Power2.Out' });

    // Win note at bottom
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 28, 'FIRST TO 7 POINTS WINS  ·  ESC — Menu', {
      fontSize: '15px',
      fontFamily: 'monospace',
      color: '#2a2a4a',
    }).setOrigin(0.5).setDepth(2);

    // ── Input ───────────────────────────────────────────────────────────────
    const go = () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('GameScene'));
    };
    this.input.keyboard!.once('keydown-SPACE', go);
    this.input.once('pointerdown', go);
  }

  private drawDivider(): void {
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(3, 0xffffff, 0.18);
    const dh = 20, gh = 14;
    for (let y = 0; y < GAME_HEIGHT; y += dh + gh) {
      g.lineBetween(GAME_WIDTH / 2, y, GAME_WIDTH / 2, y + dh);
    }
  }
}
