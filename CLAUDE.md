# Click Wars

## Game overview
- **Genre:** Online multiplayer clicker / race game
- **Core mechanic:** Every player has a big "CLICK!" button. Clicking it increments your count by 1 and syncs it in real time to all other players in the room. A leaderboard panel shows all connected players ranked by click count.

## Features implemented
- Online multiplayer via `unboxy.rooms.joinOrCreate('lobby')` with real-time state sync
- `room.player.set('clicks', n)` used for per-player click count (not `room.send` — state so late joiners see current counts)
- `room.onStateChange` drives the player leaderboard, which auto-sorts by clicks descending
- Smooth count-update animations: scale pop + alpha flash on each other player's count change
- Smooth row re-sort animation (220 ms tween) when rankings change
- Sign-in gate: shows a friendly sign-in required screen for anonymous users
- `REALTIME_UNAVAILABLE` fallback: shows the click button in offline/preview mode
- Particle burst (14 mixed shapes) + button squish + count bounce on each local click
- Idle pulse tween on the CLICK! button
- Neon arcade visual theme: dark navy/gradient background, subtle grid, cyan (#00ffcc) accent, teal button

## Key implementation details
- `Unboxy.init()` is called at module load in `main.ts` and exported as `unboxyReady`
- `GameScene.create()` is sync; async room setup is in `initRoom()` (called from create, errors caught)
- Player list: `this.playerListContainer` is a nested `Phaser.GameObjects.Container` at `(PANEL_X+16, PANEL_Y+96)`; each row is a sub-container with Graphics + Text children
- `unsubs[]` array collects all `onStateChange` unsubscribe functions; called on scene `shutdown`
- `room.leave()` called on scene shutdown
- UIScene is intentionally empty (GameScene manages all HUD)

## Controls
- Mouse click on the CLICK! button

## What changed this turn
- Built the entire game from scratch: main.ts Unboxy.init export, full GameScene with multiplayer rooms, polished visuals, UIScene simplified
