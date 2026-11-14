import { create } from 'zustand';

/** Draft shared between the Join sheet and the Scan screen. */
type DraftState = {
  runId: string | null;
  restaurant: string | null;
  last4: string;
  orderName: string;
  dropSpot: string | null;
  start: (runId: string) => void;
  patch: (p: Partial<Omit<DraftState, 'start' | 'patch' | 'clear'>>) => void;
  clear: () => void;
};

export const useJoinDraft = create<DraftState>((set) => ({
  runId: null,
  restaurant: null,
  last4: '',
  orderName: '',
  dropSpot: null,
  start: (runId) =>
    set({ runId, restaurant: null, last4: '', orderName: '', dropSpot: null }),
  patch: (p) => set(p),
  clear: () => set({ runId: null, restaurant: null, last4: '', orderName: '', dropSpot: null }),
}));
