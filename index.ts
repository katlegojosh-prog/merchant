/**
 * REFINER × THE MERCHANT — Implementation package barrel
 * Optional: re-export for cleaner imports.
 */

export { track, trackSessionStart, trackSessionEnd, trackProductAdded, trackStatusChanged, trackDigestCopied, trackCameraOpened, trackBarcodeSuccess, trackBarcodeFail } from './lib/track'
export type { EventType, TrackOptions } from './lib/track'

export {
  fetchHealthScore,
  fetchHealthTrend,
  fetchPriorityCloseList,
  healthScoreTone,
} from './lib/analytics'
export type { HealthScore, HealthTrendPoint, PriorityCloseItem } from './lib/analytics'

export { vibrateSuccess, playSuccessTone, feedbackSuccess } from './lib/haptics'
export { pushRecentBarcode, getRecentBarcodes, clearRecentBarcodes } from './lib/continuousScan'

export { HealthScoreCard } from './components/HealthScoreCard'
export { PriorityCloseList } from './components/PriorityCloseList'
export { EmptyZeroProducts, EmptyZeroUrgent, EmptyHistory } from './components/EmptyStates'
export { CoachMarks } from './components/CoachMarks'
export { BulkActionBar } from './components/BulkActionBar'
export type { BulkCloseStatus } from './components/BulkActionBar'

export { useBulkSelection } from './hooks/useBulkSelection'
