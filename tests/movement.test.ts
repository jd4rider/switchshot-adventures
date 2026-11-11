import { describe, expect, it } from 'vitest'
import { SHOT, TUNING } from '../src/config'
import {
  approach,
  assistedTarget,
  aimDirection,
  clampFall,
  coyoteRemaining,
  cutJump,
  inputAxis,
  jumpApex,
  jumpBufferRemaining,
  muzzleOffset,
  scoreForRun,
  shotCooldownRemaining,
  starsFor,
  stepHorizontal,
} from '../src/player/movement'

describe('thumb-glide and keyboard movement', () => {
  it('accelerates toward the run speed and decelerates to a stop', () => {
    let speed = 0
    for (let frame = 0; frame < 60; frame += 1) speed = stepHorizontal(speed, 1, true, 1 / 60)
    expect(speed).toBeCloseTo(TUNING.runSpeed, 2)
    const slowed = stepHorizontal(speed, 0, true, 1 / 60)
    expect(slowed).toBeLessThan(speed)
    expect(stepHorizontal(0, -1, false, 0.1)).toBeLessThan(0)
  })

  it('is frame-rate independent and supports partial stick deflections', () => {
    let at60 = 0
    let at30 = 0
    for (let frame = 0; frame < 60; frame += 1) at60 = stepHorizontal(at60, 1, true, 1 / 60)
    for (let frame = 0; frame < 30; frame += 1) at30 = stepHorizontal(at30, 1, true, 1 / 30)
    expect(Math.abs(at60 - at30)).toBeLessThan(0.01)
    expect(inputAxis(0.05)).toBe(0)
    expect(inputAxis(-0.05)).toBe(0)
    expect(inputAxis(0.5)).toBeGreaterThan(0)
    expect(inputAxis(-1)).toBe(-1)
    expect(approach(0, 10, 4)).toBe(4)
    expect(approach(9, 10, 4)).toBe(10)
    expect(approach(11, 10, 4)).toBe(10)
  })
})

describe('jump feel', () => {
  it('jumps about 136 logical pixels high, with coyote time and buffering', () => {
    expect(jumpApex()).toBeGreaterThan(125)
    expect(jumpApex()).toBeLessThan(145)
    expect(coyoteRemaining(TUNING.coyoteMs, false, 40)).toBe(TUNING.coyoteMs - 40)
    expect(coyoteRemaining(0, true, 40)).toBe(TUNING.coyoteMs)
    expect(jumpBufferRemaining(0, true, 16)).toBe(TUNING.jumpBufferMs)
    expect(jumpBufferRemaining(40, false, 16)).toBe(24)
    expect(cutJump(-400)).toBe(TUNING.jumpCutVelocity)
    expect(cutJump(-100)).toBe(-100)
    expect(clampFall(3000)).toBe(TUNING.maxFallSpeed)
    expect(clampFall(-300)).toBe(-300)
  })
})

describe('tap-to-shoot targeting', () => {
  it('aims from the muzzle toward the tapped world point', () => {
    const direction = aimDirection(10, 10, 40, 50)
    expect(direction.x).toBeCloseTo(0.6)
    expect(direction.y).toBeCloseTo(0.8)
    expect(aimDirection(5, 5, 5, 5)).toEqual({ x: 0, y: -1 })
    expect(muzzleOffset(1)).toEqual({ x: 22, y: -26 })
    expect(muzzleOffset(-1)).toEqual({ x: -22, y: -26 })
  })

  it('snaps to the nearest switch inside the assist radius only', () => {
    const targets = [
      { id: 'near', x: 100, y: 100 },
      { id: 'far', x: 400, y: 400 },
    ]
    expect(assistedTarget(112, 104, targets, 42)?.id).toBe('near')
    expect(assistedTarget(300, 300, targets, 42)).toBeNull()
    expect(assistedTarget(0, 0, [], 42)).toBeNull()
  })

  it('rate-limits the blaster independently of the frame rate', () => {
    let cooldown: number = SHOT.cooldownMs
    for (let frame = 0; frame < 10; frame += 1) cooldown = shotCooldownRemaining(cooldown, 16)
    expect(cooldown).toBeGreaterThan(0)
    cooldown = shotCooldownRemaining(cooldown, 1000)
    expect(cooldown).toBe(0)
    expect(shotCooldownRemaining(0, 1000)).toBe(0)
  })
})

describe('scoring', () => {
  it('awards stars for completion, all gems and a clean run', () => {
    expect(starsFor({ completed: false, allGems: true, noDamage: true })).toBe(0)
    expect(starsFor({ completed: true, allGems: false, noDamage: false })).toBe(1)
    expect(starsFor({ completed: true, allGems: true, noDamage: false })).toBe(2)
    expect(starsFor({ completed: true, allGems: true, noDamage: true })).toBe(3)
    expect(starsFor({ completed: true, allGems: false, noDamage: true })).toBe(2)
  })

  it('scores gems, enemies, speed and a clean clear', () => {
    expect(scoreForRun(0, false, 120_000, 0)).toBe(500)
    expect(scoreForRun(3, false, 60_000, 1)).toBeGreaterThan(1000)
    expect(scoreForRun(3, true, 10_000, 2)).toBeGreaterThan(scoreForRun(3, false, 10_000, 2))
  })
})
