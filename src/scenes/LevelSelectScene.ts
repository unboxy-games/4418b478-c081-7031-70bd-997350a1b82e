import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';

const CX = GAME_WIDTH / 2;
const CY = GAME_HEIGHT / 2;

// ── Level metadata ────────────────────────────────────────────────────────────

const LEVELS = [
  { name: 'The Gateway', stars: 1, accent: 0x1188ff, dim: 0x1133aa },
  { name: 'Storm Front', stars: 2, accent: 0xaa44ff, dim: 0x5511cc },
  { name: 'The Void',    stars: 3, accent: 0xff2244, dim: 0xaa0022 },
];

const SAVE_KEYS   = ['highScore', 'highScore_2', 'highScore_3'];
// Minimum % on the PREVIOUS level required to unlock this one
const UNLOCK_THRESH = [0, 25, 50]; // index 0 = always open

const CARD_W = 290;
const CARD_H = 320;
// Card centres: evenly spaced around CX
const CARD_SPACING = 370;

// ─────────────────────────────────────────────────────────────────────────────

export class LevelSelectScene extends Phaser.Scene {
  private cardObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() { super({ key: 'LevelSelectScene' }); }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    this.cardObjects = [];
    this.buildBackground();
    this.buildTitle();
    this.buildBackButton();

    // Show a brief loading placeholder while bests are fetched
    const loadingTxt = this.add.text(CX, CY, 'Loading...', {
      fontSize: '20px', color: '#334466', fontFamily: 'Arial',
    }).setDepth(6).setOrigin(0.5);

    this.loadBests().then(bests => {
      if (!this.scene.isActive('LevelSelectScene')) return;
      loadingTxt.destroy();
      this.buildCards(bests);
    }).catch(() => {
      if (!this.scene.isActive('LevelSelectScene')) return;
      loadingTxt.destroy();
      this.buildCards([0, 0, 0]);
    });
  }

  // ── background ─────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(0x040918, 0x040918, 0x0c1e50, 0x0c1e50);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const stars = this.add.graphics().setDepth(1);
    for (let i = 0; i < 200; i++) {
      const sx   = Phaser.Math.Between(0, GAME_WIDTH);
      const sy   = Phaser.Math.Between(0, GAME_HEIGHT);
      const size = Math.random() > 0.85 ? 2 : 1;
      stars.fillStyle(0xffffff, Math.random() * 0.55 + 0.2);
      stars.fillCircle(sx, sy, size);
    }

    // Decorative horizontal accent line
    const accGfx = this.add.graphics().setDepth(2);
    accGfx.lineStyle(1, 0x1144aa, 0.35);
    accGfx.lineBetween(0, GAME_HEIGHT - 80, GAME_WIDTH, GAME_HEIGHT - 80);
  }

  // ── title ──────────────────────────────────────────────────────────────────

  private buildTitle(): void {
    const title = this.add.text(CX, 72, 'SELECT LEVEL', {
      fontSize: '52px', color: '#ffffff', fontStyle: 'bold',
      fontFamily: 'Arial', stroke: '#002299', strokeThickness: 8,
    }).setDepth(5).setOrigin(0.5).setAlpha(0).setScale(0.5);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, ease: 'Back.Out', duration: 600 });

    const sub = this.add.text(CX, 128, 'Choose your challenge', {
      fontSize: '20px', color: '#6688aa', fontFamily: 'Arial',
      stroke: '#001133', strokeThickness: 3,
    }).setDepth(5).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, delay: 300, duration: 400 });
  }

  // ── back button ────────────────────────────────────────────────────────────

  private buildBackButton(): void {
    const back = this.add.text(CX, GAME_HEIGHT - 38, '← Back to Menu', {
      fontSize: '20px', color: '#5577aa', fontFamily: 'Arial',
      stroke: '#000022', strokeThickness: 2,
    }).setDepth(10).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: back, alpha: 1, delay: 500, duration: 400 });
    back.on('pointerover', () => back.setStyle({ color: '#88aaff' }));
    back.on('pointerout',  () => back.setStyle({ color: '#5577aa' }));
    back.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  // ── load personal bests ────────────────────────────────────────────────────

  private async loadBests(): Promise<number[]> {
    try {
      const unboxy = await unboxyReady;
      if (!unboxy) return [0, 0, 0];
      const results = await Promise.all(
        SAVE_KEYS.map(k => unboxy.saves.get<number>(k).catch(() => null))
      );
      return results.map(r => (typeof r === 'number' && r > 0 ? r : 0));
    } catch {
      return [0, 0, 0];
    }
  }

  // ── level cards ─────────────────────────────────────────────────────────────

  private buildCards(bests: number[]): void {
    // Destroy any previously created card objects
    this.cardObjects.forEach(o => { try { o.destroy(); } catch (_) { /* gone */ } });
    this.cardObjects = [];

    const unlocked = LEVELS.map((_, i) => {
      if (i === 0) return true;
      return bests[i - 1] >= UNLOCK_THRESH[i];
    });

    LEVELS.forEach((lvl, i) => {
      const cx   = CX + (i - 1) * CARD_SPACING;
      const cy   = CY + 30;
      const isOn = unlocked[i];
      const best = bests[i];

      // ── card background graphics ──
      const bg = this.add.graphics().setDepth(5).setAlpha(0);
      this.cardObjects.push(bg);

      const drawCard = (hover: boolean) => {
        bg.clear();

        // Card fill
        bg.fillStyle(isOn ? (hover ? 0x0d1e40 : 0x080e28) : 0x080810, isOn ? 0.95 : 0.6);
        bg.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 16);

        // Accent header strip
        bg.fillStyle(lvl.accent, isOn ? (hover ? 0.85 : 0.65) : 0.15);
        bg.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, 48, {
          tl: 16, tr: 16, bl: 0, br: 0,
        });

        // Border
        bg.lineStyle(2, isOn ? lvl.accent : 0x222233, isOn ? (hover ? 0.9 : 0.5) : 0.25);
        bg.strokeRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 16);

        // Inner glow if hover
        if (isOn && hover) {
          bg.lineStyle(6, lvl.accent, 0.1);
          bg.strokeRoundedRect(cx - CARD_W / 2 + 3, cy - CARD_H / 2 + 3, CARD_W - 6, CARD_H - 6, 13);
        }
      };
      drawCard(false);
      this.tweens.add({ targets: bg, alpha: 1, delay: i * 100, duration: 380 });

      // ── level number (in header) ──
      const numTxt = this.add.text(cx - CARD_W / 2 + 22, cy - CARD_H / 2 + 24, `${i + 1}`, {
        fontSize: '26px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial',
        stroke: '#000033', strokeThickness: 4,
      }).setDepth(6).setOrigin(0.5).setAlpha(isOn ? 1 : 0.3);
      this.cardObjects.push(numTxt);

      // ── level name ──
      const nameTxt = this.add.text(cx, cy - CARD_H / 2 + 78, lvl.name, {
        fontSize: '23px', color: isOn ? '#ffffff' : '#444455', fontStyle: 'bold',
        fontFamily: 'Arial', stroke: '#000022', strokeThickness: 3,
      }).setDepth(6).setOrigin(0.5);
      this.cardObjects.push(nameTxt);

      // ── difficulty stars ──
      const starsStr = '★'.repeat(lvl.stars) + '☆'.repeat(3 - lvl.stars);
      const starsTxt = this.add.text(cx, cy - CARD_H / 2 + 116, starsStr, {
        fontSize: '30px', color: isOn ? '#ffcc00' : '#333344', fontFamily: 'Arial',
      }).setDepth(6).setOrigin(0.5);
      this.cardObjects.push(starsTxt);

      // ── divider ──
      const div = this.add.graphics().setDepth(6);
      div.lineStyle(1, isOn ? lvl.accent : 0x222233, 0.35);
      div.lineBetween(cx - CARD_W / 2 + 18, cy - CARD_H / 2 + 148, cx + CARD_W / 2 - 18, cy - CARD_H / 2 + 148);
      this.cardObjects.push(div);

      // ── personal best ──
      const bestStr = !isOn
        ? ''
        : best === 0
          ? 'No attempts yet'
          : best >= 100
            ? '🏆  CLEARED!'
            : `Best: ${best}%`;
      const bestCol = best >= 100 ? '#ffd700' : best > 0 ? '#88ccff' : '#335566';
      const bestTxt = this.add.text(cx, cy - CARD_H / 2 + 178, bestStr, {
        fontSize: '18px', color: isOn ? bestCol : '#222233',
        fontFamily: 'Arial', fontStyle: best >= 100 ? 'bold' : 'normal',
        stroke: '#000022', strokeThickness: 2,
      }).setDepth(6).setOrigin(0.5);
      this.cardObjects.push(bestTxt);

      // ── mini cube preview (drawn with graphics) ──
      if (isOn) {
        const cs  = 38;
        const cubeGfx = this.add.graphics().setDepth(6);
        const cubeX   = cx - cs / 2;
        const cubeY   = cy - CARD_H / 2 + 218;
        cubeGfx.fillStyle(lvl.accent, 0.15);
        cubeGfx.fillRoundedRect(cubeX - 5, cubeY - 5, cs + 10, cs + 10, 9);
        cubeGfx.fillStyle(lvl.accent, 0.85);
        cubeGfx.fillRoundedRect(cubeX, cubeY, cs, cs, 7);
        cubeGfx.fillStyle(0xffffff, 0.35);
        cubeGfx.fillRoundedRect(cubeX + 3, cubeY + 3, cs - 6, 13, 3);
        cubeGfx.fillStyle(lvl.dim, 0.9);
        cubeGfx.fillRoundedRect(cubeX + 10, cubeY + 10, cs - 20, cs - 20, 2);
        cubeGfx.lineStyle(2, lvl.accent, 0.9);
        cubeGfx.strokeRoundedRect(cubeX, cubeY, cs, cs, 7);
        this.cardObjects.push(cubeGfx);
      }

      // ── PLAY strip at bottom ──
      if (isOn) {
        const stripGfx = this.add.graphics().setDepth(6);
        stripGfx.fillStyle(lvl.accent, 0.12);
        stripGfx.fillRoundedRect(
          cx - CARD_W / 2 + 8,
          cy + CARD_H / 2 - 50,
          CARD_W - 16, 42,
          { tl: 0, tr: 0, bl: 10, br: 10 },
        );
        this.cardObjects.push(stripGfx);

        const playTxt = this.add.text(cx, cy + CARD_H / 2 - 29, '▶  PLAY', {
          fontSize: '19px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial',
          stroke: '#000033', strokeThickness: 3,
        }).setDepth(7).setOrigin(0.5);
        this.cardObjects.push(playTxt);
      }

      // ── lock overlay ──
      if (!isOn) {
        const lockGfx = this.add.graphics().setDepth(7);
        lockGfx.fillStyle(0x000000, 0.55);
        lockGfx.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 16);
        this.cardObjects.push(lockGfx);

        const prevPct   = UNLOCK_THRESH[i];
        const unlockMsg = `🔒\n\nReach ${prevPct}% on Level ${i}`;
        const lockTxt   = this.add.text(cx, cy, unlockMsg, {
          fontSize: '17px', color: '#556677', fontFamily: 'Arial',
          align: 'center', stroke: '#000011', strokeThickness: 2,
        }).setDepth(8).setOrigin(0.5);
        this.cardObjects.push(lockTxt);
      }

      // ── interactive zone (unlocked cards only) ──
      if (isOn) {
        const zone = this.add.zone(cx, cy, CARD_W, CARD_H)
          .setDepth(9).setInteractive({ useHandCursor: true });
        this.cardObjects.push(zone);

        zone.on('pointerover', () => drawCard(true));
        zone.on('pointerout',  () => drawCard(false));
        zone.on('pointerdown', () => {
          this.tweens.add({
            targets: bg, scaleX: 0.95, scaleY: 0.95, duration: 75, yoyo: true,
            ease: 'Sine.easeOut',
            onComplete: () => this.startLevel(i),
          });
        });
      }
    });
  }

  // ── start game ────────────────────────────────────────────────────────────

  private startLevel(idx: number): void {
    this.game.registry.set('levelIndex', idx);
    this.game.registry.set('attempt', 1);
    this.scene.start('GameScene');
  }
}
