import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import { flexRow } from '@/styles/globalStyles';
import React, { FC, useState, useEffect } from 'react';
import * as S from './styled';

interface Props {
	label?: string;
	required?: boolean;
	children: React.ReactNode;
}

const RadioWrapper: FC<Props> = ({ label, required = false, children }) => {
	/**
	 * States
	 */

	/**
	 * Queries
	 */

	/**
	 * Side-Effects
	 */

	/**
	 * Handlers
	 */

	/**
	 * Helpers
	 */
	return (
		<Container $label={label}>
			{label && <Label $required={required}>{label}</Label>}
			<Wrapper> {children}</Wrapper>
		</Container>
	);
};

export default RadioWrapper;

const Container = styled.section<{ $label?: string }>`
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: ${unit(6 + 2)};
	${({ $label }) => $label && `margin-top: ${unit(6)}; margin-bottom: ${unit(6)};`}
`;

const Wrapper = styled.article`
	${flexRow}
	gap: ${unit(20)};
`;

export const Label = styled.label<{ $required: boolean }>`
	color: rgb(42, 53, 71);
	letter-spacing: ${unit(-0.24)};
	font-size: ${unit(15)};
	font-weight: 600;
	margin-bottom: ${unit(6)};

	white-space: pre-line;
	word-break: break-all;
	word-wrap: break-word;
	text-align: center;

	${({ $required }) =>
		$required
			? `&::before {
					content: '*';
					color: #f00;
					font-size: ${unit(14)};
					margin-right: ${unit(4)};
				}
				`
			: ''}
`;
