import Phaser from 'phaser'
import { COLORS } from '../config'
import { worldAt } from '../data/worlds'
import type { CrateSpec, GameplaySettings, HatchSpec, LevelData, MirrorSpec, MovingPlatformSpec, PlatformSpec, PlateSpec, SeedSpec, SwitchSpec } from '../types'

interface MovingPlatform {
  spec: MovingPlatformSpec
  rect: Phaser.GameObjects.Rectangle
  body: Phaser.Physics.Arcade.StaticBody
  visual: Phaser.GameObjects.Graphics
  previousX: number
  previousY: number
}

interface SwitchView {
  spec: SwitchSpec
  base: Phaser.Physics.Arcade.Image
  core: Phaser.GameObjects.Image
  ring: Phaser.GameObjects.Arc
  active: boolean
}

interface HatchView {
  spec: HatchSpec
  rect: Phaser.GameObjects.Rectangle
  body: Phaser.Physics.Arcade.StaticBody
  visual: Phaser.GameObjects.Graphics
  open: boolean
  closeAt: number
}

interface PlateView {
  spec: PlateSpec
  rect: Phaser.GameObjects.Rectangle
  visual: Phaser.GameObjects.Graphics
  active: boolean
}

interface SeedView {
  spec: SeedSpec
  seed: Phaser.Physics.Arcade.Image
  platform: Phaser.GameObjects.Rectangle
  platformBody: Phaser.Physics.Arcade.StaticBody
  vine: Phaser.GameObjects.Graphics
  grown: boolean
}

function colorFrom(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color
}

function shade(hex: string, amount: number): number {
  const color = Phaser.Display.Color.HexStringToColor(hex)
  return Phaser.Display.Color.GetColor(
    Math.max(0, Math.min(255, color.red + amount)),
    Math.max(0, Math.min(255, color.green + amount)),
    Math.max(0, Math.min(255, color.blue + amount)),
  )
}

export class LevelView {
  readonly level: LevelData
  readonly solids: Phaser.Physics.Arcade.StaticGroup
  readonly movingGroup: Phaser.Physics.Arcade.StaticGroup
  readonly gems: Phaser.Physics.Arcade.Group
  readonly switches: Phaser.Physics.Arcade.StaticGroup
  readonly mirrors: Phaser.Physics.Arcade.StaticGroup
  readonly crates: Phaser.Physics.Arcade.Group
  readonly plates: Phaser.Physics.Arcade.StaticGroup
  readonly seeds: Phaser.Physics.Arcade.StaticGroup
  readonly grown: Phaser.Physics.Arcade.StaticGroup
  readonly checkpoints: Phaser.Physics.Arcade.StaticGroup
  readonly hatches: Phaser.Physics.Arcade.StaticGroup
  readonly exitZone: Phaser.GameObjects.Zone
  private readonly scene: Phaser.Scene
  private readonly settings: GameplaySettings
  private readonly moving: MovingPlatform[] = []
  private readonly switchViews = new Map<string, SwitchView>()
  private readonly hatchViews = new Map<string, HatchView>()
  private readonly mirrorViews = new Map<string, { spec: MirrorSpec; body: Phaser.Physics.Arcade.StaticBody }>()
  private readonly plateViews = new Map<string, PlateView>()
  private readonly seedViews = new Map<string, SeedView>()
  private readonly checkpointVisuals: Phaser.GameObjects.Graphics[] = []
  private readonly portal: Phaser.GameObjects.Container
  private exitReady = false
  private activatedCheckpoints = 0
  private time = 0
  private readonly palette: ReturnType<typeof worldAt>['palette']

  constructor(scene: Phaser.Scene, level: LevelData, settings: GameplaySettings) {
    this.scene = scene
    this.level = level
    this.settings = settings
    this.palette = worldAt(level.worldIndex).palette
    this.solids = scene.physics.add.staticGroup()
    this.movingGroup = scene.physics.add.staticGroup()
    this.gems = scene.physics.add.group({ allowGravity: false, immovable: true })
    this.switches = scene.physics.add.staticGroup()
    this.mirrors = scene.physics.add.staticGroup()
    this.crates = scene.physics.add.group({ allowGravity: true })
    this.plates = scene.physics.add.staticGroup()
    this.seeds = scene.physics.add.staticGroup()
    this.grown = scene.physics.add.staticGroup()
    this.checkpoints = scene.physics.add.staticGroup()
    this.hatches = scene.physics.add.staticGroup()

    this.drawPlatforms()
    this.buildHatches()
    this.buildSwitches()
    this.buildMirrors()
    this.buildCrates()
    this.buildPlates()
    this.buildSeeds()
    this.buildGems()
    this.buildMovingPlatforms()
    this.buildCheckpoints()
    this.exitZone = scene.add.zone(level.exit.x, level.exit.y - 16, 96, 180).setOrigin(0.5)
    scene.physics.add.existing(this.exitZone, true)
    this.portal = this.buildPortal()
    void this.settings
  }

  private drawPlatforms(): void {
    const graphics = this.scene.add.graphics().setDepth(2)
    const palette = this.palette
    for (const platform of this.level.platforms) {
      const { x, y, width, height, kind } = platform
      const prop = platform.role === 'prop'
      const top = kind === 'bounce' ? colorFrom(palette.accentTwo) : colorFrom(palette.platformTop)
      const bodyColor = kind === 'bounce' ? shade(palette.platform, -24) : colorFrom(palette.platform)
      const rim = shade(palette.platform, -52)
      graphics.fillStyle(rim, 0.9)
      graphics.fillRoundedRect(x, y, width, height, { tl: 7, tr: 7, bl: 5, br: 5 })
      graphics.fillStyle(bodyColor, 1)
      graphics.fillRoundedRect(x + 2, y + 2, width - 4, Math.max(4, height - 4), { tl: 6, tr: 6, bl: 4, br: 4 })
      graphics.fillStyle(top, 1)
      graphics.fillRoundedRect(x, y, width, Math.min(9, height), { tl: 7, tr: 7, bl: 0, br: 0 })
      graphics.fillStyle(0xffffff, 0.16)
      graphics.fillRect(x + 6, y + 3, Math.max(0, width - 12), 2)
      if (!prop && width > 80) {
        graphics.fillStyle(shade(palette.platform, -30), 0.8)
        for (let bolt = x + 16; bolt < x + width - 10; bolt += 34) {
          graphics.fillCircle(bolt, y + height - 7, 2)
        }
      }
      if (kind === 'bounce') {
        graphics.fillStyle(colorFrom(palette.accent), 0.9)
        graphics.fillRoundedRect(x + 8, y + 4, width - 16, 5, 3)
      }
      const rect = this.scene.add.rectangle(x + width / 2, y + height / 2, width, height, 0xffffff, 0)
      this.scene.physics.add.existing(rect, true)
      rect.setVisible(false)
      this.solids.add(rect)
      ;(rect.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject()
    }
  }

  private buildHatches(): void {
    for (const hatch of this.level.hatches) {
      const rect = this.scene.add.rectangle(hatch.x + hatch.width / 2, hatch.y + hatch.height / 2, hatch.width, hatch.height, 0xffffff, 0)
      this.scene.physics.add.existing(rect, true)
      rect.setVisible(false)
      this.hatches.add(rect)
      const visual = this.scene.add.graphics().setDepth(8)
      this.drawHatch(visual, hatch)
      this.hatchViews.set(hatch.id, {
        spec: hatch,
        rect,
        body: rect.body as Phaser.Physics.Arcade.StaticBody,
        visual,
        open: false,
        closeAt: 0,
      })
    }
  }

  private drawHatch(graphics: Phaser.GameObjects.Graphics, hatch: HatchSpec): void {
    graphics.clear()
    const x = hatch.x
    const y = hatch.y
    const accent = colorFrom(this.palette.accent)
    graphics.fillStyle(0x1d1730, 0.96)
    graphics.fillRoundedRect(x, y, hatch.width, hatch.height, 5)
    graphics.lineStyle(2, accent, 0.9)
    graphics.strokeRoundedRect(x + 1, y + 1, hatch.width - 2, hatch.height - 2, 5)
    for (let bar = 0; bar < 5; bar += 1) {
      const bx = x + 14 + bar * ((hatch.width - 28) / 4)
      graphics.fillStyle(shade(this.palette.platformTop, 30), 0.95)
      graphics.fillRoundedRect(bx, y + 4, 12, hatch.height - 8, 3)
    }
    graphics.fillStyle(accent, 0.95)
    graphics.fillCircle(x + hatch.width / 2, y + hatch.height / 2, 4)
  }

  private buildSwitches(): void {
    for (const spec of this.level.switches) {
      const base = this.switches.create(spec.x, spec.y, 'switch-base') as Phaser.Physics.Arcade.Image
      base.setDepth(12)
      base.setTint(spec.accent)
      base.setData('switchId', spec.id)
      const body = base.body as Phaser.Physics.Arcade.StaticBody
      body.setSize(52, 52)
      body.updateFromGameObject()
      const core = this.scene.add.image(spec.x, spec.y, 'switch-core').setTint(spec.accent).setDepth(13).setScale(0.9)
      const ring = this.scene.add.circle(spec.x, spec.y, 20).setStrokeStyle(2, spec.accent, 0.5).setDepth(13)
      this.scene.tweens.add({
        targets: ring,
        scale: 1.5,
        alpha: 0,
        duration: 1700,
        repeat: -1,
        ease: 'Sine.easeOut',
      })
      if (spec.order) {
        this.scene.add
          .text(spec.x, spec.y + 38, String(spec.order), {
            fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
            fontSize: '15px',
            fontStyle: 'bold',
            color: '#fff6e2',
            stroke: '#171032',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(14)
      }
      this.switchViews.set(spec.id, { spec, base, core, ring, active: false })
    }
  }

  private buildMirrors(): void {
    for (const mirror of this.level.mirrors) {
      const body = this.mirrors.create(mirror.x, mirror.y, 'mirror-a') as Phaser.Physics.Arcade.Image
      body.setVisible(false)
      body.setAlpha(0)
      body.setData('mirrorId', mirror.id)
      const staticBody = body.body as Phaser.Physics.Arcade.StaticBody
      staticBody.setSize(mirror.width, mirror.height)
      staticBody.updateFromGameObject()
      const visual = this.scene.add
        .image(mirror.x, mirror.y, mirror.orientation === '/' ? 'mirror-a' : 'mirror-b')
        .setDepth(13)
      this.scene.tweens.add({
        targets: visual,
        alpha: 0.72,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
      this.mirrorViews.set(mirror.id, { spec: mirror, body: staticBody })
    }
  }

  private buildCrates(): void {
    for (const spec of this.level.crates as CrateSpec[]) {
      const image = this.crates.create(spec.x + spec.width / 2, spec.y + spec.height / 2, 'crate') as Phaser.Physics.Arcade.Image
      image.setDepth(14)
      image.setDragX(420)
      image.setBounce(0.05, 0)
      image.setCollideWorldBounds(true)
      const body = image.body as Phaser.Physics.Arcade.Body
      body.setSize(spec.width, spec.height)
      body.setMaxVelocity(560, 900)
      image.setData('specId', spec.id)
    }
  }

  private buildPlates(): void {
    for (const spec of this.level.plates) {
      const rect = this.scene.add.rectangle(spec.x + spec.width / 2, spec.y + spec.height / 2, spec.width, spec.height, 0xffffff, 0)
      this.scene.physics.add.existing(rect, true)
      rect.setVisible(false)
      rect.setData('plateId', spec.id)
      this.plates.add(rect)
      const visual = this.scene.add.graphics().setDepth(7)
      this.drawPlate(visual, spec, false)
      this.plateViews.set(spec.id, { spec, rect, visual, active: false })
    }
  }

  private drawPlate(graphics: Phaser.GameObjects.Graphics, plate: PlateSpec, active: boolean): void {
    graphics.clear()
    const color = active ? colorFrom(this.palette.accentTwo) : colorFrom(this.palette.accent)
    graphics.fillStyle(0x1d1730, 0.9)
    graphics.fillRoundedRect(plate.x, plate.y, plate.width, plate.height, 5)
    graphics.lineStyle(2, color, active ? 1 : 0.6)
    graphics.strokeRoundedRect(plate.x, plate.y, plate.width, plate.height, 5)
    graphics.fillStyle(color, active ? 1 : 0.5)
    graphics.fillRoundedRect(plate.x + 8, plate.y + 4, plate.width - 16, 4, 2)
  }

  private buildSeeds(): void {
    for (const spec of this.level.seeds) {
      const seed = this.seeds.create(spec.x, spec.y, 'seed') as Phaser.Physics.Arcade.Image
      seed.setDepth(14)
      seed.setData('seedId', spec.id)
      const body = seed.body as Phaser.Physics.Arcade.StaticBody
      body.setSize(38, 44)
      body.updateFromGameObject()
      const platform = this.scene.add
        .rectangle(spec.platform.x + spec.platform.width / 2, spec.platform.y + spec.platform.height / 2, spec.platform.width, spec.platform.height, 0xffffff, 0)
        .setVisible(false)
      this.scene.physics.add.existing(platform, true)
      const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody
      platformBody.enable = false
      this.grown.add(platform)
      const vine = this.scene.add.graphics().setDepth(6).setVisible(false)
      this.seedViews.set(spec.id, { spec, seed, platform, platformBody, vine, grown: false })
    }
  }

  private buildGems(): void {
    for (const gem of this.level.gems) {
      const key = gem.optional ? 'gem-optional' : `gem-${gem.variant % 3}`
      const image = this.gems.create(gem.x, gem.y, key) as Phaser.Physics.Arcade.Image
      image.setDepth(15)
      image.setData('optional', gem.optional)
      const body = image.body as Phaser.Physics.Arcade.Body
      body.setAllowGravity(false)
      body.setCircle(19, 3, 3)
      if (!this.settings.reducedMotion) {
        this.scene.tweens.add({
          targets: image,
          angle: gem.optional ? -8 : 8,
          duration: 2100 + (gem.y % 500),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }
    }
  }

  private buildMovingPlatforms(): void {
    for (const spec of this.level.movingPlatforms) {
      const x = spec.x + spec.width / 2
      const y = spec.y + spec.height / 2
      const rect = this.scene.add.rectangle(x, y, spec.width, spec.height, 0xffffff, 0)
      this.scene.physics.add.existing(rect, true)
      rect.setVisible(false)
      this.movingGroup.add(rect)
      const visual = this.scene.add.graphics().setDepth(3)
      this.drawMovingPlatform(visual, spec, x, y)
      this.moving.push({
        spec,
        rect,
        body: rect.body as Phaser.Physics.Arcade.StaticBody,
        visual,
        previousX: x,
        previousY: y,
      })
    }
  }

  private drawMovingPlatform(graphics: Phaser.GameObjects.Graphics, spec: MovingPlatformSpec, x: number, y: number): void {
    graphics.clear()
    const color = colorFrom(this.palette.platformTop)
    graphics.fillStyle(colorFrom(this.palette.platform), 1)
    graphics.fillRoundedRect(x - spec.width / 2, y - spec.height / 2, spec.width, spec.height, 6)
    graphics.fillStyle(color, 1)
    graphics.fillRoundedRect(x - spec.width / 2, y - spec.height / 2, spec.width, 7, { tl: 6, tr: 6, bl: 0, br: 0 })
    graphics.fillStyle(0xffffff, 0.28)
    graphics.fillRect(x - spec.width / 2 + 10, y - 2, spec.width - 20, 2)
    graphics.fillStyle(colorFrom(this.palette.accent), 0.9)
    graphics.fillCircle(x - spec.width / 2 + 9, y + 1, 3)
    graphics.fillCircle(x + spec.width / 2 - 9, y + 1, 3)
  }

  private buildCheckpoints(): void {
    this.level.checkpoints.forEach((checkpoint, index) => {
      const zone = this.checkpoints.create(checkpoint.x, checkpoint.y, 'fx-dot') as Phaser.Physics.Arcade.Image
      zone.setVisible(false)
      zone.setData('checkpointIndex', index)
      const body = zone.body as Phaser.Physics.Arcade.StaticBody
      body.setSize(54, 110)
      body.updateFromGameObject()
      const graphics = this.scene.add.graphics().setDepth(8)
      graphics.fillStyle(0x2a2144, 0.9)
      graphics.fillRoundedRect(checkpoint.x - 4, checkpoint.y - 52, 8, 60, 3)
      graphics.lineStyle(2, COLORS.muted, 0.6)
      graphics.strokeRoundedRect(checkpoint.x - 4, checkpoint.y - 52, 8, 60, 3)
      graphics.fillStyle(0x8f7bb5, 0.85)
      graphics.fillRoundedRect(checkpoint.x + 4, checkpoint.y - 50, 26, 16, 4)
      this.checkpointVisuals.push(graphics)
    })
  }

  private buildPortal(): Phaser.GameObjects.Container {
    const glowCircle = this.scene.add.circle(0, 0, 66, colorFrom(this.palette.accent), 0.16)
    const portal = this.scene.add.image(0, 0, 'portal').setDisplaySize(112, 160)
    const label = this.scene.add
      .text(0, 92, 'EXIT', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fff6e2',
        letterSpacing: 3,
      })
      .setOrigin(0.5)
    const container = this.scene.add.container(this.level.exit.x, this.level.exit.y - 34, [glowCircle, portal, label]).setDepth(6)
    portal.setAlpha(0.34)
    label.setAlpha(0.5)
    if (!this.settings.reducedMotion) {
      this.scene.tweens.add({ targets: portal, angle: 4, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.scene.tweens.add({ targets: glowCircle, scale: 1.15, alpha: 0.28, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    return container
  }

  setExitReady(ready: boolean): void {
    if (this.exitReady === ready) return
    this.exitReady = ready
    const portal = this.portal.getAt(1) as Phaser.GameObjects.Image
    const label = this.portal.getAt(2) as Phaser.GameObjects.Text
    if (ready) {
      this.scene.tweens.add({ targets: portal, alpha: 1, scaleX: 1.08, scaleY: 1.08, duration: 300, yoyo: true })
      label.setAlpha(1)
    } else {
      portal.setAlpha(0.34)
      label.setAlpha(0.5)
    }
  }

  activateSwitch(id: string): void {
    const view = this.switchViews.get(id)
    if (!view || view.active) return
    view.active = true
    view.core.setTint(0xffffff)
    view.base.setTint(0xffffff)
    view.ring.setStrokeStyle(3, 0xffffff, 0.95)
    this.scene.tweens.add({ targets: [view.core, view.base], scale: 1.18, duration: 110, yoyo: true })
  }

  resetSwitch(id: string): void {
    const view = this.switchViews.get(id)
    if (!view) return
    view.active = false
    view.core.setTint(view.spec.accent)
    view.base.setTint(view.spec.accent)
    view.ring.setStrokeStyle(2, view.spec.accent, 0.5)
  }

  isSwitchActive(id: string): boolean {
    return this.switchViews.get(id)?.active ?? false
  }

  switchView(id: string): SwitchView | undefined {
    return this.switchViews.get(id)
  }

  hatchForSwitch(id: string): HatchSpec | null {
    return this.level.hatches.find((hatch) => hatch.switchIds.includes(id)) ?? null
  }

  hatch(id: string): HatchView | undefined {
    return this.hatchViews.get(id)
  }

  isHatchOpen(id: string): boolean {
    return this.hatchViews.get(id)?.open ?? false
  }

  openHatch(id: string, durationMs = 0): void {
    const view = this.hatchViews.get(id)
    if (!view || view.open) return
    view.open = true
    view.body.enable = false
    view.closeAt = durationMs > 0 ? this.time + durationMs : 0
    this.scene.tweens.add({ targets: view.visual, alpha: 0.18, duration: 260, ease: 'Quad.easeOut' })
    if (!this.settings.reducedMotion) {
      this.scene.tweens.add({ targets: view.visual, scaleY: 0.4, duration: 260, yoyo: true, ease: 'Quad.easeOut' })
    }
  }

  closeHatch(id: string): void {
    const view = this.hatchViews.get(id)
    if (!view || !view.open) return
    view.open = false
    view.closeAt = 0
    view.body.enable = true
    view.visual.setAlpha(1)
    view.visual.setScale(1)
  }

  growSeed(id: string): void {
    const view = this.seedViews.get(id)
    if (!view || view.grown) return
    view.grown = true
    view.seed.disableBody(true, true)
    view.platform.setVisible(true)
    view.platformBody.enable = true
    view.vine.setVisible(true)
    const x = view.spec.platform.x + view.spec.platform.width / 2
    const y = view.spec.platform.y + view.spec.platform.height / 2
    view.vine.clear()
    view.vine.fillStyle(colorFrom(this.palette.accentTwo), 1)
    view.vine.fillRoundedRect(view.spec.platform.x, view.spec.platform.y, view.spec.platform.width, view.spec.platform.height, 8)
    view.vine.fillStyle(0x3f8a63, 1)
    for (let leaf = 0; leaf < 5; leaf += 1) {
      view.vine.fillEllipse(view.spec.platform.x + 18 + leaf * ((view.spec.platform.width - 36) / 4), view.spec.platform.y + 4, 22, 9)
    }
    this.scene.tweens.add({ targets: view.vine, scaleY: { from: 0.2, to: 1 }, alpha: { from: 0.3, to: 1 }, duration: 520, ease: 'Back.easeOut' })
    this.scene.tweens.add({ targets: view.platform, scaleY: { from: 0.2, to: 1 }, duration: 520, ease: 'Back.easeOut' })
    void x
    void y
  }

  isSeedGrown(id: string): boolean {
    return this.seedViews.get(id)?.grown ?? false
  }

  activatePlate(id: string): void {
    const view = this.plateViews.get(id)
    if (!view || view.active) return
    view.active = true
    this.drawPlate(view.visual, view.spec, true)
    this.scene.tweens.add({ targets: view.visual, alpha: 0.75, duration: 180, yoyo: true })
  }

  plateForHatch(hatchId: string): PlateSpec | null {
    return this.level.plates.find((plate) => plate.hatchId === hatchId) ?? null
  }

  plateView(id: string): PlateView | undefined {
    return this.plateViews.get(id)
  }

  activateCheckpoint(index: number): boolean {
    if (index < this.activatedCheckpoints) return false
    this.activatedCheckpoints = index + 1
    const graphics = this.checkpointVisuals[index]
    if (graphics) {
      graphics.clear()
      const checkpoint = this.level.checkpoints[index]
      graphics.fillStyle(0x2a2144, 0.9)
      graphics.fillRoundedRect(checkpoint.x - 4, checkpoint.y - 52, 8, 60, 3)
      graphics.fillStyle(colorFrom(this.palette.accentTwo), 1)
      graphics.fillRoundedRect(checkpoint.x + 4, checkpoint.y - 50, 26, 16, 4)
      graphics.fillStyle(0xffffff, 0.9)
      graphics.fillCircle(checkpoint.x + 17, checkpoint.y - 42, 4)
    }
    return true
  }

  get checkpointCount(): number {
    return this.activatedCheckpoints
  }

  update(time: number, deltaMs: number): void {
    this.time = time
    const seconds = time / 1000
    for (const platform of this.moving) {
      const { spec, rect, body, previousX, previousY } = platform
      const travel = Math.max(24, spec.distance / 2)
      const omega = spec.speed / travel
      const offset = Math.sin(seconds * omega + spec.phase * Math.PI * 2) * travel
      const centerX = spec.x + spec.width / 2 + (spec.axis === 'x' ? offset : 0)
      const centerY = spec.y + spec.height / 2 + (spec.axis === 'y' ? offset : 0)
      rect.setPosition(centerX, centerY)
      body.updateFromGameObject()
      const dx = centerX - previousX
      const dy = centerY - previousY
      platform.previousX = centerX
      platform.previousY = centerY
      ;(platform as MovingPlatform & { deltaX?: number; deltaY?: number }).deltaX = dx
      ;(platform as MovingPlatform & { deltaX?: number; deltaY?: number }).deltaY = dy
      this.drawMovingPlatform(platform.visual, spec, centerX, centerY)
    }
    for (const view of this.hatchViews.values()) {
      if (view.open && view.closeAt > 0 && time >= view.closeAt) this.closeHatch(view.spec.id)
    }
    for (const view of this.switchViews.values()) {
      if (!view.active) view.core.setScale(0.88 + Math.sin(seconds * 3 + view.spec.x) * 0.05)
    }
    void deltaMs
  }

  /** Total displacement of every moving platform the player is standing on. */
  rideDelta(feetY: number, left: number, right: number): { x: number; y: number } {
    let dx = 0
    let dy = 0
    for (const platform of this.moving) {
      const top = platform.rect.y - platform.spec.height / 2
      if (Math.abs(top - feetY) > 12) continue
      if (right < platform.rect.x - platform.spec.width / 2 || left > platform.rect.x + platform.spec.width / 2) continue
      const record = platform as MovingPlatform & { deltaX?: number; deltaY?: number }
      dx += record.deltaX ?? 0
      dy += record.deltaY ?? 0
    }
    return { x: dx, y: dy }
  }

  platformAtFeet(x: number, feetY: number, tolerance = 12): PlatformSpec | null {
    for (const platform of this.level.platforms) {
      if (x < platform.x - 4 || x > platform.x + platform.width + 4) continue
      if (Math.abs(platform.y - feetY) <= tolerance) return platform
    }
    return null
  }

  destroy(): void {
    // Scene shutdown clears the display list and every tween created here.
  }
}
