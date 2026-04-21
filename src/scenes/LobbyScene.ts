import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';

const PILOT_COLORS = ['#4488ff', '#44ff88', '#ff66ff', '#ffaa00'] as const;
const PILOT_INTS   = [0x4488ff,   0x44ff88,  0xff66ff,  0xffaa00] as const;

export class LobbyScene extends Phaser.Scene {
  private room: any                    = null;
  private listObjs: Phaser.GameObjects.GameObject[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private readyBtn!:   Phaser.GameObjects.Text;
  private isReady   = false;
  private mpUnsubs: Array<() => void>  = [];
  private launching = false;

  constructor() { super({ key: 'LobbyScene' }); }

  async create(): Promise<void> {
    this.isReady   = false;
    this.launching = false;
    this.mpUnsubs  = [];
    this.listObjs  = [];

    this.createBackground();
    this.createTitle();

    this.statusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20,
      'Connecting…', {
      fontFamily: 'monospace', fontSize: '22px', color: '#aabbcc',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);

    const unboxy = await unboxyReady;

    if (!unboxy?.isAuthenticated) {
      this.showSignInGate();
      return;
    }

    try {
      this.room = await unboxy.rooms.joinOrCreate('lobby', {
        displayName: unboxy.user?.name ?? 'PILOT',
      });
      this.statusText.setText('Waiting for co-pilots…');
      this.setupLobby();
    } catch (err: any) {
      if (err?.code === 'REALTIME_UNAVAILABLE') {
        this.statusText
          .setColor('#ffaa44')
          .setText('Multiplayer unavailable.\nStarting solo in 2 s…');
        this.time.delayedCall(2000, () => {
          this.scene.stop('UIScene');
          this.scene.start('GameScene');
          this.scene.start('UIScene');
        });
      } else {
        this.statusText
          .setColor('#ff4444')
          .setText(`Connection failed:\n${err?.message ?? 'unknown error'}`);
        this.addBackButton();
      }
    }
  }

  // ─────────────────────────────────────────
  //  Room setup
  // ─────────────────────────────────────────
  private setupLobby(): void {
    const offState = this.room.onStateChange((s: any) => {
      this.refreshList(s);
      this.checkLaunch(s);
    });
    const offLeave = this.room.onLeave((code: number) =>
      console.warn('[lobby] left with code', code));

    this.mpUnsubs.push(offState, offLeave);
    this.events.once('shutdown', () => this.doCleanup(false));

    // ── Ready button ─────────────────────
    this.readyBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 180,
      '[ READY ]', {
      fontFamily: 'monospace', fontSize: '38px', color: '#aabbcc',
      stroke: '#001133', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

    this.readyBtn.on('pointerdown', () => this.toggleReady());
    this.readyBtn.on('pointerover', () => { if (!this.isReady) this.readyBtn.setColor('#ffffff'); });
    this.readyBtn.on('pointerout',  () => { if (!this.isReady) this.readyBtn.setColor('#aabbcc'); });

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R)
      .on('down', () => this.toggleReady());
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
      .once('down', () => { this.doCleanup(true); this.scene.start('StartScene'); });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 65,
      'R  ·  Toggle Ready         ESC  ·  Back to menu', {
      fontFamily: 'monospace', fontSize: '16px', color: '#335566',
    }).setOrigin(0.5).setDepth(10);

    if (this.room.state) this.refreshList(this.room.state);
  }

  private toggleReady(): void {
    this.isReady = !this.isReady;
    // Persist ready state to delta-synced player state (SDK 0.2.6)
    try { this.room.player.set('ready', this.isReady); } catch {}
    this.readyBtn.setText(this.isReady ? '[ ✓  READY! ]' : '[ READY ]');
    this.readyBtn.setColor(this.isReady ? '#44ff88' : '#aabbcc');
    if (this.isReady) {
      this.tweens.add({
        targets: this.readyBtn, scaleX: 1.18, scaleY: 1.18,
        duration: 180, yoyo: true, ease: 'Back.easeOut',
      });
    }
  }

  // ─────────────────────────────────────────
  //  Player list rendering
  // ─────────────────────────────────────────
  private refreshList(state: any): void {
    this.listObjs.forEach(o => { try { (o as any).destroy(); } catch {} });
    this.listObjs = [];

    const entries = this.toEntries(state?.players);
    const n       = entries.length;
    const baseY   = GAME_HEIGHT / 2 - 120;

    const push = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.listObjs.push(o); return o;
    };

    push(this.add.text(GAME_WIDTH / 2, baseY,
      `PILOTS  (${n} / 4)`, {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffcc00',
    }).setOrigin(0.5).setDepth(10));

    if (n === 0) {
      push(this.add.text(GAME_WIDTH / 2, baseY + 46,
        'Waiting for players to join…', {
        fontFamily: 'monospace', fontSize: '18px', color: '#335566',
      }).setOrigin(0.5).setDepth(10));
      return;
    }

    entries.forEach(([sid, pData], i) => {
      const isMe   = this.room && sid === this.room.sessionId;
      const name   = pData?.displayName ?? pData?.name ?? 'PILOT';
      // Read ready flag from delta-synced player state (SDK 0.2.6: room.player.get)
      const ready  = (this.room?.player.get<boolean>(sid, 'ready')) ?? false;
      const col    = PILOT_COLORS[i % PILOT_COLORS.length];
      const colInt = PILOT_INTS[i % PILOT_INTS.length];
      const y      = baseY + 52 + i * 48;

      // Mini ship glyph
      const g = push(this.add.graphics().setDepth(10));
      g.fillStyle(colInt, 0.9);
      g.fillTriangle(
        GAME_WIDTH / 2 - 180, y - 11,
        GAME_WIDTH / 2 - 193, y + 9,
        GAME_WIDTH / 2 - 167, y + 9,
      );
      this.tweens.add({
        targets: g, scaleY: 1.18,
        duration: 560 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });

      push(this.add.text(GAME_WIDTH / 2 - 152, y,
        `${name}${isMe ? '  ‹you›' : ''}`, {
        fontFamily: 'monospace', fontSize: '22px', color: ready ? '#44ff88' : col,
      }).setOrigin(0, 0.5).setDepth(10));

      push(this.add.text(GAME_WIDTH / 2 + 145, y,
        ready ? '✓ READY' : '… waiting', {
        fontFamily: 'monospace', fontSize: '17px', color: ready ? '#44ff88' : '#335566',
      }).setOrigin(1, 0.5).setDepth(10));
    });

    if (n < 2) {
      push(this.add.text(GAME_WIDTH / 2, baseY + 52 + n * 48 + 30,
        'Need at least  2  pilots to launch', {
        fontFamily: 'monospace', fontSize: '15px', color: '#335566',
      }).setOrigin(0.5).setDepth(10));
    }
  }

  private toEntries(players: unknown): [string, any][] {
    if (!players) return [];
    return players instanceof Map
      ? [...(players as Map<string, any>).entries()]
      : (Object.entries(players) as [string, any][]);
  }

  // ─────────────────────────────────────────
  //  Auto-launch when all ready
  // ─────────────────────────────────────────
  private checkLaunch(state: any): void {
    if (this.launching) return;
    const entries = this.toEntries(state?.players);
    if (entries.length < 2) return;
    // Check ready flag from delta-synced state (SDK 0.2.6)
    if (!entries.every(([sid]) => (this.room?.player.get<boolean>(sid, 'ready')) ?? false)) return;

    this.launching = true;
    this.statusText.setColor('#44ff88').setText('All pilots ready!  Launching…');
    this.tweens.add({ targets: this.statusText, scaleX: 1.2, scaleY: 1.2, duration: 300, yoyo: true });
    this.time.delayedCall(1400, () => {
      this.doCleanup(false);
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop('UIScene');
        this.scene.start('GameScene', { room: this.room, isMultiplayer: true });
        this.scene.start('UIScene');
      });
    });
  }

  // ─────────────────────────────────────────
  //  Sign-in gate
  // ─────────────────────────────────────────
  private showSignInGate(): void {
    this.statusText.destroy();

    const panel = this.add.graphics().setDepth(8);
    panel.fillStyle(0x000033, 0.92);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 340, GAME_HEIGHT / 2 - 90, 680, 185, 16);
    panel.lineStyle(2, 0x2244aa, 0.6);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 340, GAME_HEIGHT / 2 - 90, 680, 185, 16);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 42,
      'Sign-In Required', {
      fontFamily: 'monospace', fontSize: '34px', color: '#ff8844',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 12,
      'Multiplayer requires an Unboxy account.', {
      fontFamily: 'monospace', fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(10);

    this.addBackButton(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70);
  }

  private addBackButton(x = GAME_WIDTH / 2, y = GAME_HEIGHT / 2 + 100): void {
    const btn = this.add.text(x, y, '←  Back to Menu', {
      fontFamily: 'monospace', fontSize: '22px', color: '#4477cc',
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => { this.doCleanup(true); this.scene.start('StartScene'); });
    btn.on('pointerover',  () => btn.setColor('#88aaff'));
    btn.on('pointerout',   () => btn.setColor('#4477cc'));

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
      .once('down', () => { this.doCleanup(true); this.scene.start('StartScene'); });
  }

  // ─────────────────────────────────────────
  //  Cleanup
  // ─────────────────────────────────────────
  private doCleanup(andLeave: boolean): void {
    this.mpUnsubs.forEach(f => { try { f(); } catch {} });
    this.mpUnsubs = [];
    if (andLeave && this.room) {
      try { this.room.leave(); } catch {}
      this.room = null;
    }
  }

  // ─────────────────────────────────────────
  //  Visuals
  // ─────────────────────────────────────────
  private createBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x000011, 0x000011, 0x000033, 0x000033, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const neb = this.add.graphics().setDepth(0);
    neb.fillStyle(0x0a0044, 0.45); neb.fillEllipse(260, 340, 520, 280);
    neb.fillStyle(0x001a11, 0.35); neb.fillEllipse(980, 440, 420, 260);
    neb.fillStyle(0x330011, 0.20); neb.fillEllipse(640, 600, 360, 200);

    const sg = this.add.graphics().setDepth(0);
    for (let i = 0; i < 200; i++) {
      sg.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.2, 1.0));
      sg.fillCircle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.FloatBetween(0.4, 2.2),
      );
    }
  }

  private createTitle(): void {
    this.add.text(GAME_WIDTH / 2 + 3, 80 + 3, 'CO-OP LOBBY', {
      fontFamily: 'monospace', fontSize: '62px', color: '#330033',
    }).setOrigin(0.5).setDepth(4).setAlpha(0.7);

    const title = this.add.text(GAME_WIDTH / 2, 80, 'CO-OP LOBBY', {
      fontFamily: 'monospace', fontSize: '62px', color: '#ffcc00',
      stroke: '#ff4400', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(6);

    this.tweens.add({
      targets: title, y: 88, duration: 1800, ease: 'Sine.easeInOut', yoyo: true, loop: -1,
    });
  }
}
