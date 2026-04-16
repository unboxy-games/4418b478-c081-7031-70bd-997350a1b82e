import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// ── Constants ─────────────────────────────────────────────────────────────────
const SPEED      = 450;               // auto-scroll px/s
const JUMP_VEL   = -900;              // upward velocity on jump
const GRAVITY    = 2800;              // world gravity (high = snappy GD-style fall)
const GROUND_TOP = GAME_HEIGHT - 150; // y=570, top surface of ground
const GROUND_H   = 150;
const B          = 60;               // base block/tile size in px
const WORLD_W    = 13000;            // total level width

type OType = 's' | 'b'; // spike | block obstacle

/** [worldX, type, count] – count = number of obstacles placed side-by-side */
const LEVEL: [number, OType, number][] = [
  // ── warm-up: single spikes ──
  [  800, 's', 1], [ 1060, 's', 1], [ 1320, 's', 1], [ 1640, 's', 1], [ 1960, 's', 1],
  // ── double spikes ──
  [ 2300, 's', 2], [ 2620, 's', 1], [ 2880, 's', 2], [ 3150, 's', 1], [ 3420, 's', 2],
  // ── block obstacles + mixed ──
  [ 3750, 'b', 1], [ 3980, 's', 1], [ 4160, 's', 2],
  [ 4500, 'b', 2], [ 4820, 's', 1], [ 5080, 's', 3],
  [ 5420, 'b', 1], [ 5680, 's', 1], [ 5900, 's', 2],
  // ── triple spikes ──
  [ 6180, 's', 3], [ 6530, 's', 2], [ 6790, 's', 3],
  [ 7080, 'b', 2], [ 7380, 's', 3], [ 7640, 's', 1], [ 7840, 's', 3],
  // ── intense section ──
  [ 8120, 's', 2], [ 8380, 's', 3], [ 8750, 's', 2], [ 8960, 's', 3],
  [ 9260, 'b', 1], [ 9500, 's', 3], [ 9750, 's', 2], [10010, 's', 3],
  // ── final stretch ──
  [10300, 's', 3], [10580, 's', 2], [10840, 's', 3],
  [11130, 's', 3], [11380, 's', 2], [11680, 's', 3],
  [11980, 's', 3], [12270, 's', 2], [12560, 's', 3],
];

// ─────────────────────────────────────────────────────────────────────────────

export class GameScene extends Phaser.Scene {
  private player!:       Phaser.Physics.Arcade.Image;
  private groundStatic!: Phaser.GameObjects.Rectangle;
  private obstacles!:    Phaser.Physics.Arcade.StaticGroup;  // spikes → lethal on any touch
  private platforms!:    Phaser.Physics.Arcade.StaticGroup;  // blocks → land on top, lethal on side

  private bgLayers:      Phaser.GameObjects.TileSprite[] = [];
  private progressFill!: Phaser.GameObjects.Rectangle;
  private percentTxt!:   Phaser.GameObjects.Text;
  private attemptTxt!:   Phaser.GameObjects.Text;
  private deathFx!:      Phaser.GameObjects.Particles.ParticleEmitter;
  private dustFx!:       Phaser.GameObjects.Particles.ParticleEmitter;

  private alive              = true;
  private attempt            = 1;
  private wasGrounded        = false;
  private cubeRot            = 0;
  private jumpsLeft          = 2;   // 2 = both jumps available, 0 = no jumps left
  private waitingForRestart  = false;
  private isPaused           = false;
  private pauseContents:     Phaser.GameObjects.GameObject[] = [];
  private pauseBtnX          = 0;
  private pauseBtnY          = 0;
  private pauseIconGfx!:     Phaser.GameObjects.Graphics;

  constructor() { super({ key: 'GameScene' }); }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    this.alive              = true;
    this.cubeRot            = 0;
    this.wasGrounded        = false;
    this.jumpsLeft          = 2;
    this.waitingForRestart  = false;
    this.isPaused           = false;
    this.pauseContents      = [];
    this.attempt     = (this.game.registry.get('attempt') as number) ?? 1;

    this.physics.world.setBounds(0, 0, WORLD_W, GAME_HEIGHT);
    this.physics.world.gravity.y = GRAVITY;

    this.buildTextures();
    this.buildBackground();
    this.buildGround();
    this.buildLevel();
    this.buildPlayer();
    this.buildParticles();
    this.buildHUD();
    this.buildCamera();
    this.buildInput();

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }
  }

  update(_t: number, dt: number): void {
    if (!this.alive || this.isPaused) return;

    const body     = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down;

    // auto-scroll
    body.setVelocityX(SPEED);

    // ── cube rotation ──
    if (!grounded) {
      // spin clockwise while airborne (~216°/s ≈ 90° per quarter-jump)
      this.cubeRot += 6 * (dt / 16.67);
    } else {
      // snap to nearest 90° when landing
      const snap = Math.round(this.cubeRot / 90) * 90;
      this.cubeRot += (snap - this.cubeRot) * 0.35;

      // first grounded frame: refill jumps + dust burst
      if (!this.wasGrounded) {
        this.jumpsLeft = 2;
        // spawn dust at the player's feet, works for ground and platforms
        const footY = this.player.y + (B - 8) / 2;
        this.dustFx.setPosition(this.player.x, footY);
        this.dustFx.explode(8);
      }
    }
    this.player.setAngle(this.cubeRot);
    this.wasGrounded = grounded;

    // ── parallax BG ──
    const cx     = this.cameras.main.scrollX;
    const speeds = [0.1, 0.3, 0.55];
    this.bgLayers.forEach((layer, i) => { layer.tilePositionX = cx * speeds[i]; });

    // ── progress bar ──
    const pct = Math.min(this.player.x / WORLD_W, 1);
    this.progressFill.setSize((GAME_WIDTH - 60) * pct, 8);
    this.percentTxt.setText(Math.floor(pct * 100) + '%');

    // ── win check ──
    if (this.player.x >= WORLD_W - 300) this.onWin();

    // ── fall-off check: treat dropping below the screen as a death ──
    if (this.player.y > GAME_HEIGHT + 100) this.onDeath();
  }

  // ── texture generation ────────────────────────────────────────────────────

  private buildTextures(): void {
    const mk = (
      key: string, w: number, h: number,
      fn: (g: Phaser.GameObjects.Graphics) => void
    ) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      fn(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    // ── player cube ──
    mk('cube', B, B, g => {
      g.fillStyle(0x0055bb, 0.25);
      g.fillRoundedRect(-5, -5, B + 10, B + 10, 12);     // outer glow
      g.fillStyle(0x1188ff);
      g.fillRoundedRect(0, 0, B, B, 9);                   // main body
      g.fillStyle(0x66bbff, 0.5);
      g.fillRoundedRect(4, 4, B - 8, 18, 5);              // top sheen
      g.fillStyle(0x002288);
      g.fillRoundedRect(13, 13, B - 26, B - 26, 3);       // inner dark square
      const cx = B / 2, cy = B / 2, r = 10;
      g.fillStyle(0x55ddff);
      g.fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r); // diamond: right half
      g.fillTriangle(cx, cy - r, cx - r, cy, cx, cy + r); // diamond: left half
      g.lineStyle(2, 0x88ddff);
      g.strokeRoundedRect(0, 0, B, B, 9);                 // border
    });

    // ── spike ──
    mk('spike', B, B, g => {
      g.fillStyle(0xffcc00);
      g.fillTriangle(B / 2, 1, B - 1, B, 1, B);
      g.fillStyle(0xffffff, 0.4);
      g.fillTriangle(B / 2, 7, B - 15, B - 9, 15, B - 9); // highlight
      g.lineStyle(2, 0xffee44);
      g.strokeTriangle(B / 2, 1, B - 1, B, 1, B);
    });

    // ── block obstacle ──
    mk('blockObs', B, B, g => {
      g.fillStyle(0xcc2200);
      g.fillRoundedRect(0, 0, B, B, 5);
      g.fillStyle(0xff5533, 0.5);
      g.fillRoundedRect(4, 4, B - 8, 18, 3);              // sheen
      g.lineStyle(2, 0xff6644);
      g.strokeRoundedRect(0, 0, B, B, 5);
      g.lineStyle(1, 0xff3300, 0.45);
      g.lineBetween(B / 2, 5, B / 2, B - 5);              // cross detail
      g.lineBetween(5, B / 2, B - 5, B / 2);
    });

    // ── ground tile ──
    mk('groundTile', B, B, g => {
      g.fillStyle(0x172535);
      g.fillRect(0, 0, B, B);
      g.fillStyle(0x1e3348, 0.85);
      g.fillRect(2, 2, B - 4, 14);                        // top panel
      g.lineStyle(1, 0x263d55);
      g.strokeRect(0, 0, B, B);
      g.lineStyle(2, 0x3366aa, 0.75);
      g.lineBetween(0, 0, B, 0);                          // top glow edge
    });

    // ── parallax BG textures (transparent background, shapes only) ──
    mk('bgFar', 400, 200, g => {
      g.fillStyle(0x1a2870, 0.45);
      g.fillRoundedRect(20, 20, 70, 70, 6);
      g.fillRoundedRect(210, 90, 90, 50, 6);
      g.fillRoundedRect(320, 25, 50, 50, 4);
      g.lineStyle(1, 0x2233bb, 0.35);
      g.strokeRoundedRect(20, 20, 70, 70, 6);
      g.strokeRoundedRect(210, 90, 90, 50, 6);
    });

    mk('bgMid', 500, 250, g => {
      g.fillStyle(0x162060, 0.35);
      g.fillRoundedRect(30, 30, 110, 110, 8);
      g.fillRoundedRect(270, 70, 130, 65, 6);
      g.lineStyle(1, 0x2244bb, 0.3);
      g.strokeRoundedRect(30, 30, 110, 110, 8);
    });

    mk('bgNear', 600, 300, g => {
      g.fillStyle(0x1a2a6a, 0.3);
      g.fillRoundedRect(50, 50, 150, 150, 10);
      g.fillRoundedRect(370, 80, 90, 90, 8);
      g.lineStyle(1, 0x3355cc, 0.25);
      g.strokeRoundedRect(50, 50, 150, 150, 10);
    });

    // ── particle textures ──
    mk('pixel',   2, 2, g => { g.fillStyle(0xffffff); g.fillRect(0, 0, 2, 2); });
    mk('pSquare', 8, 8, g => { g.fillStyle(0x44aaff); g.fillRect(0, 0, 8, 8); });
    mk('pDot',    6, 6, g => { g.fillStyle(0xaaccff); g.fillCircle(3, 3, 3); });
  }

  // ── background ────────────────────────────────────────────────────────────

  private buildBackground(): void {
    // Sky gradient (fixed to camera)
    const sky = this.add.graphics().setDepth(0).setScrollFactor(0);
    sky.fillGradientStyle(0x040918, 0x040918, 0x0c1e50, 0x0c1e50);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Stars (fixed, distant — no parallax)
    const stars = this.add.graphics().setDepth(1).setScrollFactor(0);
    for (let i = 0; i < 170; i++) {
      const sx   = Phaser.Math.Between(0, GAME_WIDTH);
      const sy   = Phaser.Math.Between(0, GROUND_TOP - 30);
      const size = Math.random() > 0.85 ? 2 : 1;
      stars.fillStyle(0xffffff, Math.random() * 0.55 + 0.25);
      stars.fillCircle(sx, sy, size);
    }

    // Parallax tile sprites (screen-fixed, tilePositionX updated per frame)
    const layerDefs = [
      { key: 'bgFar',  y: 50,  h: 200, alpha: 0.65 },
      { key: 'bgMid',  y: 100, h: 260, alpha: 0.55 },
      { key: 'bgNear', y: 150, h: 310, alpha: 0.45 },
    ];
    this.bgLayers = layerDefs.map((d, i) =>
      this.add.tileSprite(0, d.y, GAME_WIDTH, d.h, d.key)
        .setOrigin(0, 0)
        .setAlpha(d.alpha)
        .setDepth(2 + i)
        .setScrollFactor(0)
    );
  }

  // ── ground ─────────────────────────────────────────────────────────────────

  private buildGround(): void {
    // Visual tiled surface
    this.add.tileSprite(0, GROUND_TOP, WORLD_W, GROUND_H, 'groundTile')
      .setOrigin(0, 0).setDepth(5);

    // Glow line along the top edge
    const glow = this.add.graphics().setDepth(6);
    glow.lineStyle(4, 0x2266cc, 0.75);
    glow.lineBetween(0, GROUND_TOP, WORLD_W, GROUND_TOP);
    glow.lineStyle(10, 0x0d3399, 0.2);
    glow.lineBetween(0, GROUND_TOP, WORLD_W, GROUND_TOP);

    // Invisible static physics body spanning the full world width.
    // Using add.rectangle + physics.add.existing so the body dimensions
    // are derived directly from the Rectangle's width/height — much more
    // reliable than manually calling setSize on a tiny staticImage.
    this.groundStatic = this.add
      .rectangle(WORLD_W / 2, GROUND_TOP + GROUND_H / 2, WORLD_W, GROUND_H)
      .setAlpha(0)
      .setDepth(5);
    this.physics.add.existing(this.groundStatic, true); // true = static body
  }

  // ── level obstacles ────────────────────────────────────────────────────────

  private buildLevel(): void {
    this.obstacles = this.physics.add.staticGroup();  // spikes
    this.platforms = this.physics.add.staticGroup();  // landable blocks

    LEVEL.forEach(([wx, type, count]) => {
      for (let i = 0; i < count; i++) {
        const ox = wx + i * B + B / 2;
        const oy = GROUND_TOP - B / 2;

        if (type === 's') {
          // ── spike ─────────────────────────────────────────────────────────
          const img  = this.obstacles.create(ox, oy, 'spike') as Phaser.Physics.Arcade.Image;
          img.setDepth(7);
          const body = img.body as Phaser.Physics.Arcade.StaticBody;

          const sc = 0.65;
          const sw = B * sc;                          // ≈ 39 px
          img.setScale(sc);
          img.setY(GROUND_TOP - sw / 2);

          const bw = Math.round(16 * sc);             // ~10 px
          const bh = Math.round(40 * sc);             // ~26 px
          body.setSize(bw, bh);
          body.setOffset((sw - bw) / 2, 2);
          img.refreshBody();

        } else {
          // ── block platform ────────────────────────────────────────────────
          // Stacked to fill the full height from ground up.
          // We place one block sitting on the ground; for count > 1 blocks
          // placed side-by-side are already handled by the outer loop.
          const img  = this.platforms.create(ox, oy, 'blockObs') as Phaser.Physics.Arcade.Image;
          img.setDepth(7);
          const body = img.body as Phaser.Physics.Arcade.StaticBody;
          // Full-width body so the player lands flush on top;
          // 2 px inset on each side to avoid phantom corner collisions.
          body.setSize(B - 4, B - 4);
          body.setOffset(2, 2);
          img.refreshBody();
        }
      }
    });
  }

  // ── player ─────────────────────────────────────────────────────────────────

  private buildPlayer(): void {
    this.player = this.physics.add
      .image(200, GROUND_TOP - B / 2 - 2, 'cube')
      .setDepth(8);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(B - 8, B - 8);
    body.setCollideWorldBounds(false);
    body.setMaxVelocity(800, 1400);

    this.physics.add.collider(this.player, this.groundStatic);

    // Spikes — lethal on any touch
    this.physics.add.overlap(
      this.player,
      this.obstacles,
      () => this.onDeath(),
      undefined,
      this
    );

    // Blocks — act as platforms; lethal only when the player hits the side
    this.physics.add.collider(
      this.player,
      this.platforms,
      () => {
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        if (body.blocked.right || body.blocked.left) {
          this.onDeath();
        }
        // body.blocked.down → safely landed on top — no death
      },
      undefined,
      this
    );
  }

  // ── particles ─────────────────────────────────────────────────────────────

  private buildParticles(): void {
    this.deathFx = this.add.particles(0, 0, 'pSquare', {
      speed:    { min: 80, max: 420 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 1.1, end: 0 },
      alpha:    { start: 1, end: 0 },
      lifespan: 650,
      gravityY: 500,
      tint:     [0x44aaff, 0x88ddff, 0x2266cc, 0xffffff],
      quantity: 0,
      emitting: false,
    }).setDepth(12);

    this.dustFx = this.add.particles(0, 0, 'pDot', {
      speed:    { min: 20, max: 80 },
      angle:    { min: 150, max: 210 },
      scale:    { start: 0.6, end: 0 },
      alpha:    { start: 0.6, end: 0 },
      lifespan: 280,
      quantity: 0,
      emitting: false,
    }).setDepth(9);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private buildHUD(): void {
    const BAR_W = GAME_WIDTH - 60;

    // Progress bar background
    this.add.rectangle(GAME_WIDTH / 2, 18, BAR_W, 10, 0x050b22)
      .setScrollFactor(0).setDepth(20);

    // Progress bar fill (grows from left)
    this.progressFill = this.add
      .rectangle(30, 18, 0, 8, 0x1188ff)
      .setScrollFactor(0)
      .setDepth(21)
      .setOrigin(0, 0.5);

    // Bar border (stroke only)
    const border = this.add
      .rectangle(GAME_WIDTH / 2, 18, BAR_W, 10, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(22);
    border.setStrokeStyle(1, 0x4488cc, 0.7);

    // Percentage text
    this.percentTxt = this.add.text(GAME_WIDTH - 24, 13, '0%', {
      fontSize: '14px', color: '#88ccff', fontFamily: 'Arial',
    }).setScrollFactor(0).setDepth(22).setOrigin(1, 0);

    // Attempt counter
    this.attemptTxt = this.add.text(GAME_WIDTH / 2, 36, `Attempt  ${this.attempt}`, {
      fontSize: '18px', color: '#ffffff', fontFamily: 'Arial',
      fontStyle: 'bold', stroke: '#000033', strokeThickness: 3,
    }).setScrollFactor(0).setDepth(22).setOrigin(0.5, 0);

    // Pause button (top-right corner)
    this.buildPauseButton();

    // Controls hint (fades after 3 s)
    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 36,
      'SPACE / Click to Jump', {
        fontSize: '16px', color: '#8899bb',
        stroke: '#000022', strokeThickness: 2,
      }
    ).setScrollFactor(0).setDepth(22).setOrigin(0.5, 1);
    this.tweens.add({ targets: hint, alpha: 0, delay: 3000, duration: 800 });
  }

  // ── camera ─────────────────────────────────────────────────────────────────

  private buildCamera(): void {
    this.cameras.main
      .setBounds(0, 0, WORLD_W, GAME_HEIGHT)
      .startFollow(this.player, true, 0.12, 1)
      .setFollowOffset(-200, 0); // keeps player ~1/3 from left, showing more ahead
  }

  // ── input ──────────────────────────────────────────────────────────────────

  private buildInput(): void {
    const kb = this.input.keyboard!;

    const doAction = (ptr?: Phaser.Input.Pointer) => {
      // Check if the click landed on the pause button
      if (ptr) {
        const dx = Math.abs(ptr.x - this.pauseBtnX);
        const dy = Math.abs(ptr.y - this.pauseBtnY);
        if (dx <= 22 && dy <= 18) { this.togglePause(); return; }
      }
      if (this.isPaused) { this.togglePause(); return; } // click anywhere else = unpause
      if (this.waitingForRestart) { this.scene.restart(); return; }
      this.tryJump();
    };

    kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', doAction);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP).on('down',    doAction);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.togglePause());
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => doAction(ptr));
  }

  // ── gameplay ───────────────────────────────────────────────────────────────

  private tryJump(): void {
    if (!this.alive) return;
    if (this.jumpsLeft <= 0) return;

    const body        = this.player.body as Phaser.Physics.Arcade.Body;
    const isFirstJump = body.blocked.down;   // standing on ground

    // consume a jump and launch upward
    this.jumpsLeft--;
    body.setVelocityY(JUMP_VEL);

    if (!isFirstJump) {
      // ── double-jump visual feedback ──

      // quick scale pulse: cube squishes then pops
      this.tweens.add({
        targets:  this.player,
        scaleX:   1.35,
        scaleY:   0.70,
        duration: 70,
        yoyo:     true,
        ease:     'Sine.easeOut',
      });

      // cyan ring-burst from cube centre
      this.dustFx.setPosition(this.player.x, this.player.y);
      this.dustFx.explode(12);
    }
  }

  // ── pause button ──────────────────────────────────────────────────────────

  private buildPauseButton(): void {
    const bx = GAME_WIDTH - 38;
    const by = 52;
    this.pauseBtnX = bx;
    this.pauseBtnY = by;

    // Button background
    const bg = this.add.graphics().setScrollFactor(0).setDepth(25);
    bg.fillStyle(0x001133, 0.75);
    bg.fillRoundedRect(bx - 18, by - 14, 36, 28, 6);
    bg.lineStyle(1.5, 0x3366aa, 0.8);
    bg.strokeRoundedRect(bx - 18, by - 14, 36, 28, 6);

    // Pause / play icon (drawn separately so we can swap it)
    this.pauseIconGfx = this.add.graphics().setScrollFactor(0).setDepth(26);
    this.drawPauseIcon(true); // show "pause" bars (game is running)

    // Subtle hover highlight
    this.tweens.add({
      targets: bg, alpha: 0.75,
      yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut',
    });
  }

  private drawPauseIcon(showPauseBars: boolean): void {
    const bx = this.pauseBtnX;
    const by = this.pauseBtnY;
    this.pauseIconGfx.clear();
    this.pauseIconGfx.fillStyle(0x88bbff, 1);
    if (showPauseBars) {
      // ❙❙ two vertical bars
      this.pauseIconGfx.fillRect(bx - 8, by - 6, 5, 12);
      this.pauseIconGfx.fillRect(bx + 3, by - 6, 5, 12);
    } else {
      // ▶ play triangle
      this.pauseIconGfx.fillTriangle(bx - 6, by - 7, bx - 6, by + 7, bx + 9, by);
    }
  }

  private togglePause(): void {
    if (!this.alive) return; // no pause during death / win screens
    this.isPaused = !this.isPaused;
    this.drawPauseIcon(!this.isPaused); // bars = running, triangle = paused

    if (this.isPaused) {
      this.physics.pause();
      this.showPauseOverlay();
    } else {
      this.physics.resume();
      this.destroyPauseOverlay();
    }
  }

  private showPauseOverlay(): void {
    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000011, 0.65)
      .setScrollFactor(0).setDepth(27).setAlpha(0);

    const pauseTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 55, 'PAUSED', {
      fontSize: '68px', color: '#ffffff', fontStyle: 'bold',
      fontFamily: 'Arial', stroke: '#001133', strokeThickness: 9,
    }).setScrollFactor(0).setDepth(29).setOrigin(0.5).setAlpha(0).setScale(0.4);

    const resumeTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 28,
      'ESC  /  Click to Resume', {
        fontSize: '24px', color: '#aaccff',
        fontFamily: 'Arial', stroke: '#000022', strokeThickness: 3,
      }
    ).setScrollFactor(0).setDepth(29).setOrigin(0.5).setAlpha(0);

    this.pauseContents = [overlay, pauseTxt, resumeTxt];

    this.tweens.add({ targets: overlay,    alpha: 1,   duration: 220 });
    this.tweens.add({ targets: pauseTxt,   alpha: 1, scale: 1, ease: 'Back.Out', duration: 420 });
    this.tweens.add({ targets: resumeTxt,  alpha: 1,   delay: 220, duration: 350 });
    this.tweens.add({
      targets: resumeTxt, alpha: 0.25,
      yoyo: true, repeat: -1, duration: 700, delay: 700, ease: 'Sine.easeInOut',
    });
  }

  private destroyPauseOverlay(): void {
    this.pauseContents.forEach(obj => obj.destroy());
    this.pauseContents = [];
  }

  private onDeath(): void {
    if (!this.alive) return;
    this.alive = false;

    this.deathFx.setPosition(this.player.x, this.player.y);
    this.deathFx.explode(20);

    this.cameras.main.shake(300, 0.012);
    this.cameras.main.flash(200, 255, 60, 60, false);

    this.player.setVisible(false);

    // Persist incremented attempt count across the restart
    this.game.registry.set('attempt', this.attempt + 1);

    // Show restart screen after effects settle
    this.time.delayedCall(650, () => this.showRestartPrompt());
  }

  private showRestartPrompt(): void {
    // Semi-transparent dark overlay (camera-fixed)
    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(28).setAlpha(0);

    // "YOU DIED" header
    const deathTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'YOU DIED', {
      fontSize: '60px', color: '#ff3333', fontStyle: 'bold',
      fontFamily: 'Arial', stroke: '#000000', strokeThickness: 7,
    }).setScrollFactor(0).setDepth(30).setOrigin(0.5).setAlpha(0).setScale(0.4);

    // Attempt label
    const attemptNum = this.game.registry.get('attempt') as number;
    const attemptLbl = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10,
      `Attempt ${attemptNum - 1}`, {
        fontSize: '22px', color: '#aabbdd',
        fontFamily: 'Arial', stroke: '#000022', strokeThickness: 4,
      }
    ).setScrollFactor(0).setDepth(30).setOrigin(0.5).setAlpha(0);

    // "Tap or click to restart" prompt
    const restartTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 58,
      'Tap  /  Click  to  Restart', {
        fontSize: '26px', color: '#ffffff',
        fontFamily: 'Arial', stroke: '#000033', strokeThickness: 4,
      }
    ).setScrollFactor(0).setDepth(30).setOrigin(0.5).setAlpha(0);

    // Fade in overlay
    this.tweens.add({ targets: overlay, alpha: 1, duration: 350 });

    // Bounce in "YOU DIED"
    this.tweens.add({
      targets: deathTxt, alpha: 1, scale: 1,
      ease: 'Back.Out', duration: 550,
    });

    // Slide + fade in sub-labels
    this.tweens.add({ targets: attemptLbl, alpha: 1, delay: 350, duration: 400 });
    this.tweens.add({ targets: restartTxt, alpha: 1, delay: 550, duration: 400 });

    // Pulse the restart label
    this.tweens.add({
      targets: restartTxt, alpha: 0.25,
      yoyo: true, repeat: -1,
      duration: 650, delay: 1050,
      ease: 'Sine.easeInOut',
    });

    // Allow restart input — delayed slightly to prevent the death-tap from
    // immediately triggering a restart
    this.time.delayedCall(500, () => { this.waitingForRestart = true; });
  }

  private onWin(): void {
    if (!this.alive) return;
    this.alive = false;

    const txt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 35, 'LEVEL COMPLETE!', {
      fontSize: '56px', color: '#ffcc00', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setScrollFactor(0).setDepth(30).setOrigin(0.5).setAlpha(0).setScale(0.5);

    const sub = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 + 45,
      `Completed in ${this.attempt} attempt${this.attempt !== 1 ? 's' : ''}!`,
      { fontSize: '26px', color: '#ffffff', stroke: '#000033', strokeThickness: 4 }
    ).setScrollFactor(0).setDepth(30).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: txt, alpha: 1, scale: 1, ease: 'Back.Out', duration: 700 });
    this.tweens.add({ targets: sub, alpha: 1, delay: 500, duration: 600 });
    this.tweens.add({
      targets: txt, scaleX: 1.04, scaleY: 1.04,
      yoyo: true, repeat: -1, duration: 800, delay: 800, ease: 'Sine.easeInOut',
    });

    this.game.registry.set('attempt', 1);
    this.time.delayedCall(4500, () => this.scene.restart());
  }
}
