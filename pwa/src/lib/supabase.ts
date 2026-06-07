import { createClient } from '@supabase/supabase-js';
import type { SavedAnalysis, SavedStressTest, CompanyAnalysis, StressBaseInputs, StressAssumptions, StressResult } from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Auth helpers ───────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── Analyses ───────────────────────────────────────────────────────────────────
export async function saveAnalysis(
  ticker: string,
  companyName: string,
  data: CompanyAnalysis,
  note: string | null = null,
): Promise<SavedAnalysis> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data: row, error } = await supabase
    .from('analyses')
    .insert({
      user_id: user.id,
      ticker,
      company_name: companyName,
      data,
      note,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: row.id,
    ticker: row.ticker,
    companyName: row.company_name,
    data: row.data,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function listAnalyses(): Promise<SavedAnalysis[]> {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    ticker: row.ticker,
    companyName: row.company_name,
    data: row.data,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export async function deleteAnalysis(id: string): Promise<void> {
  const { error } = await supabase.from('analyses').delete().eq('id', id);
  if (error) throw error;
}

// ── Stress tests ───────────────────────────────────────────────────────────────
export async function saveStressTest(
  ticker: string | null,
  companyName: string | null,
  baseData: StressBaseInputs,
  assumptions: StressAssumptions,
  results: StressResult,
  note: string | null = null,
): Promise<SavedStressTest> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data: row, error } = await supabase
    .from('stress_tests')
    .insert({
      user_id: user.id,
      ticker,
      company_name: companyName,
      base_data: baseData,
      assumptions,
      results,
      note,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: row.id,
    ticker: row.ticker,
    companyName: row.company_name,
    baseData: row.base_data,
    assumptions: row.assumptions,
    results: row.results,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function listStressTests(): Promise<SavedStressTest[]> {
  const { data, error } = await supabase
    .from('stress_tests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    ticker: row.ticker,
    companyName: row.company_name,
    baseData: row.base_data,
    assumptions: row.assumptions,
    results: row.results,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export async function deleteStressTest(id: string): Promise<void> {
  const { error } = await supabase.from('stress_tests').delete().eq('id', id);
  if (error) throw error;
}
