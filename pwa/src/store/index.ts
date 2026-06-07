import { create } from 'zustand';
import type { AppTab, CompanyAnalysis, StressBaseInputs } from '@/types';

interface FinDeskStore {
  // Navigation
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  // Company analysis
  activeTicker: string;
  setActiveTicker: (ticker: string) => void;
  lastAnalysis: CompanyAnalysis | null;
  setLastAnalysis: (analysis: CompanyAnalysis | null) => void;

  // Stress test — base inputs pre-populated from last analysis
  stressBaseFromAnalysis: Partial<StressBaseInputs> | null;
  setStressBaseFromAnalysis: (base: Partial<StressBaseInputs> | null) => void;

  // Watchlist
  watchlist: string[];
  addToWatchlist: (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;
}

export const useFinDeskStore = create<FinDeskStore>((set) => ({
  activeTab: 'sp500',
  setActiveTab: (tab) => set({ activeTab: tab }),

  activeTicker: '',
  setActiveTicker: (ticker) => set({ activeTicker: ticker }),

  lastAnalysis: null,
  setLastAnalysis: (analysis) => set({ lastAnalysis: analysis }),

  stressBaseFromAnalysis: null,
  setStressBaseFromAnalysis: (base) => set({ stressBaseFromAnalysis: base }),

  watchlist: [],
  addToWatchlist: (ticker) =>
    set((state) => ({
      watchlist: state.watchlist.includes(ticker)
        ? state.watchlist
        : [...state.watchlist, ticker],
    })),
  removeFromWatchlist: (ticker) =>
    set((state) => ({
      watchlist: state.watchlist.filter((t) => t !== ticker),
    })),
}));
