# Galaxian-style Space Shooter

## Game Overview
- **Title**: Galaxian (clone)
- **Genre**: Classic arcade space shooter
- **Core mechanic**: Shoot descending alien formations; survive dive-bomb attacks

## Features Implemented
- **Enemy formation**: 10 × 5 grid (3 enemy types — Flagship, Escort, Drone)
- **Formation movement**: Side-to-side with periodic downward drops
- **Dive-bomb attacks**: Enemies peel off and track the player; return to formation if missed
- **Enemy shooting**: Formation enemies fire bullet streams, frequency scales with level
- **Player ship**: Left/right movement (Arrow keys or A/D), fires with Space
- **Bullet system**: Player bullets (yellow), enemy bullets (orange-red)
- **Lives system**: 3 lives; invincibility frames after being hit
- **Score system**: Flagship = 150 pts, Escort = 80 pts, Drone = 40 pts; score popup on kill
- **Level progression**: Clear all enemies → Wave banner → new formation (faster each wave)
- **Game Over**: Dark overlay, final score shown, Space to restart
- **Visual polish**:
  - Deep space gradient background + nebula blobs + 200 static stars
  - All ships drawn with Phaser Graphics API (detailed silhouettes, eyes, cockpits, engines)
  - Idle pulse tweens on all enemies
  - Player engine-bob idle tween
  - Tweened explosion particles (12 shards + flash ring)
  - Score popup text flies upward on kill
  - Wave banner scales up & fades on level transition
  - UI: score bounces on update; life icons = mini ship graphics

## Key Files
| File | Purpose |
|------|---------|
| `src/scenes/GameScene.ts` | All gameplay logic (formation, AI, collisions, explosions) |
| `src/scenes/UIScene.ts`   | HUD overlay (score, wave, life icons) |
| `src/scenes/BootScene.ts` | Passes straight to GameScene |
| `src/config.ts`           | `GAME_WIDTH = 1280`, `GAME_HEIGHT = 720` |

## Controls
| Key | Action |
|-----|--------|
| ← / A | Move player left |
| → / D | Move player right |
| Space | Fire / Restart (game over) |

## This Turn
- Fixed freeze bug in `hitPlayer()`: when lives hit 0, `playerInvincible` was never
  set to `true`, so every enemy bullet that overlapped the invisible (but physics-active)
  player kept calling `hitPlayer()` each frame — spawning explosions/tweens/events in an
  unbounded loop that froze the game. Fix: set `playerInvincible = true` and disable the
  physics body immediately when lives reach zero.
