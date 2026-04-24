import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';

type DotRecord = { x: number; y: number };

const PALETTE: number[] = [
  0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4,
  0xffea7a, 0xdda0dd, 0x98d8c8, 0xf7dc6f,
  0xbb8fce, 0xf8c471, 0x82e0aa, 0xf1948a,
  0x85c1e9, 0xf0b27a, 0xa9dfbf, 0xff9f43,
];

export class GameScene extends Phaser.Scene {
  private room: any = null;
  private myColor!: number;
  private myDots: DotRecord[] = [];
  private renderedDotKeys = new Set<string>();
  private unsubs: Array<() => void> = [];
  private playerCountText!: Phaser.GameObjects.Text;
  private colorCircle!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'GameScene' });
  }

  async create(): Promise<void> {
    this.drawBackground();
    this.drawUI();

    this.myColor = PALETTE[Phaser.Math.Between(0, PALETTE.length - 1)];
    this.updateColorCircle();

    const unboxy = await unboxyReady;

    if (!unboxy || !unboxy.isAuthenticated) {
      this.showMessage(
        'Sign in to draw with friends',
        'Use the sign-in button above the game to get started.'
      );
      return;
    }

    try {
      this.room = await unboxy.rooms.joinOrCreate('lobby', {
        displayName: unboxy.user?.name ?? 'guest',
      });
    } catch (e: any) {
      if (e?.code === 'REALTIME_UNAVAILABLE') {
        this.showMessage(
          'Multiplayer unavailable in preview',
          'Publish the game to draw with friends online.'
        );
        return;
      }
      throw e;
    }

    // Publish our color and empty dot history so late joiners can see us
    this.room.player.set('color', this.myColor);
    this.room.player.set('dots', [] as DotRecord[]);

    // Live dot events from other players — instant feedback, no round-trip wait
    this.unsubs.push(
      this.room.on('dot', (msg: { from: string; x: number; y: number; color: number }) => {
        const color = typeof msg.color === 'number' ? msg.color : this.getPlayerColor(msg.from);
        this.renderDot(msg.x, msg.y, color);
        this.burstEffect(msg.x, msg.y, color);
      })
    );

    // State sync: player count updates + historical dots for late joiners
    this.unsubs.push(
      this.room.onStateChange(() => {
        this.updatePlayerCount();
        this.syncHistoricalDots();
      })
    );

    // Tap / click to place a dot (skip header and footer chrome areas)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < 60 || pointer.y > GAME_HEIGHT - 52) return;
      this.placeDot(pointer.x, pointer.y);
    });

    this.updatePlayerCount();

    this.events.once('shutdown', () => {
      this.unsubs.forEach((off) => off());
      this.room?.leave();
    });
  }

  // ---------------------------------------------------------------------------
  // Background & UI chrome
  // ---------------------------------------------------------------------------

  private drawBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x0d0d2b, 0x0d0d2b, 0x18104a, 0x18104a, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle grid lines in the drawable area
    const grid = this.add.graphics().setDepth(0);
    grid.lineStyle(1, 0xffffff, 0.05);
    for (let x = 0; x <= GAME_WIDTH; x += 64) {
      grid.lineBetween(x, 60, x, GAME_HEIGHT - 52);
    }
    for (let y = 60; y <= GAME_HEIGHT - 52; y += 64) {
      grid.lineBetween(0, y, GAME_WIDTH, y);
    }
  }

  private drawUI(): void {
    // Header bar
    const header = this.add.graphics().setDepth(9);
    header.fillStyle(0x000000, 0.45);
    header.fillRect(0, 0, GAME_WIDTH, 56);

    this.add
      .text(GAME_WIDTH / 2, 28, 'Dot Board', {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.playerCountText = this.add
      .text(GAME_WIDTH - 16, 28, '', {
        fontSize: '16px',
        color: '#8888bb',
      })
      .setOrigin(1, 0.5)
      .setDepth(10);

    // Footer bar
    const footer = this.add.graphics().setDepth(9);
    footer.fillStyle(0x000000, 0.45);
    footer.fillRect(0, GAME_HEIGHT - 52, GAME_WIDTH, 52);

    this.colorCircle = this.add.graphics().setDepth(10);

    this.add
      .text(52, GAME_HEIGHT - 26, 'Your color  ·  tap the board to place a dot', {
        fontSize: '15px',
        color: '#6666aa',
      })
      .setOrigin(0, 0.5)
      .setDepth(10);
  }

  private updateColorCircle(): void {
    if (!this.colorCircle) return;
    this.colorCircle.clear();

    // Outer glow
    this.colorCircle.fillStyle(this.myColor, 0.3);
    this.colorCircle.fillCircle(26, GAME_HEIGHT - 26, 18);

    // Main circle
    this.colorCircle.fillStyle(this.myColor, 1);
    this.colorCircle.fillCircle(26, GAME_HEIGHT - 26, 13);

    // Specular highlight
    this.colorCircle.fillStyle(0xffffff, 0.55);
    this.colorCircle.fillCircle(22, GAME_HEIGHT - 30, 5);

    // Rim
    this.colorCircle.lineStyle(2, 0xffffff, 0.35);
    this.colorCircle.strokeCircle(26, GAME_HEIGHT - 26, 13);

    // Gentle breathing pulse
    this.tweens.add({
      targets: this.colorCircle,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 950,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  // ---------------------------------------------------------------------------
  // Dot placement
  // ---------------------------------------------------------------------------

  private getPlayerColor(sessionId: string): number {
    if (!this.room) return 0xffffff;
    const color = this.room.player.get<number>(sessionId, 'color');
    return typeof color === 'number' ? color : 0xffffff;
  }

  private placeDot(x: number, y: number): void {
    this.renderDot(x, y, this.myColor);
    this.burstEffect(x, y, this.myColor);
    this.myDots.push({ x, y });
    // Persist history so late joiners see all our dots
    this.room.player.set('dots', this.myDots);
    // Broadcast live event so others see it instantly
    this.room.send('dot', { x, y, color: this.myColor });
  }

  private renderDot(x: number, y: number, color: number): void {
    const g = this.add.graphics().setDepth(2);

    // Soft glow halo
    g.fillStyle(color, 0.18);
    g.fillCircle(x, y, 22);

    // Main dot body
    g.fillStyle(color, 1);
    g.fillCircle(x, y, 12);

    // Inner sheen
    g.fillStyle(0xffffff, 0.2);
    g.fillCircle(x, y, 8);

    // Specular highlight
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(x - 4, y - 4, 4.5);

    // Pop-in animation
    g.setScale(0);
    this.tweens.add({
      targets: g,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });
  }

  private burstEffect(x: number, y: number, color: number): void {
    // Expanding ring
    const ring = this.add.graphics().setDepth(3);
    ring.lineStyle(2, color, 1);
    ring.strokeCircle(x, y, 14);
    this.tweens.add({
      targets: ring,
      scaleX: 2.8,
      scaleY: 2.8,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    // Sparks radiating outward
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = Phaser.Math.Between(28, 55);
      const spark = this.add.graphics().setDepth(3);
      spark.fillStyle(color, 1);
      spark.fillCircle(0, 0, Phaser.Math.FloatBetween(2, 4));
      spark.setPosition(x, y);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: Phaser.Math.Between(320, 560),
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Multiplayer state sync
  // ---------------------------------------------------------------------------

  private syncHistoricalDots(): void {
    if (!this.room) return;
    this.room.state.players.forEach((_p: any, sid: string) => {
      if (sid === this.room.sessionId) return; // our own dots already rendered
      const dots = this.room.player.get<DotRecord[]>(sid, 'dots');
      if (!Array.isArray(dots)) return;
      const color = this.getPlayerColor(sid);
      dots.forEach((dot, i) => {
        const key = `${sid}:${i}`;
        if (this.renderedDotKeys.has(key)) return;
        this.renderedDotKeys.add(key);
        // No burst for historical dots — quiet catch-up rendering
        this.renderDot(dot.x, dot.y, color);
      });
    });
  }

  private updatePlayerCount(): void {
    if (!this.room) return;
    let count = 0;
    this.room.state.players.forEach(() => count++);
    this.playerCountText.setText(
      count === 1 ? '1 player online' : `${count} players online`
    );
  }

  // ---------------------------------------------------------------------------
  // Auth / availability screens
  // ---------------------------------------------------------------------------

  private showMessage(title: string, subtitle: string): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const panel = this.add.graphics().setDepth(100);
    panel.fillStyle(0x000000, 0.75);
    panel.fillRoundedRect(cx - 320, cy - 68, 640, 136, 18);
    panel.lineStyle(1, 0x4444aa, 0.6);
    panel.strokeRoundedRect(cx - 320, cy - 68, 640, 136, 18);

    this.add
      .text(cx, cy - 20, title, {
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(101);

    this.add
      .text(cx, cy + 22, subtitle, {
        fontSize: '16px',
        color: '#8888cc',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(101);
  }

  update(_time: number, _delta: number): void {
    // Dots are event-driven — no per-frame logic needed
  }
}
