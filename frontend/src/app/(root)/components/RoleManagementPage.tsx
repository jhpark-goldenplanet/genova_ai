'use client';

import styled from '@emotion/styled';
import Button from '@/components/Button';
import * as ModalS from '@/components/Modal/styled';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { unit } from '@/shared/utils/base';
import * as S from '../styled';

interface Permission {
	key: string;
	label: string;
}

interface RoleRow {
	id: string;
	name: string;
	description: string;
	permissions: string[];
	memberCount: number;
	createdAt: string;
}

const ALL_PERMISSIONS: Permission[] = [
	{ key: 'video_upload', label: '영상 업로드' },
	{ key: 'video_analyze', label: '영상 분석' },
	{ key: 'video_edit', label: '영상 편집' },
	{ key: 'video_delete', label: '영상 삭제' },
	{ key: 'member_manage', label: '멤버 관리' },
	{ key: 'role_manage', label: '역할 관리' },
	{ key: 'subscription_manage', label: '구독 관리' },
	{ key: 'notice_manage', label: '공지사항 관리' },
];

const SAMPLE_ROLES: RoleRow[] = [
	{
		id: 'role_admin',
		name: '관리자',
		description: '모든 기능에 대한 전체 접근 권한',
		permissions: ALL_PERMISSIONS.map((p) => p.key),
		memberCount: 2,
		createdAt: '2026-01-15',
	},
	{
		id: 'role_editor',
		name: '편집자',
		description: '영상 업로드, 분석, 편집 권한',
		permissions: ['video_upload', 'video_analyze', 'video_edit'],
		memberCount: 1,
		createdAt: '2026-02-01',
	},
	{
		id: 'role_viewer',
		name: '뷰어',
		description: '영상 조회 및 분석 결과 열람만 가능',
		permissions: ['video_analyze'],
		memberCount: 1,
		createdAt: '2026-02-10',
	},
];

const MODAL_ANIMATION_MS = 220;

export default function RoleManagementPage() {
	const [roles, setRoles] = useState<RoleRow[]>(SAMPLE_ROLES);
	const [modalMode, setModalMode] = useState<'create' | 'edit'>('edit');
	const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
	const [mounted, setMounted] = useState(false);
	const [isModalClosing, setIsModalClosing] = useState(false);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setMounted(true);
		return () => {
			if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		};
	}, []);

	const sortedRoles = useMemo(() => {
		return [...roles].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}, [roles]);

	const closeModal = () => {
		if (!editingRole) return;
		setIsModalClosing(true);
		if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		closeTimerRef.current = setTimeout(() => {
			setEditingRole(null);
			setIsModalClosing(false);
		}, MODAL_ANIMATION_MS);
	};

	const openModal = (role: RoleRow) => {
		if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		setIsModalClosing(false);
		setModalMode('edit');
		setEditingRole({ ...role });
	};

	const openCreateModal = () => {
		if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		setIsModalClosing(false);
		setModalMode('create');
		setEditingRole({
			id: '',
			name: '',
			description: '',
			permissions: [],
			memberCount: 0,
			createdAt: new Date().toISOString().slice(0, 10),
		});
	};

	const updateEditingField = (key: 'id' | 'name' | 'description', value: string) => {
		setEditingRole((prev) => (prev ? { ...prev, [key]: value } : prev));
	};

	const togglePermission = (permKey: string) => {
		setEditingRole((prev) => {
			if (!prev) return prev;
			const has = prev.permissions.includes(permKey);
			return {
				...prev,
				permissions: has ? prev.permissions.filter((p) => p !== permKey) : [...prev.permissions, permKey],
			};
		});
	};

	const handleSave = () => {
		if (!editingRole) return;
		if (modalMode === 'create') {
			setRoles((prev) => [editingRole, ...prev]);
		} else {
			setRoles((prev) => prev.map((r) => (r.id === editingRole.id ? editingRole : r)));
		}
		closeModal();
	};

	const getPermissionLabels = (permissions: string[]) => {
		return permissions.map((key) => ALL_PERMISSIONS.find((p) => p.key === key)?.label ?? key);
	};

	return (
		<>
			<S.MembersPageBody>
				<S.MembersTopActions>
					<div>
						<S.MembersPageDescription>역할별 접근 권한을 설정하고, 멤버에게 부여할 역할을 관리합니다.</S.MembersPageDescription>
					</div>
					<TopRight>
						<SummaryCard>
							<span>등록된 역할</span>
							<strong>{roles.length}개</strong>
						</SummaryCard>
					</TopRight>
				</S.MembersTopActions>
				<S.MembersTableCard>
					<S.MembersTableScroll>
						<S.MembersTable>
							<thead>
								<tr>
									<th>생성일</th>
									<th>역할명</th>
									<th>설명</th>
									<th>권한</th>
									<th>멤버 수</th>
								</tr>
							</thead>
							<tbody>
								{sortedRoles.map((role) => (
									<tr key={role.id} onClick={() => openModal(role)}>
										<td>{role.createdAt}</td>
										<td>
											<RoleName>{role.name}</RoleName>
										</td>
										<td>{role.description}</td>
										<td>
											<PermissionBadgeRow>
												{getPermissionLabels(role.permissions)
													.slice(0, 3)
													.map((label) => (
														<PermissionBadge key={label}>{label}</PermissionBadge>
													))}
												{role.permissions.length > 3 && (
													<PermissionBadge $muted>+{role.permissions.length - 3}</PermissionBadge>
												)}
											</PermissionBadgeRow>
										</td>
										<td>{role.memberCount}명</td>
									</tr>
								))}
							</tbody>
						</S.MembersTable>
					</S.MembersTableScroll>
				</S.MembersTableCard>
				<BottomActions>
					<Button type="button" status="primary" onClick={openCreateModal} width={96}>
						역할 추가
					</Button>
				</BottomActions>
			</S.MembersPageBody>

			{mounted && editingRole
				? createPortal(
						<ModalOverlay $closing={isModalClosing} onClick={closeModal}>
							<ModalCard $closing={isModalClosing} onClick={(e) => e.stopPropagation()}>
								<ModalS.SharedModalHeader>
									<ModalS.SharedModalTitle>{modalMode === 'create' ? '역할 추가' : '역할 수정'}</ModalS.SharedModalTitle>
									<ModalS.SharedModalDescription>역할 정보와 세부 권한을 설정합니다.</ModalS.SharedModalDescription>
								</ModalS.SharedModalHeader>
								<S.MembersFormGrid>
									<S.MembersField>
										<span>생성일</span>
										<input value={editingRole.createdAt} readOnly />
									</S.MembersField>
									<S.MembersField>
										<span>역할 ID</span>
										<input
											value={editingRole.id}
											onChange={(e) => updateEditingField('id', e.target.value)}
											readOnly={modalMode !== 'create'}
										/>
									</S.MembersField>
									<S.MembersField>
										<span>역할명</span>
										<input value={editingRole.name} onChange={(e) => updateEditingField('name', e.target.value)} />
									</S.MembersField>
									<S.MembersField>
										<span>설명</span>
										<input
											value={editingRole.description}
											onChange={(e) => updateEditingField('description', e.target.value)}
										/>
									</S.MembersField>
								</S.MembersFormGrid>

								<PermissionSection>
									<PermissionSectionTitle>권한 설정</PermissionSectionTitle>
									<PermissionGrid>
										{ALL_PERMISSIONS.map((perm) => {
											const checked = editingRole.permissions.includes(perm.key);
											return (
												<PermissionCheckItem key={perm.key} onClick={() => togglePermission(perm.key)}>
													<Checkbox $checked={checked}>
														{checked && (
															<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
																<path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
															</svg>
														)}
													</Checkbox>
													<span>{perm.label}</span>
												</PermissionCheckItem>
											);
										})}
									</PermissionGrid>
								</PermissionSection>

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
	width: min(${unit(620)}, calc(100vw - ${unit(32)}));
`;

const RoleName = styled.span`
	font-weight: 700;
	color: rgba(31, 53, 92, 1);
`;

const PermissionBadgeRow = styled.div`
	display: flex;
	gap: ${unit(4)};
	flex-wrap: wrap;
`;

const PermissionBadge = styled.span<{ $muted?: boolean }>`
	display: inline-flex;
	align-items: center;
	padding: ${unit(3)} ${unit(8)};
	border-radius: ${unit(999)};
	background: ${({ $muted }) => ($muted ? 'rgba(226, 234, 246, 1)' : 'rgba(236, 244, 255, 1)')};
	color: ${({ $muted }) => ($muted ? 'rgba(96, 107, 138, 1)' : 'rgba(45, 95, 174, 1)')};
	font-size: ${unit(12)};
	font-weight: 600;
	white-space: nowrap;
`;

const PermissionSection = styled.div`
	margin-bottom: ${unit(4)};
`;

const PermissionSectionTitle = styled.h4`
	font-size: ${unit(14)};
	font-weight: 700;
	color: rgba(84, 98, 130, 1);
	margin-bottom: ${unit(10)};
`;

const PermissionGrid = styled.div`
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: ${unit(8)};
`;

const PermissionCheckItem = styled.label`
	display: flex;
	align-items: center;
	gap: ${unit(8)};
	padding: ${unit(8)} ${unit(10)};
	border: 1px solid rgba(222, 229, 237, 1);
	border-radius: ${unit(8)};
	cursor: pointer;
	transition: background-color 0.16s ease, border-color 0.16s ease;

	span {
		font-size: ${unit(13)};
		font-weight: 500;
		color: rgba(31, 42, 68, 1);
	}

	&:hover {
		background: rgba(243, 248, 255, 1);
		border-color: rgba(180, 200, 232, 1);
	}
`;

const Checkbox = styled.div<{ $checked: boolean }>`
	width: ${unit(18)};
	height: ${unit(18)};
	border-radius: ${unit(4)};
	border: 1.5px solid ${({ $checked }) => ($checked ? 'rgba(42, 87, 170, 1)' : 'rgba(189, 200, 218, 1)')};
	background: ${({ $checked }) => ($checked ? 'rgba(42, 87, 170, 1)' : 'white')};
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	transition: background-color 0.16s ease, border-color 0.16s ease;
`;
