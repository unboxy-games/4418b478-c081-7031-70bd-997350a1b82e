import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, CELL, COLS, ROWS,
  PATH_TILE_SET, STARTING_COINS, STARTING_LIVES, TOWER_CONFIGS,
} from '../config';
import { CatTower } from '../objects/CatTower';
import { MouseZombie } from '../objects/MouseZombie';
import { Bullet } from '../objects/Bullet';
import { audioManager } from '../audio/AudioManager';

export class GameScene extends Phaser.Scene {
  cats: CatTower[] = [];
  zombies: MouseZombie[] = [];
  bullets: Bullet[] = [];

  coins = STARTING_COINS;
  lives = STARTING_LIVES;
  wave = 0;
  score = 0;
  isGameOver = false;
  isPaused = false;
  selectedTowerType = 'basic';
  selectedCat: CatTower | null = null;

  private waveActive = false;
  private waveCountdown = 4000;
  private spawnQueue = 0;
  private spawnInterval = 2000;
  private spawnTimer = 0;
  private waveHp = 80;
  private waveSpeed = 58;
  private waveCoinsReward = 20;

  private previewGfx!: Phaser.GameObjects.Graphics;
  private pointerCol = -1;
  private pointerRow = -1;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.cats = [];
    this.zombies = [];
    this.bullets = [];
    this.coins = STARTING_COINS;
    this.lives = STARTING_LIVES;
    this.wave = 0;
    this.score = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.waveActive = false;
    this.waveCountdown = 4000;
    this.selectedTowerType = 'basic';
    this.selectedCat = null;

    this.drawGrid();
    this.setupInput();

    this.previewGfx = this.add.graphics();
    this.previewGfx.setDepth(5);

    audioManager.startMusic();
    this.scene.launch('UIScene');
  }

  private drawGrid(): void {
    const g = this.add.graphics();
    g.setDepth(0);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const px = col * CELL;
        const py = row * CELL;
        const isPath = PATH_TILE_SET.has(`${col},${row}`);
        const isBase = col === 19 && row === 4;
        const isSpawn = col === 0 && row === 6;

        if (isBase) {
          g.fillStyle(0x0a1a40);
        } else if (isPath) {
          g.fillStyle((col + row) % 2 === 0 ? 0x8b7214 : 0x7d6610);
        } else {
          g.fillStyle((col + row) % 2 === 0 ? 0x2d5016 : 0x274812);
        }
        g.fillRect(px, py, CELL, CELL);

        if (!isPath && !isBase) {
          g.lineStyle(0.5, 0x000000, 0.12);
          g.strokeRect(px, py, CELL, CELL);
        }

        // Spawn indicator
        if (isSpawn) {
          g.fillStyle(0xff4444, 0.35);
          g.fillRect(px, py, CELL, CELL);
        }
      }
    }

    // Base castle at tile (19, 4)
    const bx = 19 * CELL;
    const by = 4 * CELL;
    g.fillStyle(0x1a3a7a);
    g.fillRect(bx + 2, by + 2, 36, 36);
    // Battlements
    g.fillStyle(0x0e2255);
    for (let i = 0; i < 4; i++) {
      g.fillRect(bx + 2 + i * 9, by + 2, 6, 8);
    }
    // Windows
    g.fillStyle(0xaaddff);
    g.fillRect(bx + 7, by + 12, 7, 7);
    g.fillRect(bx + 26, by + 12, 7, 7);
    // Gate arch
    g.fillStyle(0x050f1e);
    g.fillRect(bx + 14, by + 22, 12, 16);
    g.fillStyle(0x050f1e);
    g.fillCircle(bx + 20, by + 22, 6);
    // Castle flag
    g.fillStyle(0xff4444);
    g.fillTriangle(bx + 20, by - 4, bx + 20, by + 6, bx + 28, by + 1);

    // Entry arrow on spawn tile
    g.fillStyle(0xff6644, 0.9);
    g.fillTriangle(2, 252, 2, 268, 16, 260);

    // UI panel
    g.fillStyle(0x0d0d1e);
    g.fillRect(0, ROWS * CELL, GAME_WIDTH, GAME_HEIGHT - ROWS * CELL);
    g.lineStyle(1.5, 0x2233aa);
    g.lineBetween(0, ROWS * CELL, GAME_WIDTH, ROWS * CELL);

    // Tower shop button backgrounds (8 slots; UIScene draws the labels/borders)
    const btnW = 56;
    const btnH = 64;
    const btnStartX = 2;
    const btnGap = 3;
    for (let i = 0; i < 8; i++) {
      g.fillStyle(0x151530);
      g.fillRoundedRect(btnStartX + i * (btnW + btnGap), ROWS * CELL + 8, btnW, btnH, 5);
    }
  }

  private setupInput(): void {
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      this.pointerCol = Math.floor(ptr.x / CELL);
      this.pointerRow = Math.floor(ptr.y / CELL);
    });

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.isGameOver || this.isPaused) return;
      const col = Math.floor(ptr.x / CELL);
      const row = Math.floor(ptr.y / CELL);
      this.handleTileClick(col, row);
    });

    this.input.keyboard?.on('keydown-P', () => this.togglePause());

    this.input.on('pointerout', () => {
      this.pointerCol = -1;
      this.pointerRow = -1;
    });
  }

  private handleTileClick(col: number, row: number): void {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

    // Click on existing tower → select it
    const existingCat = this.cats.find(c => c.col === col && c.row === row);
    if (existingCat) {
      this.selectCat(existingCat);
      return;
    }

    // Click on empty tile → deselect then try to place
    this.deselectCat();

    if (PATH_TILE_SET.has(`${col},${row}`)) {
      this.events.emit('show-msg', 'Cannot place on path!', '#ff6644');
      return;
    }
    const cfg = TOWER_CONFIGS[this.selectedTowerType];
    if (this.coins < cfg.cost) {
      this.events.emit('show-msg', `Need ${cfg.cost} coins!`, '#ff4444');
      return;
    }
    this.coins -= cfg.cost;
    const cat = new CatTower(this, col, row, this.selectedTowerType);
    this.cats.push(cat);
    audioManager.playTowerPlaced();
    this.events.emit('coins-changed', this.coins);
  }

  private selectCat(cat: CatTower): void {
    this.selectedCat = cat;
    this.events.emit('tower-selected', cat);
  }

  deselectCat(): void {
    if (this.selectedCat) {
      this.selectedCat = null;
      this.events.emit('tower-deselected');
    }
  }

  togglePause(): void {
    if (this.isGameOver) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      audioManager.pauseMusic();
    } else {
      audioManager.resumeMusic();
    }
    this.events.emit(this.isPaused ? 'paused' : 'resumed');
  }

  upgradeTower(cat: CatTower): void {
    if (cat.level >= 3) {
      this.events.emit('show-msg', 'Already max level!', '#ff6644');
      return;
    }
    const cost = cat.upgradeCost;
    if (this.coins < cost) {
      this.events.emit('show-msg', `Need ${cost} coins!`, '#ff4444');
      return;
    }
    this.coins -= cost;
    cat.totalSpent += cost;
    cat.upgradeLevel();
    audioManager.playUpgrade();
    this.events.emit('coins-changed', this.coins);
    this.events.emit('tower-selected', cat); // refresh panel
  }

  sellTower(cat: CatTower): void {
    const refund = cat.sellValue;
    this.coins += refund;
    this.cats = this.cats.filter(c => c !== cat);
    cat.destroy();
    this.selectedCat = null;
    audioManager.playSell();
    this.events.emit('coins-changed', this.coins);
    this.events.emit('tower-deselected');
    this.events.emit('show-msg', `Sold for ${refund} 💰`, '#44ffaa');
  }

  private startWave(): void {
    this.wave++;
    const count = 6 + this.wave * 3;
    this.waveHp = 80 + (this.wave - 1) * 22;
    this.waveSpeed = 55 + (this.wave - 1) * 5;
    this.waveCoinsReward = 20 + this.wave * 2;
    this.spawnQueue = count;
    this.spawnInterval = Math.max(600, 2000 - (this.wave - 1) * 120);
    this.spawnTimer = 0;
    this.waveActive = true;
    audioManager.playWaveStart(this.wave);
    this.events.emit('wave-started', this.wave);
  }

  private spawnZombie(typeOverride?: string): void {
    let type = typeOverride;
    if (!type) {
      // Build weighted pool of enemy types unlocked this wave
      const pool: string[] = ['basic', 'basic'];
      if (this.wave >= 2) pool.push('speed', 'speed', 'speed');
      if (this.wave >= 3) pool.push('brute', 'swarm', 'swarm');
      if (this.wave >= 4) pool.push('speed', 'brute', 'ghost', 'ghost');
      if (this.wave >= 5) pool.push('armored', 'armored');
      if (this.wave >= 6) pool.push('boss');
      if (this.wave >= 7) pool.push('armored', 'brute', 'brute', 'ghost');
      if (this.wave >= 9) pool.push('boss', 'boss');
      type = pool[Math.floor(Math.random() * pool.length)];
    }

    // Swarm: spawn 3 tiny enemies at once
    if (type === 'swarm') {
      this.spawnZombie('swarm_unit');
      this.spawnZombie('swarm_unit');
      this.spawnZombie('swarm_unit');
      return;
    }

    let hp = this.waveHp;
    let speed = this.waveSpeed;
    let coins = this.waveCoinsReward;

    if (type === 'speed') {
      hp = Math.max(20, Math.floor(hp * 0.4));
      speed = Math.floor(speed * 2.0);
      coins = Math.max(8, Math.floor(coins * 0.5));
    } else if (type === 'brute') {
      hp = Math.floor(hp * 3.2);
      speed = Math.max(25, Math.floor(speed * 0.55));
      coins = Math.floor(coins * 2.5);
    } else if (type === 'armored') {
      hp = Math.floor(hp * 1.3);
      speed = Math.max(40, Math.floor(speed * 0.85));
      coins = Math.floor(coins * 1.8);
    } else if (type === 'ghost') {
      hp = Math.max(15, Math.floor(hp * 0.6));
      speed = Math.floor(speed * 1.5);
      coins = Math.floor(coins * 1.3);
    } else if (type === 'boss') {
      hp = Math.floor(hp * 8);
      speed = Math.max(20, Math.floor(speed * 0.4));
      coins = Math.floor(coins * 5);
    } else if (type === 'swarm_unit') {
      hp = Math.max(5, Math.floor(hp * 0.15));
      speed = Math.floor(speed * 1.7);
      coins = Math.max(3, Math.floor(coins * 0.25));
    }

    const enemyType = type === 'swarm_unit' ? 'swarm' : type;
    const z = new MouseZombie(this, hp, speed, coins, enemyType);
    this.zombies.push(z);
  }

  update(time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    // Wave countdown
    if (!this.waveActive) {
      this.waveCountdown -= delta;
      this.events.emit('countdown', Math.ceil(this.waveCountdown / 1000));
      if (this.waveCountdown <= 0) {
        this.startWave();
      }
    }

    // Spawn enemies
    if (this.waveActive && this.spawnQueue > 0) {
      this.spawnTimer += delta;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer -= this.spawnInterval;
        this.spawnZombie();
        this.spawnQueue--;
      }
    }

    // Wave complete check
    if (this.waveActive && this.spawnQueue === 0 && this.zombies.length === 0) {
      this.waveActive = false;
      this.waveCountdown = 8000;
      audioManager.playWaveComplete();
      this.events.emit('wave-complete', this.wave);
    }

    // Update zombies
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (z.isDead) {
        this.coins += z.coinsReward;
        this.score += z.coinsReward;
        audioManager.playEnemyDeath(z.enemyType);
        audioManager.playCoin();
        this.events.emit('coins-changed', this.coins);
        this.events.emit('score-changed', this.score);
        z.destroy();
        this.zombies.splice(i, 1);
        continue;
      }
      const reached = z.step(delta);
      if (reached) {
        this.lives--;
        audioManager.playLifeLost();
        z.destroy();
        this.zombies.splice(i, 1);
        this.events.emit('lives-changed', this.lives);
        if (this.lives <= 0) {
          this.doGameOver();
        }
      }
    }

    // Update towers
    for (const cat of this.cats) {
      cat.step(time, this.zombies, this.bullets);
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.isDead) {
        this.bullets.splice(i, 1);
        continue;
      }
      b.step(delta);
    }

    // Draw hover preview
    this.drawPreview();
  }

  private drawPreview(): void {
    this.previewGfx.clear();

    // Draw selection highlight on the currently selected tower
    if (this.selectedCat) {
      const sc = this.selectedCat;
      this.previewGfx.lineStyle(2.5, 0xffffff, 0.9);
      this.previewGfx.strokeRect(sc.col * CELL, sc.row * CELL, CELL, CELL);
      this.previewGfx.fillStyle(0xffffff, 0.1);
      this.previewGfx.fillRect(sc.col * CELL, sc.row * CELL, CELL, CELL);
    }

    // Draw hover placement preview
    const col = this.pointerCol;
    const row = this.pointerRow;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    // Don't double-draw over the selected cat's tile
    if (this.selectedCat && this.selectedCat.col === col && this.selectedCat.row === row) return;

    const isPath = PATH_TILE_SET.has(`${col},${row}`);
    const occupied = this.cats.some(c => c.col === col && c.row === row);
    const canPlace = !isPath && !occupied;
    const hasCoins = this.coins >= TOWER_CONFIGS[this.selectedTowerType].cost;

    if (canPlace) {
      this.previewGfx.fillStyle(hasCoins ? 0x44ff44 : 0xff4444, 0.28);
      this.previewGfx.lineStyle(2, hasCoins ? 0x44ff44 : 0xff4444, 0.9);
    } else {
      this.previewGfx.fillStyle(0xff2222, 0.28);
      this.previewGfx.lineStyle(2, 0xff2222, 0.9);
    }
    this.previewGfx.fillRect(col * CELL, row * CELL, CELL, CELL);
    this.previewGfx.strokeRect(col * CELL, row * CELL, CELL, CELL);
  }

  private doGameOver(): void {
    this.isGameOver = true;
    audioManager.stopMusic();
    audioManager.playGameOver();
    this.events.emit('game-over', this.score, this.wave);
  }
}
