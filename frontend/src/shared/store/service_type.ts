import { ServiceTypeStore } from './types';
import { persist } from 'zustand/middleware';
import { create } from 'zustand';
import sobi_Logo from '@images/sobi.jpg';
import cb_logo from '@images/cb_logo.jpg';
import GA4_Logo from '@images/GA4_Logo.png';
import whiteLogo from '@images/white.jpg';
import genaion_logo_white from '@images/genaion_logo_white.png';

export const useServiceTypeStore = create<ServiceTypeStore>()(
	persist(
		(set) => ({
			selectedServiceType: '',
			isSuperPass: false,
			dispatchSelectedServiceType: (
				selectedServiceType:
					| ''
					| '충북 스마트 챗봇'
					| 'InfoMate 챗봇'
					| 'GA4 챗봇'
					| '소비자원'
					| 'GA4 챗봇(리랭커 적용)'
					| 'GA4 챗봇(HybridSearch)'
					| 'GA4 챗봇(HybridSearch+리랭커)',
			) => set(() => ({ selectedServiceType })),
			dispatchSuperPass: (isSuperPass: boolean) => set(() => ({ isSuperPass })),
		}),

		{
			name: 'selected-service-name',
		},
	),
);

export const NAVIGATION_LOGO_SRC = {
	'': whiteLogo,
	'GA4 챗봇': GA4_Logo,
	'GA4 챗봇(리랭커 적용)': GA4_Logo,
	'GA4 챗봇(HybridSearch)': GA4_Logo,
	'GA4 챗봇(HybridSearch+리랭커)': GA4_Logo,
	'InfoMate 챗봇': genaion_logo_white,
	'충북 스마트 챗봇': cb_logo,
	소비자원: sobi_Logo,
};
