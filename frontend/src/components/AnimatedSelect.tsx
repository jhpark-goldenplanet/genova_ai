'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';

interface SelectOption {
	value: string;
	label: string;
}

interface AnimatedSelectProps {
	value: string;
	options: SelectOption[];
	onChange: (nextValue: string) => void;
	width?: string;
	placeholder?: string;
	disabled?: boolean;
}

const CLOSE_ANIMATION_MS = 200;

export default function AnimatedSelect({
	value,
	options,
	onChange,
	width = unit(96),
	placeholder,
	disabled = false,
}: AnimatedSelectProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const selected = useMemo(() => {
		return options.find((option) => option.value === value) ?? options[0];
	}, [options, value]);
	const displayLabel = value ? selected?.label ?? '' : placeholder ?? selected?.label ?? '';

	useEffect(() => {
		return () => {
			if (closeTimerRef.current) {
				clearTimeout(closeTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const onOutsideClick = (event: MouseEvent) => {
			if (!rootRef.current) return;
			if (rootRef.current.contains(event.target as Node)) return;
			handleClose();
		};
		document.addEventListener('mousedown', onOutsideClick);
		return () => document.removeEventListener('mousedown', onOutsideClick);
	}, []);

	const handleOpen = () => {
		if (disabled) return;
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
		}
		setIsClosing(false);
		setIsOpen(true);
	};

	const handleClose = () => {
		if (!isOpen) return;
		setIsClosing(true);
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
		}
		closeTimerRef.current = setTimeout(() => {
			setIsOpen(false);
			setIsClosing(false);
		}, CLOSE_ANIMATION_MS);
	};

	const handleToggle = () => {
		if (isOpen && !isClosing) {
			handleClose();
			return;
		}
		handleOpen();
	};

	const handleSelect = (nextValue: string) => {
		if (disabled) return;
		onChange(nextValue);
		handleClose();
	};

	return (
		<Root ref={rootRef} style={{ width }}>
			<Trigger type="button" onClick={handleToggle} aria-expanded={isOpen && !isClosing} disabled={disabled}>
				<TriggerText $placeholder={!value}>{displayLabel}</TriggerText>
				<Caret $open={isOpen && !isClosing}>▾</Caret>
			</Trigger>
			{isOpen && !disabled ? (
				<Panel $closing={isClosing}>
					{options.map((option) => (
						<OptionItem key={option.value}>
							<OptionButton
								type="button"
								$active={option.value === value}
								onClick={() => handleSelect(option.value)}
							>
								{option.label}
							</OptionButton>
						</OptionItem>
					))}
				</Panel>
			) : null}
		</Root>
	);
}

const Root = styled.div`
	position: relative;
`;

const Trigger = styled.button`
	width: 100%;
	height: ${unit(36)};
	border-radius: ${unit(8)};
	border: 1px solid rgba(201, 211, 225, 1);
	background: white;
	color: rgba(31, 42, 68, 1);
	font-size: ${unit(13)};
	font-weight: 600;
	padding: 0 ${unit(10)};
	display: flex;
	align-items: center;
	justify-content: space-between;
	transition: border-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		border-color: rgba(152, 174, 210, 1);
	}

	&:disabled {
		background: rgba(221, 227, 238, 1) !important;
		color: rgba(112, 121, 138, 1) !important;
		border-color: rgba(170, 181, 203, 1) !important;
		cursor: default;
	}

	&:disabled:hover {
		background: rgba(221, 227, 238, 1) !important;
		border-color: rgba(170, 181, 203, 1) !important;
	}

	&:focus-visible {
		outline: none;
		border-color: rgba(75, 137, 212, 1);
		box-shadow: 0 0 0 3px rgba(75, 137, 212, 0.15);
	}
`;

const TriggerText = styled.span<{ $placeholder: boolean }>`
	color: ${({ $placeholder }) => ($placeholder ? 'rgba(108, 122, 150, 1)' : 'inherit')};
`;

const Caret = styled.span<{ $open: boolean }>`
	font-size: ${unit(12)};
	color: rgba(96, 107, 138, 1);
	transition: transform 0.2s ease;
	transform: ${({ $open }) => ($open ? 'rotate(180deg)' : 'rotate(0deg)')};
`;

const Panel = styled.ul<{ $closing: boolean }>`
	@keyframes panelIn {
		from {
			opacity: 0;
			transform: translateY(${unit(8)});
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes panelOut {
		from {
			opacity: 1;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			transform: translateY(${unit(8)});
		}
	}

	position: absolute;
	top: calc(100% + ${unit(6)});
	left: 0;
	width: 100%;
	padding: ${unit(4)};
	border-radius: ${unit(8)};
	border: 1px solid rgba(201, 211, 225, 1);
	background: white;
	box-shadow: 0 12px 24px rgba(15, 31, 64, 0.12);
	z-index: 40;
	animation: ${({ $closing }) => ($closing ? 'panelOut 0.2s ease forwards' : 'panelIn 0.2s ease forwards')};
`;

const OptionItem = styled.li`
	width: 100%;
`;

const OptionButton = styled.button<{ $active: boolean }>`
	width: 100%;
	height: ${unit(34)};
	padding: 0 ${unit(8)};
	border-radius: ${unit(6)};
	display: flex;
	align-items: center;
	background: ${({ $active }) => ($active ? 'rgba(231, 241, 255, 1)' : 'white')};
	color: ${({ $active }) => ($active ? 'rgba(31, 73, 145, 1)' : 'rgba(46, 59, 90, 1)')};
	font-size: ${unit(13)};
	font-weight: ${({ $active }) => ($active ? 700 : 600)};
	transition: background-color 0.2s ease, color 0.2s ease;

	&:hover {
		background: rgba(238, 244, 253, 1);
	}
`;
