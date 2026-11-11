import Phaser from 'phaser'
import { PLAYER } from '../config'

export interface PipState {
  x: number
  y: number
  velocityX: number
  velocityY: number
  onGround: boolean
  facing: number
  aimX: number
  aimY: number
  firing: boolean
  invulnerable: boolean
  reducedMotion: boolean
}

/**
 * Pip is assembled from separate parts so the lower body can run while the
 * upper body aims. The blaster rotates toward the last tap instead of turning
 * the whole character upside down.
 */
export class PipView {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private readonly body: Phaser.GameObjects.Image
  private readonly head: Phaser.GameObjects.Image
  private readonly scarf: Phaser.GameObjects.Image
  private readonly blaster: Phaser.GameObjects.Image
  private readonly arm: Phaser.GameObjects.Container
  private readonly legs: Phaser.GameObjects.Image[] = []
  private readonly boots: Phaser.GameObjects.Image[] = []
  private readonly shadow: Phaser.GameObjects.Image
  private readonly blink: Phaser.GameObjects.Image
  private phase = 0
  private blinkAt = 3000
  private blinkUntil = 0
  private aimAngle = 0
  private firingUntil = 0
  private recoil = 0

  constructor(scene: Phaser.Scene, depth = 20) {
    this.scene = scene
    this.shadow = scene.add.image(0, 31, 'pip-shadow').setDisplaySize(58, 20).setAlpha(0.9)
    this.legs.push(scene.add.image(-9, 18, 'pip-leg'))
    this.legs.push(scene.add.image(9, 18, 'pip-leg'))
    this.boots.push(scene.add.image(-9, 33, 'pip-boot'))
    this.boots.push(scene.add.image(9, 33, 'pip-boot'))
    this.body = scene.add.image(0, 2, 'pip-body').setTint(0x2fae97)
    this.scarf = scene.add.image(0, -13, 'pip-scarf')
    this.head = scene.add.image(0, -34, 'pip-head')
    this.blink = scene.add.image(0, -27, 'pip-blink').setAlpha(0)
    this.arm = scene.add.container(8, -8)
    const armImage = scene.add.image(0, 10, 'pip-arm').setTint(0x2fae97)
    this.blaster = scene.add.image(18, 16, 'pip-blaster')
    this.arm.add([armImage, this.blaster])
    this.root = scene.add
      .container(0, 0, [this.shadow, ...this.legs, ...this.boots, this.body, this.scarf, this.head, this.blink, this.arm])
      .setDepth(depth)
    this.root.setSize(PLAYER.width, PLAYER.height)
  }

  update(state: PipState, deltaMs: number): void {
    this.root.setPosition(state.x, state.y)
    this.shadow.setAlpha(state.onGround ? 0.85 : 0.35)
    this.shadow.setScale(state.onGround ? 1 : 0.7, state.onGround ? 1 : 0.7)
    const speed = Math.abs(state.velocityX)
    const facing = state.facing >= 0 ? 1 : -1
    const flip = facing
    ;[this.body, this.head, this.scarf, this.blink].forEach((part) => part.setScale(flip, 1))
    this.legs.forEach((leg, index) => {
      leg.setScale(flip, 1)
      leg.setY(state.onGround ? 18 + Math.sin(this.phase + index * Math.PI) * (speed > 20 ? 4 : 1) : 16)
      leg.setRotation(state.onGround ? Math.sin(this.phase + index * Math.PI) * 0.18 : index === 0 ? -0.22 : 0.14)
    })
    this.boots.forEach((boot, index) => {
      boot.setScale(flip, 1)
      boot.setY(state.onGround ? 33 + Math.sin(this.phase + index * Math.PI) * (speed > 20 ? 4 : 1) : 30)
      boot.setRotation(state.onGround ? Math.sin(this.phase + index * Math.PI) * 0.12 : 0)
    })

    if (state.onGround && speed > 20) {
      this.phase += (deltaMs / 1000) * (6 + speed / 40)
      this.body.setY(2 + Math.abs(Math.sin(this.phase)) * 1.6)
      this.head.setY(-34 + Math.abs(Math.sin(this.phase)) * 1.2)
    } else {
      this.body.setY(2)
      this.head.setY(-34)
    }
    if (!state.onGround) {
      this.body.setAngle(Phaser.Math.Clamp(state.velocityY / 90, -7, 7) * facing)
      this.body.setY(state.velocityY < 0 ? -1 : 4)
    } else {
      this.body.setAngle(0)
    }

    // Blaster aim: separate from the body's horizontal facing.
    const desired = Math.atan2(state.aimY - state.y, state.aimX - state.x)
    this.aimAngle = Phaser.Math.Angle.RotateTo(this.aimAngle, desired, 0.012 * Math.min(deltaMs, 40))
    this.arm.setRotation(this.aimAngle)
    this.arm.setScale(1, facing)
    this.recoil = Math.max(0, this.recoil - deltaMs / 90)
    this.blaster.setX(18 - this.recoil * 3)
    this.blaster.setTint(0xffffff)
    this.blaster.setY(16)
    this.blaster.setFlipY(this.aimAngle > Math.PI / 2 || this.aimAngle < -Math.PI / 2)

    if (state.firing) {
      this.firingUntil = this.scene.time.now + 90
      this.recoil = 1
    }
    const firing = this.scene.time.now < this.firingUntil
    this.blaster.setScale(firing ? 1.08 : 1)

    if (state.invulnerable) {
      this.root.setAlpha(Math.sin(this.scene.time.now / 70) > 0 ? 0.45 : 1)
    } else {
      this.root.setAlpha(1)
    }

    if (!state.reducedMotion && this.scene.time.now > this.blinkAt) {
      this.blinkUntil = this.scene.time.now + 120
      this.blinkAt = this.scene.time.now + 2400 + Math.random() * 2600
    }
    this.blink.setAlpha(this.scene.time.now < this.blinkUntil ? 1 : 0)
    this.head.setAngle(state.aimY < state.y - 40 ? -4 * facing : 0)
  }

  setDepth(depth: number): void {
    this.root.setDepth(depth)
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible)
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
