# Reaction Game

## Game Overview
- **Title**: REACTION
- **Genre**: Reaction / Reflex arcade game
- **Core Mechanic**: A 4×4 grid of buttons lights up one at a time; tap it while lit for +1, tap a dark button for -1.

## Features Implemented
- 4×4 grid of styled rounded buttons drawn with Phaser Graphics API
- Dark-grey buttons with 3D bevel (highlight top, shadow bottom, corner dots, center ring)
- Lit buttons rendered in gold/yellow with inner glow, star dots, center burst
- Per-button glow layer (multi-ring soft aura) when lit
- Pulsing scale tween on lit buttons (yoyo, loop: -1)
- Random button lights up on a repeating timer (default 900 ms)
- Correct tap: +1 score, pop-scale tween, gold particle burst, score bounce
- Wrong tap: -1 score, red flash overlay, score shake animation, red particle burst
- Score display at the top in a pill badge; turns red when score is negative
- Speed slider at the bottom (range 300 ms – 2000 ms, left = slow, right = fast)
  - Draggable thumb with click-on-track support
  - Current speed shown as "X ms" label; track fills golden to thumb position
- Gradient dark background with subtle grid lines and vignette
- UIScene is registered but not launched (scoring is handled fully in GameScene)

## Key Implementation Details
- **Module-level constants**: `CELL=120`, `BTN=108`, `RADIUS=14`, grid layout derived from these
- **GridButton interface**: holds `bg`, `glow`, `zone`, `cx`, `cy`, `row`, `col`, `isLit`
- **lightRandom()**: picks a new random index ≠ current, darkens previous, lights new
- **Slider**: `sliderX` tracks thumb position; `onSliderMoved()` maps to interval and restarts timer
- **Depth layers**: bg=0, grid panel=1, button bg=2, zone=5, flash=6, slider panel=9, slider track/thumb=9-10, slider thumb zone=11

## Last Turn
- Built entire game from scratch: grid, lighting logic, tap scoring, slider, particles, animations, styled background.
