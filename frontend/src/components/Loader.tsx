import React, { FC, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { NAVBAR_WIDTH } from '@/shared/constants';

interface IProps {
	isLoading: boolean;
	isFetching: boolean;
	withSidebar?: boolean;
	progress?: number; // 업로드 진행률 (0-100)
}

interface IContainerProps {
	withSidebar: boolean;
}

const Loader: FC<IProps> = ({ isLoading, isFetching, progress, withSidebar = false }) => {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!(isLoading || isFetching)) return null;
	if (!mounted) return null;

	return createPortal(
		<Container className="wrapper" withSidebar={withSidebar}>
			<figure>
				<svg viewBox="0 0 100 100" style={{ width: '80px', height: '80px', margin: '0 auto' }}>
					<defs>
						<linearGradient id="Gradient">
							<stop offset="0%" stopColor="#4B89D4" />
							<stop offset="54.5%" stopColor="#57D7EE" />
							<stop offset="74%" stopColor="#68ACFF" />
							<stop offset="100%" stopColor="#A0C3FF" />
						</linearGradient>
					</defs>
					<circle className="circle" cx="50" cy="50" r="30" fill="none" />
				</svg>
				{progress !== undefined && progress > 0 && (
					<ProgressText>{progress}%</ProgressText>
				)}
			</figure>
		</Container>,
		document.body
	);
};

const Container = styled.div<IContainerProps>`
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	left: ${({ withSidebar }) => (withSidebar ? NAVBAR_WIDTH : '0px')};
	width: auto;
	min-height: 100vh;
	background-color: rgba(0, 0, 0, 0.7);
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 9999;

	figure {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
	}
	.circle {
		stroke: url(#Gradient);
		stroke-linecap: round;
		stroke-width: 8;
		stroke-dasharray: 140;
		stroke-dashoffset: 40;
	}
	@keyframes loader {
		0% {
			transform: rotate(0);
		}
		100% {
			transform: rotate(360deg);
		}
	}
	svg {
		animation: 1s linear loader infinite;
		position: relative;
	}
`;

const ProgressText = styled.div`
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	color: white;
	font-size: 18px;
	font-weight: bold;
	margin-top: 80px;
	text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

export default Loader;
