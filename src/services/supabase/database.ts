import type { PostgrestError } from "@supabase/supabase-js"

import { supabase } from "./supabaseClient"

/**
 * Database Service
 * Helper functions for database operations
 */

export interface DatabaseResponse<T> {
  data: T | null
  error: PostgrestError | null
}

/**
 * Fetch data from a table
 * @param table - Table name
 * @param select - Columns to select (default: *)
 * @param filters - Optional filters object
 * @example
 * const { data, error } = await fetchFromTable('profiles', '*', { id: 'user-id' })
 */
export async function fetchFromTable<T>(
  table: string,
  select = "*",
  filters?: Record<string, any>,
): Promise<DatabaseResponse<T[]>> {
  let query = supabase.from(table).select(select)

  // Apply filters if provided
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value)
    })
  }

  const { data, error } = await query

  return { data: data as T[], error }
}

/**
 * Fetch a single record from a table
 * @param table - Table name
 * @param select - Columns to select (default: *)
 * @param filters - Filters object
 */
export async function fetchSingleFromTable<T>(
  table: string,
  select = "*",
  filters: Record<string, any>,
): Promise<DatabaseResponse<T>> {
  let query = supabase.from(table).select(select)

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value)
  })

  const { data, error } = await query.single()

  return { data: data as T, error }
}

/**
 * Insert a record into a table
 * @param table - Table name
 * @param record - Record to insert
 */
export async function insertIntoTable<T>(
  table: string,
  record: Record<string, any>,
): Promise<DatabaseResponse<T>> {
  const { data, error } = await supabase.from(table).insert(record).select().single()

  return { data: data as T, error }
}

/**
 * Insert multiple records into a table
 * @param table - Table name
 * @param records - Records to insert
 */
export async function insertMultipleIntoTable<T>(
  table: string,
  records: Record<string, any>[],
): Promise<DatabaseResponse<T[]>> {
  const { data, error } = await supabase.from(table).insert(records).select()

  return { data: data as T[], error }
}

/**
 * Update a record in a table
 * @param table - Table name
 * @param updates - Fields to update
 * @param filters - Filters to identify records to update
 */
export async function updateInTable<T>(
  table: string,
  updates: Record<string, any>,
  filters: Record<string, any>,
): Promise<DatabaseResponse<T[]>> {
  let query = supabase.from(table).update(updates)

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value)
  })

  const { data, error } = await query.select()

  return { data: data as T[], error }
}

/**
 * Upsert a record in a table (insert or update if exists)
 * @param table - Table name
 * @param record - Record to upsert
 * @param onConflict - Column(s) to check for conflicts
 */
export async function upsertInTable<T>(
  table: string,
  record: Record<string, any>,
  onConflict?: string,
): Promise<DatabaseResponse<T>> {
  const query = supabase.from(table).upsert(record, {
    onConflict,
  })

  const { data, error } = await query.select().single()

  return { data: data as T, error }
}

/**
 * Delete records from a table
 * @param table - Table name
 * @param filters - Filters to identify records to delete
 */
export async function deleteFromTable(
  table: string,
  filters: Record<string, any>,
): Promise<{ error: PostgrestError | null }> {
  let query = supabase.from(table).delete()

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value)
  })

  const { error } = await query

  return { error }
}

/**
 * Count records in a table
 * @param table - Table name
 * @param filters - Optional filters
 */
export async function countRecords(
  table: string,
  filters?: Record<string, any>,
): Promise<{ count: number | null; error: PostgrestError | null }> {
  let query = supabase.from(table).select("*", { count: "exact", head: true })

  // Apply filters if provided
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value)
    })
  }

  const { count, error } = await query

  return { count, error }
}

/**
 * Execute a custom query
 * @param callback - Callback function that receives the supabase client
 * @example
 * const { data, error } = await executeQuery((client) =>
 *   client.from('users').select('*').eq('status', 'active').order('created_at', { ascending: false })
 * )
 */
export async function executeQuery<T>(
  callback: (client: typeof supabase) => any,
): Promise<DatabaseResponse<T>> {
  const { data, error } = await callback(supabase)
  return { data: data as T, error }
}

/**
 * Call a PostgreSQL function
 * @param functionName - Name of the function
 * @param params - Function parameters
 */
export async function callFunction<T>(
  functionName: string,
  params?: Record<string, any>,
): Promise<DatabaseResponse<T>> {
  const { data, error } = await supabase.rpc(functionName, params)
  return { data: data as T, error }
}
