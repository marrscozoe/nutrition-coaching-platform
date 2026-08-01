// Token store using Supabase kv_store for serverless compatibility
import { db_hget, db_hset, redis_del } from '@/lib/db';

interface TokenData {
  email: string;
  name: string;
  passwordHash: string;
  createdAt: number;
}

const TOKEN_TTL = 10 * 60 * 1000; // 10 minutes

// Keys are prefixed to avoid conflicts
const TOKEN_PREFIX = 'signup_token:';

export async function generateSignupToken(data: { email: string; name: string; passwordHash: string }): Promise<string> {
  // Generate a random token
  const token = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  const fullToken = TOKEN_PREFIX + token;
  
  console.log('[tokenStore] generateSignupToken called for:', data.email);
  console.log('[tokenStore] token:', token);
  console.log('[tokenStore] fullToken key:', fullToken);
  
  try {
    // Store in Supabase kv_store
    await db_hset(fullToken, 'data', {
      ...data,
      createdAt: Date.now(),
    });
    console.log('[tokenStore] db_hset completed for:', fullToken);
  } catch (e) {
    console.error('[tokenStore] db_hset ERROR:', e);
    throw new Error('Failed to store signup token');
  }
  
  return token; // Return without prefix
}

export async function getSignupToken(token: string): Promise<TokenData | null> {
  const fullToken = TOKEN_PREFIX + token;
  console.log('[tokenStore] getSignupToken called for token:', token);
  console.log('[tokenStore] looking up key:', fullToken);
  
  try {
    const stored = await db_hget<{data: TokenData}>(fullToken);
    console.log('[tokenStore] db_hget result:', stored);
    
    if (!stored || !stored.data) {
      console.log('[tokenStore] No data found for key:', fullToken);
      return null;
    }
    
    const data = stored.data;
    
    // Check if expired
    if (Date.now() - data.createdAt > TOKEN_TTL) {
      console.log('[tokenStore] Token expired');
      await deleteSignupToken(token);
      return null;
    }
    
    console.log('[tokenStore] Token retrieved successfully');
    return data;
  } catch (e) {
    console.error('[tokenStore] getSignupToken ERROR:', e);
    return null;
  }
}

export async function deleteSignupToken(token: string): Promise<void> {
  const fullToken = TOKEN_PREFIX + token;
  console.log('[tokenStore] deleteSignupToken:', fullToken);
  await redis_del(fullToken);
}

export async function cleanupExpiredTokens(): Promise<void> {
  // Note: In production, you might want to run a cron job to clean up expired tokens
  // For now, tokens are cleaned up when they're accessed and found to be expired
}
