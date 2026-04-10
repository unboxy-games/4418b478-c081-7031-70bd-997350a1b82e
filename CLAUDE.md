# Geometry Dash Clone

## Game Overview
- **Title**: Geometry Dash Clone
- **Genre**: Auto-runner / rhythm platformer
- **Core mechanic**: Auto-scrolling cube that the player jumps over obstacles. One button (SPACE / click / tap) to jump. Touch a spike or block = instant death and retry.

## Features Implemented
- Auto-scrolling player cube (speed = 450 px/s) with arcade physics gravity
- Double-jump mechanic (SPACE, UP arrow, or mouse/touch click) — 2 jumps per airborne cycle; refills on landing
- Spinning cube animation: rotates 216°/s in the air, snaps to nearest 90° on landing
- 47 handcrafted obstacles across 13 000px level: single spikes → double → triple → block obstacles → intense mixed sections
- Reduced spike hitboxes for fairness (40×38 vs 60×60 visual)
- Dust particle burst on landing, blue square particle explosion on death
- Camera shake + red flash on death
- Parallax background: 3 TileSprite layers (far/mid/near) with different scroll speeds
- Star field (fixed to camera) + dark navy sky gradient
- Glowing tiled ground
- HUD: top progress bar with % readout, "Attempt N" counter
- Controls hint text (fades after 3 s)
- Win screen with bounce-in tween and "Completed in N attempts!"
- Attempt count persists across restarts via `game.registry`

## Key Implementation Details
- **GameScene.ts** — all game logic (background, ground, level, player, particles, HUD, camera, input)
- **UIScene.ts** — intentionally empty; GameScene handles all HUD via `setScrollFactor(0)`
- **Ground physics**: `add.rectangle` (13 000 × 150 px) + `physics.add.existing(rect, true)` for a reliable static body — body dimensions come directly from the Rectangle's width/height
- **Obstacle group**: `this.physics.add.staticGroup()` — obstacles created with `obstacles.create()`
- **Textures**: all generated programmatically via `this.make.graphics({}, false)` + `generateTexture`
- **Parallax**: TileSprites with `setScrollFactor(0)`; `tilePositionX` driven by `camera.scrollX * factor` each frame
- **Death persistence**: `this.game.registry.set('attempt', n)` before `scene.restart()`

## Controls
- **SPACE** / **UP arrow** / **click** / **tap** — jump (only when grounded)
- **ESC** — toggle pause

## What Changed This Turn
- Added pause button (❙❙/▶ icon) in the HUD top-right corner
- ESC key also toggles pause; clicking anywhere on the pause screen also resumes
- `togglePause()` pauses Arcade physics and shows/hides overlay
- `update()` now guarded by `isPaused` flag so movement stops
- `buildPauseButton()` + `drawPauseIcon()` handle button drawing and icon swap
- Cannot pause during death or win screens (`alive` guard in `togglePause`)
