# Nutrition Coaching Platform - Project Summary
**Date:** July 26, 2026  
**Backup:** nutrition-coaching-platform-BACKUP-20260726-1745.tar.gz  
**App URL:** http://192.168.1.250:3002

---

## What This App Does

AMarsBody Nutrition is an AI-powered nutrition coaching platform for personal training clients. Clients log meals and weight, get instant AI coaching feedback based on their diet phase.

### Key Features
- **Meal Logging:** Snap photos or describe meals, get instant portion feedback
- **AI Coaching:** Phase-based nutrition guidance (Phase 1-4)
- **Weight Tracking:** Daily weight logging with trend analysis
- **Client/Trainer Views:** Separate interfaces for clients and trainers

### Phase Rules
- **Phase 1:** NO starch - protein + veg + fat + water
- **Phase 2:** Starch allowed Wed/Sat/Sun (first 2 meals only)
- **Phase 3:** Evaluation checkpoint - back to Phase 1 if not at goal
- **Phase 4:** Maintenance - starch allowed, gentle notices

---

## Current Status

### AI Provider Configuration
```
AI_PROVIDER=gemini
PHOTO_AI_PROVIDER=gemini
CHAT_AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.0-flash
FALLBACK_CHAIN: gemini → openai → minimax → ollama
```

### Current Problem: QUOTA EXHAUSTED
- **Gemini:** Exhausted (limit: 0) - cannot use
- **MiniMax:** Used 198 million tokens overnight - status unknown
- **OpenAI:** No API key configured
- **Ollama:** Local only, works but not for cloud

### What This Means
- Chat AI: NOT WORKING (Gemini quota exhausted)
- Photo AI: NOT WORKING (Gemini quota exhausted)
- App is essentially unusable for AI features

---

## Bugs Fixed Today (July 26)

1. **Chat Message Duplicate ID** - Rapid clicks on quick action buttons caused duplicate React keys
2. **AI Fallback Routing** - Added getFallbackResponse() to route correctly when AI fails
3. **Food Log Date Wrong** - Timezone issue: was parsing dates as UTC instead of local time
4. **Phase Coaching Messages** - Updated phase guidance for Phase 1-4
5. **Water Tracking** - Added water tracking with per-meal oz requirements
6. **Portion Sizes Gender-Aware** - Male: 2tbsp fat, 1/2 avocado; Female: 1-2tbsp fat, 1/4 avocado
7. **Home Tab Display** - Shows current phase, CAN/CANNOT eat, water guidance, example meals
8. **Chat Race Condition** - Changed to functional state updates (setMessages(prev => ...))
9. **alert() Replacements** - Replaced with success banners in trainer pages
10. **PullToRefresh z-index** - Fixed visual glitch with bottom nav

---

## Bugs Still Remaining (from Tim's Testing)

### High Priority
1. **AI Chat API failing** - Gemini quota exhausted, fallback chain broken (no OpenAI key)

### Medium Priority
2. **Trainer alert() still broken** - /onboarding/page.tsx line 73 still uses alert()
3. **No auto-refresh on homepage** - Data doesn't refresh when navigating back

### Low Priority / By Design
4. **Password in URL** - FIXED (was security issue, now uses token)
5. **Quick action buttons** - FIXED (now auto-send)
6. **Weight logging localStorage** - FIXED
7. **Starting weight edit** - FIXED

---

## Files Modified Today

### Core Files
- `src/lib/ai-coach.ts` - AI coaching logic, phase rules, water tracking
- `src/app/client/chat/page.tsx` - Chat UI, message IDs, date parsing
- `src/app/client/log/page.tsx` - Meal logging, date selection
- `src/app/client/page.tsx` - Home tab with phase guidance
- `src/app/client/weight/page.tsx` - Weight tracking
- `src/app/client/profile/page.tsx` - Profile settings

### Trainer Pages
- `src/app/trainer/clients/[id]/page.tsx` - alert() replaced
- `src/app/trainer/settings/page.tsx` - alert() replaced
- `src/app/trainer/signup/page.tsx` - alert() replaced
- `src/app/onboarding/page.tsx` - PARTIALLY fixed (success message added, alert() still on line 73)

### Config Files
- `.env` - GEMINI_MODEL changed from gemini-1.5-flash to gemini-2.0-flash
- `.env` - GEMINI_API_KEY is set (key: AQ.Ab8RN6KNeS4fyjwLxv8S0lPIi1otg_U9mizuhadhPaB3H67jrg)

---

## What To Do When Gemini Works Again

### 1. Test AI Features
- [ ] Test chat with "What can I eat?" quick action
- [ ] Test chat with "Motivate me!" quick action
- [ ] Test meal logging with Phase 1 violation (should warn about starch)
- [ ] Test meal logging with Phase 2 on Wednesday (should allow starch)
- [ ] Test weight logging and coaching response

### 2. Verify Phase Coaching
- [ ] Phase 1: Log chicken + rice + broccoli → should warn NO STARCH
- [ ] Phase 2: Log starch on Wed → should allow with portion guidance
- [ ] Phase 2: Log starch on Mon → should warn about starch restriction
- [ ] Phase 3: Log anything → should say evaluation checkpoint
- [ ] Phase 4: Log chicken + rice → should give gentle notice (not warning)

### 3. Complete Bug Fixes
- [ ] Fix alert() in /onboarding/page.tsx line 73
- [ ] Add auto-refresh on homepage (visibility change handler)
- [ ] Verify all other fixes still work after restart

### 4. Performance/Production Readiness
- [ ] Set up proper AI provider with available quota (not MiniMax - it burns too fast)
- [ ] Consider OpenAI as backup provider with API key
- [ ] Implement rate limiting to prevent quota exhaustion
- [ ] Add usage monitoring/cost tracking

---

## Known Issues & Lessons Learned

### Token Burn Incident (July 18, 2026)
- Changed heartbeat config without backup → 24M+ tokens burned
- M2.5 heartbeat caused failures → triggered dreaming subagents
- NEVER change config without backing up first

### Photo Check Cron Burn (July 26, 2026)
- Cron job checking photo analysis every 30 seconds
- Burned 198 million tokens on MiniMax overnight
- Had to turn off desktop to reset MiniMax
- Gemini quota also exhausted (photo analysis uses Gemini)
- LESSON: Don't set up frequent checks without considering token cost

### Critical Rules
1. NEVER delete/change files without backup first
2. ALWAYS think through token/API costs before setting up automation
3. NEVER trust that "free tier" means "unlimited"
4. Test automation with dry-run or limited scope before full deployment

---

## Environment & Access

### API Keys (in .env)
- Gemini: AQ.Ab8RN6KNeS4fyjwLxv8S0lPIi1otg_U9mizuhadhPaB3H67jrg
- Redis (Upstash): https://profound-eagle-181915.upstash.io

### Port & URL
- App runs on port 3002
- URL: http://192.168.1.250:3002
- Local: http://localhost:3002

### Database
- Redis (Upstash) for persistence
- SQL.js for local caching

---

## Next Steps

1. **Wait for Gemini quota reset** (typically midnight Pacific time)
2. **Test Gemini API** to verify it works again
3. **Complete remaining bug fixes** (onboarding alert(), auto-refresh)
4. **Test all AI features** thoroughly before declaring app usable
5. **Consider production AI setup** (OpenAI or paid Gemini) only AFTER app is fully working

---

*Last updated: July 26, 2026 5:45 PM CDT*
