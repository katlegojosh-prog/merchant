/**
 * REFINER × THE MERCHANT — Bulk selection state (M-005)
 */

import { useCallback, useMemo, useState } from 'react'

export function useBulkSelection<T extends string = string>() {
  const [selected, setSelected] = useState<Set<T>>(new Set())
  const [active, setActive] = useState(false)

  const enter = useCallback(() => setActive(true), [])
  const exit = useCallback(() => {
    setActive(false)
    setSelected(new Set())
  }, [])

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback((ids: T[]) => {
    setSelected(new Set(ids))
    setActive(true)
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const isSelected = useCallback((id: T) => selected.has(id), [selected])

  const count = selected.size
  const ids = useMemo(() => Array.from(selected), [selected])

  return {
    active,
    selected,
    ids,
    count,
    enter,
    exit,
    toggle,
    selectAll,
    clear,
    isSelected,
  }
}
