'use client';

import * as S from './styled';

import { SubmitHandler, useForm } from 'react-hook-form';
import { errorToast } from '@/shared/utils/toastUtils';
import { isEmpty, uniqBy } from 'lodash-es';
import { FileRejection, useDropzone } from 'react-dropzone';
import { ACCEPTED_VIDEO_TYPES, validateFileTypes } from '@/app/(root)/helper';
import { useModal } from '@/shared/hooks';
import { useMemo, useState } from 'react';
import { uploadByFile, uploadByLink, getUploadUrl, uploadToGCS, confirmUpload } from '@/shared/apis/video';
import { useRouter } from 'next/navigation';
import { REGEX, validateYouTubeUrl } from '@/shared/utils/base';

interface IFormValues {
	files: any;
	input: string;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_FILE_LENGTH = 1;
const MIN_VIDEO_DURATION = 60; // 1분
const MAX_VIDEO_DURATION = 2700; // 45분

interface Props {
	setIsBusy: (value: boolean) => void;
	onClose: () => void;
}

export default function NewVideoModal({ setIsBusy, onClose }: Props) {
	const router = useRouter();
	const {
		formState: { errors },
		register,
		handleSubmit,
		setValue,
		watch,
	} = useForm<IFormValues>();

	const watchFiles: File[] = watch('files');
	const watchInput = watch('input');

	const validateVideoDuration = (file: File): Promise<boolean> => {
		return new Promise((resolve) => {
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
			handleSubmit(onSubmit)();
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

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop: handleLoadFiles,
		onDropRejected: handleDropRejected,
		accept: ACCEPTED_VIDEO_TYPES,
		maxSize: MAX_FILE_SIZE,
		noClick: true,
		multiple: false,
	});

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

	const onSubmit: SubmitHandler<IFormValues> = async ({ files, input }) => {
		if (isEmpty(files)) {
			// 링크로 업로드
			const trimmedInput = input.trim();
			if (!isEmpty(input) && isEmpty(trimmedInput)) return;

			onClose();
			setIsBusy(true);

			// YouTube URL 검증 및 정규화
			const youtubeValidation = validateYouTubeUrl(trimmedInput);
			const urlToSend = youtubeValidation.isValid ? youtubeValidation.cleanUrl! : trimmedInput;

			console.log('[NewVideoModal] URL 검증:', {
				original: trimmedInput,
				isYouTube: youtubeValidation.isValid,
				videoId: youtubeValidation.videoId,
				cleanUrl: youtubeValidation.cleanUrl,
				sending: urlToSend
			});

			uploadByLink({ url: urlToSend })
				.then((res) => {
					const { video_id } = res;

					if (video_id) {
						router.push(`/video/${video_id}/summary`);
						console.log('[파일 업로드 성공]', video_id);
					}
				})
				.catch((error) => {
					console.log('[파일 업로드 에러]', error);

					// 에러 코드 처리
					if (error?.error_code === 1003) {
						errorToast('영상 길이는 최소 1분 이상이어야 합니다.');
					} else if (error?.error_code === 1008) {
						errorToast('영상 길이는 최대 45분까지 업로드 가능합니다.');
					} else if (error?.error_code === 1002) {
						errorToast('파일 크기가 2GB를 초과합니다.');
					} else if (error?.error_code === 1700) {
						errorToast('유효하지 않은 YouTube URL입니다.');
					} else if (error?.error_code === 1701) {
						errorToast('YouTube 영상 다운로드에 실패했습니다. 잠시 후 다시 시도해주세요.');
					} else if (error?.error_code === 1702) {
						errorToast('존재하지 않거나 삭제된 영상입니다.');
					} else if (error?.error_code === 1703) {
						errorToast('연령 제한 영상은 다운로드할 수 없습니다.');
					} else if (error?.error_code === 1704) {
						errorToast('비공개 영상은 다운로드할 수 없습니다.');
					} else if (error?.error_code === 1705) {
						errorToast('해당 영상은 한국에서 재생할 수 없습니다. (지역 제한)');
					} else if (error?.error_code === 1706) {
						errorToast('실시간 스트리밍 영상은 지원하지 않습니다.');
					} else {
						errorToast('영상 업로드에 실패했습니다.');
					}
				})
				.finally(() => {
					setIsBusy(false);
				});
		} else {
			// 파일로 업로드
			onClose();
			setIsBusy(true);

			(async () => {
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

					// Step 2: GCS에 직접 업로드
					console.log('[Step 2] Uploading to GCS...', { video_id });
					const normalizedContentType = contentType;
					await uploadToGCS(upload_url, file, normalizedContentType);

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
				}
			})();
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

	const isValidUrl = useMemo(() => {
		const urlPattern = REGEX.url;
		return watchInput ? urlPattern.test(watchInput) : false;
	}, [watchInput]);

	return (
		<S.AddThumbnailContainer {...getRootProps()} onSubmit={handleSubmit(onSubmit)}>
			<input {...getInputProps()} />
			<h2>{`새로운 영상으로 시작할까요?`}</h2>
			<p>{`새 영상을 추가하면 현재 진행 중인 작업은 초기화됩니다.\n원하는 파일을 업로드하거나 링크를 삽입하여 새롭게 시작하세요.`}</p>

			<S.DragAndDropWrapper isDragActive={isDragActive}>
				<h5>업로드할 파일 놓기</h5>
				<p>{`(영상 길이 1~45분, 최대 2GB, MP4·MOV·WMV·AVI 가능)`}</p>

				<S.UploadButton htmlFor="video-file-modal">파일 업로드</S.UploadButton>
				<input
					{...isRegister}
					name="files"
					type="file"
					id="video-file-modal"
					accept=".mp4,.mov,.wmv,.avi"
					multiple={false}
					style={{ display: 'none' }}
				/>
			</S.DragAndDropWrapper>

			<S.Divider />

			<S.InserLinkH3Label>링크 삽입</S.InserLinkH3Label>
			<S.LinkInput
				{...register('input', {
					pattern: {
						value: REGEX.url,
						message: '유효한 URL을 입력해주세요. (예: https://www.youtube.com/watch?v=...)',
					},
				})}
				placeholder="YouTube URL 또는 일반 URL을 입력하세요."
				error={!!errors.input}
			/>

			{errors.input && <S.ErrorMessage>{errors.input.message}</S.ErrorMessage>}

			<S.LinkInsertButtonWrapper error={!isValidUrl}>
				<button type="button" onClick={onClose}>
					취소
				</button>

				<button type="submit">확인</button>
			</S.LinkInsertButtonWrapper>
		</S.AddThumbnailContainer>
	);
}
