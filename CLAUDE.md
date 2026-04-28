# Breakout (Google Doodle Style)

## Game overview
Classic brick-breaker / breakout game styled after the Google Doodle version.
Single-player. Mouse to move paddle, click or Space to launch ball.

## Features implemented
- **3 levels** with distinct brick layouts (cycles if more are added)
- **4 brick rows** per level — Google colors: blue (40 pts), red (30), yellow (20), green (10)
- **Brick types**: normal (1 hit), hard/dashed (2 hits, cracked visual), +life bonus, wide-paddle bonus
- **Ball trail** — fading ghost circles as the ball moves
- **Particle burst** — pixel-square explosion in brick's color on break
- **Paddle physics** — angle changes based on where ball hits; slight speed increase per hit
- **Lives system** — 3 balls, shown as circle icons in HUD top-left
- **Score display** — 5-digit monospace center top, bounces on update
- **Hi-score** — persisted via `unboxy.saves` key `highScore`
- **Level indicator** — top left
- **Power-ups**: +BALL (extra life), WIDE (1.78× paddle for 9 s)
- **Drop-in animation** — bricks cascade down on level start
- **Idle tween** — ball pulses when sitting on paddle
- **State machine**: playing → paused (life lost) → playing / over / clear / win
- **Camera effects**: flash on life lost, shake on wall/life events
- **Floating score text** on power-up pickup

## Key implementation details
- `src/scenes/GameScene.ts` — all game logic AND HUD; no UIScene usage
- `src/scenes/UIScene.ts` — kept but empty (required by main.ts scene list)
- Manual ball physics (velocity vector, AABB vs bricks, angle-based paddle reflection)
- Brick graphics drawn at local (0,0) center; positioned via `gfx.x/gfx.y`
- `LEVELS` constant array: 3 levels × 4 rows × 8 cols (0=empty, 1=normal, 2=hard, 3=life, 4=wide)
- Play-field walls at `BX0 - 16` and `BX0 + BTOT_W + 16`
- Ball speed starts at 425 px/s, increases by 35 per level, caps at 1.65× base per paddle hit

## Controls
- **Mouse move** — paddle follows cursor
- **Click / Space** — launch ball; confirm dialogs

## What changed this turn
- Fixed paddle-hit flash bug: removed scaleX/scaleY tween on padGfx (Graphics drawn at absolute coords scale from screen origin, not paddle center — causing visual warp). Replaced with a `padHitMs` countdown that renders a fading white overlay directly inside `drawPaddle()` each frame.
