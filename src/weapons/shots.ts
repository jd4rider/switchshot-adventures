import Phaser from 'phaser'
import { BLASTER_COLORS, SHOT, TUNING } from '../config'
import { aimDirection } from '../player/movement'
import type { BlasterMode } from '../types'

export interface Shot {
  image: Phaser.Physics.Arcade.Image
  mode: BlasterMode
  ricochets: number
  bornAt: number
}

/**
 * Pooled Switchshot projectiles. Shots are real moving bodies: mirrors change
 * their velocity and every wall stops them, so a tap never solves a puzzle by
 * itself.
 */
export class ShotSystem {
  readonly group: Phaser.Physics.Arcade.Group
  readonly pool: Phaser.Physics.Arcade.Image[] = []
  private readonly scene: Phaser.Scene
  private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter
  private readonly spark: Phaser.GameObjects.Particles.ParticleEmitter
  private lastTrailAt = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.group = scene.physics.add.group({ allowGravity: false, immovable: true, allowRotation: true })
    for (let index = 0; index < SHOT.poolSize; index += 1) {
      const image = scene.physics.add.image(-200, -200, 'shot-pulse')
      image.setDepth(24)
      image.setData('bounces', 0)
      image.disableBody(true, true)
      this.group.add(image)
      this.pool.push(image)
    }
    this.trail = scene.add.particles(0, 0, 'fx-dot', {
      speed: { min: 0, max: 22 },
      lifespan: 280,
      scale: { start: 0.42, end: 0 },
      alpha: { start: 0.65, end: 0 },
      emitting: false,
      blendMode: 'ADD',
    }).setDepth(23)
    this.spark = scene.add.particles(0, 0, 'fx-spark', {
      speed: { min: 60, max: 220 },
      lifespan: 420,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 },
      gravityY: 260,
      emitting: false,
      blendMode: 'ADD',
    }).setDepth(26)
  }

  private acquire(): Phaser.Physics.Arcade.Image {
    const free = this.pool.find((image) => !image.active)
    if (free) return free
    const image = this.scene.physics.add.image(-200, -200, 'shot-pulse')
    image.disableBody(true, true)
    this.group.add(image)
    this.pool.push(image)
    return image
  }

  fire(x: number, y: number, targetX: number, targetY: number, mode: BlasterMode, tint = 0xffffff): Phaser.Physics.Arcade.Image {
    const direction = aimDirection(x, y, targetX, targetY)
    const image = this.acquire()
    const texture = mode === 'volt' ? 'shot-volt' : mode === 'growth' ? 'shot-growth' : mode === 'gravity' ? 'shot-gravity' : 'shot-pulse'
    image.enableBody(true, x, y, true, true)
    image.setTexture(texture)
    image.setTint(tint)
    image.setRotation(Math.atan2(direction.y, direction.x))
    image.setScale(1)
    image.setAlpha(1)
    const body = image.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setCircle(9, image.width / 2 - 9, image.height / 2 - 9)
    image.setVelocity(direction.x * SHOT.speed, direction.y * SHOT.speed)
    image.setData('mode', mode)
    image.setData('bounces', 0)
    image.setData('bornAt', this.scene.time.now)
    image.setData('dirX', direction.x)
    image.setData('dirY', direction.y)
    image.setData('color', tint === 0xffffff ? BLASTER_COLORS[mode] : tint)
    return image
  }

  update(time: number, deltaMs: number): void {
    const bounds = this.scene.physics.world.bounds
    for (const image of this.pool) {
      if (!image.active) continue
      const born = Number(image.getData('bornAt') ?? time)
      if (time - born > SHOT.lifetimeMs) {
        this.despawn(image)
        continue
      }
      if (
        image.x < bounds.x - 80 ||
        image.x > bounds.right + 80 ||
        image.y < bounds.y - 80 ||
        image.y > bounds.bottom + 80
      ) {
        this.despawn(image)
        continue
      }
      if (time - this.lastTrailAt > 26) {
        this.trail.setParticleTint(Number(image.getData('color') ?? 0xffffff))
        this.trail.emitParticleAt(image.x, image.y, 1)
      }
    }
    if (time - this.lastTrailAt > 26) this.lastTrailAt = time
    void deltaMs
  }

  reflect(image: Phaser.Physics.Arcade.Image, dx: number, dy: number): void {
    image.setData('dirX', dx)
    image.setData('dirY', dy)
    image.setData('bounces', Number(image.getData('bounces') ?? 0) + 1)
    image.setVelocity(dx * SHOT.speed, dy * SHOT.speed)
    image.setRotation(Math.atan2(dy, dx))
  }

  impact(image: Phaser.Physics.Arcade.Image, amount = 5): void {
    const color = Number(image.getData('color') ?? 0xffffff)
    this.spark.setParticleTint(color)
    this.spark.emitParticleAt(image.x, image.y, amount)
  }

  despawn(image: Phaser.Physics.Arcade.Image, impact = false): void {
    if (!image.active) return
    if (impact) this.impact(image)
    image.disableBody(true, true)
  }

  clear(): void {
    for (const image of this.pool) {
      if (image.active) image.disableBody(true, true)
    }
  }

  get activeCount(): number {
    return this.pool.filter((image) => image.active).length
  }

  ricochetsFor(image: Phaser.Physics.Arcade.Image): number {
    return Number(image.getData('bounces') ?? 0)
  }

  destroy(): void {
    this.trail.destroy()
    this.spark.destroy()
    this.group.destroy(true)
  }
}

/** Keeps a cooldown independent from the render rate. */
export function stepCooldown(current: number, deltaMs: number): number {
  return Math.max(0, current - deltaMs)
}

export function recoilAngle(angle: number): number {
  return angle + (Math.random() - 0.5) * 0.05
}

export function clampShotTilt(dy: number): number {
  return Phaser.Math.Clamp(dy, -1, 1) * TUNING.maxAimTiltSpeed
}
