/**
 * Trainer Session Management
 * 
 * This module handles secure session token management for trainer authentication.
 * 
 * Security model:
 * - When a trainer logs in, a secure random session token is generated
 * - The token (not hashed) is stored in the trainer's database record
 * - The plain token is returned to the client (stored in sessionStorage)
 * - On each API request, the client sends the token in the x-trainer-token header
 * - The server verifies the token against the stored value and extracts trainer_id
 * 
 * This ensures that even if someone knows a trainer ID, they cannot access
 * trainer API routes without the valid session token.
 */

import crypto from 'crypto';
import { getAdminClient } from './db';

// Session token length (in bytes) - 32 bytes = 64 hex characters
const TOKEN_LENGTH = 32;

// Token expiry in seconds (7 days)
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Hash a session token for storage (using SHA-256)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new session for a trainer
 * Stores the token hash in the trainer's database record
 */
export async function createTrainerSession(trainerId: string): Promise<string | null> {
  try {
    const token = generateSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000).toISOString();
    
    const supabase = getAdminClient();
    
    // Store token hash and expiry in trainer record
    const { error } = await supabase
      .from('trainers')
      .update({
        session_token: tokenHash,
        session_expires_at: expiresAt
      })
      .eq('id', trainerId);
    
    if (error) {
      console.error('[createTrainerSession] Failed to store token:', error);
      return null;
    }
    
    console.log('[createTrainerSession] Session created for trainer:', trainerId);
    return token; // Return plain token to client
  } catch (e) {
    console.error('[createTrainerSession] Error:', e);
    return null;
  }
}

/**
 * Verify a trainer session token and return the trainer ID if valid
 */
export async function verifyTrainerSession(token: string | null): Promise<{ valid: boolean; trainerId?: string; error?: string }> {
  if (!token) {
    return { valid: false, error: 'No session token provided' };
  }
  
  try {
    const tokenHash = hashToken(token);
    const supabase = getAdminClient();
    
    // Find trainer with matching token hash
    const { data: trainer, error } = await supabase
      .from('trainers')
      .select('id, session_expires_at')
      .eq('session_token', tokenHash)
      .single();
    
    if (error || !trainer) {
      console.log('[verifyTrainerSession] No trainer found with token hash');
      return { valid: false, error: 'Invalid session token' };
    }
    
    // Check if session has expired
    if (trainer.session_expires_at) {
      const expiresAt = new Date(trainer.session_expires_at);
      if (expiresAt < new Date()) {
        console.log('[verifyTrainerSession] Session expired for trainer:', trainer.id);
        return { valid: false, error: 'Session expired' };
      }
    }
    
    return { valid: true, trainerId: trainer.id };
  } catch (e) {
    console.error('[verifyTrainerSession] Error:', e);
    return { valid: false, error: 'Session verification failed' };
  }
}

/**
 * Clear a trainer's session (logout)
 */
export async function clearTrainerSession(trainerId: string): Promise<boolean> {
  try {
    const supabase = getAdminClient();
    
    const { error } = await supabase
      .from('trainers')
      .update({
        session_token: null,
        session_expires_at: null
      })
      .eq('id', trainerId);
    
    if (error) {
      console.error('[clearTrainerSession] Failed to clear session:', error);
      return false;
    }
    
    console.log('[clearTrainerSession] Session cleared for trainer:', trainerId);
    return true;
  } catch (e) {
    console.error('[clearTrainerSession] Error:', e);
    return false;
  }
}

/**
 * Get the trainer ID from a request's session token
 * Returns the trainer ID if valid, null otherwise
 */
export async function getTrainerIdFromRequest(request: Request): Promise<string | null> {
  // Get token from x-trainer-token header
  const token = request.headers.get('x-trainer-token');
  
  if (!token) {
    return null;
  }
  
  const result = await verifyTrainerSession(token);
  return result.valid ? result.trainerId || null : null;
}
