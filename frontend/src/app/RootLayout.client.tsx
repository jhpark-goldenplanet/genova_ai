'use client';

import globalStyles from '@/styles/globalReset';
import 'overlayscrollbars/styles/overlayscrollbars.css';
import { keepPreviousData, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Global } from '@emotion/react';
import { useAlertStore, useConfirmStore, useFreeModalStore } from '@/shared/store';
import { AlertStore, ConfirmStore, FreeModalStore } from '@/shared/store/types';
import { useEffect, useRef } from 'react';
import { isUndefined } from 'lodash-es';
import styled from '@emotion/styled';
import { ToastContainer } from 'react-toastify';
import { AlertModal, ConfirmModal, FreeModal, IModal } from '@/components/Modal';
import { unit } from '@/shared/utils/base';
import { flexRow } from '@/styles/globalStyles';
import { SkeletonTheme } from 'react-loading-skeleton';
import { AuthProvider } from '@/context/AuthContext';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false, //! 모바일이 주환경인 경우에는 true.
			placeholderData: keepPreviousData,
		},
	},
});

export default function RootLayoutClient({ children }: { children: React.ReactNode }) {
	const alertStore = useAlertStore((state: AlertStore) => state);
	const confirmStore = useConfirmStore((state: ConfirmStore) => state);
	const freeModalStore = useFreeModalStore((state: FreeModalStore) => state);

	const alertModal = useRef<IModal>(null);
	const confirmModal = useRef<IModal>(null);
	const freeModal = useRef<IModal>(null);

	useEffect(() => {
		if (isUndefined(alertStore?.show)) return;
		if (alertStore.show) alertModal.current?.open();
		else alertModal.current?.close();
	}, [alertStore?.show]);

	useEffect(() => {
		if (isUndefined(confirmStore?.show)) return;
		if (confirmStore.show) confirmModal.current?.open();
		else confirmModal.current?.close();
	}, [confirmStore?.show]);

	useEffect(() => {
		if (isUndefined(freeModalStore?.show)) return;
		if (freeModalStore.show) freeModal.current?.open();
		else freeModal.current?.close();
	}, [freeModalStore?.show]);

	return (
		<>
			<Global styles={globalStyles} />
			<AuthProvider>
				<QueryClientProvider client={queryClient}>
					<LayoutContainer>
						<ContentWrapper>
							<SkeletonTheme baseColor="#F5F5F5" highlightColor="#DEE5ED" height={unit(18)}>
								{children}
							</SkeletonTheme>
						</ContentWrapper>

						{/*  */}

						<StyledToastContainer newestOnTop />
						<FreeModal ref={freeModal} {...freeModalStore} />
						<ConfirmModal ref={confirmModal} {...confirmStore} />
						<AlertModal ref={alertModal} {...alertStore} />
					</LayoutContainer>
				</QueryClientProvider>
			</AuthProvider>
		</>
	);
}

const StyledToastContainer = styled(ToastContainer)`
	.Toastify__toast {
		width: auto;
		min-height: ${unit(50)};
		padding: ${unit(12)} ${unit(20)} ${unit(16)};

		color: white;
		font-size: ${unit(16)};
		font-weight: 600;

		border-radius: ${unit(8)};
		background: rgba(52, 53, 65, 1);
	}
`;

const LayoutContainer = styled.div`
	box-sizing: border-box;
	overflow-x: hidden;
	width: 100dvw;
	height: 100dvh;
	min-height: 100dvh;
`;

const ContentWrapper = styled.div`
	width: 100%;
	padding: 0;
`;
