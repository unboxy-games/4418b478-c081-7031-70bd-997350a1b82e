import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';

interface PlayerRow {
  container: Phaser.GameObjects.Container;
  nameText: Phaser.GameObjects.Text;
  countText: Phaser.GameObjects.Text;
  lastCount: number;
}

const PANEL_X = 820;
const PANEL_Y = 118;
const PANEL_W = 420;
const PANEL_H = 526;
const ROW_W = 388;
const ROW_H = 60;
const ROW_GAP = 68;

export class GameScene extends Phaser.Scene {
  private room: any = null;
  private localClicks = 0;
  private myCountText!: Phaser.GameObjects.Text;
  private playerListContainer!: Phaser.GameObjects.Container;
  private playerRows = new Map<string, PlayerRow>();
  private unsubs: Array<() => void> = [];
  private clickButton!: Phaser.GameObjects.Container;
  private idleTween: Phaser.Tweens.Tween | null = null;
  private connectingText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.scene.launch('UIScene');
    this.drawBackground();
    this.drawTitle();

    this.connectingText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Connecting…', {
        fontSize: '22px',
        color: '#445566',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.initRoom().catch((e) => console.error('[GameScene] room error', e));
  }

  private async initRoom(): Promise<void> {
    const unboxy = await unboxyReady;
    if (this.connectingText?.active) this.connectingText.destroy();

    if (!unboxy || !unboxy.isAuthenticated) {
      this.showSignInScreen();
      return;
    }

    const displayName = unboxy.user?.name ?? 'Player';

    try {
      this.room = await unboxy.rooms.joinOrCreate('lobby', { displayName });
    } catch (e: any) {
      if (e?.code === 'REALTIME_UNAVAILABLE') {
        this.showOfflineMode();
        return;
      }
      throw e;
    }

    this.buildClickArea();
    this.buildPlayerListPanel();
    this.setupRoomListeners();

    this.events.once('shutdown', () => {
      this.unsubs.forEach((off) => off());
      this.room?.leave();
    });
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  private drawBackground(): void {
    // Deep gradient
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x06091a, 0x06091a, 0x0c1a33, 0x0c1a33, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle grid
    const grid = this.add.graphics().setDepth(0);
    grid.lineStyle(1, 0x1a3566, 0.2);
    for (let x = 0; x <= GAME_WIDTH; x += 80) grid.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += 80) grid.lineBetween(0, y, GAME_WIDTH, y);

    // Divider between click area and leaderboard
    const sep = this.add.graphics().setDepth(1);
    sep.lineStyle(1, 0x00ffcc, 0.15);
    sep.lineBetween(800, 108, 800, 650);
  }

  private drawTitle(): void {
    // Glow layer
    this.add
      .text(GAME_WIDTH / 2, 50, 'CLICK WARS', {
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#00ffcc',
        stroke: '#00ffcc',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setAlpha(0.22)
      .setDepth(9);

    const title = this.add
      .text(GAME_WIDTH / 2, 50, 'CLICK WARS', {
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#00ffcc',
        stroke: '#003a22',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.tweens.add({
      targets: title,
      scaleX: 1.025,
      scaleY: 1.025,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(GAME_WIDTH / 2, 92, 'Race to the most clicks!', {
        fontSize: '15px',
        color: '#6688aa',
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setDepth(10);
  }

  // ─── Click button ─────────────────────────────────────────────────────────────

  private buildClickArea(): void {
    const cx = 390;
    const cy = 310;

    this.clickButton = this.add.container(cx, cy).setDepth(3);

    // Outer glow ring
    const glow = this.add.graphics();
    glow.lineStyle(24, 0x00ffcc, 0.07);
    glow.strokeRoundedRect(-162, -82, 324, 164, 32);
    this.clickButton.add(glow);

    // Drop shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(-150, -70, 300, 140, 26);
    shadow.x = 8;
    shadow.y = 10;
    this.clickButton.add(shadow);

    // Dark base
    const base = this.add.graphics();
    base.fillStyle(0x003d28, 1);
    base.fillRoundedRect(-150, -70, 300, 140, 26);
    this.clickButton.add(base);

    // Main face
    const face = this.add.graphics();
    face.fillStyle(0x00c87a, 1);
    face.fillRoundedRect(-148, -68, 296, 132, 24);
    this.clickButton.add(face);

    // Inner detail stripe
    const stripe = this.add.graphics();
    stripe.fillStyle(0x00e88a, 1);
    stripe.fillRoundedRect(-148, -68, 296, 60, 24);
    this.clickButton.add(stripe);

    // Shine highlight
    const shine = this.add.graphics();
    shine.fillStyle(0xffffff, 0.18);
    shine.fillRoundedRect(-138, -60, 276, 48, 14);
    this.clickButton.add(shine);

    // Label
    const label = this.add
      .text(0, -6, 'CLICK!', {
        fontSize: '62px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#005533',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.clickButton.add(label);

    // Interactive zone
    const zone = this.add.zone(0, 0, 300, 140).setInteractive({ useHandCursor: true });
    this.clickButton.add(zone);

    this.startIdlePulse();

    zone.on('pointerover', () => {
      this.idleTween?.stop();
      this.tweens.add({
        targets: this.clickButton,
        scaleX: 1.07,
        scaleY: 1.07,
        duration: 120,
        ease: 'Power2',
      });
    });
    zone.on('pointerout', () => {
      this.tweens.add({
        targets: this.clickButton,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 160,
        ease: 'Power2',
        onComplete: () => this.startIdlePulse(),
      });
    });
    zone.on('pointerdown', () => this.handleClick(cx, cy - 20));

    // "YOUR CLICKS" label
    this.add
      .text(cx, cy + 108, 'YOUR CLICKS', {
        fontSize: '13px',
        color: '#557799',
        letterSpacing: 6,
      })
      .setOrigin(0.5)
      .setDepth(3);

    // Count number
    this.myCountText = this.add
      .text(cx, cy + 165, '0', {
        fontSize: '92px',
        fontStyle: 'bold',
        color: '#00ffcc',
        stroke: '#002a1a',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(3);
  }

  private startIdlePulse(): void {
    this.idleTween = this.tweens.add({
      targets: this.clickButton,
      scaleX: 1.025,
      scaleY: 1.025,
      duration: 1050,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private handleClick(particleX: number, particleY: number): void {
    this.localClicks++;
    this.myCountText.setText(String(this.localClicks));

    // Publish to room (state, not send — joiners will see current count)
    if (this.room) {
      this.room.player.set('clicks', this.localClicks);
    }

    // Button squish
    this.idleTween?.stop();
    this.clickButton.setScale(1.0);
    this.tweens.add({
      targets: this.clickButton,
      scaleX: 0.90,
      scaleY: 0.90,
      duration: 55,
      yoyo: true,
      ease: 'Power2',
      onComplete: () => this.startIdlePulse(),
    });

    // Count pop
    this.tweens.add({
      targets: this.myCountText,
      scaleX: 1.32,
      scaleY: 1.32,
      duration: 75,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    this.spawnParticles(particleX, particleY);
  }

  private spawnParticles(x: number, y: number): void {
    const colors = [0x00ffcc, 0xff6b9d, 0xffd700, 0x44aaff, 0xffffff, 0xff9944];
    for (let i = 0; i < 14; i++) {
      const g = this.add.graphics().setDepth(4);
      g.fillStyle(Phaser.Utils.Array.GetRandom(colors) as number, 1);
      const size = Phaser.Math.Between(3, 9);
      if (Math.random() > 0.5) {
        g.fillCircle(0, 0, size);
      } else {
        g.fillRect(-size, -size, size * 2, size * 2);
      }
      g.x = x + Phaser.Math.Between(-30, 30);
      g.y = y + Phaser.Math.Between(-15, 15);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(60, 160);
      this.tweens.add({
        targets: g,
        x: g.x + Math.cos(angle) * dist,
        y: g.y + Math.sin(angle) * dist - Phaser.Math.Between(10, 50),
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: Phaser.Math.Between(380, 680),
        ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }
  }

  // ─── Player list panel ────────────────────────────────────────────────────────

  private buildPlayerListPanel(): void {
    // Panel background
    const panel = this.add.graphics().setDepth(4);
    panel.fillStyle(0x050c17, 0.95);
    panel.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 16);
    panel.lineStyle(2, 0x00ffcc, 0.45);
    panel.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 16);

    // Corner accents
    const acc = this.add.graphics().setDepth(5);
    acc.lineStyle(3, 0x00ffcc, 0.7);
    acc.lineBetween(PANEL_X + 8, PANEL_Y + 8, PANEL_X + 30, PANEL_Y + 8);
    acc.lineBetween(PANEL_X + 8, PANEL_Y + 8, PANEL_X + 8, PANEL_Y + 30);
    acc.lineBetween(PANEL_X + PANEL_W - 8, PANEL_Y + 8, PANEL_X + PANEL_W - 30, PANEL_Y + 8);
    acc.lineBetween(PANEL_X + PANEL_W - 8, PANEL_Y + 8, PANEL_X + PANEL_W - 8, PANEL_Y + 30);

    // Header
    this.add
      .text(PANEL_X + PANEL_W / 2, PANEL_Y + 36, 'PLAYERS', {
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#00ffcc',
        letterSpacing: 9,
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Divider
    const div = this.add.graphics().setDepth(5);
    div.lineStyle(1, 0x00ffcc, 0.28);
    div.lineBetween(PANEL_X + 18, PANEL_Y + 64, PANEL_X + PANEL_W - 18, PANEL_Y + 64);

    // Column headers
    this.add
      .text(PANEL_X + 54, PANEL_Y + 74, 'PLAYER', {
        fontSize: '10px',
        color: '#334455',
        letterSpacing: 3,
      })
      .setDepth(5);
    this.add
      .text(PANEL_X + PANEL_W - 20, PANEL_Y + 74, 'CLICKS', {
        fontSize: '10px',
        color: '#334455',
        letterSpacing: 3,
      })
      .setOrigin(1, 0)
      .setDepth(5);

    // Rows live here
    this.playerListContainer = this.add
      .container(PANEL_X + 16, PANEL_Y + 96)
      .setDepth(5);
  }

  // ─── Room listeners ───────────────────────────────────────────────────────────

  private setupRoomListeners(): void {
    this.unsubs.push(
      this.room.onStateChange(() => this.refreshPlayerList())
    );
  }

  private refreshPlayerList(): void {
    const all: Array<{ sid: string; name: string; clicks: number; isMe: boolean }> = [];

    this.room.state.players.forEach((_p: any, sid: string) => {
      const raw = this.room.player.get<number>(sid, 'clicks');
      all.push({
        sid,
        name: typeof _p.displayName === 'string' ? _p.displayName : 'Player',
        clicks: typeof raw === 'number' ? raw : 0,
        isMe: sid === this.room.sessionId,
      });
    });

    // Sort by clicks desc; ties: local player first
    all.sort((a, b) => b.clicks - a.clicks || (a.isMe ? -1 : 1));

    // Remove rows for departed players
    for (const [sid] of this.playerRows) {
      if (!all.find((p) => p.sid === sid)) {
        this.playerRows.get(sid)!.container.destroy();
        this.playerRows.delete(sid);
      }
    }

    // Update or create rows
    all.forEach((p, idx) => {
      const targetY = idx * ROW_GAP;
      if (this.playerRows.has(p.sid)) {
        const row = this.playerRows.get(p.sid)!;
        // Smooth re-sort animation
        this.tweens.add({
          targets: row.container,
          y: targetY,
          duration: 220,
          ease: 'Power2',
        });
        if (p.clicks !== row.lastCount) {
          row.countText.setText(String(p.clicks));
          row.lastCount = p.clicks;
          // Pop + flash on update
          this.tweens.add({
            targets: row.countText,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 85,
            yoyo: true,
            ease: 'Back.easeOut',
          });
          this.tweens.add({
            targets: row.countText,
            alpha: 0.25,
            duration: 55,
            yoyo: true,
          });
        }
      } else {
        this.createPlayerRow(p.sid, p.name, p.clicks, p.isMe, targetY);
      }
    });
  }

  private createPlayerRow(
    sid: string,
    name: string,
    clicks: number,
    isMe: boolean,
    rowY: number
  ): void {
    const container = this.add.container(0, rowY);
    this.playerListContainer.add(container);

    // Row background
    const bg = this.add.graphics();
    bg.fillStyle(isMe ? 0x003322 : 0x080f1c, 1);
    bg.fillRoundedRect(0, 0, ROW_W, ROW_H, 10);
    if (isMe) {
      bg.lineStyle(1.5, 0x00ffcc, 0.55);
      bg.strokeRoundedRect(0, 0, ROW_W, ROW_H, 10);
    }
    container.add(bg);

    // Status indicator dot
    const dot = this.add.graphics();
    dot.fillStyle(isMe ? 0x00ffcc : 0x1e3355, 1);
    dot.fillCircle(22, ROW_H / 2, 11);
    dot.fillStyle(0x000000, 0.35);
    dot.fillCircle(22, ROW_H / 2, 6);
    container.add(dot);

    // Name
    const label = name.slice(0, 16) + (isMe ? ' ◀' : '');
    const nameText = this.add.text(44, isMe ? 12 : 20, label, {
      fontSize: '15px',
      fontStyle: isMe ? 'bold' : 'normal',
      color: isMe ? '#aaffdd' : '#667788',
    });
    container.add(nameText);

    // "YOU" sub-label for local player
    if (isMe) {
      const youLabel = this.add.text(44, 32, 'YOU', {
        fontSize: '10px',
        color: '#009966',
        letterSpacing: 2,
      });
      container.add(youLabel);
    }

    // Click count
    const countText = this.add
      .text(ROW_W - 12, ROW_H / 2, String(clicks), {
        fontSize: '28px',
        fontStyle: 'bold',
        color: isMe ? '#00ffcc' : '#cce8ff',
      })
      .setOrigin(1, 0.5);
    container.add(countText);

    // Fade in
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 200 });

    this.playerRows.set(sid, { container, nameText, countText, lastCount: clicks });
  }

  // ─── Auth / offline fallbacks ─────────────────────────────────────────────────

  private showSignInScreen(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const panel = this.add.graphics().setDepth(20);
    panel.fillStyle(0x060d1c, 0.97);
    panel.fillRoundedRect(cx - 310, cy - 140, 620, 280, 20);
    panel.lineStyle(2, 0x00ffcc, 0.5);
    panel.strokeRoundedRect(cx - 310, cy - 140, 620, 280, 20);

    this.add
      .text(cx, cy - 75, '🔒  Sign In Required', {
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#00ffcc',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.add
      .text(cx, cy - 16, 'Click Wars is an online multiplayer game.', {
        fontSize: '17px',
        color: '#99aabb',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.add
      .text(cx, cy + 20, 'Please sign in to join a room and battle!', {
        fontSize: '17px',
        color: '#99aabb',
      })
      .setOrigin(0.5)
      .setDepth(21);
  }

  private showOfflineMode(): void {
    this.add
      .text(GAME_WIDTH / 2, 105, 'Offline Mode — multiplayer unavailable in this environment', {
        fontSize: '13px',
        color: '#334455',
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Still show the click button so the game isn't a blank screen
    this.buildClickArea();
  }

  update(): void {
    // No per-frame logic needed — everything is event-driven
  }
}
