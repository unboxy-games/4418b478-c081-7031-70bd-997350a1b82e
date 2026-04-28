import Phaser from 'phaser';

/**
 * UIScene – HUD is handled directly in GameScene for this game.
 * Kept in the scene list to satisfy the main.ts config.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // All HUD elements live in GameScene
  }
}
