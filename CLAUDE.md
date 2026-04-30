# Bubble Popper

**Genre:** Casual puzzle / tap-to-pop  
**Style:** Earthy, nature-themed — inspired by Google Doodle "碎纷碰碰消" visual style (dark forest-green background, mossy cloud border, sandy grid panel, daisy flowers)

## Core mechanic
- 7×9 grid of coloured tiles (moss green, sandy yellow, ocean blue, rust orange)
- Tap any connected group of 2+ same-coloured tiles to pop them
- Remaining tiles fall down under gravity (Bounce easing)
- Score = group_size² (rewards big combos)
- Game ends when no more valid groups exist, or the board is fully cleared
- High score persists via `unboxy.saves`

## Features implemented (turn 1)
- **Background:** Dark forest-green vertical gradient with organic mossy cloud blobs on all four border sides; 8 daisy flowers on the edges
- **Title:** "Bubble Popper" with yellow-green colour, drop shadow, gentle vertical bob tween
- **Grid panel:** Sandy/parchment rounded rect with 3D highlight and inner border; depth-layered correctly
- **Tiles:** 4 colours, each with:
  - 3D effect (drop shadow, top highlight strip, bottom dark edge)
  - Distinctive inner decoration: mossy bumps (green), picture-frame inset (yellow), orb/bubble (blue), hourglass (orange)
  - Idle bob tween (staggered by col+row offset for organic feel)
- **Flood-fill BFS** for connected same-colour group detection
- **Pop animation:** scale→0 + particle burst (10 tweened circle graphics per pop)
- **Floating score label:** appears at group centre, scales up + fades out (bigger for combos ≥16)
- **Gravity:** tiles fall to bottom of column, Bounce.easeOut tween; idle bobs restart after settle
- **HUD:** SCORE (bottom-left of panel) + BEST (bottom-right) + "X tiles left" counter
- **Game-over modal:** dark overlay + green panel, shows "Board Cleared!" or "No More Moves!", score, best, and an animated "Play Again" button that calls `scene.restart()`
- **Persistence:** `unboxyReady` initialised in `main.ts`, `loadHighScore` / `saveHighScore` in GameScene using `u.saves.get<number>` / `u.saves.set`

## Key implementation details
- `GameScene.ts` — all game logic, visuals, and HUD (UIScene left empty)
- `main.ts` — exports `unboxyReady = Unboxy.init().catch(() => null)`
- Grid data: `grid[col][row]: Cell | null` where col=0..6 (left→right), row=0..8 (top→bottom)
- Pixel centre of tile(col,row): `x = TILE_OX + col*82`, `y = TILE_OY + row*82`
- `TILE_OX = 114`, `TILE_OY = 245`, `PANEL_X = 61`, `PANEL_Y = 192`
- Depth layers: bg=0, moss=1, panel=2, tiles=3, particles=15, score labels=20, game-over overlay=100+
- `isAnimating` flag blocks input during pop+fall sequence
- Particle textures pre-generated as `ptcl_0..3` on first `create()`, skipped on restart if already exist

## Controls
- **Tap / click** a tile → pops its connected same-colour group (min 2 tiles)
- Too-small group: camera shake feedback
