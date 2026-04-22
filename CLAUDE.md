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
- **Lives system**: 6 lives; invincibility frames after being hit
- **Score system**: Flagship = 150 pts, Escort = 80 pts, Drone = 40 pts; score popup on kill
- **Level progression**: Clear all enemies → Wave banner → new formation (faster each wave)
- **Game Over**: Dark overlay, final score shown, Space to restart, L for scoreboard
- **Visual polish**:
  - Deep space gradient background + nebula blobs + 200 static stars
  - All ships drawn with Phaser Graphics API (detailed silhouettes, eyes, cockpits, engines)
  - Idle pulse tweens on all enemies
  - Player engine-bob idle tween
  - Tweened explosion particles (12 shards + flash ring)
  - Score popup text flies upward on kill
  - Wave banner scales up & fades on level transition
  - UI: score bounces on update; life icons = mini ship graphics
- **Start screen**: Title screen with matching starfield, animated enemy rows, blinking "PRESS SPACE or TAP TO START", controls & score table; fades in/out on transition
- **Touch / tablet controls**: Three virtual buttons drawn in the bottom strip of the screen (◀ LEFT, ▶ RIGHT, ▲ FIRE); semi-transparent, depth 11–13; interact via Phaser Zone pointerdown/up/out; hidden on game over; touch also fires tap-to-start (StartScene) and tap-to-restart (game-over screen)
- **Persistent high score**: Saved via `unboxy.saves` (key `highScore`) on game over; loaded on scene start; HUD shows golden "HI  N" beneath SCORE; bounces on update; "★ NEW BEST ★" pulsing callout shown on game-over screen when record broken
- **Global scoreboard**: Top-10 all-player leaderboard via `unboxy.gameData` (key `leaderboard`); displayed in `LeaderboardScene`; scores submitted on game over for authenticated players; accessible via L key on game-over screen; SPACE restarts / ESC returns to menu

## Key Files
| File | Purpose |
|------|---------|
| `src/main.ts`                    | Phaser config; exports `unboxyReady` (Unboxy.init promise) |
| `src/scenes/GameScene.ts`        | All gameplay logic; submits score to leaderboard on game over |
| `src/scenes/UIScene.ts`          | HUD overlay (score, hi-score, wave, life icons) |
| `src/scenes/StartScene.ts`       | Title / start screen (Space to begin) |
| `src/scenes/LeaderboardScene.ts` | Top-10 global scoreboard; reads `gameData.leaderboard` |
| `src/scenes/BootScene.ts`        | Passes to StartScene |
| `src/config.ts`                  | `GAME_WIDTH = 1280`, `GAME_HEIGHT = 720` |

## Leaderboard details
- Stored in `unboxy.gameData` under key `leaderboard` (array of up to 100 entries)
- Each entry: `{ name: string; score: number; wave: number; at: number }`
- Submission uses a read-modify-write retry loop (up to 3 attempts) to handle `VERSION_MISMATCH` from concurrent writers
- Anonymous players can view the leaderboard but scores are only submitted for authenticated users
- Current player's entry is highlighted in the scoreboard (matched by score + wave)

## Controls
| Key / Touch | Action |
|-------------|--------|
| ← / A / ◀ button | Move player left |
| → / D / ▶ button | Move player right |
| Space / ▲ button | Fire |
| Tap anywhere (game over) | Restart |
| Tap anywhere (start screen) | Start game |
| L | Open Scoreboard (game over screen) |
| ESC | Return to Main Menu (scoreboard) |

## This Turn
- Changed starting player lives from 5 to 6
