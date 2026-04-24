import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {}

  create(): void {
    this.scene.start('LobbyScene');
  }
}
