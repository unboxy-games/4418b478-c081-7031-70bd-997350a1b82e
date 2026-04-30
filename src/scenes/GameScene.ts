import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';

type TColor = 0 | 1 | 2 | 3; // green, yellow, blue, brown

const PALETTE = [
  { base: 0x5c8f3a, light: 0x7ab854, shadow: 0x3d6024 },
  { base: 0xc9a02a, light: 0xefc04a, shadow: 0x8a6a10 },
  { base: 0x3a65b0, light: 0x5a8ad5, shadow: 0x243f80 },
  { base: 0xb05820, light: 0xd07840, shadow: 0x703810 },
];

interface TileData {
  col: number; row: number; color: TColor;
  container: Phaser.GameObjects.Container;
  idleTween?: Phaser.Tweens.Tween;
}

// Describes one tile's movement in a single slide action
interface TileMove {
  tile: TileData;
  toCol: number;
  toRow: number;
  eliminated: boolean;
  partner?: TileData; // the same-color tile it collides with
}

interface Level {
  cols: number; rows: number; maxMoves: number;
  tiles: { col: number; row: number; color: TColor }[];
}

const LEVELS: Level[] = [
  // 1 — Tutorial: 4×4, 2 pairs
  { cols: 4, rows: 4, maxMoves: 4, tiles: [
    { col: 0, row: 0, color: 0 }, { col: 3, row: 0, color: 0 },
    { col: 1, row: 2, color: 2 }, { col: 1, row: 3, color: 2 },
  ]},
  // 2 — 4×4, 3 pairs
  { cols: 4, rows: 4, maxMoves: 5, tiles: [
    { col: 0, row: 0, color: 1 }, { col: 3, row: 0, color: 1 },
    { col: 1, row: 1, color: 2 }, { col: 1, row: 2, color: 2 },
    { col: 0, row: 3, color: 0 }, { col: 3, row: 3, color: 0 },
  ]},
  // 3 — 5×5, 4 pairs
  { cols: 5, rows: 5, maxMoves: 6, tiles: [
    { col: 0, row: 0, color: 0 }, { col: 4, row: 0, color: 0 },
    { col: 1, row: 1, color: 1 }, { col: 3, row: 1, color: 1 },
    { col: 2, row: 3, color: 2 }, { col: 2, row: 4, color: 2 },
    { col: 0, row: 4, color: 3 }, { col: 4, row: 4, color: 3 },
  ]},
  // 4 — 5×5, needs 2-step to connect yellow
  { cols: 5, rows: 5, maxMoves: 7, tiles: [
    { col: 0, row: 0, color: 1 }, { col: 2, row: 0, color: 3 },
    { col: 0, row: 2, color: 0 }, { col: 4, row: 2, color: 0 },
    { col: 4, row: 3, color: 1 }, { col: 2, row: 4, color: 3 },
    { col: 0, row: 4, color: 2 }, { col: 4, row: 4, color: 2 },
  ]},
  // 5 — 5×5, blocker must be cleared first
  { cols: 5, rows: 5, maxMoves: 6, tiles: [
    { col: 0, row: 0, color: 0 }, { col: 1, row: 0, color: 2 }, { col: 4, row: 0, color: 0 },
    { col: 1, row: 1, color: 2 },
    { col: 3, row: 2, color: 1 }, { col: 3, row: 3, color: 1 },
    { col: 0, row: 4, color: 3 }, { col: 4, row: 4, color: 3 },
  ]},
  // 6 — 5×5, order matters (clear brown before green can pass)
  { cols: 5, rows: 5, maxMoves: 6, tiles: [
    { col: 0, row: 1, color: 1 }, { col: 3, row: 1, color: 1 },
    { col: 2, row: 2, color: 3 }, { col: 2, row: 3, color: 3 },
    { col: 0, row: 3, color: 0 }, { col: 4, row: 3, color: 0 },
    { col: 1, row: 4, color: 2 }, { col: 3, row: 4, color: 2 },
  ]},
  // 7 — 5×5, 5 pairs (2 brown pairs + green + yellow + blue)
  { cols: 5, rows: 5, maxMoves: 7, tiles: [
    { col: 0, row: 0, color: 3 }, { col: 4, row: 0, color: 3 },
    { col: 2, row: 1, color: 0 }, { col: 2, row: 4, color: 0 },
    { col: 0, row: 2, color: 1 }, { col: 4, row: 2, color: 1 },
    { col: 1, row: 2, color: 3 }, { col: 3, row: 2, color: 3 },
    { col: 0, row: 4, color: 2 }, { col: 4, row: 4, color: 2 },
  ]},
  // 8 — 5×6, 4 pairs spread vertically
  { cols: 5, rows: 6, maxMoves: 7, tiles: [
    { col: 1, row: 0, color: 0 }, { col: 3, row: 0, color: 0 },
    { col: 0, row: 1, color: 2 }, { col: 4, row: 1, color: 2 },
    { col: 2, row: 2, color: 3 }, { col: 2, row: 4, color: 3 },
    { col: 0, row: 5, color: 1 }, { col: 4, row: 5, color: 1 },
  ]},
  // 9 — 6×6, 5 pairs (2 yellow pairs)
  { cols: 6, rows: 6, maxMoves: 9, tiles: [
    { col: 0, row: 0, color: 0 }, { col: 5, row: 0, color: 0 },
    { col: 1, row: 1, color: 1 }, { col: 4, row: 1, color: 1 },
    { col: 2, row: 2, color: 2 }, { col: 2, row: 4, color: 2 },
    { col: 3, row: 2, color: 3 }, { col: 3, row: 4, color: 3 },
    { col: 0, row: 5, color: 1 }, { col: 5, row: 5, color: 1 },
  ]},
  // 10 — 6×6, 6 pairs, final challenge (clear blockers to unlock paths)
  { cols: 6, rows: 6, maxMoves: 10, tiles: [
    { col: 0, row: 0, color: 3 }, { col: 5, row: 0, color: 3 },
    { col: 2, row: 0, color: 0 }, { col: 2, row: 5, color: 0 },
    { col: 3, row: 0, color: 2 }, { col: 3, row: 5, color: 2 },
    { col: 0, row: 2, color: 1 }, { col: 5, row: 2, color: 1 },
    { col: 1, row: 3, color: 0 }, { col: 4, row: 3, color: 0 },
    { col: 0, row: 5, color: 2 }, { col: 5, row: 5, color: 2 },
  ]},
];

export class GameScene extends Phaser.Scene {
  private grid: (TileData | null)[][] = [];
  private movesLeft = 0;
  private levelIdx = 0;
  private locked = false;
  private tileSize = 110;
  private gap = 6;
  private boardX = 0;
  private boardY = 0;
  private cols = 0;
  private rows = 0;
  private movesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private levelObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() { super({ key: 'GameScene' }); }

  create(): void {
    // Resolve level from registry (set during next-level / restart transitions)
    if (this.registry.has('currentLevel')) {
      this.levelIdx = this.registry.get('currentLevel') as number;
    }

    this.drawBackground();
    this.setupHUD();
    this.setupBottomBar();
    this.setupKeyboard();
    this.setupSwipe();
    this.loadLevel(this.levelIdx);

    // On very first boot, check Unboxy saves for progress
    if (!this.registry.has('currentLevel')) {
      this.checkSavedProgress();
    }
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x142e0f);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Soft vignette layers
    g.fillStyle(0x2d5a1e, 0.55);
    g.fillRect(40, 40, GAME_WIDTH - 80, GAME_HEIGHT - 80);
    g.fillStyle(0x3a7020, 0.3);
    g.fillRect(100, 100, GAME_WIDTH - 200, GAME_HEIGHT - 200);

    // Bokeh dots
    const rng = new Phaser.Math.RandomDataGenerator(['foliage']);
    const dotCols = [0x4a8a2a, 0x5aaa30, 0x3a6a1a, 0x6aaa40, 0x2a5a10];
    for (let i = 0; i < 32; i++) {
      const x = rng.between(10, GAME_WIDTH - 10);
      const y = rng.between(10, GAME_HEIGHT - 10);
      const r = rng.between(6, 28);
      g.fillStyle(dotCols[i % dotCols.length], rng.realInRange(0.04, 0.18));
      g.fillCircle(x, y, r);
    }
    // Small daisy-like dots
    for (let i = 0; i < 14; i++) {
      const x = rng.between(25, GAME_WIDTH - 25);
      const y = rng.between(25, GAME_HEIGHT - 25);
      g.fillStyle(0xddeea0, 0.12);
      g.fillCircle(x, y, 3.5);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        g.fillCircle(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 2.2);
      }
    }
  }

  // ─── HUD ────────────────────────────────────────────────────────────────────

  private setupHUD(): void {
    this.add.text(GAME_WIDTH / 2, 58, '碰碰消', {
      fontSize: '52px', color: '#d8e890', fontStyle: 'bold',
      stroke: '#1e3a0a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(10);

    this.levelText = this.add.text(GAME_WIDTH / 2, 120, '', {
      fontSize: '22px', color: '#b8d070', stroke: '#1e3a0a', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // Moves pill background (fixed width)
    const moveBg = this.add.graphics().setDepth(10);
    moveBg.fillStyle(0x1e3a0a, 0.75);
    moveBg.fillRoundedRect(GAME_WIDTH / 2 - 130, 148, 260, 46, 23);

    this.movesText = this.add.text(GAME_WIDTH / 2, 171, '', {
      fontSize: '20px', color: '#e8f0c0', stroke: '#0f2005', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11);
  }

  // ─── Bottom bar (restart + hint) ────────────────────────────────────────────

  private setupBottomBar(): void {
    const cx = GAME_WIDTH / 2;
    const btnY = GAME_HEIGHT - 76;
    const s = 58;

    // Restart button
    const bg = this.add.graphics().setDepth(10);
    bg.fillStyle(0x1e3a0a, 0.85);
    bg.fillRoundedRect(cx - s / 2, btnY - s / 2, s, s, 13);
    bg.lineStyle(2, 0x5a9a3a, 0.9);
    bg.strokeRoundedRect(cx - s / 2, btnY - s / 2, s, s, 13);
    this.add.text(cx, btnY, '↺', { fontSize: '26px', color: '#c8d880' }).setOrigin(0.5).setDepth(11);
    this.add.zone(cx, btnY, s, s).setDepth(12).setInteractive()
      .on('pointerdown', () => {
        this.tweens.add({ targets: bg, alpha: 0.4, duration: 80, yoyo: true });
        this.time.delayedCall(160, () => this.restartLevel());
      });

    // Hint text
    this.add.text(cx, GAME_HEIGHT - 30, 'Swipe or press ↑↓←→ to move all tiles', {
      fontSize: '16px', color: '#7aaa50', alpha: 0.75,
    }).setOrigin(0.5).setDepth(10).setAlpha(0.65);
  }

  // ─── Keyboard (desktop) ──────────────────────────────────────────────────────
  // Uses window.addEventListener so it works regardless of canvas focus,
  // which is critical inside iframes and embedded players.

  private setupKeyboard(): void {
    const DIRS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right',
    };

    const handler = (e: KeyboardEvent) => {
      const dir = DIRS[e.key];
      if (!dir) return;
      e.preventDefault(); // stop arrow keys scrolling the page
      this.slide(dir);
    };

    window.addEventListener('keydown', handler);
    // Clean up when scene shuts down (restart, transition, etc.)
    this.events.once('shutdown', () => window.removeEventListener('keydown', handler));
  }

  // ─── Swipe (touch / mouse drag) ──────────────────────────────────────────────

  private setupSwipe(): void {
    let startX = 0, startY = 0;

    const onDown = (p: Phaser.Input.Pointer) => {
      startX = p.x;
      startY = p.y;
    };

    const onUp = (p: Phaser.Input.Pointer) => {
      if (this.locked) return;
      const dx = p.x - startX;
      const dy = p.y - startY;
      const dist = Math.hypot(dx, dy);
      if (dist < 40) return; // too small — treat as tap, not swipe
      if (Math.abs(dx) > Math.abs(dy)) {
        this.slide(dx > 0 ? 'right' : 'left');
      } else {
        this.slide(dy > 0 ? 'down' : 'up');
      }
    };

    this.input.on('pointerdown', onDown);
    this.input.on('pointerup', onUp);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', onDown);
      this.input.off('pointerup', onUp);
    });
  }

  // ─── Level loading ───────────────────────────────────────────────────────────

  private loadLevel(idx: number): void {
    // Clear previous level objects
    this.levelObjects.forEach(o => o.destroy());
    this.levelObjects = [];
    this.grid.forEach(row => row.forEach(t => { if (t) { t.idleTween?.stop(); t.container.destroy(); } }));
    this.grid = [];
    this.selected = null;
    this.locked = false;

    const level = LEVELS[idx];
    this.cols = level.cols;
    this.rows = level.rows;
    this.movesLeft = level.maxMoves;

    // Compute tile size — board sits between HUD (y≈210) and bottom bar (y≈GAME_HEIGHT-130)
    const PAD = 18, GAP = 6;
    const availW = GAME_WIDTH - 80;
    const topY = 210, botY = GAME_HEIGHT - 130;
    const availH = botY - topY;
    const szW = Math.floor((availW - (this.cols - 1) * GAP - PAD * 2) / this.cols);
    const szH = Math.floor((availH - (this.rows - 1) * GAP - PAD * 2) / this.rows);
    this.tileSize = Math.min(130, szW, szH);
    this.gap = GAP;

    const boardW = this.cols * this.tileSize + (this.cols - 1) * GAP + PAD * 2;
    const boardH = this.rows * this.tileSize + (this.rows - 1) * GAP + PAD * 2;
    this.boardX = (GAME_WIDTH - boardW) / 2 + PAD;
    // Vertically center between topY and botY
    this.boardY = topY + (availH - boardH) / 2 + PAD;

    // Board background
    const boardGfx = this.add.graphics().setDepth(1);
    boardGfx.fillStyle(0x7a6030, 0.45);
    boardGfx.fillRoundedRect(this.boardX - PAD + 6, this.boardY - PAD + 7, boardW, boardH, 18);
    boardGfx.fillStyle(0xd8c090);
    boardGfx.fillRoundedRect(this.boardX - PAD, this.boardY - PAD, boardW, boardH, 18);
    boardGfx.fillStyle(0xc8b07a);
    boardGfx.fillRoundedRect(this.boardX - PAD + 4, this.boardY - PAD + 4, boardW - 8, boardH - 8, 15);
    this.levelObjects.push(boardGfx);

    // Empty slot indicators
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const sg = this.add.graphics().setDepth(2);
        sg.fillStyle(0xb09060, 0.4);
        sg.fillRoundedRect(this.tileX(c), this.tileY(r), this.tileSize, this.tileSize, 9);
        this.levelObjects.push(sg);
      }
    }

    // Init grid and create tiles
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    level.tiles.forEach(({ col, row, color }) => {
      const tile = this.createTile(col, row, color as TColor);
      this.grid[row][col] = tile;
    });

    this.updateHUD();
  }

  // ─── Tile creation ───────────────────────────────────────────────────────────

  private createTile(col: number, row: number, color: TColor): TileData {
    const s = this.tileSize;
    const container = this.add.container(this.tileX(col), this.tileY(row)).setDepth(3);

    const g = this.add.graphics();
    const p = PALETTE[color];

    // Shadow
    g.fillStyle(0x4a3008, 0.38);
    g.fillRoundedRect(5, 7, s, s, 10);
    // Base face
    g.fillStyle(p.base);
    g.fillRoundedRect(0, 0, s, s, 10);
    // Top highlight
    g.fillStyle(p.light, 0.42);
    g.fillRoundedRect(3, 3, s - 6, Math.floor(s * 0.33), { tl: 8, tr: 8, bl: 0, br: 0 });
    // Bottom shadow
    g.fillStyle(p.shadow, 0.28);
    g.fillRoundedRect(3, Math.floor(s * 0.67), s - 6, Math.floor(s * 0.30), { tl: 0, tr: 0, bl: 8, br: 8 });

    // Symbol
    const cx = s / 2, cy = s / 2, sr = s * 0.19;
    if (color === 0) {
      // Green: embossed square with highlight
      g.fillStyle(p.shadow);
      g.fillRoundedRect(cx - sr, cy - sr, sr * 2, sr * 2, sr * 0.5);
      g.fillStyle(p.light, 0.55);
      g.fillRoundedRect(cx - sr * 0.65, cy - sr * 0.85, sr * 1.3, sr * 0.65, sr * 0.3);
    } else if (color === 1) {
      // Yellow: nested squares (like screenshot)
      g.fillStyle(p.shadow);
      g.fillRoundedRect(cx - sr * 1.1, cy - sr * 1.1, sr * 2.2, sr * 2.2, 4);
      g.fillStyle(p.base);
      g.fillRoundedRect(cx - sr * 0.75, cy - sr * 0.75, sr * 1.5, sr * 1.5, 3);
      g.fillStyle(p.shadow);
      g.fillRoundedRect(cx - sr * 0.45, cy - sr * 0.45, sr * 0.9, sr * 0.9, 2);
    } else if (color === 2) {
      // Blue: circle with gloss (like screenshot)
      g.fillStyle(p.shadow);
      g.fillCircle(cx, cy + 1.5, sr + 2.5);
      g.fillStyle(0x1a3568);
      g.fillCircle(cx, cy, sr + 1);
      g.fillStyle(0x90baf0, 0.45);
      g.fillCircle(cx - sr * 0.32, cy - sr * 0.32, sr * 0.38);
    } else {
      // Brown: hourglass / X (like screenshot)
      g.fillStyle(p.shadow);
      const hw = sr * 0.6;
      g.fillTriangle(cx - hw - 2, cy - sr - 2, cx + hw + 2, cy - sr - 2, cx, cy + 2);
      g.fillTriangle(cx - hw - 2, cy + sr + 2, cx + hw + 2, cy + sr + 2, cx, cy - 2);
      g.fillStyle(0x3a1005);
      g.fillTriangle(cx - hw, cy - sr, cx + hw, cy - sr, cx, cy);
      g.fillTriangle(cx - hw, cy + sr, cx + hw, cy + sr, cx, cy);
    }

    container.add(g);

    const tile: TileData = { col, row, color, container };

    // Gentle idle bob
    const delay = Math.random() * 1400;
    tile.idleTween = this.tweens.add({
      targets: container,
      y: container.y - 4,
      duration: 1100 + Math.random() * 500,
      ease: 'Sine.easeInOut',
      yoyo: true, repeat: -1, delay,
    });

    return tile;
  }

  // ─── Slide logic — ALL tiles move simultaneously ──────────────────────────────

  private slide(dir: 'up' | 'down' | 'left' | 'right'): void {
    if (this.locked) return;
    const moves = this.computeAllSlides(dir);
    if (moves.length === 0) return; // nothing would move — don't spend a move

    this.locked = true;
    this.movesLeft--;
    this.updateHUD();
    this.executeAllSlides(moves);
  }

  // Compute where every tile ends up after a full-board slide.
  // Uses a sequential simulation processed from the direction-wall side so that
  // tiles further back can slide into the space left by eliminated pairs.
  private computeAllSlides(dir: 'up' | 'down' | 'left' | 'right'): TileMove[] {
    // Working copy of the grid — mutated during simulation
    const tmp: (TileData | null)[][] = this.grid.map(r => [...r]);
    const eliminated = new Set<TileData>();
    const moves = new Map<TileData, TileMove>();

    const dc = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    const dr = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;

    // Process tiles closest to the direction wall first so they "claim" space first
    const ordered: TileData[] = [];
    if (dir === 'right') {
      for (let c = this.cols - 1; c >= 0; c--)
        for (let r = 0; r < this.rows; r++)
          if (tmp[r][c]) ordered.push(tmp[r][c]!);
    } else if (dir === 'left') {
      for (let c = 0; c < this.cols; c++)
        for (let r = 0; r < this.rows; r++)
          if (tmp[r][c]) ordered.push(tmp[r][c]!);
    } else if (dir === 'down') {
      for (let r = this.rows - 1; r >= 0; r--)
        for (let c = 0; c < this.cols; c++)
          if (tmp[r][c]) ordered.push(tmp[r][c]!);
    } else {
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++)
          if (tmp[r][c]) ordered.push(tmp[r][c]!);
    }

    for (const tile of ordered) {
      if (eliminated.has(tile)) continue;
      const { col, row } = tile;
      tmp[row][col] = null; // vacate current cell

      // Slide tile as far as possible in the direction
      let c = col, r = row;
      let hitTile: TileData | null = null;
      while (true) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) break;
        if (tmp[nr][nc] !== null) { hitTile = tmp[nr][nc]; break; }
        c = nc; r = nr;
      }

      if (hitTile && hitTile.color === tile.color && !eliminated.has(hitTile)) {
        // Same-color collision → both eliminated
        eliminated.add(tile);
        eliminated.add(hitTile);
        tmp[hitTile.row][hitTile.col] = null;
        // The moving tile slides TO the partner's position for animation
        moves.set(tile, { tile, toCol: hitTile.col, toRow: hitTile.row, eliminated: true, partner: hitTile });
        moves.set(hitTile, { tile: hitTile, toCol: hitTile.col, toRow: hitTile.row, eliminated: true, partner: tile });
      } else {
        // Place tile at destination
        tmp[r][c] = tile;
        moves.set(tile, { tile, toCol: c, toRow: r, eliminated: false });
      }
    }

    // Return only tiles that actually need animation (moved or eliminated)
    return Array.from(moves.values()).filter(
      m => m.eliminated || m.toCol !== m.tile.col || m.toRow !== m.tile.row
    );
  }

  // Animate all moves simultaneously, then pop eliminated pairs and update grid.
  private executeAllSlides(moves: TileMove[]): void {
    // Clear every moving tile from its current grid position
    moves.forEach(m => { this.grid[m.tile.row][m.tile.col] = null; });

    // Stop idle tweens and snap Y to grid base (bob offset)
    moves.forEach(m => {
      m.tile.idleTween?.stop();
      m.tile.container.y = this.tileY(m.tile.row);
    });

    let done = 0;
    const total = moves.length;

    const onAllAnimated = () => {
      // Pop eliminated pairs
      const seenPairs = new Set<TileData>();
      moves.filter(m => m.eliminated).forEach(m => {
        if (seenPairs.has(m.tile)) return;
        seenPairs.add(m.tile);
        if (m.partner) seenPairs.add(m.partner);
        const px = this.tileX(m.toCol) + this.tileSize / 2;
        const py = this.tileY(m.toRow) + this.tileSize / 2;
        this.popEffect(px, py, PALETTE[m.tile.color].light);
        this.popTile(m.tile);
        if (m.partner) this.popTile(m.partner);
      });

      // Settle surviving tiles into their new grid positions
      moves.filter(m => !m.eliminated).forEach(m => {
        m.tile.col = m.toCol;
        m.tile.row = m.toRow;
        m.tile.container.x = this.tileX(m.toCol);
        m.tile.container.y = this.tileY(m.toRow);
        this.grid[m.toRow][m.toCol] = m.tile;
        m.tile.idleTween = this.tweens.add({
          targets: m.tile.container,
          y: m.tile.container.y - 4,
          duration: 1100, ease: 'Sine.easeInOut',
          yoyo: true, repeat: -1,
        });
      });

      const hasEliminations = moves.some(m => m.eliminated);
      this.time.delayedCall(hasEliminations ? 320 : 0, () => {
        this.locked = false;
        this.checkEndCondition();
      });
    };

    // Animate all tiles simultaneously
    moves.forEach(m => {
      this.tweens.add({
        targets: m.tile.container,
        x: this.tileX(m.toCol),
        y: this.tileY(m.toRow),
        duration: 190,
        ease: 'Cubic.easeOut',
        onComplete: () => { if (++done === total) onAllAnimated(); },
      });
    });
  }

  private popTile(tile: TileData): void {
    tile.idleTween?.stop();
    this.tweens.add({
      targets: tile.container,
      scaleX: 1.35, scaleY: 1.35, alpha: 0,
      duration: 270, ease: 'Cubic.easeOut',
      onComplete: () => tile.container.destroy(),
    });
  }

  private popEffect(x: number, y: number, color: number): void {
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      const dist = 38 + Math.random() * 42;
      const dot = this.add.circle(x, y, 4 + Math.random() * 5, color, 1).setDepth(7);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0, scaleX: 0.1, scaleY: 0.1,
        duration: 380 + Math.random() * 180,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0.13).setDepth(20);
    this.tweens.add({ targets: flash, alpha: 0, duration: 130, onComplete: () => flash.destroy() });
  }

  // ─── Win / Lose ──────────────────────────────────────────────────────────────

  private checkEndCondition(): void {
    const anyLeft = this.grid.some(r => r.some(t => t !== null));
    if (!anyLeft) {
      this.showResult(true);
    } else if (this.movesLeft <= 0) {
      this.showResult(false);
    }
  }

  private showResult(won: boolean): void {
    this.locked = true;

    if (won) {
      // Advance level in registry + persist
      const next = Math.min(this.levelIdx + 1, LEVELS.length - 1);
      const saveIdx = this.levelIdx < LEVELS.length - 1 ? next : 0;
      this.registry.set('currentLevel', saveIdx);
      unboxyReady.then(u => u?.saves.set('progress', saveIdx).catch(() => {})).catch(() => {});
    }

    const ov = this.add.graphics().setDepth(200);
    ov.fillStyle(0x000000, 0.55);
    ov.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ov.setAlpha(0);
    this.tweens.add({ targets: ov, alpha: 1, duration: 300 });

    const panelX = GAME_WIDTH / 2 - 190;
    const panelY = GAME_HEIGHT / 2 - 120;
    const panel = this.add.graphics().setDepth(201);
    panel.fillStyle(0x1a3808, 0.96);
    panel.fillRoundedRect(panelX, panelY, 380, 240, 22);
    panel.lineStyle(3, 0x7acc40, 0.9);
    panel.strokeRoundedRect(panelX, panelY, 380, 240, 22);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, duration: 300 });

    const titleTxt = won
      ? (this.levelIdx < LEVELS.length - 1 ? '✨ 关卡通过！' : '🏆 全部通关！')
      : '😔 再试一次';
    const title = this.add.text(GAME_WIDTH / 2, panelY + 68, titleTxt, {
      fontSize: '36px', color: won ? '#d8f060' : '#f09060', fontStyle: 'bold',
      stroke: '#0a1e04', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(202).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: panelY + 62, duration: 420, ease: 'Back.easeOut' });

    const sub = this.add.text(GAME_WIDTH / 2, panelY + 120,
      won ? `第 ${this.levelIdx + 1} / ${LEVELS.length} 关` : `剩余 ${this.movesLeft} 步时卡关`, {
        fontSize: '20px', color: '#b8d090',
      }).setOrigin(0.5).setDepth(202).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 320, delay: 120 });

    // Button
    const btnY = panelY + 188;
    const btnG = this.add.graphics().setDepth(202);
    btnG.fillStyle(0x4a8a28);
    btnG.fillRoundedRect(GAME_WIDTH / 2 - 110, btnY - 26, 220, 52, 14);
    btnG.lineStyle(2, 0x8acc50);
    btnG.strokeRoundedRect(GAME_WIDTH / 2 - 110, btnY - 26, 220, 52, 14);
    btnG.setAlpha(0);
    this.tweens.add({ targets: btnG, alpha: 1, duration: 320, delay: 180 });

    const btnLbl = won
      ? (this.levelIdx < LEVELS.length - 1 ? '下一关 →' : '重新开始')
      : '重试 ↺';
    const btnTxt = this.add.text(GAME_WIDTH / 2, btnY, btnLbl, {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(203).setAlpha(0);
    this.tweens.add({ targets: btnTxt, alpha: 1, duration: 320, delay: 200 });

    this.add.zone(GAME_WIDTH / 2, btnY, 220, 52).setDepth(204).setInteractive()
      .on('pointerdown', () => {
        this.tweens.add({ targets: [btnG, btnTxt], scaleX: 0.93, scaleY: 0.93, duration: 70, yoyo: true,
          onComplete: () => this.scene.restart() });
      });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private restartLevel(): void {
    // Keep current level in registry
    this.registry.set('currentLevel', this.levelIdx);
    this.scene.restart();
  }

  private updateHUD(): void {
    this.levelText.setText(`Level ${this.levelIdx + 1} / ${LEVELS.length}`);
    this.movesText.setText(`还剩 ${this.movesLeft} 步可走`);
    if (this.movesLeft <= 2) {
      this.tweens.add({ targets: this.movesText, scaleX: 1.18, scaleY: 1.18, duration: 90, yoyo: true });
    }
  }

  private tileX(col: number): number {
    return this.boardX + col * (this.tileSize + this.gap);
  }

  private tileY(row: number): number {
    return this.boardY + row * (this.tileSize + this.gap);
  }

  private async checkSavedProgress(): Promise<void> {
    try {
      const unboxy = await unboxyReady;
      if (unboxy) {
        const saved = await unboxy.saves.get<number>('progress').catch(() => null);
        if (typeof saved === 'number' && saved > 0 && saved < LEVELS.length) {
          this.registry.set('currentLevel', saved);
          this.scene.restart();
          return;
        }
      }
    } catch { /* silent */ }
    this.registry.set('currentLevel', 0);
  }

  update(): void {}
}
