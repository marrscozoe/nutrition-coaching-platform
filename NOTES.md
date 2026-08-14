# Nutrition Coaching Platform — Project Notes
**Created:** July 8, 2026
**Status:** Idea stage — needs much more detail

---

## The Product Vision

Allen wants to automate his 30-year nutrition coaching business. Currently he does everything manually via text on his iPhone. The goal is a monthly subscription platform that handles:

- Client meal logging (text or picture)
- Weight/body fat tracking
- Allen's nutrition advice delivered automatically
- Diet progression
- Client distress handling
- No live work required from Allen

**⚠️ AI IS REQUIRED — NOT OPTIONAL**
- This program cannot function without AI
- Photo analysis (identifying food + estimating portions from images) is the core feature
- AI responses are personalized coaching, not pre-written scripts
- The AI is what makes this "instant coaching" vs a food log

**AI Provider — Pluggable Architecture**
- Platform must support PLUGGING IN any AI provider
- AI abstraction layer — same prompts work with any AI
- Change AI provider without rewriting platform logic
- Examples of providers: OpenAI, Anthropic, Google Gemini, local Ollama, etc.
- Architecture: AI connector/adapter handles provider-specific communication
- This ensures flexibility as AI landscape evolves

**Core idea:** "Tell me your situation, I'll give you the plan."

**Target audience:** People with an upcoming event (wedding, beach trip, reunion, etc.) who need to lose body fat fast.

**Key insight:** This is both a fast fat loss program that is event driven time plan and for general wellness. I will add an add muscle section as well in the future.

**Post-Event Handling:**
- When event date arrives: client shifts to MAINTENANCE mode
- OR app asks: "What's your next goal?"
  - New event? Weight loss? Muscle gain? General health?
- Client can continue subscription in maintenance mode
- Or sign up for a new program

---

## PROGRAM OPTIONS (MODULAR)

The platform supports multiple program types. Each program has its own:
- Onboarding flow
- Diet structure and phases
- Progression rules
- Pricing

**Programs to include:**

1. **Event Ready (Wedding, Beach, Reunion)**
   - Fast fat loss for specific events
   - Event date drives timeline
   - Standard Phase 1-4 progression

2. **Muscle Gain**
   - Different diet structure (higher protein, caloric surplus)
   - Phases for progressive overload
   - Different progression logic

3. **General Health**
   - Maintainable, less aggressive
   - No event deadline
   - Longer-term subscription

4. **First Responder Program**
   - Shift work considerations
   - Different meal timing
   - May need different phases or restrictions

**Admin Control:**
- Allen can add new programs
- Change existing programs
- Remove programs
- Each program is a module in the system
- New program = new module with its own rules

**Client Selection:**
- Client picks their fitness category from a dropdown menu
- Categories: Event Ready, Muscle Gain, General Health, First Responder

---

## THREE-WAY BUSINESS MODEL ( 확정 )

### User Type 1 — AMarsBody Clients
- Allen's personal training clients use the platform
- Integrated with their training program
- Allen manages them directly

### User Type 2 — Direct Online Customers
- People find the program online and sign up themselves
- Subscribe monthly directly to the platform
- Self-service, fully automated

### User Type 3 — White-Label Trainers
- Other trainers subscribe to white-label the platform
- They embed it on their own website
- Looks like THEIR brand, THEIR program
- They bring their own clients
- They pay a monthly fee

### Revenue Model
- Monthly subscription fee for customers (direct online)
- Monthly subscription fee for trainers (white-label)
- Trainers pay more than individual customers (B2B pricing)
- Recurring revenue from both streams

---

## PLATFORM REQUIREMENTS

### Mobile-First Design
- iPhone/Android app
- Must be fast and simple
- Most users will be on smart phone

### UX Guiding Principles
**App must be FAST and SIMPLE — or people won't use it.**
- Clients open app multiple times a day
- Every extra step = friction = dropped users
- **Auto-save drafts:** App SAVES partially typed meals
  - Client starts typing a meal
  - Gets distracted (kids, work, etc.)
  - Comes back later — entry is still there
  - Client finishes and submits
- **Quick-select dropdown:** Dropdown of repeated/favorite meals
  - Many people eat the same thing for lunch/dinner daily/weekly
  - App remembers recent meals
  - Dropdown to quick-select = faster logging
  - Also helps accuracy (same meal = same analysis)
- **Build a meal:** Let clients create custom meals
  - "Build a meal" for homemade dishes (goulash, chili, shakes, etc.)
  - Add ingredients one by one (chicken, rice, tomatoes, etc.)
  - App analyzes the total and gives portion advice
  - Save as "My Goulash" for future quick-select
  - Great for bulk cooking / meal preppers
  - Works alongside photo logging (pic OR build-it-yourself)
- **Bulk cooking calculator (REVERSE):**
  - Client says: "I have 1 lb ground beef - how many meals does that give me?"
  - AI calculates backwards from the protein amount
  - Then calculates matching vegetables, fat (and starch for Phase 2+) needed
  - **Example:**
    - "I have 1 lb (16 oz) ground beef"
    - Phase 1 male (6oz protein/meal)
    - 16 oz ÷ 6 oz = ~2.5 meals → about 2 meals
    - For 2 meals: need 4 cups vegetables, 2-4 tbsp fat
  - Practical for shopping and bulk prep
- Handle interruptions gracefully
- One-tap to open camera for meal photo
- Minimal screens, minimal taps

### Client Accounts
**Signup:** Email + password
- Simple account creation
- Email verification optional for now

**Beta mode (NOW):**
- Free signups for testing
- No payment required during beta

**Production mode (LATER):**
- Payment (Stripe) required to complete signup
- Gates access until payment is set up

### Client Data Ownership
**⚠️ Allen owns all client data.**
- Client data belongs to the platform owner (Allen)
- Includes: weight, meal logs, progress photos, payment info
- For white-label: trainer rents the platform, Allen owns the data
- White-label trainer can view their own clients' data
- Allen retains master access to all data across all white-label accounts
- Data cannot be exported or taken if trainer cancels

### Client Pause/Subscription
**No pause feature.**
- Every city in America has healthy food — no excuses
- Client travels → AI helps them PLAN meals on the road
- Program is about portions and natural foods, not special products
- Client can't just "pause" because they're traveling
- **Road trip planning:** AI should help clients prepare for travel situations

### Billing & Cancellation
**Billing:**
- Automated recurring monthly billing (clients do NOT pay manually)
- Month-to-month, same day every month
- No annual contracts
- **Allen AND trainers can change pricing per client** (discount, custom rate, or skip charge)

**Cancellation / Freeze Option:**
- **If client wants to cancel:** Offer $10/month freeze instead (retains their data)
- Frozen clients stay in system, data preserved
- **If frozen client uses program for even 1 day:** Billing goes back to normal
- This is a retention strategy — keep clients in the system instead of losing them
- **Trainers have this option too** — trainers can offer freeze to their own clients

**Trainer Billing (White-Label) — SIMPLE MODEL:**
- **$29/month base fee** for trainer (covers costs even with 0 clients)
- **Plus 50% of what trainer's clients pay** monthly
- **Minimum client charge: $59/month** (trainer cannot charge less)

**How it works:**
- Trainer charges clients whatever they want (minimum $59/month)
- Platform auto-bills clients monthly (Stripe)
- Allen takes 50% of client payments + $29 base
- Trainer receives the other 50%

**Example — Trainer charges clients $100/month:**
- Trainer has 10 clients
- Client payments: 10 × $100 = $1,000/month
- Allen takes: 50% × $1,000 = $500 + $29 = $529
- Trainer keeps: $1,000 - $529 = $471

**Example — Trainer charges minimum $59/month:**
- Trainer has 10 clients
- Client payments: 10 × $59 = $590/month
- Allen takes: 50% × $590 = $295 + $29 = $324
- Trainer keeps: $590 - $324 = $266

**Why this is simpler:**
- One formula: 50% of client payments + $29
- No tiered pricing based on client count
- Trainer can charge whatever they want above minimum
- Aligns incentives: trainer grows, Allen grows

**Stripe fees:**
- 2.9% + $0.30 per transaction come out of platform's 50% cut
- Covered by the 50% split

**Trainer with 0 clients:**
- Pays only $29/month base fee
- Covers Allen's minimal storage/hosting costs
- No Stripe fees (no transactions)

**Refunds:**
- Not offered
- Month is non-refundable
- Client pays for full month, then cancels

### Onboarding Flow (Detailed)
**Step-by-step signup process:**
1. Client goes to website/app
2. **⚠️ MUST sign liability waiver BEFORE account creation**
   - Legal protection for trainer/business
   - States: not medical advice, client is responsible for their own health
   - Must agree before proceeding
3. Creates account (email + password)
4. Chooses program type:
   - Weight Loss
   - Muscle Gain
   - General Health
   - Event Ready
5. Sets goal: Weight (required) + optionally Pant Size and/or Waist Size
6. Enters current scale weight (**must be actual — don't guess**)
7. App assigns correct phase + gives meal examples
8. **Lead source:** "How did you hear about us?" (BNI, Instagram, friend, Google, etc.)
9. Client starts logging food OR can ask questions

### Push Notifications / Reminders
**App proactively reaches out to keep clients accountable:**
- **Meal reminder:** If no meal logged in 24 hours → "Hey! Where are your foods?"
- **Weight reminder:** If no weight logged Mon or Fri → "What's your weight?"
- **Why:** "Don't know where you're going if you don't know where you're at!"
- Notifications drive compliance and results
- Client can mute if needed (but default ON)

### Client Feedback / Bug Reporting
**Clients need a way to report glitches or problems to the AI/trainer:**
- Simple button/menu: "Report a problem"
- Client describes the issue (e.g., "AI gave me wrong advice", "app crashed")
- Feedback goes to trainer/Allen for review
- AI can also self-correct when flagged
- Prevents bad advice from compounding

### Continuous Learning / Self-Improvement
**Program gets better over time by learning from mistakes:**
- Feedback loop: AI mistakes → flagged → corrected → learns
- Pattern recognition: common issues get identified and fixed proactively
- Allen/trainer reviews flagged advice and approves corrections
- System improves with each interaction
- Works for both direct clients and white-label trainer clients

### ⚠️ CRITICAL: AI Must Be Factual — Zero Hallucinations
**Everything AI tells clients must be FACT, no exceptions.**

Hallucinations = dangerous in nutrition coaching (wrong advice = health risks)

**How to prevent:**
- AI only gives advice from VERIFIED Allen program knowledge
- When uncertain: "I'm not sure — I'll check with Allen and get back to you"
- AI knowledge base is CONSTRAINED to documented program only
- No making up food facts, calorie counts, or advice outside the program
- Safety threshold: when unsure → escalate to human (Allen)

**This is non-negotiable.** Client trust and health depend on accurate information.

### White-Label Setup (for trainers)
- Upload their logo
- Pick their brand colors
- Set their custom domain (trainername.com/nutrition)
- Looks like it belongs to them
- Trainer dashboard to manage their clients

### Food Sensitivity Tracker
- Toggle sensitivity mode ON/OFF
- When ON:
  - Client turns on sensitivity mode
  - Client enters meal
  - App asks: "How do you feel?"
  - Good: nothing to be done
  - Bad: app asks "Do you feel bad from that meal or the meal before?"
  - Client answers which meal caused the issue
  - AI tracks that meal and notes the symptom
  - Over time, patterns emerge: "You've reported bloating 5 times and 4 of those followed dairy"
- When OFF: normal meal coaching only
- Helps clients learn what foods disagree with them
- No extra work from trainer — AI handles the tracking and pattern recognition

### Trainer Access to Client Data (for white-label trainers)
- Optional feature — trainers can toggle on/off
- AI handles everything automatically by default
- Trainer can view client data if they want to check in

### Trainer Dashboard (Allen/trainer view)
**What Allen sees:**
- **Client list:** All clients in one view
- **Progress:** How each client is tracking (weight, meals logged, phase)
- **Goal status:** Who achieved goal, who's about to, who's falling behind
- **Analytics:** Success rate — who hits goals, who doesn't
- **Alerts:** Clients who haven't logged, clients in distress
- **Direct message client:** Trainer can send messages to client directly through the app ("great job", "change this", etc.)
- **Export progress reports:** Trainer can export client's progress (weight trends, goal status, phase history)
- **⚠️ NO export of food logs:** Food logs contain proprietary nutrition program logic — trainers CANNOT export them. This protects Allen's intellectual property.

### Trainer Billing Controls
**Trainer has full control over client billing:**
- **Billing view:** See all clients, who's paid, who's cancelled, MRR
- **Change pricing per client:** Trainer can adjust what any individual client pays (discount, custom rate)
- **Skip charge:** Trainer can mark a client as "no charge" — client stays active but doesn't get billed
- **Trainer's choice:** It's up to the trainer how to handle each client's billing — free, discounted, or full price

### Trainer Phase Override — NO
**Trainer CANNOT manually move a client to a different phase.**
- If trainer wants client to change phases, trainer ADVISES client
- CLIENT changes their own phase in the app
- This keeps the client in control of their own progression

### Trainer Program Assignment — NO
**Trainer does NOT pick the program for the client.**
- If trainer wants client in a specific program (Event Ready, Muscle Gain, First Responder, etc.), trainer ADVISES client
- CLIENT picks their own program category in the app
- Trainer tells client which one to choose, client selects it
- Same logic as phase override — trainer advises, client acts

### Client Notes
**Trainer can add notes per client:**
- Allergies (nuts, dairy, shellfish, etc.)
- Injuries or physical limitations
- Preferences or restrictions
- Anything the AI needs to know
- **AI reads these notes** — when giving food advice, AI AVOIDS recommending foods containing the client's allergens
- Example: Client allergic to nuts → AI never suggests mixed nuts or foods containing nuts
- Safety first: AI must check notes before recommending any food

**Purpose:**
- See entire business at a glance
- Know where to focus attention
- Track which programs/workouts produce results
- Data-driven improvements to the program

### White-Label Trainer Onboarding
**Trainer signs up online (like a client):**
1. Signs liability waiver (protects the platform)
2. Creates account (email + password)
3. Chooses plan: how many clients (tiers)
4. Configures brand:
   - Upload logo
   - Pick brand colors
   - Set custom domain (trainername.com/nutrition)
5. Adds their clients OR clients sign up through trainer's site
6. Trainer sees their own clients in their dashboard only
- Trainer sees: meal logs, weight trends, current phase, progress toward goal
- If data access is OFF, trainer never has to look at it
- Different trainers will want different levels of involvement

### Client Experience (all 3 user types)
- Fast meal logging (text or pic)
- **Picture handling:** AI converts pic to text description, then DISCARDS the picture — no storing of meal photos
- **Delete after confirmed:** Picture is deleted AFTER client confirms analysis received
- Client sees analysis, confirms it worked, then photo is deleted from system
- No photos stored long-term — privacy + storage concerns
- Weight tracking (Mon + Fri)
- Automated responses from AI (Allen's voice/logic)
- Diet progression handled automatically
- Ask questions and get answers
- Event countdown

### Client Progress Dashboard
- **Calorie/nutrient summary:** by day, by week, or by individual meal
- **Water intake summary:** so clients can see how much they've drank
- **Progress view:** clients can see their own progress over time
- No calorie counting required — just portion tracking shown as summary

### 🔑 KEY DIFFERENTIATOR: Real-Time Photo Coaching
**This is what makes the app stand out. A "Nutrition Pocket Coach."**

**AI Photo Response Logic:**
- Client sends photo of ANY meal
- AI analyzes: identifies food + estimates portion size
- **If food is in CORRECT category + portions correct for current phase:**
  → AI converts to text (describes what it sees)
  → Acknowledges: "Good job", "Looks good", etc.
- **If food is NOT in correct category (spaghetti, lasagna, etc.):**
  → AI gives INSTANT portion advice based on current phase
  → Example: spaghetti photo → "Eat only 1/4 to 1/2 of the plate"
  → Example: huge piece of lasagna → "Whoa — eat 1/4 to 1/2 max. Save the rest for tomorrow!"
- NOT just calorie logging — real-time coaching like Allen would give
- Most nutrition apps: "here's your calories" — YOUR app: "here's what to actually do"

**ADAPTS to each person's goal and phase:**
- Coaching is personalized based on: current phase (1-4), goal type, event date
- Phase 1 client with beach trip in 3 weeks gets URGENT advice
- Phase 4 maintenance client gets different (more relaxed) portion guidance
- Same lasagna photo → different advice depending on where that client is

**Marketing angle:** "Snap a photo. Get instant coaching. No calorie counting. Just portions."

**Picture handling:** AI converts pic to text, then DISCARDS the photo. No storing meal photos.

**Post-Advice Follow-Up:**
- After AI gives portion advice (e.g., "eat 1/4 of the plate")
- If client responds "I ate the whole plate"
- AI updates the log entry to reflect what they ACTUALLY ate (full portion)
- This keeps food logs ACCURATE — tracking real consumption, not just recommended amounts

**AI Escalation — Repeated Off-Phase Eating:**
- AI tracks when client logs food NOT in their phase guidelines
- **First time:** Gentle reminder — "Get back on track next meal"
- **Second time:** More punchy/direct — "ya killing me smalls! Back on track, focus on your goal"
- AI recognizes PATTERNS and escalates response based on repeated non-compliance
- Builds on the philosophy: get them back on track, don't lecture

**"I Messed Up" Response:**
- AI responds: "Log foods and get back on track next meal"
- Philosophy: "Everyone messes up. Just get back on track."
- Don't dwell on the mistake — refocus on the next meal

**"What Should I Eat?" Response:**
- AI gives meal examples based on current phase
- Can provide: 1 meal OR 3 days of meals (depends on what client asks)
- **IMPORTANT:** Suggested meals are NOT logged as eaten unless client sends photo or texts actual meal
- Meal planning (proactive) is separate from meal logging (reactive)

**Weight Response — Week over Week:**
- **Weight DOWN 1 lb:** "Good job!"
- **Weight DOWN 2 lbs:** "Way to go!"
- **Weight DOWN 3+ lbs:** "Leeets gooo! Great job this week!"
- **Weight STAYS SAME:** "It's ok this week. Plan those foods and eat perfect."
- **Weight GAINS:** "Get back on track next week. Plan those foods. You got this!" + remind them of the "messed up" meals they logged

**Goal Milestones — Break Big Goals Into Smaller Ones:**
- Always compare current weight to 1st weigh-in (total progress from start)
- Break big goals into 10 lb chunks to keep client motivated
- Example: Client wants to lose 30 lbs
  - Current goal: 10 lbs (celebrate!)
  - Next milestone: 20 lbs (celebrate!)
  - Final goal: 30 lbs (BIG TIME celebration!)
- Philosophy: Don't overwhelm client with a huge number. Small wins build momentum.
- Each 10 lb drop = celebration
- Final goal = BIG celebration

### Sample 3-Day Meal Plan (Phase 1 - Male)
**Phase 1 Male portions per meal: 6oz protein, 2 cups fibrous veg, 1-2 tbsp healthy fat**

**Day 1:**
- Breakfast: 3 whole eggs + 3 egg whites, spinach, 1/2 avocado
- Lunch: 6oz chicken breast, broccoli, mushrooms, 1 tbsp olive oil
- Dinner: 6oz salmon, asparagus, 1 tbsp Kerrygold butter

**Day 2:**
- Breakfast: 6oz turkey breast, spinach, 1/4 avocado
- Lunch: 6oz pork loin, green beans, cauliflower, 1 tbsp olive oil
- Dinner: 6oz lean ground beef, peppers, onions, 1 tbsp coconut oil

**Day 3:**
- Breakfast: Plain Greek yogurt, mixed nuts, side of eggs
- Lunch: 6oz chicken breast, spinach, mushrooms, 1 tbsp olive oil
- Dinner: 6oz white fish, broccoli, asparagus, 1 tbsp butter

**Phase 2 (adds starch Wed/Sat/Sun to first 2 meals):**
- Add 1-2 cups sweet potato, red potato, rice, or beans to first 2 meals

**Phase 1 (Female - 4oz protein, 1-2 cups veg, 1 tbsp fat per meal):**
- Same foods, smaller portions

**This is what AI generates when client asks "what should I eat?"**

### Meal Planning Feature (Proactive Coaching)
**App helps clients PLAN meals for a few days at a time based on phase + goals**

- Client asks: "what should I eat?"
- App generates a 3-day meal plan personalized to their phase
- **Default: BREAKFAST + LUNCH + DINNER for each of the 3 days (9 total meals)**
- **Exception: if client specifies just one meal** (e.g., "what should I have for lunch?"), app plans only that specific meal
- Phase 1 plan: no starch, strict portions, high urgency
- Phase 4 plan: add starch, more flexibility, maintenance mode
- Event date drives timeline: "you have 3 weeks — here's your eating plan"
- Works WITH the photo coaching: reactive + proactive = complete coaching

**Why this matters:**
- Clients often don't know WHAT to eat, not just how much
- Planning ahead prevents poor decisions in the moment
- "Here are your meals for the next 3 days" = less mental load for client

**App = Two-Sided Coaching System:**
- **Reactive:** Photo → instant portion advice ("eat 1/4 of that")
- **Proactive:** "What should I eat?" → 3-day personalized meal plan
- Both work together = complete nutrition coaching in an app

### Sample 3-Day Meal Plan (AI Output Example)

**FAT MATH (Critical for portions):**
- Women: 1 tbsp oil per meal = 14g fat max
- Men: 1-2 tbsp oil per meal = 14-28g fat
- 1 whole egg = 7g fat
- **Women max = 2 whole eggs** (14g fat = fills fat allowance)
- 3 whole eggs = 21g fat (too much for women)
- Egg whites = 3-4g protein (no fat, add fat separately)
- Greek yogurt = fat free protein (add fat separately)
- Coconut oil = in black coffee
- Olive oil = primary fat for meals

**PHASE 1 SAMPLE (No Starch) — Female portions**
*All meals: protein + fibrous veg + healthy fat (14g max per meal for women)*

**Day 1:**
- Breakfast: 2 whole eggs + 2 cups spinach (14g fat from eggs = max, no oil added)
- Lunch: 4oz chicken breast + 2 cups broccoli + 1tbsp olive oil (14g fat)
- Dinner: 4oz salmon + 2 cups asparagus + olive oil/herbs (14g fat)

**Day 2:**
- Breakfast: 4oz turkey breast + 2 cups kale + 1tbsp olive oil (14g fat)
- Lunch: 4oz pork loin + 2 cups green beans + 1tbsp olive oil (14g fat)
- Dinner: 4oz white fish + 2 cups cauliflower + olive oil/lemon (14g fat)

**Day 3:**
- Breakfast: 4oz turkey breast + 2 cups spinach + 1tbsp olive oil (14g fat)
- Lunch: 4oz turkey breast + 2 cups peppers/onions/mushrooms + 1tbsp olive oil (14g fat)
- Dinner: 4oz chicken breast + 2 cups broccoli + olive oil (14g fat)

**Notes:**
- If having eggs = 2 max for women (14g fat fills allowance, no added fat)
- If having lean protein = add 1 tbsp olive oil (14g fat)
- 1/2 avocado = ~14g fat (can be sole fat source for women)
- Greek yogurt = fat free protein (add fat source separately)
- Coconut oil in black coffee counts separately (1/2 tbsp = ~7g fat)

---

**PHASE 2 SAMPLE (Add Starch Wed/Sat/Sun - First 2 Meals Only)**

**Day 1 (Wednesday):**
- Breakfast: 4oz chicken breast, 1 cup sweet potato, 2 cups spinach, 1tbsp olive oil
- Lunch: 4oz salmon, 1 cup rice, 2 cups green beans, 1tbsp olive oil
- Dinner: 4oz pork loin, 2 cups asparagus, 1tbsp coconut oil (no starch)

**Day 2 (Thursday - No Starch):**
- Breakfast: 3 eggs, 2 cups kale, 1tbsp butter
- Lunch: 4oz turkey breast, 2 cups broccoli, 1/4 avocado, mixed nuts
- Dinner: 4oz white fish, 2 cups cauliflower, 1/2 avocado

**Day 3 (Saturday):**
- Breakfast: 4oz pork loin, 1 cup red potato, 2 cups spinach, 1tbsp olive oil
- Lunch: 4oz chicken breast, 1 cup black beans, 2 cups peppers/onions, 1tbsp olive oil
- Dinner: 4oz salmon, 2 cups asparagus, 1tbsp coconut oil (no starch)

---

**Portion Notes:**
- Portions shown are for women (Phase 1 male = 6oz protein, 2 cups veg, 1-2tbsp fat)
- Phase 2 starch = 1 cup for women, 1-2 cups for men (first 2 meals only on Wed/Sat/Sun)
- Healthy fats: olive oil, coconut oil, butter, avocado, heavy cream, mixed nuts
- Water: 80oz minimum women / 128oz men daily

### Workout/Activity Logging
- **Optional:** clients can log workouts or steps
- **Only suggestion:** 10,000 steps per day for general health maintenance
- **NO workout suggestions or programs** — not a fitness app, strictly nutrition coaching
- Steps can integrate with HealthKit (iPhone) or Google Fit if available

### Billing
- Stripe or similar for subscriptions
- Monthly billing for customers and trainers
- Different pricing tiers for customer vs trainer accounts

---

## 8-Step Client Process (ALLEN'S EXACT WORKFLOW)

### Step 1 — Onboarding
- Male or female (sets portion sizes)
- Client picks goal: lose body fat / gain muscle / get healthy / get event ready ASAP
- Allen tells them if goal is reasonable and how long it takes
- System creates client profile

### Step 2 — Weigh-in Schedule
- Client weighs Monday + Friday mornings
- BEFORE eating or drinking
- Auto-logged in system

### Step 3 — Starting Diet
- Allen gives client a 14-day diet to follow
- **Clarification:** There is NO specific 14-day sample menu
- **Phase 1 = 14 days** of following food categories and portion sizes
- Client picks foods from approved lists (proteins, fibrous veg, healthy fats)
- No pre-set menu — just follow categories and portions
- When client ASKS for ideas: AI can provide 3-day planning example
- Different food portions for men vs women

### Step 4 — Meal Check-ins (CRITICAL)
- Client texts every time they eat or drink (text or picture)
- Allen responds: corrections or "good job"
- If Allen doesn't hear from client → he texts: "How are your foods?"
- **Automation needed:** System handles this back-and-forth

### Step 5 — Weight Logging & Response
- Client logs weight
- Allen responds with analysis

### Step 6 — Diet Progression
- **If client did great:** Diet changes every 1-2 weeks
- **If client messed up:** 14-day phase extends another 7 days
- Progression is TIME-BASED, not strictly weight-based

### Step 7 — Repeat Until Goal
- Process repeats until:
  - Goal is attained, OR
  - Event has come (wedding, beach trip, reunion)

### Step 8 — Maintenance
- Diet shifts to maintenance mode
- (Need to document what maintenance looks like — TBD)

---

### Key Insight: Weekend Cheats
**Most people don't realize the program IS working but they gain weight back over weekend cheats.**

- The program WORKS during the week (Mon-Fri)
- Weekend cheats (Friday night - Sunday) undo the progress
- Clients often don't connect the dots — they think the program isn't working
- AI should help clients see: Friday vs Monday tells the real story

**When client is frustrated about no progress:**
- Point to Friday vs Monday pattern
- "You're doing great during the week — the weekend is the issue"
- This is coaching, not just data

## Client Distress Signals (NEED AUTOMATED RESPONSES)

During the process, clients say things like:
- "I messed up, how do I get rid of this bloat?"
- "I feel dumb" → up healthy fat by 1 tablespoon per meal
- "I am starving"
- "I am not hungry"

**System needs to handle these automatically with Allen's standard responses.**

---

## "What Now" Scenario Responses

Clients ask situational questions. System responds with appropriate phase recommendation.

### Scenarios Documented:
- **"I am going to the beach next week!"** → Phase 1
- **"I just got back from drinking all weekend"** → Phase 1 or 2
- **"My ex is gonna see me tonight!"** → Phase 1

*(More scenarios to be added as they come up)*

---

### AI Voice & Coaching Style
**How the AI sounds — must sound like Allen:**
- Punchy, to the point
- Short, no fluff
- Very supportive when client does GOOD (hype them up)
- Direct when client needs to get back on track

**When client messes up:**
- Don't dwell on the mistake
- "Don't worry about what you did wrong — just get back on track"
- "Don't turn 1-2 bad meals into a week. Get back on track."
- "Everyone messes up. There are those that get back on track and those that don't."

**The philosophy:**
- The AI's job is to GET THEM BACK ON TRACK, not make them feel bad
- Keep the big picture in mind
- Refocus, don't lecture

**Allen example phrases:**
- "Leeeeets goooo!" (when they do good)
- "Get back on track." (when they slip)
- "You're doing great — now finish the week strong."

## Features Discussed

### Communication
- Client can text what they ate
- Client can send pic of meal
- Client can ask scenario questions ("beach in 2 weeks", "back from vacation")
- System responds with Allen's voice and logic

### Tracking
- Weight logging (Mon + Fri)
- Body fat tracking
- Progress charts
- Trend analysis ("down 1.2 lbs this week!")

### Responses
- "Great job!" when weight is down
- Explain why weight went up ("you should have skipped the bread")
- "Skip the bun" when they eat burger and fries
- "Looks like the weekend got away from you"

### Scheduling
- Mon + Fri morning weigh-in reminders
- Afternoon check-ins if no meal logged
- Weekly diet changes (if doing well)
- Event countdown

---

## Approved Food Lists
**All food should be NATURAL when dieting!**

### ⚠️ IMPORTANT: Use Nutrition Labels to Categorize, Not Marketing
**Marketing has made food categories confusing. People miscategorize foods constantly.**

**Example:** Peanut butter — marketed as "protein" but:
- Very little protein (incomplete)
- Calories come from FAT
- Should be categorized as healthy fat, NOT protein

**AI must verify using nutrition facts, not assumptions or marketing claims.**

**Rule:** When client logs a food, AI checks the nutrition label to categorize correctly:
- Look at: protein grams vs fat grams vs carb grams per serving
- Categorize by what the food ACTUALLY is, not what it's marketed as

**Foods commonly miscategorized:**
- Peanut butter → healthy fat (not protein)
- Some "protein" bars → mostly carbs/fat
- Granola → often more sugar/fat than protein
- Rice cakes → mostly carbs

**This prevents bad advice based on miscategorized foods.**

### PROTEINS (Lean, Natural Sources)
**All food should be NATURAL when dieting! Fresh or frozen, NO CANS**

- Chicken breast
- White fish, Tuna, Salmon, Redfish
- Whole eggs, Egg whites
- Lean beef, Lean pork, Turkey breast
- Shrimp
- Plain non-fat Greek yogurt
- Tilapia, Cod, Halibut, Trout, Catfish, Scallops, Crab, Lobster
- Bison, Venison, Elk, Ostrich
- Egg beaters, Liquid eggs
- Protein powder, Whey protein
- Bacon (nitrate-free, twice per week)
- **NO cheese or dairy while dieting**

### FIBROUS VEGETABLES
**Fresh or frozen, NO CANS**

- Broccoli, Spinach, Asparagus, Zucchini
- Green peppers, Bell peppers, Red peppers, Yellow peppers
- Green lettuce (sparingly)
- Mushrooms, Green beans, Cauliflower
- Tomatoes, Cucumbers, Celery, Cabbage, Onions
- Kale, Bok choy, Radishes, Turnips, Beets, Jicama
- Artichoke, Brussels sprouts, Eggplant
- Anaheim peppers, Poblano peppers, Jalapeño peppers, Serrano peppers
- Celery root, Fennel, Leeks, Water chestnuts, Bean sprouts, Alfalfa sprouts

### STARCHY CARBOHYDRATES
**Fresh or frozen, NO CANS**

- Red potatoes, New potatoes, Sweet potatoes, Yukon Gold, Russet, Fingerling, Purple
- Brown rice, Wild rice, Jasmine rice, Basmati rice
- Oatmeal, Steel cut oats
- Barley, Bulgur, Buckwheat, Millet, Spelt
- Peas, Corn, Beans, Legumes
- Lentils, Cannellini beans, Navy beans, Lima beans, Butter beans
- Berries, Cantaloupe, Black Eyed Peas, Grapefruit
- Plantain, Parsnips, Acorn squash, Delicata squash

### HEALTHY FATS

- Avocado (1/2 male, 1/4 female)
- Olive oil
- Almonds, Walnuts, Mixed nuts
- Kerrygold gold butter
- Safflower oil, Coconut oil
- MCT oil (in coffee)

---

## Diet Progression Rules ✓ ANSWERED (partial)

### Phase 1 — NO STARCH
Men, per meal (3-4 meals per day):
- 6 ounces lean protein
- 2 cups fibrous vegetable
- 1-2 tablespoons healthy fat
- 128 ounces water daily (maximum 32 ounces per hour)
- Snack between lunch and dinner: mixed nuts and/or Premier Protein shake

Women, per meal (3-4 meals per day):
- 4 ounces lean protein
- 1-2 cups fibrous vegetable
- 1 tablespoon healthy fat
- 80 ounces water minimum daily
- Snack between lunch and dinner: mixed nuts and/or Premier Protein shake

Duration: 14 days, then advance if doing well. If client messed up: extend 7 more days.

### Phase 2 — ADD STARCH (Wednesday, Saturday, Sunday only)
Men, first 2 meals on those days:
- Same as Phase 1 PLUS 1-2 cups cooked starch per meal

Women, first 2 meals on those days:
- Same as Phase 1 PLUS 1 cup cooked starch per meal

All other meals on those days: same as Phase 1

Duration: 1-2 weeks
- 1 week if weight goes up, stays the same, or only loses 1 pound that week
- 2 weeks if weight loss is more than 2 pounds in first week

### Phase Transitions (per program type)

See **Program Phase Flows** section below for the complete flow diagrams.

### Phase 4 — MAINTENANCE:
- Add starch to **every meal** (same portion sizes as Phase 1)
- **Weigh Friday only** (not Mon + Fri)
- Client tries to eat mostly natural food
- **If weight gains 5+ lbs above goal:** Client goes back to Phase 1
- Less strict than Phase 1-2
- More relaxed monitoring
- Trigger: 5+ lb weight gain = reset to Phase 1

**Portion sizes (same as Phase 1):**
- Male per meal: 6oz protein + 2 cups veg + 1-2 tbsp fat + starch
- Female per meal: 4oz protein + 1-2 cups veg + 1 tbsp fat + starch

### Phase 5 — AGGRESSIVE FAT LOSS (Replaces Phase 2)
- Client picks randomly each day:
  1. No starch
  2. Starch with first 2 meals
  3. Starch with all meals
- Duration: 14 days fixed, then loops back to Phase 1 OR transitions to Phase 4 if goal attained
- Harder to follow, but more aggressive fat loss
- Use when client wants maximum results

### Phase 6 — MUSCLE GAIN
**Portions Per Meal:**
- **Male:** Protein 6oz, Fibrous Veg 2 cups, Fat 3 tablespoons, Starch 3 cups
- **Female:** Protein 4oz, Fibrous Veg 1-2 cups, Fat 2 tablespoons, Starch 2 cups

**Supplements:**
- Whey Protein: Men 40g × 2/day, Women 20g × 2/day
- Creatine: Daily

**Meal Timing:**
- Biggest meal POST weight training (within 1 hour)
- Starch/fruit 30 min BEFORE weight training

**Weigh-in:**
- Friday only
- Goal: 1-2 lbs GAIN per week

**Phase Transitions:**
- NO automatic phase transitions — trainer-controlled only

**Rules:**
- Client starts at Phase 6 (not Phase 4)
- Weight goal attained → Phase 4
- -5 pounds from goal → back to Phase 6
- Processed food = portion controlled (~1 meal per day max)

---

## Program Phase Flows

### ANTI-GAMING RULE
**Phase 1 MAXES at 14 days for ALL programs.**
Even if client changes goal weight to be "at goal", they still flow to next phase after 14 days.

---

### EVENT READY (event_ready)
- Phase 1 (14d max) → Phase 2 (7d fixed) → Phase 1 (loop) OR Phase 4 (goal)
- If weight > goal + 5 while in Phase 4: back to Phase 1
- **Loop:** Phase 1 → Phase 2 → (Phase 1 or Phase 4) → repeat until goal attained

---

### GET SHREDDED (get_shredded)
- Phase 1 (14d max) → Phase 5 (14d fixed) → Phase 1 (loop) OR Phase 4 (goal)
- If weight > goal + 5 while in Phase 4: back to Phase 1
- **Loop:** Phase 1 → Phase 5 → (Phase 1 or Phase 4) → repeat until goal attained

---

### GENERAL HEALTH (general_health)
- Starts at Phase 4 (maintenance)
- If weight > goal + 5: Phase 1 (7d max) → Phase 4
- If goal attained: Phase 4
- **Trigger back to Phase 1:** weight > goal + 5 lbs only
- **NO automatic goal attainment → Phase 4 transition** (already at Phase 4)

---

### MUSCLE GAIN (muscle_gain)
- Starts at Phase 6
- Goal attained → Phase 4
- Weight < goal - 5 while in Phase 4: back to Phase 6
- **NO +5 rule** — only goal-based transitions
- **Loop:** Phase 6 ↔ Phase 4 based on weight vs goal

---

## Database Schema — What Data We Store

### Client Profile:
- Name, email, password
- Gender (sets portion sizes: male/female)
- Program type (Event Ready, Muscle Gain, General Health, First Responder)
- Starting weight (1st weigh-in)
- Goal weight / goal type
- Event date (if event-driven)
- Current phase (1, 2, 3, 4)
- Subscription status
- Trainer notes (allergies, injuries, preferences)
- Date joined

### Weekly Weigh-Ins:
- Date
- Weight
- Body fat % (optional)
- Pant/waist size (optional)
- Week-over-week change

### Meal Logs:
- Date/time
- Food (text from photo or text input)
- On-phase or off-phase
- Portion advice given
- "Messed up" flag (if off-phase eating)

### Milestones:
- 10 lb increments hit
- Final goal achieved
- Best week for weight loss
- Best week for pant/waist reduction

### Best Week Tracking:
- Track every week's weight/pant change
- AI identifies the best week (biggest loss)
- Celebrate it: "Your best week was Week 3 — you lost 3.2 lbs! You're capable of great weeks!"
- Same for pant size: track waist, identify best reduction week
- This motivates clients — shows them what they're capable of

## Future Feature — Trainer-Created Programs (Phase 2)

**Vision:** Allow trainers, dietitians, nutritionists to create their OWN nutrition programs
- Custom phases, food categories, portions, AI responses
- Trainers don't have to use Allen's program — they can use their own methodology
- Major differentiation from other platforms (most are rigid)

**Challenge:**
- AI needs to understand and adapt to whatever program trainer creates
- More complex to build
- Needs flexible AI prompt system

**Potential selling point:** "Create your own nutrition coaching program"

**Priority:** Phase 2 — AFTER Allen's proven program is built and working

## AI Coach Voice & Style Guide

**Role:** AI speaks AS Allen (the coach) but does not use Allen's name. Just "your coach" or direct "you" addressing the client.

**Tone:** Punchy, supportive, direct — NO lecturing, NO corporate speak, NO being soft.

### Voice Examples

**PUNCHY:**
- "Don't let your brain prevent your muscles from showing, get lean!"
- "You Got This!"
- "LEEEETS GOOOO!"
- "If you want to look better than the average population, you have to do what the average population won't!"

**SUPPORTIVE:**
- "Everyone falls off track. It's those that get back on track and those that don't."
- "That's all that separates you from your goal!"

**DIRECT:**
- "Ya killing me smalls! Get back on track!"
- "No excuses next week! We've proved this works!"
- "Keep your goal in focus!"
- "Don't let your brain prevent your body from getting to your goal!"
- "Don't turn a bad meal into a bad week, plan your foods!"
- "The brain wants you to have more fat so we don't die of starvation, so don't let your brain prevent you from getting to your goal!"

**Key Elements:**
- Use ALL CAPS for emphasis when celebrating or pushing hard
- Use "we" language: "We've proved this works", "The brain wants us"
- Short punchy sentences — not paragraphs
- Real talk, not corporate
- Science-backed motivation
- Firm but encouraging
- Don't dwell on past mistakes — focus on what to do NEXT

**Additional Phrases:**
- "Don't worry about the past, plan those foods!"
- "Don't turn a bad meal into a bad week, plan your foods!"
- "Keep your goal in focus!"
- "When you get off track don't try to change things — just get back on track!"
- "Did I ever tell you a nutrition goal is not a goal UNLESS YOU WRITE IT DOWN 😁"
- "Log your foods!"
- "IT'S GONNA BE A GREAT DAY!"
- "You Got This!"
- "Oh looookuot! Good things happening!" (for celebrations)

**Emoji Usage:**
- Use sparingly — one emoji per message max, when it adds personality
- 😁 👊 🔥 are good choices
- Don't overuse emoji

**Words/Phrases to NEVER Use:**
- (TBD - need Allen to specify what feels "not him")

**Emoji:**
- (TBD - need Allen to specify)

---

## Open Questions (NEED ALLEN TO ANSWER)

1. **What does the 14-day diet actually look like?** ✓ ANSWERED
   - Start on a Monday
   - Write down everything that goes into your mouth for 14 days
   - Natural food, nothing processed
   - Fresh or frozen (avoid cans and boxes)
   - Organic is client's choice
   - Each meal has:
     - 6oz Lean Protein (men) / 4oz (women)
     - 2 cups Fibrous Vegetable (men) / 1-2 cups (women)
     - 1-2 tablespoons Healthy Fat (men) / 1 tbsp (women)
   - Water: 128 oz daily (men) / 80 oz minimum (women)
   - No more than 32 oz per hour
   - Black coffee OK
   - No sugar
   - Weigh Monday + Friday mornings (before eating or drinking)
  - **Friday = how good was your week** (Mon-Fri discipline)
  - **Monday = how bad was your weekend** (did the weekend derail you?)
  - **Goal:** Stay within 1 lb from Friday to Monday
   - Snack between lunch and dinner: mixed nuts and/or Premier Protein shake
   - **Cheat meal:** Available AFTER Phase 1 only
  - One per week on Saturday
  - Same portion sizes as regular meals (protein, veg, fat)
  - Processed or fried food IS allowed
  - Starch IS allowed
  - 1 serving alcohol = counts as the starch for that meal
  - Can't have BOTH alcohol AND starch (beer OR potato — pick one)
   - **Weight loss expectation:** 1-2 lbs per week
   - **Weekend maintenance:** Stay within 1 lb from Friday to Monday

2. **What are the diet phases?** ✓ ANSWERED (partial)
   - Phase 1: No starch, protein + veg + fat
   - Phase 2: Add starch Wed, Sat, Sun to first two meals
   - Phase 3: (Need to document)

3. **What is maintenance mode?** ✓ ANSWERED
   - Phase 4: Add starch to every meal
   - If weight gain is 5+ lbs: Repeat Phase 1

4. **What is the "bloat reset" protocol?** ✓ ANSWERED
   - "I feel bloated": Increase water and oil
   - Only if all food portion goals are being met

5. **How does Allen handle "I'm starving"?** ✓ ANSWERED
   - Up healthy fat intake by 1 tablespoon per meal

6. **How does Allen handle "I'm not hungry"?** ✓ ANSWERED
   - Be sure water intake is correct
   - Only eat when hungry
   - It's ok to only take a bite or two if not hungry
   - Fibrous vegetables first

7. **Portion sizes:** ✓ ANSWERED
   - Hand-size based portions (not calorie/macro counting)
   - See diet section above for full details

8. **Meal Evaluation Criteria** ✓ ANSWERED
   - **"Good job":** Client eats all natural food in the correct category for their current phase
   - **Correction needed:** Client eats processed food OR eats the wrong category for their phase
   - Phase 1 categories: Lean protein + fibrous vegetable + healthy fat (no starch)
   - Phase 2 categories: Same + starch allowed Wed/Sat/Sun on first 2 meals

9. **Pricing** ✓ ANSWERED (R&D July 19, 2026)
   - **Recommended:** $49-79/month
   - **$59/month** — Sweet spot, ~$500-700 for typical 10-15 lb journey
   - **$49/month** — Competitive, good for volume
   - **$79/month** — Premium positioning
   - **Alternative:** One-time $297-497 for 90-day access
   - **Market context:**
     - Basic automated apps: $15-30/month
     - Human-coached: $100-300/month
     - Allen's program: between DIY apps and human-coached
   - **Rationale:** Zero human involvement after signup = higher margins, clients pay for results not hand-holding

10. **Onboarding - "Is Goal Reasonable?"** ✓ ANSWERED
    - **Automatable:** Yes — it's math
    - **General rule:** 1-2 lbs/week weight loss
    - **Timeline formula:** (lbs to lose) / 2 = minimum weeks | (lbs to lose) / 1 = maximum weeks
    - **Example:** Client wants to lose 10 lbs → 5-10 weeks if they stick to each phase perfectly
    - **System calculates and tells client at onboarding:** "At your goal of X lbs, you're looking at Y-Z weeks if you follow the plan"
    - Allen does NOT need to personally handle this — system handles it automatically

---

## Next Steps

- Answer the open questions above
- Document Allen's actual food rules and portion guidelines
- Document the distress signal responses
- Design the diet phases
- R&D: Nova generates ideas, Sage researches market, Grim pokes holes
- Build MVP

---

## Claude Suggestions (July 29, 2026)

I have built a nutrition app that uses llm api to photo analyse a meal convert to text. I had Gemini free tier but usage went over free tier. And I have a seperate llm api for chat in the app. What are my best options for price verses performance for these llms?

Weighed model options balancing vision capabilities, cost efficiency, and conversation volume

Good news: this is a well-worn problem, and the pricing landscape right now (July 2026) gives you some solid budget-friendly options for both jobs.

For photo → nutrition text (vision task)

This needs decent image reasoning but not deep chain-of-thought, and outputs are usually short (structured JSON of foods/portions), so input (image) cost matters more than output cost.

Model	Input/Output ($/1M)	Notes
Gemini 2.5 Flash	~$0.30 / $2.50	Great vision quality for the price, 1M context, still has a usable free tier for prototyping
GPT-5 Mini	$0.25 / $2.00	Cheapest solid vision option right now, good OCR/structured output
Claude Haiku 4.5	$1.00 / $5.00	Pricier, but strong at following detailed extraction instructions/JSON schemas — worth it if Gemini/GPT are misreading portions or mixing up ingredients

Recommendation: Since you already built against Gemini, the easiest fix is just moving to Gemini 2.5 Flash's paid tier — same API, same prompts, no free-tier caps, and it's genuinely cheap at production volume. If cost still worries you or you're hitting rate limits, add GPT-5 Mini as a fallback (many apps route: try Gemini, fall back to GPT-5 Mini on error/429). If accuracy on portion-size estimation is the real problem rather than price, Claude Haiku 4.5 is worth testing even though it's ~4x pricier — for a health-adjacent app, better accuracy can matter more than the marginal cost.

For in-app chat

Chat volume is usually the bigger long-term cost driver since users go back and forth. Priorities: cheap output tokens, good instruction-following, fast latency.

Model	Input/Output ($/1M)	Notes
Claude Haiku 4.5	$1.00 / $5.00	Best "punches above its price" option for conversational quality + safety-conscious answers (relevant for nutrition advice)
GPT-5 Mini	$0.25 / $2.00	Cheapest of the "real lab" models, solid for general chat
DeepSeek V4 Flash	$0.14 / $0.28	Cheapest overall, 1M context, benchmarks well — good if you're very cost-sensitive and can tolerate slightly less polish

Recommendation: Claude Haiku 4.5 or GPT-5 Mini for chat — both are built for exactly this "budget but reliable" niche. If you're giving any nutrition/health guidance in chat (not just logging), I'd lean toward Haiku 4.5 — Anthropic models tend to be more careful about hedging and not giving confident-but-wrong dietary claims, which matters for a health app.

A couple of general tips
Prompt caching (Anthropic, OpenAI, Gemini all support it) can cut costs 50-90% if your system prompt/schema instructions are long and repeated every call — very relevant for structured food-extraction prompts.
Batch APIs (50% off) only help if analysis doesn't need to be real-time — probably not applicable to your photo flow but could help if you ever do bulk reprocessing.
Consider a lightweight fallback/router pattern (try provider A → fallback to B on rate limit/error) so a free-tier cap or outage on one provider doesn't take down your feature.

Want me to sketch out actual monthly cost estimates based on your expected photo volume and chat message volume? That'd make the choice more concrete.

Ok to be clear the app is built so I can plugin what ever llm I want for photo analysis and the same or another llm for the chat. Please give me a monthly basis with monthly charge minimums from llm companies and using about 5 clients at 5 photos per day plus chat questions and answers.

Calculated negligible monthly API costs across model combinations for small-scale deployment

Quick clarification on "monthly minimums" first: none of the major providers (OpenAI, Anthropic, Google) charge a monthly minimum fee for API access — it's pure pay-as-you-go, you're only billed for tokens used. The only "minimum" is a prepaid credit top-up to activate billing (typically $5–10 one-time, not recurring). So at your scale, this is genuinely just token math.

Assumptions (adjust if off)
5 clients × 5 photos/day = 25 photos/day → ~750 photos/month
Per photo: ~1,000 tokens (image) + ~300 tokens (prompt/schema instructions) input, ~300 tokens output (structured nutrition JSON) → ~1M input / 225K output tokens/month
Chat: 5 clients × ~10 exchanges/day = 50/day → ~1,500 exchanges/month, averaging ~800 input tokens (growing conversation context) / 200 output tokens each → ~1.2M input / 300K output tokens/month
Photo analysis — monthly cost at this volume
Model	Input cost	Output cost	Total/month
GPT-5 Mini	$0.25	$0.45	~$0.70
Gemini 2.5 Flash	$0.30	$0.56	~$0.86
Claude Haiku 4.5	$1.00	$1.13	~$2.13
Chat — monthly cost at this volume
Model	Input cost	Output cost	Total/month
DeepSeek V4 Flash	$0.17	$0.08	~$0.25
GPT-5 Mini	$0.30	$0.60	~$0.90
Claude Haiku 4.5	$1.20	$1.50	~$2.70
Combined monthly totals (photo + chat)
Combo	Total/month
GPT-5 Mini (both)	~$1.60
GPT-5 Mini (photo) + DeepSeek V4 Flash (chat)	~$0.95
Gemini 2.5 Flash (photo) + Claude Haiku 4.5 (chat)	~$3.56
Claude Haiku 4.5 (both)	~$4.83
The honest takeaway

At 5 clients, every reasonable option costs less than a cup of coffee per month — the difference between the cheapest and priciest combo above is about $4. Optimizing purely for price at this scale isn't worth the engineering time. What actually matters right now:

1. Accuracy on photo analysis matters more than pennies — a wrong calorie estimate is a worse problem than a $2 bill difference. Test Gemini 2.5 Flash, GPT-5 Mini, and Claude Haiku 4.5 head-to-head on 20–30 real meal photos and pick whichever gets portions/ingredients right most often.
2. Chat quality/tone matters for user trust — cheap models can feel curt or give shaky nutrition advice. Haiku 4.5 tends to hedge more carefully on health topics, which is a real (if hard to price) advantage.
Where this actually starts to matter: once you're at ~500+ clients, these same ratios scale linearly — e.g., GPT-5 Mini for both at 500 clients would land around $160/month, Haiku 4.5 for both around $480/month. That's the point where price-per-token differences become a real budget line item worth engineering around (caching, routing, batching).

Want me to project costs at a specific future user count, or help you set up a fallback pattern (e.g., cheap model first, escalate to a stronger one only if confidence is low)?

Weighed Stripe Connect options against simpler direct payout alternatives

Since you're billing clients directly and then paying partners a cut, this is a revenue-share payout, not a typical marketplace split — that distinction matters for which tool to use.

The core decision: Stripe Connect vs. manual payouts

Option A — Stripe Connect (Standard accounts)
Each white-label partner gets their own Stripe account (you send them an onboarding link, takes ~10–15 min). You keep billing clients on your main Stripe account like you planned. Once a month, you calculate each partner's share and send a Transfer via the API to their connected account — Stripe handles the payout to their bank from there.

Cost to you: $0 extra — Standard accounts have no platform fee, you just pay the normal 2.9% + $0.30 you're already paying on the original charge.
What you get: partners see their own earnings in a real Stripe dashboard, Stripe can auto-generate 1099s for US partners, everything is auditable and API-driven.
Downside: each partner has to set up their own Stripe account (minor friction, especially if they're not tech-savvy), and you're now managing Connect's onboarding/KYC flow in your product.

Option B — Manual monthly payout (no Connect)
You track revenue per partner in your own database, run a monthly calculation, and pay them via ACH/wire through your business bank (or a tool like Mercury, Wise, or Bill.com), sending a monthly statement/invoice for transparency.

Cost to you: whatever your bank/AP tool charges for ACH (often $0–a few dollars per transfer) — no per-account monthly fee.
What you get: dead simple, no partner onboarding required, works fine with a handful of partners.
Downside: you own tax reporting yourself (issue 1099-NEC to any US partner you pay >$600/year, unless they're a corporation), no partner self-serve visibility, and it doesn't scale gracefully past a dozen or so partners without building your own tooling.
My recommendation
If you expect a small number of white-label partners (roughly under 10–15): go with Option B. It's less integration work, no per-account fees, and honestly at that scale a spreadsheet + monthly ACH batch is completely manageable.
If you expect to grow this to many partners or want it fully automated/self-serve from day one: go with Stripe Connect Standard. It costs you nothing extra beyond what you're already paying, and it saves you from building payout/reporting tooling yourself later.

Either way, a few things to nail down regardless of which path you pick:

Write a simple reseller agreement covering: the revenue-share %, payout date (e.g., "paid by the 5th of the following month"), and — importantly — how refunds/chargebacks are handled (usually netted against the partner's next payout rather than clawed back separately).
Tag every client to a partner in your database at signup so the monthly revenue-share calculation is a simple query, not a manual reconciliation.
Get a W-9 from each US partner upfront if you'll owe them >$600/year, so you're not scrambling at tax time.

One more thing worth flagging: if partners are actually charging their own end customers directly (rather than you billing everyone and cutting them a check), that's a different setup — you'd want Connect either way, since Stripe needs to know who the actual merchant of record is for compliance. But based on what you described — you bill everyone, you pay partners — the above two options are your real choices.

Want me to sketch out the actual monthly payout calculation logic (how to compute each partner's cut net of refunds) or a rough Connect integration outline?

I am looking at I handle the billing via stripe like you described above but giving white label companies the ability to change the monthly price they want to charge but having a base rate that the whitel label can not go below to protect my costs. What do you thing about this? and what percentage profit should I pay to white label companies monthly aggressive but fair?

What you're describing — a floor price with partners setting their own retail price above it — is actually the dominant, proven model in white-label SaaS, not a variation on revenue-share. It's worth naming that difference clearly, because it changes how you should think about "what percentage do I pay partners."

Floor + markup vs. revenue-share — these are different models
Revenue-share: partner sets price, you take an agreed % of whatever they charge (20–50% is the typical range cited across sources).
Wholesale floor + markup (what you're proposing): you set a fixed floor that covers your costs + your margin. Partner charges whatever they want above that floor and keeps 100% of the difference — there's no ongoing "percentage" to negotiate at all.

The floor model is what you'll see across most successful white-label SaaS programs — GoHighLevel, SuiteDash, and similar all use it, with reported partner margins in the 60–80% range once you account for the wholesale cost. It's cleaner for you too: you don't need to compute a percentage every month, and your revenue per client is guaranteed regardless of what any given partner decides to charge.

My take: stick with the floor model you already proposed. It's simpler to build (one number to enforce), simpler to explain to partners, and it naturally rewards partners who market/sell well without you having to manage a variable commission structure.

Setting the floor

Work backward from your real cost per client, then add your target margin:

Cost component (at ~500 clients, per client)	Estimate
LLM (photo + chat)	~$0.20–0.70
Infra/hosting/support share	~$3–4.50
Payment processing (2.9% + $0.30, absorbed by you before floor)	varies by price point
Total cost per client	~$3.50–5.50

If you want a healthy SaaS-style gross margin (most SaaS businesses target 70–80% gross margin), a floor around $15–20/month per client gives you roughly 3–4x your cost — enough buffer for support overhead, churn, and profit, while still leaving partners plenty of room to mark up to $30, $50, or more depending on how they position it to their own market.

"Aggressive but fair" — reframed

Rather than a %, think of it as: what floor lets a partner realistically hit 65–75% margin at a normal retail price?

Example: floor = $18/client. Partner charges $60/month (a plausible price for a branded nutrition coaching product) → partner keeps $42 of $60 = 70% margin. That's squarely in the "fair and motivating" zone per the benchmarks above — enough for them to want to invest in selling it, while you're comfortably profitable on every client regardless of what they charge.

If a partner sets price right at your floor, you make your target margin and they make $0 extra — which is exactly what protects you, since underpricing is their problem, not yours.

Mechanically, for your Stripe setup
Each partner gets a minimum price you enforce in your partner dashboard/admin before letting them save a new price (simple validation: if (newPrice < floor) reject).
Create a Stripe Price object per partner's chosen rate, tied to your one Product.
Monthly settlement per partner = (partner's retail price − floor) × active clients — this is the number you pay them via whichever method you land on from our earlier conversation (Connect transfer or manual ACH).

One thing to decide before finalizing: can partners change their price whenever they want, or only between billing cycles? Mid-cycle price changes get messy with Stripe subscriptions (proration), so I'd recommend locking price changes to take effect at the next renewal date, not immediately.
## Status
**Very rough guideline — needs much more detail to be effective.**
