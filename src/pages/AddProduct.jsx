import { useState } from 'react'
import { Minus, Plus, Scan } from 'lucide-react'
import Scanner from '../components/Scanner'
import ProductThumb from '../components/ProductThumb'
import { addProduct, lookupBarcode } from '../lib/store'

function todayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export default function AddProduct({ onCancel, onSaved }) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [expiry, setExpiry] = useState(todayISO())
  const [barcode, setBarcode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [size, setSize] = useState('')

  async function handleScan(code) {
    setScanning(false)
    setBarcode(code)
    setNote('Looking up product…')
    try {
      const result = await lookupBarcode(code)
      if (result?.name) {
        setName(result.name)
        const meta = [result.brands, result.packSize].filter(Boolean).join(' · ')
        setNote(`Found on OpenFoodFacts${meta ? ` — ${meta}` : ''}`)
      } else {
        setNote('No product found for that barcode — type the name.')
      }
    } catch {
      setNote('Lookup failed — type the name.')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Enter a product name.')
      return
    }
    if (!expiry) {
      setError('Pick an expiry date.')
      return
    }
    setBusy(true)
    const trimmedName = name.trim()
    try {
      await addProduct({
        name: trimmedName,
        size: size.trim(),
        quantity,
        expiry_date: expiry,
        barcode: barcode.trim(),
      })
      onSaved(trimmedName)
    } catch (err) {
      setError(err.message || 'Could not save the product.')
    } finally {
      setBusy(false)
    }
  }

  const preview = { name, size, barcode }

  return (
    <div className="app-shell pb-8">
      <header className="flex items-center justify-between px-5 pb-2 pt-6">
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring -ml-2 h-12 rounded-lg px-2 text-sm font-semibold text-stone-400"
        >
          ← Back
        </button>
        <h1 className="font-display text-base font-semibold text-white">Add product</h1>
        <span className="w-12" aria-hidden="true" />
      </header>

      <form onSubmit={handleSubmit} className="space-y-5 px-5 pt-6">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-xs font-medium text-stone-400">
            Product name
          </label>
          <div className="flex items-center gap-3">
            <ProductThumb product={preview} size={40} />
            <input
              id="name"
              className="field focus-ring"
              placeholder="e.g. Milk"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>
          {note && <p className="text-[11px] leading-relaxed text-stone-500">{note}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="size" className="text-xs font-medium text-stone-400">
            Size
          </label>
          <input
            id="size"
            className="field focus-ring"
            placeholder="e.g. 12oz, 500g"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-stone-400">Quantity</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Minus className="h-4 w-4 text-stone-300" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              aria-label="Quantity"
              className="field focus-ring text-center tabular-nums"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
            <button
              type="button"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4 text-stone-300" />
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="expiry" className="text-xs font-medium text-stone-400">
            Expiry date
          </label>
          <input
            id="expiry"
            type="date"
            className="field focus-ring"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        </div>

        <button type="button" onClick={() => setScanning(true)} className="btn-ghost-inset focus-ring">
          <Scan className="h-4 w-4 text-stone-300" /> Scan barcode
        </button>
        {barcode && <p className="text-[11px] text-stone-500">Barcode: {barcode}</p>}

        {error && (
          <p role="alert" className="rounded-lg bg-urgent/10 px-3 py-2 text-sm text-urgent">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-gold focus-ring disabled:opacity-60">
          {busy ? 'Saving…' : 'Save product'}
        </button>
      </form>

      {scanning && <Scanner onResult={handleScan} onClose={() => setScanning(false)} />}
    </div>
  )
}
