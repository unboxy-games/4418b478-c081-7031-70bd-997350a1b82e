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

## Changes This Turn — Pixel-Art Visual Restyle
- **LobbyScene**: dark navy (#1a2744) background with pixel grid overlay; corner accent blocks; BLOKUS title now rendered on a scroll-banner graphic (cream fill, orange border); subtitle added
- **Menu buttons**: replaced rounded glass style with pixel-art raised buttons (cream #ede8cf body, orange #c07830 border, brown shadow, top-left highlight, "press down" animation on click)
- **Lobby waiting / room browser panels**: replaced with pixel blue panels (#2e4a8a body, #3d5fa0 face, #6080c8 border, highlight lines); section labels use cream pixel scroll badges; player list rows use cream boxes with color swatches
- **Difficulty picker cards**: cream body when selected/hovered, dark blue otherwise; color stripe on left edge; orange border
- **GameScene**: background is deep navy + pixel grid; right panel is pixel blue panel; board cells use darker navy palette with square corner markers; HUD turn text in a pixel dark box; "YOUR PIECES" label is a cream pixel scroll badge; thumbnails start Y adjusted to clear the label
- **Control buttons (ROTATE/FLIP/PASS/PLACE)**: pixel-art cream buttons matching lobby style
- **Game-over overlay**: pixel blue panel with cream scroll title banner, winner name in player color

## Previous Changes (chat iPad fix)
- Fixed chat input not showing keyboard on iPad/Android touch devices:
  - Added `touchstart` listener on the `<input>` element with `e.stopPropagation()` and synchronous `inputEl.focus()` — this prevents Phaser from calling `preventDefault()` on the event (which blocks browser tap-to-focus) and ensures the soft keyboard opens on iOS Safari / Android Chrome
  - Added `touchAction: 'manipulation'` to the input style to prevent double-tap zoom delay on iOS
  - Added a Phaser Zone over the input area (depth 11) that calls `inputEl.focus()` on `pointerdown` as a secondary fallback for edge cases

## Previous Chat Implementation
- Added in-game chat for online multiplayer:
  - Chat panel rendered below the piece thumbnails in the right-side panel (y≈358 to y≈710)
  - Uses `room.chat.send` / `room.chat.onMessage` (SDK chat helper, not raw `room.send`)
  - Message log: pool of 14 Phaser Text objects, newest message at bottom, muted blue for user messages, darker grey for system messages
  - System join/leave messages automatically displayed (from `msg.kind === 'system.joined'/'system.left'`)
  - **Input is a real HTML `<input>` element** overlaid on the canvas (`position:fixed`, `getBoundingClientRect()` for precise placement) — supports CJK IMEs, iOS/Android soft keyboard
  - Input is transparent (no background/border) and floats over the Phaser-drawn input box graphic
  - `autocorrect/autocapitalize="off"`, `inputmode="text"`, `enterkeyhint="send"` for correct mobile/iPad behaviour
  - `maxLength = MAX_CHAT_TEXT_LEN` (500) mirrors the SDK cap
  - `focus`/`blur` events on the HTML input drive the Phaser background visual state (blue border when active)
  - Enter key (or SEND button) sends; ESC blurs the input; R/F shortcuts blocked via `chatFocused` guard
  - Resize handler (`window.addEventListener('resize', ...)`) keeps input position locked to the canvas on window resize
  - HTML element removed and resize handler unregistered on scene shutdown
  - Chat panel only rendered in online mode (`if (this.room) buildChatPanel()`)

## Previous Changes (bot difficulty)
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
