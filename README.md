# REFINER × THE MERCHANT — Implementation Package

Production-ready modules for the highest-leverage items.  
Copy into the application repository and wire to existing screens.

**Generated:** 2026-11-27  
**Live site note:** freebuff.page is read-only from the REFINER workspace. Deployment happens through your normal repo → CI → host pipeline.

---

## Contents

```
implementation/
├── README.md                 ← this file
├── lib/
│   ├── track.ts              ← engagement events (M-001)
│   ├── analytics.ts          ← Health Score + Priority Close data access
│   ├── haptics.ts            ← vibrate + optional tone (M-009)
│   └── continuousScan.ts     ← recent barcodes + continuous-scan notes (M-006)
├── components/
│   ├── HealthScoreCard.tsx   ← header card + sparkline (M-002)
│   ├── PriorityCloseList.tsx ← manager “Close first” panel
│   ├── EmptyStates.tsx       ← zero products / zero urgent / empty history (M-010)
│   ├── CoachMarks.tsx        ← first-run tips (M-004)
│   └── BulkActionBar.tsx     ← bulk multi-select close (M-005)
├── hooks/
│   └── useBulkSelection.ts   ← selection state for M-005
└── index.ts                  ← optional barrel exports
└── DEPLOYMENT.md             ← ordered checklist to production
```

---

## Prerequisites (Supabase)

1. Run `REFINER_Merchant_Event_Schema.sql`
2. Run `REFINER_Merchant_Advanced_Analytics.sql`
3. (Optional) `REFINER_Merchant_Phase2_Settings.sql`
4. Schedule daily: `SELECT public.snapshot_health_score(null);`

---

## Integration order (highest leverage)

### 1. track.ts
- Import and call at the exact sites listed in the Highest Leverage Pack.
- Non-blocking by design.

### 2. HealthScoreCard
- Place in the sticky header for **managers**.
- Pass `onOpenAnalytics` to open the Priority Close List or a future Analytics tab.

### 3. PriorityCloseList
- Manager-only panel (home or drawer).
- `onSelectProduct(id)` should open your existing product detail / close flow.

### 4. EmptyStates
- Replace current empty UI with `EmptyZeroProducts`, `EmptyZeroUrgent`, `EmptyHistory`.

### 5. CoachMarks
- Mount once at app shell level when user is authenticated.
- Add `data-coach="camera" | "urgency" | "add"` attributes to the real controls so future positioning can be refined.

### 6. Haptics + Continuous scan
- Call `feedbackSuccess()` after successful scan and after successful close.
- Keep camera alive after add; use `pushRecentBarcode` / `getRecentBarcodes` for chips.

### 7. Bulk multi-select (M-005)
- Spec is in the Highest Leverage Pack (no separate component file yet — implement against existing list).
- Long-press / Select mode → floating bar: Sold / Trashed / Out of stock.

---

## Styling notes

Components assume your existing tokens:
- `text-fresh`, `text-urgent`, `bg-gold`, `btn-gold`, `focus-ring`, `font-display`, `bg-ink`
- Dark theme, gold accent — matches current THE MERCHANT design system.

Adjust class names if your Tailwind / CSS module setup differs.

---

## Acceptance (quick)

| Item | Pass condition |
|------|----------------|
| track | Events appear in `engagement_events` within ~1 min of action |
| HealthScoreCard | Score + colour visible to manager on main screen |
| PriorityCloseList | Ranked list; tap opens close flow |
| Empty states | Correct state for zero products / zero urgent / empty history |
| CoachMarks | Shows once for new users; never again after Done/Skip |
| Haptics | Vibrate on scan + close where the browser allows |

---

## Status tracking

Update `REFINER_Merchant_Backlog.xlsx` Status column as each item lands in the real repo:
`In Progress — Pack Ready` → `In Progress` → `Done`.
