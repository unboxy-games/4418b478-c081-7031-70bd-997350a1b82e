import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  render: {
    preserveDrawingBuffer: true,
  },
  pixelArt: false,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, GameScene, UIScene],
};

const game = new Phaser.Game(config);

// Listen for screenshot requests from parent window
window.addEventListener('message', (event) => {
  if (event.data?.type === 'screenshot') {
    try {
      const dataUrl = game.canvas.toDataURL('image/png');
      window.parent.postMessage({ type: 'screenshot_result', dataUrl }, '*');
    } catch (e) {
      console.error('Screenshot failed:', e);
    }
  }
});
