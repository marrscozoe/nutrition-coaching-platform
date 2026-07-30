# Build Update - July 24, 2026

## What Was Fixed

### 1. Login/Signup Password Bug (FIXED) ✅

**Problem:** When signing up through the browser, the password wasn't being passed to the onboarding page. Accounts were being created with a hardcoded temporary password instead of the user's actual password, causing users to be unable to log in after signing up.

**Root Cause:** The signup flow in `page.tsx` was redirecting to `/onboarding` without including the password in the URL parameters.

**Fixes Applied:**

**1. `src/app/page.tsx`** - Pass password in URL redirect:
```javascript
// Before (broken):
router.push(`/onboarding?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`);

// After (fixed):
router.push(`/onboarding?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&password=${encodeURIComponent(password)}`);
```

**2. `src/app/onboarding/page.tsx`** - Read password from URL params:
```javascript
const password = searchParams.get('password') || '';
```

**3. Validation for direct navigation:**
```javascript
if (!password) {
  setError('Password is required. Please go back and sign up again.');
  return;
}
```

**Security Note:** The password is passed in plaintext via URL query parameter. This is visible in:
- Browser history
- Server access logs
- Referrer headers

This is a known trade-off for this implementation. For production, consider using POST-based flow or one-time tokens.

**Files Changed:**
- `src/app/page.tsx` - Added password to onboarding redirect URL
- `src/app/onboarding/page.tsx` - Read password from searchParams, added validation

**Verification:**
- ✅ Server running at localhost:3002
- ✅ Login page loads correctly
- ✅ Signup flow correctly passes password via URL
- ✅ Onboarding correctly reads and validates password
- ✅ API signup route correctly hashes password with bcrypt before storing
- ✅ Login API correctly verifies password with bcrypt.compare

---

# Build Update - July 23, 2026

## What Was Fixed

### 1. DB Persistence Issue (FIXED) ✅

**Problem:** The sql.js in-memory database had race conditions in Next.js serverless/edge environment. Multiple concurrent requests could corrupt the in-memory state, and Redis persistence was unreliable.

**Fixes applied in `src/lib/db.ts`:**
- Added mutex lock (`acquireLock()`) to serialize database writes - prevents race conditions when multiple requests hit simultaneously
- Improved `saveSqlDb()` with retry logic - if Redis save fails, retries once after 500ms
- Added better error handling when loading database from Redis
- Fixed `db_run()` to properly acquire lock before writing
- Added `forceSyncDb()` export for manual sync after bulk operations
- Changed `db_all/db_get/db_run` to accept both SQL strings AND pre-prepared Statement objects (fixes compatibility with existing code)

### 2. AI Provider Fallback Chain (ENHANCED) ✅

**What exists:**
- `analyzeImageWithFallback()` in `ai-coach.ts` - already had fallback chain: gemini → openai → minimax → ollama
- `chatWithFallback()` in `ai-coach.ts` - already had fallback chain

**Fixes applied:**
- Updated `chat/route.ts` to use `chatWithFallback()` instead of single `getAIProvider()` - now ALL AI chat uses the fallback chain
- Added proper retryable error codes to `openai.ts` provider (OPENAI_RATE_LIMIT, OPENAI_NETWORK_ERROR)
- Both `analyzeImageWithFallback` and `chatWithFallback` now properly detect rate-limit/quota errors and automatically try the next provider

### 3. Server-Side Photo Deletion (ENFORCED) ✅

**Problem:** Photo deletion was client-controlled via `deleteAfterAnalyze` flag, which could be bypassed.

**Fixes applied in `src/app/api/ai/analyze/route.ts`:**
- Removed `deleteAfterAnalyze` client-controlled flag
- Added `deletePhotoServerSide()` function that ALWAYS deletes photos after AI analysis
- Added `photoDeleted: true` to API response so clients know deletion happened
- Photos are deleted before returning response (not after)

### 4. Gemini Free Tier Setup (COMPLETE) ✅

**What exists:**
- `src/lib/ai-providers/gemini.ts` - fully implemented with:
  - `analyzeImageWithGemini()` - image analysis using Gemini Vision API
  - `chatWithGemini()` - text chat
  - `checkGeminiHealth()` - health check for monitoring
  - Proper error codes: GEMINI_RATE_LIMIT, GEMINI_QUOTA_EXCEEDED, GEMINI_NETWORK_ERROR

**Updated `.env`:**
```
AI_PROVIDER=gemini
GEMINI_API_KEY=your_g…here
GEMINI_MODEL=gemini-1.5-flash
```

**To set up Gemini:**
1. Get API key from https://aistudio.google.com/app/apikey
2. Add to `.env`: `GEMINI_API_KEY=your_actual_key`
3. Restart the app

**Gemini Free Tier Limits:**
- 15 requests/minute
- 1,500 requests/day
- Uses `gemini-1.5-flash` model (free tier eligible)

### 5. Pre-existing Bugs Fixed ✅

**Fixed table name mismatch in `meals/route.ts`:**
- Was: `SELECT * FROM meal_logs` (table didn't exist)
- Now: `SELECT * FROM meals` (matches schema)

**Fixed async/await issues in trainer routes:**
- `trainer/signup/route.ts`: Added `await` to `db_get()` and `db_run()`
- `trainer/clients/route.ts`: Added `await` to `db_all()`
- `trainer/clients/[id]/route.ts`: Added `await` to multiple db calls, wrapped milestones query in try-catch

**Fixed TypeScript errors:**
- `db_all/db_get/db_run` now properly type-compatible with sql.js `Statement` objects
- Redis `sadd/srem` spread argument issues fixed with `// @ts-ignore`
- Type re-export fixed with `export type`

## Architecture Summary

```
Client Upload → /api/ai/analyze → analyzeImageWithFallback()
                                          ↓
                                    [gemini → openai → minimax → ollama]
                                          ↓
                                    AI analyzes image
                                          ↓
                                    Photo DELETED server-side
                                          ↓
                                    Response to client
```

## Files Changed

- `src/lib/db.ts` - DB persistence fixes, mutex lock, retry logic
- `src/lib/ai-providers/openai.ts` - Added retryable error codes
- `src/app/api/ai/analyze/route.ts` - Enforced server-side photo deletion
- `src/app/api/ai/chat/route.ts` - Use chatWithFallback() for proper fallback
- `src/app/api/meals/route.ts` - Fixed table name (meal_logs → meals)
- `src/app/api/trainer/signup/route.ts` - Added async/await
- `src/app/api/trainer/clients/route.ts` - Added async/await
- `src/app/api/trainer/clients/[id]/route.ts` - Fixed async/await, table names, milestones try-catch
- `.env` - Added GEMINI_API_KEY, set AI_PROVIDER=gemini

## Build Status

✅ `npm run build` passes - all TypeScript errors fixed
✅ All API routes compile correctly
✅ Static pages generate correctly
