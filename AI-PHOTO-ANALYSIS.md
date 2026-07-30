# AI Photo Analysis - Options & Architecture

**Last Updated:** July 23, 2026

---

## Current Setup (Testing Phase)

**How it works:**
- Client uploads photo → saved to `/uploads/pending/`
- Zoe processes via cron job every 30 seconds using MiniMax
- Response saved to `/uploads/results/`
- App polls for result

**Issues:**
- Not real-time (30+ second delay)
- File-based workaround, not proper API integration
- Works for testing, not ideal for production

---

## Production Architecture: Pluggable AI Providers

**The Goal:** Swap AI providers by changing API key, not rewriting code.

**Architecture (from NOTES.md):**
- AI connector/adapter handles provider-specific communication
- Same prompts work with any AI provider
- Change AI provider without rewriting platform logic

**Location:** `/src/lib/ai-providers/` directory
- Already has: `minimax.ts`, `openai.ts`, `ollama.ts`
- Need to add: Provider implementations as needed

---

## AI Provider Options

### Option 1: Keep MiniMax

**Cost:** $10/month (Zoe's subscription - shared)

**Pros:**
- Works now, no additional setup
- Zoe has access

**Cons:**
- No proper serverless API for production
- File-based workaround is janky
- Not scalable for many clients

**Verdict:** Good for testing, NOT for production

---

### Option 2: OpenAI GPT-4 Vision

**Cost:** Pay-per-use
- $0.004 per image analyzed
- 1,000 images = $4
- 15,000 images (50 clients × 150 photos) = $60/month

**Pros:**
- Proven, reliable
- Excellent vision understanding
- Easy integration

**Cons:**
- Costs money per photo
- Need OpenAI API key

**Verdict:** Good production option, reliable

---

### Option 3: Google Gemini Vision

**Cost:** Free tier available
- 15 requests/min, 1,500 requests/day
- Beyond free: pay-per-use pricing

**Pros:**
- FREE tier for moderate use
- Very capable vision
- Google account already exists (for AMarsBody)

**Cons:**
- Need to monitor usage to stay in free tier
- API key needed

**Cost if exceeding free tier:**
- ~same as OpenAI pricing
- ~$30-60/month for 50 clients

**Verdict:** BEST for production start - use free tier, upgrade if needed

---

### Option 4: Anthropic Claude Vision

**Cost:** $20/month for Pro (includes API access)

**Pros:**
- Excellent vision understanding
- Well-documented API

**Cons:**
- More expensive than alternatives
- $20/month even if barely used

**Verdict:** Viable but expensive for this use case

---

### Option 5: Local Ollama (llava/bakllava)

**Cost:** Free (runs locally)

**Pros:**
- No API costs
- Private (all data stays local)
- No internet dependency

**Cons:**
- Mac mini must be running 24/7
- Slower than cloud APIs
- Limited to Mac mini's capacity
- Need vision-capable model (llava or bakllava)

**Verdict:** Good for personal use, not for scaling

---

## Cost Comparison (Monthly)

Assuming 50 clients, 150 photos/client/month = 7,500 photos/month

| Provider | Cost/Month | Notes |
|----------|------------|-------|
| MiniMax (Zoe) | $0 extra | Shared subscription, janky for prod |
| Gemini Vision | $0-30 | Free tier covers most use |
| OpenAI GPT-4V | $30-60 | Reliable, pay-per-use |
| Claude Vision | $20+ | Flat rate, expensive |
| Ollama (local) | $0 | Mac mini must run 24/7 |

---

## Photo Volume Estimates

**Per client:**
- 3 meals + snacks/day × 30 days = 90-150 photos/month
- Average: ~150 photos/month/client

**Business scenarios:**

| Clients | Photos/Month | Gemini (Free) | OpenAI GPT-4V |
|---------|-------------|---------------|---------------|
| 10 | 1,500 | $0 | $6 |
| 25 | 3,750 | $0* | $15 |
| 50 | 7,500 | $0* | $30 |
| 100 | 15,000 | $30* | $60 |

*May exceed free tier limits

---

## Recommended Approach

### Phase 1: Testing (NOW)
- Use Zoe's MiniMax with file-based system
- Works well enough to test the app flow
- Fix database persistence issue first

### Phase 2: Production Launch
- Switch to Google Gemini Vision (free tier)
- Implement proper API integration (not file-based)
- Monitor usage, stay in free tier if possible

### Phase 3: Scale (if needed)
- If Gemini free tier exceeded:
  - Option A: Pay for Gemini API (~same as OpenAI)
  - Option B: Switch to OpenAI GPT-4 Vision
- Both are easy to swap in via pluggable architecture

---

## Implementation Checklist

### For Testing:
- [x] File-based photo analysis with Zoe
- [x] Cron job to process photos
- [ ] Test full flow: upload → analyze → response

### For Production:
- [ ] Create proper AI provider interface
- [ ] Implement Gemini Vision provider
- [ ] Remove file-based system
- [ ] Real-time API integration
- [ ] Add API key to environment variables

### Pluggable Architecture:
- [x] `src/lib/ai-providers/minimax.ts` exists
- [x] `src/lib/ai-providers/openai.ts` exists
- [x] `src/lib/ai-providers/ollama.ts` exists
- [ ] `src/lib/ai-providers/gemini.ts` needs to be created
- [ ] Update `src/lib/ai-coach.ts` to register providers

---

## Environment Variables Needed (Production)

```bash
# For Gemini Vision
GEMINI_API_KEY=your_gemini_api_key_here

# For OpenAI (alternative)
OPENAI_API_KEY=your_openai_api_key_here

# For Claude (alternative)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

---

## Key Insight

**The architecture supports pluggable AI.** The app doesn't care which AI processes photos. Just update the provider implementation and swap the API key.

**Testing phase:** Use Zoe's MiniMax (works now)
**Production phase:** Use Gemini Vision (free tier) or OpenAI GPT-4V (paid)

Both are 2-3 hours of work to implement properly once database is fixed.
