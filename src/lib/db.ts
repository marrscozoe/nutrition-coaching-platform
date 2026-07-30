import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Supabase Client Setup
// ============================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient;

console.log('[Supabase] Init - URL:', supabaseUrl, 'KEY length:', supabaseAnonKey.length);
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('[Supabase] Client initialized, URL:', supabaseUrl ? '✓' : '✗');
  console.log('[Supabase] ANON_KEY set:', !!supabaseAnonKey);
} catch (e) {
  console.error('[Supabase] Failed to initialize:', e);
  supabase = createClient('http://placeholder', 'placeholder');
}

// ============================================
// Prepared Statement Wrapper (for SQL.js compatibility)
// ============================================
class PreparedStatement {
  sql: string;
  params: any[] = [];

  constructor(sql: string) {
    this.sql = sql;
  }

  bind(...params: any[]) {
    this.params = params;
    return this;
  }
}

// ============================================
// getDb - Returns a wrapper compatible with SQL.js patterns
// ============================================
export async function getDb() {
  return {
    prepare: (sql: string) => new PreparedStatement(sql)
  };
}

// ============================================
// Helper: Parse SQL and convert to Supabase query
// ============================================
function parseSql(sql: string | PreparedStatement) {
  const sqlStr = typeof sql === 'string' ? sql : sql.sql;
  const params = typeof sql === 'string' ? [] : (sql.params || []);
  
  // Parse table name
  const fromMatch = sqlStr.match(/FROM\s+(\w+)/i) || sqlStr.match(/UPDATE\s+(\w+)/i) || sqlStr.match(/INTO\s+(\w+)/i);
  const table = fromMatch ? fromMatch[1].toLowerCase() : null;
  
  // Parse WHERE clause
  const whereMatch = sqlStr.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|\s+OFFSET|$)/i);
  const whereStr = whereMatch ? whereMatch[1] : '';
  
  // Parse ORDER BY
  const orderMatch = sqlStr.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
  const orderCol = orderMatch ? orderMatch[1] : null;
  const orderDir = orderMatch ? (orderMatch[2] || 'DESC').toUpperCase() : 'DESC';
  
  // Parse LIMIT/OFFSET
  const limitMatch = sqlStr.match(/LIMIT\s+(\d+)/i);
  const offsetMatch = sqlStr.match(/OFFSET\s+(\d+)/i);
  
  // Extract column values from WHERE clause
  const conditions: Record<string, any> = {};
  const paramMatches = Array.from(whereStr.matchAll(/(\w+)\s*(?:=|IN)\s*\?/gi));
  let paramIndex = 0;
  for (const match of paramMatches) {
    conditions[match[1]] = params[paramIndex++];
  }
  
  return {
    sql: sqlStr,
    table,
    conditions,
    orderCol,
    orderDir,
    limit: limitMatch ? parseInt(limitMatch[1]) : undefined,
    offset: offsetMatch ? parseInt(offsetMatch[1]) : undefined
  };
}

// ============================================
// db_all - SELECT multiple rows
// ============================================
export async function db_all<T = any>(sql: string | PreparedStatement, ...params: any[]): Promise<T[]> {
  try {
    const allParams = params.length > 0 ? params : (sql instanceof PreparedStatement ? sql.params : []);
    const { table, conditions, orderCol, orderDir, limit, offset } = parseSql(sql);
    
    if (!table) return [];
    
    let query = supabase.from(table).select('*');
    
    for (const [key, value] of Object.entries(conditions)) {
      query = query.eq(key, value);
    }
    
    if (orderCol) {
      query = query.order(orderCol, { ascending: orderDir === 'ASC' });
    } else {
      query = query.order('created_at', { ascending: false });
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    if (offset !== undefined) {
      const start = offset;
      const end = limit ? offset + limit : offset + 10;
      query = query.range(start, end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[db_all] Supabase error:', error);
      return [];
    }
    
    return (data as T[]) || [];
  } catch (e) {
    console.error('[db_all] Error:', e);
    return [];
  }
}

// ============================================
// db_get - SELECT single row
// ============================================
export async function db_get<T = any>(sql: string | PreparedStatement, ...params: any[]): Promise<T | null> {
  try {
    const results = await db_all<T>(sql, ...params);
    return results.length > 0 ? results[0] : null;
  } catch (e) {
    console.error('[db_get] Error:', e);
    return null;
  }
}

// ============================================
// db_run - INSERT, UPDATE, DELETE
// Returns { success: true } or { success: false, error: string }
// ============================================
export async function db_run(sql: string | PreparedStatement, ...params: any[]): Promise<{ success: boolean; error?: string }> {
  try {
    const allParams = params.length > 0 ? params : (sql instanceof PreparedStatement ? sql.params : []);
    const sqlStr = typeof sql === 'string' ? sql : sql.sql;
    const sqlLower = sqlStr.trim().toLowerCase();
    
    console.log('[db_run] SQL:', sqlLower.substring(0, 100));
    console.log('[db_run] Params:', allParams.length);
    
    if (sqlLower.startsWith('insert')) {
      const insertMatch = sqlStr.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES/i);
      if (!insertMatch) {
        return { success: false, error: 'Could not parse INSERT' };
      }
      
      const table = insertMatch[1].toLowerCase();
      const colsStr = insertMatch[2];
      const cols = colsStr.split(',').map(c => c.trim());
      
      const obj: Record<string, any> = {};
      for (let i = 0; i < cols.length && i < allParams.length; i++) {
        obj[cols[i]] = allParams[i];
      }
      
      // Handle uuid_generate_v4()
      if (obj.id && (obj.id === 'uuid_generate_v4()' || obj.id === '')) {
        obj.id = uuidv4();
      }
      
      console.log('[db_run] INSERT into table:', table);
      console.log('[db_run] INSERT obj keys:', Object.keys(obj));
      
      console.log('[db_run] INSERT into table:', table);
      console.log('[db_run] INSERT obj:', JSON.stringify(obj));
      
      const { error } = await supabase.from(table).insert(obj);
      if (error) {
        console.error('[db_run] INSERT error:', error);
        console.error('[db_run] INSERT error details:', JSON.stringify(error));
        return { success: false, error: `INSERT failed: ${error.message}` };
      }
      return { success: true };
      
    } else if (sqlLower.startsWith('update')) {
      const updateMatch = sqlStr.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE/i);
      if (!updateMatch) {
        return { success: false, error: 'Could not parse UPDATE' };
      }
      
      const table = updateMatch[1].toLowerCase();
      const setStr = updateMatch[2];
      
      const setMatches = setStr.match(/(\w+)\s*=\s*\?/gi) || [];
      const whereStart = sqlStr.toLowerCase().indexOf('where');
      const whereParams = allParams.slice(setMatches.length);
      
      const obj: Record<string, any> = {};
      for (let i = 0; i < setMatches.length; i++) {
        const colMatch = setMatches[i].match(/(\w+)/i);
        if (colMatch) {
          obj[colMatch[1]] = allParams[i];
        }
      }
      
      const whereClause = sqlStr.substring(whereStart + 5).trim();
      const whereConditions: Record<string, any> = {};
      const whereParamMatches = Array.from(whereClause.matchAll(/(\w+)\s*(?:=|IN)\s*\?/gi));
      let paramIdx = 0;
      for (const match of whereParamMatches) {
        whereConditions[match[1]] = whereParams[paramIdx++];
      }
      
      let query = supabase.from(table).update(obj);
      for (const [key, value] of Object.entries(whereConditions)) {
        query = query.eq(key, value);
      }
      
      const { error } = await query;
      if (error) {
        console.error('[db_run] UPDATE error:', error);
        return { success: false, error: `UPDATE failed: ${error.message}` };
      }
      return { success: true };
      
    } else if (sqlLower.startsWith('delete')) {
      const deleteMatch = sqlStr.match(/DELETE FROM\s+(\w+)\s+WHERE\s+(.+)$/i);
      if (!deleteMatch) return { success: false, error: 'Could not parse DELETE' };
      
      const table = deleteMatch[1].toLowerCase();
      const whereClause = deleteMatch[2];
      
      const whereConditions: Record<string, any> = {};
      const whereParamMatches = Array.from(whereClause.matchAll(/(\w+)\s*(?:=|IN)\s*\?/gi));
      let paramIdx = 0;
      for (const match of whereParamMatches) {
        whereConditions[match[1]] = allParams[paramIdx++];
      }
      
      let query = supabase.from(table).delete();
      for (const [key, value] of Object.entries(whereConditions)) {
        query = query.eq(key, value);
      }
      
      const { error } = await query;
      if (error) {
        console.error('[db_run] DELETE error:', error);
        return { success: false, error: `DELETE failed: ${error.message}` };
      }
      return { success: true };
    }
    
    return { success: false, error: 'Unknown SQL statement type' };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[db_run] Error:', e);
    return { success: false, error: errMsg };
  }
}

// ============================================
// forceSyncDb - No-op for Supabase
// ============================================
export async function forceSyncDb(): Promise<void> {
  // No-op: Supabase handles persistence automatically
}

// ============================================
// Redis-style hash operations (for compatibility)
// ============================================

export async function redis_get<T = any>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('kv_store')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  
  if (error || !data) return null;
  try {
    return JSON.parse(data.value) as T;
  } catch {
    return data.value as T;
  }
}

export async function redis_set(key: string, value: any): Promise<void> {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  await supabase.from('kv_store').upsert({ key, value: stringValue }, { onConflict: 'key' });
}

export async function redis_del(key: string): Promise<void> {
  await supabase.from('kv_store').delete().eq('key', key);
}

export async function db_hget<T = any>(key: string, field?: string): Promise<T | null> {
  if (field) {
    const fullData = await redis_get<Record<string, any>>(key);
    return fullData ? (fullData[field] as T) : null;
  }
  return redis_get<T>(key);
}

export const db_hset = async (key: string, field: string, value: any) => {
  const current = await redis_get<Record<string, any>>(key) || {};
  current[field] = value;
  await redis_set(key, current);
};

export const db_hgetall = redis_get;
export const db_sadd = async () => {};
export const db_smembers = async () => [];
export const db_srem = async () => {};
export const db_keys = async () => [];

// ============================================
// Type definitions
// ============================================
export interface Trainer {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  business_name?: string;
  brand_color: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  trainer_id?: string;
  email: string;
  password_hash: string;
  name: string;
  gender?: 'male' | 'female';
  program_type?: 'event_ready' | 'muscle_gain' | 'general_health' | 'first_responder';
  starting_weight?: number;
  current_weight?: number;
  goal_weight?: number;
  goal_type?: string;
  goal_start_date?: string;
  event_date?: string;
  current_phase: number;
  current_week: number;
  waiver_signed: boolean;
  waiver_signed_at?: string;
  subscription_status: string;
  subscription_end_date?: string;
  notes?: string;
  lead_source?: string;
  created_at: string;
  updated_at: string;
}

export interface WeighIn {
  id: string;
  client_id: string;
  weight: number;
  body_fat_percent?: number;
  pant_size?: string;
  waist_size?: string;
  notes?: string;
  weigh_day?: 'monday' | 'friday';
  created_at: string;
}

export interface MealLog {
  id: string;
  client_id: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_description?: string;
  photo_url?: string;
  photo_analyzed: boolean;
  analyzed_text?: string;
  portion_advice?: string;
  on_phase: boolean;
  messed_up: boolean;
  logged_at: string;
  meal_date?: string;
}

export interface Milestone {
  id: string;
  client_id: string;
  milestone_type: '10lb' | '20lb' | '30lb' | 'goal' | 'best_week';
  achieved_at: string;
}

export interface Feedback {
  id: string;
  trainer_id?: string;
  client_id: string;
  message: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
  resolved_at?: string;
}

export type { MealLog as MealLogRow };

export { supabase };
