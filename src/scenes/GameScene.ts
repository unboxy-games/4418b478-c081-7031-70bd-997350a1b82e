import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

const COLS = 10;
const ROWS = 5;
const CELL_W = 72;
const CELL_H = 54;
const FORMATION_X = GAME_WIDTH / 2 - (COLS * CELL_W) / 2 + CELL_W / 2;
const FORMATION_Y = 105;
const ENEMY_POINTS = [150, 80, 40];

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;

  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemyGroup!: Phaser.Physics.Arcade.Group;

  private formationDirX = 1;
  private formationOffset = 0;
  private formationDropY = 0;

  private lives = 3;
  private score = 0;
  private level = 1;
  private isGameOver = false;
  private playerInvincible = false;

  private shootCooldown = 0;
  private enemyShootTimer = 2000;
  private diveTimer = 3500;

  private divingEnemies: Phaser.Physics.Arcade.Sprite[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Reset all state
    this.lives = 3;
    this.score = 0;
    this.level = 1;
    this.isGameOver = false;
    this.playerInvincible = false;
    this.formationOffset = 0;
    this.formationDropY = 0;
    this.formationDirX = 1;
    this.divingEnemies = [];
    this.shootCooldown = 0;
    this.enemyShootTimer = 2000;
    this.diveTimer = 3500;

    this.createBackground();
    this.generateTextures();

    // Physics groups (order matters for overlap setup)
    this.playerBullets = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();
    this.enemyGroup = this.physics.add.group();

    this.populateFormation();
    this.createPlayer();

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.fireKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.leftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.rightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    // Collisions
    this.physics.add.overlap(
      this.playerBullets,
      this.enemyGroup,
      (b, e) => this.onBulletHitEnemy(
        b as Phaser.Physics.Arcade.Sprite,
        e as Phaser.Physics.Arcade.Sprite
      )
    );
    this.physics.add.overlap(
      this.enemyBullets,
      this.player,
      (b, _p) => this.onEnemyBulletHitPlayer(b as Phaser.Physics.Arcade.Sprite)
    );
    this.physics.add.overlap(
      this.enemyGroup,
      this.player,
      (e, _p) => this.onEnemyHitPlayer(e as Phaser.Physics.Arcade.Sprite)
    );

    // Launch HUD (stop first in case it's already running)
    this.scene.stop('UIScene');
    this.scene.launch('UIScene');
  }

  // ─────────────────────────────────────────
  //  Background
  // ─────────────────────────────────────────
  private createBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x000011, 0x000011, 0x000033, 0x000033, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Nebula clouds
    const neb = this.add.graphics().setDepth(0);
    neb.fillStyle(0x0a0044, 0.45);
    neb.fillEllipse(260, 340, 520, 280);
    neb.fillStyle(0x001a11, 0.35);
    neb.fillEllipse(980, 440, 420, 260);
    neb.fillStyle(0x330011, 0.2);
    neb.fillEllipse(640, 600, 360, 200);

    // Stars (3 brightness layers)
    const starGfx = this.add.graphics().setDepth(0);
    for (let i = 0; i < 200; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, GAME_HEIGHT);
      const r  = Phaser.Math.FloatBetween(0.4, 2.2);
      const a  = Phaser.Math.FloatBetween(0.2, 1.0);
      starGfx.fillStyle(0xffffff, a);
      starGfx.fillCircle(sx, sy, r);
    }

    // Player zone divider
    const divider = this.add.graphics().setDepth(1);
    divider.lineStyle(1, 0x334466, 0.5);
    divider.beginPath();
    divider.moveTo(0, GAME_HEIGHT - 100);
    divider.lineTo(GAME_WIDTH, GAME_HEIGHT - 100);
    divider.strokePath();
  }

  // ─────────────────────────────────────────
  //  Texture generation (cached on first run)
  // ─────────────────────────────────────────
  private generateTextures(): void {
    if (this.textures.exists('player')) return;

    // ── Player ship (40 × 52) ──────────────
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xff6600, 0.7);           // engine glow
      g.fillEllipse(20, 50, 16, 8);
      g.fillStyle(0x1a44cc);                // main hull
      g.fillTriangle(20, 2, 4, 46, 36, 46);
      g.fillStyle(0x0d2f99);                // wings
      g.fillTriangle(20, 22, 0, 50, 13, 35);
      g.fillTriangle(20, 22, 40, 50, 27, 35);
      g.fillStyle(0x4477ee);                // hull highlight
      g.fillTriangle(20, 5, 13, 28, 27, 28);
      g.fillStyle(0x99ddff);                // cockpit
      g.fillCircle(20, 20, 5);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(19, 19, 2);
      g.fillStyle(0xffff00);                // engine core
      g.fillRect(15, 44, 10, 6);
      g.generateTexture('player', 40, 52);
      g.destroy();
    }

    // ── Enemy Type 0: Flagship (44 × 34) ──
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x991111);
      g.fillEllipse(22, 16, 40, 24);
      g.fillStyle(0x770d0d);
      g.fillTriangle(22, 8, 0, 30, 14, 18);
      g.fillTriangle(22, 8, 44, 30, 30, 18);
      g.fillStyle(0xffcc00);                // gold dome
      g.fillCircle(22, 14, 10);
      g.fillStyle(0xffee88);
      g.fillCircle(22, 12, 6);
      g.fillStyle(0xff2222);                // eyes
      g.fillCircle(16, 13, 3.5);
      g.fillCircle(28, 13, 3.5);
      g.fillStyle(0xffffff);
      g.fillCircle(17, 12, 1.8);
      g.fillCircle(29, 12, 1.8);
      g.lineStyle(2, 0xffcc00, 1);          // antenna
      g.beginPath(); g.moveTo(22, 4); g.lineTo(22, 0); g.strokePath();
      g.fillStyle(0xffcc00);
      g.fillCircle(22, 0, 3);
      g.generateTexture('enemy0', 44, 34);
      g.destroy();
    }

    // ── Enemy Type 1: Mid escort (38 × 28) ──
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x1155cc);
      g.fillEllipse(19, 13, 32, 20);
      g.fillStyle(0x0c3d99);
      g.fillTriangle(19, 7, 0, 24, 12, 15);
      g.fillTriangle(19, 7, 38, 24, 26, 15);
      g.fillStyle(0xaaddff);
      g.fillCircle(19, 11, 7);
      g.fillStyle(0x77bbff);
      g.fillCircle(19, 10, 4);
      g.fillStyle(0xffeedd);                // eyes
      g.fillCircle(13, 10, 2.5);
      g.fillCircle(25, 10, 2.5);
      g.fillStyle(0xff4400);
      g.fillCircle(13, 10, 1.2);
      g.fillCircle(25, 10, 1.2);
      g.generateTexture('enemy1', 38, 28);
      g.destroy();
    }

    // ── Enemy Type 2: Drone (34 × 26) ──────
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x119944);
      g.fillEllipse(17, 12, 28, 18);
      g.fillStyle(0x0d7733);
      g.fillTriangle(17, 7, 0, 22, 10, 14);
      g.fillTriangle(17, 7, 34, 22, 24, 14);
      g.fillStyle(0x77ffaa);
      g.fillCircle(17, 10, 6);
      g.fillStyle(0xccffdd);
      g.fillCircle(17, 9, 3);
      g.fillStyle(0xffff55);                // eyes
      g.fillCircle(12, 9, 2.2);
      g.fillCircle(22, 9, 2.2);
      g.fillStyle(0x884400);
      g.fillCircle(12, 9, 1.1);
      g.fillCircle(22, 9, 1.1);
      g.generateTexture('enemy2', 34, 26);
      g.destroy();
    }

    // ── Player bullet (6 × 18) ─────────────
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff);
      g.fillRect(2, 0, 2, 5);
      g.fillStyle(0xffff00);
      g.fillRect(1, 3, 4, 15);
      g.generateTexture('pbullet', 6, 18);
      g.destroy();
    }

    // ── Enemy bullet (8 × 14) ──────────────
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xff8844);
      g.fillRect(2, 0, 4, 14);
      g.fillStyle(0xff3300);
      g.fillRect(1, 4, 6, 6);
      g.generateTexture('ebullet', 8, 14);
      g.destroy();
    }
  }

  // ─────────────────────────────────────────
  //  Player creation
  // ─────────────────────────────────────────
  private createPlayer(): void {
    this.player = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 60, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(3);
    // Idle engine-bob
    this.tweens.add({
      targets: this.player,
      y: this.player.y - 5,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ─────────────────────────────────────────
  //  Formation
  // ─────────────────────────────────────────
  private populateFormation(): void {
    this.enemyGroup.clear(true, true);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const type   = row === 0 ? 0 : row <= 2 ? 1 : 2;
        const homeX  = FORMATION_X + col * CELL_W;
        const homeY  = FORMATION_Y + row * CELL_H;
        const enemy  = this.enemyGroup.create(homeX, homeY, `enemy${type}`) as Phaser.Physics.Arcade.Sprite;

        enemy.setDepth(2);
        enemy.setData('type',    type);
        enemy.setData('homeX',   homeX);
        enemy.setData('homeY',   homeY);
        enemy.setData('isDiving',  false);
        enemy.setData('divePhase', 0);

        // Idle pulse
        this.tweens.add({
          targets:  enemy,
          scaleX:   1.12,
          scaleY:   0.88,
          duration: 480 + Phaser.Math.Between(0, 320),
          yoyo:     true,
          repeat:   -1,
          ease:     'Sine.easeInOut',
        });
      }
    }
  }

  // ─────────────────────────────────────────
  //  Update loop
  // ─────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (this.isGameOver) return;

    this.shootCooldown    -= delta;
    this.enemyShootTimer  -= delta;
    this.diveTimer        -= delta;

    this.handleInput();
    this.updateFormation(delta);
    this.updateDivingEnemies(delta);
    this.cleanupBullets();

    if (this.enemyShootTimer <= 0) this.enemyShoot();
    if (this.diveTimer        <= 0) this.triggerDive();
  }

  // ─────────────────────────────────────────
  //  Input
  // ─────────────────────────────────────────
  private handleInput(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);

    if (this.cursors.left.isDown  || this.leftKey.isDown)  body.setVelocityX(-320);
    if (this.cursors.right.isDown || this.rightKey.isDown) body.setVelocityX(320);

    if (Phaser.Input.Keyboard.JustDown(this.fireKey) && this.shootCooldown <= 0) {
      const bullet = this.playerBullets.create(
        this.player.x, this.player.y - 28, 'pbullet'
      ) as Phaser.Physics.Arcade.Sprite;
      bullet.setDepth(3);
      (bullet.body as Phaser.Physics.Arcade.Body).setVelocityY(-720);
      this.shootCooldown = 340;
    }
  }

  // ─────────────────────────────────────────
  //  Formation movement
  // ─────────────────────────────────────────
  private updateFormation(delta: number): void {
    const speed = (52 + this.level * 7) * (delta / 1000);
    this.formationOffset += this.formationDirX * speed;

    let minX = Infinity, maxX = -Infinity;
    for (const obj of this.enemyGroup.getChildren()) {
      const e = obj as Phaser.Physics.Arcade.Sprite;
      if (!e.active || e.getData('isDiving')) continue;
      const hx = (e.getData('homeX') as number) + this.formationOffset;
      if (hx < minX) minX = hx;
      if (hx > maxX) maxX = hx;
    }

    if (minX === Infinity) return;

    if (maxX > GAME_WIDTH - 38 && this.formationDirX > 0) {
      this.formationDirX = -1;
      this.formationDropY += 12;
    } else if (minX < 38 && this.formationDirX < 0) {
      this.formationDirX = 1;
      this.formationDropY += 12;
    }

    for (const obj of this.enemyGroup.getChildren()) {
      const e = obj as Phaser.Physics.Arcade.Sprite;
      if (!e.active || e.getData('isDiving')) continue;
      const hx = (e.getData('homeX') as number) + this.formationOffset;
      const hy = (e.getData('homeY') as number) + this.formationDropY;
      (e.body as Phaser.Physics.Arcade.Body).reset(hx, hy);
    }
  }

  // ─────────────────────────────────────────
  //  Diving enemy AI
  // ─────────────────────────────────────────
  private updateDivingEnemies(delta: number): void {
    const dt = delta / 1000;

    for (let i = this.divingEnemies.length - 1; i >= 0; i--) {
      const e = this.divingEnemies[i];
      if (!e.active) { this.divingEnemies.splice(i, 1); continue; }

      const body  = e.body as Phaser.Physics.Arcade.Body;
      const phase = e.getData('divePhase') as number;

      if (phase === 0) {
        // ── Diving toward player ──
        if (e.y > GAME_HEIGHT + 90) {
          e.setData('divePhase', 1);
          body.setVelocity(0, 0);
        } else {
          const diveSpeed = 240 + this.level * 22;
          const dx = this.player.x - e.x;
          const dy = this.player.y - e.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const tvx = (dx / len) * diveSpeed;
          const tvy = (dy / len) * diveSpeed;
          const steer = Math.min(1, 3.5 * dt);
          const nvx = body.velocity.x + (tvx - body.velocity.x) * steer;
          const nvy = body.velocity.y + (tvy - body.velocity.y) * steer;
          body.setVelocity(nvx, nvy);
          e.setAngle(Math.atan2(nvx, -nvy) * Phaser.Math.RAD_TO_DEG);
        }
      } else {
        // ── Returning to formation ──
        const hx = (e.getData('homeX') as number) + this.formationOffset;
        const hy = (e.getData('homeY') as number) + this.formationDropY;
        const dx = hx - e.x;
        const dy = hy - e.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;

        if (len < 14) {
          body.reset(hx, hy);
          e.setAngle(0);
          e.setData('isDiving', false);
          this.divingEnemies.splice(i, 1);
        } else {
          const rs = 200;
          body.setVelocity((dx / len) * rs, (dy / len) * rs);
          e.setAngle(Math.atan2(dx, -dy) * Phaser.Math.RAD_TO_DEG);
        }
      }
    }
  }

  // ─────────────────────────────────────────
  //  Enemy shooting
  // ─────────────────────────────────────────
  private enemyShoot(): void {
    this.enemyShootTimer = Math.max(700, 1900 - this.level * 120);
    const active = (this.enemyGroup.getChildren() as Phaser.Physics.Arcade.Sprite[])
      .filter(e => e.active);
    if (!active.length) return;

    // Prefer enemies near the player's x
    const sorted = [...active].sort(
      (a, b) => Math.abs(a.x - this.player.x) - Math.abs(b.x - this.player.x)
    );
    const shooter = sorted[Phaser.Math.Between(0, Math.min(3, sorted.length - 1))];

    const bullet = this.enemyBullets.create(shooter.x, shooter.y + 16, 'ebullet') as Phaser.Physics.Arcade.Sprite;
    bullet.setDepth(3);
    (bullet.body as Phaser.Physics.Arcade.Body).setVelocityY(370 + this.level * 28);
  }

  // ─────────────────────────────────────────
  //  Trigger dive attack
  // ─────────────────────────────────────────
  private triggerDive(): void {
    this.diveTimer = Math.max(1200, 3500 - this.level * 220);

    const available = (this.enemyGroup.getChildren() as Phaser.Physics.Arcade.Sprite[])
      .filter(e => e.active && !e.getData('isDiving'));
    if (available.length <= 4) return;

    // Flagships dive more often
    const flagships = available.filter(e => e.getData('type') === 0);
    const pool = (flagships.length > 0 && Math.random() < 0.5) ? flagships : available;
    const diver = Phaser.Utils.Array.GetRandom(pool) as Phaser.Physics.Arcade.Sprite | undefined;
    if (!diver) return;

    diver.setData('isDiving', true);
    diver.setData('divePhase', 0);
    (diver.body as Phaser.Physics.Arcade.Body).setVelocity(0, 90);
    this.divingEnemies.push(diver);
  }

  // ─────────────────────────────────────────
  //  Bullet cleanup
  // ─────────────────────────────────────────
  private cleanupBullets(): void {
    for (const b of this.playerBullets.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (b.active && b.y < -20) b.destroy();
    }
    for (const b of this.enemyBullets.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (b.active && b.y > GAME_HEIGHT + 20) b.destroy();
    }
  }

  // ─────────────────────────────────────────
  //  Collision handlers
  // ─────────────────────────────────────────
  private onBulletHitEnemy(
    bullet: Phaser.Physics.Arcade.Sprite,
    enemy:  Phaser.Physics.Arcade.Sprite
  ): void {
    if (!bullet.active || !enemy.active) return;

    bullet.destroy();
    const type = enemy.getData('type') as number;
    const pts  = ENEMY_POINTS[type];

    this.spawnExplosion(enemy.x, enemy.y, type);
    this.showPointPopup(enemy.x, enemy.y, pts);

    const idx = this.divingEnemies.indexOf(enemy);
    if (idx >= 0) this.divingEnemies.splice(idx, 1);
    enemy.destroy();

    this.score += pts;
    this.events.emit('score', pts);

    const alive = (this.enemyGroup.getChildren() as Phaser.Physics.Arcade.Sprite[])
      .filter(e => e.active);
    if (alive.length === 0) this.advanceLevel();
  }

  private onEnemyBulletHitPlayer(bullet: Phaser.Physics.Arcade.Sprite): void {
    if (!bullet.active || this.playerInvincible) return;
    bullet.destroy();
    this.hitPlayer();
  }

  private onEnemyHitPlayer(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!enemy.active || this.playerInvincible) return;
    if (!(enemy.getData('isDiving') as boolean)) return;

    this.spawnExplosion(enemy.x, enemy.y, enemy.getData('type') as number);
    const idx = this.divingEnemies.indexOf(enemy);
    if (idx >= 0) this.divingEnemies.splice(idx, 1);
    enemy.destroy();
    this.hitPlayer();
  }

  // ─────────────────────────────────────────
  //  Player hit
  // ─────────────────────────────────────────
  private hitPlayer(): void {
    if (this.playerInvincible) return;
    this.lives--;
    this.events.emit('updateLives', this.lives);
    this.spawnExplosion(this.player.x, this.player.y, -1);

    if (this.lives <= 0) {
      this.player.setVisible(false);
      this.time.delayedCall(1600, () => this.showGameOver());
    } else {
      this.playerInvincible = true;
      this.tweens.add({
        targets:  this.player,
        alpha:    0.15,
        duration: 110,
        yoyo:     true,
        repeat:   9,
        onComplete: () => {
          this.player.setAlpha(1);
          this.playerInvincible = false;
        },
      });
    }
  }

  // ─────────────────────────────────────────
  //  Explosion (tweened graphics particles)
  // ─────────────────────────────────────────
  private spawnExplosion(x: number, y: number, type: number): void {
    const palettes: number[][] = [
      [0xff2200, 0xff8800, 0xffcc00],  // flagship
      [0x2244ff, 0x88bbff, 0xffffff],  // mid escort
      [0x22bb55, 0x88ff44, 0xffff44],  // drone
      [0xff8800, 0xffffff, 0xffff00],  // player
    ];
    const pal = type >= 0 ? palettes[Math.min(type, 2)] : palettes[3];

    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 55 + Math.random() * 170;
      const size  = 2 + Math.random() * 4;
      const g     = this.add.graphics();
      g.fillStyle(pal[Math.floor(Math.random() * pal.length)], 1);
      g.fillCircle(0, 0, size);
      g.setPosition(x, y);
      g.setDepth(4);

      this.tweens.add({
        targets:  g,
        x:        x + Math.cos(angle) * speed * 0.65,
        y:        y + Math.sin(angle) * speed * 0.65,
        alpha:    0,
        scaleX:   0,
        scaleY:   0,
        duration: 480 + Math.random() * 280,
        ease:     'Power2',
        onComplete: () => g.destroy(),
      });
    }

    // Flash ring
    const ring = this.add.graphics();
    ring.lineStyle(3, 0xffffff, 1);
    ring.strokeCircle(x, y, 8);
    ring.setDepth(4);
    this.tweens.add({
      targets:  ring,
      scaleX:   3,
      scaleY:   3,
      alpha:    0,
      duration: 350,
      ease:     'Power2',
      onComplete: () => ring.destroy(),
    });
  }

  // ─────────────────────────────────────────
  //  Score popup
  // ─────────────────────────────────────────
  private showPointPopup(x: number, y: number, pts: number): void {
    const txt = this.add.text(x, y - 8, `+${pts}`, {
      fontSize:        '17px',
      color:           '#ffff00',
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    this.tweens.add({
      targets:  txt,
      y:        y - 64,
      alpha:    0,
      duration: 900,
      ease:     'Power2',
      onComplete: () => txt.destroy(),
    });
  }

  // ─────────────────────────────────────────
  //  Level advance
  // ─────────────────────────────────────────
  private advanceLevel(): void {
    this.level++;
    this.formationOffset = 0;
    this.formationDropY  = 0;
    this.formationDirX   = 1;
    this.divingEnemies   = [];
    this.enemyBullets.clear(true, true);
    this.events.emit('updateLevel', this.level);

    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `WAVE  ${this.level}`, {
      fontSize:        '56px',
      color:           '#ffffff',
      fontStyle:       'bold',
      stroke:          '#0033cc',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets:  banner,
      scaleX:   1.5,
      scaleY:   1.5,
      alpha:    0,
      duration: 2200,
      ease:     'Power2Out',
      onComplete: () => {
        banner.destroy();
        this.populateFormation();
      },
    });
  }

  // ─────────────────────────────────────────
  //  Game Over
  // ─────────────────────────────────────────
  private showGameOver(): void {
    this.isGameOver = true;

    const overlay = this.add.graphics().setDepth(19);
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const goTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, 'GAME OVER', {
      fontSize:        '64px',
      color:           '#ff3333',
      fontStyle:       'bold',
      stroke:          '#880000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets:  goTxt,
      scaleX:   1.1,
      scaleY:   1.1,
      duration: 550,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `SCORE   ${this.score}`, {
      fontSize:        '32px',
      color:           '#ffffff',
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 55, `WAVE  ${this.level}`, {
      fontSize: '22px',
      color:    '#aaaaff',
    }).setOrigin(0.5).setDepth(20);

    const restartTxt = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100,
      'Press  SPACE  to  play  again',
      { fontSize: '22px', color: '#99aaff' }
    ).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets:  restartTxt,
      alpha:    0.2,
      duration: 700,
      yoyo:     true,
      repeat:   -1,
    });

    this.time.delayedCall(1200, () => {
      this.input.keyboard!.once('keydown-SPACE', () => {
        this.scene.restart();
      });
    });
  }
}
