import Phaser from 'phaser'
import {
  CAMERA,
  CSS,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER,
  SAFE_TOP,
  SHOT,
  TUNING,
} from '../config'
import { audio } from '../core/audio'
import { reconcileProgress } from '../core/progress'
import { loadSave, recordLevelResult } from '../core/save'
import { BLASTER_BY_ID } from '../data/blasters'
import { CHALLENGES, CHALLENGE_BY_ID } from '../data/challenges'
import {
  ALL_LEVELS,
  availableModesFor,
  dailyDate,
  dailyMeta,
  getLevelMeta,
  levelId,
  nextLevelId,
  type LevelMeta,
} from '../data/levels'
import { worldAt } from '../data/worlds'
import { floorYFor, generateLevel } from '../generator/level'
import { assistedTarget, scoreForRun, starsFor } from '../player/movement'
import { PipView } from '../player/PipView'
import { Player } from '../player/Player'
import type {
  BlasterMode,
  ChallengeDefinition,
  LevelData,
  LevelResult,
  PlayMode,
  PlayerIntent,
  ResultsData,
  StarCount,
} from '../types'
import { Hud } from '../ui/Hud'
import { isTouchDevice, TouchControls } from '../ui/TouchControls'
import { UiButton, formatMs, panel } from '../ui/common'
import { skinTint } from '../weapons/skin'
import { ShotSystem } from '../weapons/shots'
import { Backdrop } from '../world/Backdrop'
import { EnemySystem } from '../world/Enemies'
import { LevelView } from '../world/LevelView'

interface GameData {
  levelId?: string
  mode?: PlayMode
  stage?: number
  dailyDate?: string
  challengeId?: string
  runScore?: number
  runHealth?: number
  runDeaths?: number
}

interface Keys {
  left: Phaser.Input.Keyboard.Key
  right: Phaser.Input.Keyboard.Key
  a: Phaser.Input.Keyboard.Key
  d: Phaser.Input.Keyboard.Key
  jump: Phaser.Input.Keyboard.Key
  up: Phaser.Input.Keyboard.Key
  w: Phaser.Input.Keyboard.Key
  escape: Phaser.Input.Keyboard.Key
  restart: Phaser.Input.Keyboard.Key
  one: Phaser.Input.Keyboard.Key
  two: Phaser.Input.Keyboard.Key
  three: Phaser.Input.Keyboard.Key
  four: Phaser.Input.Keyboard.Key
}

export class GameScene extends Phaser.Scene {
  private sceneData: GameData = {}
  private mode: PlayMode = 'journey'
  private level!: LevelData
  private meta!: LevelMeta
  private challenge: ChallengeDefinition | null = null
  private dailyKey = ''
  private player!: Player
  private pip!: PipView
  private levelView!: LevelView
  private enemySystem!: EnemySystem
  private shots!: ShotSystem
  private backdrop!: Backdrop
  private hud!: Hud
  private touch!: TouchControls
  private keys!: Keys
  private currentMode: BlasterMode = 'pulse'
  private unlockedModes: BlasterMode[] = ['pulse']
  private score = 0
  private health: number = PLAYER.maxHealth
  private gemsCollected = 0
  private optionalCollected = 0
  private shotsFired = 0
  private shotsHit = 0
  private ricochets = 0
  private enemiesDefeated = 0
  private switchesHit = 0
  private deaths = 0
  private damageTaken = false
  private startedAt = 0
  private runElapsed = 0
  private paused = false
  private finishing = false
  private finished = false
  private pauseLayer?: Phaser.GameObjects.Container
  private introLayer?: Phaser.GameObjects.Container
  private nextShotAt = 0
  private aimX = 0
  private aimY = 0
  private pipFiringUntil = 0
  private checkpoint = { x: 0, y: 0 }
  private bossSprite?: Phaser.GameObjects.Image
  private bossWeakGroup?: Phaser.Physics.Arcade.StaticGroup
  private bossStage = 0
  private bossDefeated = false
  private bossNextShotAt = 0
  private bossWeakCores: Phaser.GameObjects.Image[] = []
  private stage = 0
  private runScore = 0
  private runHealth: number = PLAYER.maxHealth
  private runDeaths = 0
  private lastSafe = { x: 0, y: 0 }
  private challengeFailed = ''
  private trailHintAt = 0

  constructor() {
    super('Game')
  }

  init(data: GameData): void {
    this.sceneData = { ...data }
    this.mode = data.mode ?? 'journey'
    this.stage = data.stage ?? 0
    this.runScore = data.runScore ?? 0
    this.runHealth = data.runHealth ?? PLAYER.maxHealth
    this.runDeaths = data.runDeaths ?? 0
    this.dailyKey = data.dailyDate ?? dailyDate()
    this.challenge = data.challengeId ? CHALLENGE_BY_ID.get(data.challengeId) ?? null : null
  }

  create(): void {
    const save = loadSave()
    const meta = this.resolveMeta()
    if (!meta) {
      this.scene.start('Menu')
      return
    }
    this.meta = meta
    this.bossStage = 0
    this.bossDefeated = false
    this.bossSprite = undefined
    this.bossWeakCores = []
    this.bossWeakGroup = undefined
    this.score = this.mode === 'endless' ? this.runScore : 0
    this.health = this.mode === 'endless' ? Phaser.Math.Clamp(this.runHealth, 1, PLAYER.maxHealth) : PLAYER.maxHealth
    this.deaths = this.mode === 'endless' ? this.runDeaths : 0
    this.gemsCollected = 0
    this.optionalCollected = 0
    this.shotsFired = 0
    this.shotsHit = 0
    this.ricochets = 0
    this.enemiesDefeated = 0
    this.switchesHit = 0
    this.damageTaken = false
    this.finishing = false
    this.finished = false
    this.paused = false
    this.challengeFailed = ''
    this.runElapsed = 0
    this.startedAt = performance.now()

    this.level = generateLevel(this.meta, {
      mode: this.mode,
      stage: this.mode === 'endless' ? this.stage : undefined,
      seedSalt: this.mode === 'daily' ? this.dailyKey.length * 7919 : undefined,
    })
    this.level.id = this.mode === 'endless' ? `endless-${this.stage + 1}` : this.meta.id
    this.unlockedModes = this.mode === 'endless'
      ? this.level.availableModes
      : availableModesFor(save, this.meta.worldIndex).filter((mode) => this.level.availableModes.includes(mode))
    if (this.unlockedModes.length === 0) this.unlockedModes = ['pulse']
    if (!this.unlockedModes.includes(this.currentMode)) this.currentMode = 'pulse'

    const world = worldAt(this.level.worldIndex)
    this.cameras.main.setBackgroundColor(world.palette.skyTop)
    this.physics.world.setBounds(0, 0, this.level.width, this.level.height + 200)
    this.physics.world.gravity.y = TUNING.gravity
    this.cameras.main.setBounds(0, 0, this.level.width, this.level.height)
    this.cameras.main.fadeIn(save.settings.reducedMotion ? 0 : 240, 0, 0, 0)

    this.backdrop = new Backdrop(this, this.level.worldIndex, save.settings.reducedMotion)
    this.levelView = new LevelView(this, this.level, save.settings)
    this.levelView.setExitReady(this.exitIsReady())
    this.player = new Player(this, this.level.start.x, this.level.start.y)
    this.pip = new PipView(this, 22)
    this.shots = new ShotSystem(this)
    this.enemySystem = new EnemySystem(this, this.level)
    this.checkpoint = { x: this.level.start.x, y: this.level.start.y }
    this.lastSafe = { ...this.checkpoint }
    this.aimX = this.player.body.center.x + 80
    this.aimY = this.player.body.center.y - 60
    this.nextShotAt = 0

    this.hud = new Hud(
      this,
      // HUD taps are routed through onHudPointer: container hit areas do not
      // follow the camera scroll, which made these buttons dead on tall rooms.
      { onPause: () => undefined, onMode: () => undefined },
      save.settings,
    )
    this.touch = new TouchControls(this, save.settings, {
      onShoot: (x, y) => this.handleShoot(x, y),
      blockedRects: () => this.hud.blockedRects(),
    })
    this.touch.setVisible(isTouchDevice())

    this.setupInput()
    this.createBoss()
    this.setupCollisions()
    this.updateCamera(16, true)
    this.updatePip(16, true)
    this.hud.setMode(BLASTER_BY_ID.get(this.currentMode)?.short ?? 'PULSE', BLASTER_BY_ID.get(this.currentMode)?.color ?? 0x59d6ff)
    this.hud.toast(this.mode === 'endless' ? `ENDLESS TOWER · FLOOR ${this.stage + 1}` : world.feature.toUpperCase(), 0x6ff2c8)
    this.showIntro(world.name, this.mode === 'endless' ? `Floor ${this.stage + 1}` : this.level.name, world.tagline)
    audio.setSettings(save.settings)
    audio.setMood(this.level.boss ? 'boss' : 'level', world)
    audio.setIntensity(0.25)
    document.body.dataset.switchshotLevel = this.level.id

    this.input.on('pointerdown', this.onHudPointer, this)
    this.input.on('pointerdown', this.onMouseShoot, this)
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onHudPointer, this)
      this.input.off('pointerdown', this.onMouseShoot, this)
      // Scene shutdown already destroys the display list, projectiles and
      // enemies. Destroying pooled objects again here threw inside Phaser's
      // group teardown and stopped the Results scene from starting.
      this.touch?.destroy()
    })
  }

  private resolveMeta(): LevelMeta | null {
    if (this.mode === 'daily') return dailyMeta(this.dailyKey)
    if (this.mode === 'challenge' && this.challenge) {
      return getLevelMeta(levelId(this.challenge.worldIndex, this.challenge.levelNumber)) ?? ALL_LEVELS[0]
    }
    if (this.mode === 'endless') return getLevelMeta('w1-1') ?? ALL_LEVELS[0]
    if (this.sceneData.levelId) return getLevelMeta(this.sceneData.levelId) ?? null
    return ALL_LEVELS[0]
  }

  private setupInput(): void {
    this.keys = this.input.keyboard!.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      escape: Phaser.Input.Keyboard.KeyCodes.ESC,
      restart: Phaser.Input.Keyboard.KeyCodes.R,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
    }) as unknown as Keys
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ])
    // Escape is read once per frame in update(); binding a second handler
    // here toggled the pause twice and cancelled itself out.
    this.input.keyboard?.on('keydown-R', () => this.restartLevel())
    this.input.keyboard?.on('keydown-ONE', () => this.setModeByIndex(0))
    this.input.keyboard?.on('keydown-TWO', () => this.setModeByIndex(1))
    this.input.keyboard?.on('keydown-THREE', () => this.setModeByIndex(2))
    this.input.keyboard?.on('keydown-FOUR', () => this.setModeByIndex(3))
  }

  private setupCollisions(): void {
    this.physics.add.collider(this.player.hitbox, this.levelView.solids)
    this.physics.add.collider(this.player.hitbox, this.levelView.movingGroup)
    this.physics.add.collider(this.player.hitbox, this.levelView.crates)
    this.physics.add.collider(this.player.hitbox, this.levelView.grown)
    this.physics.add.collider(this.levelView.crates, this.levelView.solids)
    this.physics.add.collider(this.levelView.crates, this.levelView.movingGroup)
    this.physics.add.collider(this.enemySystem.group, this.levelView.solids)
    this.physics.add.collider(this.enemySystem.group, this.levelView.movingGroup)

    this.physics.add.collider(this.shots.group, this.levelView.solids, (shot: unknown) => {
      this.onShotWall(shot as Phaser.Physics.Arcade.Image)
    })
    this.physics.add.collider(this.shots.group, this.levelView.hatches, (shot: unknown) => {
      this.onShotWall(shot as Phaser.Physics.Arcade.Image)
    })
    this.physics.add.collider(this.shots.group, this.levelView.crates, (shot: unknown, crate: unknown) => {
      this.onShotCrate(shot as Phaser.Physics.Arcade.Image, crate as Phaser.Physics.Arcade.Image)
    })
    this.physics.add.collider(this.shots.group, this.levelView.movingGroup, (shot: unknown) => {
      this.onShotWall(shot as Phaser.Physics.Arcade.Image)
    })
    this.physics.add.overlap(this.shots.group, this.levelView.switches, (shot: unknown, target: unknown) => {
      this.onShotSwitch(shot as Phaser.Physics.Arcade.Image, target as Phaser.Physics.Arcade.Image)
    })
    this.physics.add.overlap(this.shots.group, this.levelView.mirrors, (shot: unknown, mirror: unknown) => {
      this.onShotMirror(shot as Phaser.Physics.Arcade.Image, mirror as Phaser.Physics.Arcade.Image)
    })
    this.physics.add.overlap(this.shots.group, this.levelView.seeds, (shot: unknown, seed: unknown) => {
      this.onShotSeed(shot as Phaser.Physics.Arcade.Image, seed as Phaser.Physics.Arcade.Image)
    })
    this.physics.add.overlap(this.shots.group, this.enemySystem.group, (shot: unknown, enemy: unknown) => {
      this.onShotEnemy(shot as Phaser.Physics.Arcade.Image, enemy as Phaser.Physics.Arcade.Image)
    })
    if (this.bossWeakGroup) {
      this.physics.add.overlap(this.shots.group, this.bossWeakGroup, (shot: unknown, weak: unknown) => {
        this.onShotBoss(shot as Phaser.Physics.Arcade.Image, weak as Phaser.Physics.Arcade.Image)
      })
    }
    this.physics.add.overlap(this.player.hitbox, this.levelView.gems, (_player: unknown, gem: unknown) => {
      this.collectGem(gem as Phaser.Physics.Arcade.Image)
    })
    this.physics.add.overlap(this.player.hitbox, this.levelView.checkpoints, (_player: unknown, zone: unknown) => {
      this.touchCheckpoint(zone as Phaser.Physics.Arcade.Image)
    })
    this.physics.add.overlap(this.player.hitbox, this.levelView.exitZone, () => this.touchExit())
    this.physics.add.overlap(this.player.hitbox, this.enemySystem.group, (_player: unknown, enemy: unknown) => {
      this.touchEnemy(enemy as Phaser.Physics.Arcade.Image)
    })
    this.physics.add.overlap(this.player.hitbox, this.enemySystem.shots, (_player: unknown, shot: unknown) => {
      this.touchEnemyShot(shot as Phaser.Physics.Arcade.Image)
    })
    this.physics.add.overlap(this.levelView.crates, this.levelView.plates, (_crate: unknown, plate: unknown) => {
      this.pressPlate(plate as Phaser.GameObjects.Rectangle)
    })
  }

  private createBoss(): void {
    const boss = this.level.boss
    if (!boss) return
    this.bossSprite = this.add.image(boss.x, boss.y, 'boss').setDepth(18).setTint(boss.color)
    this.bossWeakGroup = this.physics.add.staticGroup()
    for (const weak of boss.weakPoints) {
      const ring = this.add.circle(weak.x, weak.y, 30).setStrokeStyle(2, 0xffd75e, 0.2).setDepth(19)
      const core = this.add.image(weak.x, weak.y, 'switch-core').setTint(0xffd75e).setDepth(20).setScale(0.85).setAlpha(0.3)
      const zone = this.bossWeakGroup.create(weak.x, weak.y, 'switch-core') as Phaser.Physics.Arcade.Image
      zone.setVisible(false).setAlpha(0)
      zone.setData('weakId', weak.id)
      zone.setData('order', weak.order)
      const body = zone.body as Phaser.Physics.Arcade.StaticBody
      body.setSize(74, 74)
      body.updateFromGameObject()
      this.bossWeakCores.push(core)
      this.tweens.add({ targets: core, alpha: { from: 0.25, to: 0.9 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: ring, scale: { from: 0.85, to: 1.15 }, alpha: { from: 0.5, to: 0.12 }, duration: 1100, repeat: -1, ease: 'Sine.easeOut' })
      this.tweens.add({ targets: this.bossSprite!, y: boss.y - 14, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    this.bossNextShotAt = this.time.now + 1500
    audio.sfx('boss')
    this.hud.toast(`GUARDIAN · ${boss.name.toUpperCase()}`, 0xffd75e)
  }

  update(time: number, deltaMs: number): void {
    if (this.finished) return
    if (Phaser.Input.Keyboard.JustDown(this.keys.escape)) {
      this.togglePause()
      return
    }
    if (this.paused) return
    if (this.finishing) {
      this.shots.update(time, deltaMs)
      return
    }
    this.runElapsed += Math.min(deltaMs, 50)

    const intent = this.readIntent()
    const events = this.player.step(intent, deltaMs)
    if (events.jumped) audio.sfx('jump')
    if (events.landed) {
      audio.sfx('land')
      this.burst(this.player.body.center.x, this.player.body.bottom, 0xffffff, 4, 50)
      const platform = this.levelView.platformAtFeet(this.player.body.center.x, this.player.body.bottom, 10)
      if (platform?.kind === 'bounce') {
        this.player.body.velocity.y = -760
        audio.sfx('jump')
        this.burst(this.player.body.center.x, this.player.body.bottom, 0xffd75e, 8, 90)
      }
      this.lastSafe = { x: this.player.body.center.x, y: this.player.body.bottom }
    }

    const ride = this.levelView.rideDelta(this.player.body.bottom, this.player.body.left, this.player.body.right)
    if (ride.x !== 0 || ride.y !== 0) {
      this.player.hitbox.x += ride.x
      this.player.hitbox.y += ride.y
      this.player.body.updateFromGameObject()
    }

    this.levelView.update(time, deltaMs)
    this.shots.update(time, deltaMs)
    this.enemySystem.update(time, deltaMs, { x: this.player.body.center.x, y: this.player.body.center.y }, false)
    this.updateBoss(time, deltaMs)

    if (this.player.body.bottom > this.level.height + 70) {
      this.damagePlayer(this.player.body.center.x, this.player.body.bottom, 'fall')
    }

    this.updateCamera(deltaMs, false)
    this.updatePip(deltaMs, false)
    this.updateHud(time)
    this.checkChallengeLimits()
    audio.setIntensity(Math.min(1, this.bossStage / 4 + (this.damageTaken ? 0.1 : 0)))
  }

  private readIntent(): PlayerIntent {
    const left = this.keys.left.isDown || this.keys.a.isDown
    const right = this.keys.right.isDown || this.keys.d.isDown
    const keyboardAxis = (right ? 1 : 0) - (left ? 1 : 0)
    const keyboardJump =
      Phaser.Input.Keyboard.JustDown(this.keys.jump) ||
      Phaser.Input.Keyboard.JustDown(this.keys.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.w)
    const touchJump = this.touch.consumeJump()
    return {
      axis: Math.abs(keyboardAxis) > 0 ? keyboardAxis : this.touch.moveAxis,
      jumpPressed: keyboardJump || touchJump,
      jumpHeld: this.keys.jump.isDown || this.keys.up.isDown || this.keys.w.isDown || this.touch.jumpHeld,
      down: false,
    }
  }

  private updateCamera(deltaMs: number, snap: boolean): void {
    const camera = this.cameras.main
    const targetY = Phaser.Math.Clamp(
      this.player.body.center.y - GAME_HEIGHT * CAMERA.viewCenter,
      0,
      Math.max(0, this.level.height - GAME_HEIGHT),
    )
    if (snap) {
      camera.scrollY = targetY
      camera.scrollX = 0
      return
    }
    const settings = loadSave().settings
    const smooth = settings.reducedMotion ? 0.3 : CAMERA.lerpY
    camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetY, Math.min(0.5, smooth * Math.max(0.6, deltaMs / 16)))
    camera.scrollX = 0
  }

  private updatePip(deltaMs: number, snap: boolean): void {
    const save = loadSave()
    const center = this.player.body.center
    this.pip.update(
      {
        x: center.x,
        y: center.y + 4,
        velocityX: this.player.body.velocity.x,
        velocityY: this.player.body.velocity.y,
        onGround: this.player.onGround,
        facing: this.player.facing,
        aimX: this.aimX,
        aimY: this.aimY,
        firing: this.time.now < this.pipFiringUntil,
        invulnerable: this.player.invulnerable > 0,
        reducedMotion: save.settings.reducedMotion,
      },
      snap ? 16 : deltaMs,
    )
  }

  private updateHud(time: number): void {
    const world = worldAt(this.level.worldIndex)
    const blaster = BLASTER_BY_ID.get(this.currentMode)
    const elapsed = this.runElapsed
    const timerMode = this.mode === 'speedrun' || this.mode === 'challenge' || this.mode === 'daily'
    this.hud.update({
      worldName: world.name,
      levelName: this.mode === 'endless' ? `Endless Floor ${this.stage + 1}` : this.level.name,
      health: this.health,
      maxHealth: PLAYER.maxHealth,
      gems: this.gemsCollected,
      requiredGems: this.level.requiredGems,
      modeLabel: blaster?.short ?? 'PULSE',
      objective: this.objective(),
      timeMs: elapsed,
      showTimer: timerMode,
      shots: this.shotsFired,
      shotLimit: this.challenge?.limitShots,
    })
    this.hud.setMode(blaster?.short ?? 'PULSE', blaster?.color ?? 0x59d6ff)
    if (time > this.trailHintAt && this.mode === 'journey' && this.meta.levelNumber === 1 && this.meta.worldIndex === 0) {
      this.trailHintAt = time + 9000
    }
  }

  private objective(): string {
    if (this.mode === 'endless') return 'CLIMB TO THE PORTAL · THE TOWER GETS TALLER'
    if (this.level.boss && !this.bossDefeated) return `SHOOT THE GUARDIAN'S WEAK POINTS (${this.bossStage}/3)`
    if (this.challenge?.limitShots) return `${this.challenge.objective} · ${Math.max(0, this.challenge.limitShots - this.shotsFired)} SHOTS LEFT`
    if (this.challenge?.limitMs) return this.challenge.objective.toUpperCase()
    if (this.challenge?.noDamage) return 'FINISH WITHOUT TAKING A HIT'
    if (this.mode === 'speedrun') return 'BEAT YOUR BEST TIME'
    if (this.mode === 'daily') return 'TODAY\'S PUZZLE · REACH THE PORTAL'
    return `OPEN THE HATCHES · COLLECT GEMS ${this.gemsCollected}/${this.level.requiredGems} · REACH THE EXIT`
  }

  /** Screen-space HUD and pause-overlay taps, handled above the camera scroll. */
  private onHudPointer(pointer: Phaser.Input.Pointer): void {
    const x = pointer.x
    const y = pointer.y
    const within = (left: number, top: number, width: number, height: number): boolean =>
      x >= left && x <= left + width && y >= top && y <= top + height
    const left = GAME_WIDTH / 2 - 150
    if (this.paused) {
      if (within(left, 514, 300, 52)) this.togglePause()
      else if (within(left, 583, 300, 46)) {
        this.physics.resume()
        this.restartLevel()
      } else if (within(left, 641, 300, 46)) {
        this.physics.resume()
        this.scene.start('Settings', { returnTo: 'Game', gameData: this.sceneData })
      } else if (within(left, 699, 300, 46)) {
        this.physics.resume()
        this.scene.start('Journey')
      }
      return
    }
    if (within(GAME_WIDTH - 128, SAFE_TOP - 8, 60, 60)) this.togglePause()
    else if (within(GAME_WIDTH - 190, SAFE_TOP + 58, 126, 44)) this.cycleMode()
  }

  private onMouseShoot(pointer: Phaser.Input.Pointer): void {
    if (pointer.wasTouch) return
    if (this.paused || this.finishing) return
    if (this.hud.blockedRects().some((rect) => pointer.x >= rect.x && pointer.x <= rect.x + rect.width && pointer.y >= rect.y && pointer.y <= rect.y + rect.height)) {
      return
    }
    this.handleShoot(pointer.x, pointer.y)
  }

  private handleShoot(screenX: number, screenY: number): void {
    if (this.paused || this.finishing || this.finished) return
    if (this.time.now < this.nextShotAt) return
    const camera = this.cameras.main
    const point = camera.getWorldPoint(screenX, screenY)
    let targetX = point.x
    let targetY = point.y
    const settings = loadSave().settings
    if (settings.aimAssist) {
      const candidates = [
        ...this.level.switches.map((entry) => ({ x: entry.x, y: entry.y })),
        ...this.level.mirrors.map((entry) => ({ x: entry.x, y: entry.y })),
        ...this.level.seeds.map((entry) => ({ x: entry.x, y: entry.y })),
      ]
      const snapped = assistedTarget(point.x, point.y, candidates, SHOT.aimAssistScreenPx / camera.zoom)
      if (snapped) {
        targetX = snapped.x
        targetY = snapped.y
      }
    }
    const muzzle = this.player.muzzle()
    this.shots.fire(muzzle.x, muzzle.y, targetX, targetY, this.currentMode, skinTint())
    this.nextShotAt = this.time.now + SHOT.cooldownMs
    this.shotsFired += 1
    this.aimX = targetX
    this.aimY = targetY
    this.pipFiringUntil = this.time.now + 110
    const blaster = BLASTER_BY_ID.get(this.currentMode)
    audio.sfx(this.currentMode === 'volt' ? 'volt' : this.currentMode === 'growth' ? 'growth' : this.currentMode === 'gravity' ? 'gravity' : 'shot')
    this.burst(muzzle.x, muzzle.y, blaster?.color ?? 0xffffff, 3, 60)
    if (settings.haptics && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(6)
    }
    if (this.shotsFired === 1 && this.mode === 'journey' && this.meta.levelNumber <= 2) {
      this.hud.toast('NICE SHOT · BOLTS HIT WHAT THEY TOUCH', 0x59d6ff)
    }
  }

  private onShotWall(shot: Phaser.Physics.Arcade.Image): void {
    if (!shot.active) return
    this.shots.despawn(shot, true)
  }

  private onShotCrate(shot: Phaser.Physics.Arcade.Image, crate: Phaser.Physics.Arcade.Image): void {
    if (!shot.active || !crate.active) return
    const mode = String(shot.getData('mode') ?? 'pulse') as BlasterMode
    if (mode === 'gravity') {
      const body = crate.body as Phaser.Physics.Arcade.Body
      const dx = Number(shot.getData('dirX') ?? 0)
      body.velocity.x = Phaser.Math.Clamp(body.velocity.x + dx * 330, -420, 420)
      body.velocity.y = Math.min(body.velocity.y, -60)
      crate.setTint(0xd9c2ff)
      this.time.delayedCall(240, () => crate.active && crate.clearTint())
      this.shots.impact(shot, 8)
      this.score += 20
    } else {
      this.hud.toast('THAT CRATE NEEDS A PURPLE GRAVITY SHOT', 0xb79cff)
    }
    this.shots.despawn(shot, false)
  }

  private onShotSwitch(shot: Phaser.Physics.Arcade.Image, target: Phaser.Physics.Arcade.Image): void {
    if (!shot.active || !target.active) return
    const id = String(target.getData('switchId') ?? '')
    const spec = this.level.switches.find((entry) => entry.id === id)
    const mode = String(shot.getData('mode') ?? 'pulse') as BlasterMode
    this.shots.despawn(shot, false)
    if (!spec) return
    if (mode !== spec.requiredMode) {
      this.shots.impact(shot, 4)
      audio.sfx('shield')
      const required = BLASTER_BY_ID.get(spec.requiredMode)
      const current = BLASTER_BY_ID.get(mode)
      this.hud.toast(`${current?.name.toUpperCase()} WON'T DO IT · USE ${required?.name.toUpperCase()}`, required?.color ?? 0xffffff)
      return
    }
    const hatch = this.levelView.hatchForSwitch(id)
    if (!hatch) return
    if (hatch.puzzle === 'sequence') {
      const view = this.levelView.switchView(id)
      const expected = hatch.switchIds.filter((switchId) => this.levelView.isSwitchActive(switchId)).length + 1
      if (spec.order !== expected) {
        hatch.switchIds.forEach((switchId) => this.levelView.resetSwitch(switchId))
        this.shots.impact(shot, 6)
        audio.sfx('empty')
        this.hud.toast('SEQUENCE LOST · HIT THE NUMBERED SWITCHES IN ORDER', 0xff8fc7)
        return
      }
      if (view) this.levelView.activateSwitch(id)
      this.markSwitchHit(shot, spec.x, spec.y)
      const complete = hatch.switchIds.every((switchId) => this.levelView.isSwitchActive(switchId))
      if (complete) this.openHatchFor(hatch.id)
      return
    }
    this.levelView.activateSwitch(id)
    this.markSwitchHit(shot, spec.x, spec.y)
    this.openHatchFor(hatch.id)
  }

  private markSwitchHit(shot: Phaser.Physics.Arcade.Image, x: number, y: number): void {
    this.shotsHit += 1
    this.switchesHit += 1
    this.score += 150
    this.shots.impact(shot, 10)
    this.burst(x, y, 0xffd75e, 10, 110)
    audio.sfx('switch')
    this.cameras.main.flash(90, 255, 226, 120, false)
  }

  private openHatchFor(hatchId: string): void {
    const hatch = this.level.hatches.find((entry) => entry.id === hatchId)
    if (!hatch) return
    this.levelView.openHatch(hatchId, hatch.timedMs)
    this.score += 120
    audio.sfx('hatch')
    this.hud.toast(hatch.puzzle === 'timed' ? 'HATCH OPEN · IT CLOSES ON A TIMER · GO!' : 'HATCH OPEN · HEAD UP', 0x6ff2c8)
    this.burst(hatch.x + hatch.width / 2, hatch.y, 0x6ff2c8, 14, 130)
    this.cameras.main.shake(120, 0.004)
  }

  private onShotMirror(shot: Phaser.Physics.Arcade.Image, mirror: Phaser.Physics.Arcade.Image): void {
    if (!shot.active) return
    const id = String(mirror.getData('mirrorId') ?? '')
    const spec = this.level.mirrors.find((entry) => entry.id === id)
    if (!spec) return
    const body = shot.body as Phaser.Physics.Arcade.Body
    const length = Math.hypot(body.velocity.x, body.velocity.y) || 1
    const dx = body.velocity.x / length
    const dy = body.velocity.y / length
    const inv = Math.SQRT1_2
    const nx = inv
    const ny = spec.orientation === '/' ? inv : -inv
    const dot = dx * nx + dy * ny
    const rx = dx - 2 * dot * nx
    const ry = dy - 2 * dot * ny
    const bounces = this.shots.ricochetsFor(shot)
    if (bounces >= SHOT.maxBounces) {
      this.shots.despawn(shot, true)
      return
    }
    this.shots.reflect(shot, rx, ry)
    this.ricochets += 1
    this.shots.impact(shot, 6)
    this.burst(shot.x, shot.y, 0x8ff5ff, 6, 80)
    audio.sfx('reflect')
  }

  private onShotSeed(shot: Phaser.Physics.Arcade.Image, seed: Phaser.Physics.Arcade.Image): void {
    if (!shot.active || !seed.active) return
    const id = String(seed.getData('seedId') ?? '')
    const mode = String(shot.getData('mode') ?? 'pulse') as BlasterMode
    this.shots.despawn(shot, false)
    if (mode !== 'growth') {
      this.shots.impact(shot, 4)
      audio.sfx('shield')
      this.hud.toast('THAT SEED NEEDS A GREEN GROWTH SHOT', 0x6ff28a)
      return
    }
    this.levelView.growSeed(id)
    this.shotsHit += 1
    this.score += 180
    audio.sfx('growth')
    this.burst(seed.x, seed.y, 0x6ff28a, 16, 120)
    this.hud.toast('VINE GROWN · A NEW LEDGE APPEARS', 0x6ff28a)
  }

  private onShotEnemy(shot: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Image): void {
    if (!shot.active || !enemy.active) return
    const body = shot.body as Phaser.Physics.Arcade.Body
    const result = this.enemySystem.damage(enemy, body.velocity.x)
    this.shots.despawn(shot, !result.defeated)
    if (result.blocked) {
      audio.sfx('shield')
      this.hud.toast('SHIELDBUG · SHOOT IT FROM BEHIND', 0x8ff5ff)
      return
    }
    if (result.defeated) {
      this.shotsHit += 1
      this.enemiesDefeated += 1
      this.score += 220
      audio.sfx('enemy')
      this.burst(result.x, result.y, 0xffd75e, 14, 150)
      this.scorePopup(result.x, result.y, `+220 ${result.name.toUpperCase()}`)
    }
  }

  private collectGem(gem: Phaser.Physics.Arcade.Image): void {
    if (!gem.active) return
    const optional = Boolean(gem.getData('optional'))
    gem.disableBody(true, true)
    this.gemsCollected += optional ? 0 : 1
    this.optionalCollected += optional ? 1 : 0
    this.score += optional ? 500 : 120
    audio.sfx(optional ? 'optional' : 'gem')
    this.burst(gem.x, gem.y, optional ? 0xb79cff : 0x6ff2c8, optional ? 12 : 7, optional ? 110 : 70)
    this.scorePopup(gem.x, gem.y, optional ? '+500' : '+120')
    if (this.gemsCollected === this.level.requiredGems && this.level.requiredGems > 0) {
      this.hud.toast('EVERY GEM COLLECTED · TWO STARS SECURED', 0x6ff2c8)
    }
  }

  private touchCheckpoint(zone: Phaser.Physics.Arcade.Image): void {
    const index = Number(zone.getData('checkpointIndex') ?? 0)
    if (!this.levelView.activateCheckpoint(index)) return
    const point = this.level.checkpoints[index]
    if (!point) return
    this.checkpoint = { x: point.x, y: point.y + 10 }
    this.score += 80
    audio.sfx('checkpoint')
    this.hud.toast('CHECKPOINT ONLINE', 0x6ff2c8)
    this.burst(point.x, point.y - 30, 0x6ff2c8, 10, 100)
  }

  private pressPlate(plate: Phaser.GameObjects.Rectangle): void {
    const id = String(plate.getData('plateId') ?? '')
    const spec = this.level.plates.find((entry) => entry.id === id)
    if (!spec) return
    this.levelView.activatePlate(id)
    const hatch = this.level.hatches.find((entry) => entry.id === spec.hatchId)
    if (hatch && !this.levelView.isHatchOpen(hatch.id)) {
      this.score += 150
      audio.sfx('switch')
      this.hud.toast('PRESSURE PLATE DOWN · HATCH UNLOCKED', 0xb79cff)
      this.openHatchFor(hatch.id)
    }
  }

  private touchEnemy(enemy: Phaser.Physics.Arcade.Image): void {
    if (!enemy.active || this.finishing) return
    this.damagePlayer(enemy.x, enemy.y, 'enemy')
  }

  private touchEnemyShot(shot: Phaser.Physics.Arcade.Image): void {
    if (!shot.active) return
    const x = shot.x
    const y = shot.y
    shot.destroy()
    this.burst(x, y, 0xff5f7a, 5, 60)
    this.damagePlayer(x, y, 'enemy')
  }

  private damagePlayer(sourceX: number, sourceY: number, source: 'enemy' | 'fall' | 'boss'): void {
    if (this.finishing || this.finished || this.paused) return
    if (!this.player.hurt(sourceX)) return
    this.health -= 1
    this.damageTaken = true
    this.buttonFlash()
    this.burst(this.player.body.center.x, this.player.body.center.y, 0xff5f7a, 12, 130)
    this.cameras.main.shake(220, 0.012)
    this.backdrop.pulse(0xff5f7a, 0.2)
    audio.sfx('hurt')
    this.score = Math.max(0, this.score - 150)
    if (this.challenge?.noDamage) this.failChallenge('THE ROOM DEMANDS A CLEAN RUN')
    if (source === 'fall') {
      this.time.delayedCall(220, () => this.respawn())
      return
    }
    void source
    if (this.health <= 0) {
      this.deaths += 1
      this.health = PLAYER.maxHealth
      if (this.mode === 'endless') {
        this.finishRun(false)
        return
      }
      this.hud.toast('PIP IS DAZED · BACK TO THE CHECKPOINT', 0xff5f7a)
      this.time.delayedCall(420, () => this.respawn())
      return
    }
    this.hud.toast('THAT STUNG · KEEP MOVING', 0xff5f7a)
    void sourceY
  }

  private buttonFlash(): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(24)
  }

  private respawn(): void {
    if (this.finished) return
    this.player.reset(this.checkpoint.x, this.checkpoint.y - 10)
    this.player.invulnerable = TUNING.respawnGraceMs
    this.enemySystem.clearShots()
    this.shots.clear()
    this.cameras.main.flash(160, 255, 255, 255, false)
    this.burst(this.checkpoint.x, this.checkpoint.y, 0x6ff2c8, 12, 100)
  }

  private touchExit(): void {
    if (!this.exitIsReady() || this.finishing) return
    if (this.mode === 'endless') {
      this.advanceEndless()
      return
    }
    this.finishRun(true)
  }

  private exitIsReady(): boolean {
    return !this.level.boss || this.bossDefeated
  }

  private updateBoss(time: number, deltaMs: number): void {
    const boss = this.level.boss
    if (!boss || !this.bossSprite || this.bossDefeated) return
    if (this.player.body.center.y > boss.y + 520) return
    if (time < this.bossNextShotAt) return
    this.bossNextShotAt = time + boss.shotIntervalMs
    const originX = this.bossSprite.x
    const originY = this.bossSprite.y + 40
    for (let index = -1; index <= 1; index += 1) {
      const shot = this.enemySystem.shots.create(originX, originY, 'shot-pulse') as Phaser.Physics.Arcade.Image
      shot.setDepth(17).setTint(boss.color).setScale(0.9)
      const body = shot.body as Phaser.Physics.Arcade.Body
      body.setAllowGravity(false)
      body.setCircle(8)
      const angle = Math.atan2(this.player.body.center.y - originY, this.player.body.center.x - originX) + index * 0.22
      shot.setVelocity(Math.cos(angle) * 240, Math.sin(angle) * 240)
      shot.setData('bornAt', time)
    }
    audio.sfx('shot')
  }

  private onShotBoss(shot: Phaser.Physics.Arcade.Image, weak: Phaser.Physics.Arcade.Image): void {
    if (!shot.active || !weak.active || this.bossDefeated) return
    const order = Number(weak.getData('order') ?? 0)
    this.shots.despawn(shot, false)
    if (order !== this.bossStage + 1) {
      audio.sfx('shield')
      this.hud.toast(`THE GUARDIAN'S SHIELD HOLDS · AIM FOR WEAK POINT ${this.bossStage + 1}`, 0xffd75e)
      this.shots.impact(shot, 4)
      return
    }
    this.bossStage += 1
    this.shotsHit += 1
    this.score += 600
    weak.disableBody(true, true)
    weak.setVisible(false)
    const core = this.bossWeakCores[order - 1]
    core?.setAlpha(0.12)
    audio.sfx('boss-hit')
    this.burst(weak.x, weak.y, 0xffd75e, 22, 200)
    this.cameras.main.shake(280, 0.02)
    this.backdrop.pulse(0xffd75e, 0.26)
    this.hud.toast(`WEAK POINT ${order}/3 · ${3 - order} TO GO`, 0xffd75e)
    if (this.bossStage >= 3) this.defeatBoss()
  }

  private defeatBoss(): void {
    if (this.bossDefeated) return
    this.bossDefeated = true
    const boss = this.level.boss
    if (boss && this.bossSprite) {
      this.tweens.add({
        targets: this.bossSprite,
        y: this.bossSprite.y + 60,
        angle: 12,
        alpha: 0,
        duration: 900,
        ease: 'Quad.easeIn',
      })
      this.burst(boss.x, boss.y, 0xffd75e, 34, 260)
      this.cameras.main.flash(280, 255, 226, 120, false)
    }
    this.score += 2500
    this.levelView.setExitReady(true)
    audio.sfx('victory')
    this.hud.toast('GUARDIAN POWERED DOWN · THE EXIT IS OPEN', 0x6ff2c8)
  }

  private advanceEndless(): void {
    if (this.finishing) return
    this.finishing = true
    const bonus = 500 + Math.max(0, 3000 - this.runElapsed / 20)
    this.score += Math.round(bonus)
    this.time.delayedCall(500, () => {
      this.scene.restart({
        ...this.sceneData,
        mode: 'endless',
        stage: this.stage + 1,
        runScore: this.score,
        runHealth: this.health,
        runDeaths: this.deaths,
      })
    })
  }

  private finishRun(success: boolean): void {
    if (this.finishing) return
    this.finishing = true
    this.touch.setVisible(false)
    this.shots.clear()
    if (success) {
      this.cameras.main.flash(180, 255, 255, 255, false)
      audio.sfx('victory')
    }
    const timeMs = Math.max(1, Math.round(this.runElapsed))
    const allGems = this.level.requiredGems > 0 && this.gemsCollected >= this.level.requiredGems
    const stars: StarCount = success
      ? ((this.mode === 'challenge'
          ? this.challengeStars(allGems)
          : starsFor({ completed: true, allGems, noDamage: !this.damageTaken })) as StarCount)
      : 0
    if (success) this.score += scoreForRun(this.gemsCollected, !this.damageTaken, timeMs, this.enemiesDefeated)
    const result: LevelResult = {
      levelId: this.level.id,
      mode: this.mode,
      score: this.score,
      stars,
      timeMs,
      gems: this.gemsCollected,
      optionalGems: this.optionalCollected,
      requiredGems: this.level.requiredGems,
      noDamage: !this.damageTaken,
      shots: this.shotsFired,
      hits: this.shotsHit,
      ricochets: this.ricochets,
      enemies: this.enemiesDefeated,
      deaths: this.deaths,
      worldIndex: this.level.worldIndex,
      challengeId: this.challenge?.id,
      endlessHeight: this.mode === 'endless' ? this.stage + (success ? 1 : 0) : undefined,
      dailyDate: this.mode === 'daily' ? this.dailyKey : undefined,
    }
    if (success || this.mode === 'endless') recordLevelResult(result)
    const progress = reconcileProgress()
    const next = this.mode === 'journey' && success ? nextLevelId(this.level.id) : null
    const data: ResultsData = {
      success,
      mode: this.mode,
      levelId: this.level.id,
      levelName: this.mode === 'endless' ? `Endless Floor ${this.stage + 1}` : this.level.name,
      worldIndex: this.level.worldIndex,
      result,
      nextLevelId: next,
      newAchievements: progress.achievements,
      bossName: this.level.boss?.name,
    }
    this.time.delayedCall(success ? 720 : 320, () => {
      this.scene.start('Results', data)
    })
  }

  private challengeStars(allGems: boolean): number {
    let stars = 1
    const challenge = this.challenge
    if (!challenge) return stars
    const underTime = !challenge.limitMs || this.runElapsed <= challenge.limitMs
    const underShots = !challenge.limitShots || this.shotsFired <= challenge.limitShots
    const clean = !challenge.noDamage || !this.damageTaken
    if (allGems || underTime || underShots) stars += 1
    if (!this.damageTaken && clean) stars += 1
    return Math.min(3, stars)
  }

  private checkChallengeLimits(): void {
    if (!this.challenge || this.finishing) return
    if (this.challenge.limitMs && this.runElapsed > this.challenge.limitMs) {
      this.failChallenge('OUT OF TIME · THE ROOM RESETS')
    } else if (this.challenge.limitShots && this.shotsFired > this.challenge.limitShots) {
      this.failChallenge('OUT OF SHOTS · TRY A TIGHTER ROUTE')
    }
  }

  private failChallenge(message: string): void {
    if (this.finishing || this.finished) return
    this.challengeFailed = message
    this.hud.toast(message, 0xff5f7a)
    audio.sfx('death')
    this.finishRun(false)
  }

  private cycleMode(): void {
    if (this.unlockedModes.length <= 1) {
      this.hud.toast('MORE BLASTERS UNLOCK AS YOU CLIMB THE JOURNEY', 0xb79cff)
      return
    }
    const index = this.unlockedModes.indexOf(this.currentMode)
    const next = this.unlockedModes[(index + 1) % this.unlockedModes.length]
    this.currentMode = next
    const blaster = BLASTER_BY_ID.get(next)
    this.hud.setMode(blaster?.short ?? next.toUpperCase(), blaster?.color ?? 0xffffff)
    this.hud.toast(`${blaster?.name.toUpperCase()} · ${blaster?.description.toUpperCase()}`, blaster?.color ?? 0xffffff)
    audio.sfx('click')
  }

  private setModeByIndex(index: number): void {
    const next = this.unlockedModes[index]
    if (!next) return
    this.currentMode = next
    const blaster = BLASTER_BY_ID.get(next)
    this.hud.setMode(blaster?.short ?? next.toUpperCase(), blaster?.color ?? 0xffffff)
    audio.sfx('click')
  }

  private togglePause(): void {
    if (this.finishing || this.finished) return
    this.paused = !this.paused
    if (this.paused) {
      this.physics.pause()
      this.touch.setVisible(false)
      this.showPause()
      audio.sfx('click')
    } else {
      this.physics.resume()
      this.touch.setVisible(isTouchDevice())
      this.pauseLayer?.destroy(true)
      this.pauseLayer = undefined
      audio.sfx('back')
    }
  }

  private showPause(): void {
    const world = worldAt(this.level.worldIndex)
    const layer = this.add.container(0, 0).setDepth(3000).setScrollFactor(0)
    const shade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x08060f, 0.78).setInteractive()
    const card = panel(this, 100, 330, GAME_WIDTH - 200, 540, 0x6ff2c8, 0.96, 3001)
    const title = this.add
      .text(GAME_WIDTH / 2, 386, 'PAUSED', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#fff6e2',
      })
      .setOrigin(0.5)
    const ribbon = this.add
      .text(GAME_WIDTH / 2, 424, `${world.name.toUpperCase()} · ${this.level.name.toUpperCase()}`, {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '10px',
        color: 'rgba(255,246,226,0.6)',
        letterSpacing: 1.4,
      })
      .setOrigin(0.5)
    const info = this.add
      .text(GAME_WIDTH / 2, 466, `${this.gemsCollected}/${this.level.requiredGems} GEMS  ·  ${formatMs(this.runElapsed)}  ·  ${this.currentMode.toUpperCase()}`, {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '11px',
        color: '#6ff2c8',
      })
      .setOrigin(0.5)
    layer.add([shade, card, title, ribbon, info])
    const resume = new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 540,
      width: 300,
      height: 52,
      label: 'RESUME',
      color: 0x6ff2c8,
      interactive: false,
      onClick: () => this.togglePause(),
    })
    const restart = new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 606,
      width: 300,
      height: 46,
      label: 'RESTART ROOM',
      small: true,
      color: 0xffd75e,
      interactive: false,
      onClick: () => {
        this.physics.resume()
        this.restartLevel()
      },
    })
    const settings = new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 664,
      width: 300,
      height: 46,
      label: 'SETTINGS',
      small: true,
      color: 0x9fe8ff,
      interactive: false,
      onClick: () => {
        this.physics.resume()
        this.scene.start('Settings', { returnTo: 'Game', gameData: this.sceneData })
      },
    })
    const quit = new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 722,
      width: 300,
      height: 46,
      label: this.mode === 'endless' ? 'END RUN' : 'QUIT TO MAP',
      small: true,
      color: 0xff8fc7,
      interactive: false,
      onClick: () => {
        this.physics.resume()
        this.scene.start('Journey')
      },
    })
    layer.add([resume.container, restart.container, settings.container, quit.container])
    this.pauseLayer = layer
  }

  private restartLevel(): void {
    if (this.finishing) return
    this.physics.resume()
    this.scene.restart({
      ...this.sceneData,
      levelId: this.meta.id,
      mode: this.mode,
      stage: this.mode === 'endless' ? this.stage : undefined,
      dailyDate: this.dailyKey,
      challengeId: this.challenge?.id,
      runScore: this.mode === 'endless' ? 0 : undefined,
      runHealth: PLAYER.maxHealth,
      runDeaths: 0,
    })
  }

  private showIntro(worldName: string, levelName: string, tagline: string): void {
    const container = this.add.container(0, 0).setDepth(1200).setScrollFactor(0)
    const shade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x08060f, 0.36)
    const band = this.add.graphics()
    band.fillGradientStyle(0x0d0920, 0x0d0920, 0x0d0920, 0x0d0920, 0.2, 0.2, 0.88, 0.88)
    band.fillRoundedRect(70, 468, GAME_WIDTH - 140, 190, 20)
    band.lineStyle(1.5, 0x6ff2c8, 0.4)
    band.strokeRoundedRect(70, 468, GAME_WIDTH - 140, 190, 20)
    const eyebrow = this.add
      .text(GAME_WIDTH / 2, 506, 'NOW ENTERING', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#6ff2c8',
        letterSpacing: 4,
      })
      .setOrigin(0.5)
    const title = this.add
      .text(GAME_WIDTH / 2, 544, levelName, {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#fff6e2',
        align: 'center',
        wordWrap: { width: 540 },
      })
      .setOrigin(0.5)
    const sub = this.add
      .text(GAME_WIDTH / 2, 596, `${worldName} · ${tagline}`, {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '12px',
        color: 'rgba(255,246,226,0.7)',
        align: 'center',
      })
      .setOrigin(0.5)
    container.add([shade, band, eyebrow, title, sub])
    this.tweens.add({ targets: container, alpha: 0, delay: 1700, duration: 600, onComplete: () => container.destroy(true) })
    this.introLayer = container
  }

  private burst(x: number, y: number, color: number, amount = 8, speed = 120): void {
    const emitter = this.add.particles(x, y, 'fx-spark', {
      speed: { min: speed * 0.35, max: speed },
      lifespan: 500,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 220,
      quantity: amount,
      emitting: false,
      tint: color,
      blendMode: 'ADD',
    })
    emitter.setDepth(30)
    emitter.explode(amount, x, y)
    this.time.delayedCall(900, () => emitter.destroy())
  }

  private scorePopup(x: number, y: number, label: string): void {
    const text = this.add
      .text(x, y - 18, label, {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fff6e2',
        stroke: '#171032',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(40)
    this.tweens.add({ targets: text, y: y - 62, alpha: 0, duration: 750, ease: 'Quad.easeOut', onComplete: () => text.destroy() })
  }

  debugFireAt(worldX: number, worldY: number): void {
    this.aimX = worldX
    this.aimY = worldY
    const muzzle = this.player.muzzle()
    this.shots.fire(muzzle.x, muzzle.y, worldX, worldY, this.currentMode, skinTint())
    this.nextShotAt = 0
  }

  debugCollectGems(): void {
    for (const gem of this.levelView.gems.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (gem.active) this.collectGem(gem)
    }
  }

  debugTeleportToExit(): void {
    this.player.reset(this.level.exit.x, this.level.exit.y)
  }

  debugDefeatBoss(): void {
    if (this.level.boss) this.defeatBoss()
  }

  debugDamage(): void {
    this.damagePlayer(this.player.body.center.x + 40, this.player.body.center.y, 'enemy')
  }

  debugFinish(): void {
    if (this.mode === 'endless') this.advanceEndless()
    else this.finishRun(true)
  }

  /** Test helper: stands Pip on the highest stair of the opening chamber. */
  debugStandOnTopStair(): void {
    const floorY = floorYFor(this.level.height, 0)
    const top = this.level.platforms
      .filter((platform) => platform.role === 'stair' && platform.y < floorY && platform.y >= floorY - 340)
      .sort((a, b) => a.y - b.y)[0]
    if (top) this.player.reset(top.x + top.width / 2, top.y - 40)
  }

  testState(): unknown {
    return {
      scene: 'Game',
      levelId: this.level?.id,
      mode: this.mode,
      health: this.health,
      gems: this.gemsCollected,
      gemsTotal: this.level?.requiredGems,
      shots: this.shotsFired,
      ricochets: this.ricochets,
      switchesHit: this.switchesHit,
      switches: this.level
        ? this.level.switches.map((entry) => ({ id: entry.id, x: entry.x, y: entry.y, mode: entry.requiredMode }))
        : [],
      exit: this.level ? { x: this.level.exit.x, y: this.level.exit.y } : null,
      hatchesOpen: this.level
        ? this.level.hatches.filter((hatch) => this.levelView?.isHatchOpen(hatch.id)).length
        : 0,
      exitReady: this.exitIsReady(),
      paused: this.paused,
      finishing: this.finishing,
      finished: this.finished,
      bossStage: this.bossStage,
      bossDefeated: this.bossDefeated,
      modeBlaster: this.currentMode,
      stage: this.stage,
      failure: this.challengeFailed,
      player: this.player
        ? {
            x: Math.round(this.player.body.center.x),
            y: Math.round(this.player.body.center.y),
            onGround: this.player.onGround,
            vx: Math.round(this.player.body.velocity.x),
            vy: Math.round(this.player.body.velocity.y),
          }
        : null,
      cameraScrollY: this.cameras.main.scrollY,
      gemsLeft: this.levelView
        ? (this.levelView.gems.getChildren() as Phaser.Physics.Arcade.Image[]).filter((gem) => gem.active).length
        : 0,
      challenges: CHALLENGES.length,
      css: CSS.ink,
    }
  }
}
