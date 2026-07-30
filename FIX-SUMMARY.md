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
