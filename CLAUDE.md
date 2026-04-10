# Cats vs Mouse Zombies

**Genre**: Tower Defense  
**Perspective**: Top-down  
**Visual style**: Pixel art retro (all graphics drawn with Phaser Graphics API — no image assets)

## Core Mechanic
Place cat towers on grass tiles to shoot at waves of zombie mice walking along a winding dirt path. Earn coins by defeating enemies; spend coins to place more cats. Survive as many waves as possible.

## Features Implemented (v7)
- **Top-down grid**: 20x13 cells at 40px each (800x520 game area, 80px UI panel)
- **Winding dirt path**: 7-segment path from left to right with 4 turns
- **Wave system**: Endless waves. Wave 1 = 9 zombies (80 HP, 58px/s). Each wave: +3 zombies, +22 HP, +5 speed. Spawn interval decreases by 120ms per wave (min 600ms)
- **Economy**: Start with 150 coins. Kill reward varies by enemy type
- **Lives**: Start with 20. Lose 1 per zombie breach. Game over at 0
- **HUD (UIScene)**: Wave counter, lives, coins, score in top bar; tower shop in bottom panel; wave countdown; flash messages; game-over overlay with restart

## Tower Types (8)
| Tower      | Cost | Range | Fire Rate | Damage | Notes |
|------------|------|-------|-----------|--------|-------|
| 🐱 Basic   | 75   | 120   | 1.5s      | 30     | Balanced all-rounder. Orange cat |
| 🎯 Sniper  | 150  | 220   | 3.0s      | 100    | Long range, high damage. Blue cat with rifle |
| ⚡ Rapid   | 100  | 80    | 0.38s     | 12     | Fast fire, short range. Golden cat |
| 💣 Bomber  | 200  | 150   | 2.8s      | 80     | AoE splash 70px radius. Red cat with bomb |
| 🌩 Taser   | 175  | 110   | 2.2s      | 25     | Slows to 40% speed for 2s. Chains to 2 nearby enemies |
| ❄️ Freeze  | 125  | 130   | 2.5s      | 20     | Freezes enemies to ~5% speed for 2s. Ice-blue cat with snowflake |
| 🔥 Flame   | 150  | 90    | 0.5s      | 10     | Burns enemies for 8 dmg/s over 3s DoT. Orange cat with flamethrower |
| 🪤 Trap    | 175  | 160   | 8.0s      | 150    | Drops ground mine; explodes on 35px proximity, 80px AoE. Camo cat |

- Tower selection via click in bottom panel or keyboard keys **1 / 2 / 3 / 4 / 5 / 6 / 7 / 8**
- Selected tower highlighted with colored border glow
- Unaffordable towers get red border tint

## Tower Upgrades & Selling
- **Click a placed tower** to select it (white selection box + range circle shown)
- **Press ESC** to deselect
- **Upgrade** up to 2 times (Level 1 → 2 → 3): costs 75% of base cost per upgrade
  - Each upgrade: Damage ×1.35, Range ×1.10, Fire Rate ×0.85 (faster)
  - Level badge: gold diamond(s) shown below cat body
- **Sell** for 60% of total invested coins (base + upgrades)
- When selected: right side of bottom panel shows tower info panel with Upgrade + Sell buttons

## Enemy Types (7)
| Enemy         | Unlocks | HP mult | Speed mult | Coin reward | Notes |
|---------------|---------|---------|------------|-------------|-------|
| Basic Mouse   | Wave 1  | 1.0x    | 1.0x       | base        | Grey mouse, green zombie eyes |
| Speed Rat     | Wave 2  | 0.4x    | 2.0x       | 0.5x        | Brown, small, long tail, speed trail |
| Brute Rat     | Wave 3  | 3.2x    | 0.55x      | 2.5x        | Large dark rat, bared teeth, red zombie eyes |
| Armored Mouse | Wave 5  | 1.3x    | 0.85x      | 1.8x        | Teal armor + helmet; takes only 50% damage |
| Ghost Mouse   | Wave 4  | 0.6x    | 1.5x       | 1.3x        | Pale translucent ghost; **50% bullet dodge** chance |
| Boss Mouse    | Wave 6  | 8.0x    | 0.4x       | 5.0x        | Huge purple crowned rat; 25% dmg reduction; **enrages at 50% HP** (speed ×1.75) |
| Swarm Mouse   | Wave 3  | 0.15x   | 1.7x       | 0.25x       | Tiny yellow-brown mouse; **spawns 3 at once** |

- Slowed/frozen enemies show cyan electric aura; burn DoT bypasses armor

## Special Mechanics
- **Freeze Tower**: Uses `slowFactor: 0.05` — nearly stops enemies
- **Flame Tower**: `burnDps: 8, burnDuration: 3000` — ticks every update frame; stacks by taking max
- **Trap Tower**: Mine travels fast to target location, becomes stationary, triggers on 35px proximity → 150-dmg 80px AoE explosion. Expires after 12s
- **Ghost dodge**: 50% chance per bullet to dodge in `takeDamage()`
- **Boss enrage**: Triggered once when HP ≤ 50%; `speedMultiplier` = 1.75 permanently
- **Swarm spawn**: `spawnZombie('swarm')` spawns 3× `swarm_unit` at once

## Key Files
- `src/config.ts` - constants + `TowerConfig` interface (incl. `burnDps?`, `burnDuration?`, `trapProximity?`) + `TOWER_CONFIGS` record (8 towers)
- `src/scenes/GameScene.ts` - main logic; 8-button shop layout (btnW=56, btnGap=3, btnStartX=2)
- `src/scenes/UIScene.ts` - HUD + 8-button tower shop + tower info panel; keys 1-8 select towers
- `src/objects/CatTower.ts` - tower; 8 cat draw methods; passes zombies to bomb/taser/trap
- `src/objects/MouseZombie.ts` - enemy; `isGhost`, `speedMultiplier`, `burnDps/Timer`, `enrageTriggered`; `applyBurn()`, `applySlow()` methods
- `src/objects/Bullet.ts` - projectile; trap ground-mine logic (`isGrounded`, `groundX/Y`, `trapExpiry`); burn/freeze on hit; taser chains

## Controls
- **Click** on any grass tile to place the selected tower
- **Click a placed tower** to select it (shows upgrade/sell panel)
- **ESC** to deselect a tower
- **P** to pause / resume
- **⏸ Pause** button in top-right HUD to pause with mouse
- **Hover** over a tower to see its attack range circle
- **Keys 1-8** to switch tower type

## Pause Menu
- Press **P** or click **⏸ Pause** (top-right HUD) to pause
- All enemies, bullets and timers freeze instantly
- Pause overlay: ▶ RESUME [P] and ↺ Restart Game buttons
- `GameScene.togglePause()` emits `paused` / `resumed` events; `isPaused` guards `update()`

## Changed This Turn (v7)
### New Towers (3)
- ❄️ **Freeze** (125 coins, key 6): Nearly-freezes enemies (5% speed for 2s). Ice-blue cat holding snowflake. Ice-crystal bullet with 8-directional spikes.
- 🔥 **Flame** (150 coins, key 7): Rapid-fire (0.5s) fireballs applying 8 dmg/s burn DoT for 3s. Orange-red cat with flamethrower arm.
- 🪤 **Trap** (175 coins, key 8): Sends mine to target position, sits on ground, explodes 150-dmg AoE when enemy gets within 35px. Camo cat with tactical goggles.

### New Enemies (3)
- **Ghost Mouse** (wave 4): Translucent pale-blue ghost mouse. 50% bullet evasion.
- **Boss Mouse** (wave 6): Giant purple crowned mouse, 25% damage resistance, enrages (1.75× speed) at half health.
- **Swarm Mouse** (wave 3): Tiny yellow-brown mouse — 3 always spawn at once.

### Shop Layout
- Expanded from 5 → 8 buttons (btnW=56, compact icon+name+cost layout)
- Keys 6/7/8 added for Freeze/Flame/Trap
- `TowerConfig` interface: added `burnDps?`, `burnDuration?`, `trapProximity?`
