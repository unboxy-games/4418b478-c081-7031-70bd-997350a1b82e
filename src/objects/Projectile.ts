import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { TowerType } from './Tower';

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

export class Projectile {
  scene: Phaser.Scene;
  graphics: Phaser.GameObjects.Graphics;
  target: Enemy;
  type: TowerType;
  damage: number;
  speed: number;
  alive = true;

  // Set when the projectile hits — used by GameScene for AoE
  hitX = 0;
  hitY = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    target: Enemy,
    type: TowerType,
    damage: number
  ) {
    this.scene = scene;
    this.target = target;
    this.type = type;
    this.damage = damage;
    this.speed = type === 'wizard' ? 175 : type === 'sniper' ? 680 : 310;

    this.graphics = scene.add.graphics();
    this.graphics.x = x;
    this.graphics.y = y;
    this.graphics.setDepth(4);

    this.draw();
  }

  private draw(): void {
    const g = this.graphics;
    g.clear();

    if (this.type === 'tabby') {
      // Orange yarn ball
      g.fillStyle(0xff8800);
      g.fillCircle(0, 0, 5.5);
      g.lineStyle(1.5, 0xffcc44);
      g.strokeCircle(0, 0, 3);
      g.fillStyle(0xffd700);
      g.fillCircle(-1.5, -1.5, 2.5);
    } else if (this.type === 'ninja') {
      // Shuriken
      g.fillStyle(0xdddddd);
      drawStar(g, 0, 0, 4, 7, 3.5);
      g.fillStyle(0x888888);
      g.fillCircle(0, 0, 2.5);
    } else if (this.type === 'wizard') {
      // Wizard orb
      g.fillStyle(0xcc44ff, 0.9);
      g.fillCircle(0, 0, 9);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(-3, -3, 4.5);
      g.fillStyle(0xffd700);
      g.fillCircle(2, 2, 3);
    } else {
      // Sniper tracer — elongated bright bullet (rotated toward target in update)
      g.fillStyle(0x88ff44, 0.5);
      g.fillEllipse(0, 0, 22, 7);   // outer glow
      g.fillStyle(0xccff88, 0.85);
      g.fillEllipse(0, 0, 16, 5);   // mid layer
      g.fillStyle(0xffffff, 0.95);
      g.fillEllipse(-3, 0, 8, 3);   // bright core/tip
    }
  }

  /** Returns true when projectile hits target */
  update(delta: number): boolean {
    if (!this.alive) return false;

    if (!this.target.alive) {
      this.destroy();
      return false;
    }

    const dx = this.target.x - this.graphics.x;
    const dy = this.target.y - this.graphics.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const move = (this.speed * delta) / 1000;

    if (this.type === 'ninja') {
      this.graphics.angle += 20;
    }
    if (this.type === 'sniper') {
      this.graphics.rotation = Math.atan2(dy, dx);
    }

    if (dist <= move + 7) {
      this.hitX = this.target.x;
      this.hitY = this.target.y;
      this.target.takeDamage(this.damage);
      this.destroy();
      return true;
    } else {
      this.graphics.x += (dx / dist) * move;
      this.graphics.y += (dy / dist) * move;
    }

    return false;
  }

  destroy(): void {
    this.alive = false;
    if (this.graphics && this.graphics.scene) {
      this.graphics.destroy();
    }
  }
}
