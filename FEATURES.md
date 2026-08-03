# Future Features - AI Correction/Learning System

## Overview
Allow trusted testers to report AI mistakes when it misclassifies foods. The AI learns from corrections and adds foods to the correct database lists, making the system smarter over time without code changes.

## Architecture

### User Roles
- **Allen (superadmin)**: Always sees correction button, manages testers, can toggle master switch
- **Testers**: Users marked as `is_tester = true` who can submit corrections
- **Regular users**: Don't see correction button, use base food lists

### Master Controls (Allen-only)
```
Settings:
├── Enable correction feature globally: [ON/OFF]
└── Tester Management:
    ├── User 1: [✓ Tester / ✗ Not tester]
    ├── User 2: [✓ Tester / ✗ Not tester]
    └── User 3: [✓ Tester / ✗ Not tester]
```

### Who Sees the Button
- Allen (superadmin): Always
- Users with `is_tester = true`: See it
- Everyone else: Hidden

## UI Flow

### Correction Button
- Separate from "I messed up" button
- Located in Meal Log page after AI analysis
- Only visible to Allen + testers

### Correction Form
```
Which food was misclassified?
→ Auto-filled with logged food (editable)

What should it be classified as?
→ Dropdown:
  - Starch (Phase 1 violation)
  - Dairy (Phase 1 violation)
  - Sugar (Phase 1 violation)
  - Protein
  - Vegetable
  - Fat
  - Other

[Submit Correction]
```

### After Submission
- Correction saved to database
- Food added to appropriate keyword list
- AI will recognize correctly next time
- Allen can review/delete from admin panel

## Database Changes

### New Tables

#### `food_corrections`
```sql
CREATE TABLE food_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  food_name TEXT NOT NULL,
  correct_category TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved BOOLEAN DEFAULT TRUE,
  reviewed_by TEXT,
  reviewed_at DATETIME
);
```

### User Table Changes
```sql
ALTER TABLE users ADD COLUMN is_tester BOOLEAN DEFAULT FALSE;
```

### Settings Changes
```sql
INSERT INTO settings (key, value) VALUES ('correction_feature_enabled', 'false');
```

## Performance (Keep Fast!)

### Caching Strategy
1. On app startup: Load food corrections from database into memory cache
2. Combine with base keyword lists (hardcoded)
3. All lookups use in-memory cache (O(1) hash lookup)
4. No database queries during normal operation

### Cache Invalidation
- When Allen adds/deletes correction: Update cache immediately
- Background write to database doesn't block user

## Implementation Tasks

### Phase 1 (MVP)
1. Add `is_tester` column to users table
2. Add `correction_feature_enabled` setting
3. Create `food_corrections` table
4. Build tester management UI in admin
5. Add correction button to Meal Log (visible only to Allen + testers)
6. Build correction form dialog
7. Implement correction submission (save to database)
8. Update `analyzeMealPortion` to load corrections into keyword lists
9. In-memory cache for corrections

### Phase 2 (Polish)
10. Admin panel to review/delete corrections
11. Add correction to Allen Dashboard
12. Notifications when testers submit corrections

## Notes
- Corrections apply to ALL clients (global learning)
- Allen is the only one who can manage testers
- Trainer/gym clients don't see this feature
- Speed must remain same as current (in-memory cache)
- Separate from "I messed up" flow - keeps chat clean
