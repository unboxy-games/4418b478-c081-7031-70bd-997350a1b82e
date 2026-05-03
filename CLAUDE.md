# Pong

**Genre:** Classic arcade — two-player paddle game  
**Core mechanic:** Two paddles deflect a ball. First player to reach 7 points wins.

## Scenes
- **BootScene** → boots to TitleScene
- **TitleScene** — polished landing screen with rexUI Start button (see below)
- **GameScene** — full gameplay (see below)
- **UIScene** — placeholder (Pong manages its own HUD in GameScene)

## TitleScene implementation details
- Dark gradient background with a radial glow behind the title
- "PONG" title rendered as 4 individual animated letters (staggered Back.Out bounce-in)
- Decorative ghost paddles, ball, and court boundary lines (low-opacity)
- Dashed center divider (same as GameScene)
- Player control cards for P1 (blue, W/S) and P2 (orange, ↑/↓) with rounded-rect borders
- VS badge between the cards
- "FIRST TO 7 POINTS WINS" notice
- **rexUI Start button** — `this.rexUI.add.buttons()` with a single Label child; hover swaps background color; click fades out and starts GameScene
- SPACE key also triggers start (keyboard shortcut)
- rexUI plugin registered in `main.ts` via `plugins.scene`

## GameScene implementation details
- **Left paddle (Player 1):** W / S keys, blue (#4488dd), drawn each frame with Graphics
- **Right paddle (Player 2):** ↑ / ↓ keys, orange (#dd8833), drawn each frame with Graphics
- **Ball:** manual physics (position += velocity × dt), TRAIL_LEN=9 fading trail, glow layers
- **Ball speed:** starts at 420 px/s, increases ×1.06 on each paddle hit, caps at 740 px/s
- **Bounce angle:** relative intersect point on paddle controls bounce angle (±65°)
- **Scoring:** ball exits left (<−30) → P2 scores; exits right (>W+30) → P1 scores
- **Win condition:** first to 7; winner overlay shown with rematch (SPACE) or menu (ESC)
- **State machine:** `countdown | playing | scored | gameover`
- **Countdown:** 3 → 2 → 1 → GO! pop animation (850 ms each), then ball launches
- **Effects:** particle burst on paddle hit + wall bounce; screen flash; camera shake; score text scale bounce
- **Particle texture:** generated at runtime into `pongPart` key (Phaser 3.60+ ParticleEmitter API)
- **ESC:** returns to TitleScene at any point (except gameover has its own ESC handler)
- **Depth layers:** bg=0, divider/decorative=1, paddles=3, ball+trail=4, particles=5, score HUD=10, flash=100, overlay/gameover=999-1000

## Constants (GameScene.ts top level)
- `PW=16, PH=110` paddle dimensions
- `PX_L=58, PX_R=GAME_WIDTH-74` paddle X positions
- `PADDLE_SPEED=560`, `BASE_SPEED=420`, `MAX_SPEED=740`, `WINNING_SCORE=7`

## Plugin setup
- `phaser3-rex-plugins@^1.1` installed
- `UIPlugin` registered in `main.ts` as `{ key: 'rexUI', plugin: UIPlugin, mapping: 'rexUI' }`
- Type declaration at `src/types/rexui.d.ts`
- All rexUI scenes declare `rexUI!: any`

## This turn
- Added `tile_0002.png` (Pixel Platformer vehicle sprite from library) as a decorative car on the title screen (bottom-right, depth 2, 3.5× scale, fades in at delay 700ms)
- BootScene now has a loading bar and registers the `tile_0002` image in the asset manifest

## Previous turns
- Added abstract geometric background to TitleScene via `drawGeometricBg()`:
  - Filled translucent hexagons, triangles, and diamond shapes at low opacity in muted blues/purples
  - Wireframe outlines on each polygon at slightly higher opacity for depth
  - Three wireframe circles of varying radii overlapping the layout
  - Thin diagonal crossing lines for grid-like feel
  - Small glowing dots at polygon vertex positions as accent details
  - All shapes sit at depth 0, behind all existing title content
