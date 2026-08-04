/**
 * Food Corrections Cache - In-memory cache for AI food misclassification corrections
 * 
 * How it works:
 * - On server startup: Load all APPROVED corrections from database into memory
 * - Corrections are keyed by lowercase food name for O(1) lookup
 * - When analyzing meals: Check cache first, override default category if found
 * - When Allen adds/deletes corrections: Update cache immediately + write to DB
 * 
 * Structure:
 * {
 *   "grilled chicken": { category: "protein", originalCategories: ["unknown"] },
 *   "bacon": { category: "protein", originalCategories: ["lean_protein"] },
 *   ...
 * }
 */

import { getAdminClient } from './db';

// In-memory cache - keyed by lowercase food name
interface FoodCorrection {
  id: string;
  foodName: string;
  correctCategory: string; // 'protein', 'vegetable', 'fat', 'starch', 'dairy', 'sugar', 'other'
  submittedBy: string;
  submittedAt: string;
  approved: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface CorrectionCache {
  [foodNameLower: string]: FoodCorrection;
}

let correctionsCache: CorrectionCache = {};
let cacheLoaded = false;
let cacheInitPromise: Promise<void> | null = null;

/**
 * Initialize the cache by loading all APPROVED corrections from the database
 */
export async function initializeCorrectionsCache(): Promise<void> {
  if (cacheLoaded) return;
  
  // Prevent multiple simultaneous initializations
  if (cacheInitPromise) return cacheInitPromise;
  
  cacheInitPromise = _loadCorrectionsFromDb();
  return cacheInitPromise;
}

async function _loadCorrectionsFromDb(): Promise<void> {
  try {
    console.log('[FoodCorrectionsCache] Loading corrections from database...');
    const supabase = getAdminClient();
    
    const { data, error } = await supabase
      .from('food_corrections')
      .select('*')
      .eq('approved', true);
    
    if (error) {
      console.error('[FoodCorrectionsCache] Error loading corrections:', error);
      return;
    }
    
    correctionsCache = {};
    if (data && Array.isArray(data)) {
      for (const correction of data) {
        const key = correction.food_name.toLowerCase().trim();
        correctionsCache[key] = {
          id: correction.id,
          foodName: correction.food_name,
          correctCategory: correction.correct_category,
          submittedBy: correction.submitted_by,
          submittedAt: correction.submitted_at,
          approved: correction.approved,
          reviewedBy: correction.reviewed_by,
          reviewedAt: correction.reviewed_at,
        };
      }
    }
    
    console.log(`[FoodCorrectionsCache] Loaded ${Object.keys(correctionsCache).length} corrections into memory cache`);
    cacheLoaded = true;
  } catch (e) {
    console.error('[FoodCorrectionsCache] Failed to load corrections:', e);
    cacheLoaded = true; // Mark as loaded even on error to prevent retry loops
  }
}

/**
 * Get a correction for a specific food name
 * Returns undefined if no correction exists
 */
export function getCorrection(foodName: string): FoodCorrection | undefined {
  if (!cacheLoaded) {
    // If cache not loaded yet, trigger async load and return undefined for now
    initializeCorrectionsCache();
    return undefined;
  }
  return correctionsCache[foodName.toLowerCase().trim()];
}

/**
 * Get all corrections from cache
 */
export function getAllCorrections(): CorrectionCache {
  if (!cacheLoaded) {
    initializeCorrectionsCache();
  }
  return { ...correctionsCache };
}

/**
 * Add a new correction to the cache and database
 * Returns the new correction or throws on error
 */
export async function addCorrection(
  foodName: string,
  correctCategory: string,
  submittedBy: string,
  approved: boolean = true,
  reviewedBy?: string
): Promise<FoodCorrection> {
  const supabase = getAdminClient();
  
  const correction = {
    food_name: foodName.trim(),
    correct_category: correctCategory,
    submitted_by: submittedBy,
    approved,
    reviewed_by: reviewedBy || null,
    reviewed_at: reviewedBy ? new Date().toISOString() : null,
  };
  
  const { data, error } = await supabase
    .from('food_corrections')
    .insert(correction)
    .select()
    .single();
  
  if (error) {
    console.error('[FoodCorrectionsCache] Error adding correction:', error);
    throw new Error(`Failed to add correction: ${error.message}`);
  }
  
  // Add to in-memory cache immediately
  const key = data.food_name.toLowerCase().trim();
  correctionsCache[key] = {
    id: data.id,
    foodName: data.food_name,
    correctCategory: data.correct_category,
    submittedBy: data.submitted_by,
    submittedAt: data.submitted_at,
    approved: data.approved,
    reviewedBy: data.reviewed_by,
    reviewedAt: data.reviewed_at,
  };
  
  console.log(`[FoodCorrectionsCache] Added correction: "${data.food_name}" -> ${data.correct_category}`);
  return correctionsCache[key];
}

/**
 * Delete a correction from cache and database
 */
export async function deleteCorrection(id: string): Promise<void> {
  const supabase = getAdminClient();
  
  // Find the correction in cache to get the key
  let correctionToDelete: FoodCorrection | undefined;
  for (const key of Object.keys(correctionsCache)) {
    if (correctionsCache[key].id === id) {
      correctionToDelete = correctionsCache[key];
      break;
    }
  }
  
  // Delete from database
  const { error } = await supabase
    .from('food_corrections')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[FoodCorrectionsCache] Error deleting correction:', error);
    throw new Error(`Failed to delete correction: ${error.message}`);
  }
  
  // Remove from in-memory cache
  if (correctionToDelete) {
    const key = correctionToDelete.foodName.toLowerCase().trim();
    delete correctionsCache[key];
    console.log(`[FoodCorrectionsCache] Deleted correction: "${correctionToDelete.foodName}"`);
  }
}

/**
 * Invalidate and reload the cache from database
 */
export async function invalidateCache(): Promise<void> {
  cacheLoaded = false;
  cacheInitPromise = null;
  await initializeCorrectionsCache();
}

/**
 * Check if cache is loaded
 */
export function isCacheLoaded(): boolean {
  return cacheLoaded;
}

// Valid correction categories
export const CORRECTION_CATEGORIES = [
  { value: 'protein', label: 'Protein' },
  { value: 'vegetable', label: 'Vegetable' },
  { value: 'fat', label: 'Fat' },
  { value: 'starch', label: 'Starch (Phase 1 violation)' },
  { value: 'dairy', label: 'Dairy (Phase 1 violation)' },
  { value: 'sugar', label: 'Sugar (Phase 1 violation)' },
  { value: 'other', label: 'Other' },
];
