import Phaser from 'phaser';
import { MouseZombie } from './MouseZombie';
import { TOWER_CONFIGS } from '../config';
import { audioManager } from '../audio/AudioManager';

export class Bullet extends Phaser.GameObjects.Graphics {
  private zombieTarget: MouseZombie;
  private bulletSpeed: number;
  private damage: number;
  private splashRadius: number;
  private chainRadius: number;
  private slowFactor: number;
  private slowDuration: number;
  private towerType: string;
  private allZombies: MouseZombie[] | undefined;
  isDead = false;
  private burnDps = 0;
  private burnDuration = 0;
  private trapProximity = 0;
  private trapExpiry = 0;
  private isGrounded = false;
  private groundX = 0;
  private groundY = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    target: MouseZombie,
    damage: number,
    towerType = 'basic',
    allZombies?: MouseZombie[],
  ) {
    super(scene);
    this.zombieTarget = target;
    this.damage = damage;
    this.x = x;
    this.y = y;
    this.towerType = towerType;
    this.allZombies = allZombies;

    const cfg = TOWER_CONFIGS[towerType] ?? TOWER_CONFIGS['basic'];
    this.bulletSpeed   = cfg.bulletSpeed;
    this.splashRadius  = cfg.splashRadius  ?? 0;
    this.chainRadius   = cfg.chainRadius   ?? 0;
    this.slowFactor    = cfg.slowFactor    ?? 1.0;
    this.slowDuration  = cfg.slowDuration  ?? 0;
    this.burnDps       = cfg.burnDps       ?? 0;
    this.burnDuration  = cfg.burnDuration  ?? 0;
    this.trapProximity = cfg.trapProximity ?? 0;
    if (towerType === 'trap') {
      // Save target position at time of firing (where enemy currently is)
      this.groundX = target.x;
      this.groundY = target.y;
      this.trapExpiry = 12000; // 12s before the trap expires
    }

    if (towerType === 'sniper') {
      // Large glowing blue bolt
      this.fillStyle(0x88ddff, 0.4);
      this.fillCircle(0, 0, 9);
      this.fillStyle(0x44aaff);
      this.fillCircle(0, 0, 6);
      this.fillStyle(0xffffff, 0.9);
      this.fillCircle(0, 0, 2);
    } else if (towerType === 'rapid') {
      // Small orange dart
      this.fillStyle(0xff5500);
      this.fillCircle(0, 0, 3);
      this.fillStyle(0xffcc00, 0.7);
      this.fillCircle(0, 0, 1.5);
    } else if (towerType === 'taser') {
      // Bright cyan electric spark
      this.fillStyle(0x00ffff, 0.5);
      this.fillCircle(0, 0, 7);
      this.fillStyle(0x00eeff);
      this.fillCircle(0, 0, 4);
      this.fillStyle(0xffffff, 0.95);
      this.fillCircle(0, 0, 2);
      // Tiny arc spikes
      this.lineStyle(1.5, 0x44ffff, 0.9);
      this.lineBetween(0, -5, 3, -9);
      this.lineBetween(0, -5, -3, -9);
      this.lineBetween(5, 0, 9, 3);
      this.lineBetween(-5, 0, -9, 3);
    } else if (towerType === 'bomb') {
      // Dark round bomb with glowing fuse
      this.fillStyle(0x111111);
      this.fillCircle(0, 0, 8);
      this.lineStyle(1.5, 0x333333);
      this.strokeCircle(0, 0, 8);
      // Fuse spark
      this.fillStyle(0xff8800);
      this.fillCircle(4, -8, 3);
      this.fillStyle(0xffee00, 0.9);
      this.fillCircle(4, -8, 1.5);
      // Shine
      this.fillStyle(0x555555, 0.6);
      this.fillCircle(-3, -4, 3);
    } else if (towerType === 'freeze') {
      // Ice crystal shard
      this.fillStyle(0x88eeff, 0.4);
      this.fillCircle(0, 0, 10);
      this.fillStyle(0xaaeeff);
      this.fillCircle(0, 0, 7);
      this.fillStyle(0xffffff, 0.9);
      this.fillCircle(0, 0, 3);
      // Ice crystal spikes
      this.lineStyle(2, 0xccffff, 0.9);
      this.lineBetween(0, -8, 0, -13);
      this.lineBetween(0, 8, 0, 13);
      this.lineBetween(-8, 0, -13, 0);
      this.lineBetween(8, 0, 13, 0);
      this.lineBetween(-6, -6, -10, -10);
      this.lineBetween(6, 6, 10, 10);
      this.lineBetween(6, -6, 10, -10);
      this.lineBetween(-6, 6, -10, 10);
    } else if (towerType === 'flame') {
      // Fireball
      this.fillStyle(0xff2200, 0.6);
      this.fillCircle(0, 0, 9);
      this.fillStyle(0xff6600);
      this.fillCircle(0, 0, 6);
      this.fillStyle(0xffcc00, 0.9);
      this.fillCircle(0, 0, 3);
      this.fillStyle(0xffffff, 0.8);
      this.fillCircle(-1, -1, 1.5);
    } else if (towerType === 'trap') {
      // Ground mine
      this.fillStyle(0x115511);
      this.fillCircle(0, 0, 10);
      this.lineStyle(2, 0x44ff44, 0.9);
      this.strokeCircle(0, 0, 10);
      this.fillStyle(0x44ff44);
      this.fillCircle(0, 0, 4);
      // Spike indicators
      this.lineStyle(2, 0x88ff88, 0.8);
      this.lineBetween(0, -10, 0, -15);
      this.lineBetween(0, 10, 0, 15);
      this.lineBetween(-10, 0, -15, 0);
      this.lineBetween(10, 0, 15, 0);
    } else {
      // Basic: yellow circle with orange ring
      this.fillStyle(0xffee00);
      this.fillCircle(0, 0, 5);
      this.lineStyle(1.5, 0xff8800);
      this.strokeCircle(0, 0, 5);
    }

    this.setDepth(3);
    scene.add.existing(this);
  }

  private spawnLightningArc(x1: number, y1: number, x2: number, y2: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(4);

    const segments = 7;
    const dx = (x2 - x1) / segments;
    const dy = (y2 - y1) / segments;
    const jitter = 9;

    // Glow underline
    g.lineStyle(4, 0x00aaff, 0.3);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.strokePath();

    // Jagged arc
    g.lineStyle(2, 0x00ffff, 1.0);
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
      const px = x1 + dx * i + (Math.random() - 0.5) * jitter * 2;
      const py = y1 + dy * i + (Math.random() - 0.5) * jitter * 2;
      g.lineTo(px, py);
    }
    g.lineTo(x2, y2);
    g.strokePath();

    // Impact flash at destination
    g.fillStyle(0x88ffff, 0.9);
    g.fillCircle(x2, y2, 5);

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 280,
      ease: 'Power2',
      onComplete: () => g.destroy(),
    });
  }

  private spawnExplosion(x: number, y: number): void {
    audioManager.playExplosion();
    const radius = this.splashRadius;
    const g = this.scene.add.graphics();
    g.setDepth(4);
    g.setPosition(x, y);

    // Outer blast ring
    g.fillStyle(0xff4400, 0.55);
    g.fillCircle(0, 0, radius);
    // Mid fire
    g.fillStyle(0xff8800, 0.7);
    g.fillCircle(0, 0, radius * 0.65);
    // Core flash
    g.fillStyle(0xffee00, 0.85);
    g.fillCircle(0, 0, radius * 0.35);
    // White hot center
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(0, 0, radius * 0.15);

    g.setScale(0.15);
    this.scene.tweens.add({
      targets: g,
      scaleX: 1,
      scaleY: 1,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => g.destroy(),
    });

    // Shockwave ring
    const ring = this.scene.add.graphics();
    ring.setDepth(4);
    ring.setPosition(x, y);
    ring.lineStyle(3, 0xff6600, 0.8);
    ring.strokeCircle(0, 0, radius);
    ring.setScale(0.2);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: 350,
      ease: 'Power1',
      onComplete: () => ring.destroy(),
    });
  }

  step(delta: number): void {
    if (this.isDead) return;

    // Trap: once grounded, check for proximity triggers
    if (this.towerType === 'trap' && this.isGrounded) {
      this.trapExpiry -= delta;
      if (this.trapExpiry <= 0) {
        this.isDead = true;
        this.destroy();
        return;
      }
      if (this.allZombies) {
        for (const z of this.allZombies) {
          if (z.isDead || !z.active) continue;
          const zx = z.x - this.x;
          const zy = z.y - this.y;
          if (Math.sqrt(zx * zx + zy * zy) <= this.trapProximity) {
            // Trigger explosion!
            for (const ez of this.allZombies) {
              if (ez.isDead || !ez.active) continue;
              const ex = ez.x - this.x;
              const ey = ez.y - this.y;
              if (Math.sqrt(ex * ex + ey * ey) <= this.splashRadius) {
                ez.takeDamage(this.damage);
              }
            }
            this.spawnExplosion(this.x, this.y);
            this.isDead = true;
            this.destroy();
            return;
          }
        }
      }
      return; // grounded trap doesn't move
    }

    // For trap bullets: move toward groundX/Y (not the enemy)
    if (this.towerType === 'trap') {
      const gdx = this.groundX - this.x;
      const gdy = this.groundY - this.y;
      const gdist = Math.sqrt(gdx * gdx + gdy * gdy);
      if (gdist < 8) {
        // Arrive at ground position — become a stationary trap
        this.x = this.groundX;
        this.y = this.groundY;
        this.isGrounded = true;
        return;
      }
      const move = this.bulletSpeed * (delta / 1000);
      this.x += (gdx / gdist) * move;
      this.y += (gdy / gdist) * move;
      return;
    }

    if (this.zombieTarget.isDead || !this.zombieTarget.active) {
      this.isDead = true;
      this.destroy();
      return;
    }

    const dx = this.zombieTarget.x - this.x;
    const dy = this.zombieTarget.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 12) {
      if (this.splashRadius > 0 && this.allZombies) {
        // AoE splash: damage all zombies within splashRadius of impact point
        const ix = this.zombieTarget.x;
        const iy = this.zombieTarget.y;
        for (const z of this.allZombies) {
          if (z.isDead || !z.active) continue;
          const zx = z.x - ix;
          const zy = z.y - iy;
          if (Math.sqrt(zx * zx + zy * zy) <= this.splashRadius) {
            z.takeDamage(this.damage);
          }
        }
        this.spawnExplosion(ix, iy);
      } else if (this.towerType === 'taser' && this.chainRadius > 0 && this.allZombies) {
        // Taser: damage + slow primary, then chain to up to 2 nearby targets
        const ix = this.zombieTarget.x;
        const iy = this.zombieTarget.y;
        this.zombieTarget.takeDamage(this.damage);
        if (this.slowDuration > 0) {
          this.zombieTarget.applySlow(this.slowFactor, this.slowDuration);
        }

        // Find up to 2 additional chain targets (not primary, sorted by distance)
        const candidates = this.allZombies
          .filter(z => z !== this.zombieTarget && !z.isDead && z.active)
          .map(z => {
            const cx = z.x - ix;
            const cy = z.y - iy;
            return { z, d: Math.sqrt(cx * cx + cy * cy) };
          })
          .filter(e => e.d <= this.chainRadius)
          .sort((a, b) => a.d - b.d)
          .slice(0, 2);

        for (const { z } of candidates) {
          z.takeDamage(Math.ceil(this.damage * 0.6));
          if (this.slowDuration > 0) {
            z.applySlow(this.slowFactor, this.slowDuration);
          }
          if (this.burnDps > 0) z.applyBurn(this.burnDps, this.burnDuration);
          this.spawnLightningArc(ix, iy, z.x, z.y);
        }
      } else {
        this.zombieTarget.takeDamage(this.damage);
        // Apply burn for flame tower
        if (this.burnDps > 0 && this.burnDuration > 0) {
          this.zombieTarget.applyBurn(this.burnDps, this.burnDuration);
        }
        // Apply freeze (via existing slow mechanism)
        if (this.towerType === 'freeze' && this.slowDuration > 0) {
          this.zombieTarget.applySlow(this.slowFactor, this.slowDuration);
        }
      }
      this.isDead = true;
      this.destroy();
      return;
    }

    const move = this.bulletSpeed * (delta / 1000);
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
  }
}
