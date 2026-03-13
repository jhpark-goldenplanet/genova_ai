'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { keyframes } from '@emotion/react';
import { unit } from '@/shared/utils/base';
import { NAVBAR_WIDTH } from '@/shared/constants';
import AnimatedSelect from '@/components/AnimatedSelect';

type AnalysisMode = 'AUTO' | 'CUSTOM';
type FlowStep = 'UPLOAD' | 'CONFIGURE' | 'READY' | 'DONE';
type ProcessStage = 'UPLOAD' | 'CONFIGURE' | 'ANALYZE' | 'DONE';

const processStageToFlowStep = (stage: ProcessStage): FlowStep => {
	if (stage === 'UPLOAD') return 'UPLOAD';
	if (stage === 'CONFIGURE') return 'CONFIGURE';
	if (stage === 'ANALYZE') return 'READY';
	return 'DONE';
};

interface WorkspaceAnalysisItem {
	id: string;
	name: string;
	status: 'COMPLETE' | 'IN_PROGRESS' | 'FAILED';
	processStage?: ProcessStage;
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

interface UploadedVideoState {
	videoId: string;
	filename: string;
	contentType: string;
	fileSize: number;
}

interface PromptPresetItem {
	name: string;
	tags: string[];
	updatedAt: string;
}

interface StoredWorkItem extends Partial<WorkspaceWorkItem> {
	id: string;
}

interface WorkDraftPayload {
	videoId: string;
	source: string;
	duration: string;
	title: string;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_FILE_LENGTH = 1;
const MIN_VIDEO_DURATION = 60; // 1분
const MAX_VIDEO_DURATION = 2700; // 45분
const DEV_SKIP_UPLOAD_FLOW = true;
const LAST_VIDEO_ID_KEY = 'genova_active_video_id';
const WORKSPACE_STORAGE_KEY = 'genova_workspace_mock_works_v1';
const PROMPT_PRESET_STORAGE_KEY = 'genova_prompt_tag_presets_v1';
const UPLOAD_FLOW_STORAGE_KEY = 'genova_upload_flow_draft_v1';

const PROMPT_TAG_GROUPS: PromptTagGroup[] = [
	{
		key: 'summaryDensity',
		label: '전체 요약 밀도',
		items: ['한눈에 보기', '균형 요약', '맥락 포함'],
	},
	{
		key: 'timelineFocus',
		label: '타임라인 기준',
		items: ['주제 중심', '핵심 장면 중심', '액션 포인트 중심'],
	},
	{
		key: 'highlight',
		label: '강조 포인트',
		items: ['핵심 메시지', '의사결정 포인트', '실행 항목', '이슈 및 리스크'],
	},
	{
		key: 'tone',
		label: '표현 방식',
		items: ['간결하게', '보고서 톤', '쉬운 설명'],
	},
];

const VALID_PROMPT_TAGS = new Set(PROMPT_TAG_GROUPS.flatMap((group) => group.items));

const DEFAULT_PROMPT_PRESETS: PromptPresetItem[] = [
	{
		name: '기본 요약',
		tags: ['균형 요약', '주제 중심', '핵심 메시지', '간결하게'],
		updatedAt: '2026-03-13T00:00:00.000Z',
	},
	{
		name: '보고용 요약',
		tags: ['한눈에 보기', '주제 중심', '의사결정 포인트', '보고서 톤'],
		updatedAt: '2026-03-13T00:00:00.000Z',
	},
	{
		name: '실행 포인트',
		tags: ['균형 요약', '액션 포인트 중심', '실행 항목', '간결하게'],
		updatedAt: '2026-03-13T00:00:00.000Z',
	},
	{
		name: '이슈 검토',
		tags: ['맥락 포함', '핵심 장면 중심', '이슈 및 리스크', '보고서 톤'],
		updatedAt: '2026-03-13T00:00:00.000Z',
	},
];

const sanitizePromptTags = (tags: string[] = []) => tags.filter((tag) => VALID_PROMPT_TAGS.has(tag));

const normalizePromptPresets = (presets: PromptPresetItem[]) => {
	const normalized = presets
		.map((preset) => ({
			...preset,
			tags: sanitizePromptTags(preset.tags),
		}))
		.filter((preset) => preset.name?.trim());

	return normalized.length ? normalized : DEFAULT_PROMPT_PRESETS;
};

export default function UploadContent() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { confirm, closeConfirm } = useModal();

	const [isBusy, setIsBusy] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [hasExistingWork, setHasExistingWork] = useState(false);
	const [flowStep, setFlowStep] = useState<FlowStep>('UPLOAD');
	const [viewStep, setViewStep] = useState<FlowStep>('UPLOAD');
	const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('AUTO');
	const [presetName, setPresetName] = useState('기본 요약');
	const [splitCountValue, setSplitCountValue] = useState('5');
	const [durationLabel, setDurationLabel] = useState('-');
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [uploadedVideo, setUploadedVideo] = useState<UploadedVideoState | null>(null);
	const [projectName, setProjectName] = useState('');
	const [projectNameDraft, setProjectNameDraft] = useState('');
	const [analysisName, setAnalysisName] = useState('');
	const [savedAnalysisName, setSavedAnalysisName] = useState('');
	const [isProjectNameModalOpen, setIsProjectNameModalOpen] = useState(false);
	const [createdAnalysisId, setCreatedAnalysisId] = useState('');
	const [storedPresets, setStoredPresets] = useState<PromptPresetItem[]>([]);
	const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
	const [isPresetModalClosing, setIsPresetModalClosing] = useState(false);
	const [newPresetName, setNewPresetName] = useState('');
	const [hoveredStep, setHoveredStep] = useState<FlowStep | null>(null);
	const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false);
	const [isRestartConfirmClosing, setIsRestartConfirmClosing] = useState(false);

	const { register, handleSubmit, setValue, watch } = useForm<IFormValues>();

	const watchFiles: File[] = watch('files');
	const entryMode = searchParams.get('mode') ?? 'project';
	const entryWorkId = searchParams.get('workId');
	const entryAnalysisId = searchParams.get('analysisId');

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
		if (entryMode !== 'project') return;
		setIsProjectNameModalOpen(true);
	}, [entryMode]);

	useEffect(() => {
		return () => {
			if (typeof window === 'undefined') return;
			if (!pathname.startsWith('/workspace/new')) return;
			window.localStorage.removeItem(UPLOAD_FLOW_STORAGE_KEY);
		};
	}, [pathname]);

	useEffect(() => {
		if (typeof window === 'undefined') return;

		try {
			const raw = window.localStorage.getItem(UPLOAD_FLOW_STORAGE_KEY);
			if (!raw) return;
			if (entryMode === 'analysis' && entryWorkId) return;
			const draft = JSON.parse(raw);
			if (draft?.flowStep) {
				setFlowStep(draft.flowStep);
				setViewStep(draft.flowStep);
			}
			if (draft?.analysisMode) setAnalysisMode(draft.analysisMode);
			if (typeof draft?.presetName === 'string') setPresetName(draft.presetName);
			if (typeof draft?.splitCountValue === 'string') setSplitCountValue(draft.splitCountValue);
			if (typeof draft?.durationLabel === 'string') setDurationLabel(draft.durationLabel);
			if (typeof draft?.projectName === 'string') {
				setProjectName(draft.projectName);
				setProjectNameDraft(draft.projectName);
				if (draft.projectName.trim()) setIsProjectNameModalOpen(false);
			}
			if (typeof draft?.analysisName === 'string') setAnalysisName(draft.analysisName);
			if (typeof draft?.analysisName === 'string') setSavedAnalysisName(draft.analysisName);
			if (Array.isArray(draft?.selectedTags)) setSelectedTags(sanitizePromptTags(draft.selectedTags));
			if (draft?.uploadedVideo) setUploadedVideo(draft.uploadedVideo);
			if (typeof draft?.createdAnalysisId === 'string') setCreatedAnalysisId(draft.createdAnalysisId);
		} catch (error) {
			console.error('[UploadFlow] failed to restore draft', error);
		}
	}, [entryMode, entryWorkId]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (entryMode !== 'analysis' || !entryWorkId) return;

		try {
			const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '[]') as StoredWorkItem[];
			const targetWork = parsed.find((item) => item.id === entryWorkId);
			if (!targetWork) return;

			const nextDuration = targetWork.duration || '-';
			const sourceName = targetWork.source || 'registered-video.mp4';
			const nextVideoId = targetWork.videoId || `existing-video-${targetWork.id}`;
			const selectedAnalysis = (targetWork.analyses ?? []).find((analysis) => analysis.id === entryAnalysisId);
			const initialStage = selectedAnalysis?.processStage ?? 'CONFIGURE';

			setDurationLabel(nextDuration);
			setProjectName(targetWork.title || '');
			setProjectNameDraft(targetWork.title || '');
			setAnalysisName(selectedAnalysis?.name || '');
			setSavedAnalysisName(selectedAnalysis?.name || '');
			setUploadedVideo({
				videoId: nextVideoId,
				filename: sourceName,
				contentType: 'video/mp4',
				fileSize: 0,
			});
			const draftAnalysisId =
				selectedAnalysis?.id ||
				ensureDraftAnalysis({
					videoId: nextVideoId,
					projectTitle: targetWork.title || '',
					sourceName,
					duration: nextDuration,
					analysisTitle: '새 작업',
				});
			setCreatedAnalysisId(draftAnalysisId);
			if (!selectedAnalysis?.name) {
				setAnalysisName('새 작업');
				setSavedAnalysisName('새 작업');
			}
			setPresetName(selectedAnalysis?.promptLabel || '기본 요약');
			setSelectedTags(sanitizePromptTags(selectedAnalysis?.keywords ?? []));
			const restoredStep = processStageToFlowStep(initialStage);
			setFlowStep(restoredStep);
			setViewStep(restoredStep);
			window.localStorage.setItem(LAST_VIDEO_ID_KEY, nextVideoId);
		} catch (error) {
			console.error('[UploadFlow] failed to load existing work context', error);
		}
	}, [entryMode, entryWorkId, entryAnalysisId]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const payload = {
			flowStep,
			viewStep,
			analysisMode,
			presetName,
			splitCountValue,
			durationLabel,
			projectName,
			analysisName,
			selectedTags,
			uploadedVideo,
			createdAnalysisId,
		};
		window.localStorage.setItem(UPLOAD_FLOW_STORAGE_KEY, JSON.stringify(payload));
	}, [flowStep, viewStep, analysisMode, presetName, splitCountValue, durationLabel, projectName, analysisName, selectedTags, uploadedVideo, createdAnalysisId]);

	useEffect(() => {
		if (analysisMode === 'AUTO') {
			setPresetName('자동');
			setSplitCountValue('');
			setSelectedTags([]);
			return;
		}

		if (presetName === '자동') setPresetName('기본 요약');
		if (!splitCountValue) setSplitCountValue('5');
	}, [analysisMode]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		try {
			const parsed = JSON.parse(window.localStorage.getItem(PROMPT_PRESET_STORAGE_KEY) ?? '[]');
			const base = Array.isArray(parsed) ? (parsed as PromptPresetItem[]) : [];
			const normalized = normalizePromptPresets(base);
			setStoredPresets(normalized);
			window.localStorage.setItem(PROMPT_PRESET_STORAGE_KEY, JSON.stringify(normalized));
		} catch (error) {
			setStoredPresets(DEFAULT_PROMPT_PRESETS);
		}
	}, []);

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

	const persistUploadedWork = ({ videoId, source, duration, title }: WorkDraftPayload) => {
		if (typeof window === 'undefined') return;
		const now = new Date();
		const stamp = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')} ${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`;

		let works: WorkspaceWorkItem[] = [];
		try {
			const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '[]');
			works = Array.isArray(parsed) ? parsed : [];
		} catch (error) {
			works = [];
		}

		const existingIndex = works.findIndex((item) => item.videoId === videoId);
		const baseWork: WorkspaceWorkItem = {
			id: `work-${Date.now()}`,
			title,
			duration,
			uploadedAt: stamp.slice(0, 10),
			source,
			videoId,
			analyses: [],
		};

		if (existingIndex >= 0) {
			works[existingIndex] = {
				...works[existingIndex],
				title: title || works[existingIndex].title || baseWork.title,
				duration: duration === '-' ? works[existingIndex].duration : duration,
				source: works[existingIndex].source || source,
				videoId,
			};
		} else {
			works.unshift(baseWork);
		}

		window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(works));
		window.localStorage.setItem(LAST_VIDEO_ID_KEY, videoId);
	};

	const ensureDraftAnalysis = ({
		videoId,
		projectTitle,
		sourceName,
		duration,
		analysisId,
		analysisTitle,
	}: {
		videoId: string;
		projectTitle: string;
		sourceName: string;
		duration: string;
		analysisId?: string;
		analysisTitle?: string;
	}) => {
		if (typeof window === 'undefined') return '';
		const now = new Date();
		const stamp = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')} ${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`;
		const nextAnalysisId = analysisId || `analysis-${Date.now()}`;
		const nextAnalysisName = analysisTitle?.trim() || '새 작업';

		try {
			const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '[]') as WorkspaceWorkItem[];
			const works = Array.isArray(parsed) ? parsed : [];
			const workIndex = works.findIndex((item) => item.videoId === videoId);
			if (workIndex < 0) return nextAnalysisId;

			const target = works[workIndex];
			const existingAnalysis = (target.analyses ?? []).find((item) => item.id === nextAnalysisId);
			const draftAnalysis: WorkspaceAnalysisItem = {
				id: nextAnalysisId,
				name: nextAnalysisName,
				status: 'IN_PROGRESS',
				processStage: 'CONFIGURE',
				updatedAt: stamp,
				promptLabel: presetName || '기본 요약',
				briefing: '분석 설정 진행 중입니다.',
				keywords: selectedTags.slice(0, 5),
				mode: analysisMode,
				splitCount: analysisMode === 'AUTO' ? 0 : Number(splitCountValue || 5),
			};

			works[workIndex] = {
				...target,
				title: projectTitle || target.title,
				source: sourceName || target.source,
				duration: duration === '-' ? target.duration : duration,
				analyses: existingAnalysis
					? (target.analyses ?? []).map((item) => (item.id === nextAnalysisId ? { ...item, ...draftAnalysis } : item))
					: [...(target.analyses ?? []), draftAnalysis],
			};

			window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(works));
			return nextAnalysisId;
		} catch (error) {
			console.error('[UploadFlow] failed to ensure draft analysis', error);
			return nextAnalysisId;
		}
	};

	const setWorksStatusComplete = (videoId: string, analysisId: string) => {
		if (typeof window === 'undefined') return;
		try {
			const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '[]') as WorkspaceWorkItem[];
			const nextWorks = parsed.map((work) => {
				if (work.videoId !== videoId) return work;
				return {
					...work,
					analyses: (work.analyses ?? []).map((analysis) =>
						analysis.id === analysisId
							? { ...analysis, status: 'COMPLETE' as const, processStage: 'DONE' as const }
							: analysis,
					),
				};
			});
			window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(nextWorks));
		} catch (error) {
			console.error('[UploadFlow] failed to update analysis status', error);
		}
	};

	const uploadSelectedFile = async (file: File) => {
		setIsBusy(true);
		setUploadProgress(0);

		try {
			const contentType = (file.type || 'video/mp4').split(';')[0].trim().toLowerCase();
			const { upload_url, video_id } = await getUploadUrl({
				filename: file.name,
				content_type: contentType,
				file_size: file.size,
			});

			await uploadToGCS(upload_url, file, contentType, (progress) => {
				setUploadProgress(Math.floor(progress));
			});

			await confirmUpload({ video_id });

			setUploadedVideo({
				videoId: video_id,
				filename: file.name,
				contentType,
				fileSize: file.size,
			});
			persistUploadedWork({
				videoId: video_id,
				source: file.name,
				duration: durationLabel,
				title: projectName.trim() || file.name.replace(/\.[^.]+$/, ''),
			});
			const draftAnalysisId = ensureDraftAnalysis({
				videoId: video_id,
				projectTitle: projectName.trim() || file.name.replace(/\.[^.]+$/, ''),
				sourceName: file.name,
				duration: durationLabel,
				analysisTitle: analysisName.trim() || '새 작업',
			});
			setCreatedAnalysisId(draftAnalysisId);
			setAnalysisName((prev) => prev.trim() || '새 작업');
			setSavedAnalysisName((prev) => prev.trim() || '새 작업');
			setFlowStep('CONFIGURE');
			setViewStep('CONFIGURE');
			successToast('영상 업로드가 완료되었습니다.');
		} catch (error: any) {
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
				uploadSelectedFile(newFiles[0]);
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
		if (!uploadedVideo) {
			errorToast('먼저 영상 업로드를 완료해주세요.');
			return;
		}

		if (entryAnalysisId && flowStep === 'DONE') {
			setIsRestartConfirmClosing(false);
			setIsRestartConfirmOpen(true);
			return;
		}

		executeAnalysisStart();
	};

	const handleOpenFilePicker = () => {
		if (entryMode === 'analysis') {
			setFlowStep('CONFIGURE');
			setViewStep('CONFIGURE');
			successToast('기존 프로젝트 원본 영상으로 분석 설정 단계로 이동했습니다.');
			return;
		}

		if (!projectName.trim()) {
			setIsProjectNameModalOpen(true);
			errorToast('먼저 프로젝트명을 입력해주세요.');
			return;
		}

		if (DEV_SKIP_UPLOAD_FLOW) {
			const mockVideoId = `mock-video-${Date.now()}`;
			const mockFilename = 'sample-education-video.mp4';
			setDurationLabel('12:40');
			setUploadedVideo({
				videoId: mockVideoId,
				filename: mockFilename,
				contentType: 'video/mp4',
				fileSize: 128 * 1024 * 1024,
			});
			persistUploadedWork({
				videoId: mockVideoId,
				source: mockFilename,
				duration: '12:40',
				title: projectName.trim() || '새 프로젝트',
			});
			const draftAnalysisId = ensureDraftAnalysis({
				videoId: mockVideoId,
				projectTitle: projectName.trim() || '새 프로젝트',
				sourceName: mockFilename,
				duration: '12:40',
				analysisTitle: analysisName.trim() || '새 작업',
			});
			setCreatedAnalysisId(draftAnalysisId);
			setAnalysisName((prev) => prev.trim() || '새 작업');
			setSavedAnalysisName((prev) => prev.trim() || '새 작업');
			setFlowStep('CONFIGURE');
			setViewStep('CONFIGURE');
			if (typeof window !== 'undefined') {
				window.localStorage.setItem(LAST_VIDEO_ID_KEY, mockVideoId);
			}
			successToast('개발용 임시 플로우로 업로드 완료 단계를 표시합니다.');
			return;
		}

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

	const handlePresetSelect = (nextName: string) => {
		setPresetName(nextName);
		const matchedPreset = storedPresets.find((preset) => preset.name === nextName);
		if (matchedPreset) {
			setSelectedTags(sanitizePromptTags(matchedPreset.tags));
		}
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
			const next = normalizePromptPresets([
				preset,
				...base.filter((item: any) => item?.name !== trimmedName),
			]);
			window.localStorage.setItem(PROMPT_PRESET_STORAGE_KEY, JSON.stringify(next.slice(0, 20)));
			setStoredPresets(next.slice(0, 20));
			setPresetName(trimmedName);
			successToast('프롬프트 프리셋이 저장되었습니다.');
		} catch (error) {
			errorToast('프리셋 저장 중 오류가 발생했습니다.');
		}
	};

	const handleCreatePreset = () => {
		if (analysisMode === 'AUTO') return;
		const trimmedName = newPresetName.trim();
		if (!trimmedName) {
			errorToast('프리셋명을 입력해주세요.');
			return;
		}
		const exists = storedPresets.some((preset) => preset.name === trimmedName);
		if (exists) {
			errorToast('동일한 프리셋명이 이미 존재합니다.');
			return;
		}
		const now = new Date().toISOString();
		const nextPreset: PromptPresetItem = {
			name: trimmedName,
			tags: [],
			updatedAt: now,
		};
		const nextPresets = normalizePromptPresets([nextPreset, ...storedPresets]).slice(0, 20);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(PROMPT_PRESET_STORAGE_KEY, JSON.stringify(nextPresets));
		}
		setStoredPresets(nextPresets);
		setPresetName(trimmedName);
		setSelectedTags([]);
		setNewPresetName('');
		closePresetModal();
		successToast('신규 프리셋이 추가되었습니다.');
	};

	const handleDeletePreset = () => {
		if (analysisMode === 'AUTO') return;
		const targetName = presetName.trim();
		if (!targetName || targetName === '자동') {
			errorToast('삭제할 프리셋을 선택해주세요.');
			return;
		}
		const nextPresets = storedPresets.filter((preset) => preset.name !== targetName);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(PROMPT_PRESET_STORAGE_KEY, JSON.stringify(nextPresets));
		}
		setStoredPresets(nextPresets);
		setPresetName(nextPresets[0]?.name ?? '기본 요약');
		setSelectedTags(nextPresets[0]?.tags ?? []);
		successToast('프리셋이 삭제되었습니다.');
	};

	const handleApplyProjectName = () => {
		const nextProjectName = projectNameDraft.trim();
		if (!nextProjectName) {
			errorToast('프로젝트명을 입력해주세요.');
			return;
		}
		setProjectName(nextProjectName);
		setProjectNameDraft(nextProjectName);
		setIsProjectNameModalOpen(false);
	};

	const handleAnalysisNameBlur = () => {
		const trimmedName = analysisName.trim();
		if (!trimmedName) {
			errorToast('필수 입력값입니다');
			setAnalysisName(savedAnalysisName);
			return;
		}

		setAnalysisName(trimmedName);
		setSavedAnalysisName(trimmedName);

		const targetAnalysisId = createdAnalysisId || entryAnalysisId;
		if (uploadedVideo && targetAnalysisId) {
			updateAnalysisStage(uploadedVideo.videoId, targetAnalysisId, {
				name: trimmedName,
			});
		}
	};

	const closePresetModal = () => {
		setIsPresetModalClosing(true);
		window.setTimeout(() => {
			setIsPresetModalOpen(false);
			setIsPresetModalClosing(false);
		}, 220);
	};

	const closeRestartConfirmModal = () => {
		setIsRestartConfirmClosing(true);
		window.setTimeout(() => {
			setIsRestartConfirmOpen(false);
			setIsRestartConfirmClosing(false);
		}, 220);
	};

	const executeAnalysisStart = () => {
		if (!uploadedVideo) {
			errorToast('먼저 영상 업로드를 완료해주세요.');
			return;
		}
		try {
			let createdAnalysis: WorkspaceAnalysisItem | null = null;
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

				const existingIndex = works.findIndex((item) => item.videoId === uploadedVideo.videoId);
				const reusedAnalysis = entryAnalysisId
					? works[existingIndex]?.analyses?.find((analysis) => analysis.id === entryAnalysisId)
					: null;
				const nextAnalysisId = reusedAnalysis?.id ?? `analysis-${Date.now()}`;
				const nextAnalysisName =
					analysisName.trim() || reusedAnalysis?.name || `분석 ${analysisMode === 'AUTO' ? 'A (AI 자동)' : 'B (커스텀)'}`;
				const nextAnalysis: WorkspaceAnalysisItem = {
					id: nextAnalysisId,
					name: nextAnalysisName,
					status: 'IN_PROGRESS',
					processStage: 'ANALYZE',
					updatedAt: stamp,
					promptLabel,
					briefing: '분석 실행 중입니다.',
					keywords: appliedTags.slice(0, 5),
					promptText,
					splitCount,
					mode: analysisMode,
				};
				createdAnalysis = nextAnalysis;

				if (existingIndex >= 0) {
					const target = works[existingIndex];
					const nextAnalyses = reusedAnalysis
						? (target.analyses ?? []).map((analysis) => (analysis.id === reusedAnalysis.id ? nextAnalysis : analysis))
						: [...(target.analyses ?? []), nextAnalysis];
					works[existingIndex] = {
						...target,
						title: projectName.trim() || target.title || uploadedVideo.filename.replace(/\.[^.]+$/, ''),
						source: target.source || uploadedVideo.filename,
						duration: durationLabel === '-' ? target.duration : durationLabel,
						uploadedAt: stamp.slice(0, 10),
						videoId: uploadedVideo.videoId,
						analyses: nextAnalyses,
					};
				} else {
					works.unshift({
						id: `work-${Date.now()}`,
						title: projectName.trim() || uploadedVideo.filename.replace(/\.[^.]+$/, ''),
						duration: durationLabel,
						uploadedAt: stamp.slice(0, 10),
						source: uploadedVideo.filename,
						videoId: uploadedVideo.videoId,
						analyses: [nextAnalysis],
					});
				}

				window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(works));
				window.localStorage.setItem(LAST_VIDEO_ID_KEY, uploadedVideo.videoId);
			}
			if (!createdAnalysis) {
				throw new Error('analysis creation failed');
			}
			setCreatedAnalysisId(createdAnalysis.id);
			setFlowStep('READY');
			setViewStep('READY');
			successToast('분석을 시작했습니다.');
			window.setTimeout(() => {
				updateAnalysisStage(uploadedVideo.videoId, createdAnalysis.id, {
					status: 'COMPLETE',
					processStage: 'DONE',
					briefing: '분석이 완료되었습니다. 결과 화면에서 상세 내용을 확인할 수 있습니다.',
				});
				setFlowStep('DONE');
				setViewStep('DONE');
			}, 900);
		} catch (error: any) {
			errorToast('분석 시작에 실패했습니다.');
		}
	};

	const updateAnalysisStage = (
		videoId: string,
		analysisId: string,
		nextPatch: Partial<WorkspaceAnalysisItem>,
	) => {
		if (typeof window === 'undefined') return;
		try {
			const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '[]') as WorkspaceWorkItem[];
			const nextWorks = parsed.map((work) => {
				if (work.videoId !== videoId) return work;
				return {
					...work,
					analyses: (work.analyses ?? []).map((analysis) =>
						analysis.id === analysisId ? { ...analysis, ...nextPatch } : analysis,
					),
				};
			});
			window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(nextWorks));
		} catch (error) {
			console.error('[UploadFlow] failed to update analysis', error);
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

	const steps: { key: FlowStep; label: string }[] = [
		{ key: 'UPLOAD', label: '영상 업로드' },
		{ key: 'CONFIGURE', label: '설정' },
		{ key: 'READY', label: '분석' },
		{ key: 'DONE', label: '완료' },
	];
	const rankMap: Record<FlowStep, number> = {
		UPLOAD: 0,
		CONFIGURE: 1,
		READY: 2,
		DONE: 3,
	};
	const currentRank = rankMap[flowStep];
	const stepProgress = `${((currentRank + 1) / steps.length) * 100}%`;
	const viewedRank = rankMap[viewStep];
	const showUploadStage = viewStep === 'UPLOAD';
	const showConfigureStage = viewStep === 'CONFIGURE';
	const showAnalysisStage = viewStep === 'READY';
	const showDoneStage = viewStep === 'DONE';

	const handleStepView = (targetStep: FlowStep) => {
		if (rankMap[targetStep] > currentRank) return;
		if (flowStep === 'DONE' && targetStep === 'READY') {
			setViewStep('DONE');
			return;
		}
		setViewStep(targetStep);
	};

	return (
		<S.Container>
			<S.Main {...getRootProps()}>
				<input {...getInputProps()} />

				{isDragActive ? (
					<S.DragOverlay>
						<div>{`여기에 파일을 놓으세요.`}</div>
					</S.DragOverlay>
				) : null}

				<StepShell>
					<BackToWorkspaceButton
						type="button"
						onClick={() => {
							if (typeof window !== 'undefined') {
								window.localStorage.removeItem(UPLOAD_FLOW_STORAGE_KEY);
							}
							router.push('/workspace');
						}}
					>
						목록으로 돌아가기
					</BackToWorkspaceButton>

					{projectName ? (
						<ProjectNameBadge>
							{projectName}
							{analysisName ? (
								<span>
									<BreadcrumbChevron aria-hidden="true">
										<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
										</svg>
									</BreadcrumbChevron>
									{analysisName}
								</span>
							) : null}
						</ProjectNameBadge>
					) : null}

					<StepPanel>
						{showUploadStage ? (
							<ContentTextBlock>
								<TitleText>{`영상, 핵심만 쏙!\n요약과 분할로 한눈에 정리합니다.`}</TitleText>
								<SubTextLeft>{`긴 자료, 읽기 번거로우셨죠?\n깔끔하게 요약해 딱 필요한 정보만 알려드릴게요!`}</SubTextLeft>
							</ContentTextBlock>
						) : null}

						<StepForm onSubmit={handleSubmit(onSubmit)}>
							{showUploadStage ? (
								<StageSurface key="upload-stage">
									{uploadedVideo ? (
										<>
											<UploadVideoPreview>
												<UploadVideoSurface>
													<UploadVideoLabel>업로드된 영상 영역</UploadVideoLabel>
												</UploadVideoSurface>
											</UploadVideoPreview>
											<UploadCompleteCard>
												<strong>업로드된 원본 영상</strong>
												<p>{uploadedVideo.filename} 원본 영상을 사용 중입니다. 업로드 단계에서는 영상 정보를 확인만 할 수 있습니다.</p>
												<MetaRow>
													<span>길이 {durationLabel}</span>
													<span>형식 {uploadedVideo.contentType || 'video/mp4'}</span>
													<span>용량 {uploadedVideo.fileSize > 0 ? `${(uploadedVideo.fileSize / (1024 * 1024)).toFixed(1)}MB` : '-'}</span>
												</MetaRow>
											</UploadCompleteCard>
										</>
									) : (
										<>
											<UploadDropBox>
												<UploadBoxIcon aria-hidden="true">
													<svg width="54" height="54" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
														<rect x="7" y="10" width="40" height="34" rx="10" stroke="currentColor" strokeWidth="2.5" />
														<path d="M27 35V19" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
														<path d="M20 25L27 18L34 25" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
													</svg>
												</UploadBoxIcon>
											</UploadDropBox>
											<UploadGuideBlock>
												<UploadGuideText>{`박스에 파일을 드래그하거나\n파일 업로드 버튼을 클릭하세요.`}</UploadGuideText>
												<UploadActionButton type="button" onClick={handleOpenFilePicker}>
													파일 업로드
												</UploadActionButton>
												<UploadGuideNotice>{`(영상 길이 1~45분, 최대 2GB, MP4·MOV·WMV·AVI 가능)`}</UploadGuideNotice>
												{projectName ? <ProjectPendingText>영상 업로드 후 프로젝트가 생성됩니다</ProjectPendingText> : null}
											</UploadGuideBlock>
										</>
									)}
								</StageSurface>
							) : null}

							{showConfigureStage ? (
								<StageSurface key="configure-stage">
									<ConfigureStageLayout>
										<ConfigurePrimaryColumn>
											<UploadCompleteCard $compact $fullWidth>
												<VideoInfoName>{uploadedVideo?.filename ?? '-'}</VideoInfoName>
												<MetaRow>
													<span>길이 {durationLabel}</span>
													<span>형식 {uploadedVideo?.contentType || 'video/mp4'}</span>
													<span>용량 {uploadedVideo && uploadedVideo.fileSize > 0 ? `${(uploadedVideo.fileSize / (1024 * 1024)).toFixed(1)}MB` : '-'}</span>
												</MetaRow>
											</UploadCompleteCard>
											<AnalysisConfigCard $fullWidth>
												<ConfigTitle>컨텐츠 설정</ConfigTitle>
												<label>
													<span>작업명</span>
													<input
														value={analysisName}
														onChange={(e) => setAnalysisName(e.target.value)}
														onBlur={handleAnalysisNameBlur}
														placeholder="예: 핵심 위주 요약 작업"
													/>
												</label>
												<label>
													<span>분석 방식</span>
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
												</label>
												<label>
													<span>분할 개수 (최소 3개 / 최대 8개)</span>
													<SplitCounter $disabled={analysisMode === 'AUTO'}>
														<SplitCounterButton
															type="button"
															onClick={() => {
																if (analysisMode === 'AUTO') return;
																setSplitCountValue((prev) => String(Math.max(3, Number(prev || 5) - 1)));
															}}
															disabled={analysisMode === 'AUTO'}
														>
															-
														</SplitCounterButton>
														<SplitCounterValue>{analysisMode === 'AUTO' ? '자동' : splitCountValue}</SplitCounterValue>
														<SplitCounterButton
															type="button"
															onClick={() => {
																if (analysisMode === 'AUTO') return;
																setSplitCountValue((prev) => String(Math.min(8, Number(prev || 5) + 1)));
															}}
															disabled={analysisMode === 'AUTO'}
														>
															+
														</SplitCounterButton>
													</SplitCounter>
												</label>
												<ModeTip>
													<strong>{analysisMode === 'AUTO' ? 'AI 자동' : '커스텀'}</strong>
													<p>
														{analysisMode === 'AUTO'
															? '영상 길이와 흐름에 맞춰 AI가 분할 개수와 요약 방향을 자동으로 조정합니다.'
															: '분할 개수와 프리셋, 항목 설정을 사용자가 직접 선택해 원하는 방식으로 분석합니다.'}
													</p>
												</ModeTip>
											</AnalysisConfigCard>
										</ConfigurePrimaryColumn>
										<ConfigureSecondaryColumn>
											<AnalysisConfigCard $fullWidth>
												<ConfigTitle>프리셋 설정</ConfigTitle>
												<ConfigGrid>
													<label>
														<span>프리셋</span>
														<PresetControlRow>
															<PresetSelectWrap>
																<AnimatedSelect
																	value={analysisMode === 'AUTO' ? '' : presetName}
																	onChange={handlePresetSelect}
																	options={storedPresets.map((preset) => ({ value: preset.name, label: preset.name }))}
																	placeholder={analysisMode === 'AUTO' ? '자동' : '프리셋 선택'}
																	disabled={analysisMode === 'AUTO'}
																	width="100%"
																/>
															</PresetSelectWrap>
															<PresetActionButton type="button" onClick={() => setIsPresetModalOpen(true)} disabled={analysisMode === 'AUTO'}>
																+
															</PresetActionButton>
															<PresetActionButton $variant="primary" type="button" onClick={handleSavePreset} disabled={analysisMode === 'AUTO'}>
																저장
															</PresetActionButton>
															<PresetActionButton $variant="danger" type="button" onClick={handleDeletePreset} disabled={analysisMode === 'AUTO'}>
																삭제
															</PresetActionButton>
														</PresetControlRow>
													</label>
												</ConfigGrid>
												<label>
													<span>항목 설정</span>
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
											</AnalysisConfigCard>
										</ConfigureSecondaryColumn>
									</ConfigureStageLayout>
									<ConfigureActionRow>
										<StartAnalysisButton type="submit">분석 시작</StartAnalysisButton>
									</ConfigureActionRow>
								</StageSurface>
							) : null}

							{showAnalysisStage ? (
								<StageSurface key="analysis-stage">
									<CompletionCard>
										<strong>분석 중입니다</strong>
										<p>선택한 조건으로 분석을 수행하고 있습니다. 완료되면 결과 화면으로 이동할 수 있습니다.</p>
										<ProgressDots aria-hidden="true">
											<span />
											<span />
											<span />
										</ProgressDots>
									</CompletionCard>
								</StageSurface>
							) : null}

							{showDoneStage ? (
								<StageSurface key="done-stage">
									<CompletionCard>
										<strong>분석이 완료되었습니다</strong>
										<p>결과가 준비되었습니다. 분석 결과 버튼을 눌러 상세 내용을 확인하세요.</p>
										<ResultButton
											type="button"
											onClick={() => {
												if (!uploadedVideo) return;
												if (typeof window !== 'undefined') {
													window.localStorage.removeItem(UPLOAD_FLOW_STORAGE_KEY);
												}
												const query = createdAnalysisId ? `?analysisId=${createdAnalysisId}` : '';
												router.push(`/video/${uploadedVideo.videoId}/summary${query}`);
											}}
										>
											분석 결과
										</ResultButton>
									</CompletionCard>
								</StageSurface>
							) : null}

							<input
								{...isRegister}
								name="files"
								type="file"
								id="video-file"
								accept=".mp4,.mov,.wmv,.avi"
								multiple={false}
								style={{ display: 'none' }}
							/>
						</StepForm>
					</StepPanel>

					<StepRail>
						<StepLabelColumn>
							{steps.map((step) => {
								const stepRank = rankMap[step.key as FlowStep];
								const isActive = stepRank === currentRank;
								const isCompleted = stepRank < currentRank;
								const isViewed = step.key === viewStep;
								const isClickable = stepRank <= currentRank;
								return (
									<StepItem
										key={step.key}
										type="button"
										onClick={() => handleStepView(step.key)}
										$clickable={isClickable}
										$hoverable={isClickable}
										onMouseEnter={() => (isClickable ? setHoveredStep(step.key) : null)}
										onMouseLeave={() => setHoveredStep(null)}
									>
										<StepLabel
											$active={isActive}
											$completed={isCompleted}
											$viewed={isViewed}
											$hovered={hoveredStep === step.key}
										>
											{step.label}
										</StepLabel>
									</StepItem>
								);
							})}
						</StepLabelColumn>
						<StepGaugeColumn>
							<StepGaugeTrack>
								<StepGaugeFill style={{ height: stepProgress }} />
								<StepGaugeSegments>
									{steps.map((step) => {
										const stepRank = rankMap[step.key as FlowStep];
										const isClickable = stepRank <= currentRank;
										const isViewed = step.key === viewStep;
										return (
											<StepGaugeSegment
												key={`segment-${step.key}`}
												type="button"
												onClick={() => handleStepView(step.key)}
												onMouseEnter={() => (isClickable ? setHoveredStep(step.key) : null)}
												onMouseLeave={() => setHoveredStep(null)}
												$hovered={hoveredStep === step.key}
												$viewed={isViewed}
												$clickable={isClickable}
											/>
										);
									})}
								</StepGaugeSegments>
							</StepGaugeTrack>
						</StepGaugeColumn>
					</StepRail>
				</StepShell>

				{entryMode === 'project' && isProjectNameModalOpen ? (
					<ProjectNameOverlay>
						<ProjectNameModal>
							<h3>프로젝트명을 입력하세요</h3>
							<p>영상 업로드 전에 프로젝트명을 먼저 정합니다.</p>
							<input
								value={projectNameDraft}
								onChange={(e) => setProjectNameDraft(e.target.value)}
								placeholder="예: 2026 농업 교육 영상"
								autoFocus
							/>
							<ProjectNameSubmitButton type="button" onClick={handleApplyProjectName}>
								확인
							</ProjectNameSubmitButton>
						</ProjectNameModal>
					</ProjectNameOverlay>
				) : null}

				{isPresetModalOpen ? (
					<ProjectNameOverlay $closing={isPresetModalClosing}>
						<BlueToneModalCard $closing={isPresetModalClosing}>
							<h3>신규 프리셋</h3>
							<p>새 프리셋 이름을 입력하세요.</p>
							<input
								value={newPresetName}
								onChange={(e) => setNewPresetName(e.target.value)}
								placeholder="예: 핵심 위주 브리핑"
								autoFocus
							/>
							<PresetModalActions>
								<ModalSecondaryButton type="button" onClick={closePresetModal}>
									취소
								</ModalSecondaryButton>
								<ModalPrimaryButton type="button" onClick={handleCreatePreset}>
									저장
								</ModalPrimaryButton>
							</PresetModalActions>
						</BlueToneModalCard>
					</ProjectNameOverlay>
				) : null}

				{isRestartConfirmOpen ? (
					<ProjectNameOverlay $closing={isRestartConfirmClosing}>
						<BlueToneModalCard $closing={isRestartConfirmClosing}>
							<h3>분석 재시작</h3>
							<p>기존 분석내용이 사라집니다. 계속 진행하시겠습니까?</p>
							<PresetModalActions>
								<ModalSecondaryButton type="button" onClick={closeRestartConfirmModal}>
									취소
								</ModalSecondaryButton>
								<ModalPrimaryButton
									type="button"
									onClick={() => {
										closeRestartConfirmModal();
										executeAnalysisStart();
									}}
								>
									계속
								</ModalPrimaryButton>
							</PresetModalActions>
						</BlueToneModalCard>
					</ProjectNameOverlay>
				) : null}
			</S.Main>

			<Loader isLoading={isBusy} isFetching={isBusy} progress={uploadProgress} withSidebar />
		</S.Container>
	);
}

const AnalysisConfigCard = styled.section<{ $fullWidth?: boolean }>`
	width: ${({ $fullWidth }) => ($fullWidth ? '100%' : `min(${unit(660)}, calc(100vw - ${unit(48)}))`)};
	border-radius: ${unit(14)};
	border: 1px solid rgba(182, 206, 240, 0.6);
	background: rgba(14, 32, 69, 0.5);
	backdrop-filter: blur(${unit(4)});
	padding: ${unit(16)};
	display: flex;
	flex-direction: column;
	gap: ${unit(14)};

	label {
		display: flex;
		flex-direction: column;
		gap: ${unit(10)};
	}

	label > span {
		color: rgba(228, 239, 255, 0.96);
		font-size: ${unit(14)};
		font-weight: 700;
	}

	input,
	select,
	textarea {
		width: 100%;
		border: 1px solid rgba(174, 199, 235, 0.65);
		border-radius: ${unit(8)};
		height: ${unit(42)};
		padding: 0 ${unit(12)};
		font-size: ${unit(14)};
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

const breatheGlow = keyframes`
	0% {
		box-shadow: 0 0 ${unit(10)} rgba(91, 166, 255, 0.22);
		opacity: 0.84;
	}
	50% {
		box-shadow: 0 0 ${unit(24)} rgba(118, 194, 255, 0.52);
		opacity: 1;
	}
	100% {
		box-shadow: 0 0 ${unit(10)} rgba(91, 166, 255, 0.22);
		opacity: 0.84;
	}
`;

const fadeStage = keyframes`
	from {
		opacity: 0;
		transform: translateY(${unit(10)});
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
`;

const StepShell = styled.div`
	width: 100%;
	display: flex;
	justify-content: center;
	position: relative;
	padding-top: ${unit(44)};
	box-sizing: border-box;

	@media screen and (max-width: 900px) {
		padding-right: ${unit(24)};
		padding-top: ${unit(56)};
	}
`;

const StepRail = styled.aside`
	position: fixed;
	right: ${unit(40)};
	top: 50%;
	transform: translateY(-50%);
	display: flex;
	align-items: stretch;
	gap: ${unit(16)};
	min-width: ${unit(188)};
	z-index: 20;

	@media screen and (max-width: 1200px) {
		right: ${unit(24)};
	}

	@media screen and (max-width: 900px) {
		position: static;
		transform: none;
		margin-bottom: ${unit(18)};
		align-self: center;
	}
`;

const StepLabelColumn = styled.div`
	display: flex;
	flex-direction: column;
	align-items: flex-end;
`;

const StepItem = styled.button<{ $clickable: boolean; $hoverable: boolean }>`
	display: flex;
	align-items: center;
	justify-content: flex-end;
	height: ${unit(86)};
	min-height: ${unit(86)};
	background: transparent;
	border: none;
	padding: 0;
	cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
`;

const StepLabel = styled.span<{ $active: boolean; $completed: boolean; $viewed: boolean; $hovered: boolean }>`
	font-size: ${({ $viewed }) => ($viewed ? unit(15) : unit(13))};
	font-weight: ${({ $active, $viewed }) => ($active || $viewed ? 700 : 600)};
	min-width: ${unit(84)};
	text-align: right;
	color: ${({ $active, $completed, $hovered, $viewed }) =>
		$hovered || $viewed
			? 'rgba(244, 249, 255, 1)'
			: $completed
				? 'rgba(220, 233, 255, 0.95)'
				: $active
					? 'white'
					: 'rgba(171, 184, 207, 0.9)'};
	transition: color 0.2s ease, text-shadow 0.2s ease, transform 0.2s ease;
	text-shadow: ${({ $hovered, $viewed }) =>
		$hovered || $viewed ? `0 0 ${unit(18)} rgba(120, 191, 255, 0.5)` : 'none'};
	transform: ${({ $hovered, $viewed }) =>
		$hovered || $viewed ? `translateX(-${unit(8)})` : 'translateX(0)'};
`;

const StepGaugeColumn = styled.div`
	height: ${unit(344)};
	display: flex;
	align-items: stretch;
`;

const StepGaugeTrack = styled.div`
	position: relative;
	width: ${unit(10)};
	height: 100%;
	border-radius: ${unit(999)};
	background: rgba(130, 144, 172, 0.18);
	overflow: hidden;
	box-shadow: inset 0 0 0 1px rgba(148, 167, 200, 0.18);
`;

const StepGaugeFill = styled.div`
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	border-radius: ${unit(999)};
	background: linear-gradient(180deg, rgba(137, 224, 255, 0.96) 0%, rgba(89, 164, 255, 0.96) 48%, rgba(43, 111, 223, 0.92) 100%);
	box-shadow:
		0 0 ${unit(24)} rgba(118, 194, 255, 0.34),
		0 0 ${unit(40)} rgba(77, 147, 255, 0.22);
	animation: ${breatheGlow} 2.8s ease-in-out infinite;
	transition: height 0.55s ease;
`;

const StepGaugeSegments = styled.div`
	position: absolute;
	inset: 0;
	display: grid;
	grid-template-rows: repeat(4, 1fr);
`;

const StepGaugeSegment = styled.button<{ $hovered: boolean; $viewed: boolean; $clickable: boolean }>`
	border: none;
	background: ${({ $hovered, $viewed }) =>
		$hovered ? 'rgba(164, 219, 255, 0.22)' : $viewed ? 'rgba(134, 196, 255, 0.12)' : 'transparent'};
	cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
	transition: background-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		box-shadow: ${({ $clickable }) =>
			$clickable ? `inset 0 0 0 1px rgba(155, 212, 255, 0.42), 0 0 ${unit(10)} rgba(126, 196, 255, 0.22)` : 'none'};
	}
`;

const StepPanel = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
	padding: 0 ${unit(12)};
	box-sizing: border-box;
`;

const StepForm = styled(S.Form)`
	width: 100%;
	align-items: center;
	align-self: center;
`;

const StageSurface = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	animation: ${fadeStage} 0.28s ease;
`;

const ConfigureStageLayout = styled.div`
	width: min(${unit(1120)}, calc(100vw - ${unit(96)}));
	display: grid;
	grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
	gap: ${unit(20)};
	align-items: stretch;

	@media screen and (max-width: 980px) {
		width: min(${unit(720)}, calc(100vw - ${unit(40)}));
		grid-template-columns: 1fr;
	}
`;

const ConfigurePrimaryColumn = styled.div`
	display: grid;
	grid-template-rows: auto 1fr;
	gap: ${unit(12)};
	min-width: 0;
	height: 100%;

	> section {
		margin-bottom: 0;
	}

	> section:last-of-type {
		height: 100%;
	}
`;

const ConfigureSecondaryColumn = styled.div`
	display: flex;
	flex-direction: column;
	min-width: 0;
	height: 100%;

	> section {
		margin-bottom: 0;
		flex: 1;
		height: 100%;
	}
`;

const ConfigureActionRow = styled.div`
	width: min(${unit(1120)}, calc(100vw - ${unit(96)}));
	display: flex;
	justify-content: center;
	margin-top: ${unit(20)};

	@media screen and (max-width: 980px) {
		width: min(${unit(720)}, calc(100vw - ${unit(40)}));
	}
`;

const UploadIntroBlock = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	text-align: left;
	margin-bottom: ${unit(12)};
`;

const UploadDropBox = styled.div`
	width: min(${unit(660)}, calc(100vw - ${unit(48)}));
	min-height: ${unit(220)};
	border-radius: ${unit(18)};
	border: 2px dashed rgba(145, 181, 230, 0.55);
	background: rgba(10, 24, 52, 0.24);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: ${unit(28)} ${unit(24)};
	box-sizing: border-box;
	margin-bottom: ${unit(22)};
	align-self: center;
`;

const UploadBoxIcon = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	width: ${unit(82)};
	height: ${unit(82)};
	border-radius: ${unit(999)};
	background: rgba(18, 42, 82, 0.28);
	color: rgba(175, 208, 252, 0.95);
	box-shadow: inset 0 0 0 1px rgba(163, 193, 236, 0.18);
`;

const UploadGuideBlock = styled.div`
	width: min(${unit(660)}, calc(100vw - ${unit(48)}));
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	margin-bottom: ${unit(18)};
`;

const UploadActionButton = styled(S.LinkInsertButton)`
	margin-bottom: 0;
`;

const UploadGuideText = styled(S.ManualText)`
	margin-top: 0;
	margin-bottom: ${unit(18)};
	white-space: pre-line;
	text-align: center;
	align-self: center;
`;

const UploadGuideNotice = styled(S.UploadNotice)`
	text-align: center;
	align-self: center;
	margin-top: ${unit(16)};
`;

const ProjectPendingText = styled.p`
	color: rgba(255, 126, 126, 0.98);
	font-size: ${unit(14)};
	font-weight: 700;
	text-align: center;
	margin-top: ${unit(10)};
`;

const BackToWorkspaceButton = styled.button`
	position: fixed;
	// left: calc(${NAVBAR_WIDTH} + ${unit(50)});
	left:${unit(50)};
	top: ${unit(40)};
	height: ${unit(36)};
	padding: 0 ${unit(14)};
	border-radius: ${unit(999)};
	border: 1px solid rgba(164, 189, 227, 0.35);
	background: rgba(11, 25, 53, 0.34);
	color: rgba(215, 229, 255, 0.95);
	font-size: ${unit(14)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;

	&:hover {
		background: rgba(16, 34, 68, 0.5);
		border-color: rgba(183, 206, 241, 0.52);
		color: white;
	}

	@media screen and (max-width: 900px) {
		left: ${unit(16)};
		top: ${unit(14)};
	}
`;

const ProjectNameBadge = styled.div`
	position: fixed;
	right: ${unit(42)};
	top: ${unit(22)};
	height: ${unit(38)};
	display: inline-flex;
	align-items: center;
	padding: 0 ${unit(16)};
	border-radius: ${unit(999)};
	background: rgba(9, 23, 51, 0.48);
	color: rgba(234, 241, 255, 0.98);
	font-size: ${unit(14)};
	font-weight: 700;
	letter-spacing: -0.01em;
	z-index: 25;

	span {
		display: inline-flex;
		align-items: center;
		gap: ${unit(4)};
		color: rgba(195, 213, 247, 0.98);
		font-weight: 600;
	}
`;

const BreadcrumbChevron = styled.i`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: rgba(183, 204, 241, 0.92);
	margin-left:${unit(5)};
`;

const UploadVideoPreview = styled.div`
	width: min(${unit(660)}, calc(100vw - ${unit(48)}));
	margin-bottom: ${unit(16)};
`;

const UploadVideoSurface = styled.div`
	position: relative;
	width: 100%;
	aspect-ratio: 16 / 9;
	border-radius: ${unit(16)};
	border: 1px solid rgba(171, 197, 238, 0.35);
	background:
		linear-gradient(180deg, rgba(20, 42, 83, 0.42), rgba(10, 23, 49, 0.48)),
		linear-gradient(135deg, rgba(132, 172, 238, 0.18), rgba(255, 255, 255, 0.05));
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: inset 0 0 0 1px rgba(174, 202, 241, 0.12);
`;

const UploadVideoLabel = styled.span`
	color: rgba(229, 238, 255, 0.92);
	font-size: ${unit(15)};
	font-weight: 700;
	letter-spacing: -0.01em;
`;

const ProjectNameOverlay = styled.div<{ $closing?: boolean }>`
	@keyframes blueOverlayFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes blueOverlayFadeOut {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	position: fixed;
	inset: 0;
	background: rgba(6, 15, 32, 0.52);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 40;
	animation: ${({ $closing }) => ($closing ? 'blueOverlayFadeOut 0.22s ease forwards' : 'blueOverlayFadeIn 0.22s ease forwards')};
`;

const ProjectNameModal = styled.div`
	width: min(${unit(420)}, calc(100vw - ${unit(40)}));
	padding: ${unit(28)};
	border-radius: ${unit(18)};
	background: rgba(244, 248, 255, 0.98);
	box-shadow: 0 ${unit(18)} ${unit(48)} rgba(7, 19, 43, 0.22);
	display: flex;
	flex-direction: column;
	gap: ${unit(12)};

	h3 {
		color: rgba(20, 34, 61, 1);
		font-size: ${unit(22)};
		font-weight: 800;
	}

	p {
		color: rgba(76, 92, 122, 1);
		font-size: ${unit(14)};
		line-height: 1.5;
	}

	input {
		width: 100%;
		height: ${unit(46)};
		padding: 0 ${unit(14)};
		border: 1px solid rgba(190, 204, 229, 1);
		border-radius: ${unit(12)};
		background: white;
		color: rgba(20, 34, 61, 1);
		font-size: ${unit(15)};
		box-sizing: border-box;
	}
`;

const BlueToneModalCard = styled(ProjectNameModal)<{ $closing?: boolean }>`
	@keyframes blueModalFadeSlideIn {
		from {
			opacity: 0;
			transform: translateY(${unit(18)});
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes blueModalFadeSlideOut {
		from {
			opacity: 1;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			transform: translateY(${unit(18)});
		}
	}

	background: rgba(242, 247, 255, 0.98);
	border: 1px solid rgba(187, 206, 240, 0.9);
	box-shadow: 0 ${unit(18)} ${unit(48)} rgba(28, 53, 96, 0.22);
	animation: ${({ $closing }) =>
		$closing ? 'blueModalFadeSlideOut 0.22s ease forwards' : 'blueModalFadeSlideIn 0.22s ease forwards'};

	h3 {
		color: rgba(26, 43, 89, 1);
	}

	p {
		color: rgba(86, 102, 128, 1);
	}

	input {
		background: rgba(255, 255, 255, 1);
	}
`;

const ProjectNameSubmitButton = styled.button`
	height: ${unit(44)};
	border: none;
	border-radius: ${unit(12)};
	background: rgba(36, 83, 166, 1);
	color: white;
	font-size: ${unit(15)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: rgba(46, 95, 183, 1);
		box-shadow: 0 ${unit(8)} ${unit(18)} rgba(25, 58, 118, 0.18);
	}
`;

const ModalSecondaryButton = styled.button`
	min-width: ${unit(78)};
	border: 1px solid rgba(202, 215, 236, 1);
	background: rgba(246, 248, 252, 1);
	color: rgba(53, 74, 112, 1);
	border-radius: ${unit(8)};
	padding: ${unit(10)} ${unit(16)};
	font-size: ${unit(14)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

	&:hover {
		background: rgba(239, 244, 251, 1);
		border-color: rgba(186, 203, 232, 1);
		box-shadow: 0 ${unit(6)} ${unit(14)} rgba(41, 85, 168, 0.22);
	}
`;

const ModalPrimaryButton = styled.button`
	min-width: ${unit(78)};
	border: none;
	background: rgba(41, 85, 168, 1);
	color: white;
	border-radius: ${unit(8)};
	padding: ${unit(10)} ${unit(16)};
	font-size: ${unit(14)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: rgba(49, 95, 183, 1);
		box-shadow: 0 ${unit(6)} ${unit(14)} rgba(41, 85, 168, 0.22);
	}
`;

const ContentTextBlock = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-bottom: ${unit(26)};
	width: min(${unit(760)}, calc(100vw - ${unit(48)}));
`;

const TitleText = styled.h1`
	font-weight: 800;
	font-size: ${unit(32)};
	line-height: ${unit(42)};
	text-align: center;
	white-space: pre-line;
	background: linear-gradient(90deg, #4b89d4 0%, #57d7ee 54.5%, #68acff 74%, #a0c3ff 100%);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
	color: transparent;
	margin-bottom: ${unit(18)};
`;

const SubTextLeft = styled.p`
	font-weight: 400;
	font-size: ${unit(16)};
	line-height: ${unit(28)};
	text-align: center;
	white-space: pre-line;
	color: white;
`;

const UploadCompleteCard = styled.section<{ $compact?: boolean; $fullWidth?: boolean }>`
	width: ${({ $fullWidth }) => ($fullWidth ? '100%' : `min(${unit(660)}, calc(100vw - ${unit(48)}))`)};
	border-radius: ${unit(14)};
	border: 1px solid rgba(168, 196, 238, 0.65);
	background: rgba(235, 244, 255, 0.15);
	backdrop-filter: blur(${unit(4)});
	padding: ${({ $compact }) => ($compact ? unit(14) : unit(16))};
	display: flex;
	flex-direction: column;
	gap: ${({ $compact }) => ($compact ? unit(10) : unit(12))};
	margin-bottom: ${({ $compact }) => ($compact ? unit(10) : unit(16))};

	strong {
		font-size: ${unit(20)};
		font-weight: 700;
		color: white;
	}

	p {
		font-size: ${unit(15)};
		color: rgba(220, 233, 255, 0.92);
		line-height: 1.5;
	}
`;

const VideoInfoName = styled.strong`
	font-size: ${unit(19)};
	font-weight: 700;
	color: rgba(245, 249, 255, 0.98);
	line-height: 1.4;
`;

const CompletionCard = styled.section`
	width: min(${unit(660)}, calc(100vw - ${unit(48)}));
	min-height: ${unit(220)};
	border-radius: ${unit(18)};
	border: 1px solid rgba(168, 196, 238, 0.42);
	background: rgba(235, 244, 255, 0.12);
	backdrop-filter: blur(${unit(4)});
	padding: ${unit(24)};
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	gap: ${unit(12)};

	strong {
		font-size: ${unit(22)};
		font-weight: 800;
		color: white;
	}

	p {
		font-size: ${unit(15)};
		line-height: 1.6;
		color: rgba(220, 233, 255, 0.92);
	}
`;

const MetaRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: ${unit(10)};

	span {
		display: inline-flex;
		align-items: center;
		padding: ${unit(7)} ${unit(12)};
		border-radius: ${unit(999)};
		border: 1px solid rgba(164, 188, 226, 0.7);
		background: rgba(16, 44, 92, 0.35);
		font-size: ${unit(13)};
		font-weight: 700;
		color: rgba(227, 238, 255, 0.96);
	}
`;

const ConfigTitle = styled.h2`
	font-size: ${unit(19)};
	font-weight: 800;
	color: white;
`;

const ConfigModeRow = styled.div`
	display: flex;
	gap: ${unit(10)};
`;

const ModeButton = styled.button<{ $active: boolean }>`
	border: 1px solid ${({ $active }) => ($active ? 'rgba(120, 203, 255, 0.9)' : 'rgba(158, 181, 219, 0.7)')};
	background: ${({ $active }) => ($active ? 'rgba(30, 87, 157, 0.95)' : 'rgba(12, 44, 95, 0.55)')};
	color: white;
	font-size: ${unit(14)};
	font-weight: 700;
	border-radius: ${unit(999)};
	padding: ${unit(8)} ${unit(16)};
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
	gap: ${unit(12)};

	@media screen and (max-width: 768px) {
		grid-template-columns: 1fr;
	}
`;

const ResultButton = styled.button`
	height: ${unit(44)};
	padding: 0 ${unit(18)};
	border: none;
	border-radius: ${unit(999)};
	background: rgba(41, 85, 168, 1);
	color: white;
	font-size: ${unit(15)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: rgba(50, 96, 184, 1);
		box-shadow: 0 ${unit(8)} ${unit(16)} rgba(24, 59, 126, 0.28);
	}
`;

const dotPulse = keyframes`
	0%, 80%, 100% { transform: scale(0.85); opacity: 0.4; }
	40% { transform: scale(1); opacity: 1; }
`;

const ProgressDots = styled.div`
	display: flex;
	align-items: center;
	gap: ${unit(8)};

	span {
		width: ${unit(10)};
		height: ${unit(10)};
		border-radius: ${unit(999)};
		background: rgba(129, 205, 255, 0.96);
		animation: ${dotPulse} 1.2s ease-in-out infinite;
	}

	span:nth-of-type(2) {
		animation-delay: 0.16s;
	}

	span:nth-of-type(3) {
		animation-delay: 0.32s;
	}
`;

const PresetControlRow = styled.div`
	display: flex;
	gap: ${unit(8)};
	align-items: center;
`;

const PresetSelectWrap = styled.div`
	flex: 1;
	min-width: 0;
`;

const PresetActionButton = styled.button<{ $variant?: 'default' | 'primary' | 'danger' }>`
	height: ${unit(40)};
	padding: 0 ${unit(14)};
	border-radius: ${unit(8)};
	border: 1px solid
		${({ $variant }) =>
			$variant === 'primary'
				? 'rgba(41, 85, 168, 1)'
				: $variant === 'danger'
					? 'rgba(214, 88, 88, 1)'
					: 'rgba(104, 129, 175, 1)'};
	background: ${({ $variant }) =>
		$variant === 'primary'
			? 'rgba(41, 85, 168, 1)'
			: $variant === 'danger'
				? 'rgba(255, 238, 238, 1)'
				: 'rgba(233, 242, 255, 1)'};
	color: ${({ $variant }) =>
		$variant === 'primary' ? 'white' : $variant === 'danger' ? 'rgba(183, 44, 44, 1)' : 'rgba(35, 65, 126, 1)'};
	font-size: ${unit(13)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: ${({ $variant }) =>
			$variant === 'primary'
				? 'rgba(50, 96, 184, 1)'
				: $variant === 'danger'
					? 'rgba(255, 229, 229, 1)'
					: 'rgba(220, 233, 252, 1)'};
		border-color: ${({ $variant }) =>
			$variant === 'primary'
				? 'rgba(50, 96, 184, 1)'
				: $variant === 'danger'
					? 'rgba(198, 70, 70, 1)'
					: 'rgba(77, 110, 171, 1)'};
		box-shadow: ${({ $variant }) =>
			$variant === 'primary'
				? `0 ${unit(8)} ${unit(16)} rgba(24, 59, 126, 0.28)`
				: `0 ${unit(4)} ${unit(10)} rgba(32, 65, 126, 0.12)`};
	}

	&:disabled {
		background: rgba(221, 227, 238, 1);
		border-color: rgba(170, 181, 203, 1);
		color: rgba(112, 121, 138, 1);
		cursor: default;
	}
`;

const PresetModalActions = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: ${unit(8)};
`;

const SplitCounter = styled.div<{ $disabled: boolean }>`
	display: inline-grid;
	grid-template-columns: ${unit(44)} ${unit(64)} ${unit(44)};
	align-items: center;
	height: ${unit(44)};
	border-radius: ${unit(10)};
	border: 1px solid ${({ $disabled }) => ($disabled ? 'rgba(170, 181, 203, 1)' : 'rgba(174, 199, 235, 0.65)')};
	background: ${({ $disabled }) => ($disabled ? 'rgba(221, 227, 238, 1)' : 'rgba(245, 250, 255, 0.96)')};
	overflow: hidden;
	width: fit-content;
`;

const SplitCounterButton = styled.button`
	height: 100%;
	border: none;
	background: transparent;
	color: rgba(35, 65, 126, 1);
	font-size: ${unit(20)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, color 0.2s ease;

	&:hover {
		background: rgba(226, 237, 252, 1);
	}

	&:disabled {
		color: rgba(112, 121, 138, 1);
		cursor: default;
	}

	&:disabled:hover {
		background: transparent;
	}
`;

const SplitCounterValue = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100%;
	border-left: 1px solid rgba(201, 211, 225, 0.8);
	border-right: 1px solid rgba(201, 211, 225, 0.8);
	color: rgba(27, 39, 63, 1);
	font-size: ${unit(15)};
	font-weight: 700;
`;

const ModeTip = styled.div`
	margin-top: auto;
	min-height: ${unit(68)};
	display: flex;
	flex-direction: column;
	gap: ${unit(4)};
	padding-top:${unit(10)};

	strong {
		font-size: ${unit(14)};
		font-weight: 800;
		color: rgba(214, 232, 255, 0.98);
	}

	p {
		font-size: ${unit(13)};
		line-height: 1.6;
		color: rgba(188, 207, 238, 0.94);
		margin: 0;
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
	gap: ${unit(15)};

	strong {
		font-size: ${unit(14)};
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
	font-size: ${unit(13)};
	font-weight: 700;
	padding: ${unit(8)} ${unit(12)};
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
	width: min(${unit(360)}, 100%);
	height: ${unit(54)};
	border-radius: ${unit(999)};
	border: none;
	background: rgba(41, 85, 168, 1);
	color: white;
	font-size: ${unit(17)};
	font-weight: 700;
	cursor: pointer;
	transition: background-color 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: rgba(50, 96, 184, 1);
		box-shadow: 0 ${unit(8)} ${unit(16)} rgba(24, 59, 126, 0.28);
	}
`;
