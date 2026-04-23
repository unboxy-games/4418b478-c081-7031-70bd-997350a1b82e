import { createUnboxyGame, Unboxy } from "@unboxy/phaser-sdk";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene } from "./scenes/UIScene";
import { GAME_WIDTH, GAME_HEIGHT } from "./config";
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';

// Initialise platform services once at module load.
// Resolves to an Unboxy instance, or null if running outside the platform.
export const unboxyReady = Unboxy.init({ standaloneGameId: 'geometry-dash-clone' })
  .catch(() => null);

createUnboxyGame({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scenes: [BootScene, MenuScene, GameScene, UIScene],
  plugins: {
    scene: [
      { key: 'rexUI', plugin: UIPlugin, mapping: 'rexUI' },
    ],
  },
});
