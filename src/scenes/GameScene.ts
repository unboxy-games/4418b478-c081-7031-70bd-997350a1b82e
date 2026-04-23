import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { activeRoom, clearActiveRoom } from '../gameState';
import { unboxyReady } from '../main';

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
  rexUI!: any; // mapped by UIPlugin scene plugin

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
  private personalBest       = 0;   // 0 = no best yet; highest % reached (0-100)
  private currentRunMaxPct   = 0;   // max % reached in the current run
  private pauseBtnX          = 0;
  private pauseBtnY          = 0;
  private pauseIconGfx!:     Phaser.GameObjects.Graphics;

  // ── Multiplayer state ──────────────────────────────────────────────────────
  private isMultiplayer      = false;
  private remotePlayer?:     Phaser.GameObjects.Image;
  private remoteTarget       = { x: 200, y: 0, angle: 0, alive: true };
  private remoteAlive        = true;
  private localNameTxt?:     Phaser.GameObjects.Text;
  private remoteNameTxt?:    Phaser.GameObjects.Text;
  private mpTimer?:          Phaser.Time.TimerEvent;
  private mpOffState?:       () => void;
  private mpOffLeave?:       () => void;

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
    this.remotePlayer       = undefined;
    this.localNameTxt       = undefined;
    this.remoteNameTxt      = undefined;
    this.remoteAlive        = true;
    this.attempt         = (this.game.registry.get('attempt') as number) ?? 1;
    this.currentRunMaxPct = 0;

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
    void this.loadPersonalBest();

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    // Multiplayer — wire up if the lobby handed us a room
    this.isMultiplayer = this.game.registry.get('multiplayer') === true;
    if (this.isMultiplayer) this.initMultiplayer();
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
    const pct    = Math.min(this.player.x / WORLD_W, 1);
    const pctInt = Math.floor(pct * 100);
    this.progressFill.setSize((GAME_WIDTH - 60) * pct, 8);
    this.percentTxt.setText(pctInt + '%');
    if (pctInt > this.currentRunMaxPct) this.currentRunMaxPct = pctInt;

    // ── win check ──
    if (this.player.x >= WORLD_W - 300) this.onWin();

    // ── fall-off check: treat dropping below the screen as a death ──
    if (this.player.y > GAME_HEIGHT + 100) this.onDeath();

    // ── multiplayer: lerp remote player + float name labels ──
    if (this.isMultiplayer) {
      if (this.remotePlayer && this.remoteAlive) {
        this.remotePlayer.x = Phaser.Math.Linear(this.remotePlayer.x, this.remoteTarget.x, 0.2);
        this.remotePlayer.y = Phaser.Math.Linear(this.remotePlayer.y, this.remoteTarget.y, 0.2);
        this.remotePlayer.setAngle(this.remoteTarget.angle);
      }
      if (this.localNameTxt) {
        this.localNameTxt.setPosition(this.player.x, this.player.y - B / 2 - 6);
      }
      if (this.remoteNameTxt && this.remotePlayer) {
        this.remoteNameTxt.setPosition(this.remotePlayer.x, this.remotePlayer.y - B / 2 - 6);
      }
    }
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

    // ── remote-player (player 2) cube — warm orange palette ──
    mk('cube2', B, B, g => {
      g.fillStyle(0xbb5500, 0.25);
      g.fillRoundedRect(-5, -5, B + 10, B + 10, 12);      // outer glow
      g.fillStyle(0xff8800);
      g.fillRoundedRect(0, 0, B, B, 9);                    // main body
      g.fillStyle(0xffcc66, 0.5);
      g.fillRoundedRect(4, 4, B - 8, 18, 5);               // top sheen
      g.fillStyle(0x662200);
      g.fillRoundedRect(13, 13, B - 26, B - 26, 3);        // inner dark square
      const cx = B / 2, cy = B / 2, r = 10;
      g.fillStyle(0xffdd44);
      g.fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r);  // diamond right
      g.fillTriangle(cx, cy - r, cx - r, cy, cx, cy + r);  // diamond left
      g.lineStyle(2, 0xffcc00);
      g.strokeRoundedRect(0, 0, B, B, 9);                  // border
    });

    // ── particle textures ──
    mk('pixel',   2, 2, g => { g.fillStyle(0xffffff); g.fillRect(0, 0, 2, 2); });
    mk('pSquare', 8, 8, g => { g.fillStyle(0x44aaff); g.fillRect(0, 0, 8, 8); });
    mk('pDot',    6, 6, g => { g.fillStyle(0xaaccff); g.fillCircle(3, 3, 3); });
    mk('pOrange', 8, 8, g => { g.fillStyle(0xff8800); g.fillRect(0, 0, 8, 8); });
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

  // ── high score & leaderboard ───────────────────────────────────────────────

  private async loadPersonalBest(): Promise<void> {
    try {
      const unboxy = await unboxyReady;
      if (!unboxy) return;
      const saved = await unboxy.saves.get<number>('highScore');
      this.personalBest = typeof saved === 'number' && saved > 0 ? saved : 0;
    } catch (err) {
      console.warn('[game] failed to load highScore', err);
    }
  }

  private async saveHighScore(attempts: number): Promise<void> {
    try {
      const unboxy = await unboxyReady;
      if (!unboxy) return;
      await unboxy.saves.set('highScore', attempts);
      if (unboxy.isAuthenticated && unboxy.user) {
        await this.submitLeaderboard(unboxy.user.id, unboxy.user.name ?? 'Player', attempts);
      }
    } catch (err) {
      console.warn('[game] failed to save highScore', err);
    }
  }

  private async submitLeaderboard(userId: string, userName: string, score: number): Promise<void> {
    type Entry = { name: string; score: number; at: number; userId: string };
    for (let i = 0; i < 3; i++) {
      try {
        const unboxy = await unboxyReady;
        if (!unboxy) return;
        const raw    = await unboxy.gameData.get<Entry[]>('leaderboard');
        const list   = Array.isArray(raw) ? raw : [];
        // Remove any previous entry for this user, add fresh one
        const filtered = list.filter(e => e && typeof e === 'object' && e.userId !== userId);
        const next = [...filtered, { name: userName, score, at: Date.now(), userId }]
          .sort((a, b) => b.score - a.score)  // descending: higher % = better
          .slice(0, 100);
        await unboxy.gameData.set('leaderboard', next);
        return;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code !== 'VERSION_MISMATCH') {
          console.warn('[game] leaderboard submit failed', err);
          return;
        }
        // VERSION_MISMATCH — re-read and retry
      }
    }
  }

  // ── multiplayer ────────────────────────────────────────────────────────────

  private initMultiplayer(): void {
    const room = activeRoom;
    if (!room) { this.isMultiplayer = false; return; }

    // Initialise remote target at player start position
    this.remoteTarget = { x: 200, y: GROUND_TOP - B / 2 - 2, angle: 0, alive: true };
    this.remoteAlive  = true;

    // Orange ghost cube for the remote player — world space, no physics
    this.remotePlayer = this.add
      .image(200, GROUND_TOP - B / 2 - 2, 'cube2')
      .setDepth(8).setAlpha(0.88);

    // Idle bob tween so it never looks frozen while waiting for first packet
    this.tweens.add({
      targets: this.remotePlayer, y: GROUND_TOP - B / 2 - 2 - 6,
      yoyo: true, repeat: -1, duration: 550, ease: 'Sine.easeInOut',
    });

    // Floating name labels (world space — follow cubes in update())
    this.localNameTxt = this.add.text(200, GROUND_TOP - B - 14, 'You', {
      fontSize: '13px', color: '#88ccff', fontFamily: 'Arial',
      stroke: '#000033', strokeThickness: 3,
    }).setDepth(11).setOrigin(0.5, 1);

    this.remoteNameTxt = this.add.text(200, GROUND_TOP - B - 14, 'Opponent', {
      fontSize: '13px', color: '#ffcc44', fontFamily: 'Arial',
      stroke: '#000033', strokeThickness: 3,
    }).setDepth(11).setOrigin(0.5, 1);

    // Resolve player's own display name from Unboxy
    unboxyReady.then(unboxy => {
      const myName = unboxy?.user?.name ?? 'You';
      if (this.localNameTxt) this.localNameTxt.setText(myName);
    });

    // Subscribe to room state changes — read remote player position
    this.mpOffState = room.onStateChange(() => {
      const state = room.state as { players: Map<string, { displayName?: string }> };
      state.players.forEach((p: { displayName?: string }, sid: string) => {
        if (sid === room.sessionId) return; // skip self

        const pos = room.player.get<{
          x: number; y: number; angle: number; alive: boolean; won: boolean;
        }>(sid, 'pos');

        if (!pos) return;

        this.remoteTarget = { x: pos.x, y: pos.y, angle: pos.angle, alive: pos.alive };

        // Update opponent display name if available
        if (this.remoteNameTxt && p?.displayName) {
          this.remoteNameTxt.setText(p.displayName);
        }

        // Remote player died
        if (!pos.alive && this.remoteAlive) {
          this.remoteAlive = false;
          this.triggerRemoteDeath();
        }
      });
    });

    // Handle opponent disconnect
    this.mpOffLeave = room.onLeave((code: number) => {
      if (code !== 1000 && this.alive) {
        this.remoteAlive = false;
        if (this.remotePlayer) this.remotePlayer.setVisible(false);
        this.showFloatingNotif('Opponent disconnected 👋', '#aabbdd');
      }
    });

    // Publish local position at ~20 Hz
    this.mpTimer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        try {
          room.player.set('pos', {
            x:     Math.round(this.player.x),
            y:     Math.round(this.player.y),
            angle: Math.round(this.player.angle),
            alive: this.alive,
            won:   false,
          });
        } catch (_) { /* network hiccup — ignore */ }
      },
    });

    // Cleanup subscriptions on scene shutdown so we don't leak handlers
    this.events.once('shutdown', () => {
      this.mpOffState?.();
      this.mpOffLeave?.();
      this.mpTimer?.remove();
    });
  }

  /** Explode the remote cube with orange particles and notify the local player */
  private triggerRemoteDeath(): void {
    if (!this.remotePlayer) return;

    // Orange particle burst at remote cube's last position
    const fx = this.add.particles(this.remotePlayer.x, this.remotePlayer.y, 'pOrange', {
      speed:    { min: 80, max: 400 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 1.1, end: 0 },
      alpha:    { start: 1, end: 0 },
      lifespan: 600,
      gravityY: 500,
      tint:     [0xff8800, 0xffcc44, 0xff4400, 0xffee88],
      quantity: 18,
      emitting: false,
    }).setDepth(12);
    fx.explode(18);
    this.time.delayedCall(700, () => fx.destroy());

    this.remotePlayer.setVisible(false);
    if (this.remoteNameTxt) {
      this.remoteNameTxt.setText('✗ Opponent');
      this.remoteNameTxt.setStyle({ color: '#ff6644' });
    }

    this.showFloatingNotif('Opponent died! 💥 Keep going!', '#ffcc44');
  }

  /** Show a brief floating notification fixed to the HUD (camera-space) */
  private showFloatingNotif(text: string, color: string): void {
    const notif = this.add.text(GAME_WIDTH / 2, 70, text, {
      fontSize: '20px', color, fontFamily: 'Arial',
      stroke: '#000022', strokeThickness: 3,
    }).setScrollFactor(0).setDepth(25).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: notif, alpha: 1, y: 62, duration: 260 });
    this.tweens.add({
      targets: notif, alpha: 0, y: 50,
      delay: 2400, duration: 500, onComplete: () => notif.destroy(),
    });
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

    // Kill all physics momentum so the camera stops drifting immediately
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setGravityY(0);
    body.setAcceleration(0, 0);

    // Publish death to remote immediately
    if (this.isMultiplayer) {
      try {
        activeRoom?.player.set('pos', {
          x: Math.round(this.player.x), y: Math.round(this.player.y),
          angle: Math.round(this.player.angle), alive: false, won: false,
        });
      } catch (_) { /* ignore */ }
    }

    this.deathFx.setPosition(this.player.x, this.player.y);
    this.deathFx.explode(20);

    this.cameras.main.shake(300, 0.012);
    this.cameras.main.flash(200, 255, 60, 60, false);

    this.player.setVisible(false);

    if (this.isMultiplayer) {
      // In MP mode: show a short death screen then return to MenuScene
      this.time.delayedCall(650, () => this.showMpDeathScreen());
    } else {
      // ── personal best check on death (highest % reached) ──
      const isNewBest = this.currentRunMaxPct > this.personalBest;
      if (isNewBest) {
        this.personalBest = this.currentRunMaxPct;
        void this.saveHighScore(this.currentRunMaxPct);
      }
      // Persist incremented attempt count across the restart
      this.game.registry.set('attempt', this.attempt + 1);
      // Show restart screen after effects settle
      this.time.delayedCall(650, () => this.showRestartPrompt(isNewBest));
    }
  }

  private showRestartPrompt(isNewBest: boolean = false): void {
    const cam        = this.cameras.main;
    const cx         = cam.scrollX + GAME_WIDTH / 2;
    const cy         = cam.scrollY + GAME_HEIGHT / 2;
    const attemptNum = this.game.registry.get('attempt') as number;

    // Gold sparkle burst when a new personal best is reached
    if (isNewBest) {
      const fx = this.add.particles(cx, cy - 30, 'pixel', {
        speed: { min: 50, max: 170 }, angle: { min: 0, max: 360 },
        scale: { start: 1.6, end: 0 }, alpha: { start: 1, end: 0 },
        lifespan: 750, tint: [0xffd700, 0xffee44, 0xffcc00],
        quantity: 0, emitting: false,
      }).setDepth(55);
      this.time.delayedCall(120, () => fx.explode(16));
      this.time.delayedCall(1000, () => fx.destroy());
    }

    // Build the content string
    const bestLine = isNewBest
      ? `🏆  New Best: ${this.personalBest}%!`
      : this.personalBest > 0
        ? `Best: ${this.personalBest}%`
        : '';
    const contentLines = [
      `You scored  ${this.currentRunMaxPct}%`,
      `Attempt  ${attemptNum - 1}`,
      ...(bestLine ? [bestLine] : []),
    ];

    const dialog = this.rexUI.add.confirmDialog({
      x: cx,
      y: cy,
      width: 440,

      background: { color: 0x080814, strokeColor: 0x3355aa, strokeLineWidth: 2, radius: 16 },

      title: {
        space: { left: 18, right: 18, top: 14, bottom: 14 },
        background: { color: 0x1a0000, radius: { tl: 16, tr: 16, bl: 0, br: 0 } },
        text: {
          fontSize: '44px', color: '#ff3333', fontStyle: 'bold',
          fontFamily: 'Arial', stroke: '#000000', strokeThickness: 6,
        },
      },

      content: {
        space: { left: 24, right: 24, top: 20, bottom: 8 },
        text: {
          fontSize: '20px', color: '#aabbdd',
          fontFamily: 'Arial', align: 'center',
        },
      },

      buttonA: {
        space: { left: 22, right: 22, top: 12, bottom: 12 },
        background: { color: 0x1a55ee, strokeColor: 0x4488ff, strokeLineWidth: 1, radius: 8 },
        text: { fontSize: '20px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial' },
      },

      buttonB: {
        space: { left: 22, right: 22, top: 12, bottom: 12 },
        background: { color: 0x1e1e30, strokeColor: 0x445577, strokeLineWidth: 1, radius: 8 },
        text: { fontSize: '20px', color: '#8899bb', fontFamily: 'Arial' },
      },

      space: { title: 14, content: 14, action: 18, left: 18, right: 18, top: 18, bottom: 18 },
      align: { actions: 'center' },
      expand:  { content: false },
    });

    dialog.resetDisplayContent({
      title:   'YOU DIED',
      content: contentLines.join('\n'),
      buttonA: '▶  Play Again',
      buttonB: 'Main Menu',
    });

    dialog
      .setDepth(50)
      .setAlpha(0)
      .layout();

    // Bounce-in tween on the whole dialog
    this.tweens.add({
      targets: dialog, alpha: 1, scaleX: 1, scaleY: 1,
      from: 0.6, ease: 'Back.Out', duration: 420,
    });

    dialog.modal(undefined, (result: { index: number }) => {
      if (result.index === 0) {
        this.scene.restart();
      } else {
        this.scene.start('MenuScene');
      }
    });
  }

  private showMpDeathScreen(): void {
    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65)
      .setScrollFactor(0).setDepth(28).setAlpha(0);

    const deathTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, 'YOU DIED', {
      fontSize: '60px', color: '#ff3333', fontStyle: 'bold',
      fontFamily: 'Arial', stroke: '#000000', strokeThickness: 7,
    }).setScrollFactor(0).setDepth(30).setOrigin(0.5).setAlpha(0).setScale(0.4);

    const subTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 5,
      `Attempt ${this.attempt}`, {
        fontSize: '22px', color: '#aabbdd',
        fontFamily: 'Arial', stroke: '#000022', strokeThickness: 4,
      }
    ).setScrollFactor(0).setDepth(30).setOrigin(0.5).setAlpha(0);

    const backTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60,
      'Back to Menu', {
        fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
        fontFamily: 'Arial', stroke: '#000033', strokeThickness: 4,
      }
    ).setScrollFactor(0).setDepth(30).setOrigin(0.5).setAlpha(0)
      .setInteractive({ useHandCursor: true });

    this.tweens.add({ targets: overlay,   alpha: 1,          duration: 350 });
    this.tweens.add({ targets: deathTxt,  alpha: 1, scale: 1, ease: 'Back.Out', duration: 550 });
    this.tweens.add({ targets: subTxt,    alpha: 1,          delay: 350, duration: 400 });
    this.tweens.add({ targets: backTxt,   alpha: 1,          delay: 550, duration: 400 });

    // Pulse the back button
    this.tweens.add({
      targets: backTxt, alpha: 0.3,
      yoyo: true, repeat: -1, duration: 650, delay: 1100, ease: 'Sine.easeInOut',
    });

    backTxt.on('pointerover', () => backTxt.setStyle({ color: '#88ccff' }));
    backTxt.on('pointerout',  () => backTxt.setStyle({ color: '#ffffff' }));
    backTxt.on('pointerdown', () => this.returnToMenu());

    // Also allow click anywhere after a short delay
    this.time.delayedCall(1000, () => {
      this.input.once('pointerdown', () => this.returnToMenu());
    });
  }

  private returnToMenu(): void {
    try { activeRoom?.leave(); } catch (_) { /* ignore */ }
    clearActiveRoom();
    this.game.registry.set('multiplayer', false);
    this.scene.start('MenuScene');
  }

  private onWin(): void {
    if (!this.alive) return;
    this.alive = false;

    // ── personal best check (solo only) — 100% = level complete ──
    const isNewBest = !this.isMultiplayer && 100 > this.personalBest;
    if (isNewBest) {
      this.personalBest = 100;
      void this.saveHighScore(100);
    }

    // Publish win state to remote
    if (this.isMultiplayer) {
      try {
        activeRoom?.player.set('pos', {
          x: Math.round(this.player.x), y: Math.round(this.player.y),
          angle: Math.round(this.player.angle), alive: false, won: true,
        });
      } catch (_) { /* ignore */ }
    }

    const txt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 45, 'LEVEL COMPLETE!', {
      fontSize: '56px', color: '#ffcc00', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setScrollFactor(0).setDepth(30).setOrigin(0.5).setAlpha(0).setScale(0.5);

    const subMsg = this.isMultiplayer
      ? `You finished! 🏆`
      : `Completed in ${this.attempt} attempt${this.attempt !== 1 ? 's' : ''}!`;
    const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 25, subMsg, {
      fontSize: '26px', color: '#ffffff', stroke: '#000033', strokeThickness: 4,
    }).setScrollFactor(0).setDepth(30).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: txt, alpha: 1, scale: 1, ease: 'Back.Out', duration: 700 });
    this.tweens.add({ targets: sub, alpha: 1, delay: 500, duration: 600 });
    this.tweens.add({
      targets: txt, scaleX: 1.04, scaleY: 1.04,
      yoyo: true, repeat: -1, duration: 800, delay: 800, ease: 'Sine.easeInOut',
    });

    // ── personal best banner (solo only) ──
    if (!this.isMultiplayer) {
      const bestMsg = isNewBest
        ? '🏆 First Clear! New Best: 100%!'
        : this.personalBest >= 100
          ? 'Level already cleared — great run!'
          : '';
      if (bestMsg) {
        const bestTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 72, bestMsg, {
          fontSize: '22px',
          color: isNewBest ? '#ffd700' : '#88bbff',
          fontFamily: 'Arial',
          fontStyle: isNewBest ? 'bold' : 'normal',
          stroke: '#000033', strokeThickness: 3,
        }).setScrollFactor(0).setDepth(30).setOrigin(0.5).setAlpha(0);

        this.tweens.add({ targets: bestTxt, alpha: 1, delay: 850, duration: 600 });

        if (isNewBest) {
          // Pulse the new best text
          this.tweens.add({
            targets: bestTxt, scaleX: 1.1, scaleY: 1.1,
            yoyo: true, repeat: -1, duration: 550, delay: 1500, ease: 'Sine.easeInOut',
          });
          // Gold particle burst
          const fx = this.add.particles(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 72, 'pixel', {
            speed: { min: 60, max: 220 },
            angle: { min: 0, max: 360 },
            scale: { start: 2, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 800,
            tint: [0xffd700, 0xffee44, 0xffcc00, 0xffffff],
            quantity: 0,
            emitting: false,
          }).setScrollFactor(0).setDepth(31);
          this.time.delayedCall(950, () => fx.explode(18));
          this.time.delayedCall(1800, () => fx.destroy());
        }
      }
    }

    if (this.isMultiplayer) {
      // Return to menu after celebration
      this.time.delayedCall(4000, () => this.returnToMenu());
    } else {
      this.game.registry.set('attempt', 1);
      this.time.delayedCall(5000, () => this.scene.restart());
    }
  }
}
