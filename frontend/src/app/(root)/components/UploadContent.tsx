'use client';

import { usePathname, useRouter } from 'next/navigation';
import * as S from '../styled';
import { useModal } from '@/shared/hooks';
import { errorToast, successToast } from '@/shared/utils/toastUtils';
import { FileRejection, useDropzone } from 'react-dropzone';
import { isEmpty, uniqBy } from 'lodash-es';
import { SubmitHandler, useForm } from 'react-hook-form';
import { ACCEPTED_VIDEO_TYPES, validateFileTypes } from '../helper';
import { getUploadUrl, uploadToGCS, confirmUpload } from '@/shared/apis/video';
import Loader from '@/components/Loader';
import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { unit } from '@/shared/utils/base';
import AnimatedSelect from '@/components/AnimatedSelect';

type AnalysisMode = 'AUTO' | 'CUSTOM';

interface WorkspaceAnalysisItem {
	id: string;
	name: string;
	status: 'COMPLETE' | 'IN_PROGRESS' | 'FAILED';
	updatedAt: string;
	promptLabel: string;
	briefing: string;
	keywords: string[];
	promptText?: string;
	splitCount?: number;
	mode?: AnalysisMode;
}

interface WorkspaceWorkItem {
	id: string;
	title: string;
	duration: string;
	uploadedAt: string;
	source: string;
	videoUrl?: string;
	thumbnailUrl?: string;
	videoId?: string;
	analyses: WorkspaceAnalysisItem[];
}

interface IFormValues {
	files: any;
}

interface PromptTagGroup {
	key: string;
	label: string;
	items: string[];
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_FILE_LENGTH = 1;
const MIN_VIDEO_DURATION = 60; // 1분
const MAX_VIDEO_DURATION = 2700; // 45분
const LAST_VIDEO_ID_KEY = 'genova_active_video_id';
const WORKSPACE_STORAGE_KEY = 'genova_workspace_mock_works_v1';
const PROMPT_PRESET_STORAGE_KEY = 'genova_prompt_tag_presets_v1';

const PROMPT_TAG_GROUPS: PromptTagGroup[] = [
	{
		key: 'purpose',
		label: '용도',
		items: ['핵심 요약', '강의 노트', '퀴즈/복습', '실습 가이드', '운영자 점검'],
	},
	{
		key: 'audience',
		label: '대상 수준',
		items: ['초급자', '중급자', '고급자', '혼합 수준'],
	},
	{
		key: 'tone',
		label: '어조',
		items: ['공식적', '친절한', '동기부여형', '간결한'],
	},
	{
		key: 'format',
		label: '출력 형식',
		items: ['체크리스트', '단계별 안내', 'Q&A', '표 형식', '요약 카드'],
	},
	{
		key: 'focus',
		label: '강조 포인트',
		items: ['학습 목표', '핵심 개념', '실수 주의', '현장 적용', '평가 포인트'],
	},
	{
		key: 'density',
		label: '밀도/길이',
		items: ['초압축', '표준', '상세', '예시 중심'],
	},
];

export default function UploadContent() {
	const router = useRouter();
	const pathname = usePathname();
	const { confirm, closeConfirm } = useModal();

	const [isBusy, setIsBusy] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [hasExistingWork, setHasExistingWork] = useState(false);
	const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('AUTO');
	const [presetName, setPresetName] = useState('기본 프리셋');
	const [splitCountValue, setSplitCountValue] = useState('5');
	const [durationLabel, setDurationLabel] = useState('-');
	const [selectedTags, setSelectedTags] = useState<string[]>([]);

	const { register, handleSubmit, setValue, watch } = useForm<IFormValues>();

	const watchFiles: File[] = watch('files');

	const handleProceedWithExistingWorkCheck = (next: () => void) => {
		if (!hasExistingWork) {
			next();
			return;
		}

		confirm({
			message: '새 영상을 업로드하면 기존 분석 결과가 초기화됩니다.\n계속 진행하시겠습니까?',
			okHandler: () => {
				closeConfirm();
				next();
			},
		});
	};

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		setHasExistingWork(!!window.localStorage.getItem(LAST_VIDEO_ID_KEY));
	}, [pathname]);

	useEffect(() => {
		if (analysisMode === 'AUTO') {
			setPresetName('자동');
			setSplitCountValue('');
			setSelectedTags([]);
			return;
		}

		if (presetName === '자동') setPresetName('기본 프리셋');
		if (!splitCountValue) setSplitCountValue('5');
	}, [analysisMode]);

	const validateVideoDuration = (file: File): Promise<boolean> => {
		return new Promise((resolve) => {
			// 대용량 파일(100MB 이상)은 클라이언트 duration 검증 스킵 - 서버에서 검증
			if (file.size > 100 * 1024 * 1024) {
				console.log('[Duration] Large file, skip client validation');
				resolve(true);
				return;
			}

			const video = document.createElement('video');
			video.preload = 'metadata';

			video.onloadedmetadata = () => {
				window.URL.revokeObjectURL(video.src);
				const duration = Math.floor(video.duration);

				if (duration < MIN_VIDEO_DURATION) {
					errorToast('영상 길이는 최소 1분 이상이어야 합니다.');
					resolve(false);
				} else if (duration > MAX_VIDEO_DURATION) {
					errorToast('영상 길이는 최대 45분까지 업로드 가능합니다.');
					resolve(false);
				} else {
					const minutes = Math.floor(duration / 60);
					const seconds = duration % 60;
					setDurationLabel(`${minutes}:${seconds.toString().padStart(2, '0')}`);
					resolve(true);
				}
			};

			video.onerror = () => {
				window.URL.revokeObjectURL(video.src);
				errorToast('영상 파일을 읽을 수 없습니다.');
				resolve(false);
			};

			video.src = URL.createObjectURL(file);
		});
	};

	const handleLoadFiles = async (files: File[]) => {
		if (files?.length) {
			const currentFiles = watchFiles ?? [];
			const newFiles = uniqBy([...currentFiles, ...files], 'lastModified');

			if (newFiles.length > MAX_FILE_LENGTH) {
				setValue('files', currentFiles);
				errorToast(`파일은 최대 1개까지 첨부 가능합니다.`);
				return;
			}

			// 영상 길이 검증
			const isValid = await validateVideoDuration(newFiles[0]);
			if (!isValid) {
				setValue('files', currentFiles);
				return;
			}

			const applySelection = () => {
				setValue('files', newFiles);
				successToast('파일이 선택되었습니다. 하단의 분석 시작 버튼을 눌러주세요.');
			};

			handleProceedWithExistingWorkCheck(() => {
				applySelection();
			});
		}
	};

	const handleDropRejected = (fileRejections: FileRejection[]) => {
		const { code, message } = fileRejections[0].errors[0];

		switch (code) {
			case 'file-invalid-type':
				errorToast('MP4, MOV, WMV, AVI 형식의 파일만 업로드 가능합니다.');
				break;
			case 'file-too-large':
				errorToast('파일은 최대 2GB까지 첨부 가능합니다.');
				break;
			default:
				errorToast(message);
		}
	};

	//
	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop: handleLoadFiles,
		onDropRejected: handleDropRejected,
		accept: ACCEPTED_VIDEO_TYPES,
		maxSize: MAX_FILE_SIZE,
		noClick: true,
		multiple: false,
	});

	//

	const handleChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		e.preventDefault();

		const { files: fileList } = e.target;
		const hasSelectedFiles = !isEmpty(watchFiles);

		if ((fileList?.length ?? 0) > MAX_FILE_LENGTH) {
			setValue('files', hasSelectedFiles ? watchFiles : []);
			errorToast(`파일은 최대 ${MAX_FILE_LENGTH}개까지 첨부 가능합니다.`);
			return;
		}

		if (fileList?.length) {
			const files = [...Array.from(fileList)];
			handleLoadFiles(files);
		}
	};

	const onSubmit: SubmitHandler<IFormValues> = async ({ files }) => {
		if (!files?.length) {
			errorToast('먼저 분석할 파일을 선택해주세요.');
			return;
		}

		setIsBusy(true);
		setUploadProgress(0);

		try {
			const file = files[0];
			const contentType = (file.type || 'video/mp4').split(';')[0].trim().toLowerCase();

			// Step 1: Signed URL 요청
			console.log('[Step 1] Requesting upload URL...');
			const { upload_url, video_id } = await getUploadUrl({
				filename: file.name,
				content_type: contentType,
				file_size: file.size,
			});

			// Step 2: GCS에 직접 업로드 (진행률 표시)
			console.log('[Step 2] Uploading to GCS...', { video_id });
			await uploadToGCS(upload_url, file, contentType, (progress) => {
				setUploadProgress(Math.floor(progress));
				console.log(`Upload progress: ${Math.floor(progress)}%`);
			});

			// Step 3: 업로드 완료 확인
			console.log('[Step 3] Confirming upload...', { video_id });
			await confirmUpload({ video_id });

			console.log('[파일 업로드 성공]', video_id);
			if (typeof window !== 'undefined') {
				const now = new Date();
				const stamp = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')} ${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`;
				const promptLabel = analysisMode === 'AUTO' ? 'AI 자동' : presetName || '커스텀 프롬프트';
				const splitCount = analysisMode === 'AUTO' ? 0 : Number(splitCountValue);
				const appliedTags = analysisMode === 'AUTO' ? ['자동'] : selectedTags;
				const promptText = analysisMode === 'AUTO' ? '자동' : appliedTags.join(', ');

				let works: WorkspaceWorkItem[] = [];
				try {
					const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '[]');
					works = Array.isArray(parsed) ? parsed : [];
				} catch (error) {
					works = [];
				}

				const existingIndex = works.findIndex((item) => item.videoId === video_id);
				const newAnalysis: WorkspaceAnalysisItem = {
					id: `analysis-${Date.now()}`,
					name: `분석 ${analysisMode === 'AUTO' ? 'A (AI 자동)' : 'B (커스텀)'}`,
					status: 'IN_PROGRESS',
					updatedAt: stamp,
					promptLabel,
					briefing: '분석 실행 전입니다. 상세 페이지에서 설정 후 재생성을 시작하세요.',
					keywords: appliedTags.slice(0, 5),
					promptText,
					splitCount,
					mode: analysisMode,
				};

				if (existingIndex >= 0) {
					const target = works[existingIndex];
					works[existingIndex] = {
						...target,
						title: target.title || file.name.replace(/\.[^.]+$/, ''),
						source: target.source || file.name,
						duration: durationLabel === '-' ? target.duration : durationLabel,
						uploadedAt: stamp.slice(0, 10),
						videoId: video_id,
						analyses: [...(target.analyses ?? []), newAnalysis],
					};
				} else {
					works.unshift({
						id: `work-${Date.now()}`,
						title: file.name.replace(/\.[^.]+$/, ''),
						duration: durationLabel,
						uploadedAt: stamp.slice(0, 10),
						source: file.name,
						videoId: video_id,
						analyses: [newAnalysis],
					});
				}

				window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(works));
				window.localStorage.setItem(LAST_VIDEO_ID_KEY, video_id);
			}
			router.push(`/video/${video_id}/summary`);
		} catch (error: any) {
			console.log('[파일 업로드 에러]', error);

			// 에러 코드 처리
			if (error?.error_code === 1003) {
				errorToast('영상 길이는 최소 1분 이상이어야 합니다.');
			} else if (error?.error_code === 1008) {
				errorToast('영상 길이는 최대 45분까지 업로드 가능합니다.');
			} else if (error?.error_code === 1002) {
				errorToast('파일 크기가 2GB를 초과합니다.');
			} else {
				errorToast('영상 업로드에 실패했습니다.');
			}

			setValue('files', '');
		} finally {
			setIsBusy(false);
			setUploadProgress(0);
		}
	};

	const handleOpenFilePicker = () => {
		const input = document.getElementById('video-file') as HTMLInputElement | null;
		input?.click();
	};

	const handleToggleTag = (tag: string) => {
		if (analysisMode === 'AUTO') return;
		setSelectedTags((prev) => {
			if (prev.includes(tag)) return prev.filter((item) => item !== tag);
			return [...prev, tag];
		});
	};

	const handleSavePreset = () => {
		if (analysisMode === 'AUTO') {
			errorToast('AI 자동 모드에서는 프리셋을 저장할 수 없습니다.');
			return;
		}
		const trimmedName = presetName.trim();
		if (!trimmedName) {
			errorToast('프리셋 이름을 입력해주세요.');
			return;
		}
		if (!selectedTags.length) {
			errorToast('저장할 태그를 1개 이상 선택해주세요.');
			return;
		}

		const now = new Date().toISOString();
		const preset = {
			name: trimmedName,
			tags: selectedTags,
			updatedAt: now,
		};

		try {
			const parsed = JSON.parse(window.localStorage.getItem(PROMPT_PRESET_STORAGE_KEY) ?? '[]');
			const base = Array.isArray(parsed) ? parsed : [];
			const next = [
				preset,
				...base.filter((item: any) => item?.name !== trimmedName),
			];
			window.localStorage.setItem(PROMPT_PRESET_STORAGE_KEY, JSON.stringify(next.slice(0, 20)));
			successToast('프롬프트 프리셋이 저장되었습니다.');
		} catch (error) {
			errorToast('프리셋 저장 중 오류가 발생했습니다.');
		}
	};

	const isRegister = register('files', {
		onChange: handleChangeFile,
		validate: {
			maxFiles: (files) => files.length <= MAX_FILE_LENGTH || `파일은 최대 ${MAX_FILE_LENGTH}개까지 첨부 가능합니다.`,
			maxFileSize: (files) => {
				if (isEmpty(files)) return true;
				const fileSizeValid = files.every((file: File) => file.size <= MAX_FILE_SIZE);
				return fileSizeValid || '파일은 최대 2GB까지 첨부 가능합니다.';
			},
			fileType: (files) => {
				if (isEmpty(files)) return true;
				return validateFileTypes(files) || 'MP4, MOV, WMV, AVI 파일만 업로드 가능합니다.';
			},
		},
	});

	return (
		<S.Container>
			<S.Main {...getRootProps()}>
				<input {...getInputProps()} />

				{isDragActive ? (
					<S.DragOverlay>
						<div>{`여기에 파일을 놓으세요.`}</div>
					</S.DragOverlay>
				) : null}

				<S.GradientTitle>{`영상, 핵심만 쏙!\n요약과 분할로 한눈에 정리합니다.`}</S.GradientTitle>

				<S.SubText>{`긴 자료, 읽기 번거로우셨죠?\n깔끔하게 요약해 딱 필요한 정보만 알려드릴게요!`}</S.SubText>

				<S.Form onSubmit={handleSubmit(onSubmit)}>
					<S.LinkInsertButton type="button" onClick={handleOpenFilePicker}>
						파일 업로드
					</S.LinkInsertButton>

					<S.ManualText>{`여기로 파일을 드래그하거나\n파일 업로드 버튼을 클릭하세요.`}</S.ManualText>

					<AnalysisConfigCard>
						<ConfigTitle>분석 설정</ConfigTitle>
						<ConfigModeRow>
							<ModeButton
								type="button"
								$active={analysisMode === 'AUTO'}
								onClick={() => setAnalysisMode('AUTO')}
							>
								AI 자동
							</ModeButton>
							<ModeButton
								type="button"
								$active={analysisMode === 'CUSTOM'}
								onClick={() => setAnalysisMode('CUSTOM')}
							>
								커스텀
							</ModeButton>
						</ConfigModeRow>

						<ConfigGrid>
							<label>
								<span>프리셋 이름</span>
								<PresetRow>
									<input
										value={presetName}
										onChange={(e) => setPresetName(e.target.value)}
										placeholder="예: 핵심 위주 브리핑"
										disabled={analysisMode === 'AUTO'}
									/>
									<PresetSaveButton
										type="button"
										onClick={handleSavePreset}
										disabled={analysisMode === 'AUTO'}
									>
										프리셋 저장
									</PresetSaveButton>
								</PresetRow>
							</label>
							<label>
								<span>분할 개수</span>
								<AnimatedSelect
									value={splitCountValue}
									onChange={(nextValue) => {
										if (analysisMode === 'AUTO') return;
										setSplitCountValue(nextValue);
									}}
									options={[3, 4, 5, 6, 7, 8].map((count) => ({ value: String(count), label: `${count}개` }))}
									placeholder="자동"
									disabled={analysisMode === 'AUTO'}
									width="100%"
								/>
							</label>
						</ConfigGrid>

						<label>
							<span>프롬프트 프리셋 태그</span>
							<TagGroupWrap>
								{PROMPT_TAG_GROUPS.map((group) => (
									<TagGroup key={group.key}>
										<strong>{group.label}</strong>
										<TagRow>
											{group.items.map((tag) => {
												const isActive = selectedTags.includes(tag);
												return (
													<TagChip
														key={`${group.key}-${tag}`}
														type="button"
														$active={isActive}
														onClick={() => handleToggleTag(tag)}
														disabled={analysisMode === 'AUTO'}
													>
														{tag}
													</TagChip>
												);
											})}
										</TagRow>
									</TagGroup>
								))}
							</TagGroupWrap>
						</label>

						<ConfigHint>
							{analysisMode === 'AUTO'
								? 'AI 자동 모드에서는 프리셋/분할/프롬프트가 자동으로 설정됩니다.'
								: '커스텀 모드에서는 입력한 프롬프트와 분할 개수로 분석이 진행됩니다.'}
						</ConfigHint>
					</AnalysisConfigCard>

					<S.UploadNotice>{`(영상 길이 1~45분, 최대 2GB, MP4·MOV·WMV·AVI 가능)`}</S.UploadNotice>

					<StartAnalysisButton type="submit">분석 시작</StartAnalysisButton>

					<input
						{...isRegister}
						name="files"
						type="file"
						id="video-file"
						accept=".mp4,.mov,.wmv,.avi"
						multiple={false}
						style={{ display: 'none' }}
					/>
				</S.Form>
			</S.Main>

			<S.Footer>
				<p className="copyright">© 2025 GOLDEN PLANET Co.,Ltd. All rights reserved.</p>
				<S.TermsRow>
					<button
						type="button"
						onClick={() =>
							window.open(
								'https://shorthaired-fossa-a9f.notion.site/Genova-AI-1d8bbfa86f7b8017a40fee1bef8ede6a?pvs=4',
								'_blank',
								'noopener,noreferrer',
							)
						}
					>
						Genova AI 이용약관
					</button>
					<span>|</span>

					{/* <button type="button" onClick={() => {}}>
						개인정보 처리방침
					</button>
					<span>|</span> */}

					<button
						type="button"
						onClick={() =>
							window.open(
								' https://shorthaired-fossa-a9f.notion.site/Genova-AI-d460f513f14f4f7588cc7e8f3a002f4a?pvs=4',
								'_blank',
								'noopener,noreferrer',
							)
						}
					>
						AI 윤리
					</button>
					<span>|</span>

					<button
						type="button"
						onClick={() =>
							window.open(
								'https://shorthaired-fossa-a9f.notion.site/Genova-AI-1cbbbfa86f7b80faa111d41db87ad129?pvs=4',
								'_blank',
								'noopener,noreferrer',
							)
						}
					>
						도움말
					</button>
				</S.TermsRow>
			</S.Footer>

			<Loader isLoading={isBusy} isFetching={isBusy} progress={uploadProgress} withSidebar />
		</S.Container>
	);
}

const AnalysisConfigCard = styled.section`
	width: min(${unit(660)}, calc(100vw - ${unit(48)}));
	border-radius: ${unit(14)};
	border: 1px solid rgba(182, 206, 240, 0.6);
	background: rgba(14, 32, 69, 0.5);
	backdrop-filter: blur(${unit(4)});
	padding: ${unit(16)};
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};
	margin-bottom: ${unit(20)};

	label {
		display: flex;
		flex-direction: column;
		gap: ${unit(10)};
	}

	label > span {
		color: rgba(228, 239, 255, 0.96);
		font-size: ${unit(12)};
		font-weight: 700;
	}

	input,
	select,
	textarea {
		width: 100%;
		border: 1px solid rgba(174, 199, 235, 0.65);
		border-radius: ${unit(8)};
		height: ${unit(36)};
		padding: 0 ${unit(10)};
		font-size: ${unit(13)};
		color: rgba(27, 39, 63, 1);
		background: rgba(245, 250, 255, 0.96);
		box-sizing: border-box;
	}

	input:disabled,
	select:disabled,
	textarea:disabled {
		background: rgba(221, 227, 238, 1) !important;
		border-color: rgba(170, 181, 203, 1) !important;
		color: rgba(112, 121, 138, 1) !important;
		cursor: default;
	}

	textarea {
		min-height: ${unit(112)};
		height: auto;
		padding: ${unit(8)} ${unit(10)};
		resize: vertical;
	}
`;

const ConfigTitle = styled.h2`
	font-size: ${unit(16)};
	font-weight: 700;
	color: white;
`;

const ConfigModeRow = styled.div`
	display: flex;
	gap: ${unit(8)};
`;

const ModeButton = styled.button<{ $active: boolean }>`
	border: 1px solid ${({ $active }) => ($active ? 'rgba(120, 203, 255, 0.9)' : 'rgba(158, 181, 219, 0.7)')};
	background: ${({ $active }) => ($active ? 'rgba(30, 87, 157, 0.95)' : 'rgba(12, 44, 95, 0.55)')};
	color: white;
	font-size: ${unit(13)};
	font-weight: 700;
	border-radius: ${unit(999)};
	padding: ${unit(6)} ${unit(12)};
	cursor: pointer;
	transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: ${({ $active }) => ($active ? 'rgba(38, 99, 177, 0.96)' : 'rgba(22, 58, 116, 0.72)')};
		border-color: ${({ $active }) => ($active ? 'rgba(139, 214, 255, 1)' : 'rgba(178, 199, 232, 0.9)')};
		box-shadow: 0 ${unit(5)} ${unit(12)} rgba(17, 46, 92, 0.2);
	}
`;

const ConfigGrid = styled.div`
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: ${unit(10)};

	@media screen and (max-width: 768px) {
		grid-template-columns: 1fr;
	}
`;

const ConfigHint = styled.p`
	color: rgba(219, 232, 255, 0.94);
	font-size: ${unit(12)};
`;

const PresetRow = styled.div`
	display: grid;
	grid-template-columns: 1fr auto;
	gap: ${unit(8)};
	align-items: center;
`;

const PresetSaveButton = styled.button`
	height: ${unit(36)};
	padding: 0 ${unit(12)};
	border-radius: ${unit(8)};
	border: 1px solid rgba(104, 129, 175, 1);
	background: rgba(233, 242, 255, 1);
	color: rgba(35, 65, 126, 1);
	font-size: ${unit(12)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: rgba(220, 233, 252, 1);
		border-color: rgba(77, 110, 171, 1);
		box-shadow: 0 ${unit(4)} ${unit(10)} rgba(32, 65, 126, 0.12);
	}

	&:disabled {
		background: rgba(221, 227, 238, 1);
		border-color: rgba(170, 181, 203, 1);
		color: rgba(112, 121, 138, 1);
		cursor: default;
	}
`;

const TagGroupWrap = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(10)};
`;

const TagGroup = styled.div`
	display: flex;
	flex-direction: column;
	gap: ${unit(7)};

	strong {
		font-size: ${unit(12)};
		color: rgba(214, 228, 252, 0.94);
	}
`;

const TagRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: ${unit(6)};
`;

const TagChip = styled.button<{ $active: boolean }>`
	border-radius: ${unit(999)};
	border: 1px solid ${({ $active }) => ($active ? 'rgba(95, 169, 255, 1)' : 'rgba(164, 187, 225, 0.8)')};
	background: ${({ $active }) => ($active ? 'rgba(33, 94, 170, 0.95)' : 'rgba(15, 47, 98, 0.5)')};
	color: white;
	font-size: ${unit(12)};
	font-weight: 700;
	padding: ${unit(6)} ${unit(10)};
	cursor: pointer;
	transition: background-color 0.2s ease, border-color 0.2s ease;

	&:hover {
		background: ${({ $active }) => ($active ? 'rgba(43, 106, 186, 0.96)' : 'rgba(24, 63, 126, 0.58)')};
	}

	&:disabled {
		background: rgba(221, 227, 238, 1);
		border-color: rgba(170, 181, 203, 1);
		color: rgba(112, 121, 138, 1);
		cursor: default;
	}
`;

const StartAnalysisButton = styled.button`
	width: min(${unit(220)}, calc(100vw - ${unit(48)}));
	height: ${unit(48)};
	border-radius: ${unit(999)};
	border: none;
	background: rgba(41, 85, 168, 1);
	color: white;
	font-size: ${unit(16)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: rgba(50, 96, 184, 1);
		box-shadow: 0 ${unit(8)} ${unit(16)} rgba(24, 59, 126, 0.28);
	}
`;
