import Phaser from 'phaser';

/**
 * BootScene - loads assets before the game starts.
 * Add your asset loading here (images, spritesheets, audio, etc.).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Load assets here, e.g.:
    // this.load.image('player', 'assets/player.png');
    // this.load.spritesheet('enemy', 'assets/enemy.png', { frameWidth: 32, frameHeight: 32 });
    // this.load.audio('bgm', 'assets/bgm.mp3');
  }

  create(): void {
    this.scene.start('GameScene');
  }
}
