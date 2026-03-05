'use client';

import { usePathname, useRouter } from 'next/navigation';
import * as S from '../styled';
import { useModal } from '@/shared/hooks';
import { errorToast } from '@/shared/utils/toastUtils';
import { FileRejection, useDropzone } from 'react-dropzone';
import { isEmpty, uniqBy } from 'lodash-es';
import { SubmitHandler, useForm } from 'react-hook-form';
import { ACCEPTED_VIDEO_TYPES, validateFileTypes } from '../helper';
import { getUploadUrl, uploadToGCS, confirmUpload } from '@/shared/apis/video';
import Loader from '@/components/Loader';
import { useEffect, useState } from 'react';
import InsertLinkModal from './InsertLinkModal';

interface IFormValues {
	files: any;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_FILE_LENGTH = 1;
const MIN_VIDEO_DURATION = 60; // 1분
const MAX_VIDEO_DURATION = 2700; // 45분
const LAST_VIDEO_ID_KEY = 'genova_active_video_id';

export default function UploadContent() {
	const router = useRouter();
	const pathname = usePathname();
	const { custom, closeFreeModal, confirm, closeConfirm } = useModal();

	const [isBusy, setIsBusy] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [hasExistingWork, setHasExistingWork] = useState(false);

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
			const newFiles = uniqBy([...watchFiles, ...files], 'lastModified');

			if (newFiles.length > MAX_FILE_LENGTH) {
				setValue('files', watchFiles);
				errorToast(`파일은 최대 1개까지 첨부 가능합니다.`);
				return;
			}

			// 영상 길이 검증
			const isValid = await validateVideoDuration(newFiles[0]);
			if (!isValid) {
				setValue('files', watchFiles);
				return;
			}

			setValue('files', newFiles);
			handleProceedWithExistingWorkCheck(() => {
				handleSubmit(onSubmit)();
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

	const handleInsertLink = () => {
		handleProceedWithExistingWorkCheck(() => {
			custom({
				needCloseButton: true,
				children: <InsertLinkModal setIsBusy={setIsBusy} onClose={() => closeFreeModal()} />,
			});
		});
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
					<S.LinkInsertButton onClick={handleInsertLink} type="button">
						링크 삽입
					</S.LinkInsertButton>

					<S.ManualText>{`여기로 파일을 드래그하거나\n파일 업로드 버튼을 클릭하세요.`}</S.ManualText>

					<S.UploadButton htmlFor="video-file">파일 업로드</S.UploadButton>

					<S.UploadNotice>{`(영상 길이 1~45분, 최대 2GB, MP4·MOV·WMV·AVI 가능)`}</S.UploadNotice>

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
