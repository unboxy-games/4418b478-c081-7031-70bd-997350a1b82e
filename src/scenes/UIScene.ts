import Phaser from 'phaser';

/**
 * UIScene - HUD overlay. Pong manages its own score display inside GameScene.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // Pong handles all HUD in GameScene directly.
  }
}
