/**
 * REFINER × THE MERCHANT — Haptic + optional sound (M-009)
 */

export function vibrateSuccess(ms = 15): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms)
    }
  } catch {
    // ignore
  }
}

/** Very short success tone. Respects reduced-motion / no Autoplay policy failures. */
export function playSuccessTone(): void {
  try {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.value = 0.04
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    osc.stop(ctx.currentTime + 0.09)
    setTimeout(() => ctx.close(), 150)
  } catch {
    // autoplay blocked or unsupported — fine
  }
}

export function feedbackSuccess(options?: { sound?: boolean }): void {
  vibrateSuccess()
  if (options?.sound !== false) playSuccessTone()
}
