import Phaser from 'phaser'
import { PLAYER, TUNING } from '../config'
import type { PlayerIntent } from '../types'
import {
  clampFall,
  coyoteRemaining,
  cutJump,
  jumpBufferRemaining,
  stepHorizontal,
} from './movement'

export interface PlayerEvents {
  jumped: boolean
  landed: boolean
}

export class Player {
  readonly hitbox: Phaser.GameObjects.Rectangle
  readonly body: Phaser.Physics.Arcade.Body
  facing: -1 | 1 = 1
  health: number = PLAYER.maxHealth
  invulnerable = 0
  onGround = false
  private coyote: number = TUNING.coyoteMs
  private buffer = 0
  private previousJumped = false
  private wasGrounded = false
  private speedMultiplier = 1
  private jumpMultiplier = 1

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.hitbox = scene.add.rectangle(x, y, PLAYER.width, PLAYER.height, 0xffffff, 0)
    scene.physics.add.existing(this.hitbox)
    this.body = this.hitbox.body as Phaser.Physics.Arcade.Body
    this.body.setSize(PLAYER.width, PLAYER.height, false)
    this.body.setCollideWorldBounds(true)
    this.body.setMaxVelocity(520, TUNING.maxFallSpeed)
    this.body.setDragX(0)
    this.body.setAllowGravity(true)
  }

  setModifiers(speed = 1, jump = 1): void {
    this.speedMultiplier = speed
    this.jumpMultiplier = jump
  }

  step(intent: PlayerIntent, deltaMs: number): PlayerEvents {
    const events: PlayerEvents = { jumped: false, landed: false }
    const dt = Math.min(deltaMs, 34) / 1000
    this.onGround = this.body.blocked.down || this.body.touching.down
    if (this.invulnerable > 0) this.invulnerable = Math.max(0, this.invulnerable - deltaMs)

    this.coyote = coyoteRemaining(this.coyote, this.onGround, deltaMs)
    this.buffer = jumpBufferRemaining(this.buffer, intent.jumpPressed && !this.previousJumped, deltaMs)

    if (this.onGround && !this.wasGrounded) {
      events.landed = true
    }
    this.wasGrounded = this.onGround

    if (this.buffer > 0 && (this.onGround || this.coyote > 0)) {
      this.body.velocity.y = TUNING.jumpVelocity * this.jumpMultiplier
      this.coyote = 0
      this.buffer = 0
      events.jumped = true
    }

    if (!intent.jumpHeld && this.body.velocity.y < TUNING.jumpCutVelocity) {
      this.body.velocity.y = cutJump(this.body.velocity.y)
    }

    this.body.velocity.x = stepHorizontal(this.body.velocity.x, intent.axis, this.onGround, dt) * this.speedMultiplier
    this.body.velocity.x = Phaser.Math.Clamp(this.body.velocity.x, -TUNING.runSpeed * 1.4, TUNING.runSpeed * 1.4)
    this.body.velocity.y = clampFall(this.body.velocity.y)

    if (Math.abs(intent.axis) > 0.2) this.facing = intent.axis > 0 ? 1 : -1
    else if (Math.abs(this.body.velocity.x) > 22) this.facing = this.body.velocity.x > 0 ? 1 : -1

    this.previousJumped = intent.jumpPressed
    return events
  }

  muzzle(): { x: number; y: number } {
    const center = this.body.center
    return { x: center.x + this.facing * 24, y: center.y - 24 }
  }

  hurt(fromX: number): boolean {
    if (this.invulnerable > 0) return false
    const dir = fromX < this.body.center.x ? 1 : -1
    this.body.velocity.x = dir * TUNING.hitKnockbackX
    this.body.velocity.y = TUNING.hitKnockbackY
    this.invulnerable = TUNING.invulnerableMs
    return true
  }

  setHealth(value: number): void {
    this.health = Phaser.Math.Clamp(value, 0, PLAYER.maxHealth)
  }

  reset(x: number, y: number): void {
    this.body.reset(x, y)
    this.body.setAllowGravity(true)
    this.body.setVelocity(0, 0)
    this.invulnerable = TUNING.respawnGraceMs
    this.coyote = TUNING.coyoteMs
    this.buffer = 0
    this.previousJumped = false
    this.wasGrounded = false
  }

  get feetY(): number {
    return this.body.bottom
  }

  destroy(): void {
    this.hitbox.destroy()
  }
}
