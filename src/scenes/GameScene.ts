import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';

// ─── Layout ──────────────────────────────────────────────────────────────────
const COLS = 7;
const ROWS = 9;
const TILE_SIZE = 78;
const TILE_GAP = 4;
const TILE_STEP = TILE_SIZE + TILE_GAP; // 82
const GRID_PAD = 14;

const PANEL_W = COLS * TILE_STEP - TILE_GAP + GRID_PAD * 2; // 598
const PANEL_H = ROWS * TILE_STEP - TILE_GAP + GRID_PAD * 2; // 762
const PANEL_X = Math.floor((GAME_WIDTH - PANEL_W) / 2);     // 61
const PANEL_Y = 192;

const TILE_OX = PANEL_X + GRID_PAD + TILE_SIZE / 2;
const TILE_OY = PANEL_Y + GRID_PAD + TILE_SIZE / 2;

// ─── Colours ─────────────────────────────────────────────────────────────────
const COLORS = [
  { base: 0x4a8a2e, light: 0x72cc48, dark: 0x2c5a18, shadow: 0x183a0c, inner: 0x3a6e22 }, // 0=green
  { base: 0xc8982a, light: 0xecc04a, dark: 0x886a18, shadow: 0x584408, inner: 0xa88020 }, // 1=yellow
  { base: 0x2858a8, light: 0x4888d8, dark: 0x183a78, shadow: 0x0c2448, inner: 0x3878c0 }, // 2=blue
  { base: 0xac4618, light: 0xd87038, dark: 0x6c2c0c, shadow: 0x3c1806, inner: 0x943c14 }, // 3=orange
] as const;

const NUM_COLORS = COLORS.length;
const MIN_GROUP = 2;

// ─── Level definitions ───────────────────────────────────────────────────────
// cols[c] = array of colorIds from BOTTOM tile (row ROWS-1) upward.
// 0=green  1=yellow  2=blue  3=orange
interface LevelDef {
  maxPops: number;
  cols: number[][]; // cols[c][0] = bottom tile of column c
}

const LEVELS: LevelDef[] = [
  // ── L1 · Tutorial · G split into 2 disconnected groups ────────────────────
  // G-A: cols 0-1 (rows 7-8) │ Y: cols 2-3 │ B: col 4 │ G-B: cols 5-6 (rows 7-8)
  // G-A and G-B are separated by Y+B wall — player must tap G twice.
  // 4 groups · 16 tiles · needs 4 pops → maxPops: 6 (2 spare for tutorial)
  {
    maxPops: 6,
    cols: [
      [0, 0],         // col 0: G-A (rows 7-8)
      [0, 0],         // col 1: G-A (rows 7-8, joined with col 0)
      [1, 1, 1],      // col 2: Y   (rows 6-8)
      [1, 1, 1],      // col 3: Y   (rows 6-8, joined with col 2)
      [2, 2],         // col 4: B   (rows 7-8)
      [0, 0],         // col 5: G-B (rows 7-8, disconnected from G-A)
      [0, 0],         // col 6: G-B (rows 7-8, joined with col 5)
    ],
  },

  // ── L2 · 4 colours · Y split ──────────────────────────────────────────────
  // G, B each one group; Y has 2 separate groups; O one group.
  // 5 groups · 18 tiles · maxPops: 7
  {
    maxPops: 7,
    cols: [
      [0, 0, 0],      // col 0: G (rows 6-8)
      [0, 0, 0],      // col 1: G (rows 6-8, joined)
      [1, 1, 1, 1],   // col 2: Y-A (rows 5-8)
      [2, 2],         // col 3: B (rows 7-8)
      [2, 2],         // col 4: B (rows 7-8, joined)
      [3, 3, 3],      // col 5: O (rows 6-8)
      [1, 1],         // col 6: Y-B (rows 7-8, disconnected: B+O wall between cols 2 and 6)
    ],
  },

  // ── L3 · Gravity merge · B bridge splits G into two halves ────────────────
  // Each of cols 0-1: G(r8-7) · B(r6) · G(r5-4)
  // Brute force: 5 pops (G-lower, B, G-upper, Y, O)
  // With trick:  pop B first → G falls, merges to 8-tile group → only 4 pops
  // maxPops: 5 — brute force barely works, trick gives breathing room
  {
    maxPops: 5,
    cols: [
      [0, 0, 2, 0, 0], // col 0: G(r8-7)+B(r6)+G(r5-4)
      [0, 0, 2, 0, 0], // col 1: same — B group = 2 tiles (cols 0+1 at r6)
      [1, 1, 1],        // col 2: Y (rows 6-8)
      [1, 1, 1],        // col 3: Y (rows 6-8, joined)
      [3, 3, 3],        // col 4: O (rows 6-8)
      [3, 3],           // col 5: O (rows 7-8, joined with col 4)
      [],               // col 6: empty
    ],
  },

  // ── L4 · All 4 colours, each split into 2 disconnected groups ─────────────
  // G-A/G-B, Y-A/Y-B, B-A/B-B, O-A/O-B — strategic ordering required
  // 8 groups · 22 tiles · maxPops: 10
  {
    maxPops: 10,
    cols: [
      [0, 0, 0],      // col 0: G-A (rows 6-8)
      [0, 0, 0],      // col 1: G-A (rows 6-8, joined)
      [1, 1, 1, 1],   // col 2: Y-A (rows 5-8)
      [2, 2, 2],      // col 3: B-A (rows 6-8)
      [3, 3, 3],      // col 4: O-A (rows 6-8)
      [1, 1, 2, 2],   // col 5: Y-B(r8-7=2) + B-B(r6-5=2) — both disconnected from their A-groups
      [3, 3],         // col 6: O-B (rows 7-8, disconnected from O-A by col 5 mixed)
    ],
  },

  // ── L5 · 7 groups · bigger layout ─────────────────────────────────────────
  // G, Y, B each have 2 groups; O has 1 large group — 24 tiles · maxPops: 9
  {
    maxPops: 9,
    cols: [
      [0, 0, 0, 0],    // col 0: G-A (rows 5-8)
      [1, 1, 1, 1],    // col 1: Y-A (rows 5-8)
      [2, 2, 2, 2],    // col 2: B-A (rows 5-8)
      [3, 3, 3, 3],    // col 3: O (rows 5-8, one big group)
      [0, 0, 0],       // col 4: G-B (rows 6-8, disconnected: Y+B+O wall between col 0 and col 4)
      [1, 1, 2, 2, 2], // col 5: Y-B(r8-7=2) + B-B(r6-4=3)
      [],              // col 6: empty
    ],
  },

  // ── L6 · 8 groups · all colours double-split · order matters ──────────────
  // Each colour appears exactly twice, in non-adjacent regions — 24 tiles · maxPops: 10
  {
    maxPops: 10,
    cols: [
      [0, 0, 0, 0],   // col 0: G-A (rows 5-8)
      [1, 1, 1, 1],   // col 1: Y-A (rows 5-8)
      [2, 2, 2, 2],   // col 2: B-A (rows 5-8)
      [3, 3, 3, 3],   // col 3: O-A (rows 5-8)
      [0, 0, 1, 1],   // col 4: G-B(r8-7) + Y-B(r6-5)
      [2, 2, 3, 3],   // col 5: B-B(r8-7) + O-B(r6-5)
      [],             // col 6: empty
    ],
  },

  // ── L7 · Two gravity merges — must use both tricks ────────────────────────
  // Cols 0-1: G-lower(r8-7) · O-bridge(r6) · G-upper(r5-4)
  // Cols 2-3: Y-lower(r8-7) · B-bridge(r6) · Y-upper(r5-4)
  // Brute force: 6 pops (fail!) — need at least one merge trick
  // Both tricks: pop O(2)→G merges, pop B(2)→Y merges, pop G(8)+Y(8) = 4 pops ✓
  // maxPops: 5 — must use ≥1 trick
  {
    maxPops: 5,
    cols: [
      [0, 0, 3, 0, 0], // col 0: G-lower(r8-7)+O-bridge(r6)+G-upper(r5-4)
      [0, 0, 3, 0, 0], // col 1: same — O-bridge = 2 tiles (cols 0+1 at r6)
      [1, 1, 2, 1, 1], // col 2: Y-lower(r8-7)+B-bridge(r6)+Y-upper(r5-4)
      [1, 1, 2, 1, 1], // col 3: same — B-bridge = 2 tiles (cols 2+3 at r6)
      [],              // col 4: empty
      [],              // col 5: empty
      [],              // col 6: empty
    ],
  },

  // ── L8 · Dense layout · 8 groups · 28 tiles ───────────────────────────────
  // Taller columns, tighter move limit — maxPops: 11
  {
    maxPops: 11,
    cols: [
      [0, 0, 0, 0, 0], // col 0: G-A (5)
      [1, 1, 1, 1],    // col 1: Y-A (4)
      [2, 2, 2, 2],    // col 2: B-A (4)
      [3, 3, 3, 3, 3], // col 3: O-A (5)
      [0, 0, 1, 1],    // col 4: G-B(r8-7) + Y-B(r6-5)
      [2, 2, 3, 3],    // col 5: B-B(r8-7) + O-B(r6-5)
      [0, 0],          // col 6: G-C (rows 7-8, 3rd G group adds extra challenge)
    ],
  },

  // ── L9 · Gravity merge + 4-colour split · 28 tiles ────────────────────────
  // Cols 0-1: G-lower/B-bridge/G-upper — like L3 but upper half is 3 tiles taller.
  // Y and O each split into 2 groups; B-bridge counted separately — maxPops: 12
  {
    maxPops: 12,
    cols: [
      [0, 0, 2, 0, 0, 0], // col 0: G-lower(r8-7)+B-bridge(r6)+G-upper(r5-3)
      [0, 0, 2, 0, 0, 0], // col 1: same — B-bridge = 2 tiles (disconnected from col5 B-B)
      [1, 1, 1, 1, 1],    // col 2: Y-A (5, rows4-8)
      [3, 3, 3, 3],       // col 3: O-A (4, rows5-8)
      [2, 2, 2],          // col 4: B-B (3, rows6-8 — B wall separates O-A from O-B)
      [1, 1],             // col 5: Y-B (2, rows7-8 — disconnected from Y-A: O+B wall)
      [3, 3],             // col 6: O-B (2, rows7-8 — disconnected from O-A: B+Y wall)
    ],
  },

  // ── L10 · Final challenge · all 4 colours triple-split · 32 tiles ─────────
  // Every tap requires thought — pop order and gravity merge both matter
  // maxPops: 13
  {
    maxPops: 13,
    cols: [
      [0, 0, 0, 0, 0],    // col 0: G-A (5)
      [1, 1, 1, 1, 1],    // col 1: Y-A (5)
      [2, 2, 2, 2],       // col 2: B-A (4)
      [3, 3, 3, 3],       // col 3: O-A (4)
      [0, 0, 1, 1, 2, 2], // col 4: G-B(r8-7)+Y-B(r6-5)+B-B(r4-3)
      [3, 3, 0, 0],       // col 5: O-B(r8-7)+G-C(r6-5)
      [1, 1, 3, 3],       // col 6: Y-C(r8-7)+O-C(r6-5)
    ],
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────
interface Cell {
  colorId: number;
  container: Phaser.GameObjects.Container;
}

// ─── Scene ───────────────────────────────────────────────────────────────────
export class GameScene extends Phaser.Scene {
  private grid: (Cell | null)[][] = [];
  private currentLevel = 0;
  private popsLeft = 0;
  private score = 0;
  private highScore = 0;
  private isAnimating = false;

  // HUD refs
  private popsLeftText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private tilesLeftText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  init(data?: any): void {
    this.currentLevel = (data as { level?: number })?.level ?? 0;
  }

  async create(): Promise<void> {
    this.score = 0;
    this.isAnimating = false;

    const lvl = LEVELS[this.currentLevel];
    this.popsLeft = lvl.maxPops;

    await this.loadHighScore();
    this.buildParticleTextures();
    this.drawBackground();
    this.drawTitle();
    this.drawGridPanel();
    this.loadLevel();
    this.buildHUD();
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.scene.launch('UIScene');
  }

  // ─── Particle textures ─────────────────────────────────────────────────────

  private buildParticleTextures(): void {
    for (let i = 0; i < NUM_COLORS; i++) {
      const key = `ptcl_${i}`;
      if (this.textures.exists(key)) continue;
      const g = this.add.graphics();
      g.fillStyle(COLORS[i].light, 1);
      g.fillCircle(8, 8, 8);
      g.generateTexture(key, 16, 16);
      g.destroy();
    }
  }

  // ─── Background ────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      const t = y / GAME_HEIGHT;
      const r = Phaser.Math.Linear(0x18, 0x0c, t) | 0;
      const g = Phaser.Math.Linear(0x34, 0x20, t) | 0;
      const b = Phaser.Math.Linear(0x16, 0x0e, t) | 0;
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, y, GAME_WIDTH, 4);
    }

    const moss = this.add.graphics().setDepth(1);
    for (const b of [
      { x: -40, y: 155, r: 130, a: 0.55 }, { x: 80, y: 105, r: 90, a: 0.40 },
      { x: GAME_WIDTH + 40, y: 165, r: 130, a: 0.55 }, { x: GAME_WIDTH - 70, y: 110, r: 90, a: 0.40 },
      { x: -30, y: 475, r: 115, a: 0.50 }, { x: 45, y: 615, r: 80, a: 0.38 }, { x: -15, y: 755, r: 100, a: 0.46 },
      { x: GAME_WIDTH + 30, y: 485, r: 115, a: 0.50 }, { x: GAME_WIDTH - 40, y: 625, r: 80, a: 0.38 }, { x: GAME_WIDTH + 15, y: 765, r: 100, a: 0.46 },
      { x: -35, y: GAME_HEIGHT - 250, r: 130, a: 0.55 }, { x: 65, y: GAME_HEIGHT - 155, r: 90, a: 0.40 }, { x: 18, y: GAME_HEIGHT - 65, r: 80, a: 0.35 },
      { x: GAME_WIDTH + 35, y: GAME_HEIGHT - 250, r: 130, a: 0.55 }, { x: GAME_WIDTH - 60, y: GAME_HEIGHT - 155, r: 90, a: 0.40 }, { x: GAME_WIDTH - 15, y: GAME_HEIGHT - 65, r: 80, a: 0.35 },
    ]) {
      moss.fillStyle(0x4a8a28, b.a); moss.fillCircle(b.x, b.y, b.r);
      moss.fillStyle(0x60aa30, b.a * 0.5); moss.fillCircle(b.x - 18, b.y - 18, b.r * 0.55);
    }
    for (const p of [
      { x: 42, y: 345 }, { x: 677, y: 315 }, { x: 36, y: 562 }, { x: 684, y: 592 },
      { x: 50, y: 795 }, { x: 671, y: 815 }, { x: 58, y: 1062 }, { x: 661, y: 1045 },
    ]) this.drawDaisy(moss, p.x, p.y);
  }

  private drawDaisy(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(0xf0f0e0, 0.72);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillCircle(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 5.5);
    }
    g.fillStyle(0xf0d840, 0.90); g.fillCircle(x, y, 5.5);
  }

  // ─── Title area ────────────────────────────────────────────────────────────

  private drawTitle(): void {
    const title = this.add.text(GAME_WIDTH / 2, 62, 'Bubble Popper', {
      fontSize: '46px', fontStyle: 'bold', color: '#d4e868', stroke: '#1e3810', strokeThickness: 5,
      shadow: { offsetX: 2, offsetY: 4, color: '#0c1c06', blur: 6, stroke: true, fill: true },
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: title, y: 58, duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Level badge
    this.levelText = this.add.text(GAME_WIDTH / 2, 118, this.levelLabel(), {
      fontSize: '22px', fontStyle: 'bold', color: '#f0eca0', stroke: '#1e3810', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);
  }

  private levelLabel(): string {
    return `Level ${this.currentLevel + 1}  /  ${LEVELS.length}`;
  }

  // ─── Grid panel ────────────────────────────────────────────────────────────

  private drawGridPanel(): void {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x000000, 0.28);
    g.fillRoundedRect(PANEL_X + 6, PANEL_Y + 9, PANEL_W, PANEL_H, 16);
    g.fillStyle(0xd0b468, 1);
    g.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 16);
    g.fillStyle(0xdec07c, 0.55);
    g.fillRoundedRect(PANEL_X + 4, PANEL_Y + 4, PANEL_W - 8, PANEL_H - 8, 13);
    g.fillStyle(0xecd490, 0.52);
    g.fillRoundedRect(PANEL_X + 7, PANEL_Y + 7, PANEL_W - 14, 12, { tl: 11, tr: 11, bl: 0, br: 0 });
    g.lineStyle(2, 0x8a6420, 0.40);
    g.strokeRoundedRect(PANEL_X + 3, PANEL_Y + 3, PANEL_W - 6, PANEL_H - 6, 13);
  }

  // ─── Level loading ─────────────────────────────────────────────────────────

  private loadLevel(): void {
    // Destroy any existing tiles
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        this.grid[col]?.[row]?.container.destroy();
      }
    }
    this.grid = Array.from({ length: COLS }, () => Array(ROWS).fill(null));

    const lvl = LEVELS[this.currentLevel];
    for (let col = 0; col < COLS; col++) {
      const stack = lvl.cols[col] ?? [];
      // Place tiles starting from the bottom row (ROWS-1) upward — no floating
      let row = ROWS - 1;
      for (const colorId of stack) {
        if (row < 0) break;
        this.grid[col][row] = { colorId, container: this.createTile(col, row, colorId) };
        row--;
      }
    }
  }

  private createTile(col: number, row: number, colorId: number): Phaser.GameObjects.Container {
    const x = TILE_OX + col * TILE_STEP;
    const y = TILE_OY + row * TILE_STEP;
    const gfx = this.add.graphics();
    this.drawTileGfx(gfx, colorId);
    const container = this.add.container(x, y, [gfx]).setSize(TILE_SIZE, TILE_SIZE).setDepth(3);
    this.startIdleBob(container, col, row);
    return container;
  }

  private startIdleBob(container: Phaser.GameObjects.Container, col: number, row: number): void {
    const y = TILE_OY + row * TILE_STEP;
    const delay = (col * 177 + row * 93) % 1100;
    this.tweens.add({
      targets: container, y: y - 3,
      duration: 1750 + delay % 350, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay,
    });
  }

  // ─── Tile drawing ──────────────────────────────────────────────────────────

  private drawTileGfx(g: Phaser.GameObjects.Graphics, colorId: number): void {
    const c = COLORS[colorId];
    const h = TILE_SIZE / 2;
    const r = 12;
    g.fillStyle(c.shadow, 0.52);
    g.fillRoundedRect(-h + 5, -h + 6, TILE_SIZE, TILE_SIZE, r);
    g.fillStyle(c.base, 1);
    g.fillRoundedRect(-h, -h, TILE_SIZE, TILE_SIZE, r);
    g.fillStyle(c.light, 0.42);
    g.fillRoundedRect(-h + 3, -h + 3, TILE_SIZE - 6, 15, { tl: r - 2, tr: r - 2, bl: 0, br: 0 });
    g.fillStyle(c.dark, 0.32);
    g.fillRoundedRect(-h + 4, h - 11, TILE_SIZE - 8, 9, { tl: 0, tr: 0, bl: r - 2, br: r - 2 });
    switch (colorId) {
      case 0: this.markGreen(g, h); break;
      case 1: this.markYellow(g, h, c); break;
      case 2: this.markBlue(g, c); break;
      case 3: this.markOrange(g, h, c); break;
    }
  }

  private markGreen(g: Phaser.GameObjects.Graphics, h: number): void {
    g.fillStyle(0x80d050, 0.68);
    g.fillCircle(-h + 20, -h + 18, 13); g.fillCircle(-h + 42, -h + 14, 11); g.fillCircle(-h + 63, -h + 18, 12);
    g.fillStyle(0x50a030, 0.48); g.fillRect(-h + 8, -h + 18, TILE_SIZE - 16, 9);
  }

  private markYellow(g: Phaser.GameObjects.Graphics, h: number, c: typeof COLORS[number]): void {
    const inset = 17;
    g.lineStyle(5, c.dark, 0.62);
    g.strokeRoundedRect(-h + inset, -h + inset, TILE_SIZE - inset * 2, TILE_SIZE - inset * 2, 6);
    g.fillStyle(c.inner, 0.25);
    g.fillRoundedRect(-h + inset + 3, -h + inset + 3, TILE_SIZE - (inset + 3) * 2, TILE_SIZE - (inset + 3) * 2, 4);
  }

  private markBlue(g: Phaser.GameObjects.Graphics, c: typeof COLORS[number]): void {
    g.fillStyle(c.inner, 1); g.fillCircle(1, 5, 24);
    g.fillStyle(c.light, 0.52); g.fillCircle(-6, -2, 11);
    g.fillStyle(0xffffff, 0.26); g.fillCircle(-9, -7, 5);
  }

  private markOrange(g: Phaser.GameObjects.Graphics, h: number, c: typeof COLORS[number]): void {
    const bw = 22, ty = 17;
    g.fillStyle(c.dark, 0.70);
    g.fillTriangle(0, -ty, -bw, -h + ty + 5, bw, -h + ty + 5);
    g.fillTriangle(0, ty, -bw, h - ty - 5, bw, h - ty - 5);
    g.fillStyle(c.dark, 0.42); g.fillRect(-5, -ty, 10, ty * 2);
  }

  // ─── HUD ───────────────────────────────────────────────────────────────────

  private buildHUD(): void {
    const hudY = PANEL_Y + PANEL_H + 18;

    // Score (left)
    this.add.text(PANEL_X + 4, hudY, 'SCORE', {
      fontSize: '14px', fontStyle: 'bold', color: '#96bc38', stroke: '#182c0c', strokeThickness: 2,
    }).setDepth(10);
    this.scoreText = this.add.text(PANEL_X + 4, hudY + 18, '0', {
      fontSize: '36px', fontStyle: 'bold', color: '#d4e868', stroke: '#182c0c', strokeThickness: 3,
    }).setDepth(10);

    // Moves left pill (centre)
    this.buildMovesPill(hudY);

    // Tiles left (right — small)
    this.tilesLeftText = this.add.text(PANEL_X + PANEL_W, hudY + 52, '', {
      fontSize: '16px', color: '#b8c890', stroke: '#182c0c', strokeThickness: 2, align: 'right',
    }).setOrigin(1, 0).setDepth(10);

    this.refreshHUD();
  }

  private buildMovesPill(hudY: number): void {
    // Dark pill background
    const pillW = 200, pillH = 72;
    const px = GAME_WIDTH / 2, py = hudY + pillH / 2 + 6;
    const pill = this.add.graphics().setDepth(9);
    pill.fillStyle(0x000000, 0.35);
    pill.fillRoundedRect(-pillW / 2 + 3, -pillH / 2 + 4, pillW, pillH, 36);
    pill.fillStyle(0x1c3c0e, 1);
    pill.fillRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, 36);
    pill.fillStyle(0x2c5a1a, 0.6);
    pill.fillRoundedRect(-pillW / 2 + 3, -pillH / 2 + 3, pillW - 6, 16, { tl: 33, tr: 33, bl: 0, br: 0 });
    pill.setPosition(px, py);

    this.add.text(px, py - 16, 'MOVES LEFT', {
      fontSize: '13px', fontStyle: 'bold', color: '#80b040', stroke: '#0c1e06', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);

    this.popsLeftText = this.add.text(px, py + 12, `${this.popsLeft}`, {
      fontSize: '34px', fontStyle: 'bold', color: '#d4f060', stroke: '#0c1e06', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);
  }

  private refreshHUD(): void {
    this.scoreText?.setText(`${this.score}`);
    this.popsLeftText?.setText(`${this.popsLeft}`);
    // Warn when low on moves
    const isLow = this.popsLeft <= 2;
    this.popsLeftText?.setColor(isLow ? '#ff9040' : '#d4f060');

    const remaining = this.grid.flat().filter(Boolean).length;
    this.tilesLeftText?.setText(`${remaining} tiles`);
  }

  // ─── Input ─────────────────────────────────────────────────────────────────

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isAnimating) return;
    const hit = this.getTileAt(pointer.x, pointer.y);
    if (!hit) return;
    const cell = this.grid[hit.col][hit.row];
    if (!cell) return;
    const group = this.floodFill(hit.col, hit.row, cell.colorId);
    if (group.length < MIN_GROUP) {
      this.cameras.main.shake(70, 0.004);
      return;
    }
    this.popGroup(group);
  }

  private getTileAt(px: number, py: number): { col: number; row: number } | null {
    const half = TILE_SIZE / 2;
    for (let col = 0; col < COLS; col++) {
      const tx = TILE_OX + col * TILE_STEP;
      if (px < tx - half || px > tx + half) continue;
      for (let row = 0; row < ROWS; row++) {
        if (!this.grid[col]?.[row]) continue;
        const ty = TILE_OY + row * TILE_STEP;
        if (py >= ty - half && py <= ty + half) return { col, row };
      }
    }
    return null;
  }

  // ─── Flood fill ────────────────────────────────────────────────────────────

  private floodFill(sc: number, sr: number, colorId: number): Array<{ col: number; row: number }> {
    const visited = new Set<string>();
    const result: Array<{ col: number; row: number }> = [];
    const queue = [{ col: sc, row: sr }];
    visited.add(`${sc},${sr}`);
    while (queue.length) {
      const { col, row } = queue.shift()!;
      result.push({ col, row });
      for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
        const nc = col + dc, nr = row + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const key = `${nc},${nr}`;
        if (visited.has(key)) continue;
        const c = this.grid[nc][nr];
        if (!c || c.colorId !== colorId) continue;
        visited.add(key); queue.push({ col: nc, row: nr });
      }
    }
    return result;
  }

  // ─── Pop ───────────────────────────────────────────────────────────────────

  private popGroup(group: Array<{ col: number; row: number }>): void {
    this.isAnimating = true;
    this.popsLeft--;

    const pts = group.length * group.length;
    this.score += pts;
    if (this.score > this.highScore) { this.highScore = this.score; this.saveHighScore(); }

    const cx = group.reduce((s, g) => s + TILE_OX + g.col * TILE_STEP, 0) / group.length;
    const cy = group.reduce((s, g) => s + TILE_OY + g.row * TILE_STEP, 0) / group.length;
    this.spawnScoreLabel(pts, cx, cy);

    const colorId = this.grid[group[0].col][group[0].row]!.colorId;
    let done = 0;
    for (const { col, row } of group) {
      const cell = this.grid[col][row]!;
      this.grid[col][row] = null;
      this.tweens.killTweensOf(cell.container);
      this.burstParticles(TILE_OX + col * TILE_STEP, TILE_OY + row * TILE_STEP, colorId);
      this.tweens.add({
        targets: cell.container, scaleX: 0, scaleY: 0, alpha: 0,
        duration: 175, ease: 'Back.easeIn',
        onComplete: () => {
          cell.container.destroy();
          if (++done === group.length) this.time.delayedCall(55, () => this.applyGravity());
        },
      });
    }
    this.refreshHUD();

    // Animate pops counter (bounce)
    this.tweens.add({ targets: this.popsLeftText, scaleX: 1.4, scaleY: 1.4, duration: 80, yoyo: true });
  }

  private spawnScoreLabel(pts: number, x: number, y: number): void {
    const big = pts >= 16;
    const t = this.add.text(x, y, `+${pts}`, {
      fontSize: big ? '46px' : '30px', fontStyle: 'bold',
      color: big ? '#f8e050' : '#ffffff', stroke: '#182c0c', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: t, y: y - 90, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private burstParticles(x: number, y: number, colorId: number): void {
    const color = COLORS[colorId].light;
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 65 + Math.random() * 125;
      const g = this.add.graphics().setPosition(x, y).setDepth(15);
      g.fillStyle(color, 1); g.fillCircle(0, 0, 4 + Math.random() * 5);
      this.tweens.add({
        targets: g, x: x + Math.cos(angle) * speed, y: y + Math.sin(angle) * speed,
        alpha: 0, scaleX: 0.1, scaleY: 0.1, duration: 380 + Math.random() * 280,
        ease: 'Cubic.easeOut', onComplete: () => g.destroy(),
      });
    }
  }

  // ─── Gravity ───────────────────────────────────────────────────────────────

  private applyGravity(): void {
    for (let col = 0; col < COLS; col++) {
      const cells: Cell[] = [];
      for (let row = ROWS - 1; row >= 0; row--) {
        if (this.grid[col][row]) { cells.push(this.grid[col][row]!); this.grid[col][row] = null; }
      }
      let dest = ROWS - 1;
      for (const cell of cells) {
        this.grid[col][dest] = cell;
        const ty = TILE_OY + dest * TILE_STEP;
        this.tweens.killTweensOf(cell.container);
        this.tweens.add({ targets: cell.container, y: ty, duration: 275, ease: 'Bounce.easeOut' });
        dest--;
      }
    }
    this.time.delayedCall(415, () => {
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          const cell = this.grid[col][row];
          if (!cell) continue;
          this.tweens.killTweensOf(cell.container);
          this.startIdleBob(cell.container, col, row);
        }
      }
      this.isAnimating = false;
      this.refreshHUD();
      this.checkLevelState();
    });
  }

  // ─── Level state checking ──────────────────────────────────────────────────

  private checkLevelState(): void {
    const remaining = this.grid.flat().filter(Boolean).length;

    // Win: board cleared
    if (remaining === 0) { this.showOverlay('win'); return; }

    // Check if any valid group exists
    let hasMove = false;
    for (let col = 0; col < COLS && !hasMove; col++) {
      for (let row = 0; row < ROWS && !hasMove; row++) {
        const c = this.grid[col][row];
        if (c && this.floodFill(col, row, c.colorId).length >= MIN_GROUP) hasMove = true;
      }
    }

    // Fail: out of moves or no moves left
    if (this.popsLeft <= 0 || !hasMove) { this.showOverlay('fail'); return; }
  }

  // ─── Overlay ───────────────────────────────────────────────────────────────

  private showOverlay(type: 'win' | 'fail'): void {
    const isWin = type === 'win';
    const isLastLevel = this.currentLevel >= LEVELS.length - 1;

    const overlay = this.add.graphics().setDepth(100).setAlpha(0);
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 440 });

    const pw = 560, ph = 420;
    const px = (GAME_WIDTH - pw) / 2, py = (GAME_HEIGHT - ph) / 2;
    const panel = this.add.graphics().setDepth(101).setAlpha(0);
    panel.fillStyle(0x000000, 0.38);
    panel.fillRoundedRect(px + 5, py + 8, pw, ph, 22);
    panel.fillStyle(isWin ? 0x1c3c0e : 0x3c1208, 1);
    panel.fillRoundedRect(px, py, pw, ph, 22);
    panel.fillStyle(isWin ? 0x2c5a1a : 0x5a1c0c, 1);
    panel.fillRoundedRect(px + 4, py + 4, pw - 8, ph - 8, 19);
    panel.fillStyle(isWin ? 0x3a7224 : 0x7a2810, 0.38);
    panel.fillRoundedRect(px + 8, py + 8, pw - 16, 18, { tl: 17, tr: 17, bl: 0, br: 0 });
    this.tweens.add({ targets: panel, alpha: 1, duration: 380, delay: 140 });

    const cx = GAME_WIDTH / 2;
    const heading = isWin
      ? (isLastLevel ? 'All Cleared!' : 'Level Clear!')
      : 'Out of Moves!';
    const headColor = isWin ? '#f0e030' : '#ff8844';

    const remaining = this.grid.flat().filter(Boolean).length;
    const sub = isWin
      ? `Score: ${this.score}  •  Best: ${this.highScore}`
      : `${remaining} tiles remain  •  Score: ${this.score}`;

    const labels: Phaser.GameObjects.Text[] = [
      this.add.text(cx, py + 60, heading, {
        fontSize: '44px', fontStyle: 'bold', color: headColor, stroke: '#0c1c06', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(102).setAlpha(0),
      this.add.text(cx, py + 148, sub, {
        fontSize: '22px', color: '#e0e0c0', stroke: '#0c1c06', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(102).setAlpha(0),
      this.add.text(cx, py + 195, `Level ${this.currentLevel + 1} / ${LEVELS.length}`, {
        fontSize: '20px', color: isWin ? '#a0d040' : '#c07040', stroke: '#0c1c06', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(102).setAlpha(0),
    ];
    labels.forEach((t, i) => this.tweens.add({ targets: t, alpha: 1, duration: 380, delay: 280 + i * 70 }));

    // Star display for wins
    if (isWin) this.drawStars(cx, py + 260);

    // Buttons
    const btnY = py + ph - 68;
    if (isWin && !isLastLevel) {
      this.makeButton(cx - 140, btnY, 'Retry', 190, () => this.scene.restart(), 0x555533);
      this.makeButton(cx + 95, btnY, 'Next Level', 210, () => {
        this.scene.start('GameScene', { level: this.currentLevel + 1 });
      }, 0x3c7e20);
    } else {
      const label = isWin && isLastLevel ? 'Play Again' : 'Try Again';
      this.makeButton(cx, btnY, label, 250, () => this.scene.restart(), isWin ? 0x3c7e20 : 0x7e3c20);
    }
  }

  private drawStars(cx: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 72;
      const star = this.add.graphics().setPosition(sx, y).setDepth(103).setScale(0).setAlpha(0);
      this.drawStarShape(star, 0, 0, 24, 10, 5, 0xf8d030);
      this.drawStarShape(star, -3, -3, 10, 4, 5, 0xfff080);
      this.time.delayedCall(560 + i * 130, () => {
        this.tweens.add({ targets: star, alpha: 1, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });
      });
    }
  }

  /** Draw a star using fan-triangles from centre. */
  private drawStarShape(g: Phaser.GameObjects.Graphics, cx: number, cy: number, outerR: number, innerR: number, points: number, color: number): void {
    g.fillStyle(color, 1);
    const total = points * 2;
    for (let i = 0; i < total; i++) {
      const a0 = (i / total) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / total) * Math.PI * 2 - Math.PI / 2;
      const r0 = i % 2 === 0 ? outerR : innerR;
      const r1 = (i + 1) % 2 === 0 ? outerR : innerR;
      g.fillTriangle(
        cx, cy,
        cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0,
        cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1,
      );
    }
  }

  private makeButton(x: number, y: number, label: string, w: number, action: () => void, color: number): void {
    const btn = this.add.graphics().setPosition(x, y).setDepth(102).setAlpha(0);
    btn.fillStyle(color, 1);
    btn.fillRoundedRect(-w / 2, -28, w, 56, 14);
    btn.fillStyle(0xffffff, 0.14);
    btn.fillRoundedRect(-w / 2 + 2, -26, w - 4, 18, { tl: 12, tr: 12, bl: 0, br: 0 });

    const txt = this.add.text(x, y, label, {
      fontSize: '26px', fontStyle: 'bold', color: '#d4f060', stroke: '#0c1c06', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(103).setAlpha(0);

    this.tweens.add({ targets: [btn, txt], alpha: 1, duration: 380, delay: 560 });

    const zone = this.add.zone(x, y, w, 56).setInteractive().setDepth(104);
    zone.on('pointerdown', action);
    zone.on('pointerover', () => this.tweens.add({ targets: [btn, txt], scaleX: 1.07, scaleY: 1.07, duration: 80 }));
    zone.on('pointerout', () => this.tweens.add({ targets: [btn, txt], scaleX: 1, scaleY: 1, duration: 80 }));
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private async loadHighScore(): Promise<void> {
    try {
      const u = await unboxyReady;
      if (!u) return;
      const hs = await u.saves.get<number>('highScore');
      if (hs != null) this.highScore = hs;
    } catch (e) { console.warn('Load high score failed', e); }
  }

  private async saveHighScore(): Promise<void> {
    try {
      const u = await unboxyReady;
      if (!u) return;
      await u.saves.set('highScore', this.highScore);
    } catch (e) { console.warn('Save high score failed', e); }
  }
}
