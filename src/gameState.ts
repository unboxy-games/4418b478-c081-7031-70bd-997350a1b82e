import type { UnboxyRoom } from '@unboxy/phaser-sdk';

/**
 * Module-level room reference — lets MenuScene hand the live room object
 * to GameScene without going through Phaser registry (which serialises data).
 */
export let activeRoom: UnboxyRoom | null = null;

export function setActiveRoom(r: UnboxyRoom): void { activeRoom = r; }
export function clearActiveRoom(): void            { activeRoom = null; }
