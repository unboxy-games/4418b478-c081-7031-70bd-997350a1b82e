import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';
import { PLAYER_COLORS, PLAYER_NAMES } from '../data/pieces';
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
  private mainContainer!: Phaser.GameObjects.Container;
  private inputActive = false;
  private joinCodeInput = '';
  private joinInputText!: Phaser.GameObjects.Text;
  private isHost = false;
  private currentRoomCode = '';

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
    const title = this.add.text(GAME_WIDTH / 2, 90, 'BLOKUS', {
      fontSize: '72px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#1e3a5f',
      strokeThickness: 6,
      letterSpacing: 12,
    }).setOrigin(0.5).setDepth(10);

    const subtitle = this.add.text(GAME_WIDTH / 2, 155, 'ONLINE MULTIPLAYER', {
      fontSize: '18px',
      color: '#64748b',
      letterSpacing: 6,
    }).setOrigin(0.5).setDepth(10);

    // Pulse tween for title
    this.tweens.add({
      targets: title,
      scaleX: 1.03, scaleY: 1.03,
      yoyo: true, repeat: -1,
      duration: 2500,
      ease: 'Sine.easeInOut',
    });

    // Colored letter highlights
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444'];
    const letters = 'BLOKUS'.split('');
    let lx = GAME_WIDTH / 2 - 180;
    for (let i = 0; i < letters.length; i++) {
      const lt = this.add.text(lx + i * 62, 88, letters[i], {
        fontSize: '72px', fontStyle: 'bold', color: colors[i],
      }).setOrigin(0.5).setAlpha(0.5).setDepth(11);
      this.tweens.add({
        targets: lt,
        alpha: { from: 0.5, to: 0.85 },
        yoyo: true, repeat: -1,
        duration: 1800 + i * 300,
        ease: 'Sine.easeInOut',
      });
    }

    void subtitle;
  }

  private showMainMenu(): void {
    this.clearMain();
    this.statusText.setVisible(false);

    const cx = GAME_WIDTH / 2;
    const baseY = 260;

    // Online mode buttons
    if (this.unboxy?.isAuthenticated) {
      this.makeMenuButton('CREATE ROOM', cx, baseY, 0x3b82f6, () => this.createRoom());
      this.makeMenuButton('JOIN ROOM', cx, baseY + 80, 0x22c55e, () => this.showJoinInput());
      this.makeMenuButton('QUICK MATCH', cx, baseY + 160, 0x8b5cf6, () => this.quickMatch());
    } else {
      this.makeMenuButton('PLAY ONLINE (Sign in)', cx, baseY, 0x3b82f6, () => this.quickMatch());
    }
    this.makeMenuButton('PLAY OFFLINE', cx, baseY + 240, 0x64748b, () => this.startOffline());
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
    this.isHost = (this.room.state.players.size === 1);
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

    // Render player list initially
    this.refreshPlayerList();

    // Start button (host only, needs 2+ players)
    if (this.isHost) {
      const startCont = this.makeMenuButton('START GAME', cx, 580, 0x22c55e, () => this.startGame());
      this.startBtn = startCont;
      this.updateStartButton();
    } else {
      this.add.text(cx, 580, 'Waiting for host to start...', {
        fontSize: '18px', color: '#64748b',
      }).setOrigin(0.5).setDepth(10);
    }

    // Back button
    this.makeMenuButton('LEAVE', cx, 650, 0x64748b, () => {
      this.room?.leave();
      this.room = null;
      this.showMainMenu();
    });

    // Subscribe to room state changes
    if (this.room) {
      const unsubState = this.room.onStateChange(() => {
        this.refreshPlayerList();
        if (this.isHost) this.updateStartButton();

        // Check if host started the game
        const phase = this.room.data.get('gamePhase') as string | undefined;
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

    if (!this.room) return;

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

    // Waiting message
    if (idx < 2) {
      const waiting = this.add.text(cx, 350 + idx * 42 + 10, 'Waiting for more players...', {
        fontSize: '16px', color: '#475569',
      }).setOrigin(0.5).setDepth(10);
      this.playerListTexts.push(waiting);
    }
  }

  private updateStartButton(): void {
    if (!this.startBtn || !this.room) return;
    const playerCount = this.room.state.players.size;
    const canStart = playerCount >= 2;
    this.startBtn.setAlpha(canStart ? 1 : 0.4);
    (this.startBtn as any).input.enabled = canStart;
  }

  private async startGame(): Promise<void> {
    if (!this.room) return;
    const playerCount = Math.min(this.room.state.players.size, 4);
    if (playerCount < 2) return;

    // Build player order from current room members
    const order: string[] = [];
    this.room.state.players.forEach((_p: any, sid: string) => {
      if (order.length < 4) order.push(sid);
    });

    // Initialize game state in room.data
    await this.room.data.set('gamePhase', 'playing');
    await this.room.data.set('playerOrder', order);
    await this.room.data.set('board', new Array(400).fill(-1));
    await this.room.data.set('currentTurn', 0);
    await this.room.data.set('firstMove', new Array(playerCount).fill(true));
    await this.room.data.set('scores', new Array(playerCount).fill(0));
    await this.room.data.set('playerCount', playerCount);

    // Set each player's initial pieces (must be done for all known players by host)
    // Each player sets their own pieces when GameScene starts
  }

  private launchGame(): void {
    if (!this.room) return;
    const order = this.room.data.get('playerOrder') as string[];
    const myIdx = order.indexOf(this.room.sessionId);

    setActiveRoom(this.room, myIdx >= 0 ? myIdx : 0, order);
    this.inputActive = false;
    this.unsubs.forEach(f => f());
    this.unsubs = [];
    this.scene.start('GameScene');
  }

  private startOffline(): void {
    // Create a mock offline room
    setActiveRoom(null, 0, [], true);
    this.scene.start('GameScene');
  }

  private clearMain(): void {
    this.mainContainer.removeAll(true);
    this.playerListTexts.forEach(t => t.destroy());
    this.playerListTexts = [];
  }
}
