#!/usr/bin/env node
/**
 * Cleanup Corrupted Milestones Script
 * 
 * This script identifies and removes milestone records with corrupted milestone_type values.
 * Valid milestone types: '10lb', '20lb', '30lb', 'goal', 'best_week'
 * 
 * Usage:
 *   node scripts/cleanup-corrupted-milestones.js [--dry-run]
 * 
 * The --dry-run flag will only report what would be deleted without actually deleting.
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase connection - these should be set via environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fbiubwhffoclindynute.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  console.error('Set it with: export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Valid milestone types per schema
const VALID_MILESTONE_TYPES = ['10lb', '20lb', '30lb', 'goal', 'best_week'];

async function cleanupCorruptedMilestones(dryRun = false) {
  console.log('==========================================');
  console.log('Milestone Cleanup Script');
  console.log('==========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be committed)'}`);
  console.log(`Valid milestone types: ${VALID_MILESTONE_TYPES.join(', ')}`);
  console.log('');

  try {
    // Fetch all milestones
    const { data: milestones, error } = await supabase
      .from('milestones')
      .select('id, client_id, milestone_type, achieved_at')
      .order('achieved_at', { ascending: false });

    if (error) {
      console.error('Error fetching milestones:', error);
      process.exit(1);
    }

    console.log(`Total milestones in database: ${milestones.length}`);
    console.log('');

    // Identify corrupted records
    const corrupted = milestones.filter(m => !VALID_MILESTONE_TYPES.includes(m.milestone_type));
    
    if (corrupted.length === 0) {
      console.log('✓ No corrupted milestone records found');
      return;
    }

    console.log(`✗ Found ${corrupted.length} corrupted milestone record(s):`);
    console.log('');
    
    corrupted.forEach(m => {
      console.log(`  ID: ${m.id}`);
      console.log(`  Client ID: ${m.client_id}`);
      console.log(`  Corrupted Type: "${m.milestone_type}"`);
      console.log(`  Achieved At: ${m.achieved_at}`);
      console.log('');
    });

    if (dryRun) {
      console.log('--- DRY RUN: No changes made ---');
      console.log(`Would delete ${corrupted.length} corrupted record(s)`);
    } else {
      // Delete corrupted records
      console.log('--- DELETING CORRUPTED RECORDS ---');
      
      const corruptedIds = corrupted.map(m => m.id);
      const { error: deleteError } = await supabase
        .from('milestones')
        .delete()
        .in('id', corruptedIds);

      if (deleteError) {
        console.error('Error deleting corrupted milestones:', deleteError);
        process.exit(1);
      }

      console.log(`✓ Successfully deleted ${corruptedIds.length} corrupted milestone record(s)`);
    }

    // Summary
    console.log('');
    console.log('==========================================');
    console.log('Cleanup Summary');
    console.log('==========================================');
    console.log(`Valid milestones remaining: ${milestones.length - corrupted.length}`);
    console.log(`Corrupted milestones ${dryRun ? 'would be' : 'were'} deleted: ${corrupted.length}`);

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

// Parse arguments
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');
cleanupCorruptedMilestones(dryRun);
