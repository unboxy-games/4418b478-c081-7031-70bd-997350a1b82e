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
    this.load.atlasXML(
      'uipack_rpg_sheet',
      'uploaded/uipack_rpg_sheet.png',
      'uploaded/uipack_rpg_sheet.xml',
    );
  }

  create(): void {
    this.scene.start('StartScene');
  }
}
