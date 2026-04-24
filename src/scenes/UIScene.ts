import Phaser from 'phaser';

/**
 * UIScene - minimal overlay (game UI is rendered inside GameScene).
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // Game HUD is rendered inside GameScene directly.
  }
}
