# Cat Tower Defense

## Game Overview
- **Title**: Cat Tower Defense
- **Genre**: Tower Defense
- **Style**: Cute & cartoony
- **Description**: Place cat towers to defend against waves of mice, bugs, and birds marching along a winding dirt path.

## Core Mechanic
- Classic tower defense on a 16×10 grid (800×500 play area + 100px shop panel)
- Enemies follow a pre-defined snaking path from left → right, winding through the map
- Player places cat towers on grass tiles (not path) using gold earned from kills
- Lose a life each time an enemy escapes; game over at 0 lives

## Features Implemented
- **3 Enemy Types** (drawn with Phaser Graphics API):
  - 🐭 Mouse — balanced speed/HP, 60 HP, 80 px/s, gives 10g
  - 🪲 Bug — slow tank, 150 HP, 45 px/s, gives 25g (antennae, 6 legs, shell spots)
  - 🐦 Bird — fast fragile, 35 HP, 140 px/s, gives 15g (wings, crown, tail feathers)
- **4 Tower Types** (detailed drawn cats on platforms):
  - 🟠 Tabby Cat — 50g, balanced (DMG:15, RNG:125, 1.2/s), orange striped
  - ⚫ Ninja Cat — 100g, fast attacker (DMG:20, RNG:95, 2.8/s), red bandana, shuriken
  - 🟣 Wizard Cat — 150g, AoE (DMG:45+splash, RNG:155, 0.6/s), hat, wand, robe stars
  - 🟢 Sniper Cat — 125g, extreme range (DMG:80, RNG:260, 0.35/s), camo beret, rifle + scope
- **Wave System**: Infinite scaling waves (wave N: 5+3N mice, 2(N-1) bugs, 3(N-2) birds). HP scales 25% per wave.
- **Economy**: Start with 150g. Earn gold from kills + wave completion bonuses.
- **Lives**: Start with 20. Lose 1 per escaped enemy.
- **Projectiles**: Orange yarn (tabby), spinning shuriken (ninja), purple orb (wizard with AoE splash ring), rotating tracer bullet (sniper, 680px/s)
- **Visual effects**: Enemy death particles, floating gold text, AoE purple ring, red flash on life loss, wave banner
- **HUD**: Lives + gold (top-left), wave + score (top-right), semi-transparent pills
- **Shop Panel**: 4 tower buttons at bottom with stats, selected tower highlighted

## Path Layout (16×10 grid, 50px tiles)
Entry (left, row 1) → right to col 3 → down to row 3 → right to col 7 → down to row 5 → right to col 10 → down to row 7 → right to col 13 → UP to row 2 → exit right

## Key Files
- `src/scenes/GameScene.ts` — Main game logic, grid, waves, shop panel
- `src/scenes/UIScene.ts` — HUD overlay (lives, gold, wave, score)
- `src/objects/Enemy.ts` — Enemy class (mouse/bug/bird) with path following, HP bars, bob animation
- `src/objects/Tower.ts` — Tower class (tabby/ninja/wizard) with targeting
- `src/objects/Projectile.ts` — Projectile class with AoE hit reporting

## Controls
- Click a tower button in the shop panel to select tower type
- Click any green (buildable) grass tile to place the selected tower
- **Right-click any placed tower to sell it** for 60% of its cost
- Click "Start Wave" button to begin a wave
- Tower shows range ring for 1.2 seconds after placement

## Changed This Turn
- **Sell button ghost-placement bug fix** (`GameScene.ts`):
  - Root cause: sell button's `pointerdown` fires first → `executeSell()` destroys `sellBtnContainer` (sets it to `null`) → global scene `pointerdown` handler then runs, finds `sellBtnContainer === null`, skips the bounds guard, and calls `tryPlaceTower` on the now-empty cell
  - Fix: `executeSell()` now sets `_blockNextTileTap = true` before doing anything; the global `pointerdown` handler checks this flag first and returns early (consuming the flag), so no tower is ever placed on a sell-click

## Previously Changed
- **Sniper rifle aiming** (`Tower.ts`):
  - Rifle (stock, barrel, scope, muzzle) extracted from `bodyG` into a dedicated `gunContainer` child of the main container, pivoting at the trigger/grip point `(0, 1)`
  - Scope `gleamCont` idle animation moved to be a child of `gunContainer` so it tracks the barrel
  - In `tryFire`, sniper uses `atan2(dy, dx)` (no +90° offset — barrel points right at angle 0) to rotate only `gunContainer`; body container stays locked at `angle = 0` (upright)
  - Other cats (tabby, ninja, wizard) keep the full-body rotation with the `+90°` offset as before

## Previously Changed This Turn
- **Tower sell feature — touch-friendly** (`GameScene.ts`, `Tower.ts`):
  - Tap any placed tower to select it → a floating `💰 Sell +Xg` button pops up above it
  - Tap the sell button to confirm the sale for 60% refund; tap anywhere else to deselect
  - Sell button has a pop-in (Back.easeOut) + gentle bob tween to draw attention
  - Hover over a tower tile turns it gold as a visual cue
  - Gold poof particle burst (12 particles) + floating "+Xg" text on sell
  - Sell hint label in shop panel updated for tap interaction
  - `selectTower` / `deselectTower` / `createSellButton` / `executeSell` methods replace old right-click flow
  - `Tower.destroy()` method recursively kills all nested tweens then destroys the container tree
  - `deselectTower()` also called on game over to prevent orphaned sell UI

## Previously Changed
- **Fixed shop button hit area** (`GameScene.ts`): replaced `setSize()+setInteractive()` with an explicit `Phaser.Geom.Rectangle(0, 0, btnW, btnH)` hit area. The old approach created a centered rectangle offset from the drawn content, causing hover/click to be missed on roughly half the button.

## Previously Changed
- **Added Sniper Cat tower** (`Tower.ts`, `Projectile.ts`, `GameScene.ts`):
  - 125g cost, DMG:80, RNG:260 (nearly double wizard), 0.35/s fire rate
  - Visual: camo green body with patches, tactical beret, one squinting eye, long rifle barrel + scope with crosshair
  - Idle animation: scope gleam pulses bright→dim (scanning effect) + slow body breathe
  - Projectile: elongated lime-green tracer bullet (3-layer ellipse glow) that rotates to face target, speed 680px/s
  - Shop panel updated to 4 buttons; `TowerType` union and `TOWER_CONFIGS` updated in Tower.ts

## Previously Changed
- **Character animation overhaul** across `Enemy.ts` and `Tower.ts`:
  - **Mouse**: tail extracted to separate animated container (wag tween ±28°); body waddle tween (±6° lean)
  - **Bug**: legs extracted to separate container behind body (scuttle squish cycle scaleX 0.8↔1.0); antennae in separate container (wiggle ±10°)
  - **Bird**: both wings extracted to separate containers behind body (alternating flap via scaleY 1↔-0.35, 105ms phase offset for natural look)
  - **Hit flash**: all enemies flash `body.alpha` 0.15→1 over 100ms on every non-lethal hit
  - **Tabby tower idle**: wagging tail container (±40°) inserted behind body; subtle alpha breathe pulse
  - **Ninja tower idle**: floating shuriken orbits above (continuous 360° spin + bob up/down); stealth body shimmer
  - **Wizard tower idle**: pulsing wand orb container (scale 1→1.9 + alpha fade + rotation); robe shimmer on bodyG
  - All tower idles start in the `onComplete` callback of the pop-in tween
