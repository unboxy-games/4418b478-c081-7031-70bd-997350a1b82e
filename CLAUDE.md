# Blokus — Online Multiplayer Board Game

## Game
- **Title**: Blokus
- **Genre**: Strategy board game
- **Core mechanic**: Players take turns placing polyomino pieces on a 20×20 grid. Each piece must touch a corner (not an edge) of the player's own previously-placed pieces. Goal: place as many pieces as possible.

## Features Implemented
- LobbyScene with Create Room, Join With Code, Browse Rooms, Quick Match, and Play Offline flows
- Online multiplayer via `unboxy.rooms` (Colyseus-backed)
  - Private rooms use a random 6-char room code shared between players
  - Quick match uses the default public room (no roomCode)
  - `maxClients: 4` enforced on room creation
  - Rooms advertise `metadata.hostName` so the browser can display the creator's name
- **Room browser**: `showRoomBrowser()` calls `unboxy.rooms.list()`, polls every 3 s, renders up to 5 open rooms (code, host name, player-count dots), lets players click JOIN to call `joinById()`
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
- Private rooms: `joinOrCreate('lobby', { roomCode: code, maxClients: 4, metadata: { hostName } })`
- Public quick match: `joinOrCreate('lobby', { maxClients: 4, metadata: { hostName } })`
- Room browser: `rooms.list()` polled on a `Phaser.Time.TimerEvent`; poll stopped in `clearMain()` / on Back / on scene shutdown
- `joinRoomById()` uses `rooms.joinById(roomId, ...)` and drives first render from `onStateChange` (same state-timing guard as joinOrCreate)

## Changes This Turn
- Added bot difficulty selector (Easy / Medium / Hard):
  - Clicking "PLAY OFFLINE" now opens a difficulty picker screen with three styled cards
  - **Easy**: bot picks randomly from up to 50 valid moves (great for learning)
  - **Medium**: existing heuristic — piece size × 20, anchor corners × 8, expansion × 1.5, noise [0,4)
  - **Hard**: amplified weights — piece size × 35, anchors × 15, expansion × 3, near-zero noise (plays very consistently)
  - Selection persists to `unboxy.saves` under key `settings.botDifficulty`; restored on next session
  - Offline game HUD shows a pulsing "BOT: EASY / MEDIUM / HARD" badge in the panel
  - `botDifficulty` / `setBotDifficulty` / `BotDifficulty` type added to `gameState.ts`
  - `smartFindMove` accepts a `difficulty` parameter and branches accordingly

## Previous Changes
- Added NPC bots to always fill a full 4-player game:
  - Offline: player 0 = human, players 1–3 = bots (changed from 2-player to 4-player)
  - Online: host always starts a 4-player game; any slots beyond real connected players are NPC bots; host runs AI for NPC turns and broadcasts moves via `room.data`; non-host clients just render the synced state
  - `isHost` and `humanPlayerCount` added to `gameState.ts` and passed through `setActiveRoom`
  - `isNPCPlayer(idx)` helper: offline = idx ≥ humanPlayerCount; online = no session ID for that slot
  - `aiMoveScheduled` flag prevents stacked timers
  - Lobby: NPC bot slots shown as dimmed placeholder rows; host can start with ≥1 real player
  - HUD shows 🤖 emoji and amber colour for bot turns

## Previous Changes
- Overhauled touch/iPad board interaction:
  - `navigator.maxTouchPoints > 0` detected once at startup — no flaky per-event type checks
  - **Touch flow**: drag finger across board to move preview in real-time (pointermove fires during touch drag). Tap to set a position, or drag to reposition. Preview stays sticky after finger lifts. Piece is placed only via the **✓ PLACE PIECE** button. User can freely rotate/flip and retap/redrag to reposition before confirming.
  - **Mouse flow**: hover moves preview, click places immediately (unchanged from original).
  - `pointerout` clears preview on mouse only; on touch devices the preview is never cleared by pointer leaving the zone.
  - `this.input.addPointer(2)` enables up to 3 concurrent touch pointers.
  - Control buttons (ROTATE, FLIP, PASS) height 48px; PLACE PIECE button 198×48px, green=valid / grey=invalid.
