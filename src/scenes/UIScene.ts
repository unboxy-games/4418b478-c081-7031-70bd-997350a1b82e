import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

/**
 * UIScene — HUD overlay showing score, wave, and lives.
 * Runs in parallel over GameScene.
 */
export class UIScene extends Phaser.Scene {
  private scoreText!:   Phaser.GameObjects.Text;
  private hiScoreText!: Phaser.GameObjects.Text;
  private waveText!:    Phaser.GameObjects.Text;
  private lifeIcons:    Phaser.GameObjects.Graphics[] = [];

  private score = 0;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.score     = 0;
    this.lifeIcons = [];

    // ── Score (top-left) ───────────────────
    this.add.text(18, 10, 'SCORE', {
      fontSize:        '13px',
      color:           '#aaaaaa',
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 2,
    }).setDepth(10);

    this.scoreText = this.add.text(18, 26, '0', {
      fontSize:        '24px',
      color:           '#ffffff',
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setDepth(10);

    // ── Hi-Score (top-center, prominent) ──
    this.add.text(GAME_WIDTH / 2, 10, 'HI-SCORE', {
      fontSize:        '13px',
      color:           '#ffcc55',
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(10);

    this.hiScoreText = this.add.text(GAME_WIDTH / 2, 26, '0', {
      fontSize:        '24px',
      color:           '#ffdd88',
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(10);

    // ── Wave (below hi-score, center) ──────
    this.waveText = this.add.text(GAME_WIDTH / 2, 56, 'WAVE  1', {
      fontSize:        '15px',
      color:           '#88ccff',
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(10);

    // ── Lives label (top-right) ────────────
    this.add.text(GAME_WIDTH - 18, 10, 'LIVES', {
      fontSize:        '13px',
      color:           '#aaaaaa',
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(10);

    // Initial life icons
    this.drawLifeIcons(4);

    // ── Event listeners from GameScene ─────
    const gs = this.scene.get('GameScene');

    gs.events.on('score', (pts: number) => {
      this.score += pts;
      this.scoreText.setText(`${this.score}`);
      this.tweens.add({
        targets:  this.scoreText,
        scaleX:   1.3,
        scaleY:   1.3,
        duration: 90,
        yoyo:     true,
        ease:     'Power2',
      });
    }, this);

    gs.events.on('highScore', (best: number) => {
      this.hiScoreText.setText(`${best}`);
      this.tweens.add({
        targets:  this.hiScoreText,
        scaleX:   1.35,
        scaleY:   1.35,
        duration: 120,
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
      const y = 38;
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
