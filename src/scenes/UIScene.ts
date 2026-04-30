import Phaser from 'phaser';

/**
 * UIScene — transparent overlay running in parallel with GameScene.
 * HUD elements live in GameScene directly; this scene is reserved for
 * future modal or cross-scene UI needs.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // intentionally empty — GameScene owns all HUD rendering
  }
}
