import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../unboxy';

export class LobbyScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private onlineBtn!: Phaser.GameObjects.Container;
  private soloBtn!: Phaser.GameObjects.Container;
  private _connecting = false;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    this._connecting = false;
    this.drawBackground();
    this.drawDecoration();
    this.drawTitle();
    this.createButtons();

    // Status feedback text (centre-bottom of play area)
    this.statusText = this.add
      .text(GAME_WIDTH / 2, 440, '', {
        fontSize: '15px',
        color: '#ffd700',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: { width: 600 },
      })
      .setOrigin(0.5, 0)
      .setDepth(5);
  }

  // ─── Background & decoration ───────────────────────────────────────────────

  private drawBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x0d0520, 0x0d0520, 0x0a1a38, 0x0a1a38);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Faint stars
    bg.fillStyle(0xffffff, 0.5);
    const stars = [
      [60,40],[210,90],[370,25],[530,70],[680,35],[750,110],
      [100,180],[290,150],[450,200],[620,160],[40,300],
      [730,290],[180,420],[500,390],[760,450],
    ];
    for (const [sx, sy] of stars) {
      const size = 0.8 + Math.random() * 1.4;
      bg.fillCircle(sx, sy, size);
    }
  }

  private drawDecoration(): void {
    const g = this.add.graphics().setDepth(1);

    // Grass strip at the very bottom
    g.fillStyle(0x3d9a3d);
    g.fillRect(0, GAME_HEIGHT - 28, GAME_WIDTH, 28);
    g.fillStyle(0x4ba84b);
    g.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20);

    // Scattered cat paw prints
    const pawPositions = [
      { x: 60,  y: 340 }, { x: 120, y: 370 }, { x: 680, y: 350 },
      { x: 730, y: 320 }, { x: 40,  y: 490 }, { x: 760, y: 490 },
    ];
    for (const { x, y } of pawPositions) {
      this.drawPaw(g, x, y, 0.18);
    }

    // Animated floating cat in top-left corner
    this.drawDecoCat(140, 280);
    // Another cat top-right
    this.drawDecoCat(660, 260);
  }

  private drawPaw(g: Phaser.GameObjects.Graphics, x: number, y: number, alpha: number): void {
    g.fillStyle(0x9B59B6, alpha);
    g.fillCircle(x, y, 16);
    g.fillCircle(x - 13, y - 14, 9);
    g.fillCircle(x + 13, y - 14, 9);
    g.fillCircle(x - 20, y - 3, 8);
    g.fillCircle(x + 20, y - 3, 8);
  }

  private drawDecoCat(cx: number, cy: number): void {
    const g = this.add.graphics().setDepth(1);

    // Body
    g.fillStyle(0xFF8C00, 0.18);
    g.fillEllipse(cx, cy + 20, 60, 50);
    // Head
    g.fillStyle(0xFF8C00, 0.18);
    g.fillCircle(cx, cy - 10, 26);
    // Ears
    g.fillStyle(0xFF8C00, 0.18);
    g.fillTriangle(cx - 20, cy - 28, cx - 30, cy - 48, cx - 6, cy - 32);
    g.fillTriangle(cx + 20, cy - 28, cx + 30, cy - 48, cx + 6, cy - 32);
    // Eyes
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(cx - 9, cy - 12, 5);
    g.fillCircle(cx + 9, cy - 12, 5);
    g.fillStyle(0x000000, 0.4);
    g.fillCircle(cx - 9, cy - 12, 3);
    g.fillCircle(cx + 9, cy - 12, 3);

    // Gentle bob tween
    this.tweens.add({
      targets: g,
      y: -8,
      duration: 1800 + Math.random() * 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawTitle(): void {
    // Title glow ring
    const glow = this.add.graphics().setDepth(2);
    glow.fillStyle(0xffd700, 0.06);
    glow.fillEllipse(GAME_WIDTH / 2, 130, 600, 80);

    // Main title
    this.add
      .text(GAME_WIDTH / 2, 85, '🐱  Cat Tower Defense', {
        fontSize: '42px',
        color: '#ffd700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(3);

    // Subtitle
    this.add
      .text(GAME_WIDTH / 2, 148, 'Defend against waves of mice, bugs & birds!', {
        fontSize: '15px',
        color: '#aaccff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(3);

    // Gentle title pulse
    const title = this.children.getAt(this.children.length - 2) as Phaser.GameObjects.Text;
    this.tweens.add({
      targets: title,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ─── Buttons ───────────────────────────────────────────────────────────────

  private createButtons(): void {
    // Brief tower info strip
    const infoG = this.add.graphics().setDepth(2);
    infoG.fillStyle(0x000000, 0.35);
    infoG.fillRoundedRect(GAME_WIDTH / 2 - 320, 185, 640, 40, 8);
    infoG.lineStyle(1, 0x9B59B6, 0.4);
    infoG.strokeRoundedRect(GAME_WIDTH / 2 - 320, 185, 640, 40, 8);
    this.add
      .text(GAME_WIDTH / 2, 205, '🟠 Tabby · ⚫ Ninja · 🟣 Wizard · 🟢 Sniper  —  4 towers, infinite waves', {
        fontSize: '12px',
        color: '#ccaaff',
      })
      .setOrigin(0.5)
      .setDepth(3);

    // Solo button (left)
    this.soloBtn = this.createBtn(
      GAME_WIDTH / 2 - 170, 310,
      '🐱  Play Solo',
      '(single player)',
      0x27ae60,
      () => this.playSolo(),
    );

    // Online button (right)
    this.onlineBtn = this.createBtn(
      GAME_WIDTH / 2 + 170, 310,
      '🌐  Play Online',
      '(2 players co-op)',
      0x2980b9,
      () => { if (!this._connecting) this.startOnlineMode(); },
    );
  }

  private createBtn(
    x: number,
    y: number,
    label: string,
    sublabel: string,
    color: number,
    cb: () => void,
  ): Phaser.GameObjects.Container {
    const w = 240;
    const h = 80;

    const bg = this.add.graphics();
    const drawBg = (hover: boolean): void => {
      bg.clear();
      bg.fillStyle(color, hover ? 0.92 : 0.72);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      bg.lineStyle(hover ? 3 : 2, 0xffffff, hover ? 0.9 : 0.45);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    };
    drawBg(false);

    const lbl = this.add
      .text(0, -8, label, { fontSize: '21px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    const sub = this.add
      .text(0, 18, sublabel, { fontSize: '13px', color: '#ccddff' })
      .setOrigin(0.5);

    const btn = this.add.container(x, y, [bg, lbl, sub]);
    btn.setDepth(4);
    btn.setSize(w, h);
    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerover',  () => drawBg(true));
    btn.on('pointerout',   () => drawBg(false));
    btn.on('pointerdown',  cb);

    // Gentle scale-pulse (staggered)
    this.tweens.add({
      targets: btn,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: (x % 200) * 4,
    });

    return btn;
  }

  // ─── Game launch ──────────────────────────────────────────────────────────

  private playSolo(): void {
    this.scene.start('GameScene', { multiplayer: false });
  }

  private async startOnlineMode(): Promise<void> {
    this._connecting = true;
    this.statusText.setText('🔌  Connecting to platform...');

    let unboxy: any = null;
    try {
      unboxy = await unboxyReady;
    } catch {
      /* unboxyReady already catches internally, so null is returned */
    }

    if (!unboxy) {
      this.statusText.setText(
        '⚠️  Platform services unavailable.\nTry opening the game from the Unboxy platform.',
      );
      this._connecting = false;
      return;
    }

    if (!unboxy.isAuthenticated) {
      this.statusText.setText(
        '🔒  Sign-in required for online play.\nPlease sign in via the platform and try again.',
      );
      this._connecting = false;
      return;
    }

    this.statusText.setText('⏳  Joining matchmaking room...');

    try {
      const myDisplayName: string = (unboxy.user?.name as string | undefined) ?? 'Cat Player';

      const room = await unboxy.rooms.joinOrCreate('lobby', {
        displayName: myDisplayName,
      });

      const shortId = (room.id as string).slice(0, 8).toUpperCase();
      this.statusText.setText(
        `⏳  Waiting for a partner…\nRoom code: ${shortId}  (1/2 players)`,
      );

      // Watch for the 2nd player
      const offState = room.onStateChange(() => {
        const playerCount: number = (room.state.players as Map<string, any>).size;

        if (playerCount < 2) {
          this.statusText.setText(
            `⏳  Waiting for a partner…\nRoom code: ${shortId}  (${playerCount}/2 players)`,
          );
          return;
        }

        // Two players present — determine host (earliest joinedAt)
        offState();

        let minJoinedAt = Infinity;
        let hostSid = '';
        (room.state.players as Map<string, any>).forEach((p: any, sid: string) => {
          if ((p.joinedAt as number) < minJoinedAt) {
            minJoinedAt = p.joinedAt as number;
            hostSid = sid;
          }
        });
        const isHost = hostSid === (room.sessionId as string);

        // Get partner display name
        let partnerName = 'Partner';
        (room.state.players as Map<string, any>).forEach((p: any, sid: string) => {
          if (sid !== (room.sessionId as string)) {
            partnerName = (p.displayName as string | undefined) ?? 'Partner';
          }
        });

        this.statusText.setText(
          `✅  Partner connected!  Starting…\n${isHost ? '👑 You are P1 (host)' : '🎮 You are P2 (guest)'}`,
        );

        this.time.delayedCall(900, () => {
          this.scene.start('GameScene', {
            multiplayer: true,
            room,
            isHost,
            myName: myDisplayName,
            partnerName,
          });
        });
      });

      const offError = room.onError((_code: unknown, msg: unknown) => {
        offState();
        offError();
        this.statusText.setText(`❌  Room error: ${String(msg) || 'unknown'}. Please try again.`);
        this._connecting = false;
      });

    } catch (err: any) {
      const code: string = err?.code ?? '';
      if (code === 'REALTIME_UNAVAILABLE') {
        this.statusText.setText(
          '⚠️  Realtime multiplayer requires the Unboxy host.\nOpen the game from the Unboxy platform.',
        );
      } else if (code === 'UNAUTHENTICATED') {
        this.statusText.setText(
          '🔒  Sign-in required for online play.\nPlease sign in via the platform and try again.',
        );
      } else {
        this.statusText.setText('❌  Connection failed. Please try again.');
        console.error('[Lobby] joinOrCreate error:', err);
      }
      this._connecting = false;
    }
  }
}
