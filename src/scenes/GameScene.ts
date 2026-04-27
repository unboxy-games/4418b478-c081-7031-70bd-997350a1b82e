import Phaser from 'phaser';
import { MAX_CHAT_TEXT_LEN } from '@unboxy/phaser-sdk';
import type { ChatMessage } from '@unboxy/phaser-sdk';
import {
  CELL, BOARD_ORIG_X, BOARD_ORIG_Y, BOARD_COLS, BOARD_ROWS, BOARD_PX,
  PANEL_X, PANEL_W, THUMB_COLS, THUMB_SIZE, GAME_WIDTH, GAME_HEIGHT,
} from '../config';
import {
  ALL_PIECE_NAMES, PIECE_ORIENTATIONS, BASE_PIECES,
  PLAYER_COLORS, PLAYER_COLORS_DARK, PLAYER_NAMES, PLAYER_CORNERS,
  canPlacePiece, getPieceCells, countRemainingCells, hasValidMove,
} from '../data/pieces';
import { activeRoom, myPlayerIndex, playerOrder, isOfflineMode, isHost as roomIsHost, humanPlayerCount as roomHumanPlayerCount, botDifficulty, BotDifficulty, setActiveRoom } from '../gameState';

// ─── Bot AI ───────────────────────────────────────────────────────────────────

/**
 * Count how many free diagonal-only anchor squares the player would have
 * after placing `newCells` on the board.  More anchors = more future options.
 */
function countNewAnchors(
  board: number[],
  newCells: [number, number][],
  playerIndex: number
): number {
  const placedSet = new Set(newCells.map(([x, y]) => `${x},${y}`));
  const anchors = new Set<string>();
  for (const [x, y] of newCells) {
    for (const [dx, dy] of [[1,1],[1,-1],[-1,1],[-1,-1]] as [number,number][]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= 20 || ny < 0 || ny >= 20) continue;
      if (board[ny * 20 + nx] !== -1) continue;        // occupied
      if (placedSet.has(`${nx},${ny}`)) continue;       // part of this piece
      // Must not be edge-adjacent to any own cell (existing or newly placed)
      let edgeAdjOwn = false;
      for (const [ex, ey] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
        const ax = nx + ex, ay = ny + ey;
        if (ax < 0 || ax >= 20 || ay < 0 || ay >= 20) continue;
        if (board[ay * 20 + ax] === playerIndex || placedSet.has(`${ax},${ay}`)) {
          edgeAdjOwn = true;
          break;
        }
      }
      if (!edgeAdjOwn) anchors.add(`${nx},${ny}`);
    }
  }
  return anchors.size;
}

/**
 * Score a candidate placement.  Higher = better.
 * Weights vary by difficulty:
 *   easy   — not used (random selection instead)
 *   medium — piece×20, anchors×8,  expansion×1.5, noise [0,4)
 *   hard   — piece×35, anchors×15, expansion×3,   noise [0,0.5)
 */
function scorePlacement(
  board: number[],
  cells: [number, number][],
  playerIndex: number,
  pieceName: string,
  difficulty: BotDifficulty
): number {
  const pieceSize = BASE_PIECES[pieceName].length;
  const anchors   = countNewAnchors(board, cells, playerIndex);
  const [cx, cy]  = PLAYER_CORNERS[playerIndex];
  const avgDist   = cells.reduce((s, [x, y]) => s + Math.abs(x - cx) + Math.abs(y - cy), 0) / cells.length;

  if (difficulty === 'hard') {
    return pieceSize * 35 + anchors * 15 + avgDist * 3 + Math.random() * 0.5;
  }
  // medium (default)
  return pieceSize * 20 + anchors * 8 + avgDist * 1.5 + Math.random() * 4;
}

type BotMove = { pieceName: string; orientation: number; bx: number; by: number };

/**
 * Find the best move for `playerIndex`.
 *
 * Easy   — collects up to 50 valid moves then picks one at random.
 * Medium — greedy one-ply heuristic with moderate weights.
 * Hard   — same heuristic but with amplified weights and near-zero noise,
 *          so the bot plays very consistently and aggressively.
 */
function smartFindMove(
  board: number[],
  pieces: string[],
  playerIndex: number,
  isFirstMove: boolean,
  difficulty: BotDifficulty = 'medium'
): BotMove | null {

  // ── Easy: just pick a random valid move ─────────────────────────────────────
  if (difficulty === 'easy') {
    const valid: BotMove[] = [];
    outer:
    for (const name of pieces) {
      const orients = PIECE_ORIENTATIONS[name];
      for (let oi = 0; oi < orients.length; oi++) {
        const cells = orients[oi];
        for (let by = 0; by < BOARD_ROWS; by++) {
          for (let bx = 0; bx < BOARD_COLS; bx++) {
            const abs = cells.map(([dx, dy]) => [bx + dx, by + dy] as [number, number]);
            if (canPlacePiece(board, abs, playerIndex, isFirstMove)) {
              valid.push({ pieceName: name, orientation: oi, bx, by });
              if (valid.length >= 50) break outer;
            }
          }
        }
      }
    }
    return valid.length > 0 ? valid[Math.floor(Math.random() * valid.length)] : null;
  }

  // ── Medium / Hard: greedy heuristic ─────────────────────────────────────────
  let bestMove: BotMove | null = null;
  let bestScore = -Infinity;

  // Try largest pieces first (they're hardest to place later)
  const sortedPieces = [...pieces].sort((a, b) => BASE_PIECES[b].length - BASE_PIECES[a].length);

  for (const name of sortedPieces) {
    const orients = PIECE_ORIENTATIONS[name];
    for (let oi = 0; oi < orients.length; oi++) {
      const cells = orients[oi];
      for (let by = 0; by < BOARD_ROWS; by++) {
        for (let bx = 0; bx < BOARD_COLS; bx++) {
          const abs = cells.map(([dx, dy]) => [bx + dx, by + dy] as [number, number]);
          if (canPlacePiece(board, abs, playerIndex, isFirstMove)) {
            const s = scorePlacement(board, abs, playerIndex, name, difficulty);
            if (s > bestScore) {
              bestScore = s;
              bestMove = { pieceName: name, orientation: oi, bx, by };
            }
          }
        }
      }
    }
  }
  return bestMove;
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
  /** True when this client created the room (responsible for running NPC AI online). */
  private isHost = false;
  /** How many slots are real humans; indices >= this are NPC bots. */
  private humanPlayerCount = 1;
  /** Guards against scheduling multiple overlapping AI move timers. */
  private aiMoveScheduled = false;

  // Interaction
  private selectedPiece: string | null = null;
  private selectedOriIdx = 0;
  private hoverTile: { x: number; y: number } | null = null;
  // True when the device supports touch (iPad, phone, touch-screen laptop).
  // Detected once at startup via the Web API — no flaky per-event checks needed.
  private readonly isTouchDevice: boolean = navigator.maxTouchPoints > 0;

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

  // ─── Chat (online mode only) ──────────────────────────────────────────────
  // All layout constants reference module-level PANEL_X / PANEL_W / GAME_HEIGHT
  private readonly CCX = PANEL_X + 6;            // 605 — left edge of chat panel
  private readonly CCY = 358;                     // top of chat area (below thumbnails)
  private readonly CCW = PANEL_W - 12;            // 659 — chat panel width
  private readonly CCH = GAME_HEIGHT - 358 - 10;  // 352 — chat panel height (to y≈710)
  private chatMsgPool: Phaser.GameObjects.Text[] = [];
  private chatMessages: Array<{ text: string; isSystem: boolean }> = [];
  private readonly MAX_CHAT_VISIBLE = 14;
  private chatInputBgGfx?: Phaser.GameObjects.Graphics;
  private chatFocused = false;
  /** The real <input> element overlaid on the canvas for IME / soft-keyboard support. */
  private chatInputEl?: HTMLInputElement;
  /** Bound resize handler so it can be removed on shutdown. */
  private chatResizeHandler?: () => void;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.room = activeRoom;
    this.myIdx = myPlayerIndex;
    this.myOrder = [...playerOrder];
    this.isHost = roomIsHost;
    this.humanPlayerCount = roomHumanPlayerCount;

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
    if (this.room) this.buildChatPanel();

    if (this.room) {
      this.setupRoomListeners();
      // Set my pieces in room state
      this.room.player.set('pieces', [...ALL_PIECE_NAMES]);
      this.setupChat();
    }

    this.renderAll();

    // Scene shutdown cleanup
    this.events.once('shutdown', () => {
      this.unsubs.forEach(f => f());
      // Remove the DOM chat input and its resize handler
      this.chatInputEl?.remove();
      if (this.chatResizeHandler) window.removeEventListener('resize', this.chatResizeHandler);
      this.room?.leave();
    });
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  private initOfflineGame(): void {
    this.playerCount = 4; // always a full 4-player game; bots fill slots 1–3
    this.humanPlayerCount = 1;
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
    // Turn 0 is the human; no AI needed yet
  }

  private syncFromRoom(): void {
    if (!this.room) return;
    const board = this.room.data.get('board') as number[] | undefined;
    if (board) this.board = [...board];
    this.currentTurn = (this.room.data.get('currentTurn') as number | undefined) ?? 0;
    this.playerCount = (this.room.data.get('playerCount') as number | undefined) ?? 4;
    this.humanPlayerCount = (this.room.data.get('humanPlayerCount') as number | undefined) ?? this.myOrder.length;
    const fm = this.room.data.get('firstMove') as boolean[] | undefined;
    if (fm) this.firstMove = [...fm];
    const sc = this.room.data.get('scores') as number[] | undefined;
    if (sc) this.scores = [...sc];
    this.gamePhase = ((this.room.data.get('gamePhase') as string) === 'gameover') ? 'gameover' : 'playing';

    // Sync pieces: real human slots from room.player state, NPC slots from room.data
    for (let i = 0; i < this.playerCount; i++) {
      const sid = this.myOrder[i];
      if (sid) {
        const pieces = this.room.player.get(sid, 'pieces') as string[] | undefined;
        this.playerPieces[i] = pieces ? [...pieces] : [...ALL_PIECE_NAMES];
      } else {
        // NPC slot — host writes these to room.data as 'npcPieces_N'
        const pieces = this.room.data.get('npcPieces_' + i) as string[] | undefined;
        this.playerPieces[i] = pieces !== undefined ? [...pieces] : [...ALL_PIECE_NAMES];
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
      // If it's an NPC turn and we're the host, drive the bot
      if (this.isHost && this.isNPCPlayer(this.currentTurn) && this.gamePhase === 'playing') {
        this.scheduleAIMove();
      }
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

    // Difficulty badge (offline only; shows bot strength for this session)
    if (isOfflineMode) {
      const diffColors: Record<string, string> = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
      const diffLabel = `BOT: ${botDifficulty.toUpperCase()}`;
      const diffColor = diffColors[botDifficulty] ?? '#94a3b8';
      const diffBadge = this.add.text(PANEL_X + PANEL_W / 2, 76, diffLabel, {
        fontSize: '11px', fontStyle: 'bold', color: diffColor, letterSpacing: 2, align: 'center',
      }).setOrigin(0.5).setDepth(10).setAlpha(0.75);
      // Pulse the badge subtly
      this.tweens.add({ targets: diffBadge, alpha: { from: 0.55, to: 0.95 }, yoyo: true, repeat: -1, duration: 2000 });
    }

    // "Your Pieces" label
    this.myPiecesLabel = this.add.text(PANEL_X + PANEL_W / 2, 87, 'YOUR PIECES', {
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
    const startY = 106;

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

    rKey?.on('down', () => { if (!this.chatFocused) this.rotatePiece(); });
    fKey?.on('down', () => { if (!this.chatFocused) this.flipPiece(); });
    escKey?.on('down', () => {
      if (this.chatFocused) {
        this.chatInputEl?.blur(); // triggers blur → sets chatFocused=false, redraws bg
      } else {
        this.deselectPiece();
      }
    });
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

    // ── Hover / drag moves the preview continuously ──────────────────────────
    // Fires on mouse move (always) and on touch drag (finger held + moving).
    // This gives touch users natural drag-to-position behaviour.
    boardZone.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      const tx = Math.floor((ptr.x - BOARD_ORIG_X) / CELL);
      const ty = Math.floor((ptr.y - BOARD_ORIG_Y) / CELL);
      if (this.hoverTile && this.hoverTile.x === tx && this.hoverTile.y === ty) return; // no change
      this.hoverTile = { x: tx, y: ty };
      this.renderPreview();
    });

    // ── Mouse: leaving the board clears the preview ──────────────────────────
    boardZone.on('pointerout', () => {
      if (this.isTouchDevice) return; // on touch, preview must stay so user can press PLACE
      this.hoverTile = null;
      this.previewGfx.clear();
      this.updatePlaceBtn();
    });

    // ── Tap / click on board ─────────────────────────────────────────────────
    boardZone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const tx = Math.floor((ptr.x - BOARD_ORIG_X) / CELL);
      const ty = Math.floor((ptr.y - BOARD_ORIG_Y) / CELL);

      if (this.isTouchDevice) {
        // Touch flow: every tap just repositions the preview (sticky).
        // Placement is confirmed only via the PLACE PIECE button.
        // This lets the user lift their finger, rotate/flip, then press PLACE.
        this.hoverTile = { x: tx, y: ty };
        this.renderPreview();
      } else {
        // Mouse flow: pointermove already set hoverTile to this tile, so the
        // same-tile check is always true and placement fires immediately on click.
        // Clicking a different tile first-time just updates the preview.
        if (this.hoverTile && this.hoverTile.x === tx && this.hoverTile.y === ty) {
          this.handleBoardClick(tx, ty);
        } else {
          this.hoverTile = { x: tx, y: ty };
          this.renderPreview();
        }
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
    } else if (this.isNPCPlayer(this.currentTurn)) {
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

    if (this.isNPCPlayer(this.currentTurn)) {
      this.scheduleAIMove();
    }
  }

  // ─── NPC Bot AI (offline + online host) ───────────────────────────────────

  /** True when slot `idx` belongs to a bot (no real human). */
  private isNPCPlayer(idx: number): boolean {
    if (isOfflineMode) return idx >= this.humanPlayerCount; // slots 1–3 are bots
    return !this.myOrder[idx]; // online: no session ID = bot slot
  }

  private scheduleAIMove(): void {
    if (this.gamePhase !== 'playing') return;
    if (!this.isNPCPlayer(this.currentTurn)) return;
    // In online mode only the host drives bots so everyone else just waits for the sync
    if (this.room && !this.isHost) return;
    // Guard: don't stack multiple timers for the same turn
    if (this.aiMoveScheduled) return;
    this.aiMoveScheduled = true;

    this.time.delayedCall(700, () => {
      this.aiMoveScheduled = false;
      if (this.gamePhase !== 'playing' || !this.isNPCPlayer(this.currentTurn)) return;

      const aiIdx = this.currentTurn;
      const aiPieces = [...(this.playerPieces[aiIdx] ?? [])];
      const isFirst = this.firstMove[aiIdx] ?? true;
      const move = smartFindMove(this.board, aiPieces, aiIdx, isFirst, botDifficulty);

      if (move) {
        // Apply the NPC move to the shared board
        const cells = getPieceCells(move.pieceName, move.orientation, move.bx, move.by);
        for (const [x, y] of cells) {
          this.board[y * 20 + x] = aiIdx;
        }
        this.scores[aiIdx] = (this.scores[aiIdx] ?? 0) + cells.length;
        const pieceIdx = aiPieces.indexOf(move.pieceName);
        if (pieceIdx !== -1) aiPieces.splice(pieceIdx, 1);
        this.playerPieces[aiIdx] = aiPieces;
        this.firstMove[aiIdx] = false;
        this.skippedInRow[aiIdx] = 0;

        // Particles
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

      // Broadcast the NPC move to all clients via room.data (online host only)
      if (this.room) {
        this.room.data.set('board', [...this.board]);
        this.room.data.set('currentTurn', this.currentTurn);
        this.room.data.set('firstMove', [...this.firstMove]);
        this.room.data.set('scores', [...this.scores]);
        // Persist NPC pieces so other clients can read them on sync
        this.room.data.set('npcPieces_' + aiIdx, [...(this.playerPieces[aiIdx] ?? [])]);
        if (allDone) this.room.data.set('gamePhase', 'gameover');
      }

      this.renderAll();

      if (allDone) {
        this.gamePhase = 'gameover';
        this.showGameOver();
      } else if (this.isNPCPlayer(this.currentTurn)) {
        // Chain: next turn is also a bot — schedule again
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
      const npcTurn = this.isNPCPlayer(this.currentTurn);
      this.turnText
        .setText(myTurn ? '▶ YOUR TURN' : `${pName}${npcTurn ? ' 🤖' : ''}'s turn`)
        .setColor(myTurn ? '#22c55e' : npcTurn ? '#f59e0b' : '#94a3b8');
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

  // ─── Chat (online mode only) ──────────────────────────────────────────────

  /**
   * Build the chat panel below the piece thumbnails on the right side.
   * Only called when an online room is active.
   */
  private buildChatPanel(): void {
    const cx = this.CCX, cy = this.CCY, cw = this.CCW, ch = this.CCH;

    // Derived layout values (kept local to avoid duplication with drawChatInputBg)
    const logY  = cy + 30;    // top of message log area (388)
    const logH  = 246;        // height of log area — fits MAX_CHAT_VISIBLE=14 lines at 17px each
    const logX  = cx + 8;
    const logW  = cw - 16;    // 643
    const inpY  = logY + logH + 8; // top of input row (642)
    const inpH  = 40;
    const sendW = 56;
    const inpW  = logW - sendW - 4; // 583

    // ── Background ─────────────────────────────────────────────────────────
    const bg = this.add.graphics().setDepth(7);
    bg.fillStyle(0x060e18, 0.93);
    bg.fillRoundedRect(cx, cy, cw, ch, 8);
    bg.lineStyle(1, 0x1a3350, 0.5);
    bg.strokeRoundedRect(cx, cy, cw, ch, 8);

    // Header label
    this.add.text(cx + cw / 2, cy + 15, 'C H A T', {
      fontSize: '11px', fontStyle: 'bold', color: '#2a4a6a', letterSpacing: 4,
    }).setOrigin(0.5).setDepth(10);

    // Dividers
    const div = this.add.graphics().setDepth(7);
    div.lineStyle(1, 0x162a40, 1);
    div.lineBetween(cx + 8, cy + 28, cx + cw - 8, cy + 28);

    // ── Message log — pool of 14 text objects at fixed row positions ────────
    const lineH = Math.floor(logH / this.MAX_CHAT_VISIBLE); // 17px

    // Geometry mask so text is clipped to the log area
    const maskGfx = this.make.graphics({ x: 0, y: 0 });
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(logX, logY, logW, logH);
    const logMask = maskGfx.createGeometryMask();

    for (let i = 0; i < this.MAX_CHAT_VISIBLE; i++) {
      const t = this.add.text(
        logX + 4,
        logY + i * lineH + lineH / 2,
        '', {
          fontSize: '13px',
          color: '#c8dff0',
        }
      ).setOrigin(0, 0.5).setDepth(10);
      t.setMask(logMask);
      this.chatMsgPool.push(t);
    }

    // Divider above input
    div.lineBetween(cx + 8, inpY - 4, cx + cw - 8, inpY - 4);

    // ── Input area (Phaser draws the background; a real <input> sits on top) ──
    this.chatInputBgGfx = this.add.graphics().setDepth(9);
    this.drawChatInputBg(false);

    // ── SEND button ─────────────────────────────────────────────────────────
    const sendX = cx + cw - 8 - sendW; // 1200
    const sendBtnBg = this.add.graphics().setDepth(9);
    const drawSend = (hover: boolean) => {
      sendBtnBg.clear();
      sendBtnBg.fillStyle(0x1d4ed8, hover ? 0.5 : 0.2);
      sendBtnBg.fillRoundedRect(sendX, inpY + 4, sendW, inpH - 8, 5);
      sendBtnBg.lineStyle(1, 0x3b82f6, hover ? 0.9 : 0.45);
      sendBtnBg.strokeRoundedRect(sendX, inpY + 4, sendW, inpH - 8, 5);
    };
    drawSend(false);

    this.add.text(sendX + sendW / 2, inpY + inpH / 2, 'SEND', {
      fontSize: '11px', fontStyle: 'bold', color: '#60a5fa',
    }).setOrigin(0.5).setDepth(10);

    const sendZone = this.add.zone(sendX + sendW / 2, inpY + inpH / 2, sendW, inpH)
      .setInteractive().setDepth(12);
    sendZone.on('pointerdown', () => this.sendChatMessage());
    sendZone.on('pointerover', () => drawSend(true));
    sendZone.on('pointerout',  () => drawSend(false));

    // ── HTML <input> — transparent overlay for real IME / soft-keyboard support
    // Inject placeholder style once per document.
    if (!document.getElementById('blokus-chat-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'blokus-chat-style';
      styleEl.textContent =
        '.blokus-chat-inp::placeholder{color:rgba(200,223,240,0.3);opacity:1}' +
        '.blokus-chat-inp:focus{outline:none}';
      document.head.appendChild(styleEl);
    }

    const canvas = this.sys.game.canvas;

    // Compute position in screen pixels and keep it updated on resize.
    const positionInput = () => {
      if (!this.chatInputEl) return;
      const r  = canvas.getBoundingClientRect();
      const sx = r.width  / GAME_WIDTH;
      const sy = r.height / GAME_HEIGHT;
      Object.assign(this.chatInputEl.style, {
        left:     `${r.left   + (cx + 8) * sx}px`,
        top:      `${r.top    + inpY     * sy}px`,
        width:    `${inpW               * sx}px`,
        height:   `${inpH               * sy}px`,
        fontSize: `${Math.max(11, Math.round(13 * sy))}px`,
      });
    };

    const inputEl = document.createElement('input');
    inputEl.type         = 'text';
    inputEl.maxLength    = MAX_CHAT_TEXT_LEN;
    inputEl.placeholder  = 'Type a message…';
    inputEl.className    = 'blokus-chat-inp';
    // Disable browser auto-features that mangle chat text on mobile/iOS
    inputEl.autocomplete = 'off';
    inputEl.setAttribute('autocorrect',    'off');
    inputEl.setAttribute('autocapitalize', 'off');
    inputEl.setAttribute('spellcheck',     'false');
    // iOS / Android soft-keyboard hints
    inputEl.setAttribute('inputmode',    'text');
    inputEl.setAttribute('enterkeyhint', 'send');

    // Transparent over the Phaser-drawn box; caret color matches the blue theme
    Object.assign(inputEl.style, {
      position:      'fixed',
      background:    'transparent',
      border:        'none',
      outline:       'none',
      color:         '#e2e8f0',
      fontFamily:    'Arial, sans-serif',
      padding:       '0 8px',
      boxSizing:     'border-box',
      zIndex:        '10000',
      caretColor:    '#60a5fa',
      pointerEvents: 'auto',
    });

    this.chatInputEl = inputEl;
    positionInput(); // set initial position before appending
    document.body.appendChild(inputEl);

    // Keep position in sync whenever the window / canvas resizes
    this.chatResizeHandler = positionInput;
    window.addEventListener('resize', positionInput);

    // Focus / blur → update visual state on the Phaser-drawn background
    inputEl.addEventListener('focus', () => {
      this.chatFocused = true;
      this.drawChatInputBg(true);
    });
    inputEl.addEventListener('blur', () => {
      this.chatFocused = false;
      this.drawChatInputBg(false);
    });

    // Enter key → send; prevent the default newline / form-submit
    inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.sendChatMessage();
      }
    });
  }

  /** Redraw the input box background to reflect focused / unfocused state. */
  private drawChatInputBg(focused: boolean): void {
    if (!this.chatInputBgGfx) return;
    const cx  = this.CCX, cy  = this.CCY, cw  = this.CCW;
    const logH = 246;
    const inpY = cy + 30 + logH + 8; // matches buildChatPanel
    const inpH = 40;
    const sendW = 56;
    const inpW  = cw - 16 - sendW - 4;

    this.chatInputBgGfx.clear();
    this.chatInputBgGfx.fillStyle(focused ? 0x0e2237 : 0x071018, 0.9);
    this.chatInputBgGfx.fillRoundedRect(cx + 8, inpY, inpW, inpH, 6);
    this.chatInputBgGfx.lineStyle(1, focused ? 0x3b82f6 : 0x162a40, focused ? 0.85 : 0.4);
    this.chatInputBgGfx.strokeRoundedRect(cx + 8, inpY, inpW, inpH, 6);
  }

  /** Sync the log pool text objects to the most recent MAX_CHAT_VISIBLE messages. */
  private renderChatLog(): void {
    const N    = this.MAX_CHAT_VISIBLE;
    const msgs = this.chatMessages;
    for (let i = 0; i < N; i++) {
      const t = this.chatMsgPool[i];
      if (!t) continue;
      const msgIdx = msgs.length - N + i;
      if (msgIdx < 0) {
        t.setText('');
      } else {
        const msg = msgs[msgIdx];
        // Truncate very long lines to keep the layout clean (no wrapping needed)
        let line = msg.isSystem ? `· ${msg.text}` : msg.text;
        if (line.length > 80) line = line.slice(0, 79) + '…';
        t.setText(line);
        t.setColor(msg.isSystem ? '#4a6a86' : '#c8dff0');
      }
    }
  }

  /** Push a new message into the log and refresh the display. */
  private appendChatMsg(text: string, isSystem: boolean): void {
    this.chatMessages.push({ text, isSystem });
    // Cap stored history to avoid unbounded growth
    if (this.chatMessages.length > 300) this.chatMessages.splice(0, 150);
    this.renderChatLog();
  }

  /** Send the current input text via room.chat and clear the field. */
  private async sendChatMessage(): Promise<void> {
    if (!this.room || !this.chatInputEl) return;
    const text = this.chatInputEl.value.trim();
    if (!text) return;
    // Clear immediately — local echo from room.chat.send() will render it
    this.chatInputEl.value = '';
    try {
      await this.room.chat.send(text);
    } catch {
      this.appendChatMsg('Message could not be sent', true);
    }
  }

  /** Wire up room.chat.onMessage to the chat panel. */
  private setupChat(): void {
    if (!this.room) return;
    const offChat = this.room.chat.onMessage((msg: ChatMessage) => {
      if (msg.kind === 'user') {
        const isMe = msg.from === this.room?.sessionId;
        const who  = isMe ? 'You' : (msg.displayName || 'Player');
        this.appendChatMsg(`${who}: ${msg.text}`, false);
      } else {
        // 'system.joined' / 'system.left' — msg.text is the English fallback
        this.appendChatMsg(msg.text, true);
      }
    });
    this.unsubs.push(offChat);
  }

  // ─── Game loop ─────────────────────────────────────────────────────────────

  update(): void {
    // Idle animation: subtle shimmer on current player's corner
    // (handled via renderPreview on pointer move)
  }
}
