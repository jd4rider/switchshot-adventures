import Phaser from 'phaser'
import { CSS, GAME_HEIGHT, GAME_WIDTH } from '../config'
import { audio } from '../core/audio'
import { reconcileProgress, unlockedSkinIds } from '../core/progress'
import { loadSave, saveSkin } from '../core/save'
import { ACHIEVEMENTS } from '../data/achievements'
import { BLASTER_SKINS } from '../data/blasters'
import { completedLevels, totalStars } from '../data/levels'
import { Backdrop } from '../world/Backdrop'
import { backButton, formatScore, pageTitle, panel } from '../ui/common'

export class AchievementScene extends Phaser.Scene {
  private selectedSkin = 'classic'

  constructor() {
    super('Achievements')
  }

  create(): void {
    const save = reconcileProgress().save
    this.selectedSkin = save.blasterSkin
    audio.setMood('menu')
    new Backdrop(this, 2, save.settings.reducedMotion)
    pageTitle(this, 'Little Joy Arcade', 'Trophies & Statistics', `${save.achievements.length}/${ACHIEVEMENTS.length} trophies earned`)

    panel(this, 48, 116, GAME_WIDTH - 96, 116, 0x6ff2c8, 0.9, 12)
    const accuracy = save.stats.shots > 0 ? Math.round((save.stats.shotsHit / save.stats.shots) * 100) : 0
    const stats: Array<[string, string]> = [
      ['LEVELS', `${completedLevels(save)}/500`],
      ['STARS', `${totalStars(save)}`],
      ['GEMS', `${save.stats.gems}`],
      ['ACCURACY', `${accuracy}%`],
      ['RICOCHETS', `${save.stats.ricochets}`],
      ['ENDLESS', `FLOOR ${save.modes.endlessBestHeight}`],
    ]
    stats.forEach(([label, value], index) => {
      const col = index % 3
      const row = Math.floor(index / 3)
      const x = 76 + col * 200
      const y = 136 + row * 46
      this.add.text(x, y, label, { fontFamily: '"Avenir Next", sans-serif', fontSize: '8px', fontStyle: 'bold', color: 'rgba(255,246,226,0.45)', letterSpacing: 1.2 })
      this.add.text(x, y + 12, value, { fontFamily: '"Avenir Next", sans-serif', fontSize: '15px', fontStyle: 'bold', color: CSS.cream })
    })

    ACHIEVEMENTS.forEach((achievement, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const x = 56 + col * 314
      const y = 252 + row * 46
      const unlocked = save.achievements.includes(achievement.id)
      this.add.text(x, y, achievement.glyph, { fontFamily: 'sans-serif', fontSize: '16px', color: unlocked ? CSS.gold : 'rgba(255,246,226,0.2)' })
      this.add.text(x + 26, y, achievement.name, { fontFamily: '"Avenir Next", sans-serif', fontSize: '10px', fontStyle: 'bold', color: unlocked ? CSS.cream : 'rgba(255,246,226,0.3)' })
      this.add.text(x + 26, y + 14, achievement.description, { fontFamily: '"Avenir Next", sans-serif', fontSize: '8px', color: unlocked ? 'rgba(255,246,226,0.5)' : 'rgba(255,246,226,0.22)', wordWrap: { width: 270 } })
    })

    this.add
      .text(GAME_WIDTH / 2, 776, 'BLASTER SKINS', {
        fontFamily: '"Avenir Next", sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: CSS.mint,
        letterSpacing: 3,
      })
      .setOrigin(0.5)
    const owned = new Set(unlockedSkinIds(save))
    BLASTER_SKINS.forEach((skin, index) => {
      const x = 74 + index * 116
      const y = 818
      const available = owned.has(skin.id)
      const graphics = this.add.graphics().setDepth(12)
      graphics.fillStyle(0x110c22, available ? 0.94 : 0.5)
      graphics.fillRoundedRect(x, y, 104, 70, 12)
      graphics.fillStyle(skin.tint, available ? 0.15 : 0.04)
      graphics.fillRoundedRect(x, y, 104, 70, 12)
      graphics.lineStyle(1.5, available ? (this.selectedSkin === skin.id ? 0xffffff : skin.tint) : 0x5a526e, available ? 0.8 : 0.3)
      graphics.strokeRoundedRect(x, y, 104, 70, 12)
      this.add.image(x + 52, y + 24, 'shot-pulse').setTint(skin.tint).setScale(1.2).setDepth(13)
      this.add.text(x + 52, y + 46, skin.name.split(' ')[0].toUpperCase(), { fontFamily: '"Avenir Next", sans-serif', fontSize: '8px', fontStyle: 'bold', color: available ? CSS.cream : 'rgba(255,246,226,0.3)' }).setOrigin(0.5).setDepth(13)
      this.add.text(x + 52, y + 58, available ? (this.selectedSkin === skin.id ? 'EQUIPPED' : 'SELECT') : `${skin.unlockStars} ★`, { fontFamily: '"Avenir Next", sans-serif', fontSize: '7px', fontStyle: 'bold', color: available ? CSS.mint : 'rgba(255,246,226,0.32)' }).setOrigin(0.5).setDepth(13)
      if (available) {
        const hit = this.add.rectangle(x + 52, y + 35, 104, 70, 0xffffff, 0.001).setInteractive({ useHandCursor: true }).setDepth(14)
        hit.on('pointerdown', () => {
          this.selectedSkin = skin.id
          saveSkin(skin.id)
          audio.sfx('click')
          this.scene.restart()
        })
      }
    })

    this.add
      .text(GAME_WIDTH / 2, 918, `${save.stats.shots} SHOTS FIRED  ·  ${save.stats.enemiesDefeated} MACHINES DEFEATED  ·  ${formatScore(save.stats.timePlayedMs / 1000)} SECONDS PLAYED`, {
        fontFamily: '"Avenir Next", sans-serif',
        fontSize: '9px',
        color: 'rgba(255,246,226,0.42)',
        letterSpacing: 0.8,
        align: 'center',
        wordWrap: { width: 600 },
      })
      .setOrigin(0.5)

    this.add
      .text(GAME_WIDTH / 2, 960, 'Trophies are evaluated from real play and saved with your progress.\nThe arcade client syncs the save when you are signed in.', {
        fontFamily: '"Avenir Next", sans-serif',
        fontSize: '9px',
        color: 'rgba(255,246,226,0.38)',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5)

    backButton(this, () => {
      audio.sfx('back')
      this.scene.start('Menu')
    }, GAME_HEIGHT - 48).setDepth(30)
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Menu'))
  }
}
