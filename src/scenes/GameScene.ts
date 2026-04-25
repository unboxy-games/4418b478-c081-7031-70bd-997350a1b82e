import Phaser from 'phaser';
import {
  CELL, BOARD_ORIG_X, BOARD_ORIG_Y, BOARD_COLS, BOARD_ROWS, BOARD_PX,
  PANEL_X, PANEL_W, THUMB_COLS, THUMB_SIZE, GAME_WIDTH, GAME_HEIGHT,
} from '../config';
import {
  ALL_PIECE_NAMES, PIECE_ORIENTATIONS, BASE_PIECES,
  PLAYER_COLORS, PLAYER_COLORS_DARK, PLAYER_NAMES, PLAYER_CORNERS,
  canPlacePiece, getPieceCells, countRemainingCells, hasValidMove,
} from '../data/pieces';
import { activeRoom, myPlayerIndex, playerOrder, isOfflineMode, setActiveRoom } from '../gameState';

// ─── Offline AI stub ──────────────────────────────────────────────────────────
function offlineFindMove(
  board: number[],
  pieces: string[],
  playerIndex: number,
  isFirstMove: boolean
): { pieceName: string; orientation: number; bx: number; by: number } | null {
  for (const name of pieces) {
    const orients = PIECE_ORIENTATIONS[name];
    for (let oi = 0; oi < orients.length; oi++) {
      const cells = orients[oi];
      for (let by = 0; by < BOARD_ROWS; by++) {
        for (let bx = 0; bx < BOARD_COLS; bx++) {
          const abs = cells.map(([dx, dy]) => [bx + dx, by + dy] as [number, number]);
          if (canPlacePiece(board, abs, playerIndex, isFirstMove)) {
            return { pieceName: name, orientation: oi, bx, by };
          }
        }
      }
    }
  }
  return null;
}

// ─── Scene ────────────────────────────────────────────────────────────────────
export class GameScene extends Phaser.Scene {
  // Online
  private room: any = null;
  private unsubs: Array<() => void> = [];

  // Game state
  private board: number[] = new Array(400).fill(-1);
  private currentTurn = 0;
  private firstMove: boolean[] = [true, true, true, true];
  private scores: number[] = [0, 0, 0, 0];
  private playerCount = 2;
  private gamePhase: 'playing' | 'gameover' = 'playing';
  private skippedInRow: number[] = [0, 0, 0, 0];

  // Per-player remaining pieces
  private playerPieces: string[][] = [];
  // myPlayerIndex cached
  private myIdx = 0;
  private myOrder: string[] = [];

  // Interaction
  private selectedPiece: string | null = null;
  private selectedOriIdx = 0;
  private hoverTile: { x: number; y: number } | null = null;

  // Graphics
  private boardBgGfx!: Phaser.GameObjects.Graphics;
  private boardPiecesGfx!: Phaser.GameObjects.Graphics;
  private previewGfx!: Phaser.GameObjects.Graphics;

  // Panel containers
  private thumbContainers: Phaser.GameObjects.Container[] = [];
  private thumbGfxList: Phaser.GameObjects.Graphics[] = [];
  private panelBg!: Phaser.GameObjects.Graphics;
  private turnText!: Phaser.GameObjects.Text;
  private scoreTexts: Phaser.GameObjects.Text[] = [];
  private myPiecesLabel!: Phaser.GameObjects.Text;
  private gameOverOverlay!: Phaser.GameObjects.Container;

  // Buttons
  private rotateBtnGfx!: Phaser.GameObjects.Graphics;
  private flipBtnGfx!: Phaser.GameObjects.Graphics;
  private passBtnGfx!: Phaser.GameObjects.Graphics;

  // Touch-confirm placement button
  private placeBtnGfx!: Phaser.GameObjects.Graphics;
  private placeBtnTxt!: Phaser.GameObjects.Text;
  private placeBtnZone!: Phaser.GameObjects.Zone;
  private readonly PLACE_BTN = { x: 0, y: 0, w: 0, h: 0 };

  // Particles
  private emitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.room = activeRoom;
    this.myIdx = myPlayerIndex;
    this.myOrder = [...playerOrder];

    // Initialize state
    if (this.room) {
      this.syncFromRoom();
    } else {
      this.initOfflineGame();
    }

    // Enable multi-touch (joystick + board interaction, or two-finger pinch)
    this.input.addPointer(2);

    this.buildBackground();
    this.buildBoardGraphics();
    this.buildPanel();
    this.buildControls();
    this.setupBoardInput();
    this.buildParticles();

    if (this.room) {
      this.setupRoomListeners();
      // Set my pieces in room state
      this.room.player.set('pieces', [...ALL_PIECE_NAMES]);
    }

    this.renderAll();

    // Scene shutdown cleanup
    this.events.once('shutdown', () => {
      this.unsubs.forEach(f => f());
      this.room?.leave();
    });
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  private initOfflineGame(): void {
    this.playerCount = 2;
    this.board = new Array(400).fill(-1);
    this.currentTurn = 0;
    this.firstMove = [true, true, true, true];
    this.scores = [0, 0, 0, 0];
    this.gamePhase = 'playing';
    this.skippedInRow = [0, 0, 0, 0];
    for (let i = 0; i < this.playerCount; i++) {
      this.playerPieces[i] = [...ALL_PIECE_NAMES];
    }
    this.myIdx = 0;
    // In offline mode, only player 0 is human; schedule AI for player 1
    if (isOfflineMode && this.currentTurn !== this.myIdx) {
      this.scheduleAIMove();
    }
  }

  private syncFromRoom(): void {
    if (!this.room) return;
    const board = this.room.data.get('board') as number[] | undefined;
    if (board) this.board = [...board];
    this.currentTurn = (this.room.data.get('currentTurn') as number | undefined) ?? 0;
    this.playerCount = (this.room.data.get('playerCount') as number | undefined) ?? 2;
    const fm = this.room.data.get('firstMove') as boolean[] | undefined;
    if (fm) this.firstMove = [...fm];
    const sc = this.room.data.get('scores') as number[] | undefined;
    if (sc) this.scores = [...sc];
    this.gamePhase = ((this.room.data.get('gamePhase') as string) === 'gameover') ? 'gameover' : 'playing';

    // Sync pieces from room.player state
    for (let i = 0; i < this.playerCount; i++) {
      const sid = this.myOrder[i];
      if (sid) {
        const pieces = this.room.player.get(sid, 'pieces') as string[] | undefined;
        this.playerPieces[i] = pieces ? [...pieces] : [...ALL_PIECE_NAMES];
      } else {
        this.playerPieces[i] = [...ALL_PIECE_NAMES];
      }
    }
  }

  // ─── Room listeners ────────────────────────────────────────────────────────

  private setupRoomListeners(): void {
    if (!this.room) return;
    const unsub = this.room.onStateChange(() => {
      this.syncFromRoom();
      this.renderAll();
      if (this.gamePhase === 'gameover') this.showGameOver();
    });
    this.unsubs.push(unsub);
  }

  // ─── Background ────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const gfx = this.add.graphics().setDepth(0);
    gfx.fillGradientStyle(0x0d1b2a, 0x0d1b2a, 0x0a1628, 0x0a1628, 1);
    gfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Left margin accent
    gfx.fillStyle(0xffffff, 0.015);
    gfx.fillRect(0, 0, BOARD_ORIG_X - 4, GAME_HEIGHT);

    // Subtle vignette at board edges
    gfx.fillStyle(0x000000, 0.15);
    gfx.fillRect(0, 0, GAME_WIDTH, BOARD_ORIG_Y - 2);
    gfx.fillRect(0, BOARD_ORIG_Y + BOARD_PX + 2, GAME_WIDTH, GAME_HEIGHT);
  }

  // ─── Board graphics ────────────────────────────────────────────────────────

  private buildBoardGraphics(): void {
    // Static board background (drawn once)
    this.boardBgGfx = this.add.graphics().setDepth(1);
    this.drawBoardBackground();

    // Dynamic pieces layer
    this.boardPiecesGfx = this.add.graphics().setDepth(2);

    // Preview layer (hover)
    this.previewGfx = this.add.graphics().setDepth(3);
  }

  private drawBoardBackground(): void {
    const g = this.boardBgGfx;
    g.clear();

    // Board background panel
    g.fillStyle(0x0f2033, 1);
    g.fillRoundedRect(BOARD_ORIG_X - 4, BOARD_ORIG_Y - 4, BOARD_PX + 8, BOARD_PX + 8, 4);

    // Draw cells
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const wx = BOARD_ORIG_X + col * CELL;
        const wy = BOARD_ORIG_Y + row * CELL;
        const dark = (col + row) % 2 === 0;
        g.fillStyle(dark ? 0x132437 : 0x162a40, 1);
        g.fillRect(wx, wy, CELL, CELL);
        // Grid lines
        g.lineStyle(1, 0x1e3a5f, 0.5);
        g.strokeRect(wx, wy, CELL, CELL);
      }
    }

    // Corner markers
    for (let pi = 0; pi < 4; pi++) {
      const [cx, cy] = PLAYER_CORNERS[pi];
      const wx = BOARD_ORIG_X + cx * CELL;
      const wy = BOARD_ORIG_Y + cy * CELL;
      g.fillStyle(PLAYER_COLORS[pi], 0.5);
      g.fillTriangle(wx, wy, wx + CELL, wy, wx, wy + CELL);
      g.lineStyle(2, PLAYER_COLORS[pi], 0.9);
      g.strokeRect(wx, wy, CELL, CELL);
    }
  }

  private renderBoard(): void {
    const g = this.boardPiecesGfx;
    g.clear();

    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const v = this.board[row * 20 + col];
        if (v === -1) continue;
        const wx = BOARD_ORIG_X + col * CELL;
        const wy = BOARD_ORIG_Y + row * CELL;
        const color = PLAYER_COLORS[v];
        const darkColor = PLAYER_COLORS_DARK[v];

        // Cell fill with slight 3D shading
        g.fillStyle(color, 1);
        g.fillRect(wx + 1, wy + 1, CELL - 2, CELL - 2);

        // Top-left highlight
        g.fillStyle(0xffffff, 0.25);
        g.fillRect(wx + 1, wy + 1, CELL - 2, 3);
        g.fillRect(wx + 1, wy + 1, 3, CELL - 2);

        // Bottom-right shadow
        g.fillStyle(darkColor, 0.6);
        g.fillRect(wx + 1, wy + CELL - 3, CELL - 2, 2);
        g.fillRect(wx + CELL - 3, wy + 1, 2, CELL - 2);

        // Outline between adjacent cells of different players
        g.lineStyle(1, 0x000000, 0.3);
        g.strokeRect(wx + 1, wy + 1, CELL - 2, CELL - 2);
      }
    }
  }

  private renderPreview(): void {
    const g = this.previewGfx;
    g.clear();

    if (!this.selectedPiece || !this.hoverTile || this.gamePhase !== 'playing') return;
    if (this.currentTurn !== this.myIdx) return;

    const cells = getPieceCells(
      this.selectedPiece, this.selectedOriIdx,
      this.hoverTile.x, this.hoverTile.y
    );

    const valid = canPlacePiece(
      this.board, cells, this.myIdx,
      this.firstMove[this.myIdx] ?? true
    );

    const color = valid ? PLAYER_COLORS[this.myIdx] : 0xff4444;
    const alpha = valid ? 0.75 : 0.5;

    for (const [x, y] of cells) {
      if (x < 0 || x >= BOARD_COLS || y < 0 || y >= BOARD_ROWS) continue;
      const wx = BOARD_ORIG_X + x * CELL;
      const wy = BOARD_ORIG_Y + y * CELL;
      g.fillStyle(color, alpha);
      g.fillRect(wx + 1, wy + 1, CELL - 2, CELL - 2);
      g.lineStyle(2, valid ? 0xffffff : 0xff0000, 0.9);
      g.strokeRect(wx + 1, wy + 1, CELL - 2, CELL - 2);
    }

    // Keep the PLACE button in sync with the current preview validity
    this.updatePlaceBtn();
  }

  // ─── Panel ─────────────────────────────────────────────────────────────────

  private buildPanel(): void {
    this.panelBg = this.add.graphics().setDepth(5);
    this.drawPanelBg();

    // Turn text
    this.turnText = this.add.text(PANEL_X + PANEL_W / 2, 30, '', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(10);

    // Score texts (4 players)
    const scoreY = 55;
    for (let i = 0; i < 4; i++) {
      const x = PANEL_X + 12 + i * (PANEL_W / 4);
      const t = this.add.text(x, scoreY, '', {
        fontSize: '14px', color: '#' + PLAYER_COLORS[i].toString(16).padStart(6, '0'),
        align: 'left',
      }).setDepth(10);
      this.scoreTexts.push(t);
    }

    // "Your Pieces" label
    this.myPiecesLabel = this.add.text(PANEL_X + PANEL_W / 2, 85, 'YOUR PIECES', {
      fontSize: '13px', color: '#64748b', letterSpacing: 3, align: 'center',
    }).setOrigin(0.5).setDepth(10);

    this.buildPieceThumbnails();
  }

  private drawPanelBg(): void {
    const g = this.panelBg;
    g.clear();
    g.fillStyle(0x0c1a28, 0.95);
    g.fillRoundedRect(PANEL_X - 2, 8, PANEL_W + 4, GAME_HEIGHT - 16, 8);
    g.lineStyle(1, 0x1e3a5f, 0.6);
    g.strokeRoundedRect(PANEL_X - 2, 8, PANEL_W + 4, GAME_HEIGHT - 16, 8);
  }

  private buildPieceThumbnails(): void {
    this.thumbContainers.forEach(c => c.destroy());
    this.thumbContainers = [];
    this.thumbGfxList = [];

    const pieces = this.playerPieces[this.myIdx] ?? ALL_PIECE_NAMES;
    const allPieces = ALL_PIECE_NAMES; // always show all 21 slots

    const slotW = Math.floor(PANEL_W / THUMB_COLS);
    const slotH = THUMB_SIZE;
    const startY = 102;

    for (let i = 0; i < allPieces.length; i++) {
      const name = allPieces[i];
      const col = i % THUMB_COLS;
      const row = Math.floor(i / THUMB_COLS);
      const sx = PANEL_X + col * slotW + slotW / 2;
      const sy = startY + row * slotH + slotH / 2;

      const remaining = pieces.includes(name);
      const gfx = this.add.graphics().setDepth(8);
      this.thumbGfxList.push(gfx);

      const cont = this.add.container(sx, sy).setDepth(9);
      cont.add(gfx);

      if (remaining) {
        // Clickable thumbnail
        const hitW = slotW - 4, hitH = slotH - 4;
        cont.setInteractive(
          new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
          Phaser.Geom.Rectangle.Contains
        );
        cont.on('pointerover', () => {
          if (this.gamePhase !== 'playing' || this.currentTurn !== this.myIdx) return;
          this.tweens.add({ targets: cont, scaleX: 1.15, scaleY: 1.15, duration: 100 });
        });
        cont.on('pointerout', () => {
          this.tweens.add({ targets: cont, scaleX: 1, scaleY: 1, duration: 100 });
        });
        cont.on('pointerdown', () => {
          if (this.gamePhase !== 'playing' || this.currentTurn !== this.myIdx) return;
          this.selectPiece(name);
        });
      }

      this.thumbContainers.push(cont);
      this.drawThumbnail(gfx, name, remaining);
    }
  }

  private drawThumbnail(
    gfx: Phaser.GameObjects.Graphics,
    name: string,
    active: boolean
  ): void {
    gfx.clear();
    const cells = BASE_PIECES[name];
    if (!cells) return;

    const maxW = Math.max(...cells.map(c => c[0])) + 1;
    const maxH = Math.max(...cells.map(c => c[1])) + 1;
    const sc = Math.min(10, Math.floor((THUMB_SIZE - 12) / Math.max(maxW, maxH)));
    const offX = -(maxW * sc) / 2;
    const offY = -(maxH * sc) / 2;

    if (!active) {
      // Greyed out / used
      gfx.fillStyle(0x1e3a5f, 0.3);
      for (const [cx, cy] of cells) {
        gfx.fillRect(offX + cx * sc, offY + cy * sc, sc - 1, sc - 1);
      }
      return;
    }

    const color = PLAYER_COLORS[this.myIdx];
    const selected = this.selectedPiece === name;

    // Background for selected piece
    if (selected) {
      gfx.fillStyle(color, 0.2);
      gfx.fillRoundedRect(-(THUMB_SIZE / 2 - 2), -(THUMB_SIZE / 2 - 2), THUMB_SIZE - 4, THUMB_SIZE - 4, 6);
      gfx.lineStyle(2, color, 0.9);
      gfx.strokeRoundedRect(-(THUMB_SIZE / 2 - 2), -(THUMB_SIZE / 2 - 2), THUMB_SIZE - 4, THUMB_SIZE - 4, 6);
    }

    // Draw piece cells
    for (const [cx, cy] of cells) {
      const px = offX + cx * sc;
      const py = offY + cy * sc;
      gfx.fillStyle(color, 1);
      gfx.fillRect(px, py, sc - 1, sc - 1);
      gfx.fillStyle(0xffffff, 0.3);
      gfx.fillRect(px, py, sc - 1, 2);
      gfx.fillRect(px, py, 2, sc - 1);
    }
  }

  private refreshThumbnails(): void {
    const pieces = this.playerPieces[this.myIdx] ?? [];
    const allPieces = ALL_PIECE_NAMES;

    for (let i = 0; i < allPieces.length; i++) {
      const name = allPieces[i];
      const remaining = pieces.includes(name);
      const gfx = this.thumbGfxList[i];
      if (gfx) this.drawThumbnail(gfx, name, remaining);
    }
  }

  // ─── Controls ──────────────────────────────────────────────────────────────

  private buildControls(): void {
    // Taller buttons (48px) for comfortable touch targets on iPad
    const btnY = BOARD_ORIG_Y + BOARD_PX + 11;
    const bh = 48;
    const bx = BOARD_ORIG_X + 5;

    this.rotateBtnGfx = this.makeControlBtn(bx,       btnY, 100, bh, 'ROTATE (R)', 0x3b82f6, () => this.rotatePiece());
    this.flipBtnGfx   = this.makeControlBtn(bx + 108,  btnY, 100, bh, 'FLIP (F)',   0x8b5cf6, () => this.flipPiece());
    this.passBtnGfx   = this.makeControlBtn(bx + 216,  btnY,  90, bh, 'PASS',       0x64748b, () => this.passTurn());

    // PLACE button — appears when a valid preview is active (essential for touch)
    const pb = { x: bx + 314, y: btnY, w: 198, h: bh };
    Object.assign(this.PLACE_BTN, pb);
    this.placeBtnGfx = this.add.graphics().setDepth(10);
    this.placeBtnTxt = this.add.text(pb.x + pb.w / 2, pb.y + pb.h / 2, '✓  PLACE PIECE', {
      fontSize: '15px', fontStyle: 'bold', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(11);
    this.placeBtnZone = this.add.zone(pb.x + pb.w / 2, pb.y + pb.h / 2, pb.w, pb.h)
      .setDepth(12).setInteractive();
    this.placeBtnZone.on('pointerdown', () => {
      if (this.hoverTile) this.handleBoardClick(this.hoverTile.x, this.hoverTile.y);
    });
    this.updatePlaceBtn();

    // Keyboard shortcuts
    const rKey   = this.input.keyboard?.addKey('R');
    const fKey   = this.input.keyboard?.addKey('F');
    const escKey = this.input.keyboard?.addKey('ESC');

    rKey?.on('down', () => this.rotatePiece());
    fKey?.on('down', () => this.flipPiece());
    escKey?.on('down', () => this.deselectPiece());
  }

  /** Show/hide the PLACE button and colour it based on whether the current preview is valid. */
  private updatePlaceBtn(): void {
    if (!this.placeBtnGfx) return;

    const myTurn = this.currentTurn === this.myIdx;
    const canShow = !!this.selectedPiece && this.gamePhase === 'playing' && myTurn;

    let valid = false;
    if (canShow && this.hoverTile) {
      const cells = getPieceCells(this.selectedPiece!, this.selectedOriIdx, this.hoverTile.x, this.hoverTile.y);
      valid = canPlacePiece(this.board, cells, this.myIdx, this.firstMove[this.myIdx] ?? true);
    }

    const show = canShow;
    this.placeBtnGfx.setVisible(show);
    this.placeBtnTxt.setVisible(show);
    this.placeBtnZone.setVisible(show);

    const { x, y, w, h } = this.PLACE_BTN;
    this.placeBtnGfx.clear();
    if (!show) return;

    const color = (canShow && this.hoverTile && valid) ? 0x22c55e : 0x374151;
    const alpha = (canShow && this.hoverTile && valid) ? 0.4 : 0.15;
    this.placeBtnGfx.fillStyle(color, alpha);
    this.placeBtnGfx.fillRoundedRect(x, y, w, h, 10);
    this.placeBtnGfx.lineStyle(2, color, (canShow && this.hoverTile && valid) ? 1 : 0.3);
    this.placeBtnGfx.strokeRoundedRect(x, y, w, h, 10);
    this.placeBtnTxt.setColor((canShow && this.hoverTile && valid) ? '#22c55e' : '#64748b');
    if (this.placeBtnZone.input) {
      this.placeBtnZone.input.enabled = !!(canShow && this.hoverTile && valid);
    }
  }

  private makeControlBtn(
    x: number, y: number, w: number, h: number,
    label: string, color: number,
    callback: () => void
  ): Phaser.GameObjects.Graphics {
    const gfx = this.add.graphics().setDepth(10);
    const drawBtn = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(color, hover ? 0.4 : 0.2);
      gfx.fillRoundedRect(x, y, w, h, 8);
      gfx.lineStyle(1, color, hover ? 1 : 0.6);
      gfx.strokeRoundedRect(x, y, w, h, 8);
    };
    drawBtn(false);

    const txt = this.add.text(x + w / 2, y + h / 2, label, {
      fontSize: '13px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(11);

    const zone = this.add.zone(x + w / 2, y + h / 2, w, h)
      .setInteractive().setDepth(12);
    zone.on('pointerover', () => drawBtn(true));
    zone.on('pointerout', () => drawBtn(false));
    zone.on('pointerdown', callback);

    void txt;
    return gfx;
  }

  // ─── Board input ───────────────────────────────────────────────────────────

  private setupBoardInput(): void {
    const boardZone = this.add.zone(
      BOARD_ORIG_X + BOARD_PX / 2,
      BOARD_ORIG_Y + BOARD_PX / 2,
      BOARD_PX, BOARD_PX
    ).setInteractive().setDepth(4);

    // Mouse hover — updates preview continuously
    boardZone.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      const tx = Math.floor((ptr.x - BOARD_ORIG_X) / CELL);
      const ty = Math.floor((ptr.y - BOARD_ORIG_Y) / CELL);
      this.hoverTile = { x: tx, y: ty };
      this.renderPreview();
    });

    // Mouse leaves board — clear preview (keep for touch: user needs to see it to press PLACE)
    boardZone.on('pointerout', (ptr: Phaser.Input.Pointer) => {
      // Only clear on mouse pointer (id 0/1 on desktop); touch pointers keep the preview
      if ((ptr.event as PointerEvent).pointerType !== 'touch') {
        this.hoverTile = null;
        this.previewGfx.clear();
        this.updatePlaceBtn();
      }
    });

    // Tap / click on board
    // • Mouse: pointermove already set hoverTile, so this fires a placement immediately.
    // • Touch: no prior hover — first tap shows preview, second tap on same tile places.
    boardZone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const tx = Math.floor((ptr.x - BOARD_ORIG_X) / CELL);
      const ty = Math.floor((ptr.y - BOARD_ORIG_Y) / CELL);

      if (this.hoverTile && this.hoverTile.x === tx && this.hoverTile.y === ty) {
        // Already previewing this exact tile → confirm placement
        this.handleBoardClick(tx, ty);
      } else {
        // New tile (first touch or mouse entered from outside) → show preview first
        this.hoverTile = { x: tx, y: ty };
        this.renderPreview();
      }
    });
  }

  // ─── Particles ─────────────────────────────────────────────────────────────

  private buildParticles(): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(4, 4, 4);
    gfx.generateTexture('sparkle', 8, 8);
    gfx.destroy();

    this.emitter = this.add.particles(0, 0, 'sparkle', {
      speed: { min: 60, max: 180 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 600,
      quantity: 12,
      emitting: false,
    }).setDepth(20);
  }

  private spawnParticles(worldX: number, worldY: number, color: number): void {
    this.emitter.setParticleTint(color);
    this.emitter.explode(12, worldX, worldY);
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  private selectPiece(name: string): void {
    if (this.selectedPiece === name) {
      this.deselectPiece();
      return;
    }
    this.selectedPiece = name;
    this.selectedOriIdx = 0;
    this.refreshThumbnails();
    this.renderPreview();
  }

  private deselectPiece(): void {
    this.selectedPiece = null;
    this.selectedOriIdx = 0;
    this.hoverTile = null;
    this.refreshThumbnails();
    this.previewGfx.clear();
    this.updatePlaceBtn();
  }

  private rotatePiece(): void {
    if (!this.selectedPiece) return;
    const orients = PIECE_ORIENTATIONS[this.selectedPiece];
    this.selectedOriIdx = (this.selectedOriIdx + 1) % orients.length;
    this.renderPreview();
  }

  private flipPiece(): void {
    if (!this.selectedPiece) return;
    // Jump to the "flipped" half of orientations
    const orients = PIECE_ORIENTATIONS[this.selectedPiece];
    const half = Math.floor(orients.length / 2);
    this.selectedOriIdx = (this.selectedOriIdx + half) % orients.length;
    this.renderPreview();
  }

  private handleBoardClick(tx: number, ty: number): void {
    if (this.gamePhase !== 'playing') return;
    if (this.currentTurn !== this.myIdx) return;
    if (!this.selectedPiece) return;

    const cells = getPieceCells(this.selectedPiece, this.selectedOriIdx, tx, ty);
    const isFirst = this.firstMove[this.myIdx] ?? true;

    if (!canPlacePiece(this.board, cells, this.myIdx, isFirst)) return;

    this.placePiece(cells, this.selectedPiece);
  }

  private placePiece(cells: [number, number][], pieceName: string): void {
    // Update board
    for (const [x, y] of cells) {
      this.board[y * 20 + x] = this.myIdx;
    }

    // Update scores
    this.scores[this.myIdx] = (this.scores[this.myIdx] ?? 0) + cells.length;

    // Remove piece from my list
    const myPieces = this.playerPieces[this.myIdx] ?? [];
    const idx = myPieces.indexOf(pieceName);
    if (idx !== -1) myPieces.splice(idx, 1);
    this.playerPieces[this.myIdx] = myPieces;

    // Update first move flag
    this.firstMove[this.myIdx] = false;
    this.skippedInRow[this.myIdx] = 0;

    // Particles
    const cx = cells.reduce((s, c) => s + c[0], 0) / cells.length;
    const cy = cells.reduce((s, c) => s + c[1], 0) / cells.length;
    this.spawnParticles(
      BOARD_ORIG_X + cx * CELL + CELL / 2,
      BOARD_ORIG_Y + cy * CELL + CELL / 2,
      PLAYER_COLORS[this.myIdx]
    );

    // Piece placement animation (flash)
    this.cameras.main.flash(80, 255, 255, 255, false);

    // Deselect
    this.deselectPiece();

    // Advance turn
    const nextTurn = this.computeNextTurn();
    this.currentTurn = nextTurn;

    // Check game over
    const allSkipped = this.checkGameOver();

    // Sync to room
    if (this.room) {
      this.room.player.set('pieces', [...myPieces]);
      this.room.data.set('board', [...this.board]);
      this.room.data.set('currentTurn', this.currentTurn);
      this.room.data.set('firstMove', [...this.firstMove]);
      this.room.data.set('scores', [...this.scores]);
      if (allSkipped) {
        this.room.data.set('gamePhase', 'gameover');
      }
    }

    this.renderAll();

    if (allSkipped) {
      this.gamePhase = 'gameover';
      this.showGameOver();
    } else if (isOfflineMode && this.currentTurn !== this.myIdx) {
      this.scheduleAIMove();
    }
  }

  private computeNextTurn(): number {
    let next = (this.currentTurn + 1) % this.playerCount;
    // Skip players who can't move
    let checked = 0;
    while (checked < this.playerCount) {
      const pieces = this.playerPieces[next] ?? [];
      if (pieces.length > 0 && hasValidMove(
        this.board, pieces, next, this.firstMove[next] ?? true
      )) {
        return next;
      }
      this.skippedInRow[next] = (this.skippedInRow[next] ?? 0) + 1;
      next = (next + 1) % this.playerCount;
      checked++;
    }
    return next; // all stuck — game over
  }

  private checkGameOver(): boolean {
    // Game over if no player can make a move
    for (let pi = 0; pi < this.playerCount; pi++) {
      const pieces = this.playerPieces[pi] ?? [];
      if (pieces.length > 0 && hasValidMove(
        this.board, pieces, pi, this.firstMove[pi] ?? true
      )) {
        return false;
      }
    }
    return true;
  }

  private passTurn(): void {
    if (this.gamePhase !== 'playing') return;
    if (this.currentTurn !== this.myIdx) return;

    this.skippedInRow[this.myIdx] = (this.skippedInRow[this.myIdx] ?? 0) + 1;
    const nextTurn = this.computeNextTurn();
    this.currentTurn = nextTurn;

    if (this.room) {
      this.room.data.set('currentTurn', this.currentTurn);
    }

    this.renderAll();

    if (isOfflineMode && this.currentTurn !== this.myIdx) {
      this.scheduleAIMove();
    }
  }

  // ─── Offline AI ────────────────────────────────────────────────────────────

  private scheduleAIMove(): void {
    if (!isOfflineMode || this.gamePhase !== 'playing') return;
    if (this.currentTurn === this.myIdx) return;

    this.time.delayedCall(800, () => {
      if (this.gamePhase !== 'playing' || this.currentTurn === this.myIdx) return;

      const aiIdx = this.currentTurn;
      const aiPieces = this.playerPieces[aiIdx] ?? [];
      const isFirst = this.firstMove[aiIdx] ?? true;
      const move = offlineFindMove(this.board, aiPieces, aiIdx, isFirst);

      if (move) {
        // Apply AI move
        const cells = getPieceCells(move.pieceName, move.orientation, move.bx, move.by);
        for (const [x, y] of cells) {
          this.board[y * 20 + x] = aiIdx;
        }
        this.scores[aiIdx] = (this.scores[aiIdx] ?? 0) + cells.length;
        const idx2 = aiPieces.indexOf(move.pieceName);
        if (idx2 !== -1) aiPieces.splice(idx2, 1);
        this.playerPieces[aiIdx] = aiPieces;
        this.firstMove[aiIdx] = false;
        this.skippedInRow[aiIdx] = 0;

        // Particles for AI
        const cx = cells.reduce((s, c) => s + c[0], 0) / cells.length;
        const cy = cells.reduce((s, c) => s + c[1], 0) / cells.length;
        this.spawnParticles(
          BOARD_ORIG_X + cx * CELL + CELL / 2,
          BOARD_ORIG_Y + cy * CELL + CELL / 2,
          PLAYER_COLORS[aiIdx]
        );
      } else {
        this.skippedInRow[aiIdx] = (this.skippedInRow[aiIdx] ?? 0) + 1;
      }

      const nextTurn = this.computeNextTurn();
      this.currentTurn = nextTurn;

      const allDone = this.checkGameOver();
      this.renderAll();

      if (allDone) {
        this.gamePhase = 'gameover';
        this.showGameOver();
      } else if (this.currentTurn !== this.myIdx) {
        this.scheduleAIMove();
      }
    });
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  private renderAll(): void {
    this.renderBoard();
    this.renderPreview();
    this.renderHUD();
    this.refreshThumbnails();
    this.updatePlaceBtn();
  }

  private renderHUD(): void {
    // Turn text
    const myTurn = this.currentTurn === this.myIdx;
    const pName = PLAYER_NAMES[this.currentTurn] ?? 'Player';
    if (this.gamePhase === 'gameover') {
      this.turnText.setText('GAME OVER').setColor('#f59e0b');
    } else {
      this.turnText
        .setText(myTurn ? '▶ YOUR TURN' : `${pName}'s turn`)
        .setColor(myTurn ? '#22c55e' : '#94a3b8');
    }
    if (myTurn && this.gamePhase === 'playing') {
      this.tweens.add({
        targets: this.turnText,
        scaleX: 1.06, scaleY: 1.06,
        yoyo: true, duration: 400, ease: 'Sine.easeInOut',
      });
    }

    // Score texts
    for (let i = 0; i < 4; i++) {
      const t = this.scoreTexts[i];
      if (!t) continue;
      if (i < this.playerCount) {
        const rem = countRemainingCells(this.playerPieces[i] ?? []);
        t.setText(`${PLAYER_NAMES[i]}: ${this.scores[i] ?? 0}pts (${rem}\u2b1c)`).setVisible(true);
      } else {
        t.setVisible(false);
      }
    }

    // My pieces label highlight
    const myColor = '#' + PLAYER_COLORS[this.myIdx].toString(16).padStart(6, '0');
    this.myPiecesLabel.setText(`${PLAYER_NAMES[this.myIdx].toUpperCase()} PIECES`).setColor(myColor);
  }

  // ─── Game Over ─────────────────────────────────────────────────────────────

  private showGameOver(): void {
    if (this.gameOverOverlay) return;

    // Calculate winner
    let winner = -1;
    let bestScore = -1;
    for (let i = 0; i < this.playerCount; i++) {
      if ((this.scores[i] ?? 0) > bestScore) {
        bestScore = this.scores[i] ?? 0;
        winner = i;
      }
    }

    const overlay = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(1000);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.75);
    bg.fillRoundedRect(-320, -200, 640, 400, 20);
    bg.lineStyle(3, PLAYER_COLORS[winner] ?? 0xffffff, 1);
    bg.strokeRoundedRect(-320, -200, 640, 400, 20);
    overlay.add(bg);

    const title = this.add.text(0, -145, 'GAME OVER', {
      fontSize: '42px', fontStyle: 'bold', color: '#f59e0b',
    }).setOrigin(0.5);
    overlay.add(title);

    const winColor = '#' + (PLAYER_COLORS[winner] ?? 0xffffff).toString(16).padStart(6, '0');
    const winText = this.add.text(0, -90, `${PLAYER_NAMES[winner] ?? 'Unknown'} WINS!`, {
      fontSize: '30px', fontStyle: 'bold', color: winColor,
    }).setOrigin(0.5);
    overlay.add(winText);

    let scoreStr = '';
    for (let i = 0; i < this.playerCount; i++) {
      const rem = countRemainingCells(this.playerPieces[i] ?? []);
      scoreStr += `${PLAYER_NAMES[i]}: ${this.scores[i] ?? 0} pts  (${rem} remaining)\n`;
    }
    const scoreText = this.add.text(0, 0, scoreStr.trim(), {
      fontSize: '18px', color: '#94a3b8', align: 'center', lineSpacing: 8,
    }).setOrigin(0.5);
    overlay.add(scoreText);

    // Play again button
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x3b82f6, 0.3);
    btnBg.fillRoundedRect(-110, 115, 220, 50, 10);
    btnBg.lineStyle(2, 0x3b82f6, 1);
    btnBg.strokeRoundedRect(-110, 115, 220, 50, 10);
    overlay.add(btnBg);

    const btnTxt = this.add.text(0, 140, 'BACK TO LOBBY', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    overlay.add(btnTxt);

    const btnZone = this.add.zone(0, 140, 220, 50).setInteractive();
    btnZone.on('pointerdown', () => {
      setActiveRoom(null, 0, [], false);
      this.scene.start('LobbyScene');
    });
    overlay.add(btnZone);

    this.gameOverOverlay = overlay;

    // Entrance tween
    overlay.setScale(0.5).setAlpha(0);
    this.tweens.add({
      targets: overlay,
      scale: 1, alpha: 1,
      duration: 400, ease: 'Back.easeOut',
    });

    // Particle celebration
    this.time.delayedCall(200, () => {
      for (let burst = 0; burst < 5; burst++) {
        this.time.delayedCall(burst * 150, () => {
          this.spawnParticles(
            BOARD_ORIG_X + Math.random() * BOARD_PX,
            BOARD_ORIG_Y + Math.random() * BOARD_PX,
            PLAYER_COLORS[winner] ?? 0xffffff
          );
        });
      }
    });

    // Save high score
    this.saveHighScore();
  }

  private async saveHighScore(): Promise<void> {
    if (!this.room) return;
    try {
      const { unboxyReady } = await import('../main');
      const unboxy = await unboxyReady;
      const current = (await unboxy.saves.get('highScore') as number | null | undefined) ?? 0;
      if ((this.scores[this.myIdx] ?? 0) > current) {
        await unboxy.saves.set('highScore', this.scores[this.myIdx]);
      }
    } catch {
      console.warn('Could not save high score');
    }
  }

  update(): void {
    // Idle animation: subtle shimmer on current player's corner
    // (handled via renderPreview on pointer move)
  }
}
