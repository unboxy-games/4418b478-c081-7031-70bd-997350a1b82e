# 碰碰消 — Bump Popper

**Genre:** Sliding tile puzzle  
**Orientation:** Portrait (720 × 1280)  
**Style:** Nature / earthy (dark forest green background, sandy board, clay tiles)

## Core mechanic
Press an arrow key or swipe in a direction — **all tiles on the board slide simultaneously** in that direction. Each tile glides until it hits a wall or another tile. If two same-colored tiles collide, both are eliminated. Clear all tiles within the move limit to win.

## Features implemented
- 10 hand-crafted puzzle levels (4×4 → 5×5 → 5×6 → 6×6 grids)
- 4 tile colors: green, yellow, blue, brown — each with a distinct drawn symbol
  - Green: embossed square with highlight
  - Yellow: nested squares (like the Google doodle)
  - Blue: circle with gloss spot
  - Brown: hourglass / X triangles
- Earthy visual style: dark forest green BG with bokeh dots & daisy motifs, sandy parchment board
- 3D tile look: shadow + base color + top highlight strip + bottom shadow strip
- Gentle idle bob tween on all tiles
- Selection ring (white + yellow glow border) + scale-up on selected tile
- Smooth slide animation (180 ms Cubic ease)
- Pop animation (scale-up + fade) + 9-dot particle burst + screen flash on match
- Move counter with red-flash when ≤ 2 remaining
- Arrow keys and WASD keyboard support (desktop, via window.addEventListener)
- Touch swipe gesture — swipe anywhere to slide all tiles (mobile)
- Restart button (↺) at bottom center
- Hint text: "Swipe or press ↑↓←→ to move all tiles"
- Win / Lose result panel with animated entry
- Level progression saved via `unboxy.saves` (key: `progress`)
- Registry-based level index survives scene restarts within a session

## Key implementation details

### Files
- `src/main.ts` — exports `unboxyReady` Promise for platform services
- `src/scenes/GameScene.ts` — all game logic + HUD (UIScene unused)
- `src/scenes/UIScene.ts` — minimal stub

### Data structures
- `LEVELS: Level[]` — 10 levels, each with `{ cols, rows, maxMoves, tiles[] }`
- `grid: (TileData | null)[][]` — 2D sparse grid, null = empty
- `TileData` — `{ col, row, color, container, idleTween }`
- `levelObjects: GameObject[]` — tracked for cleanup on level reload

### Core loop
`slide(dir)` → `computeSlide()` → `executeSlide()` → pop or place → `checkEndCondition()` → `showResult(won)`

### Persistence
Level progress stored in `registry` (session) and `unboxy.saves.set('progress', idx)` (cross-session).  
On first boot, `checkSavedProgress()` async-loads saved level and restarts the scene if needed.

## Last change (this session)
Fixed ghost-input bug: tapping "Next Level" also triggered the first move of the new level because the pointerup event leaked into the new scene's swipe handler. Added a 350 ms startup lock in `create()` so residual pointer releases from the result panel are ignored.
