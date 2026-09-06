# Grocery v2 Verification — Tim Test (2026-09-06)

## Environment
- Account: testclient_delet_test@test.com (tree nuts allergy)
- Phase: get_shredded Phase 4 (starch allowed)
- URL: https://nutrition-coaching-platform.vercel.app/client/grocery

## Commit
`bedb0be5` — feat: grocery one-list v2 — 12-meal countdown + checklist + notes

## Vercel Production
- URL: https://nutrition-coaching-platform-j7o8bmudm-marrscozoes-projects.vercel.app → nutrition-coaching-platform.vercel.app
- Status: ● Ready

## Database Migration Applied
- Migration 20260906000001_grocery_v2_tables.sql: Created `client_grocery_lists` table + added `shop_amount`/`unit` cols to `client_grocery_items`
- Migration 20260906000002_fix_service_role_perms.sql: Granted service_role access to both tables

## Test Results

### ✅ Phase-appropriate food tabs
- Protein, Veggies, Starch, Fats, Eggs tabs all visible and selectable

### ✅ Fats section — tree nuts allergy filter
- Fats shows: Avocado, Olive oil, Safflower oil, MCT oil (in coffee)
- NO nuts (Almonds, Mixed nuts, Walnuts) — correct for tree nuts allergy

### ✅ Starch section — Phase 4 shows starch items
- Starch tab shows: Red potatoes, Sweet potatoes, Rice varieties, Oats, Legumes, Squash, etc.

### ✅ Countdown decrement — ADD ITEM flow
- Added Chicken breast 2 lb via POST /api/grocery/items
- Protein total: 4.5 lb → remaining showed 2.5 lb (4.5 − 2 = 2.5) ✅
- After editable total adjustment (PATCH /api/grocery/list with protein_lb=6):
  remaining recalculated as 4.0 lb (6 − 2 = 4) ✅

### ✅ Your List — checklist with checkboxes
- Shows "✅ Your List (0/96)" with full item list
- Checked an item → count updated to (1/96) ✅

### ✅ Checked state persistence after reload
- After window.location.reload(): "✅ Your List (1/96)" ✅

### ✅ Editable totals — click button → spinbutton
- Tapped "4.5 lb" protein button → became spinbutton ✅
- Changed value to 6 lb → PATCH /api/grocery/list saved adjusted_totals ✅
- After reload: protein showed "6 lb" (persisted) ✅

### ✅ API Endpoints
- GET /api/grocery/list → 200 OK (returns items + adjustedTotals)
- POST /api/grocery/items → 200 OK (inserts item with shop_amount + unit)
- PATCH /api/grocery/list → 200 OK (saves adjusted_totals)

## Cleanup
- Deleted test Chicken breast (shop_amount=2 lb)
- Reset adjusted_totals to all zeros
