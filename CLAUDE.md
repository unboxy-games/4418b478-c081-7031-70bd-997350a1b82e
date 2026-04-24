# Dot Board

**Genre:** Collaborative online canvas  
**Core mechanic:** Players tap anywhere on a shared board to place colored dots. Every connected player sees each other's dots appear live in real time. No scoring, no game over — just a growing shared canvas.

## Features implemented

- **Online multiplayer** via `unboxy.rooms` (`joinOrCreate('lobby', ...)`)
- **Random per-player color** chosen from a 16-color palette on scene load; published to room state
- **Live dot placement**: tapping places a dot locally and broadcasts it via `room.send('dot', ...)` so others see it instantly
- **Historical dot sync**: dot arrays stored in `room.player.set('dots', [...])` so late joiners see all previously placed dots
- **Player count display** in the header (updates via `onStateChange`)
- **Color indicator** in the footer with a gentle breathing pulse tween
- **Burst effect** on each dot: expanding ring + 8 radiating spark tweens
- **Pop-in animation** on every dot (scale 0 → 1, Back.easeOut)
- **Auth gate**: shows a sign-in prompt if `unboxy.isAuthenticated` is false
- **Standalone guard**: catches `REALTIME_UNAVAILABLE` and shows a friendly message
- **Gradient background** (dark navy to deep purple) with a subtle grid overlay
- **Header/footer chrome** with translucent dark bars; drawable area is between them
- Subscriptions (`onStateChange`, `room.on`) unsubscribed and `room.leave()` called on scene shutdown

## Key implementation details

- `Unboxy.init()` called at module load in `main.ts`, exported as `unboxyReady`
- `GameScene.create()` is `async` and awaits `unboxyReady`
- `myDots: DotRecord[]` grows as the player places dots; whole array re-published on each new dot
- `renderedDotKeys: Set<string>` (`"${sid}:${index}"`) prevents double-rendering dots on repeated `onStateChange` fires
- `room` field typed as `any` to avoid Colyseus MapSchema type complications
- UIScene is intentionally empty (GameScene owns all chrome)
- Drawable area: y from 60 to `GAME_HEIGHT - 52` (skips header/footer)

## Controls

- **Click / tap** anywhere on the board to place a dot in your color

## What changed this turn

- Built the entire game from scratch (was a blank placeholder)
- Wired up `Unboxy.init()` in `main.ts` with exported `unboxyReady` promise
- Implemented full multiplayer flow: auth check, joinOrCreate, live events, state sync, graceful fallbacks
- Drew polished visual design: gradient background, grid, drawn dots with highlights, burst effects, color indicator
