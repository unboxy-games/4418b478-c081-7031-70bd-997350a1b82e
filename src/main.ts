import { createUnboxyGame, Unboxy } from '@unboxy/phaser-sdk';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

// Initialise platform services once at module load.
// Scenes receive this promise and await it when they need persistence.
export const unboxyReady = Unboxy.init({ standaloneGameId: 'bump-popper' }).catch(() => null);

createUnboxyGame({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scenes: [BootScene, GameScene, UIScene],
});
