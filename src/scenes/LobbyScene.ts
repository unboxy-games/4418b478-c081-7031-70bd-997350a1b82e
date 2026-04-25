import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';
import { ALL_PIECE_NAMES, PLAYER_COLORS, PLAYER_NAMES } from '../data/pieces';
import { setActiveRoom } from '../gameState';

function randomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export class LobbyScene extends Phaser.Scene {
  private room: any = null;
  private unboxy: any = null;
  private unsubs: Array<() => void> = [];

  private statusText!: Phaser.GameObjects.Text;
  private roomCodeText!: Phaser.GameObjects.Text;
  private playerListTexts: Phaser.GameObjects.Text[] = [];
  private startBtn!: Phaser.GameObjects.Container;
  private waitingText: Phaser.GameObjects.Text | null = null;
  private mainContainer!: Phaser.GameObjects.Container;
  private inputActive = false;
  private joinCodeInput = '';
  private joinInputText!: Phaser.GameObjects.Text;
  private isHost = false;
  private currentRoomCode = '';
  private listPollTimer: Phaser.Time.TimerEvent | null = null;
  private roomBrowserRows: Phaser.GameObjects.GameObject[] = [];
  private roomBrowserStatusText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    this.createBackground();
    this.createTitle();
    this.mainContainer = this.add.container(0, 0).setDepth(5);
    this.statusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Initializing...', {
      fontSize: '22px', color: '#94a3b8', align: 'center',
    }).setOrigin(0.5).setDepth(10);

    this.initPlatform();

    this.events.once('shutdown', () => {
      this.unsubs.forEach(f => f());
      // room.leave() handled after game starts
    });
  }

  private async initPlatform(): Promise<void> {
    try {
      this.unboxy = await unboxyReady;
      this.showMainMenu();
    } catch {
      this.showOfflineOption();
    }
  }

  private createBackground(): void {
    const gfx = this.add.graphics().setDepth(0);
    // Dark gradient background
    gfx.fillGradientStyle(0x0d1b2a, 0x0d1b2a, 0x112240, 0x112240, 1);
    gfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Decorative grid dots
    gfx.fillStyle(0xffffff, 0.04);
    for (let x = 40; x < GAME_WIDTH; x += 40) {
      for (let y = 40; y < GAME_HEIGHT; y += 40) {
        gfx.fillCircle(x, y, 1.5);
      }
    }

    // Corner color swatches
    const corners = [
      { x: 80, y: 80, color: PLAYER_COLORS[0] },
      { x: GAME_WIDTH - 80, y: GAME_HEIGHT - 80, color: PLAYER_COLORS[1] },
      { x: GAME_WIDTH - 80, y: 80, color: PLAYER_COLORS[2] },
      { x: 80, y: GAME_HEIGHT - 80, color: PLAYER_COLORS[3] },
    ];
    for (const c of corners) {
      gfx.fillStyle(c.color, 0.15);
      gfx.fillCircle(c.x, c.y, 60);
      gfx.fillStyle(c.color, 0.06);
      gfx.fillCircle(c.x, c.y, 120);
    }
  }

  private createTitle(): void {
    const subtitle = this.add.text(GAME_WIDTH / 2, 155, 'ONLINE MULTIPLAYER', {
      fontSize: '18px',
      color: '#64748b',
      letterSpacing: 6,
    }).setOrigin(0.5).setDepth(10);

    // Render each letter individually so colors never overlap a duplicate base text
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444'];
    const letters = 'BLOKUS'.split('');
    const letterObjs: Phaser.GameObjects.Text[] = [];

    // Measure total width first using a temp text (destroyed immediately)
    const letterW = 58; // approximate per-character width for 72px bold
    const gap = 8;
    const totalW = letters.length * letterW + (letters.length - 1) * gap;
    const startX = GAME_WIDTH / 2 - totalW / 2 + letterW / 2;

    for (let i = 0; i < letters.length; i++) {
      const lt = this.add.text(startX + i * (letterW + gap), 90, letters[i], {
        fontSize: '72px',
        fontStyle: 'bold',
        color: colors[i],
        stroke: '#0d1b2a',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(10);
      letterObjs.push(lt);

      this.tweens.add({
        targets: lt,
        alpha: { from: 0.8, to: 1 },
        yoyo: true, repeat: -1,
        duration: 1800 + i * 300,
        ease: 'Sine.easeInOut',
      });
    }

    // Pulse the whole title group
    this.tweens.add({
      targets: letterObjs,
      scaleX: 1.03, scaleY: 1.03,
      yoyo: true, repeat: -1,
      duration: 2500,
      ease: 'Sine.easeInOut',
    });

    void subtitle;
  }

  private showMainMenu(): void {
    this.clearMain();
    this.statusText.setVisible(false);

    const cx = GAME_WIDTH / 2;
    const baseY = 240;

    // Online mode buttons
    if (this.unboxy?.isAuthenticated) {
      this.makeMenuButton('CREATE ROOM', cx, baseY, 0x3b82f6, () => this.createRoom());
      this.makeMenuButton('JOIN WITH CODE', cx, baseY + 72, 0x22c55e, () => this.showJoinInput());
      this.makeMenuButton('BROWSE ROOMS', cx, baseY + 144, 0xf59e0b, () => this.showRoomBrowser());
      this.makeMenuButton('QUICK MATCH', cx, baseY + 216, 0x8b5cf6, () => this.quickMatch());
    } else {
      this.makeMenuButton('PLAY ONLINE (Sign in)', cx, baseY, 0x3b82f6, () => this.quickMatch());
    }
    this.makeMenuButton('PLAY OFFLINE', cx, baseY + 308, 0x64748b, () => this.startOffline());
  }

  private showOfflineOption(): void {
    this.clearMain();
    this.statusText.setText('Online unavailable').setVisible(true);
    this.makeMenuButton('PLAY OFFLINE', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, 0x64748b, () => this.startOffline());
  }

  private makeMenuButton(
    label: string,
    x: number,
    y: number,
    color: number,
    callback: () => void
  ): Phaser.GameObjects.Container {
    const w = 340, h = 56;
    const bg = this.add.graphics();
    bg.fillStyle(color, 0.2);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    bg.lineStyle(2, color, 0.8);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);

    const text = this.add.text(0, 0, label, {
      fontSize: '20px', fontStyle: 'bold', color: '#ffffff', align: 'center',
    }).setOrigin(0.5);

    const cont = this.add.container(x, y, [bg, text]).setDepth(10).setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains
    );

    cont.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(color, 0.45);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.lineStyle(2, color, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
      this.tweens.add({ targets: cont, scaleX: 1.04, scaleY: 1.04, duration: 100 });
    });
    cont.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(color, 0.2);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.lineStyle(2, color, 0.8);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
      this.tweens.add({ targets: cont, scaleX: 1, scaleY: 1, duration: 100 });
    });
    cont.on('pointerdown', callback);

    this.mainContainer.add(cont);
    return cont;
  }

  private async createRoom(): Promise<void> {
    this.clearMain();
    this.statusText.setText('Creating room...').setVisible(true);
    try {
      this.currentRoomCode = randomCode();
      this.room = await this.unboxy.rooms.joinOrCreate('lobby', {
        roomCode: this.currentRoomCode,
        maxClients: 4,
        displayName: this.unboxy.user?.name ?? 'Player',
        metadata: { hostName: this.unboxy.user?.name ?? 'Player' },
      });
    } catch (e: any) {
      if (e?.code === 'REALTIME_UNAVAILABLE') {
        this.startOffline();
      } else {
        this.statusText.setText('Failed to create room.\nTry again.');
        this.time.delayedCall(2000, () => this.showMainMenu());
      }
      return;
    }
    this.isHost = true;
    this.statusText.setVisible(false);
    this.showLobbyWaiting();
  }

  private showJoinInput(): void {
    this.clearMain();
    const cx = GAME_WIDTH / 2;

    const label = this.add.text(cx, 270, 'Enter Room Code:', {
      fontSize: '22px', color: '#94a3b8',
    }).setOrigin(0.5).setDepth(10);

    // Input box
    const inputBg = this.add.graphics().setDepth(10);
    inputBg.fillStyle(0x1e3a5f, 0.9);
    inputBg.fillRoundedRect(cx - 160, 300, 320, 60, 10);
    inputBg.lineStyle(2, 0x3b82f6, 0.8);
    inputBg.strokeRoundedRect(cx - 160, 300, 320, 60, 10);

    this.joinInputText = this.add.text(cx, 330, '|', {
      fontSize: '30px', fontStyle: 'bold', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(11);

    this.joinCodeInput = '';
    this.inputActive = true;

    this.makeMenuButton('JOIN', cx, 420, 0x22c55e, () => this.joinRoom());
    this.makeMenuButton('BACK', cx, 500, 0x64748b, () => {
      this.inputActive = false;
      this.showMainMenu();
    });

    // Keyboard input
    const kb = this.input.keyboard;
    if (kb) {
      const keyHandler = (event: KeyboardEvent) => {
        if (!this.inputActive) return;
        if (event.key === 'Backspace') {
          this.joinCodeInput = this.joinCodeInput.slice(0, -1);
        } else if (event.key === 'Enter') {
          this.joinRoom();
        } else if (event.key.length === 1 && this.joinCodeInput.length < 8) {
          this.joinCodeInput += event.key.toUpperCase();
        }
        this.joinInputText.setText(this.joinCodeInput || '|');
      };
      window.addEventListener('keydown', keyHandler);
      this.events.once('shutdown', () => window.removeEventListener('keydown', keyHandler));
    }

    this.mainContainer.add([label as any, inputBg as any]);
  }

  private async joinRoom(): Promise<void> {
    if (!this.joinCodeInput) return;
    this.inputActive = false;
    this.clearMain();
    this.statusText.setText('Joining room...').setVisible(true);
    try {
      this.room = await this.unboxy.rooms.joinOrCreate('lobby', {
        roomCode: this.joinCodeInput,
        displayName: this.unboxy.user?.name ?? 'Player',
      });
    } catch (e: any) {
      if (e?.code === 'REALTIME_UNAVAILABLE') {
        this.startOffline();
      } else {
        this.statusText.setText('Could not join room.\nCheck the code and try again.');
        this.time.delayedCall(2500, () => this.showMainMenu());
      }
      return;
    }
    this.isHost = false;
    this.currentRoomCode = this.joinCodeInput;
    this.statusText.setVisible(false);
    this.showLobbyWaiting();
  }

  private async quickMatch(): Promise<void> {
    this.clearMain();
    this.statusText.setText('Finding a match...').setVisible(true);
    if (!this.unboxy?.isAuthenticated) {
      this.startOffline();
      return;
    }
    try {
      this.room = await this.unboxy.rooms.joinOrCreate('lobby', {
        maxClients: 4,
        displayName: this.unboxy.user?.name ?? 'Player',
        metadata: { hostName: this.unboxy.user?.name ?? 'Player' },
      });
    } catch (e: any) {
      if (e?.code === 'REALTIME_UNAVAILABLE') {
        this.startOffline();
      } else {
        this.statusText.setText('Matchmaking failed.\nPlaying offline.').setVisible(true);
        this.time.delayedCall(2000, () => this.startOffline());
      }
      return;
    }
    this.currentRoomCode = 'PUBLIC';
    // isHost for quick match is determined in the first onStateChange callback
    // (state.players is undefined synchronously after joinOrCreate)
    this.isHost = false;
    this.statusText.setVisible(false);
    this.showLobbyWaiting();
  }

  private showRoomBrowser(): void {
    this.clearMain();
    this.statusText.setVisible(false);

    const cx = GAME_WIDTH / 2;

    // Panel background
    const panelGfx = this.add.graphics().setDepth(8);
    panelGfx.fillStyle(0x0d1b2a, 0.92);
    panelGfx.fillRoundedRect(cx - 460, 195, 920, 390, 14);
    panelGfx.lineStyle(2, 0xf59e0b, 0.5);
    panelGfx.strokeRoundedRect(cx - 460, 195, 920, 390, 14);
    this.mainContainer.add(panelGfx as any);

    // Header
    const headerTitle = this.add.text(cx, 215, 'OPEN ROOMS', {
      fontSize: '16px', color: '#f59e0b', letterSpacing: 5,
    }).setOrigin(0.5).setDepth(10);

    // Column headers
    const colY = 248;
    const colHeaders = [
      this.add.text(cx - 390, colY, 'CODE', { fontSize: '13px', color: '#475569', letterSpacing: 3 }).setDepth(10),
      this.add.text(cx - 200, colY, 'HOST', { fontSize: '13px', color: '#475569', letterSpacing: 3 }).setDepth(10),
      this.add.text(cx + 110, colY, 'PLAYERS', { fontSize: '13px', color: '#475569', letterSpacing: 3 }).setDepth(10),
    ];

    const divGfx = this.add.graphics().setDepth(9);
    divGfx.lineStyle(1, 0x334155, 0.8);
    divGfx.lineBetween(cx - 450, 265, cx + 450, 265);
    this.mainContainer.add([divGfx as any, headerTitle as any, ...colHeaders as any[]]);

    // Refresh indicator (spinning dots)
    this.roomBrowserStatusText = this.add.text(cx, 355, 'Loading rooms...', {
      fontSize: '18px', color: '#475569',
    }).setOrigin(0.5).setDepth(10);
    this.mainContainer.add(this.roomBrowserStatusText as any);

    // Back + Refresh buttons
    this.makeMenuButton('BACK', cx - 180, 625, 0x64748b, () => {
      this.stopListPoll();
      this.showMainMenu();
    });
    this.makeMenuButton('REFRESH', cx + 180, 625, 0xf59e0b, () => {
      this.refreshRoomList();
    });

    // Start polling
    this.stopListPoll();
    this.refreshRoomList();
    this.listPollTimer = this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => { this.refreshRoomList(); },
    });
  }

  private async refreshRoomList(): Promise<void> {
    if (!this.unboxy) return;
    try {
      const rooms: Array<{
        roomId: string;
        roomCode: string;
        clients: number;
        maxClients: number;
        metadata?: any;
      }> = await this.unboxy.rooms.list();

      // Clear old rows
      this.roomBrowserRows.forEach(o => (o as Phaser.GameObjects.GameObject).destroy());
      this.roomBrowserRows = [];

      const open = rooms.filter(r => r.clients < r.maxClients);

      if (open.length === 0) {
        if (this.roomBrowserStatusText) {
          this.roomBrowserStatusText.setText('No open rooms right now — create one!').setVisible(true);
        }
        return;
      }

      if (this.roomBrowserStatusText) {
        this.roomBrowserStatusText.setVisible(false);
      }

      const cx = GAME_WIDTH / 2;
      const rowH = 58;
      const firstRowY = 290;
      const maxRows = 5;

      open.slice(0, maxRows).forEach((entry, i) => {
        const rowY = firstRowY + i * rowH;
        const isEven = i % 2 === 0;

        // Row highlight
        const rowBg = this.add.graphics().setDepth(9);
        rowBg.fillStyle(isEven ? 0x1e3a5f : 0x172a47, 0.5);
        rowBg.fillRoundedRect(cx - 450, rowY - 20, 900, rowH - 4, 6);
        this.roomBrowserRows.push(rowBg);

        // Room code
        const codeStr = entry.roomCode || 'PUBLIC';
        const codeCol = entry.roomCode ? 0x60a5fa : 0x8b5cf6;
        const codeT = this.add.text(cx - 390, rowY, codeStr, {
          fontSize: '20px', fontStyle: 'bold',
          color: '#' + codeCol.toString(16).padStart(6, '0'),
        }).setOrigin(0, 0.5).setDepth(10);
        this.roomBrowserRows.push(codeT);

        // Host / display name from metadata
        const hostName: string = (entry.metadata as any)?.hostName ?? 'Unknown';
        const hostT = this.add.text(cx - 200, rowY, hostName, {
          fontSize: '18px', color: '#cbd5e1',
        }).setOrigin(0, 0.5).setDepth(10);
        this.roomBrowserRows.push(hostT);

        // Player count bubbles
        for (let p = 0; p < entry.maxClients; p++) {
          const filled = p < entry.clients;
          const dotGfx = this.add.graphics().setDepth(10);
          dotGfx.fillStyle(filled ? PLAYER_COLORS[p % 4] : 0x334155, filled ? 0.9 : 0.5);
          dotGfx.fillCircle(cx + 120 + p * 28, rowY, 9);
          this.roomBrowserRows.push(dotGfx);
        }

        const countT = this.add.text(cx + 240, rowY, `${entry.clients}/${entry.maxClients}`, {
          fontSize: '16px', color: '#64748b',
        }).setOrigin(0, 0.5).setDepth(10);
        this.roomBrowserRows.push(countT);

        // JOIN button
        const btnW = 100, btnH = 36;
        const btnGfx = this.add.graphics().setDepth(10);
        btnGfx.fillStyle(0x22c55e, 0.25);
        btnGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
        btnGfx.lineStyle(2, 0x22c55e, 0.8);
        btnGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
        const btnT = this.add.text(0, 0, 'JOIN', {
          fontSize: '16px', fontStyle: 'bold', color: '#ffffff',
        }).setOrigin(0.5);
        const btnCont = this.add.container(cx + 400, rowY, [btnGfx, btnT])
          .setDepth(10)
          .setInteractive(new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH), Phaser.Geom.Rectangle.Contains);

        btnCont.on('pointerover', () => {
          btnGfx.clear();
          btnGfx.fillStyle(0x22c55e, 0.6);
          btnGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
          btnGfx.lineStyle(2, 0x22c55e, 1);
          btnGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
          this.tweens.add({ targets: btnCont, scaleX: 1.08, scaleY: 1.08, duration: 80 });
        });
        btnCont.on('pointerout', () => {
          btnGfx.clear();
          btnGfx.fillStyle(0x22c55e, 0.25);
          btnGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
          btnGfx.lineStyle(2, 0x22c55e, 0.8);
          btnGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
          this.tweens.add({ targets: btnCont, scaleX: 1, scaleY: 1, duration: 80 });
        });
        btnCont.on('pointerdown', () => this.joinRoomById(entry.roomId, entry.roomCode));

        this.roomBrowserRows.push(btnCont);
      });
    } catch {
      if (this.roomBrowserStatusText) {
        this.roomBrowserStatusText.setText('Could not load rooms — retrying...').setVisible(true);
      }
    }
  }

  private stopListPoll(): void {
    if (this.listPollTimer) {
      this.listPollTimer.remove(false);
      this.listPollTimer = null;
    }
    this.roomBrowserRows.forEach(o => (o as Phaser.GameObjects.GameObject).destroy());
    this.roomBrowserRows = [];
  }

  private async joinRoomById(roomId: string, roomCode: string): Promise<void> {
    this.stopListPoll();
    this.clearMain();
    this.statusText.setText('Joining room...').setVisible(true);
    try {
      this.room = await this.unboxy.rooms.joinById(roomId, {
        displayName: this.unboxy.user?.name ?? 'Player',
      });
    } catch (e: any) {
      if (e?.code === 'REALTIME_UNAVAILABLE') {
        this.startOffline();
      } else {
        this.statusText.setText('Could not join room.\nIt may be full or closed.');
        this.time.delayedCall(2500, () => this.showRoomBrowser());
      }
      return;
    }
    this.isHost = false;
    this.currentRoomCode = roomCode || 'PUBLIC';
    this.statusText.setVisible(false);
    this.showLobbyWaiting();
  }

  private showLobbyWaiting(): void {
    this.clearMain();

    // Room code display
    const cx = GAME_WIDTH / 2;
    const codeLabel = this.add.text(cx, 230, 'ROOM CODE', {
      fontSize: '14px', color: '#64748b', letterSpacing: 4,
    }).setOrigin(0.5).setDepth(10);

    const codeBg = this.add.graphics().setDepth(10);
    codeBg.fillStyle(0x1e3a5f, 0.8);
    codeBg.fillRoundedRect(cx - 120, 248, 240, 50, 8);

    const codeText = this.add.text(cx, 273, this.currentRoomCode, {
      fontSize: '28px', fontStyle: 'bold', color: '#60a5fa', letterSpacing: 8,
    }).setOrigin(0.5).setDepth(11);

    // Players waiting title
    const waitLabel = this.add.text(cx, 325, 'PLAYERS', {
      fontSize: '14px', color: '#64748b', letterSpacing: 4,
    }).setOrigin(0.5).setDepth(10);

    this.mainContainer.add([codeLabel as any, codeBg as any, codeText as any, waitLabel as any]);

    // Player list and start button are populated by the first onStateChange.
    // Do NOT read room.state.* synchronously here — state arrives as a separate
    // message a few ms after joinOrCreate resolves, so .players is undefined on
    // the joining client until that message lands.

    // Start button — always created; shown/hidden by updateStartButton()
    const startCont = this.makeMenuButton('START GAME', cx, 580, 0x22c55e, () => this.startGame());
    this.startBtn = startCont;
    this.startBtn.setAlpha(0).setVisible(false);
    (this.startBtn as any).input.enabled = false;

    // "Waiting" text — shown when not host; toggled by updateStartButton()
    this.waitingText = this.add.text(cx, 580, 'Waiting for host to start...', {
      fontSize: '18px', color: '#64748b',
    }).setOrigin(0.5).setDepth(10);

    // Back button
    this.makeMenuButton('LEAVE', cx, 650, 0x64748b, () => {
      this.room?.leave();
      this.room = null;
      this.showMainMenu();
    });

    // Subscribe to room state changes
    if (this.room) {
      const unsubState = this.room.onStateChange(() => {
        // For quick match we couldn't read state synchronously after joinOrCreate.
        // Detect host on the first state delivery: if we're the first (and only)
        // player in the map, we created this room — we're the host.
        if (this.currentRoomCode === 'PUBLIC' && !this.isHost && this.room?.state?.players) {
          let firstSid = '';
          this.room.state.players.forEach((_p: any, sid: string) => {
            if (!firstSid) firstSid = sid;
          });
          if (firstSid === this.room.sessionId) {
            this.isHost = true;
          }
        }

        this.refreshPlayerList();
        this.updateStartButton();

        // Check if host started the game
        const phase = this.room?.data?.get?.('gamePhase') as string | undefined;
        if (phase === 'playing') {
          this.launchGame();
        }
      });
      this.unsubs.push(unsubState);

      const unsubError = this.room.onError((_code: number, message: string) => {
        console.warn('[lobby] room error:', message);
        this.statusText.setText('Connection lost.\nReturning to menu...').setVisible(true);
        this.time.delayedCall(2000, () => {
          this.room = null;
          this.showMainMenu();
        });
      });
      this.unsubs.push(unsubError);
    }
  }

  private refreshPlayerList(): void {
    // Remove existing player texts
    this.playerListTexts.forEach(t => t.destroy());
    this.playerListTexts = [];

    // Guard: state.players is undefined until the first onStateChange fires
    if (!this.room?.state?.players) return;

    const cx = GAME_WIDTH / 2;
    let idx = 0;
    this.room.state.players.forEach((_p: any, sid: string) => {
      const pi = idx % 4;
      const color = PLAYER_COLORS[pi];
      const name = (_p.displayName as string | undefined) ?? 'Player ' + (idx + 1);
      const isMe = sid === this.room.sessionId;

      const row = this.add.text(cx, 350 + idx * 42, `${PLAYER_NAMES[pi]}: ${name}${isMe ? ' (You)' : ''}`, {
        fontSize: '20px',
        color: '#' + color.toString(16).padStart(6, '0'),
      }).setOrigin(0.5).setDepth(10);

      this.playerListTexts.push(row);
      idx++;
    });

    // Show NPC bot placeholders for unfilled slots
    for (let npcSlot = idx; npcSlot < 4; npcSlot++) {
      const npcColor = PLAYER_COLORS[npcSlot];
      const npcRow = this.add.text(cx, 350 + npcSlot * 42, `${PLAYER_NAMES[npcSlot]}: 🤖 NPC Bot`, {
        fontSize: '20px',
        color: '#' + npcColor.toString(16).padStart(6, '0'),
        alpha: 0.45,
      } as any).setOrigin(0.5).setDepth(10).setAlpha(0.45);
      this.playerListTexts.push(npcRow);
    }

    if (idx < 4) {
      const waiting = this.add.text(cx, 350 + 4 * 42 + 4, 'NPC bots will fill empty slots', {
        fontSize: '14px', color: '#475569',
      }).setOrigin(0.5).setDepth(10);
      this.playerListTexts.push(waiting);
    }
  }

  private updateStartButton(): void {
    // Guard: state.players is undefined until the first onStateChange fires
    if (!this.startBtn || !this.room?.state?.players) return;
    const playerCount = this.room.state.players.size;
    // Allow starting with just 1 real player — NPC bots fill the rest up to 4
    const canStart = playerCount >= 1;

    if (this.isHost) {
      this.startBtn.setVisible(true).setAlpha(canStart ? 1 : 0.4);
      (this.startBtn as any).input.enabled = canStart;
      this.waitingText?.setVisible(false);
    } else {
      this.startBtn.setVisible(false).setAlpha(0);
      (this.startBtn as any).input.enabled = false;
      this.waitingText?.setVisible(true);
    }
  }

  private async startGame(): Promise<void> {
    if (!this.room?.state?.players) return;
    const humanCount = Math.min(this.room.state.players.size, 4);
    if (humanCount < 1) return;

    // Build player order from real connected players (may be fewer than 4)
    const order: string[] = [];
    this.room.state.players.forEach((_p: any, sid: string) => {
      if (order.length < 4) order.push(sid);
    });

    // Always play a full 4-player game — NPC bots fill any empty slots
    const TOTAL = 4;

    // Initialize game state in room.data
    await this.room.data.set('gamePhase', 'playing');
    await this.room.data.set('playerOrder', order);          // only real player sids
    await this.room.data.set('humanPlayerCount', humanCount); // so clients know NPC boundary
    await this.room.data.set('board', new Array(400).fill(-1));
    await this.room.data.set('currentTurn', 0);
    await this.room.data.set('firstMove', new Array(TOTAL).fill(true));
    await this.room.data.set('scores', new Array(TOTAL).fill(0));
    await this.room.data.set('playerCount', TOTAL);

    // Pre-seed full piece sets for every NPC slot so clients can sync them
    for (let i = humanCount; i < TOTAL; i++) {
      await this.room.data.set('npcPieces_' + i, [...ALL_PIECE_NAMES]);
    }
  }

  private launchGame(): void {
    if (!this.room?.data) return;
    const order = this.room.data.get('playerOrder') as string[] | undefined;
    if (!order) return;
    const myIdx = order.indexOf(this.room.sessionId);
    const humanCount = (this.room.data.get('humanPlayerCount') as number | undefined) ?? order.length;

    setActiveRoom(this.room, myIdx >= 0 ? myIdx : 0, order, false, this.isHost, humanCount);
    this.inputActive = false;
    this.unsubs.forEach(f => f());
    this.unsubs = [];
    this.scene.start('GameScene');
  }

  private startOffline(): void {
    // 1 human (index 0) + 3 NPC bots (indices 1–3)
    setActiveRoom(null, 0, [], true, true, 1);
    this.scene.start('GameScene');
  }

  private clearMain(): void {
    this.stopListPoll();
    this.roomBrowserStatusText = null;
    this.mainContainer.removeAll(true);
    this.playerListTexts.forEach(t => t.destroy());
    this.playerListTexts = [];
  }
}
