import Phaser from 'phaser';

/**
 * UIScene — HUD overlay. Game manages its own HUD for this title.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // Click Wars manages all HUD elements directly in GameScene
  }
}
