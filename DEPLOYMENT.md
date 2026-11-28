# REFINER × THE MERCHANT — Deployment Checklist

Use this checklist to take the implementation package from the REFINER workspace into production.

**Boundary:** This environment cannot push to freebuff.page or your git remote. All deploy actions happen in your application repository, CI, and hosting account.

---

## A. Database (Supabase)

- [ ] Open Supabase SQL Editor
- [ ] Run `../REFINER_Merchant_Event_Schema.sql`
- [ ] Run `../REFINER_Merchant_Advanced_Analytics.sql`
- [ ] (Optional) Run `../REFINER_Merchant_Phase2_Settings.sql`
- [ ] Confirm tables/views/functions exist: `engagement_events`, `shelf_health_score()`, `priority_close_list()`, `health_score_snapshots`, etc.
- [ ] Schedule daily job: `SELECT public.snapshot_health_score(null);`  
      (Edge Function, pg_cron, or external cron hitting a secured endpoint)
- [ ] Adjust RLS policies if your multi-tenant / role model differs from the example policies

---

## B. Application code

- [ ] Copy `implementation/lib/*` into your `src/lib/` (or equivalent)
- [ ] Copy `implementation/components/*` into your components tree
- [ ] Fix import paths (`./supabase` → your actual client path)
- [ ] Wire `track*` calls at the sites listed in Highest Leverage Pack / README
- [ ] Mount `<HealthScoreCard />` in the sticky header (managers)
- [ ] Mount `<PriorityCloseList />` for managers
- [ ] Replace empty UIs with `EmptyZeroProducts` / `EmptyZeroUrgent` / `EmptyHistory`
- [ ] Mount `<CoachMarks />` at authenticated shell
- [ ] Call `feedbackSuccess()` after successful scan and successful close
- [ ] Implement continuous-scan behaviour (keep camera, recent barcodes) per `continuousScan.ts` notes
- [ ] Wire `useBulkSelection` + `BulkActionBar` on the product list (long-press / Select → floating bar)

---

## C. Build & quality

- [ ] Typecheck / lint pass
- [ ] Manual QA on mobile Safari + Chrome:
  - Login → Health Score visible (manager)
  - Add product via camera → event + haptic
  - Close product → event + haptic
  - Copy digest → event
  - First-run coach appears once
  - Empty states correct
- [ ] Confirm no console errors from `track` (failures must stay silent)

---

## D. Deploy

- [ ] Commit to your application repository
- [ ] Push → CI pipeline
- [ ] Deploy to staging (if you have one) → smoke test
- [ ] Deploy to production (freebuff / your host)
- [ ] Post-deploy: trigger a few real actions and verify rows in `engagement_events`
- [ ] After 24–48 h of data: call `snapshot_health_score` and confirm trend view has points

---

## E. REFINER backlog hygiene

- [ ] Open `REFINER_Merchant_Backlog.xlsx`
- [ ] Move M-001, M-002, M-004, M-005, M-006, M-009, M-010 from “In Progress — Pack Ready” → “Done” as each ships
- [ ] Note production deploy date in the README or a project log

---

## F. After first production week

- [ ] Review `v_camera_funnel_daily` and `v_health_score_trend`
- [ ] Baseline the Level-1 metrics (DAS, Urgent Resolution Rate, etc.)
- [ ] Prioritise next Phase 1/2 items from the backlog by Priority Score

---

**Package complete.**  
All highest-leverage modules and the full phase specifications are in the REFINER artifacts folder. Physical deployment is the only remaining step and must be performed from the application repository and hosting account.
