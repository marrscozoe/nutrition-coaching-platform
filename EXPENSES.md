# Nutrition Coaching Business — Operating Expenses
**Created:** July 10, 2026
**Purpose:** Comprehensive expense breakdown for online nutrition coaching business

---

## Overview

This document covers ALL costs to run an online nutrition coaching subscription business using the platform we're building. Split into:
1. **Must-Have Costs** — minimum to launch
2. **Operational Costs** — month-to-month running expenses  
3. **Growth Costs** — marketing and scaling
4. **One-Time Costs** — initial setup

---

## Must-Have Costs (Minimum Viable Product)

### Domain Name
- **amarsbodynutrition.com** (or similar)
- Cost: ~$12/year ($1/month)
- registrars: Namecheap, Google Domains, Hover

### Payment Processing
- **Stripe** (recommended)
- Fee: 2.9% + $0.30 per transaction
- Example: $97 sale → Stripe takes $3.12, you get $93.88
- No monthly fee
- Alternative: PayPal (similar fees)

### Email (Existing)
- amarsbody@gmail.com already set up — $0

### Hosting (Existing Infrastructure)
- Your Mac mini + port 3004 already running AMarsBody website
- Could host nutrition platform on same server — $0
- **Downside:** Only works when Mac mini is on (you travel)
- **Alternative:** Cloud hosting when ready

**Subtotal Minimum Monthly:** ~$1 + 2.9% per transaction

---

## Operational Costs (Month-to-Month)

### Hosting (Cloud — Recommended for Reliability)
If you want the site live 24/7 regardless of your Mac mini:

| Provider | Plan | Monthly |
|----------|------|---------|
| Railway | Starter | $5 |
| Render | Starter | $7 |
| Vercel | Hobby | $0 (limited) |
| Vercel | Pro | $20 |
| DigitalOcean | Basic Droplet | $4 |

**Recommendation:** Start free with Vercel Hobby, upgrade to $7 Render when needed.

### Database
| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| MongoDB Atlas | 512MB (够用) | $9-50/month |
| Supabase (PostgreSQL) | 500MB free | $25/month |

**Recommendation:** MongoDB Atlas free tier handles ~100 clients comfortably.

### Image Storage (Meal Photos)
Clients will upload meal pictures. Storage costs:

| Service | Free | Paid |
|---------|------|------|
| Cloudinary | 25 credits | $89/2500 credits |
| AWS S3 | 5GB | ~$0.023/GB |
| Google Cloud Storage | 5GB | ~$0.020/GB |

**Recommendation:** Cloudinary free tier (25 credits = ~2500 images) to start.

### SMS Notifications (Optional)
If clients get text reminders:

| Service | Cost |
|---------|------|
| Twilio | $0.008/msg (US) |
| MessageBird | $0.005/msg |
| Free alternative | Web app notifications only |

**Recommendation:** Skip SMS initially. Web notifications are free.

### Email Automation (Optional)
For client onboarding sequences, reminders:

| Service | Free | Paid |
|---------|------|------|
| Mailchimp | 500 contacts | $13/month |
| ConvertKit | 1000 subscribers | $29/month |
| Brevo (Sendinblue) | 300 emails/day | $19/month |

**Recommendation:** Brevo free tier to start.

### Accounting/Invoicing
| Service | Free | Paid |
|---------|------|------|
| Wave | Forever free | — |
| QuickBooks | 30 days free | $30/month |
| FreshBooks | 30 days free | $19/month |

**Recommendation:** Wave is free forever for basic invoicing.

---

## Growth Costs (When Ready to Market)

### Meta Ads (Facebook + Instagram)
This is how you'll find clients.

| Spend Level | Result |
|-------------|--------|
| $10/day ($300/month) | ~20-50 leads |
| $25/day ($750/month) | ~75-150 leads |
| $50/day ($1500/month) | ~150-300 leads |

**Industry benchmark:** Fitness nutrition coaching typically $30-80 per lead via Meta ads.

### Google Ads
| Spend Level | Clicks |
|-------------|--------|
| $10/day ($300/month) | ~100-200 clicks |
| $25/day ($750/month) | ~300-500 clicks |
| $50/day ($1500/month) | ~600-1000 clicks |

**Note:** Google tends to be more expensive per lead for fitness niches.

### Email Marketing Platform (Growth)
As list grows beyond 500:
- Mailchimp: $13/month (up to 500)
- Mailchimp: $20/month (up to 1000)
- ConvertKit: $29/month (unlimited emails)

### Landing Page / Funnel Builder
| Service | Free | Paid |
|---------|------|------|
| Carrd | — | $19/year |
| Systeme.io | Free | $27/month |
| ClickFunnels | — | $97/month |
| WordPress + Elementor | Hosting ~$5/mo | — |

**Recommendation:** Systeme.io free tier to start, upgrade when you need funnels.

---

## One-Time Setup Costs

### Logo / Brand Design
- Fiverr: $5-150
- Canva: Free (DIY)
- 99designs: $299+

### Legal / Contracts
- Client intake form: $0-50 (template)
- Terms of service: $0-200 (template or lawyer)
- Privacy policy: $0-100 (template)

### Content Creation
- Promo graphics: Canva Free
- Before/after templates: $0-20

---

## Full Monthly Cost Scenarios

### Scenario 1: Bare Minimum (Free Stuff Only)
| Item | Monthly |
|------|---------|
| Domain | $1 |
| Hosting | $0 (Mac mini) |
| Database | $0 (MongoDB free tier) |
| Payment processing | 2.9% + $0.30 |
| Image storage | $0 (Cloudinary free) |
| Email | $0 |
| **Total** | **$1 + 2.9% per transaction** |

### Scenario 2: Solid Startup (Reliable but Cheap)
| Item | Monthly |
|------|---------|
| Domain | $1 |
| Cloud hosting (Render) | $7 |
| Database (MongoDB free tier) | $0 |
| Image storage (Cloudinary free) | $0 |
| Email automation (Brevo free) | $0 |
| Accounting (Wave) | $0 |
| **Total** | **$8/month + 2.9% per transaction** |

### Scenario 3: Professional Setup
| Item | Monthly |
|------|---------|
| Domain | $1 |
| Cloud hosting (Vercel Pro) | $20 |
| Database (MongoDB 2GB) | $25 |
| Image storage | $10 |
| Email automation (Mailchimp) | $13 |
| SMS notifications | $15 |
| Accounting (Wave) | $0 |
| **Total** | **$84/month + 2.9% per transaction** |

### Scenario 4: With Active Marketing
| Item | Monthly |
|------|---------|
| Everything from Scenario 3 | $84 |
| Meta Ads | $500 |
| **Total** | **$584/month + 2.9% per transaction** |

---

## Revenue Calculator

To break even on costs:

| Monthly Expenses | Clients Needed (at $97/mo) |
|------------------|---------------------------|
| $8 (Scenario 2) | 1 client covers hosting |
| $84 (Scenario 3) | 1 client covers costs |
| $584 (with ads) | 7 clients ($97) to break even on ads |

**Profit margins at $97/month:**
- 10 clients = $970 revenue - $84 costs = **$886 profit**
- 20 clients = $1,940 revenue - $84 costs = **$1,856 profit**

**Profit margins at $197/month:**
- 10 clients = $1,970 revenue - $84 costs = **$1,886 profit**
- 20 clients = $3,940 revenue - $84 costs = **$3,856 profit**

---

## What Allen Already Has (No Extra Cost)

- Mac mini server → can host the platform
- amarsbody@gmail.com → client emails
- AMarsBody website (port 3004) → can add nutrition section
- Telegram bot → can use for client interactions
- Stripe account → payment processing ready
- Allen Dashboard (port 3007) → can add nutrition clients tab

**Existing infrastructure can support MVP at $0 additional monthly cost.**

---

## Recommendations

### Phase 1: Launch (Month 1-3)
- Use existing Mac mini hosting (free)
- MongoDB Atlas free tier
- Stripe for payments
- Telegram for client communication
- Brevo free for email
- **Monthly cost: ~$1 + 2.9% per transaction**

### Phase 2: Add Marketing (Month 3+)
- Once you have 5-10 paying clients
- Start Meta ads ($300-500/month)
- Upgrade to cloud hosting if Mac mini uptime is issue
- **Monthly cost: ~$300-600 + 2.9% per transaction**

### Phase 3: Scale (Month 6+)
- Professional setup (Scenario 3)
- Dedicated hosting
- Full email automation
- Active ad campaigns
- **Monthly cost: ~$84 + 2.9% per transaction + ad spend**

---

## Key Decisions Needed From Allen

1. **Domain name** — get amarsbodynutrition.com or use subdomain?
2. **Hosting** — Mac mini (cheap/reliable but travels with you) vs cloud (expensive but always on)?
3. **Client communication** — Telegram bot (free) vs dedicated web chat vs email only?
4. **Initial pricing** — $97 basic / $197 premium? Or different tiers?
5. **Marketing budget** — How much to spend on ads when ready?

---

## Next Steps

1. Allen reviews this document
2. We decide on Phase 1 setup
3. Bob builds the client portal + admin dashboard
4. Test with a few clients
5. Add marketing once system works

---

## Questions to Answer When Allen Returns

1. Do you want to use amarsbodynutrition.com or keep it under AMarsBody?
2. How do you want clients to contact you initially? (Telegram, email, or web portal)
3. What's your target number of clients for month 1? Month 3?
4. Do you have any existing clients who would try the online version?
5. What's your comfort level with ad spend?
