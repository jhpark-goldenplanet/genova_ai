import React, { FC } from 'react';
import styled from '@emotion/styled';

export const LoaderOnly: FC = () => {
	return (
		<Container>
			<svg viewBox="0 0 100 100" style={{ width: '35px', height: '35px', margin: '0 auto' }}>
				<circle className="circle" cx="50" cy="50" r="35" fill="none" stroke="rgba(26, 43, 89, 0.1)" strokeWidth="12" />
				<circle
					className="circle-loader"
					cx="50"
					cy="50"
					r="35"
					fill="none"
					stroke="rgba(26, 43, 89, 1)"
					strokeWidth="12"
				/>
			</svg>
		</Container>
	);
};

const Container = styled.div`
	.circle-loader {
		stroke-linecap: round;
		stroke-dasharray: 220;
		stroke-dashoffset: 188;
		transform-origin: center;
		animation: loader 1s linear infinite;
	}

	@keyframes loader {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
`;
