import { createUnboxyGame, Unboxy } from '@unboxy/phaser-sdk';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

// Initialise platform services once at module load.
// Resolves to an Unboxy instance or null (standalone / init failure).
export const unboxyReady = Unboxy.init({ standaloneGameId: 'reaction-game' }).catch(() => null);

createUnboxyGame({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scenes: [BootScene, GameScene, UIScene],
  plugins: {
    scene: [
      { key: 'rexUI', plugin: UIPlugin, mapping: 'rexUI' },
    ],
  },
});
