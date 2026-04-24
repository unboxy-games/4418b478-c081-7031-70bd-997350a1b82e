import { createUnboxyGame, Unboxy } from '@unboxy/phaser-sdk';
import { BootScene } from './scenes/BootScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

export const unboxyReady = Unboxy.init();

createUnboxyGame({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0d1b2a',
  scenes: [BootScene, LobbyScene, GameScene, UIScene],
});
