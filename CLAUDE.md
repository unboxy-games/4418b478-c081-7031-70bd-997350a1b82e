# Geometry Dash Clone

## Game Overview
- **Title**: Geometry Dash Clone
- **Genre**: Auto-runner / rhythm platformer
- **Core mechanic**: Auto-scrolling cube that the player jumps over/onto obstacles. One button (SPACE / click / tap) to jump. Touch a spike or the side of a block = instant death. Land on top of a block = safe platform.

## Features Implemented
- **Main Menu** (MenuScene): SOLO PLAY + ONLINE CO-OP + LEADERBOARD buttons; animated bouncing preview cubes; star background
- **Online Co-op**: Lobby waits for a second player, 3-2-1 GO! countdown, then both players race the same level simultaneously
- Auto-scrolling player cube (speed = 450 px/s) with arcade physics gravity
- Double-jump mechanic (SPACE, UP arrow, or mouse/touch click) — 2 jumps per airborne cycle; refills on landing
- Spinning cube animation: rotates 216°/s in the air, snaps to nearest 90° on landing
- 47 handcrafted obstacles across 13 000px level: single spikes → double → triple → block obstacles → intense mixed sections
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
- **Personal best** saved to `unboxy.saves` (key: `highScore`; highest % reached = better, 0–100)
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

## What Changed This Turn
- Changed high score metric from "fewest attempts" to **"highest % reached"** (0–100), tracked per run via `currentRunMaxPct`
- Score now saved on **death** (if new best %) not just on win — every player gets a score regardless of completion
- Death/restart screen now shows "Reached X%" for current run + "🏆 New Best: X%!" or "Best: X%"
- Win screen shows "🏆 First Clear! New Best: 100%!" or "Level already cleared"
- Global leaderboard now sorts descending (higher % = better rank); score shown as "X%" in the panel
- Leaderboard column header updated from "Attempts" to "Best %"
