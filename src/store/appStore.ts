import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { defaultPromptConfig, type PromptConfig } from '../core/prompt';
import type { BirthInput } from '../core/types';
import { TOKYO } from '../data/cities';

export type Theme = 'system' | 'light' | 'dark';
/**
 * 四柱を並べる向き。既定は万年暦と同じ「時・日・月・年」（rtl）。
 * 年から読みたいときは 'ltr' に切り替える。
 */
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

/** localStorage に残す部分。操作の関数は保存しない。 */
type PersistedState = Pick<AppState, 'input' | 'theme' | 'pillarOrder' | 'promptConfig'>;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      input: EMPTY_INPUT,
      setInput: (patch) => set((s) => ({ input: { ...s.input, ...patch } })),
      replaceInput: (input) => set({ input }),

      theme: 'system',
      setTheme: (theme) => set({ theme }),

      pillarOrder: 'rtl',
      setPillarOrder: (pillarOrder) => set({ pillarOrder }),

      promptConfig: defaultPromptConfig(new Date().getFullYear()),
      setPromptConfig: (patch) =>
        set((s) => ({ promptConfig: { ...s.promptConfig, ...patch } })),
    }),
    {
      name: 'meishiki-note',
      version: 2,
      // v1 では四柱を「年→時」で並べていた。既定を「時→年」に変えたので、
      // 保存済みの設定も一度そちらへ寄せる（以降は切り替えた内容がそのまま残る）
      migrate: (persisted, version): PersistedState => {
        const state = persisted as PersistedState;
        if (version < 2) return { ...state, pillarOrder: 'rtl' };
        return state;
      },
      // 生年月日は個人情報なので、このブラウザの localStorage から外へは出さない
      partialize: (s): PersistedState => ({
        input: s.input,
        theme: s.theme,
        pillarOrder: s.pillarOrder,
        promptConfig: s.promptConfig,
      }),
    }
  )
);
