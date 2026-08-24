# Nutrition Coaching Platform - Features to Build

## Remaining Features

---

## 1. Client & Trainer Account Management

**Overview:** Allow clients and trainers to change their own login (email) and password.

**What's Needed:**
- Both clients and trainers can update their own email/password
- Secure password change flow (verify current password first)
- Email change requires verification (send confirmation link)
- Trainer settings page has profile edit options
- Client settings page has profile edit options

**Implementation Tasks:**
1. Add change password flow to trainer settings
2. Add change password flow to client settings
3. Add change email flow (with verification)
4. Secure password hashing (bcrypt)

---

## 2. Bacon Tracking

**Overview:** Bacon is only allowed if it is **low sodium AND nitrate-free**. Only then is it allowed twice per week as a protein + fat source.

**Problem:** Current keyword detection just looks for "bacon" and can't automatically know if the bacon is low sodium nitrate-free or not.

**Solution:**
- Remove bacon from automatic "allowed" list
- When client logs bacon, AI asks: "Was it low sodium nitrate-free?"
- If yes → allowed (counts toward twice per week)
- If no → flagged as violation

**Implementation Tasks:**
1. Remove "Bacon (nitrate-free, twice per week)" from LEAN_PROTEINS
2. Update AI prompt to ask about bacon quality when mentioned
3. Track bacon intake per client per week
4. Warn if client exceeds twice-per-week limit

---

## 3. Stripe Billing

**Overview:** Enable real payment processing for the nutrition coaching platform.

**Current State:** Beta mode - billing disabled, all accounts have free access.

**What's Needed:**
- Stripe integration for monthly subscriptions
- Trainer sets their own price above a floor rate
- System tracks active/inactive subscriptions
- Handle failed payments, cancellations, refunds

**Trainer Billing Model:**
- Floor rate: $15-20/month per client (covers platform costs)
- Trainer charges whatever they want above floor
- Trainer keeps 100% of markup

**Implementation Tasks:**
1. Add Stripe integration to platform
2. Create subscription management for trainers
3. Add billing settings to trainer dashboard
4. Handle webhook events (payment success/failure, cancellation)
5. Show subscription status in client/trainer views

---

## 4. White Label

**Overview:** Allow trainers to have their own branded subdomain and custom pricing.

**What's Needed:**
- Custom subdomain: `trainername.nutrition.amarsbody.com`
- Trainer sets their own brand color
- Trainer sets their own pricing (above floor)
- Each trainer sees their own branding throughout the app

**Implementation Tasks:**
1. Set up subdomain routing for white label accounts
2. Add custom branding settings (color, business name)
3. Trainer can set their own monthly price
4. Apply trainer branding throughout client experience
5. Contact amarsbody@gmail.com to set up subdomain

---

## Completed Features

- Phase 2 violation logic (dairy/sugar checks active)
- Phase 4 portion tracking (dairy/sugar portions, processed food limits)
- Food lists expanded (starches, vegetables, proteins)
- Processed foods, sugar, dairy blocked in Phase 1
- Program choices updated ("Get Shredded" etc)
- Corrections feature removed from trainer UI
