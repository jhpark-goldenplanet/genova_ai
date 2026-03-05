'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as S from '../styled';

interface MemberRow {
	id: string;
	organization: string;
	name: string;
	role: string;
	usedCredits: number;
	totalCredits: number;
	createdAt: string;
}

const SAMPLE_MEMBERS: MemberRow[] = [
	{
		id: 'njw_admin',
		organization: '농정원',
		name: '김민지',
		role: '관리자',
		usedCredits: 20,
		totalCredits: 100,
		createdAt: '2026-03-02',
	},
	{
		id: 'njw_editor_01',
		organization: '농정원',
		name: '박지훈',
		role: '편집자',
		usedCredits: 56,
		totalCredits: 100,
		createdAt: '2026-03-01',
	},
	{
		id: 'gp_hklee',
		organization: '골든플래닛',
		name: '이형근',
		role: '관리자',
		usedCredits: 12,
		totalCredits: 100,
		createdAt: '2026-02-28',
	},
	{
		id: 'njw_viewer_02',
		organization: '농정원',
		name: '정유진',
		role: '뷰어',
		usedCredits: 7,
		totalCredits: 100,
		createdAt: '2026-02-25',
	},
	{
		id: 'partner_demo',
		organization: '시연 계정',
		name: 'Demo User',
		role: '편집자',
		usedCredits: 34,
		totalCredits: 100,
		createdAt: '2026-02-20',
	},
	{
		id: 'njw_low_credit',
		organization: '농정원',
		name: '한수정',
		role: '편집자',
		usedCredits: 93,
		totalCredits: 100,
		createdAt: '2026-03-03',
	},
];

const formatCredits = (usedCredits: number, totalCredits: number) => `${usedCredits}/${totalCredits} credits`;
const isLowRemainingCredit = (usedCredits: number, totalCredits: number) => {
	if (!totalCredits) return true;
	return usedCredits / totalCredits <= 0.1;
};
const MODAL_ANIMATION_MS = 220;

export default function MembersPage() {
	const [members, setMembers] = useState<MemberRow[]>(SAMPLE_MEMBERS);
	const [modalMode, setModalMode] = useState<'create' | 'edit'>('edit');
	const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
	const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
	const [mounted, setMounted] = useState(false);
	const [isModalClosing, setIsModalClosing] = useState(false);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setMounted(true);

		return () => {
			if (closeTimerRef.current) {
				clearTimeout(closeTimerRef.current);
			}
		};
	}, []);

	const sortedMembers = useMemo(() => {
		return [...members].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}, [members]);

	const closeModal = () => {
		if (!editingMember) return;
		setIsModalClosing(true);
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
		}
		closeTimerRef.current = setTimeout(() => {
			setSelectedMemberId(null);
			setEditingMember(null);
			setIsModalClosing(false);
		}, MODAL_ANIMATION_MS);
	};

	const openModal = (member: MemberRow) => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
		}
		setIsModalClosing(false);
		setModalMode('edit');
		setSelectedMemberId(member.id);
		setEditingMember(member);
	};

	const openCreateModal = () => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
		}
		setIsModalClosing(false);
		setModalMode('create');
		setSelectedMemberId(null);
		setEditingMember({
			id: '',
			organization: '',
			name: '',
			role: '뷰어',
			usedCredits: 0,
			totalCredits: 100,
			createdAt: new Date().toISOString().slice(0, 10),
		});
	};

	const updateEditingField = (key: keyof MemberRow, value: string) => {
		setEditingMember((prev) => {
			if (!prev) return prev;
			if (key === 'usedCredits' || key === 'totalCredits') {
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
					<S.MembersPageDescription>
						회원 정보와 권한, 크레딧 사용 현황을 확인하고 수정할 수 있습니다.
					</S.MembersPageDescription>
					<S.MembersRegisterButton type="button" onClick={openCreateModal}>
						회원 등록
					</S.MembersRegisterButton>
				</S.MembersTopActions>
				<S.MembersTableCard>
					<S.MembersTable>
						<thead>
							<tr>
								<th>등록일</th>
								<th>ID</th>
								<th>소속</th>
								<th>유저명</th>
								<th>권한</th>
								<th>크레딧</th>
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
										<S.MembersCredit $isLow={isLowRemainingCredit(member.usedCredits, member.totalCredits)}>
											{formatCredits(member.usedCredits, member.totalCredits)}
										</S.MembersCredit>
									</td>
								</tr>
							))}
						</tbody>
					</S.MembersTable>
				</S.MembersTableCard>
			</S.MembersPageBody>

			{mounted && editingMember
				? createPortal(
						<S.MembersModalOverlay $closing={isModalClosing} onClick={closeModal}>
							<S.MembersModal $closing={isModalClosing} onClick={(e) => e.stopPropagation()}>
								<h3>{modalMode === 'create' ? '회원 등록' : '회원 정보 수정'}</h3>
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
										<input
											value={editingMember.organization}
											onChange={(e) => updateEditingField('organization', e.target.value)}
										/>
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
										<span>크레딧 (사용/전체)</span>
										<input
											value={`${editingMember.usedCredits}/${editingMember.totalCredits}`}
											onChange={(e) => {
												const [used = '0', total = '0'] = e.target.value.split('/');
												updateEditingField('usedCredits', used);
												updateEditingField('totalCredits', total);
											}}
										/>
									</S.MembersField>
								</S.MembersFormGrid>
								<S.MembersModalActions>
									<button type="button" className="cancel" onClick={closeModal}>
										취소
									</button>
									<button type="button" className="save" onClick={handleSave}>
										저장
									</button>
								</S.MembersModalActions>
							</S.MembersModal>
						</S.MembersModalOverlay>,
						document.body,
					)
				: null}
		</>
	);
}
