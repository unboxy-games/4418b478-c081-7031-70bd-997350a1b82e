import { createUnboxyGame } from "@unboxy/phaser-sdk";
import "./unboxy"; // initialize platform services at module load
import { BootScene } from "./scenes/BootScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene } from "./scenes/UIScene";
import { GAME_WIDTH, GAME_HEIGHT } from "./config";

createUnboxyGame({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scenes: [BootScene, LobbyScene, GameScene, UIScene],
});
