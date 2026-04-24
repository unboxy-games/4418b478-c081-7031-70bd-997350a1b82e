import Phaser from 'phaser';

/**
 * UIScene - HUD overlay (runs in parallel with GameScene).
 * Dot Board manages all its own chrome directly in GameScene,
 * so this scene intentionally stays empty.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // No additional HUD needed — GameScene owns the header/footer chrome.
  }
}
