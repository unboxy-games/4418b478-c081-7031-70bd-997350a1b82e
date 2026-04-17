import { createUnboxyGame } from '@unboxy/phaser-sdk';
import { BootScene } from './scenes/BootScene';
import { StartScene } from './scenes/StartScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

createUnboxyGame({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scenes: [BootScene, StartScene, GameScene, UIScene],
});
