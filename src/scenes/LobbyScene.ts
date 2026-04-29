import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';
import { ALL_PIECE_NAMES, PLAYER_COLORS, PLAYER_NAMES } from '../data/pieces';
import { setActiveRoom, BotDifficulty, setBotDifficulty, botDifficulty } from '../gameState';

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
      fontSize: '20px', color: '#8090b8', align: 'center',
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
      // Restore persisted settings (difficulty, etc.)
      try {
        const saved = await this.unboxy.saves.get('settings') as Record<string, any> | null;
        if (saved?.botDifficulty) setBotDifficulty(saved.botDifficulty as BotDifficulty);
      } catch { /* saves unavailable — use default */ }
      this.showMainMenu();
    } catch {
      this.showOfflineOption();
    }
  }

  private createBackground(): void {
    const gfx = this.add.graphics().setDepth(0);

    // Deep navy pixel-art background
    gfx.fillStyle(0x1a2744, 1);
    gfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle pixel grid overlay — tiny 2×2 squares on an 8px grid
    gfx.fillStyle(0x233460, 0.35);
    for (let x = 0; x < GAME_WIDTH; x += 8) {
      for (let y = 0; y < GAME_HEIGHT; y += 8) {
        gfx.fillRect(x, y, 1, 1);
      }
    }

    // Decorative corner pixel blocks (player colors, pixel-art style)
    const corners = [
      { x: 32, y: 32, color: PLAYER_COLORS[0] },
      { x: GAME_WIDTH - 64, y: GAME_HEIGHT - 64, color: PLAYER_COLORS[1] },
      { x: GAME_WIDTH - 64, y: 32, color: PLAYER_COLORS[2] },
      { x: 32, y: GAME_HEIGHT - 64, color: PLAYER_COLORS[3] },
    ];
    for (const c of corners) {
      // pixel mosaic cluster
      gfx.fillStyle(c.color, 0.22);
      gfx.fillRect(c.x, c.y, 32, 32);
      gfx.fillStyle(c.color, 0.12);
      gfx.fillRect(c.x - 8, c.y - 8, 48, 48);
      gfx.fillStyle(c.color, 0.06);
      gfx.fillRect(c.x - 16, c.y - 16, 64, 64);
    }
  }

  private createTitle(): void {
    // Pixel-art scroll banner behind the title
    const bx = GAME_WIDTH / 2;
    const bannerGfx = this.add.graphics().setDepth(9);
    const bw = 480, bh = 64, by = 68;
    // Main banner body
    bannerGfx.fillStyle(0xede8cf, 1);
    bannerGfx.fillRect(bx - bw / 2, by, bw, bh);
    // Top/bottom dark border lines
    bannerGfx.fillStyle(0xc07830, 1);
    bannerGfx.fillRect(bx - bw / 2, by, bw, 3);
    bannerGfx.fillRect(bx - bw / 2, by + bh - 3, bw, 3);
    // Scroll ends (left)
    bannerGfx.fillStyle(0xede8cf, 1);
    bannerGfx.fillRect(bx - bw / 2 - 16, by - 4, 18, bh + 8);
    bannerGfx.fillStyle(0xc07830, 1);
    bannerGfx.fillRect(bx - bw / 2 - 16, by - 4, 18, 3);
    bannerGfx.fillRect(bx - bw / 2 - 16, by + bh + 1, 18, 3);
    bannerGfx.fillRect(bx - bw / 2 - 16, by - 4, 3, bh + 8);
    // Scroll ends (right)
    bannerGfx.fillStyle(0xede8cf, 1);
    bannerGfx.fillRect(bx + bw / 2 - 2, by - 4, 18, bh + 8);
    bannerGfx.fillStyle(0xc07830, 1);
    bannerGfx.fillRect(bx + bw / 2 - 2, by - 4, 18, 3);
    bannerGfx.fillRect(bx + bw / 2 - 2, by + bh + 1, 18, 3);
    bannerGfx.fillRect(bx + bw / 2 + 13, by - 4, 3, bh + 8);
    // Subtle inner line accents
    bannerGfx.fillStyle(0xd4a050, 0.4);
    bannerGfx.fillRect(bx - bw / 2 + 6, by + 8, bw - 12, 1);
    bannerGfx.fillRect(bx - bw / 2 + 6, by + bh - 9, bw - 12, 1);

    // Letters — pixel-bold, dark brown on cream
    const colors = ['#4060c8', '#d04040', '#38a840', '#d09020', '#4060c8', '#d04040'];
    const letters = 'BLOKUS'.split('');
    const letterObjs: Phaser.GameObjects.Text[] = [];
    const letterW = 54, gap = 6;
    const totalW = letters.length * letterW + (letters.length - 1) * gap;
    const startX = GAME_WIDTH / 2 - totalW / 2 + letterW / 2;

    for (let i = 0; i < letters.length; i++) {
      const lt = this.add.text(startX + i * (letterW + gap), by + bh / 2, letters[i], {
        fontSize: '52px',
        fontStyle: 'bold',
        color: colors[i],
        stroke: '#2a1a08',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(11);
      letterObjs.push(lt);

      this.tweens.add({
        targets: lt,
        y: { from: by + bh / 2 - 1, to: by + bh / 2 + 1 },
        yoyo: true, repeat: -1,
        duration: 1600 + i * 200,
        ease: 'Sine.easeInOut',
      });
    }

    // Subtitle in pixel style below banner
    this.add.text(GAME_WIDTH / 2, by + bh + 18, '— STRATEGY BOARD GAME —', {
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#8090b8',
      letterSpacing: 4,
    }).setOrigin(0.5).setDepth(10);
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
    this.makeMenuButton('PLAY OFFLINE', cx, baseY + 308, 0x64748b, () => this.showDifficultyPicker());
  }

  private showOfflineOption(): void {
    this.clearMain();
    this.statusText.setText('Online unavailable').setVisible(true);
    this.makeMenuButton('PLAY OFFLINE', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, 0x64748b, () => this.showDifficultyPicker());
  }

  private showDifficultyPicker(): void {
    this.clearMain();
    this.statusText.setVisible(false);

    const cx = GAME_WIDTH / 2;

    // Pixel scroll title
    const titleGfx = this.add.graphics().setDepth(10);
    titleGfx.fillStyle(0xede8cf, 1);
    titleGfx.fillRect(cx - 100, 208, 200, 26);
    titleGfx.lineStyle(2, 0xc07830, 1);
    titleGfx.strokeRect(cx - 100, 208, 200, 26);
    this.mainContainer.add(titleGfx as any);

    const titleTxt = this.add.text(cx, 221, 'BOT DIFFICULTY', {
      fontSize: '13px', fontStyle: 'bold', color: '#2a1a08', letterSpacing: 4,
    }).setOrigin(0.5).setDepth(11);
    this.mainContainer.add(titleTxt as any);

    const levels: Array<{
      key: BotDifficulty;
      label: string;
      color: number;
      desc: string;
    }> = [
      { key: 'easy',   label: '⭐  EASY',   color: 0x22c55e, desc: 'Bots pick moves at random — great for learning' },
      { key: 'medium', label: '⭐⭐  MEDIUM', color: 0xf59e0b, desc: 'Bots prefer large pieces and open corners'       },
      { key: 'hard',   label: '⭐⭐⭐  HARD',  color: 0xef4444, desc: 'Bots play aggressively and very consistently'   },
    ];

    const CARD_W = 560, CARD_H = 90, CARD_GAP = 14;
    const startY = 260;

    levels.forEach((lvl, i) => {
      const y = startY + i * (CARD_H + CARD_GAP);
      const isSelected = botDifficulty === lvl.key;
      const colorHex = '#' + lvl.color.toString(16).padStart(6, '0');

      const cardGfx = this.add.graphics().setDepth(10);
      const drawCard = (hovered: boolean) => {
        cardGfx.clear();
        // Shadow
        cardGfx.fillStyle(0x0a1020, 0.6);
        cardGfx.fillRect(-CARD_W / 2 + 4, -CARD_H / 2 + 4, CARD_W, CARD_H);
        // Body — cream if selected/hovered, dark blue otherwise
        if (isSelected || hovered) {
          cardGfx.fillStyle(0xede8cf, 1);
        } else {
          cardGfx.fillStyle(0x2e4070, 1);
        }
        cardGfx.fillRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
        // Color stripe on left
        cardGfx.fillStyle(lvl.color, 1);
        cardGfx.fillRect(-CARD_W / 2, -CARD_H / 2, 8, CARD_H);
        // Border
        cardGfx.lineStyle(isSelected ? 3 : 2, lvl.color, 1);
        cardGfx.strokeRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
        // Highlight line
        cardGfx.fillStyle(0xfaf6e8, isSelected ? 0.4 : 0.15);
        cardGfx.fillRect(-CARD_W / 2 + 8, -CARD_H / 2 + 2, CARD_W - 10, 2);
      };
      drawCard(false);

      const textColor = isSelected ? '#2a1a08' : colorHex;
      const labelTxt = this.add.text(-CARD_W / 2 + 24, -16, lvl.label, {
        fontSize: '20px', fontStyle: 'bold', color: textColor,
      }).setOrigin(0, 0.5).setDepth(11);

      const descTxt = this.add.text(-CARD_W / 2 + 24, 16, lvl.desc, {
        fontSize: '14px', color: isSelected ? '#4a3010' : '#8090b8',
      }).setOrigin(0, 0.5).setDepth(11);

      const badgeTxt = this.add.text(CARD_W / 2 - 20, 0,
        isSelected ? '✓ SELECTED' : 'SELECT', {
        fontSize: '13px', fontStyle: 'bold',
        color: isSelected ? colorHex : '#5060a0',
      }).setOrigin(1, 0.5).setDepth(11);

      const cont = this.add.container(cx, y + CARD_H / 2, [cardGfx, labelTxt, descTxt, badgeTxt])
        .setDepth(10)
        .setInteractive(
          new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
          Phaser.Geom.Rectangle.Contains
        );

      cont.on('pointerover', () => {
        drawCard(true);
        labelTxt.setColor('#2a1a08');
        descTxt.setColor('#4a3010');
        this.tweens.add({ targets: cont, scaleX: 1.02, scaleY: 1.02, duration: 80 });
      });
      cont.on('pointerout', () => {
        drawCard(false);
        labelTxt.setColor(isSelected ? '#2a1a08' : colorHex);
        descTxt.setColor(isSelected ? '#4a3010' : '#8090b8');
        this.tweens.add({ targets: cont, scaleX: 1, scaleY: 1, duration: 80 });
      });
      cont.on('pointerdown', () => {
        setBotDifficulty(lvl.key);
        if (this.unboxy) {
          this.unboxy.saves.get('settings').then((existing: Record<string, any> | null) => {
            return this.unboxy.saves.set('settings', { ...(existing ?? {}), botDifficulty: lvl.key });
          }).catch(() => { /* ignore */ });
        }
        this.startOffline();
      });

      this.mainContainer.add(cont as any);
    });

    this.makeMenuButton('BACK', cx, startY + levels.length * (CARD_H + CARD_GAP) + 28, 0x64748b, () => {
      if (this.unboxy) {
        this.showMainMenu();
      } else {
        this.showOfflineOption();
      }
    });
  }

  private makeMenuButton(
    label: string,
    x: number,
    y: number,
    _color: number,
    callback: () => void
  ): Phaser.GameObjects.Container {
    const w = 340, h = 48;
    const bg = this.add.graphics();

    const drawBtn = (pressed: boolean) => {
      bg.clear();
      const sh = pressed ? 0 : 4; // shadow offset (raised vs pressed)
      // Shadow / depth layer
      bg.fillStyle(0x7a4e18, 1);
      bg.fillRect(-w / 2 + sh, -h / 2 + sh, w, h);
      // Main cream body
      bg.fillStyle(0xede8cf, 1);
      bg.fillRect(-w / 2, -h / 2, w, h);
      // Orange border
      bg.lineStyle(3, 0xc07830, 1);
      bg.strokeRect(-w / 2, -h / 2, w, h);
      // Top-left pixel highlight
      bg.fillStyle(0xfaf6e8, 1);
      bg.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, 3);
      bg.fillRect(-w / 2 + 3, -h / 2 + 3, 3, h - 6);
      // Bottom-right inner shadow
      bg.fillStyle(0xc07830, 0.35);
      bg.fillRect(-w / 2 + 3, h / 2 - 6, w - 6, 3);
      bg.fillRect(w / 2 - 6, -h / 2 + 3, 3, h - 6);
    };
    drawBtn(false);

    const text = this.add.text(0, -1, label, {
      fontSize: '18px', fontStyle: 'bold',
      color: '#2a1a08',
      align: 'center',
    }).setOrigin(0.5);

    const cont = this.add.container(x, y, [bg, text]).setDepth(10).setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains
    );

    cont.on('pointerover', () => {
      drawBtn(false);
      text.setColor('#4060c8');
      this.tweens.add({ targets: cont, scaleX: 1.03, scaleY: 1.03, duration: 80 });
    });
    cont.on('pointerout', () => {
      drawBtn(false);
      text.setColor('#2a1a08');
      this.tweens.add({ targets: cont, scaleX: 1, scaleY: 1, duration: 80 });
    });
    cont.on('pointerdown', () => {
      drawBtn(true);
      text.setY(2);
    });
    cont.on('pointerup', () => {
      drawBtn(false);
      text.setY(-1);
      callback();
    });

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

    // Pixel panel
    const panelGfx = this.add.graphics().setDepth(8);
    panelGfx.fillStyle(0x0a1020, 0.7);
    panelGfx.fillRect(cx - 228, 242, 460, 240);
    panelGfx.fillStyle(0x2e4a8a, 1);
    panelGfx.fillRect(cx - 230, 240, 460, 240);
    panelGfx.fillStyle(0x3d5fa0, 1);
    panelGfx.fillRect(cx - 226, 244, 452, 232);
    panelGfx.lineStyle(3, 0x6080c8, 1);
    panelGfx.strokeRect(cx - 230, 240, 460, 240);
    this.mainContainer.add(panelGfx as any);

    const labelGfx = this.add.graphics().setDepth(10);
    labelGfx.fillStyle(0xede8cf, 1);
    labelGfx.fillRect(cx - 100, 252, 200, 24);
    labelGfx.lineStyle(2, 0xc07830, 1);
    labelGfx.strokeRect(cx - 100, 252, 200, 24);
    this.mainContainer.add(labelGfx as any);

    const label = this.add.text(cx, 264, 'ENTER ROOM CODE', {
      fontSize: '12px', fontStyle: 'bold', color: '#2a1a08', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(11);

    // Pixel input box
    const inputBg = this.add.graphics().setDepth(10);
    inputBg.fillStyle(0x1a2744, 1);
    inputBg.fillRect(cx - 150, 284, 300, 54);
    inputBg.lineStyle(2, 0xc07830, 1);
    inputBg.strokeRect(cx - 150, 284, 300, 54);

    this.joinInputText = this.add.text(cx, 311, '|', {
      fontSize: '28px', fontStyle: 'bold', color: '#f0c060', align: 'center',
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

    // Pixel panel — shadow + blue body
    const panelGfx = this.add.graphics().setDepth(8);
    panelGfx.fillStyle(0x0a1020, 0.7);
    panelGfx.fillRect(cx - 458, 197, 920, 400);
    panelGfx.fillStyle(0x2e4a8a, 1);
    panelGfx.fillRect(cx - 460, 195, 920, 400);
    panelGfx.fillStyle(0x3d5fa0, 1);
    panelGfx.fillRect(cx - 456, 199, 912, 392);
    panelGfx.lineStyle(3, 0x6080c8, 1);
    panelGfx.strokeRect(cx - 460, 195, 920, 400);
    panelGfx.fillStyle(0x6080c8, 0.4);
    panelGfx.fillRect(cx - 456, 199, 912, 2);
    panelGfx.fillRect(cx - 456, 199, 2, 392);
    this.mainContainer.add(panelGfx as any);

    // Header label (scroll style)
    const hdrGfx = this.add.graphics().setDepth(10);
    hdrGfx.fillStyle(0xede8cf, 1);
    hdrGfx.fillRect(cx - 70, 203, 140, 24);
    hdrGfx.lineStyle(2, 0xc07830, 1);
    hdrGfx.strokeRect(cx - 70, 203, 140, 24);
    this.mainContainer.add(hdrGfx as any);

    const headerTitle = this.add.text(cx, 215, 'OPEN ROOMS', {
      fontSize: '12px', fontStyle: 'bold', color: '#2a1a08', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(11);

    // Column headers
    const colY = 242;
    const colHeaders = [
      this.add.text(cx - 390, colY, 'CODE', { fontSize: '12px', fontStyle: 'bold', color: '#ede8cf', letterSpacing: 3 }).setDepth(10),
      this.add.text(cx - 200, colY, 'HOST', { fontSize: '12px', fontStyle: 'bold', color: '#ede8cf', letterSpacing: 3 }).setDepth(10),
      this.add.text(cx + 110, colY, 'PLAYERS', { fontSize: '12px', fontStyle: 'bold', color: '#ede8cf', letterSpacing: 3 }).setDepth(10),
    ];

    const divGfx = this.add.graphics().setDepth(9);
    divGfx.lineStyle(2, 0x4a6090, 1);
    divGfx.lineBetween(cx - 450, 258, cx + 450, 258);
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
      const rowH = 56;
      const firstRowY = 268;
      const maxRows = 5;

      open.slice(0, maxRows).forEach((entry, i) => {
        const rowY = firstRowY + i * rowH;
        const isEven = i % 2 === 0;

        // Row — pixel alternating rows
        const rowBg = this.add.graphics().setDepth(9);
        rowBg.fillStyle(isEven ? 0x3a5898 : 0x345090, 1);
        rowBg.fillRect(cx - 448, rowY - 2, 896, rowH - 4);
        rowBg.lineStyle(1, 0x4a6ab0, 0.4);
        rowBg.strokeRect(cx - 448, rowY - 2, 896, rowH - 4);
        this.roomBrowserRows.push(rowBg);

        // Room code
        const codeStr = entry.roomCode || 'PUBLIC';
        const codeT = this.add.text(cx - 390, rowY + rowH / 2 - 6, codeStr, {
          fontSize: '18px', fontStyle: 'bold', color: '#f0c060',
        }).setOrigin(0, 0.5).setDepth(10);
        this.roomBrowserRows.push(codeT);

        // Host name
        const hostName: string = (entry.metadata as any)?.hostName ?? 'Unknown';
        const hostT = this.add.text(cx - 200, rowY + rowH / 2 - 6, hostName, {
          fontSize: '16px', color: '#ede8cf',
        }).setOrigin(0, 0.5).setDepth(10);
        this.roomBrowserRows.push(hostT);

        // Player count squares (pixel style)
        for (let p = 0; p < entry.maxClients; p++) {
          const filled = p < entry.clients;
          const dotGfx = this.add.graphics().setDepth(10);
          dotGfx.fillStyle(filled ? PLAYER_COLORS[p % 4] : 0x2a3a60, 1);
          dotGfx.fillRect(cx + 110 + p * 22, rowY + rowH / 2 - 12, 16, 16);
          dotGfx.lineStyle(1, filled ? 0xffffff : 0x4a6090, 0.4);
          dotGfx.strokeRect(cx + 110 + p * 22, rowY + rowH / 2 - 12, 16, 16);
          this.roomBrowserRows.push(dotGfx);
        }

        const countT = this.add.text(cx + 230, rowY + rowH / 2 - 6, `${entry.clients}/${entry.maxClients}`, {
          fontSize: '14px', color: '#8090b8',
        }).setOrigin(0, 0.5).setDepth(10);
        this.roomBrowserRows.push(countT);

        // JOIN button — pixel style
        const btnW = 90, btnH = 32;
        const btnGfx = this.add.graphics().setDepth(10);
        const drawJoinBtn = (hover: boolean) => {
          btnGfx.clear();
          btnGfx.fillStyle(0x7a4e18, 1);
          btnGfx.fillRect(-btnW / 2 + 2, -btnH / 2 + 2, btnW, btnH);
          btnGfx.fillStyle(hover ? 0xf0e0a0 : 0xede8cf, 1);
          btnGfx.fillRect(-btnW / 2, -btnH / 2, btnW, btnH);
          btnGfx.lineStyle(2, 0xc07830, 1);
          btnGfx.strokeRect(-btnW / 2, -btnH / 2, btnW, btnH);
        };
        drawJoinBtn(false);
        const btnT = this.add.text(0, 0, 'JOIN', {
          fontSize: '15px', fontStyle: 'bold', color: '#2a1a08',
        }).setOrigin(0.5);
        const btnCont = this.add.container(cx + 390, rowY + rowH / 2 - 6, [btnGfx, btnT])
          .setDepth(10)
          .setInteractive(new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH), Phaser.Geom.Rectangle.Contains);

        btnCont.on('pointerover', () => { drawJoinBtn(true); btnT.setColor('#4060c8'); });
        btnCont.on('pointerout', () => { drawJoinBtn(false); btnT.setColor('#2a1a08'); });
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

    const cx = GAME_WIDTH / 2;

    // Pixel-art panel background
    const panelGfx = this.add.graphics().setDepth(8);
    // Shadow
    panelGfx.fillStyle(0x0a1020, 0.7);
    panelGfx.fillRect(cx - 258, 222, 520, 420);
    // Blue panel body
    panelGfx.fillStyle(0x2e4a8a, 1);
    panelGfx.fillRect(cx - 260, 220, 520, 420);
    // Inner lighter face
    panelGfx.fillStyle(0x3d5fa0, 1);
    panelGfx.fillRect(cx - 256, 224, 512, 412);
    // Border
    panelGfx.lineStyle(3, 0x6080c8, 1);
    panelGfx.strokeRect(cx - 260, 220, 520, 420);
    // Top-left highlight
    panelGfx.fillStyle(0x6080c8, 0.4);
    panelGfx.fillRect(cx - 256, 224, 512, 2);
    panelGfx.fillRect(cx - 256, 224, 2, 412);
    this.mainContainer.add(panelGfx as any);

    // Room code section — pixel scroll label
    const codeLabelGfx = this.add.graphics().setDepth(10);
    codeLabelGfx.fillStyle(0xede8cf, 1);
    codeLabelGfx.fillRect(cx - 80, 235, 160, 26);
    codeLabelGfx.lineStyle(2, 0xc07830, 1);
    codeLabelGfx.strokeRect(cx - 80, 235, 160, 26);
    this.mainContainer.add(codeLabelGfx as any);

    const codeLabel = this.add.text(cx, 248, 'ROOM CODE', {
      fontSize: '12px', fontStyle: 'bold', color: '#2a1a08', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(11);

    // Code value box
    const codeBg = this.add.graphics().setDepth(10);
    codeBg.fillStyle(0x1a2744, 1);
    codeBg.fillRect(cx - 110, 266, 220, 46);
    codeBg.lineStyle(2, 0xc07830, 1);
    codeBg.strokeRect(cx - 110, 266, 220, 46);

    const codeText = this.add.text(cx, 289, this.currentRoomCode, {
      fontSize: '26px', fontStyle: 'bold', color: '#f0c060', letterSpacing: 10,
    }).setOrigin(0.5).setDepth(11);

    // Players section label
    const waitLabelGfx = this.add.graphics().setDepth(10);
    waitLabelGfx.fillStyle(0xede8cf, 1);
    waitLabelGfx.fillRect(cx - 60, 322, 120, 22);
    waitLabelGfx.lineStyle(2, 0xc07830, 1);
    waitLabelGfx.strokeRect(cx - 60, 322, 120, 22);
    this.mainContainer.add(waitLabelGfx as any);

    const waitLabel = this.add.text(cx, 333, 'PLAYERS', {
      fontSize: '11px', fontStyle: 'bold', color: '#2a1a08', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(11);

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
    this.playerListTexts.forEach(t => t.destroy());
    this.playerListTexts = [];

    if (!this.room?.state?.players) return;

    const cx = GAME_WIDTH / 2;
    const rowH = 42, startY = 352;

    let idx = 0;
    this.room.state.players.forEach((_p: any, sid: string) => {
      const pi = idx % 4;
      const color = PLAYER_COLORS[pi];
      const name = (_p.displayName as string | undefined) ?? 'Player ' + (idx + 1);
      const isMe = sid === this.room.sessionId;
      const y = startY + idx * rowH;

      // Row box — cream with player color tint
      const rowGfx = this.add.graphics().setDepth(10);
      rowGfx.fillStyle(0xede8cf, 1);
      rowGfx.fillRect(cx - 200, y, 400, 34);
      rowGfx.fillStyle(color, 0.18);
      rowGfx.fillRect(cx - 200, y, 400, 34);
      rowGfx.lineStyle(2, color, 0.7);
      rowGfx.strokeRect(cx - 200, y, 400, 34);
      // Color swatch on left
      rowGfx.fillStyle(color, 1);
      rowGfx.fillRect(cx - 196, y + 4, 10, 26);

      const rowTxt = this.add.text(cx - 178, y + 17,
        `${PLAYER_NAMES[pi]}: ${name}${isMe ? '  ◀ YOU' : ''}`, {
        fontSize: '16px', fontStyle: 'bold',
        color: '#2a1a08',
      }).setOrigin(0, 0.5).setDepth(11);

      this.playerListTexts.push(rowGfx as any, rowTxt);
      idx++;
    });

    // NPC bot placeholders
    for (let npcSlot = idx; npcSlot < 4; npcSlot++) {
      const color = PLAYER_COLORS[npcSlot];
      const y = startY + npcSlot * rowH;

      const rowGfx = this.add.graphics().setDepth(10);
      rowGfx.fillStyle(0x1a2744, 0.5);
      rowGfx.fillRect(cx - 200, y, 400, 34);
      rowGfx.lineStyle(1, color, 0.25);
      rowGfx.strokeRect(cx - 200, y, 400, 34);
      rowGfx.fillStyle(color, 0.18);
      rowGfx.fillRect(cx - 196, y + 4, 10, 26);

      const rowTxt = this.add.text(cx - 178, y + 17,
        `${PLAYER_NAMES[npcSlot]}: 🤖 NPC Bot`, {
        fontSize: '15px', color: '#6070a0',
      }).setOrigin(0, 0.5).setDepth(11);

      this.playerListTexts.push(rowGfx as any, rowTxt);
    }

    if (idx < 4) {
      const hint = this.add.text(cx, startY + 4 * rowH + 6, 'Empty slots are filled by NPC bots', {
        fontSize: '13px', color: '#5060a0',
      }).setOrigin(0.5).setDepth(10);
      this.playerListTexts.push(hint);
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
