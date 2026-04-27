// Shared state passed between LobbyScene and GameScene
export let activeRoom: any = null;
export let myPlayerIndex: number = 0;
export let playerOrder: string[] = [];
export let isOfflineMode: boolean = false;
export let isHost: boolean = false;
/** Number of real human players; slots beyond this index are NPCs. */
export let humanPlayerCount: number = 1;

/** How challenging the NPC bots play. */
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export let botDifficulty: BotDifficulty = 'medium';
export function setBotDifficulty(d: BotDifficulty): void { botDifficulty = d; }

export function setActiveRoom(
  room: any,
  idx: number,
  order: string[],
  offline: boolean = false,
  host: boolean = false,
  humanCount: number = 1
): void {
  activeRoom = room;
  myPlayerIndex = idx;
  playerOrder = order;
  isOfflineMode = offline;
  isHost = host;
  humanPlayerCount = humanCount;
}
