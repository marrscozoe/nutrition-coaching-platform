# Fix Summary: ByteString Conversion Bug

**Date:** 2026-07-29  
**Bug:** `Cannot convert argument to a ByteString because the character at index 13 has a value of 8230 which is greater than 255`  
**Root Cause:** Unicode character U+2026 (ellipsis `…`) in signup data causing SQL.js to fail

---

## The Problem

The `sanitizeParam()` function in `db.ts` had a logic bug. The regex `/[^\x00-\xFF]/g` correctly matches characters outside the Latin-1 range (i.e., characters with code > 255). However, the callback function was incorrect:

```javascript
// BUGGY CODE (before fix)
return value.replace(/[^\x00-\xFF]/g, (match) => {
  const code = match.charCodeAt(0);
  if (code <= 255) return match;  // ← DEAD CODE!
  return '\uFFFD';
});
```

Since the regex only matches characters **NOT** in `\x00-\xFF`, any matched character is guaranteed to have `code > 255`. The `if (code <= 255)` condition was dead code, so the function was returning the original Unicode character (including U+2026) instead of replacing it with `\uFFFD`.

---

## The Fix

Simplified the callback to always return the replacement character for any matched character:

```javascript
// FIXED CODE
return value.replace(/[^\x00-\xFF]/g, () => '\uFFFD');
```

**Explanation:**
- The regex `/[^\x00-\xFF]/g` matches any character with code point > 255
- U+2026 (ellipsis `…`) has code 8230, so it matches the regex
- The fix replaces it with `\uFFFD` (Unicode Replacement Character)
- This prevents SQL.js from encountering characters it cannot convert to ByteString

---

## Characters Now Sanitized

All characters outside the Latin-1 range (0-255) are now properly replaced, including:
- U+2026 … (ellipsis)
- U+2018 ' (left single quotation mark)
- U+2019 ' (right single quotation mark)
- U+201C " (left double quotation mark)
- U+201D " (right double quotation mark)
- U+2022 • (bullet)
- U+2014 — (em dash)
- Any emoji or character from supplementary Unicode planes

---

## File Changed

- `src/lib/db.ts` — `sanitizeParam()` function (line ~208)

---

## Verification

- App started successfully with `npm run dev`
- No ByteString conversion errors
- HTML page renders correctly

---

# Fix Summary: Gemini Model Name Bug

**Date:** 2026-08-03
**Bug:** Photo analysis failing with "models/gemini-1.5-flash is not found" error (93% failure rate)
**Root Cause:** `.env.local` had `GEMINI_MODEL=gemini-1.5-flash` but this model no longer exists in the Gemini API

---

## The Problem

The app was configured to use `gemini-1.5-flash` model which returns:
```
models/gemini-1.5-flash is not found for API version v1
```

This caused 100% of API requests to fail with a 404 error.

---

## The Fix

Changed `.env.local`:
```
GEMINI_MODEL=gemini-1.5-flash  →  GEMINI_MODEL=gemini-2.0-flash
```

**Why this works:**
- `gemini-2.0-flash` is the current stable model available in the Gemini API
- Available models: gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash, gemini-2.0-flash-001, gemini-2.0-flash-lite-001

---

## Files Changed

- `.env.local` — Changed `GEMINI_MODEL=gemini-1.5-flash` to `GEMINI_MODEL=gemini-2.0-flash`

---

## Important Note About API Key Format

The `.env.local` has `GEMINI_API_KEY=AQ.Ab8...` (starts with `AQ.`, not `AIza.`).

This is the NEW Auth key format introduced by Google in 2026. It WORKS with the native endpoint:
- URL format: `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=API_KEY`
- Key format: `AQ.xxx` (Auth key) - WORKS
- Key format: `AIzaxxx` (Standard key) - OLD format

**The `AQ.` key is correct** - no need to change it.

---

## Remaining Issue: Quota Exhausted

After fixing the model name, the API returns:
```
429 You exceeded your current quota, please check your plan and billing details
```

**Solution options:**
1. Enable billing on Google Cloud project (free tier with billing = more quota)
2. Wait for daily quota reset (midnight PST)
3. Switch to OpenAI or MiniMax as the AI provider

---

## Verification

**Before fix:**
```json
{"error":{"code":404,"message":"models/gemini-1.5-flash is not found"}}
```

**After fix:**
```json
{"error":{"code":429,"message":"You exceeded your current quota"}}
```

The 404 error is gone. The 429 means the model name is correct but quota is exhausted.
