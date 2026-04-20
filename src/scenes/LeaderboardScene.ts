import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';

interface LeaderboardEntry {
  name: string;
  score: number;
  wave: number;
  at: number;
}

const PANEL_X = GAME_WIDTH / 2 - 360;
const PANEL_W = 720;
const PANEL_Y = 108;
const PANEL_H = 526;

export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LeaderboardScene' });
  }

  create(data: { score?: number; wave?: number }): void {
    const playerScore = data && typeof data.score === 'number' ? data.score : -1;
    const playerWave  = data && typeof data.wave  === 'number' ? data.wave  : -1;

    this.createBackground();
    this.createPanel();
    this.createTitle();

    // Loading indicator
    const loadingTxt = this.add.text(GAME_WIDTH / 2, PANEL_Y + PANEL_H / 2 + 20,
      'LOADING SCORES...', {
        fontFamily: 'monospace',
        fontSize:   '24px',
        color:      '#4466aa',
      }
    ).setOrigin(0.5).setDepth(10);

    this.tweens.add({
      targets:  loadingTxt,
      alpha:    0.25,
      duration: 500,
      yoyo:     true,
      repeat:   -1,
    });

    this.createFooter();
    this.loadAndDisplay(playerScore, playerWave, loadingTxt);

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  // ─────────────────────────────────────────
  //  Async data load + display
  // ─────────────────────────────────────────
  private async loadAndDisplay(
    playerScore: number,
    playerWave:  number,
    loadingTxt:  Phaser.GameObjects.Text,
  ): Promise<void> {
    const unboxy = await unboxyReady;
    let entries: LeaderboardEntry[] = [];

    if (unboxy) {
      try {
        const raw = await unboxy.gameData.get<LeaderboardEntry[]>('leaderboard');
        if (Array.isArray(raw)) {
          entries = raw.filter(
            (e): e is LeaderboardEntry =>
              !!e && typeof e.name === 'string' && typeof e.score === 'number',
          );
        }
      } catch (err) {
        console.warn('[galaxian] failed to load leaderboard', err);
      }
    }

    loadingTxt.destroy();

    if (entries.length === 0) {
      this.add.text(GAME_WIDTH / 2, PANEL_Y + PANEL_H / 2 + 20,
        'No scores yet — be the first!', {
          fontFamily: 'monospace',
          fontSize:   '22px',
          color:      '#334466',
        }
      ).setOrigin(0.5).setDepth(10);
      return;
    }

    this.displayEntries(entries.slice(0, 10), playerScore, playerWave);
  }

  // ─────────────────────────────────────────
  //  Rows
  // ─────────────────────────────────────────
  private displayEntries(
    entries:     LeaderboardEntry[],
    playerScore: number,
    playerWave:  number,
  ): void {
    const startY = PANEL_Y + 72;
    const rowH   = 44;

    // Column X anchors
    const colRank  = PANEL_X + 38;
    const colName  = PANEL_X + 118;
    const colScore = PANEL_X + 498;
    const colWave  = PANEL_X + 648;

    // Header row
    const hStyle = { fontFamily: 'monospace', fontSize: '15px', color: '#334466' };
    this.add.text(colRank,  startY, 'RANK',  hStyle).setDepth(10);
    this.add.text(colName,  startY, 'PILOT', hStyle).setDepth(10);
    this.add.text(colScore, startY, 'SCORE', { ...hStyle }).setOrigin(1, 0).setDepth(10);
    this.add.text(colWave,  startY, 'WAVE',  { ...hStyle }).setOrigin(0.5, 0).setDepth(10);

    // Divider
    const divGfx = this.add.graphics().setDepth(9);
    divGfx.lineStyle(1, 0x1a3355, 0.9);
    divGfx.beginPath();
    divGfx.moveTo(PANEL_X + 16, startY + 22);
    divGfx.lineTo(PANEL_X + PANEL_W - 16, startY + 22);
    divGfx.strokePath();

    const medalHex  = [0xffd700, 0xc0c0c0, 0xcd7f32];
    const rankLabels = ['1st', '2nd', '3rd'];

    entries.forEach((entry, i) => {
      const rowY          = startY + 30 + i * rowH;
      const isTopThree    = i < 3;
      const isThisPlayer  = entry.score === playerScore && entry.wave === playerWave;

      // Current-player highlight
      if (isThisPlayer) {
        const hl = this.add.graphics().setDepth(8);
        hl.fillStyle(0x002244, 0.55);
        hl.fillRoundedRect(PANEL_X + 10, rowY - 14, PANEL_W - 20, rowH - 4, 6);
        hl.lineStyle(1, 0x3366cc, 0.6);
        hl.strokeRoundedRect(PANEL_X + 10, rowY - 14, PANEL_W - 20, rowH - 4, 6);
      }

      // Medal dot (top 3)
      if (isTopThree) {
        const dot = this.add.graphics().setDepth(10);
        dot.fillStyle(medalHex[i], 1);
        dot.fillCircle(colRank - 14, rowY + 9, 5);
      }

      // Rank label
      const rankColor = isTopThree
        ? `#${medalHex[i].toString(16).padStart(6, '0')}`
        : '#445566';
      this.add.text(colRank, rowY, isTopThree ? rankLabels[i] : `${i + 1}`, {
        fontFamily: 'monospace',
        fontSize:   '18px',
        color:      rankColor,
        fontStyle:  isTopThree ? 'bold' : 'normal',
      }).setDepth(10);

      // Pilot name (capped + uppercased)
      const name      = String(entry.name ?? 'PILOT').slice(0, 20).toUpperCase();
      const nameColor = isThisPlayer ? '#88ccff' : (isTopThree ? '#ddeeff' : '#7788aa');
      this.add.text(colName, rowY, name, {
        fontFamily: 'monospace',
        fontSize:   '18px',
        color:      nameColor,
        fontStyle:  isTopThree ? 'bold' : 'normal',
      }).setDepth(10);

      // Score (right-aligned)
      const scoreColor = isThisPlayer ? '#ffff88' : (isTopThree ? '#ffdd44' : '#99aabb');
      this.add.text(colScore, rowY, entry.score.toLocaleString(), {
        fontFamily: 'monospace',
        fontSize:   '18px',
        color:      scoreColor,
        fontStyle:  'bold',
      }).setOrigin(1, 0).setDepth(10);

      // Wave (centered)
      const waveVal = typeof entry.wave === 'number' ? `${entry.wave}` : '—';
      this.add.text(colWave, rowY, waveVal, {
        fontFamily: 'monospace',
        fontSize:   '18px',
        color:      isThisPlayer ? '#aaddff' : '#556677',
      }).setOrigin(0.5, 0).setDepth(10);
    });
  }

  // ─────────────────────────────────────────
  //  Background
  // ─────────────────────────────────────────
  private createBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x000011, 0x000011, 0x000033, 0x000033, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const neb = this.add.graphics().setDepth(0);
    neb.fillStyle(0x0a0044, 0.4);
    neb.fillEllipse(260, 340, 520, 280);
    neb.fillStyle(0x001a11, 0.3);
    neb.fillEllipse(980, 440, 420, 260);
    neb.fillStyle(0x330011, 0.18);
    neb.fillEllipse(640, 600, 360, 200);

    const starGfx = this.add.graphics().setDepth(0);
    for (let i = 0; i < 200; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, GAME_HEIGHT);
      const r  = Phaser.Math.FloatBetween(0.4, 2.0);
      const a  = Phaser.Math.FloatBetween(0.15, 0.85);
      starGfx.fillStyle(0xffffff, a);
      starGfx.fillCircle(sx, sy, r);
    }
  }

  // ─────────────────────────────────────────
  //  Panel
  // ─────────────────────────────────────────
  private createPanel(): void {
    const g = this.add.graphics().setDepth(5);

    // Drop shadow
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(PANEL_X + 6, PANEL_Y + 6, PANEL_W, PANEL_H, 14);

    // Main panel
    g.fillStyle(0x000c20, 0.92);
    g.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 14);

    // Outer border
    g.lineStyle(2, 0x1a3a6a, 0.9);
    g.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 14);

    // Inner top accent
    g.lineStyle(3, 0x3355bb, 1);
    g.beginPath();
    g.moveTo(PANEL_X + 16, PANEL_Y + 3);
    g.lineTo(PANEL_X + PANEL_W - 16, PANEL_Y + 3);
    g.strokePath();

    // Corner accents
    for (const [cx, cy] of [
      [PANEL_X + 18, PANEL_Y + 18],
      [PANEL_X + PANEL_W - 18, PANEL_Y + 18],
      [PANEL_X + 18, PANEL_Y + PANEL_H - 18],
      [PANEL_X + PANEL_W - 18, PANEL_Y + PANEL_H - 18],
    ] as [number, number][]) {
      g.lineStyle(2, 0x2244aa, 0.6);
      g.strokeRect(cx - 5, cy - 5, 10, 10);
    }
  }

  // ─────────────────────────────────────────
  //  Title
  // ─────────────────────────────────────────
  private createTitle(): void {
    // Glow shadow
    this.add.text(GAME_WIDTH / 2 + 2, PANEL_Y + 34, '★  GALAXY  SCOREBOARD  ★', {
      fontFamily: 'monospace',
      fontSize:   '28px',
      color:      '#440000',
    }).setOrigin(0.5).setDepth(8).setAlpha(0.7);

    const title = this.add.text(GAME_WIDTH / 2, PANEL_Y + 32, '★  GALAXY  SCOREBOARD  ★', {
      fontFamily:      'monospace',
      fontSize:        '28px',
      color:           '#ffcc00',
      stroke:          '#aa4400',
      strokeThickness: 4,
      fontStyle:       'bold',
    }).setOrigin(0.5).setDepth(9);

    // Gentle shimmer pulse
    this.tweens.add({
      targets:  title,
      alpha:    0.8,
      duration: 2200,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  // ─────────────────────────────────────────
  //  Footer + keyboard nav
  // ─────────────────────────────────────────
  private createFooter(): void {
    const y = PANEL_Y + PANEL_H + 30;

    const footer = this.add.text(GAME_WIDTH / 2, y,
      'SPACE — Play Again          ESC — Main Menu', {
        fontFamily: 'monospace',
        fontSize:   '20px',
        color:      '#334455',
      }
    ).setOrigin(0.5).setDepth(10);

    this.tweens.add({
      targets:  footer,
      alpha:    0.35,
      duration: 750,
      yoyo:     true,
      repeat:   -1,
    });

    const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey.once('down', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop('LeaderboardScene');
        this.scene.stop('UIScene');
        this.scene.start('GameScene');
        this.scene.start('UIScene');
      });
    });

    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESCAPE);
    escKey.once('down', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop('LeaderboardScene');
        this.scene.stop('UIScene');
        this.scene.start('StartScene');
      });
    });
  }
}
