/**
 * Milestone Type Validation Utility
 * 
 * Run this periodically to validate milestone_type values in the database.
 * Can be used as a health check or before deploying new code.
 * 
 * Usage:
 *   node scripts/validate-milestone-types.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fbiubwhffoclindynute.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const VALID_MILESTONE_TYPES = ['10lb', '20lb', '30lb', 'goal', 'best_week'];

async function validateMilestoneTypes() {
  console.log('Validating milestone_type values in database...');
  
  const { data, error } = await supabase
    .from('milestones')
    .select('id, client_id, milestone_type, achieved_at')
    .order('achieved_at', { ascending: false });

  if (error) {
    console.error('Error fetching milestones:', error);
    process.exit(1);
  }

  const corrupted = data.filter(m => !VALID_MILESTONE_TYPES.includes(m.milestone_type));
  
  if (corrupted.length > 0) {
    console.log(`✗ VALIDATION FAILED: Found ${corrupted.length} corrupted milestone(s)`);
    corrupted.forEach(m => {
      console.log(`  - ID: ${m.id}, Type: "${m.milestone_type}" (INVALID), Client: ${m.client_id}`);
    });
    console.log('\nRun cleanup script to fix: node scripts/cleanup-corrupted-milestones.js');
    process.exit(1);
  } else {
    console.log(`✓ VALIDATION PASSED: All ${data.length} milestone(s) have valid types`);
    console.log(`  Types: ${[...new Set(data.map(m => m.milestone_type))].join(', ') || 'none'}`);
    process.exit(0);
  }
}

validateMilestoneTypes();
