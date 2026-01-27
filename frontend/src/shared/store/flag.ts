import { create } from 'zustand';
import { FlagStore } from './types';

export const useFlagsStore = create<FlagStore>()((set) => ({
	isUploaded: false,
	dispatchIsUpload: (isUploaded: boolean) => set(() => ({ isUploaded })),
}));
