# Geometry Dash Clone

## Game Overview
- **Title**: Geometry Dash Clone
- **Genre**: Auto-runner / rhythm platformer
- **Core mechanic**: Auto-scrolling cube that the player jumps over/onto obstacles. One button (SPACE / click / tap) to jump. Touch a spike or the side of a block = instant death. Land on top of a block = safe platform.

## Features Implemented
- **Main Menu** (MenuScene): SOLO PLAY + ONLINE CO-OP buttons; animated bouncing preview cubes; star background
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
- **MenuScene.ts** — mode selection + online lobby (new)
- **gameState.ts** — `activeRoom`, `setActiveRoom`, `clearActiveRoom` (new)
- **main.ts** — exports `unboxyReady = Unboxy.init(...)` for auth + rooms API
- **GameScene.ts** — all game logic (background, ground, level, player, particles, HUD, camera, input, multiplayer)
- **UIScene.ts** — intentionally empty; GameScene handles all HUD via `setScrollFactor(0)`
- **Ground physics**: `add.rectangle` (13 000 × 150 px) + `physics.add.existing(rect, true)` for a reliable static body
- **Obstacle groups**: two static groups — `obstacles` (spikes, lethal overlap) and `platforms` (blocks, collider — land on top safely, lethal on side impact)
- **Textures**: all generated programmatically via `this.make.graphics({}, false)` + `generateTexture`; `cube2` (orange) created in MenuScene first (so GameScene guard skips it)
- **Parallax**: TileSprites with `setScrollFactor(0)`; `tilePositionX` driven by `camera.scrollX * factor` each frame
- **Death persistence**: `this.game.registry.set('attempt', n)` before `scene.restart()` (solo only)
- **room.state cast**: `room.state as { players: Map<string, { displayName?: string }> }` to work around `UnboxyRoom<unknown>` default

## Controls
- **SPACE** / **UP arrow** / **click** / **tap** — jump (only when grounded)
- **ESC** — toggle pause (solo only)

## What Changed This Turn
- Added online multiplayer co-op mode (two players race the same level simultaneously)
- New MenuScene with SOLO and ONLINE CO-OP buttons, animated preview cubes, star background
- New gameState.ts module for passing the live room reference between scenes
- main.ts now exports `unboxyReady` (Unboxy.init promise)
- BootScene now starts MenuScene instead of GameScene
- GameScene: added `cube2` orange texture, remote player sprite, floating name labels, `initMultiplayer()`, `triggerRemoteDeath()`, `showMpDeathScreen()`, `returnToMenu()`, `showFloatingNotif()`
- MP death goes to MenuScene (not restart); MP win shows trophy message then auto-returns
