import Phaser from 'phaser';

/**
 * UIScene - HUD overlay scene.
 * All HUD elements (progress bar, attempt counter) are managed
 * directly inside GameScene using setScrollFactor(0), so this
 * scene is intentionally left minimal.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // HUD is rendered inside GameScene — nothing needed here.
  }
}
