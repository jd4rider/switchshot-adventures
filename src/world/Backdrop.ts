import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import { worldAt } from '../data/worlds'

/** Layered, cheap parallax. One generated texture plus a handful of floaters. */
export class Backdrop {
  private readonly sky: Phaser.GameObjects.Image
  private readonly deco: Phaser.GameObjects.Image[] = []
  private readonly vignette: Phaser.GameObjects.Graphics
  private readonly flash: Phaser.GameObjects.Rectangle
  private readonly reducedMotion: boolean

  constructor(scene: Phaser.Scene, worldIndex: number, reducedMotion: boolean) {
    this.reducedMotion = reducedMotion
    const world = worldAt(worldIndex)
    this.sky = scene.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, `bg-${worldIndex}`)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0)
      .setDepth(-40)
    for (let index = 0; index < 8; index += 1) {
      const key = index % 3 === 0 ? 'gem-optional' : `gem-${index % 3}`
      const image = scene.add
        .image(50 + ((index * 131) % 620), 120 + ((index * 173) % 1040), key)
        .setScale(0.24 + (index % 3) * 0.08)
        .setAlpha(0.13)
        .setScrollFactor(0.05 + (index % 3) * 0.03)
        .setDepth(-39)
      this.deco.push(image)
      if (!reducedMotion) {
        scene.tweens.add({
          targets: image,
          y: image.y - 22 - (index % 4) * 7,
          duration: 3000 + index * 320,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: index * 180,
        })
      }
    }
    this.vignette = scene.add.graphics().setScrollFactor(0).setDepth(90)
    this.vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.06, 0.06, 0.3, 0.3)
    this.vignette.fillRect(0, 0, GAME_WIDTH, 190)
    this.vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.34, 0.34, 0.05, 0.05)
    this.vignette.fillRect(0, GAME_HEIGHT - 230, GAME_WIDTH, 230)
    this.flash = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0)
      .setScrollFactor(0)
      .setDepth(4000)
    this.sky.setTint(0xffffff)
    void world
  }

  pulse(color = 0xffffff, alpha = 0.14): void {
    if (this.reducedMotion) return
    this.flash.setFillStyle(color, alpha)
    this.sky.scene.tweens.killTweensOf(this.flash)
    this.sky.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 320, ease: 'Quad.easeOut' })
  }

  destroy(): void {
    this.sky.destroy()
    this.deco.forEach((image) => image.destroy())
    this.vignette.destroy()
    this.flash.destroy()
  }
}
