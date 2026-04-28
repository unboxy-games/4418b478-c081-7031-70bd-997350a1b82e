# Cat Wizard vs Ghosts — Halloween Spell-Drawing Game

## What this game is
A Google-Doodle-Halloween-style game where a cute cat wizard defeats ghosts by drawing magic symbols (○ △ ⚡) on screen. Draw a circle, triangle, or zigzag to banish the matching ghost type. Fixed levels with a boss at the end.

## Features implemented
- **Drawing system**: click-drag to draw glowing magic trail, gesture recognised on pointer-up
- **Gesture recognition**: closed-loop → circle or triangle (by corner count); open zigzag → lightning
- **3 ghost types**: Regular (white, needs ○), Pumpkin (orange, needs △), Bat Ghost (purple, needs ⚡)
- **Boss ghost**: 3-hit boss needing circle → triangle → lightning in sequence; crowned with jewels
- **4 levels**: L1=circles only, L2=circle+triangle, L3=all 3, L4=boss
- **Lives system**: 3 hearts; ghost reaching bottom steals a life; cat flashes on hit
- **HUD**: score (top-left), level (top-centre), heart icons (top-right), spell hint (bottom)
- **Visual polish**: night sky gradient, moon with craters, twinkling stars, graveyard with tombstones and dead trees; cat with witch hat + idle bob + twinkling wand star; magic burst particles on hit; win/gameover overlays with play-again
- **Game states**: playing → levelTransition → next level → boss → win; or gameover

## Key implementation details
- `GameScene.ts`: all game logic (cat, ghosts, drawing, gesture recognition, level flow)
- `UIScene.ts`: HUD overlay (score, level, heart icons drawn with parametric heart curve)
- Ghost recognition: closed shapes use centroid-distance CV (circle CV<0.20, triangle CV≥0.20); open shapes use `countXReversals()` + `countSharpCorners()` for zigzag. Path is smoothed before analysis to remove mouse jitter. Spell targets nearest ghost to draw centroid.
- Ghost types: `GhostType = 'regular' | 'pumpkin' | 'bat' | 'boss'`
- Boss uses `bossPhase` (0/1/2) to track which spell is next; `renderGhost()` redraws on hit

## Controls
- Left click + drag to draw a symbol; release to cast
- ○ = closed smooth loop → defeats white regular ghost
- △ = closed loop with corners → defeats orange pumpkin ghost  
- ⚡ = zigzag (direction reversals) → defeats purple bat ghost
