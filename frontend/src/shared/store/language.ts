import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LanguageStore } from './types';

export const useLanguageStore = create<LanguageStore>()(
	persist(
		(set) => ({
			language: 'ko',
			dispatchLanguage: (language: string) => set(() => ({ language })),
		}),
		{
			name: 'language-storage',
		}
	)
);
