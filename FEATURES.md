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

**Overview:** Allow trainers AND gyms to have their own branded subdomain and custom pricing.

**What's Needed:**
- Custom subdomain: `trainername.nutrition.amarsbody.com` or `gymname.nutrition.amarsbody.com`
- Each partner sets their own brand color
- Each partner sets their own pricing (above floor)
- Each partner sees their own branding throughout the app
- Both trainers and gyms can have white label accounts

**Implementation Tasks:**
1. Set up subdomain routing for white label accounts
2. Add custom branding settings (color, business name)
3. Partner can set their own monthly price
4. Apply partner branding throughout client experience
5. Contact amarsbody@gmail.com to set up subdomain

---

## 5. Progress Photos

**Overview:** Allow clients to upload progress photos that trainers can review.

**What's Needed:**
- Clients can upload photos (front, side, back views)
- Photos stored securely
- Trainer can view client's photo history
- Timeline view to compare progress over time

**Implementation Tasks:**
1. Add photo upload UI to client app
2. Set up photo storage (Supabase storage)
3. Create photo gallery/timeline view
4. Trainer can view client photos

---

## 6. Weekly Digest for Trainer

**Overview:** Automated weekly summary showing each client's progress, compliance, and issues.

**What's Needed:**
- Weekly email or in-app digest for trainer
- Shows: weight changes, meal log compliance, violations, at-risk clients
- Flag clients who are struggling or falling off

**Implementation Tasks:**
1. Build weekly summary logic
2. Create digest template
3. Email delivery system (or in-app notification)
4. Flag at-risk clients automatically

---

## 7. Push Notifications

**Overview:** Remind clients to log meals, weigh-ins, and drink water.

**What's Needed:**
- Configurable reminders (client chooses what to enable)
- Meal logging reminders (before/after meals)
- Weigh-in reminders (Mon/Fri mornings)
- Water reminders throughout the day

**Implementation Tasks:**
1. Set up push notification service (Firebase, OneSignal, etc.)
2. Add notification preferences to client settings
3. Create reminder triggers based on schedule
4. Track notification delivery and open rates

---

## 8. Exercise/Workout Logging

**Overview:** Allow clients to log workouts alongside their nutrition.

**What's Needed:**
- Log workout type, duration, intensity
- Link workouts to nutrition timing (pre/post workout meals)
- Trainer can review workout history
- Track consistency over time

**Implementation Tasks:**
1. Add workout log entry to client app
2. Workout types: cardio, weights, HIIT, etc.
3. Link workouts to meal timing recommendations
4. Trainer view of client workout history

---

## 9. Grocery List Generator

**Overview:** Generate a weekly grocery list based on client's allowed foods and meal plans.

**What's Needed:**
- Based on client's phase and allowed food lists
- Generate shopping list by category (protein, veg, starch, fat)
- Check off items as shopper buys them
- Share list with others (family, spouse)

**Implementation Tasks:**
1. Create grocery list generation algorithm
2. Categorize by food type
3. Add check-off functionality
4. Share/export list

---

## 10. Client Messaging

**Overview:** Trainer can send messages/updates to clients directly from the app.

**What's Needed:**
- Trainer sends message to individual or all clients
- Client receives in-app notification
- Optional SMS or email fallback
- Message history preserved

**Implementation Tasks:**
1. Build messaging UI in trainer dashboard
2. Store messages in database
3. In-app notification for clients
4. Optional SMS/email integration

---

## 11. Measurements Tracking

**Overview:** Track body measurements beyond just weight.

**What's Needed:**
- Track: waist, hips, chest, arms, thighs
- Body fat percentage (manual entry)
- Progress photos alongside measurements
- Visual progress charts over time

**Implementation Tasks:**
1. Add measurements entry form
2. Store measurement history
3. Show progress charts over time
4. Compare measurements to weight/progress photos

---

## 12. Allergy/Intolerance Detection

**Overview:** Help clients figure out what foods disagree with their system.

**What's Needed:**
- Client flags foods that cause issues (bloating, stomach pain, etc.)
- Track reactions over time
- AI looks for patterns: "You logged cheese 3 times this week and felt bloated after each time"
- Suggest elimination trial for suspected problem foods
- Build personal "avoid" list over time

**Implementation Tasks:**
1. Add "reaction" button when client logs meals
2. Track: food, symptoms (bloating, headache, stomach pain, etc.), severity
3. AI analyzes patterns in meal logs vs reactions
4. Generate personal avoid list based on data
5. Warn client when logging foods from their avoid list

---

## 13. Login Persistence

**Overview:** Allow clients to stay logged in for extended periods without needing to re-authenticate.

**Current State:** App uses sessionStorage for login sessions. Users get logged out when they close the browser tab or PWA.

**Problem:**
- sessionStorage is cleared when browser tab/PWA is closed
- Clients have to re-login frequently (every few hours to few days)
- Home screen shortcuts can get "stuck" on old cached versions
- PWA shortcuts don't always check for updates

**Solution Options:**
1. **localStorage** - Simple change, persists until manually cleared, less secure
2. **JWT with Refresh Tokens** - More secure, proper token-based auth, automatic token refresh
3. **Service Worker Update Configuration** - Force periodic update checks for PWA shortcuts

**What's Needed:**
- Replace sessionStorage with localStorage OR implement JWT token system
- Add refresh token logic for automatic re-authentication
- Configure service worker to check for updates more frequently
- Set appropriate token expiration (e.g., 30-90 days)
- Handle token revocation for logout/security

**Implementation Tasks:**
1. Choose auth approach (localStorage vs JWT refresh tokens)
2. Update auth code to use chosen approach
3. Set appropriate session/token expiration
4. Update service worker to check for app updates periodically
5. Test login persistence across browser close, PWA shortcuts, device restart
6. Update logout to properly clear tokens

---

## Completed Features

- Phase 2 violation logic (dairy/sugar checks active)
- Phase 4 portion tracking (dairy/sugar portions, processed food limits)
- Food lists expanded (starches, vegetables, proteins)
- Processed foods, sugar, dairy blocked in Phase 1
- Program choices updated ("Get Shredded" etc)
- Corrections feature removed from trainer UI
