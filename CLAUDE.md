# Reaction Game

## Game Overview
- **Title**: REACTION
- **Genre**: Reaction / Reflex arcade game
- **Core Mechanic**: A 4×4 grid of buttons lights up one at a time; tap it while lit for +1, tap a dark button for -1. 30-second timed rounds.

## Features Implemented
- **4×4 grid** of styled rounded buttons drawn with Phaser Graphics API
- Dark-grey buttons with 3D bevel (highlight top, shadow bottom, corner dots, center ring)
- Lit buttons rendered in gold/yellow with inner glow, star dots, center burst
- Per-button glow layer (multi-ring soft aura) when lit
- Pulsing scale tween on lit buttons (yoyo, loop: -1)
- Random button lights up on a repeating timer (default 900 ms)
- **Correct tap**: +1 score, pop-scale tween, gold particle burst, score bounce
- **Wrong tap**: -1 score, red flash overlay, score shake animation, red particle burst
- Score display at the top in a pill badge; turns red when score is negative
- **30-second round countdown** shown as timer pill on the left of the header
  - Timer flashes orange at ≤10 s, red at ≤5 s with shake animation
- **"TIME'S UP!" round-over screen** with animated entry, score display, best score comparison, "Play Again" and "High Scores" buttons
- **Speed slider** at the bottom (range 300 ms – 2000 ms, left = slow, right = fast)
  - Draggable thumb with click-on-track support; current speed label
- **🏆 SCORES button** in the top-right corner — always accessible
- **Scrollable leaderboard panel** (rexUI GridTable):
  - Shows up to 50 personal best scores, sorted by score descending
  - 3 columns: Rank (with 🥇/🥈/🥉 medal colors), Score, Date
  - 6 rows visible at a time; drag-to-scroll and mouse-wheel supported
  - Fade-in entrance animation; click outside or ✕ to close
  - Empty state message when no scores exist yet
- **Persistent scores** via `unboxy.saves` key `highScores` (ScoreEntry[])
  - Saved automatically at end of each round; loads on scene create
  - In-memory fallback if save fails; game never blocked by save errors
- Gradient dark background with subtle grid lines and vignette
- UIScene registered but not launched (scoring handled in GameScene)

## Key Implementation Details
- **Module-level constants**: `CELL=120`, `BTN=108`, `RADIUS=14`, grid layout derived from these
- **GridButton interface**: holds `bg`, `glow`, `zone`, `cx`, `cy`, `row`, `col`, `isLit`
- **ScoreEntry**: `{ score: number; date: number }` (Unix ms timestamp)
- **ScoreRow**: ScoreEntry + `rank: number` (computed when opening leaderboard)
- **lightRandom()**: picks a new random index ≠ current, darkens previous, lights new
- **Round state**: `roundActive` flag gates all tap scoring; `startRound()` / `endRound()` lifecycle
- **Slider**: `sliderX` tracks thumb position; `onSliderMoved()` maps to interval and restarts timer (only if roundActive)
- **destroyGroup()**: kills all tweens targeting group objects before destroying — prevents looping tweens on dead objects
- **Depth layers**: bg=0, grid panel=1, button bg=2, zone=5, flash=6, slider panel=9, slider track/thumb=9-10, slider thumb zone=11, round-over dim=40, round-over panel=41-44, leaderboard dim=50-53, leaderboard content=54-60
- **rexUI plugin**: `phaser3-rex-plugins` registered as scene plugin via `plugins.scene` in `createUnboxyGame`; `declare rexUI: any` on GameScene
- **unboxyReady**: exported from `main.ts`, used in GameScene for save/load

## Dependencies
- `phaser3-rex-plugins@^1.1` — added for rexUI GridTable (scrollable leaderboard)
- `@unboxy/phaser-sdk` — `Unboxy.init()` for save persistence

## Last Turn
- Added 30-second round timer with animated countdown and urgency colors
- Added "TIME'S UP!" round-over screen with Play Again / High Scores buttons
- Added 🏆 SCORES button (top-right, always accessible)
- Added scrollable leaderboard panel using rexUI GridTable (6 visible rows, drag/flick/wheel)
- Added persistent score history via unboxy.saves (key: highScores, last 50 entries)
- Added Unboxy.init() in main.ts; rexUI scene plugin wired in createUnboxyGame plugins config
