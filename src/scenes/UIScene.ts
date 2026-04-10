import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

export class UIScene extends Phaser.Scene {
  private livesText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // Top-left HUD pill — lives
    const pillL = this.add.graphics().setDepth(10);
    pillL.fillStyle(0x000000, 0.55);
    pillL.fillRoundedRect(6, 6, 120, 28, 8);

    this.add
      .text(14, 11, '❤', { fontSize: '16px', color: '#ff4444' })
      .setDepth(11);

    this.livesText = this.add
      .text(36, 12, '20', {
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setDepth(11);

    this.add
      .text(68, 12, '|', { fontSize: '15px', color: '#555555' })
      .setDepth(11);

    this.add
      .text(78, 11, '💰', { fontSize: '14px', color: '#ffd700' })
      .setDepth(11);

    this.goldText = this.add
      .text(100, 12, '150', {
        fontSize: '15px',
        color: '#ffd700',
        fontStyle: 'bold',
      })
      .setDepth(11);

    // Top-right HUD pill — wave + score
    const pillR = this.add.graphics().setDepth(10);
    pillR.fillStyle(0x000000, 0.55);
    pillR.fillRoundedRect(GAME_WIDTH - 190, 6, 184, 28, 8);

    this.waveText = this.add
      .text(GAME_WIDTH - 184, 12, 'Wave 0', {
        fontSize: '15px',
        color: '#aaccff',
        fontStyle: 'bold',
      })
      .setDepth(11);

    this.add
      .text(GAME_WIDTH - 110, 12, '|', { fontSize: '15px', color: '#555555' })
      .setDepth(11);

    this.add
      .text(GAME_WIDTH - 100, 11, '⭐', { fontSize: '14px' }).setDepth(11);

    this.scoreText = this.add
      .text(GAME_WIDTH - 80, 12, '0', {
        fontSize: '15px',
        color: '#ffe066',
        fontStyle: 'bold',
      })
      .setDepth(11);

    // Listen to GameScene events
    const gameScene = this.scene.get('GameScene');

    gameScene.events.on('stats', (data: { lives: number; gold: number; wave: number; score: number }) => {
      this.livesText.setText(String(data.lives));
      this.goldText.setText(String(data.gold));
      this.waveText.setText(`Wave ${data.wave}`);
      this.scoreText.setText(String(data.score));

      // Red pulse on low lives
      if (data.lives <= 5) {
        this.tweens.add({
          targets: this.livesText,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 120,
          yoyo: true,
        });
      }
    });

    gameScene.events.on('not-enough-gold', () => {
      this.tweens.add({
        targets: this.goldText,
        scaleX: 1.4,
        scaleY: 1.4,
        duration: 90,
        yoyo: true,
        repeat: 1,
      });
      const prev = this.goldText.style.color;
      this.goldText.setStyle({ color: '#ff4444' });
      this.time.delayedCall(300, () => {
        this.goldText.setStyle({ color: '#ffd700' });
        void prev;
      });
    });
  }
}
