import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class TitleScene extends Phaser.Scene {
  declare rexUI: any;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // ── Background ──────────────────────────────────────────────────────────
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x020510, 0x020510, 0x060d1e, 0x060d1e, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle radial glow behind title
    const glow = this.add.graphics().setDepth(0);
    glow.fillStyle(0x1a2d6b, 0.25);
    glow.fillEllipse(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, 700, 360);

    // ── Court divider ───────────────────────────────────────────────────────
    this.drawDivider();

    // ── Decorative ghost court elements ─────────────────────────────────────
    const ghost = this.add.graphics().setDepth(1);

    // Paddles
    ghost.fillStyle(0x4488dd, 0.09);
    ghost.fillRoundedRect(58, GAME_HEIGHT / 2 - 55, 16, 110, 6);
    ghost.fillStyle(0xdd8833, 0.09);
    ghost.fillRoundedRect(GAME_WIDTH - 74, GAME_HEIGHT / 2 - 55, 16, 110, 6);

    // Ghost ball
    ghost.fillStyle(0xffffff, 0.08);
    ghost.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, 10);

    // Court top & bottom boundary lines
    ghost.lineStyle(2, 0xffffff, 0.06);
    ghost.lineBetween(0, 4, GAME_WIDTH, 4);
    ghost.lineBetween(0, GAME_HEIGHT - 4, GAME_WIDTH, GAME_HEIGHT - 4);

    // ── PONG title ──────────────────────────────────────────────────────────
    const titleLetters = ['P', 'O', 'N', 'G'];
    const letterSpacing = 130;
    const startX = GAME_WIDTH / 2 - (letterSpacing * (titleLetters.length - 1)) / 2;

    titleLetters.forEach((letter, i) => {
      const finalY = GAME_HEIGHT / 2 - 120;
      const txt = this.add.text(startX + i * letterSpacing, finalY - 40, letter, {
        fontSize: '160px',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#1a3a9e',
        strokeThickness: 8,
      })
        .setOrigin(0.5)
        .setDepth(2)
        .setAlpha(0);

      this.tweens.add({
        targets: txt,
        alpha: 1,
        y: finalY,
        duration: 500,
        delay: 80 + i * 90,
        ease: 'Back.Out',
      });
    });

    // ── Subtitle rule lines ─────────────────────────────────────────────────
    const ruleY = GAME_HEIGHT / 2 - 6;
    const rules = this.add.graphics().setDepth(2).setAlpha(0);
    rules.lineStyle(2, 0xffffff, 0.3);
    rules.lineBetween(80, ruleY, GAME_WIDTH / 2 - 90, ruleY);
    rules.lineBetween(GAME_WIDTH / 2 + 90, ruleY, GAME_WIDTH - 80, ruleY);
    this.tweens.add({ targets: rules, alpha: 1, duration: 500, delay: 500 });

    // ── Player control cards ─────────────────────────────────────────────────
    const makeCard = (x: number, label: string, keys: string, color: number) => {
      const cardG = this.add.graphics().setDepth(2).setAlpha(0);

      // Card bg
      cardG.fillStyle(color, 0.12);
      cardG.fillRoundedRect(x - 90, GAME_HEIGHT / 2 + 18, 180, 90, 12);
      cardG.lineStyle(1, color, 0.4);
      cardG.strokeRoundedRect(x - 90, GAME_HEIGHT / 2 + 18, 180, 90, 12);

      const playerTxt = this.add.text(x, GAME_HEIGHT / 2 + 38, label, {
        fontSize: '16px',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        letterSpacing: 3,
      }).setOrigin(0.5).setDepth(2).setAlpha(0);

      const keysTxt = this.add.text(x, GAME_HEIGHT / 2 + 68, keys, {
        fontSize: '22px',
        fontFamily: 'monospace',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(2).setAlpha(0);

      this.tweens.add({ targets: [cardG, playerTxt, keysTxt], alpha: 1, duration: 500, delay: 500 });
    };

    makeCard(GAME_WIDTH / 4, 'PLAYER 1', 'W  ·  S', 0x4488dd);
    makeCard((3 * GAME_WIDTH) / 4, 'PLAYER 2', '↑  ·  ↓', 0xdd8833);

    // ── VS badge ────────────────────────────────────────────────────────────
    const vsBadge = this.add.graphics().setDepth(3).setAlpha(0);
    vsBadge.fillStyle(0xffffff, 0.08);
    vsBadge.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 63, 24);
    const vsText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 63, 'VS', {
      fontSize: '17px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(3).setAlpha(0);
    this.tweens.add({ targets: [vsBadge, vsText], alpha: 1, duration: 400, delay: 600 });

    // ── First-to notice ──────────────────────────────────────────────────────
    const notice = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 135, 'FIRST TO 7 POINTS WINS', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#3a4a7a',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(2).setAlpha(0);
    this.tweens.add({ targets: notice, alpha: 1, duration: 400, delay: 650 });

    // ── Start button (rexUI) ─────────────────────────────────────────────────
    const btnBg = this.rexUI.add.roundRectangle(0, 0, 0, 0, 14, 0x1a3a9e);
    const btnBgHover = this.rexUI.add.roundRectangle(0, 0, 0, 0, 14, 0x2a5acc);

    const btnLabel = this.rexUI.add.label({
      width: 220,
      height: 56,
      background: btnBg,
      text: this.add.text(0, 0, '▶  START GAME', {
        fontSize: '20px',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        color: '#ffffff',
      }),
      align: 'center',
      space: { left: 16, right: 16, top: 0, bottom: 0 },
      name: 'start',
    });

    const startBtn = this.rexUI.add.buttons({
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 72,
      orientation: 'x',
      buttons: [btnLabel],
      click: { mode: 'pointerup', clickInterval: 300 },
    })
      .layout()
      .setDepth(100)
      .setAlpha(0);

    this.tweens.add({ targets: startBtn, alpha: 1, duration: 400, delay: 750 });

    // Hover: swap background fill
    startBtn.on('button.over', (_btn: any) => {
      btnBg.setVisible(false);
      btnBgHover.setVisible(true);
      // Swap the label's background in-place
      btnLabel.setBackground(btnBgHover);
      btnLabel.layout();
    });
    startBtn.on('button.out', (_btn: any) => {
      btnBg.setVisible(true);
      btnBgHover.setVisible(false);
      btnLabel.setBackground(btnBg);
      btnLabel.layout();
    });

    const go = () => {
      startBtn.off('button.click');
      this.input.keyboard!.off('keydown-SPACE', go);
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('GameScene'));
    };

    startBtn.on('button.click', go);

    // Also keep keyboard shortcut
    this.input.keyboard!.once('keydown-SPACE', go);

    // ── ESC hint ────────────────────────────────────────────────────────────
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 22, 'SPACE  or  CLICK TO START', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#1e2840',
    }).setOrigin(0.5).setDepth(2);
  }

  private drawDivider(): void {
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(2, 0xffffff, 0.10);
    const dh = 18, gh = 12;
    for (let y = 0; y < GAME_HEIGHT; y += dh + gh) {
      g.lineBetween(GAME_WIDTH / 2, y, GAME_WIDTH / 2, y + dh);
    }
  }
}
