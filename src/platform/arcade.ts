import type { ArcadeSnapshot } from '../types'

interface ArcadeUser {
  id: string
  email?: string | null
  user_metadata?: { display_name?: string }
}

interface ArcadeStatus {
  text: string
  signedIn: boolean
}

interface LittleJoyArcadeGlobal {
  __installed?: boolean
  gameId?: string
  configured?: boolean
  signIn?: (email: string, password: string) => Promise<{ error: string | null }>
  signOut?: () => Promise<void>
  syncNow?: (reason?: string) => Promise<void> | void
  user?: () => ArcadeUser | null
  status?: () => ArcadeStatus
  tipJar?: { url?: string; open: () => void }
}

declare global {
  interface Window {
    LittleJoyArcade?: LittleJoyArcadeGlobal
    LJA_SNAPSHOT?: () => Record<string, string>
    LJA_APPLY_SNAPSHOT?: (keys: Record<string, string>) => void
  }
}

export const TIP_URL = 'https://www.buymeacoffee.com/jd4rider'

/**
 * The arcade's supported game integration is the drop-in client copied from
 * `packages/sdk/desktop/arcade-client.js`. This adapter only reads the public
 * surface it defines; it never invents endpoints or credentials.
 */
function client(): LittleJoyArcadeGlobal | null {
  if (typeof window === 'undefined') return null
  const arcade = window.LittleJoyArcade
  return arcade?.__installed ? arcade : null
}

export function arcadeSnapshot(): ArcadeSnapshot {
  const arcade = client()
  const user = arcade?.user?.() ?? null
  const status = arcade?.status?.()
  return {
    configured: Boolean(arcade?.configured),
    signedIn: Boolean(user),
    label: user ? user.email ?? 'Signed in' : status?.text ?? 'Local save only',
  }
}

export function arcadeAvailable(): boolean {
  return Boolean(client())
}

/** Called from results/menu only; the client owns the destination and new tab. */
export function openTipJar(): void {
  const arcade = client()
  if (arcade?.tipJar?.open) {
    arcade.tipJar.open()
    return
  }
  if (typeof window !== 'undefined') window.open(TIP_URL, '_blank', 'noopener,noreferrer')
}

/** Ask the client to push the mirrored save right now. Safe when signed out. */
export function requestArcadeSync(): void {
  const arcade = client()
  if (!arcade?.syncNow) return
  try {
    void arcade.syncNow('game-save')
  } catch {
    // Offline and guest play are normal; the local save already succeeded.
  }
}
