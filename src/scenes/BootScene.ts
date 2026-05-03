import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

/**
 * BootScene - loads assets before the game starts.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Loading bar UI
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const barW = Math.min(480, GAME_WIDTH * 0.6);
    const barH = 24;

    const label = this.add.text(cx, cy - 40, 'Loading...', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const track = this.add.rectangle(cx, cy, barW, barH, 0x222222).setStrokeStyle(2, 0xffffff);
    const fill = this.add.rectangle(cx - barW / 2 + 2, cy, 0, barH - 4, 0xffffff).setOrigin(0, 0.5);
    const pctText = this.add.text(cx, cy + 30, '0%', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#cccccc',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      fill.width = (barW - 4) * value;
      pctText.setText(`${Math.round(value * 100)}%`);
    });
    this.load.on('complete', () => {
      label.destroy();
      track.destroy();
      fill.destroy();
      pctText.destroy();
    });

    // Asset manifest
    this.load.image('tile_0002', 'uploaded/tile_0002.png');
    this.load.audio('bounceSfx', 'uploaded/impactmetal_light_004.ogg');
  }

  create(): void {
    this.scene.start('TitleScene');
  }
}
