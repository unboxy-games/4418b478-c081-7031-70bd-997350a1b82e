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
- Fixed joiner crash (`TypeError: Cannot read properties of undefined (reading 'forEach')`) — root cause was reading `room.state.players` synchronously right after `await joinOrCreate`; state arrives as a separate message a few ms later so `.players` is `undefined` on the joining client until `onStateChange` fires
- Removed all synchronous `refreshPlayerList()` / `updateStartButton()` calls from `showLobbyWaiting()`; both are now driven exclusively by `onStateChange`
- Added `if (!this.room?.state?.players) return` guards to `refreshPlayerList`, `updateStartButton`, and `startGame`
- Added `if (!this.room?.data) return` + `if (!order) return` guards to `launchGame`
- Fixed quick-match `isHost` detection: removed synchronous `this.room.state.players.size === 1` read; `isHost` now defaults to `false` and is resolved in the first `onStateChange` (checks if our sessionId is the first entry in the players map)
- Replaced the isHost if/else render branch in `showLobbyWaiting` with always-creating both start button (hidden) and waiting text; `updateStartButton` toggles both based on isHost + player count
- Guarded `this.room.data.get('gamePhase')` in `onStateChange` with optional chaining
