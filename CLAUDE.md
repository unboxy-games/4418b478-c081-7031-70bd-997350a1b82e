# Blokus — Online Multiplayer Board Game

## Game
- **Title**: Blokus
- **Genre**: Strategy board game
- **Core mechanic**: Players take turns placing polyomino pieces on a 20×20 grid. Each piece must touch a corner (not an edge) of the player's own previously-placed pieces. Goal: place as many pieces as possible.

## Features Implemented
- LobbyScene with Create Room, Join Room (by code), Quick Match, and Play Offline flows
- Online multiplayer via `unboxy.rooms` (Colyseus-backed)
  - Private rooms use a random 6-char room code shared between players
  - Quick match uses the default public room (no roomCode)
  - `maxClients: 4` enforced on room creation
- Offline / guest mode fallback
- GameScene with full Blokus rules (corner-touch placement, first-move-on-corner constraint)
- Player list in lobby, host can start when 2+ players present
- Room state used to broadcast game start and sync board/turn data
- Piece rendering with Phaser Graphics API
- Polished lobby background, animated title, color-coded player slots

## Key Implementation Details
- `src/scenes/LobbyScene.ts` — lobby UI and room join/create logic
- `src/scenes/GameScene.ts` — main game scene
- `src/gameState.ts` — `setActiveRoom` / `getActiveRoom` for passing room reference between scenes
- `src/data/pieces.ts` — `PLAYER_COLORS`, `PLAYER_NAMES`, piece shape definitions
- Room type is always `'lobby'` (the only type registered on the realtime server)
- Private rooms: `joinOrCreate('lobby', { roomCode: code, maxClients: 4, ... })`
- Public quick match: `joinOrCreate('lobby', { maxClients: 4, ... })` (no roomCode)

## Changes This Turn
- Fixed lobby staying on room-code screen by moving `showLobbyWaiting()` outside the try-catch in all three flow methods (createRoom, joinRoom, quickMatch) — previously any error thrown inside showLobbyWaiting() was caught and triggered the "go back to menu" path
- Fixed display name lookup in refreshPlayerList to use `_p.displayName` from room state instead of `room.player.get(sid, 'displayName')` (the KV store had nothing written there, likely causing the throw)
- Added `room.onError` handler in showLobbyWaiting so connection drops show a message and navigate back gracefully
