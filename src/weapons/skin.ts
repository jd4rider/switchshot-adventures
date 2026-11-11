import { BLASTER_SKINS } from '../data/blasters'
import { loadSave } from '../core/save'

export function skinTint(): number {
  const save = loadSave()
  return BLASTER_SKINS.find((skin) => skin.id === save.blasterSkin)?.tint ?? 0xffffff
}

export function skinName(): string {
  const save = loadSave()
  return BLASTER_SKINS.find((skin) => skin.id === save.blasterSkin)?.name ?? 'Classic Brass'
}
