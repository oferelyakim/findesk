import { create } from 'zustand';
import type { AppTab, StressBaseInputs } from '@/types';

interface FinDeskStore {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  activeTicker: string;
  setActiveTicker: (ticker: string) => void;

  stressBaseFromAnalysis: StressBaseInputs | null;
  setStressBaseFromAnalysis: (base: StressBaseInputs | null) => void;

  lastAnalysis: null;  // kept for compat; not used
  setLastAnalysis: (a: null) => void;

  watchlist: string[];
  addToWatchlist:      (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;
}

export const useFinDeskStore = create<FinDeskStore>((set) => ({
  activeTab:    'sp500',
  setActiveTab: (tab) => set({ activeTab: tab }),

  activeTicker:    '',
  setActiveTicker: (ticker) => set({ activeTicker: ticker }),

  stressBaseFromAnalysis:    null,
  setStressBaseFromAnalysis: (base) => set({ stressBaseFromAnalysis: base }),

  lastAnalysis:    null,
  setLastAnalysis: (a) => set({ lastAnalysis: a }),

  watchlist: [],
  addToWatchlist: (ticker) =>
    set((state) => ({
      watchlist: state.watchlist.includes(ticker) ? state.watchlist : [...state.watchlist, ticker],
    })),
  removeFromWatchlist: (ticker) =>
    set((state) => ({ watchlist: state.watchlist.filter((t) => t !== ticker) })),
}));
