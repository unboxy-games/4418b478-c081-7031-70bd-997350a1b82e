import { createUnboxyGame, Unboxy } from '@unboxy/phaser-sdk';
import VirtualJoystickPlugin from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin.js';
import { BootScene } from './scenes/BootScene';
import { StartScene } from './scenes/StartScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

// Initialize platform services once at module load.
// Resolves to an Unboxy instance, or null on failure — scenes must work either way.
export const unboxyReady = Unboxy.init({ standaloneGameId: 'galaxian-clone' })
  .catch(() => null);

createUnboxyGame({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scenes: [BootScene, StartScene, LobbyScene, GameScene, UIScene, LeaderboardScene],
  plugins: {
    global: [
      { key: 'rexVirtualJoystick', plugin: VirtualJoystickPlugin, start: true },
    ],
  },
});
