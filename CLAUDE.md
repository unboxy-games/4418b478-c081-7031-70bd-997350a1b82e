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
- **Lives system**: 5 lives; invincibility frames after being hit
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
- **Start screen**: Title screen with matching starfield, animated enemy rows, blinking "PRESS SPACE TO START", controls & score table; fades in/out on transition
- **Persistent high score**: Saved via `unboxy.saves` (key `highScore`) on game over; loaded on scene start; HUD shows golden "HI  N" beneath SCORE; bounces on update; "★ NEW BEST ★" pulsing callout shown on game-over screen when record broken

## Key Files
| File | Purpose |
|------|---------|
| `src/main.ts`              | Phaser config; exports `unboxyReady` (Unboxy.init promise) |
| `src/scenes/GameScene.ts`  | All gameplay logic (formation, AI, collisions, explosions, hi-score save/load) |
| `src/scenes/UIScene.ts`    | HUD overlay (score, hi-score, wave, life icons) |
| `src/scenes/StartScene.ts` | Title / start screen (Space to begin) |
| `src/scenes/BootScene.ts`  | Passes to StartScene |
| `src/config.ts`            | `GAME_WIDTH = 1280`, `GAME_HEIGHT = 720` |

## Controls
| Key | Action |
|-----|--------|
| ← / A | Move player left |
| → / D | Move player right |
| Space | Fire / Restart (game over) |

## This Turn
- Reduced player starting lives from 6 to 5
