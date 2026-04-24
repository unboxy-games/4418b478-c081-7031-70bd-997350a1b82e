// Shared state passed between LobbyScene and GameScene
export let activeRoom: any = null;
export let myPlayerIndex: number = 0;
export let playerOrder: string[] = [];
export let isOfflineMode: boolean = false;

export function setActiveRoom(
  room: any,
  idx: number,
  order: string[],
  offline: boolean = false
): void {
  activeRoom = room;
  myPlayerIndex = idx;
  playerOrder = order;
  isOfflineMode = offline;
}
