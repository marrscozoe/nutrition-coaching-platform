# Nutrition Program — Data Protection & IP Security

**Date:** July 19, 2026
**Status:** Initial thinking — needs Allen discussion

---

## What's At Risk

### Allen's Proprietary IP
- 30-year nutrition methodology (phases, progression rules, distress responses)
- Exact phrasing/voice Allen uses with clients
- Diet progression logic and decision trees
- "What now" scenario responses
- Meal evaluation criteria

### Client Data (PII)
- Meal pictures and logs
- Weight/body fat tracking
- Progress photos
- Personal health info
- Event goals and timelines

---

## Threats

1. **AI training scraping** — Other LLMs scraping public nutrition content to train models
2. **Competitor replication** — Other coaches/companies copying Allen's methodology
3. **Data breach** — Client data exposed
4. **Client data misuse** — Client info used for unintended purposes

---

## Protection Strategies

### For Methodology (Allen IP)

1. **Don't publish full details publicly**
   - Landing pages can describe the program, not the exact rules
   - Keep phase progression logic server-side only
   - Don't expose decision trees in accessible content

2. **Terms of Service**
   - Explicitly prohibit using data to train competing AI systems
   - "Users may not use this service or its content to train AI models"

3. **Controlled API access**
   - Only authenticated API calls, no open endpoints
   - Rate limiting to prevent bulk data extraction
   - Monitor for unusual access patterns

4. **Watermarking**
   - If using AI to generate responses, embed detectable watermarks
   - Allows tracing if content shows up elsewhere

### For Client Data

1. **Consent**
   - Clear intake form consent for data collection and service use
   - Explicit consent for AI processing of their data
   - Opt-in for any marketing or sharing

2. **Data minimization**
   - Don't store raw meal pics longer than needed for the service
   - Anonymize data for any analytics
   - Auto-delete after X months post-goal

3. **Encryption**
   - Client data encrypted at rest (database-level)
   - TLS for all data in transit

4. **Access controls**
   - Role-based access (Allen sees all, system sees necessary only)
   - Audit logs for who accessed what

### Technical Measures

1. **Bot protection**
   - robots.txt (honor system but blocks some crawlers)
   - Block known AI crawler user agents
   - Cloudflare or similar bot protection

2. **Rate limiting**
   - Prevent bulk API calls
   - Prevent mass account creation

3. **No public training data**
   - Don't let client-facing content be indexed by AI crawlers
   - Use noindex, nofollow where appropriate

4. **Data residency**
   - Keep data in US-based servers
   - GDPR/CCPA compliance consideration

---

## Questions for Allen

1. Where does he want client data hosted?
2. How long to retain client data after they cancel/finish?
3. Does he want to allow clients to export their data?
4. Any specific compliance needs? (HIPAA for health data?)
5. Does he care if his methodology is "copied" or is he more worried about client data?

---

## To Discuss Later

- Is HIPAA needed? (nutrition coaching may not be medical but involves health data)
- Should the AI responses be branded/distinctive to prevent impersonation?
- Legal disclaimers needed?
