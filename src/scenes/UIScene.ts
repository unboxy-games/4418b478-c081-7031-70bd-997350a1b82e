import Phaser from 'phaser';

/**
 * UIScene — kept minimal; all HUD for this game lives in GameScene.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // HUD is rendered directly in GameScene for this game.
  }
}
