import Phaser from 'phaser'
import { VERSION } from '../config'
import { audio } from '../core/audio'
import { loadSave } from '../core/save'
import { ensureCoreTextures } from '../world/textures'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    ensureCoreTextures(this)
    const save = loadSave()
    audio.setSettings(save.settings)
    this.add
      .text(360, 640, 'SWITCHSHOT', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '38px',
        fontStyle: 'bold',
        color: '#fff6e2',
      })
      .setOrigin(0.5)
    this.cameras.main.fadeIn(220, 8, 6, 15)
    this.time.delayedCall(120, () => this.scene.start('Menu'))
    this.game.registry.set('version', VERSION)
  }
}
