import Phaser from 'phaser'
import type { EnemyKind, EnemySpec, LevelData } from '../types'

export interface EnemyState {
  spec: EnemySpec
  image: Phaser.Physics.Arcade.Image
  baseX: number
  baseY: number
  direction: -1 | 1
  nextActionAt: number
  alive: boolean
}

export interface EnemyHitResult {
  defeated: boolean
  blocked: boolean
  x: number
  y: number
  name: string
}

const NAMES: Record<EnemyKind, string> = {
  wobblebot: 'Wobblebot',
  hopper: 'Hopper',
  shieldbug: 'Shieldbug',
  drone: 'Spark Drone',
}

/**
 * Four small, readable machines. Each runs a tiny state machine (idle →
 * patrol/alert → defeated) and never uses pathfinding.
 */
export class EnemySystem {
  readonly group: Phaser.Physics.Arcade.Group
  readonly shots: Phaser.Physics.Arcade.Group
  private readonly scene: Phaser.Scene
  private readonly enemies: EnemyState[] = []
  private readonly level: LevelData

  constructor(scene: Phaser.Scene, level: LevelData) {
    this.scene = scene
    this.level = level
    this.group = scene.physics.add.group({ allowGravity: true })
    this.shots = scene.physics.add.group({ allowGravity: false })
    for (const spec of level.enemies) this.spawn(spec)
  }

  private spawn(spec: EnemySpec): void {
    const key = `enemy-${spec.kind}`
    const image = this.group.create(spec.x, spec.y, key) as Phaser.Physics.Arcade.Image
    image.setDepth(16)
    image.setData('kind', spec.kind)
    const body = image.body as Phaser.Physics.Arcade.Body
    body.setSize(spec.kind === 'drone' ? 44 : 38, spec.kind === 'drone' ? 30 : 38)
    body.setAllowGravity(spec.kind !== 'drone')
    body.setCollideWorldBounds(false)
    body.setMaxVelocity(260, 900)
    if (spec.kind === 'drone') {
      body.setAllowGravity(false)
    }
    const state: EnemyState = {
      spec,
      image,
      baseX: spec.x,
      baseY: spec.y,
      direction: Math.random() < 0.5 ? -1 : 1,
      nextActionAt: 0,
      alive: true,
    }
    this.enemies.push(state)
  }

  update(time: number, deltaMs: number, player: { x: number; y: number }, freeze = false): void {
    const drift = this.scene.tweens ? 1 : 1
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue
      const body = enemy.image.body as Phaser.Physics.Arcade.Body
      const spec = enemy.spec
      const distanceToPlayer = Math.hypot(player.x - enemy.image.x, player.y - enemy.image.y)
      if (freeze) {
        body.setVelocityX(0)
        if (spec.kind === 'hopper') body.setVelocityY(0)
        continue
      }
      switch (spec.kind) {
        case 'wobblebot': {
          if (enemy.image.x > enemy.baseX + spec.range / 2) enemy.direction = -1
          if (enemy.image.x < enemy.baseX - spec.range / 2) enemy.direction = 1
          if (body.blocked.left) enemy.direction = 1
          if (body.blocked.right) enemy.direction = -1
          const alert = distanceToPlayer < 130 ? 1.45 : 1
          body.setVelocityX(enemy.direction * spec.speed * alert * drift)
          enemy.image.setFlipX(enemy.direction < 0)
          enemy.image.setAngle(Math.sin(time / 180 + enemy.baseX) * 4)
          break
        }
        case 'hopper': {
          if (body.blocked.down && time > enemy.nextActionAt) {
            enemy.nextActionAt = time + 1500 + Math.random() * 500
            body.setVelocityY(-520)
            body.setVelocityX(Math.sign(player.x - enemy.image.x) * Math.min(configSpeed(spec), 130))
            enemy.image.setScale(0.9, 1.12)
            this.scene.tweens.add({ targets: enemy.image, scaleX: 1, scaleY: 1, duration: 240 })
          }
          break
        }
        case 'shieldbug': {
          const facing = player.x < enemy.image.x ? -1 : 1
          enemy.image.setFlipX(facing < 0)
          const angle = Math.atan2(player.y - enemy.image.y, player.x - enemy.image.x)
          const shieldAngle = (120 * Math.PI) / 180
          enemy.image.setAngle(0)
          const shell = enemy.image.getData('shell') as Phaser.GameObjects.Image | undefined
          shell?.setRotation(angle + shieldAngle / 2)
          if (enemy.image.x > enemy.baseX + spec.range / 2) enemy.direction = -1
          if (enemy.image.x < enemy.baseX - spec.range / 2) enemy.direction = 1
          if (body.blocked.left) enemy.direction = 1
          if (body.blocked.right) enemy.direction = -1
          body.setVelocityX(enemy.direction * spec.speed * 0.5)
          break
        }
        case 'drone': {
          const hover = Math.sin(time / 700 + enemy.baseX) * 26
          enemy.image.y = enemy.baseY + hover
          body.setVelocityX(enemy.direction * spec.speed * 0.55)
          if (enemy.image.x > enemy.baseX + spec.range / 2) enemy.direction = -1
          if (enemy.image.x < enemy.baseX - spec.range / 2) enemy.direction = 1
          enemy.image.setFlipX(enemy.direction < 0)
          if (time > enemy.nextActionAt && distanceToPlayer < 520) {
            enemy.nextActionAt = time + 1900
            this.fireAt(enemy.image.x, enemy.image.y, player.x, player.y)
          }
          break
        }
      }
      if (enemy.image.y > this.level.height + 200) this.despawn(enemy)
    }
    for (const shot of this.shots.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (!shot.active) continue
      const born = Number(shot.getData('bornAt') ?? time)
      if (time - born > 5000) shot.destroy()
      else if (shot.y > this.level.height + 100 || shot.y < -100) shot.destroy()
    }
    void deltaMs
  }

  private fireAt(x: number, y: number, targetX: number, targetY: number): void {
    const shot = this.shots.create(x, y, 'shot-pulse') as Phaser.Physics.Arcade.Image
    shot.setDepth(17)
    shot.setTint(0xff5f7a)
    shot.setScale(0.75)
    const body = shot.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setCircle(7)
    const angle = Math.atan2(targetY - y, targetX - x)
    shot.setVelocity(Math.cos(angle) * 220, Math.sin(angle) * 220)
    shot.setData('bornAt', this.scene.time.now)
  }

  damage(image: Phaser.Physics.Arcade.Image, shotVx: number): EnemyHitResult {
    const enemy = this.enemies.find((entry) => entry.image === image)
    if (!enemy || !enemy.alive) return { defeated: false, blocked: false, x: image.x, y: image.y, name: 'Machine' }
    const kind = enemy.spec.kind
    if (kind === 'shieldbug') {
      const facing = (enemy.image.flipX ? -1 : 1) as 1 | -1
      if (Math.sign(shotVx) === facing) {
        return { defeated: false, blocked: true, x: image.x, y: image.y, name: NAMES[kind] }
      }
    }
    enemy.alive = false
    const x = enemy.image.x
    const y = enemy.image.y
    const body = enemy.image.body as Phaser.Physics.Arcade.Body
    body.enable = false
    this.scene.tweens.add({
      targets: enemy.image,
      y: y - 26,
      angle: enemy.image.angle + (Math.random() < 0.5 ? -150 : 150),
      alpha: 0,
      scale: 0.6,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => enemy.image.destroy(),
    })
    return { defeated: true, blocked: false, x, y, name: NAMES[kind] }
  }

  private despawn(enemy: EnemyState): void {
    enemy.alive = false
    enemy.image.destroy()
  }

  clearShots(): void {
    this.shots.clear(true, true)
  }

  get remaining(): number {
    return this.enemies.filter((enemy) => enemy.alive).length
  }

  destroy(): void {
    this.enemies.forEach((enemy) => enemy.image.destroy())
    this.shots.clear(true, true)
    this.group.destroy(true)
  }
}

function configSpeed(spec: EnemySpec): number {
  return Math.max(60, spec.speed)
}

export { NAMES as ENEMY_NAMES }
