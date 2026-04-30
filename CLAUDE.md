# Bubble Popper

**Genre:** Casual puzzle / tap-to-pop  
**Style:** Earthy, nature-themed — Google Doodle "碎纷碰碰消" visual style (dark forest-green background, mossy cloud border, sandy grid panel, daisy flowers)

## Core mechanic
- 7×9 grid of coloured tiles (moss green, sandy yellow, ocean blue, rust orange)
- Tap any connected group of 2+ same-coloured tiles to pop them
- Remaining tiles fall down under gravity (Bounce easing)
- **Limited moves (pops)** per level — shown as prominent "MOVES LEFT" pill
- Win: clear ALL tiles within the move limit
- Fail: run out of moves with tiles remaining, OR no valid groups left before clearing

## Features implemented (turn 2 — level system)
- **10 hand-crafted levels** of increasing difficulty (3 → 7+ groups, 14 → 32 tiles)
- **Level progression**: `scene.start('GameScene', { level: N })` passes level index
- **Gravity merging mechanic**: level 3+ has tiles where popping one group lets another fall and merge, rewarding smart play
- **Moves Left pill**: dark green rounded pill in HUD below grid, colour turns orange when ≤2 moves left
- **Level Clear overlay**: green panel with 3 animated stars, "Retry" + "Next Level" buttons
- **Out of Moves overlay**: brown/red panel with "Try Again" button
- **All Cleared overlay**: for last level, "Play Again" restarts from level 1
- **Score tracking** per run; high score persisted via `unboxy.saves`
- **Background**: dark gradient, organic mossy blobs, 8 daisy flowers on border
- **Tile art**: 4 distinct colour × marking combinations (bumps/frame/orb/hourglass) with 3D effect + idle bob

## Key implementation details
- `GameScene.ts` — all game logic, visuals, level data, and HUD
- `UIScene.ts` — intentionally empty overlay
- `main.ts` — exports `unboxyReady = Unboxy.init().catch(() => null)`
- Grid: `grid[col][row]: Cell | null`, col=0-6 left→right, row=0-8 top→bottom
- Tile pixel centre: `x = TILE_OX + col*82`, `y = TILE_OY + row*82`
- Constants: `TILE_OX=114`, `TILE_OY=245`, `PANEL_X=61`, `PANEL_Y=192`
- `LEVELS[]` array: `parseGrid(rows)` converts string rows (G/Y/B/O/.) to `number[][]`
- `init(data?)` receives `{ level }` from `scene.start`
- `checkLevelState()` called after each gravity settle: checks clear + pops + hasMove
- `isAnimating` flag blocks input during pop+fall sequence

## Level designs
| # | Groups | Tiles | MaxPops | Notes |
|---|--------|-------|---------|-------|
| 1 | 3 | 14 | 5 | Tutorial — 3 obvious colour blocks |
| 2 | 4 | 16 | 7 | Four groups, mix of sizes |
| 3 | 5 | 18 | 7 | Gravity merge trick available |
| 4 | 4 | 22 | 8 | Larger groups, order matters |
| 5 | 5 | 24 | 9 | Two separate B groups |
| 6 | 5 | 26 | 10 | O cap on G column, gravity depth |
| 7 | 6 | 26 | 11 | Six groups, strategic ordering |
| 8 | 6 | 28 | 11 | Denser layout |
| 9 | 7 | 30 | 12 | Complex interleaved colours |
| 10 | 7 | 32 | 13 | Final challenge |

## Controls
- **Tap / click** a tile → pops its connected same-colour group (min 2 tiles)
- Too-small group: camera shake feedback
- Move counter decrements on each valid pop
