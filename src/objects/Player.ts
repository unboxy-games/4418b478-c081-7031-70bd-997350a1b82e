import Phaser from 'phaser';

/**
 * Player - a reusable game object for the player character.
 * Extend or replace this with your game's player logic.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private speed = 200;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
  }

  handleMovement(cursors: Phaser.Types.Input.Keyboard.CursorKeys): void {
    this.setVelocity(0);

    if (cursors.left.isDown) {
      this.setVelocityX(-this.speed);
    } else if (cursors.right.isDown) {
      this.setVelocityX(this.speed);
    }

    if (cursors.up.isDown) {
      this.setVelocityY(-this.speed);
    } else if (cursors.down.isDown) {
      this.setVelocityY(this.speed);
    }
  }
}
