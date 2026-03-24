'use client';

import styled from '@emotion/styled';
import Button from '@/components/Button';
import * as ModalS from '@/components/Modal/styled';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { unit } from '@/shared/utils/base';
import { readTokenState, getRemaining, getMemberUsage } from '@/shared/utils/tokenState';
import * as S from '../styled';

interface MemberRow {
	id: string;
	organization: string;
	name: string;
	role: string;
	usedTokens: number;
	createdAt: string;
}

const ORG_MEMBER_LIMIT = 35;

const buildSampleMembers = (): MemberRow[] => {
	const ts = readTokenState();
	return [
		{ id: 'njw_admin', organization: '농정원', name: '김민지', role: '관리자', usedTokens: getMemberUsage(ts, 'njw_admin'), createdAt: '2026-03-02' },
		{ id: 'njw_editor_01', organization: '농정원', name: '박지훈', role: '편집자', usedTokens: getMemberUsage(ts, 'njw_editor_01'), createdAt: '2026-03-01' },
		{ id: 'gp_hklee', organization: '골든플래닛', name: '이형근', role: '관리자', usedTokens: getMemberUsage(ts, 'gp_hklee'), createdAt: '2026-02-28' },
		{ id: 'njw_viewer_02', organization: '농정원', name: '정유진', role: '뷰어', usedTokens: getMemberUsage(ts, 'njw_viewer_02'), createdAt: '2026-02-25' },
	];
};

const formatTokens = (usedTokens: number) => `${usedTokens.toLocaleString()} Tokens`;
const MODAL_ANIMATION_MS = 220;

export default function MemberManagementPage() {
	const [members, setMembers] = useState<MemberRow[]>(() => buildSampleMembers());
	const [modalMode, setModalMode] = useState<'create' | 'edit'>('edit');
	const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
	const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
	const [mounted, setMounted] = useState(false);
	const [isModalClosing, setIsModalClosing] = useState(false);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setMounted(true);
		return () => {
			if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		};
	}, []);

	const tokenState = useMemo(() => readTokenState(), []);
	const orgTokenLimit = tokenState.org.monthlyLimit;
	const sortedMembers = useMemo(() => {
		return [...members].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}, [members]);
	const totalUsedTokens = useMemo(() => members.reduce((sum, member) => sum + member.usedTokens, 0), [members]);

	const closeModal = () => {
		if (!editingMember) return;
		setIsModalClosing(true);
		if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		closeTimerRef.current = setTimeout(() => {
			setSelectedMemberId(null);
			setEditingMember(null);
			setIsModalClosing(false);
		}, MODAL_ANIMATION_MS);
	};

	const openModal = (member: MemberRow) => {
		if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		setIsModalClosing(false);
		setModalMode('edit');
		setSelectedMemberId(member.id);
		setEditingMember(member);
	};

	const openCreateModal = () => {
		if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		setIsModalClosing(false);
		setModalMode('create');
		setSelectedMemberId(null);
		setEditingMember({
			id: '',
			organization: '',
			name: '',
			role: '뷰어',
			usedTokens: 0,
			createdAt: new Date().toISOString().slice(0, 10),
		});
	};

	const updateEditingField = (key: keyof MemberRow, value: string) => {
		setEditingMember((prev) => {
			if (!prev) return prev;
			if (key === 'usedTokens') {
				return { ...prev, [key]: Number(value.replace(/[^0-9]/g, '')) || 0 };
			}
			return { ...prev, [key]: value };
		});
	};

	const handleSave = () => {
		if (!editingMember) return;
		if (modalMode === 'create') {
			setMembers((prev) => [editingMember, ...prev]);
		} else {
			setMembers((prev) => prev.map((member) => (member.id === editingMember.id ? editingMember : member)));
		}
		closeModal();
	};

	return (
		<>
			<S.MembersPageBody>
				<S.MembersTopActions>
					<div>
						<S.MembersPageDescription>회원 정보와 권한, 조직 총 토큰 사용 현황을 확인하고 수정할 수 있습니다.</S.MembersPageDescription>
					</div>
					<TopRight>
						<SummaryRow>
							<SummaryCard>
								<span>총 멤버수</span>
								<strong>
									{members.length}/{ORG_MEMBER_LIMIT}
								</strong>
							</SummaryCard>
							<SummaryCard>
								<span>누적 토큰 사용량</span>
								<strong>
									{totalUsedTokens.toLocaleString()}/{orgTokenLimit.toLocaleString()}
								</strong>
							</SummaryCard>
						</SummaryRow>
					</TopRight>
				</S.MembersTopActions>
				<S.MembersTableCard>
					<S.MembersTableScroll>
						<S.MembersTable>
							<thead>
								<tr>
									<th>등록일</th>
									<th>ID</th>
									<th>소속</th>
									<th>유저명</th>
									<th>권한</th>
									<th>Tokens</th>
								</tr>
							</thead>
							<tbody>
								{sortedMembers.map((member) => (
									<tr key={member.id} onClick={() => openModal(member)}>
										<td>{member.createdAt}</td>
										<td>{member.id}</td>
										<td>{member.organization}</td>
										<td>{member.name}</td>
										<td>{member.role}</td>
										<td>
											<S.MembersCredit>{formatTokens(member.usedTokens)}</S.MembersCredit>
										</td>
									</tr>
								))}
							</tbody>
						</S.MembersTable>
					</S.MembersTableScroll>
				</S.MembersTableCard>
				<BottomActions>
					<Button type="button" status="primary" onClick={openCreateModal} width={96}>
						멤버 추가
					</Button>
				</BottomActions>
			</S.MembersPageBody>

			{mounted && editingMember
				? createPortal(
						<ModalOverlay $closing={isModalClosing} onClick={closeModal}>
							<ModalCard $closing={isModalClosing} onClick={(e) => e.stopPropagation()}>
								<ModalS.SharedModalHeader>
									<ModalS.SharedModalTitle>{modalMode === 'create' ? '멤버 추가' : '회원 정보 수정'}</ModalS.SharedModalTitle>
									<ModalS.SharedModalDescription>멤버 기본 정보와 역할, 토큰 사용량을 관리합니다.</ModalS.SharedModalDescription>
								</ModalS.SharedModalHeader>
								<S.MembersFormGrid>
									<S.MembersField>
										<span>등록일</span>
										<input value={editingMember.createdAt} readOnly />
									</S.MembersField>
									<S.MembersField>
										<span>ID</span>
										<input
											value={editingMember.id}
											onChange={(e) => updateEditingField('id', e.target.value)}
											readOnly={modalMode !== 'create'}
										/>
									</S.MembersField>
									<S.MembersField>
										<span>소속</span>
										<input value={editingMember.organization} onChange={(e) => updateEditingField('organization', e.target.value)} />
									</S.MembersField>
									<S.MembersField>
										<span>유저명</span>
										<input value={editingMember.name} onChange={(e) => updateEditingField('name', e.target.value)} />
									</S.MembersField>
									<S.MembersField>
										<span>권한</span>
										<input value={editingMember.role} onChange={(e) => updateEditingField('role', e.target.value)} />
									</S.MembersField>
									<S.MembersField>
										<span>조직 총 토큰 사용량</span>
										<input value={editingMember.usedTokens} onChange={(e) => updateEditingField('usedTokens', e.target.value)} />
									</S.MembersField>
								</S.MembersFormGrid>
								<ModalS.SharedModalFooter>
									<Button type="button" status="neutral_outlined" onClick={closeModal} width={84}>
										취소
									</Button>
									<Button type="button" status="primary" onClick={handleSave} width={84}>
										저장
									</Button>
								</ModalS.SharedModalFooter>
							</ModalCard>
						</ModalOverlay>,
						document.body,
					)
				: null}
		</>
	);
}

const TopRight = styled.div`
	display: flex;
	align-items: flex-end;
	gap: ${unit(10)};
	flex-wrap: wrap;
	justify-content: flex-end;
`;

const SummaryRow = styled.div`
	display: flex;
	gap: ${unit(8)};
	flex-wrap: wrap;
	justify-content: flex-end;
`;

const SummaryCard = styled.div`
	min-width: ${unit(150)};
	padding: ${unit(10)} ${unit(12)};
	border: 1px solid rgba(220, 229, 243, 1);
	border-radius: ${unit(10)};
	background: rgba(247, 250, 255, 1);
	display: flex;
	flex-direction: column;
	gap: ${unit(4)};

	span {
		font-size: ${unit(12)};
		font-weight: 600;
		color: rgba(93, 109, 137, 1);
	}

	strong {
		font-size: ${unit(16)};
		font-weight: 700;
		color: rgba(31, 53, 92, 1);
	}
`;

const BottomActions = styled.div`
	display: flex;
	justify-content: flex-end;
`;

const ModalOverlay = styled(ModalS.SharedModalOverlay)``;

const ModalCard = styled(ModalS.SharedModalPanel)`
	width: min(${unit(560)}, calc(100vw - ${unit(32)}));
`;
