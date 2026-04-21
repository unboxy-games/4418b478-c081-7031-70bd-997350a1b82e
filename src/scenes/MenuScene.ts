import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';
import { setActiveRoom, clearActiveRoom } from '../gameState';
import type { UnboxyRoom } from '@unboxy/phaser-sdk';

const B = 60; // tile size matching GameScene

// ─────────────────────────────────────────────────────────────────────────────

export class MenuScene extends Phaser.Scene {
  // Lobby state
  private room:             UnboxyRoom | null = null;
  private offState?:        () => void;
  private offLeave?:        () => void;
  private offError?:        () => void;
  private countdownStarted  = false;
  private isTransitioning   = false;
  private lobbyOverlay:     Phaser.GameObjects.GameObject[] = [];

  constructor() { super({ key: 'MenuScene' }); }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    // Reset every time we arrive at this scene (may come back from a game)
    this.countdownStarted = false;
    this.isTransitioning  = false;
    this.room             = null;
    this.lobbyOverlay     = [];

    // Make sure the multiplayer flag is cleared
    this.game.registry.set('multiplayer', false);
    clearActiveRoom();

    this.buildBackground();
    this.buildTitle();
    this.buildButtons();

    // Cleanup any live room subscriptions if scene is torn down
    this.events.once('shutdown', () => {
      this.offState?.();
      this.offLeave?.();
      this.offError?.();
    });
  }

  // ── background ─────────────────────────────────────────────────────────────

  private buildBackground(): void {
    // Dark sky gradient matching the game's aesthetic
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(0x040918, 0x040918, 0x0c1e50, 0x0c1e50);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Stars
    const stars = this.add.graphics().setDepth(1);
    for (let i = 0; i < 180; i++) {
      const sx   = Phaser.Math.Between(0, GAME_WIDTH);
      const sy   = Phaser.Math.Between(0, GAME_HEIGHT - 100);
      const size = Math.random() > 0.85 ? 2 : 1;
      stars.fillStyle(0xffffff, Math.random() * 0.55 + 0.2);
      stars.fillCircle(sx, sy, size);
    }

    // Ground strip
    const gt = GAME_HEIGHT - 100;
    const gfx = this.add.graphics().setDepth(2);
    gfx.fillStyle(0x172535);
    gfx.fillRect(0, gt, GAME_WIDTH, 100);
    gfx.lineStyle(4, 0x2266cc, 0.75);
    gfx.lineBetween(0, gt, GAME_WIDTH, gt);
    gfx.lineStyle(10, 0x0d3399, 0.2);
    gfx.lineBetween(0, gt, GAME_WIDTH, gt);

    this.buildPreviewCubes(gt);
  }

  // Two animated cubes bouncing on the ground as a preview
  private buildPreviewCubes(groundTop: number): void {
    const mk = (
      key: string, w: number, h: number,
      fn: (g: Phaser.GameObjects.Graphics) => void,
    ) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      fn(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    // Blue cube (player 1) — same style as game's cube texture
    mk('cube', B, B, g => {
      g.fillStyle(0x0055bb, 0.25);
      g.fillRoundedRect(-5, -5, B + 10, B + 10, 12);
      g.fillStyle(0x1188ff);
      g.fillRoundedRect(0, 0, B, B, 9);
      g.fillStyle(0x66bbff, 0.5);
      g.fillRoundedRect(4, 4, B - 8, 18, 5);
      g.fillStyle(0x002288);
      g.fillRoundedRect(13, 13, B - 26, B - 26, 3);
      const cx = B / 2, cy = B / 2, r = 10;
      g.fillStyle(0x55ddff);
      g.fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r);
      g.fillTriangle(cx, cy - r, cx - r, cy, cx, cy + r);
      g.lineStyle(2, 0x88ddff);
      g.strokeRoundedRect(0, 0, B, B, 9);
    });

    // Orange cube (player 2) — warm palette for the remote player
    mk('cube2', B, B, g => {
      g.fillStyle(0xbb5500, 0.25);
      g.fillRoundedRect(-5, -5, B + 10, B + 10, 12);
      g.fillStyle(0xff8800);
      g.fillRoundedRect(0, 0, B, B, 9);
      g.fillStyle(0xffcc66, 0.5);
      g.fillRoundedRect(4, 4, B - 8, 18, 5);
      g.fillStyle(0x662200);
      g.fillRoundedRect(13, 13, B - 26, B - 26, 3);
      const cx = B / 2, cy = B / 2, r = 10;
      g.fillStyle(0xffdd44);
      g.fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r);
      g.fillTriangle(cx, cy - r, cx - r, cy, cx, cy + r);
      g.lineStyle(2, 0xffcc00);
      g.strokeRoundedRect(0, 0, B, B, 9);
    });

    const cy1 = groundTop - B / 2;

    const c1 = this.add.image(GAME_WIDTH / 2 - 80, cy1, 'cube').setDepth(3);
    const c2 = this.add.image(GAME_WIDTH / 2 + 80, cy1, 'cube2').setDepth(3);

    // Idle bob
    this.tweens.add({ targets: c1, y: cy1 - 10, yoyo: true, repeat: -1, duration: 560, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: c2, y: cy1 - 10, yoyo: true, repeat: -1, duration: 560, delay: 280, ease: 'Sine.easeInOut' });

    // Gentle spin
    this.tweens.add({ targets: c1, angle: 360, duration: 2800, repeat: -1, ease: 'Linear' });
    this.tweens.add({ targets: c2, angle: -360, duration: 3200, repeat: -1, ease: 'Linear' });

    // Glow pulses under each cube
    const glow = this.add.graphics().setDepth(2);
    this.tweens.add({
      targets: glow, alpha: 0.2,
      yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut',
      onUpdate: () => {
        glow.clear();
        glow.fillStyle(0x1188ff, 0.35);
        glow.fillEllipse(c1.x, groundTop + 4, 70, 16);
        glow.fillStyle(0xff8800, 0.35);
        glow.fillEllipse(c2.x, groundTop + 4, 70, 16);
      },
    });
  }

  // ── title ──────────────────────────────────────────────────────────────────

  private buildTitle(): void {
    // Main title
    const title = this.add.text(GAME_WIDTH / 2, 165, 'GEOMETRY DASH', {
      fontSize: '78px', color: '#ffffff', fontStyle: 'bold',
      fontFamily: 'Arial', stroke: '#0033bb', strokeThickness: 10,
    }).setDepth(5).setOrigin(0.5).setAlpha(0).setScale(0.5);

    this.tweens.add({ targets: title, alpha: 1, scale: 1, ease: 'Back.Out', duration: 700 });

    // Pulse glow
    this.tweens.add({
      targets: title, alpha: 0.82,
      yoyo: true, repeat: -1, duration: 1400, delay: 900, ease: 'Sine.easeInOut',
    });

    // Sub-title
    const sub = this.add.text(GAME_WIDTH / 2, 258, 'CLONE', {
      fontSize: '34px', color: '#88aaff', fontStyle: 'bold',
      fontFamily: 'Arial', stroke: '#001144', strokeThickness: 6,
    }).setDepth(5).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: sub, alpha: 1, delay: 400, duration: 500 });
  }

  // ── buttons ────────────────────────────────────────────────────────────────

  private buildButtons(): void {
    this.makeButton(GAME_WIDTH / 2, 370, 'SOLO PLAY', 0x1155cc, 0x2277ff, () => {
      this.scene.start('GameScene');
    }, 0);

    this.makeButton(GAME_WIDTH / 2, 460, 'ONLINE CO-OP  🌐', 0x116633, 0x22aa55, () => {
      this.joinOnline();
    }, 220);
  }

  private makeButton(
    x: number, y: number, label: string,
    baseColor: number, hoverColor: number,
    onClick: () => void,
    delay: number,
  ): void {
    const W = 340, H = 62, R = 14;

    const bg = this.add.graphics().setDepth(5).setAlpha(0);
    const draw = (col: number) => {
      bg.clear();
      bg.fillStyle(col, 0.92);
      bg.fillRoundedRect(x - W / 2, y - H / 2, W, H, R);
      bg.lineStyle(2.5, 0xaaccff, 0.65);
      bg.strokeRoundedRect(x - W / 2, y - H / 2, W, H, R);
    };
    draw(baseColor);

    const txt = this.add.text(x, y, label, {
      fontSize: '26px', color: '#ffffff', fontStyle: 'bold',
      fontFamily: 'Arial', stroke: '#000033', strokeThickness: 3,
    }).setDepth(6).setOrigin(0.5).setAlpha(0);

    // Fade in with stagger
    this.tweens.add({ targets: [bg, txt], alpha: 1, delay, duration: 420 });

    // Hit zone
    const zone = this.add.zone(x, y, W, H).setDepth(7).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      draw(hoverColor);
      this.tweens.add({ targets: txt, scaleX: 1.06, scaleY: 1.06, duration: 100 });
    });
    zone.on('pointerout', () => {
      draw(baseColor);
      this.tweens.add({ targets: txt, scaleX: 1, scaleY: 1, duration: 120 });
    });
    zone.on('pointerdown', () => {
      this.tweens.add({
        targets: [bg, txt], scaleX: 0.94, scaleY: 0.94,
        duration: 80, yoyo: true,
        onComplete: () => onClick(),
      });
    });
  }

  // ── online join flow ───────────────────────────────────────────────────────

  private async joinOnline(): Promise<void> {
    const unboxy = await unboxyReady;

    if (!unboxy) {
      this.showToast('Platform unavailable.\nPlease try again later.', '#ff8888');
      return;
    }

    if (!unboxy.isAuthenticated) {
      this.showToast('Sign in required\nfor Online Co-op!', '#ffcc44');
      return;
    }

    this.showLobbyOverlay('Connecting to server...');

    try {
      const room = await unboxy.rooms.joinOrCreate('lobby', {
        displayName: unboxy.user?.name ?? 'Player',
      });

      this.room = room;
      setActiveRoom(room);
      this.game.registry.set('multiplayer', true);

      const myName = unboxy.user?.name ?? 'Player';
      this.updateLobbyStatus(`Hi ${myName}!\n\nWaiting for an opponent...`);

      // Subscribe to state — watch for a second player joining
      this.offState = room.onStateChange(() => {
        const state       = room.state as { players: Map<string, unknown> };
        const playerCount = state.players.size;
        const gameState   = room.data.get<string>('gameState') ?? '';

        if (playerCount >= 2 && !this.countdownStarted) {
          this.countdownStarted = true;
          // Any client that reaches this sets 'countdown' — harmless if both do
          try { room.data.set('gameState', 'countdown'); } catch (_) { /* ignore */ }
        }

        if (gameState === 'countdown' && !this.isTransitioning) {
          this.isTransitioning = true;
          this.runCountdown();
        }
      });

      this.offLeave = room.onLeave((code: number) => {
        // Only surface errors for unexpected disconnects
        if (code !== 1000 && !this.isTransitioning) {
          this.showToast('Disconnected from server.', '#ff8888');
          this.clearLobbyOverlay();
          clearActiveRoom();
          this.room = null;
        }
      });

      this.offError = room.onError((_code: number, msg?: string) => {
        if (!this.isTransitioning) {
          this.clearLobbyOverlay();
          this.showToast(`Room error: ${msg ?? 'unknown'}`, '#ff8888');
          clearActiveRoom();
          this.room = null;
        }
      });

    } catch (err: unknown) {
      clearActiveRoom();
      this.room = null;
      this.clearLobbyOverlay();

      const code = (err as { code?: string })?.code;
      const msg =
        code === 'REALTIME_UNAVAILABLE'
          ? 'Online play not available\nin standalone mode.'
          : code === 'UNAUTHENTICATED'
          ? 'Sign in required\nfor Online Co-op!'
          : 'Could not connect.\nPlease try again.';
      this.showToast(msg, '#ff8888');
    }
  }

  // ── lobby overlay ──────────────────────────────────────────────────────────

  private showLobbyOverlay(statusText: string): void {
    this.clearLobbyOverlay();

    // Dark scrim
    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000011, 0.8)
      .setDepth(30).setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 280 });

    // Glowing panel
    const panel = this.add.graphics().setDepth(31);
    panel.fillStyle(0x0a1a3a, 0.95);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 260, GAME_HEIGHT / 2 - 180, 520, 360, 18);
    panel.lineStyle(2, 0x2266cc, 0.8);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 260, GAME_HEIGHT / 2 - 180, 520, 360, 18);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, delay: 120, duration: 300 });

    // "ONLINE CO-OP" header
    const header = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 130, 'ONLINE CO-OP', {
      fontSize: '38px', color: '#22ff88', fontStyle: 'bold',
      fontFamily: 'Arial', stroke: '#001133', strokeThickness: 6,
    }).setDepth(32).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: header, alpha: 1, delay: 200, duration: 350 });

    // Two cube icons side by side
    const iconY = GAME_HEIGHT / 2 - 55;
    const icon1 = this.add.image(GAME_WIDTH / 2 - 55, iconY, 'cube')
      .setDepth(32).setScale(0.6).setAlpha(0);
    const icon2 = this.add.image(GAME_WIDTH / 2 + 55, iconY, 'cube2')
      .setDepth(32).setScale(0.6).setAlpha(0);
    const vsText = this.add.text(GAME_WIDTH / 2, iconY, 'VS', {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial',
    }).setDepth(32).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: [icon1, icon2, vsText], alpha: 1, delay: 280, duration: 350 });
    this.tweens.add({ targets: icon1, y: iconY - 8, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: icon2, y: iconY - 8, yoyo: true, repeat: -1, duration: 600, delay: 300, ease: 'Sine.easeInOut' });

    // Status text (marked so we can update it)
    const statusTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, statusText, {
      fontSize: '22px', color: '#aaccff', fontFamily: 'Arial',
      stroke: '#000022', strokeThickness: 3, align: 'center',
    }).setDepth(32).setOrigin(0.5).setAlpha(0);
    (statusTxt as Phaser.GameObjects.Text & { __isStatus: boolean }).__isStatus = true;
    this.tweens.add({ targets: statusTxt, alpha: 1, delay: 320, duration: 350 });

    // Pulsing dots — loading indicator
    const dotY = GAME_HEIGHT / 2 + 90;
    const dots = [0, 1, 2].map(i => {
      const dot = this.add.text(GAME_WIDTH / 2 - 24 + i * 24, dotY, '●', {
        fontSize: '18px', color: '#4488ff', fontFamily: 'Arial',
      }).setDepth(32).setOrigin(0.5);
      this.tweens.add({
        targets: dot, alpha: 0.12,
        yoyo: true, repeat: -1, duration: 480, delay: i * 160, ease: 'Sine.easeInOut',
      });
      return dot;
    });

    // Back button
    const backTxt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 145, '← Back to Menu', {
      fontSize: '18px', color: '#5577aa', fontFamily: 'Arial',
      stroke: '#000022', strokeThickness: 2,
    }).setDepth(32).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: backTxt, alpha: 1, delay: 700, duration: 400 });
    backTxt.on('pointerover', () => backTxt.setStyle({ color: '#88aaff' }));
    backTxt.on('pointerout',  () => backTxt.setStyle({ color: '#5577aa' }));
    backTxt.on('pointerdown', () => this.leaveLobby());

    this.lobbyOverlay = [overlay, panel, header, icon1, icon2, vsText, statusTxt, backTxt, ...dots];
  }

  private updateLobbyStatus(text: string): void {
    const s = this.lobbyOverlay.find(
      (o): o is Phaser.GameObjects.Text =>
        o instanceof Phaser.GameObjects.Text &&
        !!(o as Phaser.GameObjects.Text & { __isStatus?: boolean }).__isStatus,
    );
    if (s) s.setText(text);
  }

  private clearLobbyOverlay(): void {
    this.lobbyOverlay.forEach(o => o.destroy());
    this.lobbyOverlay = [];
  }

  private leaveLobby(): void {
    this.offState?.();
    this.offLeave?.();
    this.offError?.();
    this.offState = undefined;
    this.offLeave = undefined;
    this.offError = undefined;
    if (this.room) {
      try { this.room.leave(); } catch (_) { /* ignore */ }
      this.room = null;
    }
    clearActiveRoom();
    this.countdownStarted = false;
    this.isTransitioning  = false;
    this.clearLobbyOverlay();
  }

  // ── countdown then start ───────────────────────────────────────────────────

  private runCountdown(): void {
    this.updateLobbyStatus('Opponent found!\nGet ready...');

    // Mark room as "playing" so late state-change callbacks don't re-enter
    try { this.room?.data.set('gameState', 'playing'); } catch (_) { /* ignore */ }

    let count = 3;

    // Big countdown number
    const ct = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, `${count}`, {
      fontSize: '110px', color: '#ffcc00', fontStyle: 'bold',
      fontFamily: 'Arial', stroke: '#000033', strokeThickness: 12,
    }).setDepth(35).setOrigin(0.5).setAlpha(0);
    this.lobbyOverlay.push(ct);

    const tick = () => {
      if (count === 0) {
        ct.setText('GO!').setStyle({ color: '#00ff88' });
        ct.setAlpha(1).setScale(1.4);
        this.tweens.add({ targets: ct, scale: 1, alpha: 0, duration: 700, ease: 'Sine.easeIn' });
        this.time.delayedCall(750, () => {
          this.clearLobbyOverlay();
          this.offState?.();
          this.offLeave?.();
          this.offError?.();
          this.scene.start('GameScene');
        });
        return;
      }
      ct.setText(`${count}`).setStyle({ color: '#ffcc00' });
      ct.setAlpha(1).setScale(1.6);
      this.tweens.add({ targets: ct, scale: 0.9, alpha: 0.7, duration: 900, ease: 'Sine.easeOut' });
      count--;
      this.time.delayedCall(1000, tick);
    };

    tick();
  }

  // ── toast notification ─────────────────────────────────────────────────────

  private showToast(text: string, color: string): void {
    const toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, text, {
      fontSize: '28px', color, fontStyle: 'bold', fontFamily: 'Arial',
      stroke: '#000022', strokeThickness: 4, align: 'center',
    }).setDepth(40).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: toast, alpha: 1, duration: 300 });
    this.time.delayedCall(3200, () => {
      this.tweens.add({
        targets: toast, alpha: 0, duration: 500,
        onComplete: () => toast.destroy(),
      });
    });
  }
}
