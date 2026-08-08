import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { defaultPromptConfig, type PromptConfig } from '../core/prompt';
import type { BirthInput } from '../core/types';
import { TOKYO } from '../data/cities';

export type Theme = 'system' | 'light' | 'dark';
/** 四柱を並べる向き。参考にしたアプリは右から左だが、既定は日本語の読み順に合わせる。 */
export type PillarOrder = 'ltr' | 'rtl';

export const EMPTY_INPUT: BirthInput = {
  name: '',
  gender: 'male',
  calendar: 'solar',
  year: 1990,
  month: 1,
  day: 1,
  time: { kind: 'hm', hour: 12, minute: 0 },
  place: TOKYO,
  dst: false,
  options: {
    trueSolarTime: true,
    equationOfTime: true,
    sect: 2,
    lateZi: false,
  },
};

interface AppState {
  input: BirthInput;
  setInput: (patch: Partial<BirthInput>) => void;
  replaceInput: (input: BirthInput) => void;

  theme: Theme;
  setTheme: (theme: Theme) => void;

  pillarOrder: PillarOrder;
  setPillarOrder: (order: PillarOrder) => void;

  promptConfig: PromptConfig;
  setPromptConfig: (patch: Partial<PromptConfig>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      input: EMPTY_INPUT,
      setInput: (patch) => set((s) => ({ input: { ...s.input, ...patch } })),
      replaceInput: (input) => set({ input }),

      theme: 'system',
      setTheme: (theme) => set({ theme }),

      pillarOrder: 'ltr',
      setPillarOrder: (pillarOrder) => set({ pillarOrder }),

      promptConfig: defaultPromptConfig(new Date().getFullYear()),
      setPromptConfig: (patch) =>
        set((s) => ({ promptConfig: { ...s.promptConfig, ...patch } })),
    }),
    {
      name: 'meishiki-note',
      version: 1,
      // 生年月日は個人情報なので、このブラウザの localStorage から外へは出さない
      partialize: (s) => ({
        input: s.input,
        theme: s.theme,
        pillarOrder: s.pillarOrder,
        promptConfig: s.promptConfig,
      }),
    }
  )
);
