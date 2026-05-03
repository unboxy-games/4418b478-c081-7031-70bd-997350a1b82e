import { createUnboxyGame } from '@unboxy/phaser-sdk';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';

createUnboxyGame({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scenes: [BootScene, TitleScene, GameScene, UIScene],
  plugins: {
    scene: [
      { key: 'rexUI', plugin: UIPlugin, mapping: 'rexUI' },
    ],
  },
});
