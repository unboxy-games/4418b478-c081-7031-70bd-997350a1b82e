# Pong

**Genre:** Classic arcade — two-player paddle game  
**Core mechanic:** Two paddles deflect a ball. First player to reach 7 points wins.

## Scenes
- **BootScene** → boots to TitleScene
- **TitleScene** — "PONG" title, player control labels, click/space to start
- **GameScene** — full gameplay (see below)
- **UIScene** — placeholder (Pong manages its own HUD in GameScene)

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

## This turn
- Created game from scratch: TitleScene, GameScene (full Pong), minimal UIScene
- Updated BootScene to start TitleScene
- Updated main.ts to register TitleScene
