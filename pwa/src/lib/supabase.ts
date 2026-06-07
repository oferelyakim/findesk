import { createClient } from '@supabase/supabase-js';
import type { SavedAnalysis, SavedStressTest, StressBaseInputs, StressAssumptions, StressResult, IncomeStatement, BalanceSheet } from '@/types';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Auth ───────────────────────────────────────────────────────────────────────
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
interface SaveAnalysisInput {
  ticker: string;
  note?: string;
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  savedAt: string;
}

export async function saveAnalysis(input: SaveAnalysisInput): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('analyses').insert({
    user_id:           user.id,
    ticker:            input.ticker,
    note:              input.note ?? null,
    income_statements: input.incomeStatements,
    balance_sheets:    input.balanceSheets,
    saved_at:          input.savedAt,
  });
  if (error) throw error;
}

export async function listAnalyses(): Promise<SavedAnalysis[]> {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .order('saved_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id:               row.id,
    ticker:           row.ticker,
    note:             row.note,
    incomeStatements: row.income_statements ?? [],
    balanceSheets:    row.balance_sheets ?? [],
    savedAt:          row.saved_at ?? row.created_at,
  }));
}

export async function deleteAnalysis(id: string): Promise<void> {
  const { error } = await supabase.from('analyses').delete().eq('id', id);
  if (error) throw error;
}

// ── Stress tests ───────────────────────────────────────────────────────────────
interface SaveStressTestInput {
  base: StressBaseInputs;
  assumptions: StressAssumptions;
  result: StressResult;
  savedAt: string;
}

export async function saveStressTest(input: SaveStressTestInput): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('stress_tests').insert({
    user_id:     user.id,
    base:        input.base,
    assumptions: input.assumptions,
    result:      input.result,
    saved_at:    input.savedAt,
  });
  if (error) throw error;
}

export async function listStressTests(): Promise<SavedStressTest[]> {
  const { data, error } = await supabase
    .from('stress_tests')
    .select('*')
    .order('saved_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id:          row.id,
    base:        row.base,
    assumptions: row.assumptions,
    result:      row.result ?? null,
    savedAt:     row.saved_at ?? row.created_at,
  }));
}

export async function deleteStressTest(id: string): Promise<void> {
  const { error } = await supabase.from('stress_tests').delete().eq('id', id);
  if (error) throw error;
}
