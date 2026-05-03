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

## Features implemented (turn 4 — start screen)
- **10 hand-crafted levels** of increasing difficulty
- **Level data format changed**: `LevelDef.cols: number[][]` — each column is a stack of colorIds from BOTTOM to TOP (removed `parseGrid`)
- **Tiles always start packed at the bottom** — `loadLevel()` places tiles from `ROWS-1` upward; no floating tiles, no fall animation on first tap
- **Every colour split into 2+ disconnected groups** — same colour appears in separated regions of the board, requiring multiple taps per colour and strategic thinking
- **Gravity merge mechanic** in L3, L7, L9: a "bridge" colour separates two halves of the same colour; popping the bridge causes the halves to fall and merge, rewarding smart play
- **Level progression**: `scene.start('GameScene', { level: N })` passes level index
- **Moves Left pill**: dark green rounded pill in HUD, colour turns orange when ≤2 moves left
- **Level Clear overlay**: green panel with 3 animated stars, "Retry" + "Next Level" buttons
- **Out of Moves overlay**: brown/red panel with "Try Again" button
- **All Cleared overlay**: for last level, "Play Again" restarts from level 1
- **Score tracking** per run; high score persisted via `unboxy.saves`
- **Background**: dark gradient, organic mossy blobs, 8 daisy flowers on border
- **Tile art**: 4 distinct colour × marking combinations (bumps/frame/orb/hourglass) with 3D effect + idle bob

## Key implementation details
- `StartScene.ts` — start screen with title banner (`buttonLong_grey_pressed.png` atlas frame scaled to 590×150), decorative tiles, PLAY button (`buttonLong_beige_pressed.png` atlas frame), high score display
- `GameScene.ts` — all game logic, visuals, level data, and HUD
- `UIScene.ts` — intentionally empty overlay
- `main.ts` — exports `unboxyReady = Unboxy.init().catch(() => null)`; scene order: BootScene → StartScene → GameScene → UIScene
- `BootScene.ts` — preloads `uipack_rpg_sheet` atlas (atlasXML), starts `StartScene`
- `uploaded/uipack_rpg_sheet.png` + `uploaded/uipack_rpg_sheet.xml` — 87-frame atlas (Kenney UIpack RPG)
- Grid: `grid[col][row]: Cell | null`, col=0-6 left→right, row=0-8 top→bottom
- Tile pixel centre: `x = TILE_OX + col*82`, `y = TILE_OY + row*82`
- Constants: `TILE_OX=114`, `TILE_OY=245`, `PANEL_X=61`, `PANEL_Y=192`
- `LevelDef.cols[c]` = array of colorIds from bottom row upward (0=G,1=Y,2=B,3=O)
- `loadLevel()` iterates `cols[c]` placing tiles from `row = ROWS-1` upward
- `floodFill()` BFS for connected same-color groups
- `checkLevelState()` called after each gravity settle: checks clear + pops + hasMove
- `isAnimating` flag blocks input during pop+fall sequence

## Level designs
| # | Groups | Tiles | MaxPops | Notes |
|---|--------|-------|---------|-------|
| 1 | 4 | 16 | 6 | Tutorial — G split into 2 groups separated by Y+B wall |
| 2 | 5 | 19 | 7 | 4 colours; Y has 2 disconnected groups |
| 3 | 5 | 21 | 5 | **Gravity merge**: B bridge splits G; pop B → G merges |
| 4 | 7 | 22 | 10 | All 4 colours split; col5 holds Y-B+B-B stacked |
| 5 | 7 | 24 | 9 | Bigger groups; G, Y, B each have 2 groups |
| 6 | 8 | 24 | 10 | All 4 colours double-split; cols 4-5 each hold 2 mini-groups |
| 7 | 6 | 20 | 5 | **Two gravity merges required**: G+O bridge, Y+B bridge — brute force fails |
| 8 | 8 | 28 | 11 | Dense; 3 G groups, all others doubled |
| 9 | 8 | 28 | 12 | **Gravity merge** (G+B bridge) + Y/O each split |
| 10 | 10 | 32 | 13 | Final — all 4 colours triple-split across 7 columns |

## Level format
```typescript
// cols[c][0] = bottom tile, cols[c][last] = top tile
// 0=green  1=yellow  2=blue  3=orange
interface LevelDef { maxPops: number; cols: number[][]; }
```

## Controls
- **Tap / click** a tile → pops its connected same-colour group (min 2 tiles)
- Too-small group: camera shake feedback
- Move counter decrements on each valid pop
