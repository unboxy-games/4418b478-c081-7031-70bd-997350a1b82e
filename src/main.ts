import { createUnboxyGame, Unboxy } from '@unboxy/phaser-sdk';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

// Initialize once at module load — scenes await this promise
export const unboxyReady = Unboxy.init().catch(() => null);

createUnboxyGame({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scenes: [BootScene, GameScene, UIScene],
});
