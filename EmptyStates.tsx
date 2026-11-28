/**
 * REFINER × THE MERCHANT — Contextual empty states (M-010)
 */

type ZeroProductsProps = {
  onAdd: () => void
}

export function EmptyZeroProducts({ onAdd }: ZeroProductsProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/15 text-2xl font-bold text-gold">
        M
      </div>
      <h2 className="font-display text-xl font-bold text-white">
        Add your first product
      </h2>
      <p className="mt-2 max-w-[28ch] text-sm leading-relaxed text-stone-400">
        Scan a barcode or type a name. THE MERCHANT will warn you before anything expires.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="btn-gold focus-ring mt-6"
      >
        + Add product
      </button>
    </div>
  )
}

type ZeroUrgentProps = {
  healthScore?: number | null
}

export function EmptyZeroUrgent({ healthScore }: ZeroUrgentProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fresh">
        All clear
      </p>
      <h2 className="mt-2 font-display text-xl font-bold text-white">
        Shelf is clean
      </h2>
      <p className="mt-2 max-w-[28ch] text-sm text-stone-400">
        Nothing needs attention right now. Keep scanning new stock as it arrives.
      </p>
      {healthScore != null && (
        <p className="mt-4 text-sm text-stone-500">
          Health Score{' '}
          <span className="font-semibold text-fresh">
            {Number(healthScore).toFixed(0)}
          </span>
        </p>
      )}
    </div>
  )
}

export function EmptyHistory() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm text-stone-400">
        Products you mark sold or trashed will appear here, with an undo if you change your mind.
      </p>
    </div>
  )
}
