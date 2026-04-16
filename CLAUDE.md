# Geometry Dash Clone

## Game Overview
- **Title**: Geometry Dash Clone
- **Genre**: Auto-runner / rhythm platformer
- **Core mechanic**: Auto-scrolling cube that the player jumps over/onto obstacles. One button (SPACE / click / tap) to jump. Touch a spike or the side of a block = instant death. Land on top of a block = safe platform.

## Features Implemented
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

## Key Implementation Details
- **GameScene.ts** — all game logic (background, ground, level, player, particles, HUD, camera, input)
- **UIScene.ts** — intentionally empty; GameScene handles all HUD via `setScrollFactor(0)`
- **Ground physics**: `add.rectangle` (13 000 × 150 px) + `physics.add.existing(rect, true)` for a reliable static body — body dimensions come directly from the Rectangle's width/height
- **Obstacle groups**: two static groups — `obstacles` (spikes, lethal overlap) and `platforms` (blocks, collider — land on top safely, lethal on side impact)
- **Textures**: all generated programmatically via `this.make.graphics({}, false)` + `generateTexture`
- **Parallax**: TileSprites with `setScrollFactor(0)`; `tilePositionX` driven by `camera.scrollX * factor` each frame
- **Death persistence**: `this.game.registry.set('attempt', n)` before `scene.restart()`

## Controls
- **SPACE** / **UP arrow** / **click** / **tap** — jump (only when grounded)
- **ESC** — toggle pause

## What Changed This Turn
- Blocks converted to platforms: land on top safely, die only on side impact (`body.blocked.right/left`)
- Spikes remain lethal on any touch via `physics.add.overlap`
- Blocks use a separate `platforms` StaticGroup with `physics.add.collider`
- Dust burst spawn updated to `player.y + (B-8)/2` (player's feet) — works on elevated platforms too
