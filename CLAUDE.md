# Geometry Dash Clone

## Game Overview
- **Title**: Geometry Dash Clone
- **Genre**: Auto-runner / rhythm platformer
- **Core mechanic**: Auto-scrolling cube that the player jumps over/onto obstacles. One button (SPACE / click / tap) to jump. Touch a spike or the side of a block = instant death. Land on top of a block = safe platform.

## Features Implemented
- **Main Menu** (MenuScene): SOLO PLAY + ONLINE CO-OP + LEADERBOARD buttons; animated bouncing preview cubes; star background
- **Level Select** (LevelSelectScene): 3 level cards with name, difficulty stars, personal best %, lock/unlock status; loads bests async then renders cards
- **Online Co-op**: Lobby waits for a second player, 3-2-1 GO! countdown, then both players race the same level simultaneously
- Auto-scrolling player cube (speed varies by level) with arcade physics gravity
- Double-jump mechanic (SPACE, UP arrow, or mouse/touch click) — 2 jumps per airborne cycle; refills on landing
- Spinning cube animation: rotates 216°/s in the air, snaps to nearest 90° on landing
- 47 handcrafted obstacles across 18 000px level: single spikes → double → triple → block obstacles → intense mixed sections (gaps widened ~+100px each)
- Spikes rendered at 0.65 scale (~39×39 px), base aligned to ground; hitbox = inner rect of scaled triangle (~10×26 px); blocks use 50×50
- Dust particle burst on landing, blue square particle explosion on death
- Camera shake + red flash on death
- Parallax background: 3 TileSprite layers (far/mid/near) with different scroll speeds
- Star field (fixed to camera) + dark navy sky gradient
- Glowing tiled ground
- HUD: top progress bar with % readout, "Attempt N" counter
- Controls hint text (fades after 3 s)
- Win screen with bounce-in tween and "Completed in N attempts!"
- Attempt count persists across restarts via `game.registry`

## High Score & Leaderboard
- **Personal best** saved per level: `highScore` (L1), `highScore_2` (L2), `highScore_3` (L3)
  - Loaded at the start of each GameScene `create()` via `loadPersonalBest()`
  - `currentRunMaxPct` tracks the highest % reached each run (updated in `update()`)
  - Saved on **death** if `currentRunMaxPct > personalBest` (so players see progress even without completing)
  - Also saved on **win** (100%) if first completion
  - Shown on the death/restart screen: "🏆 New Best: X%!" with gold sparkle burst, or "Best: X%" in blue
  - Shown on the win screen: "🏆 First Clear! New Best: 100%!" or "Level already cleared"
- **Global leaderboard** stored in `unboxy.gameData` (key: `leaderboard`)
  - Submitted on death (if new best %) or win (100%) for authenticated users
  - Sorted descending by % (higher = better), deduplicates by `userId`, capped at top 100
  - Shown in MenuScene leaderboard panel (top 10 displayed)
- **Leaderboard panel** (MenuScene):
  - Animated gold-framed panel with "🏆 LEADERBOARD" header
  - Loading state while data fetches (async)
  - 🥇🥈🥉 medals for top 3; player's own row highlighted in gold with ▶ prefix
  - "Best %" column header; score displayed as "X%"
  - Shows personal best below if not in top 10
  - Closed with "✕ Close" button; safe cleanup on scene shutdown

## Multiplayer Architecture
- **MenuScene** handles the full lobby: joinOrCreate('lobby'), waits for `room.state.players.size >= 2`, sets `room.data.set('gameState', 'countdown')`, runs a 3-2-1 countdown, then transitions to GameScene
- **gameState.ts** module-level `activeRoom` reference — avoids passing the live Room object through Phaser registry
- **GameScene** checks `game.registry.get('multiplayer')` on create; calls `initMultiplayer()` if true
- Local player publishes `{x, y, angle, alive, won}` at ~20 Hz via `room.player.set('pos', ...)`
- Remote cube (orange, `cube2` texture) lerps toward target position at lerp factor 0.2 per frame
- Remote cube has an idle bob tween while waiting for the first network packet
- Floating name labels (world space) hover above each cube and update each frame
- Remote death triggers orange particle burst + "Opponent died!" toast notification
- Opponent disconnect shows a "disconnected" notification; remote cube hides
- MP death screen shows "YOU DIED" + "Back to Menu" (no restart in MP mode)
- Win in MP mode shows "You finished! 🏆" then auto-returns to MenuScene after 4 s
- `returnToMenu()` calls `activeRoom.leave()`, clears the room reference, and resets the registry flag

## Key Implementation Details
- **BootScene.ts** → starts MenuScene (was GameScene)
- **MenuScene.ts** — mode selection + online lobby + leaderboard panel
- **gameState.ts** — `activeRoom`, `setActiveRoom`, `clearActiveRoom`
- **main.ts** — exports `unboxyReady = Unboxy.init(...)` for auth + rooms API
- **GameScene.ts** — all game logic (background, ground, level, player, particles, HUD, camera, input, multiplayer, high score)
- **UIScene.ts** — intentionally empty; GameScene handles all HUD via `setScrollFactor(0)`
- **Ground physics**: `add.rectangle` (13 000 × 150 px) + `physics.add.existing(rect, true)` for a reliable static body
- **Obstacle groups**: two static groups — `obstacles` (spikes, lethal overlap) and `platforms` (blocks, collider — land on top safely, lethal on side impact)
- **Textures**: all generated programmatically via `this.make.graphics({}, false)` + `generateTexture`; `cube2` (orange) created in MenuScene first (so GameScene guard skips it)
- **Parallax**: TileSprites with `setScrollFactor(0)`; `tilePositionX` driven by `camera.scrollX * factor` each frame
- **Death persistence**: `this.game.registry.set('attempt', n)` before `scene.restart()` (solo only)
- **room.state cast**: `room.state as { players: Map<string, { displayName?: string }> }` to work around `UnboxyRoom<unknown>` default
- **personalBest**: loaded async in `loadPersonalBest()` on `create()`; 0 = no best yet; lower = better

## Controls
- **SPACE** / **UP arrow** / **click** / **tap** — jump (only when grounded)
- **ESC** — toggle pause (solo only)

## rexUI Plugin
- `phaser3-rex-plugins` added as a dependency
- `UIPlugin` registered as a scene plugin (`mapping: 'rexUI'`) in main.ts
- `rexUI!: any` declared on GameScene

## NPC Bots (4-Player Mode)
- Always 4 "players" in every race: the human + 3 NPC bots (solo) or human + remote human + 2 NPC bots (online)
- **Bot personalities**:
  - **Dash** (teal, cube3): aggressive — jumps 70 px before obstacles, 4% mistake rate
  - **Blaze** (purple, cube4): balanced — jumps 100 px before, 7% mistake rate
  - **Nova** (hot pink, cube5): cautious — jumps 130 px before, 10% mistake rate
- Jump schedule pre-computed from LEVEL data: each obstacle gets a `jumpAtX` entry with ±20 px random variance; mistake rate % of jumps are simply omitted (bot dies on that obstacle)
- NPCs share same physics (gravity, double-jump refill, ground/platform/spike colliders)
- Spinning rotation + snap-to-90° on landing, same as player
- Name label floats above each cube in world space, updates each frame in `updateNpcs()`
- On death: coloured particle burst matching bot palette, camera mini-shake, "X died! 💀" toast, label turns red
- On win: "🏆 Name" label, "Name finished! 🏆" toast
- `isMultiplayer` is now read from registry BEFORE `buildNpcs()` so bot count is correct
- `NpcBot` interface + `NPC_CONFIGS` array defined at module level above the class

## Levels
- **Level 1 — The Gateway**: 47 obstacles, 18 000 px, 450 px/s (original)
- **Level 2 — Storm Front**: 46 obstacles, 18 000 px, 550 px/s; tighter gaps, more triples
- **Level 3 — The Void**: 48 obstacles, 16 000 px, 650 px/s; relentless all-triple patterns
- Unlock: L2 requires L1 ≥ 25%; L3 requires L2 ≥ 50%

## Key Implementation Details (level select)
- **LevelSelectScene.ts** — new scene; loads personal bests async, then renders 3 interactive cards
- **MenuScene** SOLO PLAY → LevelSelectScene (not GameScene directly)
- **GameScene** reads `levelIndex` from registry on `create()`; sets `this.speed`, `this.worldW`, `this.levelData`, `this.saveKey` accordingly
- Global leaderboard submitted only for Level 1 (`levelIdx === 0`); Levels 2/3 save personal best only
- Death dialog "Main Menu" → LevelSelectScene; restart preserves `levelIndex` in registry
- Win screen shows "Level Select" + "Next Level" buttons instead of auto-restarting
- `returnToMenu()` → LevelSelectScene for solo, MenuScene for multiplayer

## What Changed This Turn
- Added level select screen with 3 levels (The Gateway, Storm Front, The Void); each with distinct speed/patterns/unlock requirement
