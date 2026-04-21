import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Enemy, EnemyType } from '../objects/Enemy';
import { Tower, TowerType, TOWER_CONFIGS } from '../objects/Tower';
import { Projectile } from '../objects/Projectile';

const TILE = 50;
const COLS = 16;
const ROWS = 10;
const PLAY_H = ROWS * TILE; // 500
const AOE_RADIUS = 70;

// Path waypoints (pixel centers)
export const WAYPOINTS: { x: number; y: number }[] = [
  { x: -30,  y: 75  },
  { x: 175,  y: 75  },
  { x: 175,  y: 175 },
  { x: 375,  y: 175 },
  { x: 375,  y: 275 },
  { x: 525,  y: 275 },
  { x: 525,  y: 375 },
  { x: 675,  y: 375 },
  { x: 675,  y: 125 },
  { x: 830,  y: 125 },
];

function buildPathSet(): Set<string> {
  const s = new Set<string>();
  // Row 1: cols 0-3
  for (let c = 0; c <= 3; c++) s.add(`${c},1`);
  // Col 3: rows 1-3
  for (let r = 1; r <= 3; r++) s.add(`3,${r}`);
  // Row 3: cols 3-7
  for (let c = 3; c <= 7; c++) s.add(`${c},3`);
  // Col 7: rows 3-5
  for (let r = 3; r <= 5; r++) s.add(`7,${r}`);
  // Row 5: cols 7-10
  for (let c = 7; c <= 10; c++) s.add(`${c},5`);
  // Col 10: rows 5-7
  for (let r = 5; r <= 7; r++) s.add(`10,${r}`);
  // Row 7: cols 10-13
  for (let c = 10; c <= 13; c++) s.add(`${c},7`);
  // Col 13: rows 2-7 (enemies go UP from row 7 to row 2)
  for (let r = 2; r <= 7; r++) s.add(`13,${r}`);
  // Row 2: cols 13-15 (exit)
  for (let c = 13; c <= 15; c++) s.add(`${c},2`);
  return s;
}

const PATH_SET = buildPathSet();

function buildWave(waveNum: number): EnemyType[] {
  const mice = Math.min(5 + waveNum * 3, 22);
  const bugs = Math.max(0, (waveNum - 1) * 2);
  const birds = Math.max(0, (waveNum - 2) * 3);
  const q: EnemyType[] = [];
  for (let i = 0; i < mice; i++) q.push('mouse');
  for (let i = 0; i < bugs; i++) q.push('bug');
  for (let i = 0; i < birds; i++) q.push('bird');
  // Shuffle
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [q[i], q[j]] = [q[j], q[i]];
  }
  return q;
}

export class GameScene extends Phaser.Scene {
  private lives = 20;
  private gold = 150;
  private score = 0;
  private waveNum = 0;

  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private projectiles: Projectile[] = [];

  // grid[row][col]: null = empty, 'path' = path, TowerType = has tower
  private grid: (string | null)[][] = [];

  private selectedType: TowerType = 'tabby';
  private waveActive = false;
  private gameOver = false;
  private spawnQueue: EnemyType[] = [];
  private spawnTimer = 0;
  private spawnInterval = 1100;

  private countdown = 0;          // ms remaining until auto-start
  private countdownActive = false;
  private readonly COUNTDOWN_MS = 10000;

  private hoverG!: Phaser.GameObjects.Graphics;
  private startBtn!: Phaser.GameObjects.Container;
  private shopBtns: Phaser.GameObjects.Container[] = [];

  private selectedTower: Tower | null = null;
  private sellBtnContainer: Phaser.GameObjects.Container | null = null;
  private _blockNextTileTap = false;

  // ── Multiplayer state ────────────────────────────────────────────────────
  private mpMode = false;
  private mpIsHost = false;
  private mpRoom: any = null;
  private mpSyncTimer = 0;
  private mpCleanupFns: Array<() => void> = [];
  /** Ghost enemies rendered on the guest side (keyed by enemy id). */
  private guestEnemies: Map<number, Enemy> = new Map();
  private myName = 'You';
  private partnerName = 'Partner';

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.lives = 20;
    this.gold = 150;
    this.score = 0;
    this.waveNum = 0;
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.waveActive = false;
    this.gameOver = false;
    this.countdown = 0;
    this.countdownActive = false;
    this.shopBtns = [];

    // Reset multiplayer state from any previous run
    this.mpMode = false;
    this.mpIsHost = false;
    this.mpRoom = null;
    this.mpSyncTimer = 0;
    this.mpCleanupFns = [];
    this.guestEnemies = new Map();

    this.initGrid();
    this.drawBackground();
    this.drawShopPanel();
    this.setupHover();
    this.setupInput();
    this.createStartButton();

    // Listen for enemy kills — only award gold on host/solo
    this.events.on('enemy-killed', (enemy: Enemy) => {
      if (!this.mpMode || this.mpIsHost) {
        this.gold += enemy.gold;
        this.score += enemy.gold * 10;
        this.emitStats();
      }
      this.spawnDeathParticles(enemy.x, enemy.y, enemy.type);
      this.showFloatingText(`+${enemy.gold}g`, enemy.x, enemy.y - 10, '#ffd700');
    });

    this.scene.launch('UIScene');
    this.emitStats();

    // Check for multiplayer data passed from LobbyScene
    const sceneData = this.scene.settings.data as any;
    if (sceneData?.multiplayer === true && sceneData?.room) {
      this.mpMode = true;
      this.mpRoom = sceneData.room;
      this.mpIsHost = sceneData.isHost ?? true;
      this.myName = sceneData.myName ?? 'You';
      this.partnerName = sceneData.partnerName ?? 'Partner';
      this.setupMultiplayer();
    }
  }

  private initGrid(): void {
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    PATH_SET.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        this.grid[r][c] = 'path';
      }
    });
  }

  private drawBackground(): void {
    const bg = this.add.graphics().setDepth(0);

    // Sky gradient
    bg.fillGradientStyle(0x87ceeb, 0x87ceeb, 0xb8e4ff, 0xb8e4ff);
    bg.fillRect(0, 0, GAME_WIDTH, PLAY_H);

    // Grass and path tiles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const px = c * TILE;
        const py = r * TILE;
        const isPath = PATH_SET.has(`${c},${r}`);

        if (!isPath) {
          // Checkerboard grass
          const shade = (r + c) % 2 === 0 ? 0x4ba84b : 0x3d9a3d;
          bg.fillStyle(shade);
          bg.fillRect(px, py, TILE, TILE);
          // Occasional bush/flower
          const seed = (r * 17 + c * 13) % 17;
          if (seed < 3) {
            bg.fillStyle(0x2d7a2d);
            bg.fillCircle(px + 10, py + 10, 5);
            bg.fillCircle(px + 13, py + 8, 4);
          } else if (seed < 5) {
            bg.fillStyle(0xff88aa);
            bg.fillCircle(px + 30, py + 20, 3);
            bg.fillStyle(0xffcc44);
            bg.fillCircle(px + 30, py + 20, 1.5);
          }
        } else {
          // Dirt path
          bg.fillStyle(0xc8a050);
          bg.fillRect(px, py, TILE, TILE);
          // Dirt texture
          bg.fillStyle(0xb89040, 0.45);
          if ((r * 5 + c * 7) % 3 === 0) {
            bg.fillRect(px + 6, py + 6, 10, 7);
            bg.fillRect(px + 28, py + 18, 9, 6);
          }
          if ((r * 3 + c * 11) % 4 === 0) {
            bg.fillRect(px + 18, py + 28, 12, 5);
          }
        }
      }
    }

    // Subtle grid lines
    bg.lineStyle(0.5, 0x000000, 0.08);
    for (let c = 0; c <= COLS; c++) bg.lineBetween(c * TILE, 0, c * TILE, PLAY_H);
    for (let r = 0; r <= ROWS; r++) bg.lineBetween(0, r * TILE, GAME_WIDTH, r * TILE);

    // Entry arrow (left side)
    bg.fillStyle(0xff4444);
    bg.fillTriangle(4, 65, 4, 85, 18, 75);
    bg.lineStyle(2, 0xff4444);
    bg.lineBetween(2, 75, 18, 75);

    // Exit arrow (right side)
    bg.fillStyle(0xff4444);
    bg.fillTriangle(GAME_WIDTH - 4, 115, GAME_WIDTH - 4, 135, GAME_WIDTH - 18, 125);
  }

  private drawShopPanel(): void {
    const shopBg = this.add.graphics().setDepth(9);
    shopBg.fillStyle(0x1e0a33);
    shopBg.fillRect(0, PLAY_H, GAME_WIDTH, GAME_HEIGHT - PLAY_H);
    shopBg.lineStyle(2, 0x9B59B6);
    shopBg.lineBetween(0, PLAY_H, GAME_WIDTH, PLAY_H);

    const types: TowerType[] = ['tabby', 'ninja', 'wizard', 'sniper'];
    const colors = [0xFF8C00, 0x6644aa, 0x8E44AD, 0x4a9a2a];
    const btnW = 180;
    const btnH = 78;
    const gap = 16;
    const startX = 14;

    this.shopBtns = [];

    // Sell hint label
    this.add
      .text(GAME_WIDTH - 14, PLAY_H + 14, '💰 Tap a tower to select it, then sell (60% refund)', {
        fontSize: '11px',
        color: '#ccaaff',
      })
      .setAlpha(0.85)
      .setOrigin(1, 0)
      .setDepth(10);

    types.forEach((type, i) => {
      const cfg = TOWER_CONFIGS[type];
      const bx = startX + i * (btnW + gap);
      const by = PLAY_H + 12;

      const bgG = this.add.graphics();
      this.drawShopBtnBg(bgG, btnW, btnH, colors[i], false);

      const nameTxt = this.add
        .text(btnW / 2, 12, cfg.name, { fontSize: '13px', color: '#ffffff', fontStyle: 'bold' })
        .setOrigin(0.5, 0);
      const descTxt = this.add
        .text(btnW / 2, 32, cfg.description, { fontSize: '11px', color: '#ddccff' })
        .setOrigin(0.5, 0);
      const dmgTxt = this.add
        .text(btnW / 2, 50, `DMG:${cfg.damage}  RNG:${cfg.range}  SPD:${cfg.fireRate.toFixed(1)}/s`, {
          fontSize: '10px',
          color: '#aaaacc',
        })
        .setOrigin(0.5, 0);

      const btn = this.add.container(bx, by, [bgG, nameTxt, descTxt, dmgTxt]);
      btn.setDepth(10);
      // Explicitly define the hit area in local space (0,0)→(btnW,btnH) so it
      // aligns with the drawn content. Using setSize() alone produces a centered
      // rectangle that is offset from the visuals, causing missed hover/clicks.
      btn.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, btnW, btnH),
        Phaser.Geom.Rectangle.Contains,
      );

      btn.on('pointerdown', () => {
        this.selectedType = type;
        this.refreshShopBtns();
      });
      btn.on('pointerover', () => {
        if (this.selectedType !== type) {
          this.drawShopBtnBg(bgG, btnW, btnH, colors[i], false, true);
        }
      });
      btn.on('pointerout', () => {
        if (this.selectedType !== type) {
          this.drawShopBtnBg(bgG, btnW, btnH, colors[i], false);
        }
      });

      this.shopBtns.push(btn);
    });

    this.refreshShopBtns();
  }

  private drawShopBtnBg(
    g: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    color: number,
    selected: boolean,
    hovered = false
  ): void {
    g.clear();
    const alpha = selected ? 0.75 : hovered ? 0.5 : 0.3;
    g.fillStyle(color, alpha);
    g.fillRoundedRect(0, 0, w, h, 8);
    g.lineStyle(selected ? 3 : 2, selected ? 0xffffff : color, selected ? 1 : 0.8);
    g.strokeRoundedRect(0, 0, w, h, 8);
  }

  private refreshShopBtns(): void {
    const types: TowerType[] = ['tabby', 'ninja', 'wizard', 'sniper'];
    const colors = [0xFF8C00, 0x6644aa, 0x8E44AD, 0x4a9a2a];
    const btnW = 180;
    const btnH = 78;
    this.shopBtns.forEach((btn, i) => {
      const bgG = btn.list[0] as Phaser.GameObjects.Graphics;
      this.drawShopBtnBg(bgG, btnW, btnH, colors[i], types[i] === this.selectedType);
    });
  }

  private setupHover(): void {
    this.hoverG = this.add.graphics().setDepth(5);
  }

  private setupInput(): void {
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      this.updateHover(ptr.x, ptr.y);
    });
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      // Sell button fires first and sets this flag — skip tile logic for this tap
      if (this._blockNextTileTap) { this._blockNextTileTap = false; return; }

      if (ptr.y >= PLAY_H) return;

      // If the sell button is visible and this tap lands on it, let its handler run
      if (this.sellBtnContainer) {
        const b = this.sellBtnContainer.getBounds();
        if (b.contains(ptr.x, ptr.y)) return;
      }

      const col = Math.floor(ptr.x / TILE);
      const row = Math.floor(ptr.y / TILE);
      const inGrid = col >= 0 && col < COLS && row >= 0 && row < ROWS;

      // Tap on an occupied tile → select that tower
      if (inGrid) {
        const cellType = this.grid[row][col];
        if (cellType && cellType !== 'path') {
          const tower = this.towers.find(t => t.col === col && t.row === row);
          if (tower) { this.selectTower(tower); return; }
        }
      }

      // Tap elsewhere → deselect and try to place
      this.deselectTower();
      this.tryPlaceTower(ptr.x, ptr.y);
    });
  }

  private updateHover(px: number, py: number): void {
    this.hoverG.clear();
    if (py >= PLAY_H || py < 0 || px < 0 || px >= GAME_WIDTH) return;

    const col = Math.floor(px / TILE);
    const row = Math.floor(py / TILE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

    const isPath = PATH_SET.has(`${col},${row}`);
    const isOccupied = this.grid[row][col] !== null && this.grid[row][col] !== 'path';
    const canAfford = this.gold >= TOWER_CONFIGS[this.selectedType].cost;

    // Gold highlight for a tower tile, green/orange for empty, red for path
    let color: number;
    if (isOccupied) {
      color = 0xffd700;
    } else if (isPath) {
      color = 0xff4444;
    } else if (canAfford) {
      color = 0x44ff88;
    } else {
      color = 0xffaa00;
    }

    this.hoverG.fillStyle(color, 0.28);
    this.hoverG.fillRect(col * TILE, row * TILE, TILE, TILE);
    this.hoverG.lineStyle(2, color, 0.75);
    this.hoverG.strokeRect(col * TILE, row * TILE, TILE, TILE);
  }

  private tryPlaceTower(px: number, py: number): void {
    const col = Math.floor(px / TILE);
    const row = Math.floor(py / TILE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    if (PATH_SET.has(`${col},${row}`)) return;
    if (this.grid[row][col] !== null) return;

    // Guest: validate gold locally for instant feedback, then send request to host
    if (this.mpMode && !this.mpIsHost) {
      const guestCfg = TOWER_CONFIGS[this.selectedType];
      if (this.gold < guestCfg.cost) {
        this.events.emit('not-enough-gold');
        const camShake = this.add.graphics().setDepth(50);
        camShake.fillStyle(0xffaa00, 0.15);
        camShake.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        this.tweens.add({
          targets: camShake,
          alpha: 0,
          duration: 220,
          onComplete: () => camShake.destroy(),
        });
        return;
      }
      try { this.mpRoom.send('place-tower', { col, row, type: this.selectedType }); } catch {}
      return;
    }

    const cfg = TOWER_CONFIGS[this.selectedType];
    if (this.gold < cfg.cost) {
      this.events.emit('not-enough-gold');
      // Shake effect
      const camShake = this.add.graphics().setDepth(50);
      camShake.fillStyle(0xffaa00, 0.15);
      camShake.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.tweens.add({
        targets: camShake,
        alpha: 0,
        duration: 220,
        onComplete: () => camShake.destroy(),
      });
      return;
    }

    this.gold -= cfg.cost;
    this.grid[row][col] = this.selectedType;
    const tower = new Tower(this, this.selectedType, col, row);
    this.towers.push(tower);
    this.emitStats();

    // Show range briefly
    tower.showRange(true);
    this.time.delayedCall(1200, () => tower.showRange(false));
  }

  private selectTower(tower: Tower): void {
    // Tap the already-selected tower → deselect it
    if (this.selectedTower === tower) {
      this.deselectTower();
      return;
    }
    this.deselectTower();
    this.selectedTower = tower;
    tower.showRange(true);
    this.createSellButton(tower);
  }

  private deselectTower(): void {
    if (this.selectedTower) {
      this.selectedTower.showRange(false);
      this.selectedTower = null;
    }
    if (this.sellBtnContainer) {
      this.tweens.killTweensOf(this.sellBtnContainer);
      this.sellBtnContainer.destroy();
      this.sellBtnContainer = null;
    }
  }

  private createSellButton(tower: Tower): void {
    const refund = Math.floor(TOWER_CONFIGS[tower.type].cost * 0.6);
    const btnW = 130;
    const btnH = 36;

    // Position above the tower; flip below if near the top edge
    const tx = Phaser.Math.Clamp(tower.x, btnW / 2 + 6, GAME_WIDTH - btnW / 2 - 6);
    const ty = tower.y > 56 ? tower.y - 44 : tower.y + 54;

    const bgG = this.add.graphics();
    const drawBg = (hover: boolean) => {
      bgG.clear();
      bgG.fillStyle(hover ? 0x443300 : 0x1a1100, 0.92);
      bgG.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
      bgG.lineStyle(hover ? 2.5 : 2, 0xffd700, 1);
      bgG.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
    };
    drawBg(false);

    const txt = this.add
      .text(0, 0, `💰 Sell  +${refund}g`, {
        fontSize: '14px',
        color: '#ffd700',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.sellBtnContainer = this.add.container(tx, ty, [bgG, txt]);
    this.sellBtnContainer.setDepth(16);
    this.sellBtnContainer.setSize(btnW, btnH);
    this.sellBtnContainer.setInteractive({ useHandCursor: true });

    // Pop-in
    this.sellBtnContainer.setScale(0.4);
    this.tweens.add({
      targets: this.sellBtnContainer,
      scaleX: 1, scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Gentle bob to draw attention
    this.tweens.add({
      targets: this.sellBtnContainer,
      y: ty - 4,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.sellBtnContainer.on('pointerover',  () => drawBg(true));
    this.sellBtnContainer.on('pointerout',   () => drawBg(false));
    this.sellBtnContainer.on('pointerdown',  () => this.executeSell());
  }

  private executeSell(): void {
    if (!this.selectedTower || this.gameOver) return;
    // Block the global pointerdown handler from also running on this same tap
    this._blockNextTileTap = true;

    // Guest: send sell request to host, then just deselect
    if (this.mpMode && !this.mpIsHost) {
      try { this.mpRoom.send('sell-tower', { col: this.selectedTower.col, row: this.selectedTower.row }); } catch {}
      this.deselectTower();
      return;
    }

    const tower = this.selectedTower;
    const refund = Math.floor(TOWER_CONFIGS[tower.type].cost * 0.6);

    this.spawnSellParticles(tower.x, tower.y);
    this.showFloatingText(`+${refund}g`, tower.x, tower.y - 16, '#ffd700');

    const idx = this.towers.indexOf(tower);
    if (idx !== -1) this.towers.splice(idx, 1);
    this.grid[tower.row][tower.col] = null;
    this.gold += refund;

    // Deselect before destroying (clears sell button & range ring)
    this.deselectTower();
    tower.destroy();

    this.emitStats();
  }

  private spawnSellParticles(x: number, y: number): void {
    const palette = [0xffd700, 0xffee88, 0xffaa00, 0xffffff];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 28 + Math.random() * 40;
      const p = this.add.graphics().setDepth(6);
      const color = palette[i % palette.length];
      p.fillStyle(color);
      const size = 2.5 + Math.random() * 3.5;
      // Mix of circles and tiny stars
      if (i % 3 === 0) {
        p.fillCircle(0, 0, size);
      } else {
        p.fillRect(-size * 0.6, -size * 0.6, size * 1.2, size * 1.2);
      }
      p.x = x;
      p.y = y;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed - 15,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 380 + Math.random() * 200,
        ease: 'Power2',
        onComplete: () => { if (p.scene) p.destroy(); },
      });
    }
  }

  private createStartButton(): void {
    const w = 230;
    const h = 54;
    const bgG = this.add.graphics();

    const drawBtn = (hover: boolean) => {
      bgG.clear();
      bgG.fillStyle(hover ? 0x2ecc71 : 0x27ae60, 0.92);
      bgG.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bgG.lineStyle(2.5, hover ? 0x27ae60 : 0x2ecc71, 1);
      bgG.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };

    drawBtn(false);

    const lbl = this.add.text(0, 0, '▶  Start Wave 1', {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.startBtn = this.add.container(GAME_WIDTH / 2, PLAY_H / 2, [bgG, lbl]);
    this.startBtn.setDepth(15);
    this.startBtn.setSize(w, h);
    this.startBtn.setInteractive({ useHandCursor: true });

    this.startBtn.on('pointerover', () => drawBtn(true));
    this.startBtn.on('pointerout', () => drawBtn(false));
    this.startBtn.on('pointerdown', () => {
      if (this.mpMode && !this.mpIsHost) {
        // Guest requests the host to start the wave
        try { this.mpRoom.send('start-wave', {}); } catch {}
      } else {
        this.startWave();
      }
    });

    this.tweens.add({
      targets: this.startBtn,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private startWave(): void {
    if (this.waveActive || this.gameOver) return;
    this.countdownActive = false;
    this.countdown = 0;
    this.waveNum++;
    this.waveActive = true;

    const hpScale = 1 + (this.waveNum - 1) * 0.25;
    this.spawnQueue = buildWave(this.waveNum);
    this.spawnInterval = Math.max(580, 1200 - this.waveNum * 85);
    this.spawnTimer = 0;

    this.startBtn.setVisible(false);
    this.tweens.killTweensOf(this.startBtn);
    this.emitStats();

    // Notify guest
    if (this.mpMode && this.mpIsHost) {
      try { this.mpRoom.send('wave-started', { waveNum: this.waveNum }); } catch {}
      this.syncHostState();
    }

    // Wave banner
    const banner = this.add
      .text(GAME_WIDTH / 2, 55, `⚔ Wave ${this.waveNum}!`, {
        fontSize: '30px',
        color: '#ff4444',
        fontStyle: 'bold',
        stroke: '#ffffff',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0);

    this.tweens.add({
      targets: banner,
      alpha: 1,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 300,
      yoyo: true,
      hold: 350,
      onComplete: () => banner.destroy(),
    });
  }

  private spawnEnemy(type: EnemyType): void {
    const hpScale = 1 + (this.waveNum - 1) * 0.25;
    const e = new Enemy(this, type, WAYPOINTS, hpScale);
    this.enemies.push(e);
  }

  private onWaveComplete(): void {
    this.waveActive = false;
    const bonus = 25 + this.waveNum * 10;
    this.gold += bonus;
    this.emitStats();

    // Notify guest
    if (this.mpMode && this.mpIsHost) {
      try { this.mpRoom.send('wave-complete', { bonus, waveNum: this.waveNum }); } catch {}
      this.syncHostState();
    }

    // Start countdown for next wave
    this.countdown = this.COUNTDOWN_MS;
    this.countdownActive = true;

    // Update start button label with initial countdown
    const lbl = this.startBtn.list[1] as Phaser.GameObjects.Text;
    lbl.setText(`▶  Wave ${this.waveNum + 1} in 10s`);
    this.startBtn.setVisible(true);
    this.tweens.add({
      targets: this.startBtn,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Wave complete message
    const msg = this.add
      .text(GAME_WIDTH / 2, PLAY_H / 2 - 40, `✨ Wave ${this.waveNum} Clear!\n+${bonus}g bonus`, {
        fontSize: '26px',
        color: '#ffd700',
        fontStyle: 'bold',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.tweens.add({
      targets: msg,
      y: PLAY_H / 2 - 90,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => msg.destroy(),
    });
  }

  private loseLife(): void {
    if (this.gameOver) return;
    this.lives = Math.max(0, this.lives - 1);
    this.emitStats();

    // Red flash
    const flash = this.add.graphics().setDepth(50);
    flash.fillStyle(0xff0000, 0.35);
    flash.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 320,
      onComplete: () => flash.destroy(),
    });

    if (this.lives <= 0) {
      this.triggerGameOver();
    }
  }

  private triggerGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.waveActive = false;
    this.deselectTower();
    this.startBtn.setVisible(false);

    // Notify guest
    if (this.mpMode && this.mpIsHost) {
      try { this.mpRoom.send('game-over', {}); } catch {}
    }

    const overlay = this.add.graphics().setDepth(30);
    overlay.fillStyle(0x000000, 0.72);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, '💀 GAME OVER', {
        fontSize: '50px',
        color: '#ff3333',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(31);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `Waves survived: ${this.waveNum}\nScore: ${this.score}`, {
        fontSize: '26px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(31);

    const restartBtn = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, '[ 🔄 Play Again ]', {
        fontSize: '24px',
        color: '#ffd700',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setInteractive({ useHandCursor: true });

    restartBtn.on('pointerover', () => restartBtn.setStyle({ color: '#ffffff' }));
    restartBtn.on('pointerout', () => restartBtn.setStyle({ color: '#ffd700' }));
    restartBtn.on('pointerdown', () => {
      this.scene.stop('UIScene');
      if (this.mpMode) {
        // Clean up room and return to lobby
        this.mpCleanupFns.forEach(fn => { try { fn(); } catch {} });
        this.mpCleanupFns = [];
        try { this.mpRoom?.leave(); } catch {}
        this.scene.start('LobbyScene');
      } else {
        this.scene.restart();
      }
    });

    this.tweens.add({
      targets: restartBtn,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private spawnDeathParticles(x: number, y: number, type: EnemyType): void {
    const colors: Record<EnemyType, number[]> = {
      mouse: [0xbbbbcc, 0xffc0cb, 0x888899],
      bug:   [0x22aa22, 0x44ff44, 0x116611],
      bird:  [0xffe066, 0xffaa00, 0xffcc44],
    };
    const palette = colors[type];

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 35 + Math.random() * 35;
      const p = this.add.graphics().setDepth(5);
      p.fillStyle(palette[i % palette.length]);
      p.fillCircle(0, 0, 2.5 + Math.random() * 3);
      p.x = x;
      p.y = y;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 340 + Math.random() * 180,
        ease: 'Power2',
        onComplete: () => { if (p.scene) p.destroy(); },
      });
    }
  }

  private showFloatingText(text: string, x: number, y: number, color: string): void {
    const t = this.add
      .text(x, y, text, { fontSize: '14px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({
      targets: t,
      y: y - 30,
      alpha: 0,
      duration: 900,
      ease: 'Power2',
      onComplete: () => { if (t.scene) t.destroy(); },
    });
  }

  private emitStats(): void {
    this.events.emit('stats', {
      lives: this.lives,
      gold: this.gold,
      wave: this.waveNum,
      score: this.score,
    });
  }

  update(_time: number, delta: number): void {
    // Guest: game simulation runs on host only — skip all logic here
    if (this.mpMode && !this.mpIsHost) return;

    // Host: periodically sync state and enemy positions to guest
    if (this.mpMode && this.mpIsHost) {
      this.mpSyncTimer -= delta;
      if (this.mpSyncTimer <= 0) {
        this.mpSyncTimer = 150; // ~6 Hz
        this.syncHostState();
        this.syncEnemies();
      }
    }

    // --- Countdown between waves ---
    if (this.countdownActive && !this.waveActive && !this.gameOver) {
      this.countdown -= delta;
      const secsLeft = Math.ceil(this.countdown / 1000);
      const lbl = this.startBtn.list[1] as Phaser.GameObjects.Text;
      lbl.setText(`▶  Wave ${this.waveNum + 1} in ${secsLeft}s`);

      if (this.countdown <= 0) {
        this.startWave();
      }
      return;
    }

    if (!this.waveActive) return;

    // --- Spawn enemies ---
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
      const type = this.spawnQueue.shift()!;
      this.spawnEnemy(type);
      this.spawnTimer = this.spawnInterval;
    }

    // --- Update enemies ---
    for (const e of this.enemies) {
      e.update(delta);
    }

    // --- Remove dead/escaped enemies ---
    const surviving: Enemy[] = [];
    for (const e of this.enemies) {
      if (!e.alive) {
        if (e.reachedEnd) this.loseLife();
        // killed enemies: gold already awarded via event
      } else {
        surviving.push(e);
      }
    }
    this.enemies = surviving;

    if (this.gameOver) return;

    // --- Towers fire ---
    for (const tower of this.towers) {
      const target = tower.tryFire(this.enemies, delta);
      if (target) {
        const proj = new Projectile(this, tower.x, tower.y, target, tower.type, tower.damage);
        this.projectiles.push(proj);
      }
    }

    // --- Update projectiles ---
    const aliveProjs: Projectile[] = [];
    for (const p of this.projectiles) {
      const hit = p.update(delta);
      if (hit && p.type === 'wizard') {
        // AoE splash
        const cx = p.hitX;
        const cy = p.hitY;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const dx = e.x - cx;
          const dy = e.y - cy;
          if (dx * dx + dy * dy <= AOE_RADIUS * AOE_RADIUS) {
            e.takeDamage(p.damage * 0.55);
          }
        }
        // AoE ring visual
        const aoeG = this.add.graphics().setDepth(5);
        aoeG.fillStyle(0xcc44ff, 0.35);
        aoeG.fillCircle(cx, cy, AOE_RADIUS);
        aoeG.lineStyle(2.5, 0xffd700, 0.7);
        aoeG.strokeCircle(cx, cy, AOE_RADIUS);
        this.tweens.add({
          targets: aoeG,
          alpha: 0,
          scaleX: 1.5,
          scaleY: 1.5,
          duration: 350,
          ease: 'Power1',
          onComplete: () => { if (aoeG.scene) aoeG.destroy(); },
        });
      }
      if (p.alive) aliveProjs.push(p);
    }
    this.projectiles = aliveProjs;

    // --- Clean up enemies killed by projectiles this frame ---
    this.enemies = this.enemies.filter(e => e.alive);

    // --- Wave complete? ---
    if (!this.gameOver && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.onWaveComplete();
    }
  }

  // ── Multiplayer setup & sync ─────────────────────────────────────────────

  private setupMultiplayer(): void {
    if (!this.mpRoom) return;

    // Unsubscribe all handlers when the scene shuts down
    this.events.once('shutdown', () => {
      this.mpCleanupFns.forEach(fn => { try { fn(); } catch {} });
      this.mpCleanupFns = [];
    });

    if (this.mpIsHost) {
      // ── HOST: handle action requests sent by the guest ───────────────────

      const offPlace = this.mpRoom.on('place-tower', (msg: any) => {
        const { col, row, type } = msg as { col: number; row: number; type: TowerType };
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
        if (PATH_SET.has(`${col},${row}`)) return;
        if (this.grid[row][col] !== null) return;
        const cfg = TOWER_CONFIGS[type];
        if (!cfg || this.gold < cfg.cost) return;

        this.gold -= cfg.cost;
        this.grid[row][col] = type;
        const tower = new Tower(this, type, col, row);
        this.towers.push(tower);
        tower.showRange(true);
        this.time.delayedCall(1200, () => { if (tower) tower.showRange(false); });
        this.emitStats();
        this.syncHostState();
      });

      const offSell = this.mpRoom.on('sell-tower', (msg: any) => {
        const { col, row } = msg as { col: number; row: number };
        const tower = this.towers.find(t => t.col === col && t.row === row);
        if (!tower) return;
        const refund = Math.floor(TOWER_CONFIGS[tower.type].cost * 0.6);
        this.spawnSellParticles(tower.x, tower.y);
        this.showFloatingText(`+${refund}g`, tower.x, tower.y - 16, '#ffd700');
        const idx = this.towers.indexOf(tower);
        if (idx !== -1) this.towers.splice(idx, 1);
        this.grid[tower.row][tower.col] = null;
        this.gold += refund;
        tower.destroy();
        this.emitStats();
        this.syncHostState();
      });

      const offStart = this.mpRoom.on('start-wave', (_msg: any) => {
        this.startWave();
      });

      this.mpCleanupFns.push(offPlace, offSell, offStart);

    } else {
      // ── GUEST: receive state updates & events from host ──────────────────

      // Full game-state snapshot (lives, gold, wave, towers)
      const offState = this.mpRoom.on('state-sync', (msg: any) => {
        this.lives   = msg.lives   ?? this.lives;
        this.gold    = msg.gold    ?? this.gold;
        this.waveNum = msg.waveNum ?? this.waveNum;
        this.score   = msg.score   ?? this.score;
        this.emitStats();

        // Reconcile towers: add ones the host has that we don't
        const incoming: Array<{ col: number; row: number; type: TowerType }> = msg.towers ?? [];
        const incomingKeys = new Set(incoming.map(t => `${t.col},${t.row}`));

        for (const td of incoming) {
          const cell = this.grid[td.row]?.[td.col];
          if (cell === null) {
            // Cell is empty — place the tower the host put there
            this.grid[td.row][td.col] = td.type;
            const t = new Tower(this, td.type, td.col, td.row);
            this.towers.push(t);
          }
        }

        // Remove towers that the host has sold
        const toRemove = this.towers.filter(t => !incomingKeys.has(`${t.col},${t.row}`));
        for (const t of toRemove) {
          this.spawnSellParticles(t.x, t.y);
          this.grid[t.row][t.col] = null;
          const idx = this.towers.indexOf(t);
          if (idx !== -1) this.towers.splice(idx, 1);
          t.destroy();
        }

        // Sync wave-active flag so start button visibility stays consistent
        const hostWaveActive = msg.waveActive ?? this.waveActive;
        if (!hostWaveActive && this.waveActive) {
          // Host's wave ended — guest may have missed the wave-complete message
          this.waveActive = false;
          this.startBtn.setVisible(true);
        }
      });

      // Per-frame enemy positions
      const offEnemies = this.mpRoom.on('enemy-sync', (msg: any) => {
        const snapshots: Array<{
          id: number; type: EnemyType; x: number; y: number; hp: number; maxHp: number;
        }> = msg.enemies ?? [];

        const receivedIds = new Set(snapshots.map(s => s.id));

        for (const snap of snapshots) {
          if (this.guestEnemies.has(snap.id)) {
            const e = this.guestEnemies.get(snap.id)!;
            e.syncPosition(snap.x, snap.y);
            e.syncHp(snap.hp, snap.maxHp);
          } else {
            // New enemy — create ghost at the reported position
            const ghost = new Enemy(this, snap.type, WAYPOINTS, 1);
            ghost.syncPosition(snap.x, snap.y);
            ghost.syncHp(snap.hp, snap.maxHp);
            this.guestEnemies.set(snap.id, ghost);
          }
        }

        // Enemies that vanished from host's list → play death anim and remove
        for (const [id, e] of this.guestEnemies) {
          if (!receivedIds.has(id)) {
            this.spawnDeathParticles(e.x, e.y, e.type);
            e.triggerDeathAnimation();
            this.guestEnemies.delete(id);
          }
        }
      });

      // Wave started
      const offWaveStarted = this.mpRoom.on('wave-started', (msg: any) => {
        this.waveNum = msg.waveNum ?? this.waveNum + 1;
        this.waveActive = true;
        this.startBtn.setVisible(false);
        this.tweens.killTweensOf(this.startBtn);
        this.emitStats();

        const banner = this.add
          .text(GAME_WIDTH / 2, 55, `⚔ Wave ${this.waveNum}!`, {
            fontSize: '30px',
            color: '#ff4444',
            fontStyle: 'bold',
            stroke: '#ffffff',
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(20)
          .setAlpha(0);

        this.tweens.add({
          targets: banner,
          alpha: 1,
          scaleX: 1.25,
          scaleY: 1.25,
          duration: 300,
          yoyo: true,
          hold: 350,
          onComplete: () => banner.destroy(),
        });
      });

      // Wave complete
      const offWaveComplete = this.mpRoom.on('wave-complete', (msg: any) => {
        this.waveActive = false;
        const bonus: number = msg.bonus ?? 0;
        this.waveNum = msg.waveNum ?? this.waveNum;
        this.gold += bonus;
        this.emitStats();

        const lbl = this.startBtn.list[1] as Phaser.GameObjects.Text;
        lbl.setText(`▶  Wave ${this.waveNum + 1} ready`);
        this.startBtn.setVisible(true);
        this.tweens.killTweensOf(this.startBtn);
        this.tweens.add({
          targets: this.startBtn,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 750,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        const clearMsg = this.add
          .text(GAME_WIDTH / 2, PLAY_H / 2 - 40, `✨ Wave ${this.waveNum} Clear!\n+${bonus}g bonus`, {
            fontSize: '26px',
            color: '#ffd700',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 5,
          })
          .setOrigin(0.5)
          .setDepth(20);

        this.tweens.add({
          targets: clearMsg,
          y: PLAY_H / 2 - 90,
          alpha: 0,
          duration: 2000,
          ease: 'Power2',
          onComplete: () => clearMsg.destroy(),
        });
      });

      // Game over
      const offGameOver = this.mpRoom.on('game-over', (_msg: any) => {
        this.triggerGameOver();
      });

      this.mpCleanupFns.push(
        offState, offEnemies, offWaveStarted, offWaveComplete, offGameOver,
      );
    }
  }

  /** Send a full game-state snapshot to the guest (lives, gold, towers list). */
  private syncHostState(): void {
    if (!this.mpMode || !this.mpIsHost || !this.mpRoom) return;
    try {
      this.mpRoom.send('state-sync', {
        lives:     this.lives,
        gold:      this.gold,
        waveNum:   this.waveNum,
        score:     this.score,
        waveActive: this.waveActive,
        towers:    this.towers.map(t => ({ col: t.col, row: t.row, type: t.type })),
      });
    } catch {}
  }

  /** Send per-frame enemy positions/HP snapshot to the guest (~6 Hz). */
  private syncEnemies(): void {
    if (!this.mpMode || !this.mpIsHost || !this.mpRoom) return;
    try {
      this.mpRoom.send('enemy-sync', {
        enemies: this.enemies
          .filter(e => e.alive)
          .map(e => ({
            id:    e.id,
            type:  e.type,
            x:     Math.round(e.x),
            y:     Math.round(e.y),
            hp:    Math.round(e.hp),
            maxHp: e.maxHp,
          })),
      });
    } catch {}
  }
}
