import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  cachedImageUrl,
  getImageVersion,
  initials,
  resolveProductImage,
  subscribeImages,
} from '../lib/format'

/**
 * Product image from OpenFoodFacts, 25×25 by default.
 * OpenFoodFacts image paths carry a revision segment, so the URL comes from the
 * API and lands in a module store; subscribing here re-renders the thumbnail the
 * moment it is known. Until then (or with no barcode / a failed image) a gold
 * monogram tile shows instead of a broken-image icon.
 */
export default function ProductThumb({ product, size = 25 }) {
  const barcode = product?.barcode || ''
  const version = useSyncExternalStore(subscribeImages, getImageVersion, getImageVersion)
  const url = useMemo(() => cachedImageUrl(barcode), [barcode, version])
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
    // Warm the cache; the subscription above handles the re-render.
    resolveProductImage(barcode)
  }, [barcode])

  const style = { width: size, height: size }

  if (!url || broken) {
    return (
      <span className="thumb-fallback" style={style} aria-hidden="true">
        {initials(product?.name)}
      </span>
    )
  }

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="thumb"
      style={style}
      onError={() => setBroken(true)}
    />
  )
}
