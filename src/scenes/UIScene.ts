import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

/**
 * UIScene — HUD overlay showing score, wave, and lives.
 * Runs in parallel over GameScene.
 */
export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!:  Phaser.GameObjects.Text;
  private lifeIcons:  Phaser.GameObjects.Graphics[] = [];

  private score = 0;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.score     = 0;
    this.lifeIcons = [];

    // ── Score (top-left) ───────────────────
    this.scoreText = this.add.text(18, 14, 'SCORE  0', {
      fontSize:        '20px',
      color:           '#ffffff',
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setDepth(10);

    // ── Wave (top-center) ──────────────────
    this.waveText = this.add.text(GAME_WIDTH / 2, 14, 'WAVE  1', {
      fontSize:        '20px',
      color:           '#aaddff',
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(10);

    // ── Lives label (top-right) ────────────
    this.add.text(GAME_WIDTH - 18, 14, 'LIVES', {
      fontSize:        '20px',
      color:           '#ffffff',
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(10);

    // Initial life icons
    this.drawLifeIcons(3);

    // ── Event listeners from GameScene ─────
    const gs = this.scene.get('GameScene');

    gs.events.on('score', (pts: number) => {
      this.score += pts;
      this.scoreText.setText(`SCORE  ${this.score}`);
      this.tweens.add({
        targets:  this.scoreText,
        scaleX:   1.3,
        scaleY:   1.3,
        duration: 90,
        yoyo:     true,
        ease:     'Power2',
      });
    }, this);

    gs.events.on('updateLives', (lives: number) => {
      this.drawLifeIcons(lives);
    }, this);

    gs.events.on('updateLevel', (level: number) => {
      this.waveText.setText(`WAVE  ${level}`);
      this.tweens.add({
        targets:  this.waveText,
        scaleX:   1.4,
        scaleY:   1.4,
        duration: 160,
        yoyo:     true,
        ease:     'Back.easeOut',
      });
    }, this);
  }

  // ── Mini ship icon per remaining life ────
  private drawLifeIcons(lives: number): void {
    for (const icon of this.lifeIcons) icon.destroy();
    this.lifeIcons = [];

    for (let i = 0; i < Math.max(0, lives); i++) {
      const x = GAME_WIDTH - 22 - i * 30;
      const y = 46;
      const g = this.add.graphics().setDepth(10);

      g.fillStyle(0x1a44cc);
      g.fillTriangle(x, y - 9, x - 8, y + 6, x + 8, y + 6);
      g.fillStyle(0x0d2f99);
      g.fillTriangle(x, y - 2, x - 8, y + 7, x - 2, y + 2);
      g.fillTriangle(x, y - 2, x + 8, y + 7, x + 2, y + 2);
      g.fillStyle(0x99ddff);
      g.fillCircle(x, y - 1, 3.5);
      g.fillStyle(0xffff00);
      g.fillRect(x - 4, y + 5, 8, 4);

      this.lifeIcons.push(g);
    }
  }
}
