import Phaser from 'phaser';
import { Enemy } from './Enemy';

export type TowerType = 'tabby' | 'ninja' | 'wizard' | 'sniper';

export interface TowerData {
  cost: number;
  damage: number;
  range: number;
  fireRate: number;
  name: string;
  description: string;
  color: number;
}

export const TOWER_CONFIGS: Record<TowerType, TowerData> = {
  tabby:  { cost: 50,  damage: 15, range: 125, fireRate: 1.2,  name: 'Tabby Cat',  description: 'Balanced | 50g',       color: 0xFF8C00 },
  ninja:  { cost: 100, damage: 20, range: 95,  fireRate: 2.8,  name: 'Ninja Cat',  description: 'Fast | 100g',          color: 0x6644aa },
  wizard: { cost: 150, damage: 45, range: 155, fireRate: 0.6,  name: 'Wizard Cat', description: 'AoE | 150g',           color: 0x8E44AD },
  sniper: { cost: 125, damage: 80, range: 260, fireRate: 0.35, name: 'Sniper Cat', description: 'Extreme Range | 125g', color: 0x4a9a2a },
};

function drawStar(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  pts: number,
  outer: number,
  inner: number
): void {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / pts - Math.PI / 2;
    points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  g.fillPoints(points, true);
}

export class Tower {
  scene: Phaser.Scene;
  type: TowerType;
  container: Phaser.GameObjects.Container;
  private rangeG: Phaser.GameObjects.Graphics;
  private bodyG: Phaser.GameObjects.Graphics;

  col: number;
  row: number;
  damage: number;
  range: number;
  fireRate: number;
  private fireCooldown = 0;
  private aimAngle = 0;
  private gunContainer: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, type: TowerType, col: number, row: number) {
    this.scene = scene;
    this.type = type;
    this.col = col;
    this.row = row;

    const cfg = TOWER_CONFIGS[type];
    this.damage = cfg.damage;
    this.range = cfg.range;
    this.fireRate = cfg.fireRate;

    const cx = col * 50 + 25;
    const cy = row * 50 + 25;

    this.rangeG = scene.add.graphics();
    this.bodyG = scene.add.graphics();
    this.container = scene.add.container(cx, cy, [this.rangeG, this.bodyG]);
    this.container.setDepth(3);

    this.drawBody();
    this.rangeG.setVisible(false);

    // Pop-in animation
    this.container.setScale(0);
    scene.tweens.add({
      targets: this.container,
      scaleX: 1,
      scaleY: 1,
      duration: 350,
      ease: 'Back.easeOut',
      onComplete: () => { this.addIdleAnimations(); },
    });
  }

  private drawBody(): void {
    const g = this.bodyG;
    g.clear();

    if (this.type === 'tabby') {
      // Platform
      g.fillStyle(0x7a5c14);
      g.fillRoundedRect(-21, 16, 42, 10, 3);
      // Body (orange)
      g.fillStyle(0xFF8C00);
      g.fillEllipse(0, 6, 36, 32);
      // Stripes
      g.lineStyle(2.5, 0xCC5500, 0.65);
      g.lineBetween(-10, -4, -8, 16);
      g.lineBetween(0, -7, 0, 16);
      g.lineBetween(10, -4, 8, 16);
      // Head
      g.fillStyle(0xFF9900);
      g.fillCircle(0, -12, 18);
      // Ears
      g.fillStyle(0xFF8C00);
      g.fillTriangle(-14, -21, -23, -35, -5, -28);
      g.fillTriangle(14, -21, 23, -35, 5, -28);
      g.fillStyle(0xffccaa);
      g.fillTriangle(-13, -23, -20, -32, -7, -28);
      g.fillTriangle(13, -23, 20, -32, 7, -28);
      // Eyes (green)
      g.fillStyle(0x22cc44);
      g.fillEllipse(-7, -12, 10, 12);
      g.fillEllipse(7, -12, 10, 12);
      g.fillStyle(0x111111);
      g.fillEllipse(-7, -12, 5, 10);
      g.fillEllipse(7, -12, 5, 10);
      g.fillStyle(0xffffff);
      g.fillCircle(-6, -14, 2.5);
      g.fillCircle(8, -14, 2.5);
      // Nose
      g.fillStyle(0xff9966);
      g.fillTriangle(-2, -7, 2, -7, 0, -4);
      // Whiskers
      g.lineStyle(1.2, 0xffe8cc, 0.9);
      g.lineBetween(-17, -8, -4, -6);
      g.lineBetween(-17, -4, -4, -3);
      g.lineBetween(4, -6, 17, -8);
      g.lineBetween(4, -3, 17, -4);
      // Paws
      g.fillStyle(0xFF8C00);
      g.fillRoundedRect(-17, 14, 12, 10, 4);
      g.fillRoundedRect(5, 14, 12, 10, 4);
    } else if (this.type === 'ninja') {
      // Platform
      g.fillStyle(0x111122);
      g.fillRoundedRect(-21, 16, 42, 10, 3);
      // Body
      g.fillStyle(0x0d0d1a);
      g.fillEllipse(0, 6, 36, 32);
      g.fillStyle(0x1a1a2e, 0.5);
      g.fillEllipse(-5, 2, 14, 18);
      // Head
      g.fillStyle(0x111111);
      g.fillCircle(0, -12, 18);
      // Ninja bandana (red)
      g.fillStyle(0xcc1111);
      g.fillRect(-16, -17, 32, 10);
      // Ears
      g.fillStyle(0x0d0d1a);
      g.fillTriangle(-14, -22, -21, -37, -5, -27);
      g.fillTriangle(14, -22, 21, -37, 5, -27);
      // Eyes (glowing red)
      g.fillStyle(0xff4444);
      g.fillEllipse(-7, -12, 10, 8);
      g.fillEllipse(7, -12, 10, 8);
      g.fillStyle(0xff0000);
      g.fillCircle(-7, -12, 4);
      g.fillCircle(7, -12, 4);
      g.fillStyle(0xffffff);
      g.fillCircle(-6, -13.5, 1.8);
      g.fillCircle(8, -13.5, 1.8);
      // Shuriken in hand
      g.fillStyle(0xdddddd);
      drawStar(g, 22, 12, 4, 9, 4.5);
      g.fillStyle(0xffffff);
      g.fillCircle(22, 12, 2.5);
      // Paws
      g.fillStyle(0x111111);
      g.fillRoundedRect(-17, 14, 12, 10, 4);
      g.fillRoundedRect(5, 14, 12, 10, 4);
    } else if (this.type === 'wizard') {
      // Wizard
      // Platform
      g.fillStyle(0x5a1f80);
      g.fillRoundedRect(-21, 16, 42, 10, 3);
      // Robe
      g.fillStyle(0x8E44AD);
      g.fillTriangle(-20, 22, 20, 22, 0, -4);
      // Stars on robe
      g.fillStyle(0xffd700);
      drawStar(g, -9, 10, 5, 6, 3);
      drawStar(g, 10, 14, 5, 5, 2.5);
      // Body
      g.fillStyle(0xC39BD3);
      g.fillEllipse(0, 3, 32, 28);
      // Head
      g.fillStyle(0xD4A9E8);
      g.fillCircle(0, -12, 18);
      // Hat
      g.fillStyle(0x6B2FA0);
      g.fillTriangle(-16, -24, 16, -24, 0, -50);
      g.fillStyle(0x7D3BBF);
      g.fillRect(-18, -26, 36, 7);
      // Star on hat
      g.fillStyle(0xffd700);
      drawStar(g, 0, -40, 5, 8, 4);
      // Eyes (gold)
      g.fillStyle(0xffd700);
      g.fillCircle(-7, -12, 6);
      g.fillCircle(7, -12, 6);
      g.fillStyle(0x5a1f80);
      g.fillCircle(-7, -12, 3.5);
      g.fillCircle(7, -12, 3.5);
      g.fillStyle(0xffffff);
      g.fillCircle(-6, -13.5, 1.8);
      g.fillCircle(8, -13.5, 1.8);
      // Whiskers
      g.lineStyle(1.2, 0xffffff, 0.8);
      g.lineBetween(-16, -6, -4, -5);
      g.lineBetween(-16, -2, -4, -1);
      g.lineBetween(4, -5, 16, -6);
      g.lineBetween(4, -1, 16, -2);
      // Wand
      g.fillStyle(0x4a1a6a);
      g.fillRect(15, -16, 5, 34);
      g.fillStyle(0xffd700);
      g.fillCircle(17, -18, 7);
      g.fillStyle(0xffffff);
      g.fillCircle(14, -24, 2.5);
      g.fillCircle(21, -22, 2);
      g.fillCircle(23, -16, 2);
    } else {
      // Sniper Cat — military camo hunter
      // Platform
      g.fillStyle(0x3d5a1e);
      g.fillRoundedRect(-21, 16, 42, 10, 3);
      // Body — camo green
      g.fillStyle(0x4a7c25);
      g.fillEllipse(0, 6, 34, 30);
      // Camo patches on body
      g.fillStyle(0x2d4f10, 0.75);
      g.fillEllipse(-8, 3, 11, 8);
      g.fillEllipse(6, 12, 9, 6);
      g.fillEllipse(-2, 14, 8, 5);
      // Head
      g.fillStyle(0x568a30);
      g.fillCircle(0, -12, 17);
      // Tactical beret
      g.fillStyle(0x2d4a14);
      g.fillEllipse(2, -22, 30, 12);
      g.fillStyle(0x1e3310);
      g.fillCircle(10, -23, 5);   // beret bump
      g.fillStyle(0x3a6018);
      g.fillRect(-14, -20, 28, 5); // beret band
      // Ears peeking from under beret
      g.fillStyle(0x568a30);
      g.fillTriangle(-13, -22, -19, -33, -5, -27);
      g.fillTriangle(13, -22, 19, -33, 5, -27);
      g.fillStyle(0x3a6618);
      g.fillTriangle(-12, -23, -16, -30, -6, -26);
      g.fillTriangle(12, -23, 16, -30, 6, -26);
      // Left eye — alert, bright green
      g.fillStyle(0x33ee55);
      g.fillEllipse(-7, -12, 10, 11);
      g.fillStyle(0x111111);
      g.fillEllipse(-7, -12, 5, 9);
      g.fillStyle(0xffffff);
      g.fillCircle(-6, -14, 2);
      // Right eye — squinting (aiming pose, narrow slit)
      g.fillStyle(0x111111);
      g.fillRect(2, -15, 12, 6);
      g.lineStyle(1.5, 0x33ee55);
      g.lineBetween(3, -12, 13, -12);
      // Nose
      g.fillStyle(0x88cc44);
      g.fillTriangle(-2, -7, 2, -7, 0, -4);
      // Whiskers
      g.lineStyle(1.2, 0xaaddaa, 0.85);
      g.lineBetween(-17, -8, -4, -6);
      g.lineBetween(-17, -4, -4, -3);
      g.lineBetween(4, -6, 17, -8);
      g.lineBetween(4, -3, 17, -4);
      // Paws
      g.fillStyle(0x4a7c25);
      g.fillRoundedRect(-17, 14, 12, 10, 4);
      g.fillRoundedRect(5, 14, 12, 10, 4);

      // --- Rifle in its own container so it can rotate independently ---
      // Pivot at (0, 1): the trigger/grip where stock meets barrel.
      // All rifle coords are relative to that pivot point.
      const gunG = this.scene.add.graphics();
      // Rifle stock (wood) — extends left of pivot
      gunG.fillStyle(0x6b4212);
      gunG.fillRoundedRect(-15, -4, 15, 8, 2);
      // Rifle barrel — extends right
      gunG.fillStyle(0x444444);
      gunG.fillRect(0, -3, 30, 6);
      gunG.fillStyle(0x777777);
      gunG.fillRect(1, -2, 28, 3);
      // Scope body
      gunG.fillStyle(0x1a1a1a);
      gunG.fillRoundedRect(4, -11, 16, 11, 3);
      // Scope lens (green tint)
      gunG.fillStyle(0x11aa55, 0.85);
      gunG.fillCircle(12, -6, 5);
      gunG.fillStyle(0xaaffcc, 0.45);
      gunG.fillCircle(10, -8, 2.5);
      // Scope crosshair
      gunG.lineStyle(0.8, 0x000000, 0.6);
      gunG.lineBetween(8, -6, 16, -6);
      gunG.lineBetween(12, -10, 12, -2);
      // Muzzle tip
      gunG.fillStyle(0x888888);
      gunG.fillRect(29, -2, 4, 4);
      gunG.fillStyle(0xaaaaaa);
      gunG.fillRect(30, -1, 2, 2);

      // Place gunContainer at the grip position; barrel points right at angle 0
      this.gunContainer = this.scene.add.container(0, 1, [gunG]);
      this.container.add(this.gunContainer);
    }
  }

  private addIdleAnimations(): void {
    if (!this.container.scene) return;
    const scene = this.scene;

    if (this.type === 'tabby') {
      // Wagging tail behind the cat
      const tailG = scene.add.graphics();
      tailG.lineStyle(5, 0xAA4400);
      tailG.lineBetween(0, 0, 6, -12);
      tailG.lineBetween(6, -12, 7, -25);
      tailG.lineStyle(3, 0xFF8C00);
      tailG.lineBetween(0, 0, 5, -10);
      tailG.lineBetween(5, -10, 6, -22);
      const tailCont = scene.add.container(22, 18, [tailG]);
      // Add behind bodyG (index 1 = after rangeG at 0)
      this.container.addAt(tailCont, 1);

      scene.tweens.add({
        targets: tailCont,
        angle: 40,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Slow breathe — scale pulse on body graphics (avoids fire-flash scaleX conflict
      // since fire-flash uses a one-shot yoyo, not a looping tween)
      scene.tweens.add({
        targets: this.bodyG,
        alpha: 0.90,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

    } else if (this.type === 'ninja') {
      // Floating spinning shuriken above the ninja
      const floatG = scene.add.graphics();
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? 9 : 4;
        const a = (i * Math.PI) / 4 - Math.PI / 4;
        pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
      }
      floatG.fillStyle(0xccccdd);
      floatG.fillPoints(pts, true);
      floatG.fillStyle(0xffffff, 0.9);
      floatG.fillCircle(0, 0, 2.5);
      const floatCont = scene.add.container(-22, -32, [floatG]);
      this.container.add(floatCont);

      // Continuous spin
      scene.tweens.add({
        targets: floatCont,
        angle: 360,
        duration: 1400,
        repeat: -1,
        ease: 'Linear',
      });
      // Float up and down
      scene.tweens.add({
        targets: floatCont,
        y: -24,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Stealth shimmer on body
      scene.tweens.add({
        targets: this.bodyG,
        alpha: 0.80,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

    } else if (this.type === 'wizard') {
      // Wizard — pulsing wand orb on top of static wand drawing
      const orbG = scene.add.graphics();
      orbG.fillStyle(0xffd700, 0.9);
      orbG.fillCircle(0, 0, 8);
      orbG.fillStyle(0xffffff, 0.85);
      orbG.fillCircle(-3, -5, 2.5);
      orbG.fillCircle(4, -4, 2);
      orbG.fillCircle(5, 2, 2);
      const orbCont = scene.add.container(17, -18, [orbG]);
      this.container.add(orbCont);

      // Pulse: grow + fade out and back in
      scene.tweens.add({
        targets: orbCont,
        scaleX: 1.9,
        scaleY: 1.9,
        alpha: 0.25,
        duration: 950,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      // Gentle wobble rotation
      scene.tweens.add({
        targets: orbCont,
        angle: 22,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Robe shimmer
      scene.tweens.add({
        targets: this.bodyG,
        alpha: 0.88,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

    } else {
      // Sniper — scope gleam pulse + slow breathe
      // Gleam is a child of gunContainer so it moves with the rotating rifle.
      // Scope lens is at (12, -6) within gunG coords — same offset here.
      const gleamG = scene.add.graphics();
      gleamG.fillStyle(0x55ffaa, 0.9);
      gleamG.fillCircle(0, 0, 4);
      gleamG.fillStyle(0xffffff, 0.8);
      gleamG.fillCircle(-1.5, -1.5, 1.8);
      const gleamCont = scene.add.container(12, -6, [gleamG]);
      if (this.gunContainer) this.gunContainer.add(gleamCont);

      // Scope gleam pulses (bright scan effect)
      scene.tweens.add({
        targets: gleamCont,
        alpha: 0.05,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 300,
      });

      // Slow settling breathe on body (sniper holds still)
      scene.tweens.add({
        targets: this.bodyG,
        alpha: 0.92,
        duration: 2500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  showRange(visible: boolean): void {
    this.rangeG.clear();
    this.rangeG.setVisible(visible);
    if (visible) {
      this.rangeG.lineStyle(1.5, 0xffffff, 0.35);
      this.rangeG.strokeCircle(0, 0, this.range);
      this.rangeG.fillStyle(0xffffff, 0.05);
      this.rangeG.fillCircle(0, 0, this.range);
    }
  }

  tryFire(enemies: Enemy[], delta: number): Enemy | null {
    this.fireCooldown -= delta;

    // Always find the best target in range (furthest along path) so we can aim
    let best: Enemy | null = null;
    let bestWp = -1;

    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.container.x;
      const dy = e.y - this.container.y;
      if (dx * dx + dy * dy <= this.range * this.range) {
        if (e.waypointIndex > bestWp) {
          best = e;
          bestWp = e.waypointIndex;
        }
      }
    }

    // --- Smooth rotation toward target (or snap back to rest) ---
    const wrapDeg = (a: number) => { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; };
    // Frame-rate-independent lerp: ~96% of the way to target in 0.5 s
    const lerpSpeed = 1 - Math.pow(0.001, delta / 1000);

    if (this.type === 'sniper' && this.gunContainer) {
      // Sniper: only the rifle rotates — body stays upright.
      // Barrel points RIGHT at angle 0, so atan2 needs no +90° offset.
      if (best) {
        const dx = best.x - this.container.x;
        const dy = best.y - this.container.y;
        this.aimAngle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
      } else {
        this.aimAngle = 0; // rest: barrel points right
      }
      const gunDiff = wrapDeg(this.aimAngle - this.gunContainer.angle);
      this.gunContainer.angle += gunDiff * lerpSpeed;
      this.container.angle = 0; // body never tilts
    } else {
      // Other cats: whole body rotates to face the enemy.
      // Cats are drawn facing UP, so add 90° to atan2 (which returns 0 for rightward).
      if (best) {
        const dx = best.x - this.container.x;
        const dy = best.y - this.container.y;
        this.aimAngle = Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90;
      } else {
        this.aimAngle = 0;
      }
      const bodyDiff = wrapDeg(this.aimAngle - this.container.angle);
      this.container.angle += bodyDiff * lerpSpeed;
    }

    if (this.fireCooldown > 0 || !best) return null;

    this.fireCooldown = 1000 / this.fireRate;
    // Fire flash — brief scale pop in the direction the cat is already facing
    this.scene.tweens.add({
      targets: this.bodyG,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 70,
      yoyo: true,
    });

    return best;
  }

  destroy(): void {
    // Kill all tweens on nested children first
    const killDeep = (obj: Phaser.GameObjects.GameObject) => {
      this.scene.tweens.killTweensOf(obj);
      if ((obj as any).list) {
        for (const child of (obj as any).list as Phaser.GameObjects.GameObject[]) {
          killDeep(child);
        }
      }
    };
    killDeep(this.container);
    this.container.destroy(true);
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.container.y; }
}
