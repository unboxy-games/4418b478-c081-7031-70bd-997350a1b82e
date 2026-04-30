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

const TILE_OX = PANEL_X + GRID_PAD + TILE_SIZE / 2; // x-origin of first tile centre
const TILE_OY = PANEL_Y + GRID_PAD + TILE_SIZE / 2; // y-origin of first tile centre

// ─── Colour palettes ─────────────────────────────────────────────────────────
const COLORS = [
  { base: 0x4a8a2e, light: 0x72cc48, dark: 0x2c5a18, shadow: 0x183a0c, inner: 0x3a6e22 }, // moss green
  { base: 0xc8982a, light: 0xecc04a, dark: 0x886a18, shadow: 0x584408, inner: 0xa88020 }, // sandy yellow
  { base: 0x2858a8, light: 0x4888d8, dark: 0x183a78, shadow: 0x0c2448, inner: 0x3878c0 }, // ocean blue
  { base: 0xac4618, light: 0xd87038, dark: 0x6c2c0c, shadow: 0x3c1806, inner: 0x943c14 }, // rust orange
] as const;

const NUM_COLORS = COLORS.length;
const MIN_GROUP = 2;

// ─── Types ───────────────────────────────────────────────────────────────────
interface Cell {
  colorId: number;
  container: Phaser.GameObjects.Container;
}

// ─── Scene ───────────────────────────────────────────────────────────────────
export class GameScene extends Phaser.Scene {
  private grid: (Cell | null)[][] = [];
  private score = 0;
  private highScore = 0;
  private isAnimating = false;
  private scoreText!: Phaser.GameObjects.Text;
  private highScoreText!: Phaser.GameObjects.Text;
  private tilesLeftText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async create(): Promise<void> {
    this.score = 0;
    this.isAnimating = false;

    await this.loadHighScore();
    this.buildParticleTextures();
    this.drawBackground();
    this.drawTitle();
    this.drawGridPanel();
    this.initGrid();
    this.buildHUD();
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.scene.launch('UIScene');
  }

  // ─── Particle texture pre-generation ──────────────────────────────────────

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
    // Dark forest-green gradient
    const bg = this.add.graphics().setDepth(0);
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      const t = y / GAME_HEIGHT;
      const r = Phaser.Math.Linear(0x18, 0x0c, t) | 0;
      const g = Phaser.Math.Linear(0x34, 0x20, t) | 0;
      const b = Phaser.Math.Linear(0x16, 0x0e, t) | 0;
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, y, GAME_WIDTH, 4);
    }

    // Mossy cloud blobs around the border
    const moss = this.add.graphics().setDepth(1);
    const blobs = [
      { x: -40, y: 155, r: 130, a: 0.55 }, { x: 80, y: 105, r: 90, a: 0.40 },
      { x: GAME_WIDTH + 40, y: 165, r: 130, a: 0.55 }, { x: GAME_WIDTH - 70, y: 110, r: 90, a: 0.40 },
      { x: -30, y: 475, r: 115, a: 0.50 }, { x: 45, y: 615, r: 80, a: 0.38 }, { x: -15, y: 755, r: 100, a: 0.46 },
      { x: GAME_WIDTH + 30, y: 485, r: 115, a: 0.50 }, { x: GAME_WIDTH - 40, y: 625, r: 80, a: 0.38 }, { x: GAME_WIDTH + 15, y: 765, r: 100, a: 0.46 },
      { x: -35, y: GAME_HEIGHT - 250, r: 130, a: 0.55 }, { x: 65, y: GAME_HEIGHT - 155, r: 90, a: 0.40 }, { x: 18, y: GAME_HEIGHT - 65, r: 80, a: 0.35 },
      { x: GAME_WIDTH + 35, y: GAME_HEIGHT - 250, r: 130, a: 0.55 }, { x: GAME_WIDTH - 60, y: GAME_HEIGHT - 155, r: 90, a: 0.40 }, { x: GAME_WIDTH - 15, y: GAME_HEIGHT - 65, r: 80, a: 0.35 },
    ];
    for (const b of blobs) {
      moss.fillStyle(0x4a8a28, b.a);
      moss.fillCircle(b.x, b.y, b.r);
      moss.fillStyle(0x60aa30, b.a * 0.5);
      moss.fillCircle(b.x - 18, b.y - 18, b.r * 0.55);
    }

    // Daisy flowers on the border
    for (const p of [
      { x: 42, y: 345 }, { x: 677, y: 315 },
      { x: 36, y: 562 }, { x: 684, y: 592 },
      { x: 50, y: 795 }, { x: 671, y: 815 },
      { x: 58, y: 1062 }, { x: 661, y: 1045 },
    ]) {
      this.drawDaisy(moss, p.x, p.y);
    }
  }

  private drawDaisy(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(0xf0f0e0, 0.72);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillCircle(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 5.5);
    }
    g.fillStyle(0xf0d840, 0.90);
    g.fillCircle(x, y, 5.5);
  }

  // ─── Title ─────────────────────────────────────────────────────────────────

  private drawTitle(): void {
    const title = this.add.text(GAME_WIDTH / 2, 78, 'Bubble Popper', {
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#d4e868',
      stroke: '#1e3810',
      strokeThickness: 5,
      shadow: { offsetX: 2, offsetY: 4, color: '#0c1c06', blur: 6, stroke: true, fill: true },
    }).setOrigin(0.5).setDepth(10);

    this.add.text(GAME_WIDTH / 2, 142, 'tap a group of 2+ to pop!', {
      fontSize: '21px',
      color: '#96bc38',
      stroke: '#182c0c',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);

    this.tweens.add({ targets: title, y: 74, duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ─── Grid panel ────────────────────────────────────────────────────────────

  private drawGridPanel(): void {
    const g = this.add.graphics().setDepth(2);
    // Drop shadow
    g.fillStyle(0x000000, 0.28);
    g.fillRoundedRect(PANEL_X + 6, PANEL_Y + 9, PANEL_W, PANEL_H, 16);
    // Sandy parchment base
    g.fillStyle(0xd0b468, 1);
    g.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 16);
    // Slightly lighter inset
    g.fillStyle(0xdec07c, 0.55);
    g.fillRoundedRect(PANEL_X + 4, PANEL_Y + 4, PANEL_W - 8, PANEL_H - 8, 13);
    // Top highlight
    g.fillStyle(0xecd490, 0.52);
    g.fillRoundedRect(PANEL_X + 7, PANEL_Y + 7, PANEL_W - 14, 12, { tl: 11, tr: 11, bl: 0, br: 0 });
    // Inner border
    g.lineStyle(2, 0x8a6420, 0.40);
    g.strokeRoundedRect(PANEL_X + 3, PANEL_Y + 3, PANEL_W - 6, PANEL_H - 6, 13);
  }

  // ─── Grid init ─────────────────────────────────────────────────────────────

  private initGrid(): void {
    this.grid = Array.from({ length: COLS }, (_, col) =>
      Array.from({ length: ROWS }, (_, row) => {
        const colorId = Phaser.Math.Between(0, NUM_COLORS - 1);
        return { colorId, container: this.createTile(col, row, colorId) };
      })
    );
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
      duration: 1750 + delay % 350,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay,
    });
  }

  // ─── Tile drawing ──────────────────────────────────────────────────────────

  private drawTileGfx(g: Phaser.GameObjects.Graphics, colorId: number): void {
    const c = COLORS[colorId];
    const h = TILE_SIZE / 2;
    const r = 12;

    // Drop shadow
    g.fillStyle(c.shadow, 0.52);
    g.fillRoundedRect(-h + 5, -h + 6, TILE_SIZE, TILE_SIZE, r);

    // Main body
    g.fillStyle(c.base, 1);
    g.fillRoundedRect(-h, -h, TILE_SIZE, TILE_SIZE, r);

    // Top highlight strip
    g.fillStyle(c.light, 0.42);
    g.fillRoundedRect(-h + 3, -h + 3, TILE_SIZE - 6, 15, { tl: r - 2, tr: r - 2, bl: 0, br: 0 });

    // Bottom dark edge
    g.fillStyle(c.dark, 0.32);
    g.fillRoundedRect(-h + 4, h - 11, TILE_SIZE - 8, 9, { tl: 0, tr: 0, bl: r - 2, br: r - 2 });

    // Per-colour inner decoration
    switch (colorId) {
      case 0: this.markGreen(g, h); break;
      case 1: this.markYellow(g, h, c); break;
      case 2: this.markBlue(g, c); break;
      case 3: this.markOrange(g, h, c); break;
    }
  }

  /** Mossy bump tops */
  private markGreen(g: Phaser.GameObjects.Graphics, h: number): void {
    g.fillStyle(0x80d050, 0.68);
    g.fillCircle(-h + 20, -h + 18, 13);
    g.fillCircle(-h + 42, -h + 14, 11);
    g.fillCircle(-h + 63, -h + 18, 12);
    g.fillStyle(0x50a030, 0.48);
    g.fillRect(-h + 8, -h + 18, TILE_SIZE - 16, 9);
  }

  /** Inset picture-frame square */
  private markYellow(g: Phaser.GameObjects.Graphics, h: number, c: typeof COLORS[number]): void {
    const inset = 17;
    g.lineStyle(5, c.dark, 0.62);
    g.strokeRoundedRect(-h + inset, -h + inset, TILE_SIZE - inset * 2, TILE_SIZE - inset * 2, 6);
    g.fillStyle(c.inner, 0.25);
    g.fillRoundedRect(-h + inset + 3, -h + inset + 3, TILE_SIZE - (inset + 3) * 2, TILE_SIZE - (inset + 3) * 2, 4);
  }

  /** Orb / bubble */
  private markBlue(g: Phaser.GameObjects.Graphics, c: typeof COLORS[number]): void {
    g.fillStyle(c.inner, 1);
    g.fillCircle(1, 5, 24);
    g.fillStyle(c.light, 0.52);
    g.fillCircle(-6, -2, 11);
    g.fillStyle(0xffffff, 0.26);
    g.fillCircle(-9, -7, 5);
  }

  /** Hourglass shape */
  private markOrange(g: Phaser.GameObjects.Graphics, h: number, c: typeof COLORS[number]): void {
    const bw = 22, ty = 17;
    g.fillStyle(c.dark, 0.70);
    g.fillTriangle(0, -ty, -bw, -h + ty + 5, bw, -h + ty + 5);
    g.fillTriangle(0, ty, -bw, h - ty - 5, bw, h - ty - 5);
    g.fillStyle(c.dark, 0.42);
    g.fillRect(-5, -ty, 10, ty * 2);
  }

  // ─── HUD ───────────────────────────────────────────────────────────────────

  private buildHUD(): void {
    const y0 = PANEL_Y + PANEL_H + 18;

    this.add.text(PANEL_X + 4, y0, 'SCORE', {
      fontSize: '15px', fontStyle: 'bold', color: '#96bc38', stroke: '#182c0c', strokeThickness: 2,
    }).setDepth(10);
    this.scoreText = this.add.text(PANEL_X + 4, y0 + 20, '0', {
      fontSize: '40px', fontStyle: 'bold', color: '#d4e868', stroke: '#182c0c', strokeThickness: 3,
    }).setDepth(10);

    this.add.text(PANEL_X + PANEL_W, y0, 'BEST', {
      fontSize: '15px', fontStyle: 'bold', color: '#c0982a', stroke: '#182c0c', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(10);
    this.highScoreText = this.add.text(PANEL_X + PANEL_W, y0 + 20, `${this.highScore}`, {
      fontSize: '40px', fontStyle: 'bold', color: '#e8c040', stroke: '#182c0c', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(10);

    this.tilesLeftText = this.add.text(GAME_WIDTH / 2, y0 + 68, '', {
      fontSize: '19px', color: '#b8d848', stroke: '#182c0c', strokeThickness: 2, align: 'center',
    }).setOrigin(0.5).setDepth(10);

    this.refreshHUD();
  }

  private refreshHUD(): void {
    this.scoreText?.setText(`${this.score}`);
    this.highScoreText?.setText(`${this.highScore}`);
    const remaining = this.grid.flat().filter(Boolean).length;
    this.tilesLeftText?.setText(remaining === 0 ? 'Board cleared!' : `${remaining} tiles left`);
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
        visited.add(key);
        queue.push({ col: nc, row: nr });
      }
    }
    return result;
  }

  // ─── Pop ───────────────────────────────────────────────────────────────────

  private popGroup(group: Array<{ col: number; row: number }>): void {
    this.isAnimating = true;

    const pts = group.length * group.length;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }

    // Floating score label centred on group
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
        targets: cell.container,
        scaleX: 0, scaleY: 0, alpha: 0,
        duration: 175, ease: 'Back.easeIn',
        onComplete: () => {
          cell.container.destroy();
          if (++done === group.length) this.time.delayedCall(55, () => this.applyGravity());
        },
      });
    }

    this.refreshHUD();
  }

  private spawnScoreLabel(pts: number, x: number, y: number): void {
    const big = pts >= 16;
    const t = this.add.text(x, y, `+${pts}`, {
      fontSize: big ? '46px' : '30px',
      fontStyle: 'bold',
      color: big ? '#f8e050' : '#ffffff',
      stroke: '#182c0c',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: t, y: y - 90, alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy(),
    });
  }

  private burstParticles(x: number, y: number, colorId: number): void {
    const color = COLORS[colorId].light;
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 65 + Math.random() * 125;
      const size = 4 + Math.random() * 5;
      const g = this.add.graphics().setPosition(x, y).setDepth(15);
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, size);
      this.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0, scaleX: 0.1, scaleY: 0.1,
        duration: 380 + Math.random() * 280,
        ease: 'Cubic.easeOut',
        onComplete: () => g.destroy(),
      });
    }
  }

  // ─── Gravity ───────────────────────────────────────────────────────────────

  private applyGravity(): void {
    for (let col = 0; col < COLS; col++) {
      // Collect surviving cells bottom-to-top
      const cells: Cell[] = [];
      for (let row = ROWS - 1; row >= 0; row--) {
        if (this.grid[col][row]) { cells.push(this.grid[col][row]!); this.grid[col][row] = null; }
      }
      // Repack from bottom
      let dest = ROWS - 1;
      for (const cell of cells) {
        this.grid[col][dest] = cell;
        const ty = TILE_OY + dest * TILE_STEP;
        this.tweens.killTweensOf(cell.container);
        this.tweens.add({ targets: cell.container, y: ty, duration: 275, ease: 'Bounce.easeOut' });
        dest--;
      }
    }

    // After settle: restart bobs, refresh HUD, check game-over
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
      this.checkGameOver();
    });
  }

  // ─── Game-over ─────────────────────────────────────────────────────────────

  private checkGameOver(): void {
    const remaining = this.grid.flat().filter(Boolean).length;
    if (remaining === 0) { this.showGameOver(true); return; }
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        const c = this.grid[col][row];
        if (c && this.floodFill(col, row, c.colorId).length >= MIN_GROUP) return; // still moves
      }
    }
    this.showGameOver(false);
  }

  private showGameOver(cleared: boolean): void {
    const overlay = this.add.graphics().setDepth(100).setAlpha(0);
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 440 });

    const pw = 560, ph = 390;
    const px = (GAME_WIDTH - pw) / 2, py = (GAME_HEIGHT - ph) / 2;
    const panel = this.add.graphics().setDepth(101).setAlpha(0);
    panel.fillStyle(0x000000, 0.38);
    panel.fillRoundedRect(px + 5, py + 8, pw, ph, 22);
    panel.fillStyle(0x1c3c0e, 1);
    panel.fillRoundedRect(px, py, pw, ph, 22);
    panel.fillStyle(0x2c5a1a, 1);
    panel.fillRoundedRect(px + 4, py + 4, pw - 8, ph - 8, 19);
    panel.fillStyle(0x3a7224, 0.38);
    panel.fillRoundedRect(px + 8, py + 8, pw - 16, 18, { tl: 17, tr: 17, bl: 0, br: 0 });
    this.tweens.add({ targets: panel, alpha: 1, duration: 380, delay: 140 });

    const cx = GAME_WIDTH / 2;
    const heading = cleared ? 'Board Cleared!' : 'No More Moves!';
    const headColor = cleared ? '#f0e030' : '#d4e868';

    const labels: Phaser.GameObjects.Text[] = [
      this.add.text(cx, py + 58, heading, {
        fontSize: '40px', fontStyle: 'bold', color: headColor, stroke: '#0c1c06', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(102).setAlpha(0),
      this.add.text(cx, py + 148, `Score:  ${this.score}`, {
        fontSize: '34px', fontStyle: 'bold', color: '#ffffff', stroke: '#0c1c06', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(102).setAlpha(0),
      this.add.text(cx, py + 204, `Best:  ${this.highScore}`, {
        fontSize: '24px', color: '#e8c040', stroke: '#0c1c06', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(102).setAlpha(0),
    ];
    labels.forEach((t, i) => this.tweens.add({ targets: t, alpha: 1, duration: 380, delay: 280 + i * 75 }));

    // Play again button
    const bx = cx, by = py + ph - 72;
    const btn = this.add.graphics().setPosition(bx, by).setDepth(102).setAlpha(0);
    btn.fillStyle(0x3c7e20, 1);
    btn.fillRoundedRect(-130, -30, 260, 60, 16);
    btn.fillStyle(0x58b030, 0.48);
    btn.fillRoundedRect(-128, -28, 256, 20, { tl: 14, tr: 14, bl: 0, br: 0 });

    const btnTxt = this.add.text(bx, by, 'Play Again', {
      fontSize: '28px', fontStyle: 'bold', color: '#d4f060', stroke: '#0c1c06', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(103).setAlpha(0);

    this.tweens.add({ targets: [btn, btnTxt], alpha: 1, duration: 380, delay: 520 });

    const zone = this.add.zone(bx, by, 260, 60).setInteractive().setDepth(104);
    zone.on('pointerdown', () => this.scene.restart());
    zone.on('pointerover', () => this.tweens.add({ targets: [btn, btnTxt], scaleX: 1.07, scaleY: 1.07, duration: 80 }));
    zone.on('pointerout', () => this.tweens.add({ targets: [btn, btnTxt], scaleX: 1, scaleY: 1, duration: 80 }));
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
